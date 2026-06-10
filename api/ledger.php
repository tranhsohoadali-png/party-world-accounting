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

// Bảng accounting_entries có thể chưa được cài (package MCP) -> trả rỗng
function pw_table_exists(PDO $pdo, string $t): bool {
  try { $pdo->query("SELECT 1 FROM `$t` LIMIT 1"); return true; }
  catch (Throwable $e) { return false; }
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
if ($q !== '') { $w[] = '(e.description LIKE ? OR e.category LIKE ?)'; $p[] = "%$q%"; $p[] = "%$q%"; }
$where = $w ? ('WHERE ' . implode(' AND ', $w)) : '';

// Tổng hợp theo loại (trên toàn bộ kết quả lọc)
$sumRows = $pdo->prepare("SELECT entry_type, SUM(amount) t, COUNT(*) c FROM accounting_entries e $where GROUP BY entry_type");
$sumRows->execute($p);
$summary = ['income' => 0, 'expense' => 0, 'receivable' => 0, 'payable' => 0, 'inventory_in' => 0, 'inventory_out' => 0, 'count' => 0];
foreach ($sumRows->fetchAll() as $r) {
  $summary[$r['entry_type']] = (float)$r['t'];
  $summary['count'] += (int)$r['c'];
}
$summary['profit'] = $summary['income'] - $summary['expense'];

if ($action === 'summary') {
  json_out(['ok' => true, 'installed' => true, 'summary' => $summary]);
}

// Danh sách entry
$limit = min(1000, max(1, (int)($_GET['limit'] ?? 300)));
$sql = "SELECT e.id, e.entry_type, e.entry_date, e.description, e.amount, e.category,
          e.quantity, e.source, e.created_by, e.created_at,
          c.name AS counterparty_name, i.name AS item_name, i.code AS item_code
        FROM accounting_entries e
        LEFT JOIN counterparties c ON c.id = e.counterparty_id
        LEFT JOIN inventory_items i ON i.id = e.inventory_item_id
        $where
        ORDER BY e.entry_date DESC, e.id DESC
        LIMIT $limit";
$st = $pdo->prepare($sql);
$st->execute($p);
json_out(['ok' => true, 'installed' => true, 'summary' => $summary, 'entries' => $st->fetchAll()]);
