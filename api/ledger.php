<?php
/* ============================================================
   ledger.php — Đọc "Sổ giao dịch" (bảng accounting_entries do
   Claude/MCP ghi vào) để hiển thị trong web app DALI.
   Dùng phiên đăng nhập sẵn của app (không cần token).
   ============================================================ */
require __DIR__ . '/lib.php';
require_login();

$pdo = pdo();
$action = $_GET['action'] ?? 'list';

// Bảng do package MCP tạo, có thể chưa cài -> trả rỗng
function pw_table_exists(PDO $pdo, string $t): bool {
  try { $pdo->query("SELECT 1 FROM `$t` LIMIT 1"); return true; }
  catch (Throwable $e) { return false; }
}

// Tồn kho (inventory_items) từ sổ MCP
if ($action === 'inventory') {
  if (!pw_table_exists($pdo, 'inventory_items')) json_out(['ok' => true, 'installed' => false, 'items' => []]);
  $rows = $pdo->query("SELECT id, code, name, unit, category, current_qty, cost_per_unit, is_active, updated_at
                       FROM inventory_items ORDER BY is_active DESC, name")->fetchAll();
  json_out(['ok' => true, 'installed' => true, 'items' => $rows]);
}

// Đối tác (counterparties: NCC + KH) từ sổ MCP
if ($action === 'counterparties') {
  if (!pw_table_exists($pdo, 'counterparties')) json_out(['ok' => true, 'installed' => false, 'parties' => []]);
  $rows = $pdo->query("SELECT id, type, name, short_name, tax_code, phone, bank_account, bank_name, current_balance, is_active
                       FROM counterparties ORDER BY name")->fetchAll();
  json_out(['ok' => true, 'installed' => true, 'parties' => $rows]);
}
if (!pw_table_exists($pdo, 'accounting_entries')) {
  json_out(['ok' => true, 'installed' => false, 'entries' => [], 'summary' => null,
    'note' => 'Chưa cài Sổ giao dịch (bảng accounting_entries). Hãy chạy package MCP.']);
}

// Bộ lọc dùng chung
$type = $_GET['type'] ?? '';
$from = preg_match('/^\d{4}-\d{2}-\d{2}$/', $_GET['from'] ?? '') ? $_GET['from'] : null;
$to   = preg_match('/^\d{4}-\d{2}-\d{2}$/', $_GET['to'] ?? '') ? $_GET['to'] : null;
$q    = trim($_GET['q'] ?? '');
$w = []; $p = [];
if ($type !== '') { $w[] = 'e.entry_type = ?'; $p[] = $type; }
if ($from) { $w[] = 'e.entry_date >= ?'; $p[] = $from; }
if ($to)   { $w[] = 'e.entry_date <= ?'; $p[] = $to; }
if ($q !== '') {
  // Tìm trên mô tả, danh mục, tên đối tác, tên/mã mặt hàng
  $w[] = '(e.description LIKE ? OR e.category LIKE ? OR c.name LIKE ? OR i.name LIKE ? OR i.code LIKE ?)';
  $p[] = "%$q%"; $p[] = "%$q%"; $p[] = "%$q%"; $p[] = "%$q%"; $p[] = "%$q%";
}
$where = $w ? ('WHERE ' . implode(' AND ', $w)) : '';

// JOIN dùng chung cho cả truy vấn tổng hợp & danh sách (để bộ lọc $where tham chiếu c.name/i.name được)
$joins = "LEFT JOIN counterparties c ON c.id = e.counterparty_id
          LEFT JOIN inventory_items i ON i.id = e.inventory_item_id";

// Tổng hợp theo loại (trên toàn bộ kết quả lọc). Đổi alias COUNT thành 'cnt' tránh đụng alias bảng 'c'.
$sumRows = $pdo->prepare("SELECT e.entry_type, SUM(e.amount) t, COUNT(*) cnt
                          FROM accounting_entries e $joins $where GROUP BY e.entry_type");
$sumRows->execute($p);
$summary = ['income' => 0, 'expense' => 0, 'receivable' => 0, 'payable' => 0, 'inventory_in' => 0, 'inventory_out' => 0, 'count' => 0];
foreach ($sumRows->fetchAll() as $r) {
  $summary[$r['entry_type']] = (float)$r['t'];
  $summary['count'] += (int)$r['cnt'];
}
$summary['profit'] = $summary['income'] - $summary['expense'];

if ($action === 'summary') {
  json_out(['ok' => true, 'installed' => true, 'summary' => $summary]);
}

// Danh sách entry
$limit = min(1000, max(1, (int)($_GET['limit'] ?? 300)));
$sql = "SELECT e.id, e.entry_type, e.entry_date, e.description, e.amount, e.category,
          e.quantity, e.data, e.source, e.created_by, e.created_at,
          c.name AS counterparty_name, i.name AS item_name, i.code AS item_code
        FROM accounting_entries e
        $joins
        $where
        ORDER BY e.entry_date DESC, e.id DESC
        LIMIT $limit";
$st = $pdo->prepare($sql);
$st->execute($p);
$entries = $st->fetchAll();
// Giải mã cột data (JSON) -> object để frontend đọc ghi chú / hạn thanh toán
foreach ($entries as &$e) {
  if (!empty($e['data'])) { $d = json_decode($e['data'], true); $e['data'] = is_array($d) ? $d : null; }
  else { $e['data'] = null; }
}
unset($e);
json_out(['ok' => true, 'installed' => true, 'summary' => $summary, 'entries' => $entries]);
