<?php
/**
 * /api/v1/entries.php
 * - POST /api/v1/entries        → tạo entry mới (chi/thu/công nợ/inventory)
 * - GET  /api/v1/entries?...     → list (filter theo type, date range, category)
 * - GET  /api/v1/entries/{id}    → chi tiết
 * - DELETE /api/v1/entries/{id}  → xoá (soft delete optional)
 */

require_once __DIR__ . '/../helpers.php';
set_cors();

$method = $_SERVER['REQUEST_METHOD'];
$path_info = trim($_SERVER['PATH_INFO'] ?? '', '/');
$entry_id = $path_info !== '' ? (int)$path_info : null;

try {
    switch ($method) {
        case 'POST':
            $token = require_token('entries:write');
            handle_create($token);
            break;
        case 'GET':
            $token = require_token('entries:read');
            if ($entry_id) handle_get_one($entry_id);
            else           handle_list();
            break;
        case 'PUT':
            $token = require_token('entries:write');
            if (!$entry_id) json_error('Entry id required', 400);
            handle_update($token, $entry_id);
            break;
        case 'DELETE':
            $token = require_token('entries:write');
            if (!$entry_id) json_error('Entry id required', 400);
            handle_delete($token, $entry_id);
            break;
        default:
            json_error('Method not allowed', 405);
    }
} catch (Throwable $e) {
    audit_log($token['id'] ?? null, 500, null, $e->getMessage());
    json_error('Server error: ' . $e->getMessage(), 500);
}

// =============================================================
function handle_create(array $token): void {
    $data = read_json_body();
    require_fields($data, ['entry_type', 'entry_date', 'description', 'amount']);

    $allowed_types = ['expense','income','receivable','payable','inventory_in','inventory_out'];
    if (!in_array($data['entry_type'], $allowed_types, true)) {
        json_error('Invalid entry_type. Allowed: ' . implode(', ', $allowed_types), 422);
    }

    $entry_date = validate_date($data['entry_date']);
    $amount = validate_amount($data['amount']);
    $description = trim($data['description']);
    $payment_method = validate_payment_method($data['payment_method'] ?? null);

    // Resolve counterparty nếu được cung cấp dưới dạng tên
    $counterparty_id = null;
    if (!empty($data['counterparty_id'])) {
        $counterparty_id = (int)$data['counterparty_id'];
    } elseif (!empty($data['counterparty_name'])) {
        $counterparty_id = find_or_create_counterparty($data['counterparty_name'],
            $data['counterparty_type'] ?? 'supplier');
    }

    // Resolve inventory item nếu là inventory_in/out
    $inventory_item_id = null;
    $quantity = null;
    if (in_array($data['entry_type'], ['inventory_in','inventory_out'], true)) {
        $inventory_item_id = resolve_inventory_id($data);
        if ($inventory_item_id === null) {
            json_error('inventory_item_code or inventory_item_id required for inventory entries', 422);
        }
        if (!isset($data['quantity'])) json_error('quantity required for inventory entries', 422);
        $quantity = (float)$data['quantity'];
    }

    // PRE-RESOLVE mã hàng auto-link cho income/expense -> fail-fast TRƯỚC khi ghi gì.
    // (Tránh ghi nửa chừng: entry tiền đã lưu nhưng lại báo lỗi mã hàng sai.)
    $link_item = null; $link_qty = null;
    $hasItem = !empty($data['inventory_item_code']) || !empty($data['inventory_item_id']);
    if (in_array($data['entry_type'], ['income','expense'], true) && $hasItem
            && isset($data['quantity']) && (float)$data['quantity'] > 0) {
        $link_item = resolve_inventory_id($data);   // ném 422 nếu mã sai -> CHƯA INSERT gì
        $link_qty = (float)$data['quantity'];
    }

    // Ghi entry chính + (tuỳ chọn) entry tồn kho liên kết trong 1 GIAO DỊCH (atomic).
    $linked = null;
    db()->beginTransaction();
    try {
        $main = insert_entry([
            'entry_type'       => $data['entry_type'],
            'entry_date'       => $entry_date,
            'description'      => $description,
            'amount'           => $amount,
            'currency'         => $data['currency'] ?? 'VND',
            'payment_method'   => $payment_method,
            'category'         => $data['category'] ?? null,
            'counterparty_id'  => $counterparty_id,
            'inventory_item_id'=> $inventory_item_id,
            'quantity'         => $quantity,
            'data'             => $data['data'] ?? null,
            'source'           => $data['source'] ?? 'mcp',
        ], $token['name']);

        // LIÊN KẾT TỒN KHO TỰ ĐỘNG: expense -> inventory_in (nhập kho); income -> inventory_out (xuất kho).
        // Trigger DB tự cập nhật current_qty. Bỏ qua nếu entry chính là trùng.
        if (!$main['duplicate'] && $link_item) {
            $is_in = $data['entry_type'] === 'expense';
            if ($is_in) {
                $mv_amount = $amount;                          // nhập kho: giá trị = số tiền chi
            } else {
                $cs = db()->prepare('SELECT cost_per_unit FROM inventory_items WHERE id = ?');
                $cs->execute([$link_item]);
                $cpu = $cs->fetchColumn();
                $mv_amount = ($cpu !== false && $cpu !== null) ? round((float)$cpu * $link_qty, 2) : 0; // xuất kho: theo giá vốn nếu có
            }
            $linked = insert_entry([
                'entry_type'       => $is_in ? 'inventory_in' : 'inventory_out',
                'entry_date'       => $entry_date,
                'description'      => '[Tự động] ' . ($is_in ? 'Nhập kho từ chi #' : 'Xuất kho từ thu #') . $main['id']
                                       . ': ' . mb_substr($description, 0, 120),
                'amount'           => $mv_amount,
                'payment_method'   => null,
                'category'         => $data['category'] ?? null,
                'inventory_item_id'=> $link_item,
                'quantity'         => $link_qty,
                'data'             => ['auto' => true, 'auto_from_entry_id' => $main['id']],
                'source'           => $data['source'] ?? 'mcp',
            ], $token['name']);
        }
        db()->commit();
    } catch (Throwable $e) {
        if (db()->inTransaction()) db()->rollBack();
        throw $e;
    }

    audit_log($token['id'], $main['duplicate'] ? 200 : 201, $main['id'],
        $main['duplicate'] ? 'Duplicate, returned existing' : null);
    $resp = [
        'ok'         => true,
        'id'         => $main['id'],
        'dedup_hash' => $main['hash'],
        'message'    => $main['duplicate'] ? 'Entry already exists with same date+amount+description' : 'Entry created',
    ];
    if ($main['duplicate']) $resp['duplicate'] = true;
    if ($linked && !$linked['duplicate']) {
        $resp['inventory_movement'] = [
            'id'       => $linked['id'],
            'type'     => $data['entry_type'] === 'expense' ? 'inventory_in' : 'inventory_out',
            'quantity' => (float)$data['quantity'],
        ];
    }
    json_response($resp, $main['duplicate'] ? 200 : 201);
}

// Chèn 1 dòng accounting_entries. Trả ['id','duplicate','hash']. Tự xử lý dedup (1062).
function insert_entry(array $f, string $created_by): array {
    $hash = dedup_hash($f['entry_type'], $f['entry_date'], $f['amount'], $f['description']);
    try {
        $stmt = db()->prepare('INSERT INTO accounting_entries
            (entry_type, entry_date, description, amount, currency, payment_method, category,
             counterparty_id, inventory_item_id, quantity, data, dedup_hash, source, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        $stmt->execute([
            $f['entry_type'], $f['entry_date'], $f['description'], $f['amount'],
            $f['currency'] ?? 'VND', $f['payment_method'] ?? null, $f['category'] ?? null,
            $f['counterparty_id'] ?? null, $f['inventory_item_id'] ?? null, $f['quantity'] ?? null,
            isset($f['data']) && $f['data'] !== null ? json_encode($f['data'], JSON_UNESCAPED_UNICODE) : null,
            $hash, $f['source'] ?? 'mcp', $created_by,
        ]);
        return ['id' => (int)db()->lastInsertId(), 'duplicate' => false, 'hash' => $hash];
    } catch (PDOException $e) {
        if (($e->errorInfo[1] ?? 0) == 1062) {
            $stmt = db()->prepare('SELECT id FROM accounting_entries WHERE dedup_hash = ?');
            $stmt->execute([$hash]);
            $existing = $stmt->fetch();
            return ['id' => (int)$existing['id'], 'duplicate' => true, 'hash' => $hash];
        }
        throw $e;
    }
}

// Resolve inventory_item_id từ inventory_item_id (ưu tiên) hoặc inventory_item_code. null nếu không có.
function resolve_inventory_id(array $data): ?int {
    if (!empty($data['inventory_item_id'])) return (int)$data['inventory_item_id'];
    if (!empty($data['inventory_item_code'])) {
        $stmt = db()->prepare('SELECT id FROM inventory_items WHERE code = ?');
        $stmt->execute([$data['inventory_item_code']]);
        $row = $stmt->fetch();
        if (!$row) json_error('Inventory item code not found: ' . $data['inventory_item_code'], 422);
        return (int)$row['id'];
    }
    return null;
}

function handle_list(): void {
    $where = []; $params = [];
    if (!empty($_GET['type'])) {
        $where[] = 'entry_type = ?';
        $params[] = $_GET['type'];
    }
    if (!empty($_GET['from'])) {
        $where[] = 'entry_date >= ?';
        $params[] = validate_date($_GET['from']);
    }
    if (!empty($_GET['to'])) {
        $where[] = 'entry_date <= ?';
        $params[] = validate_date($_GET['to']);
    }
    if (!empty($_GET['category'])) {
        $where[] = 'category = ?';
        $params[] = $_GET['category'];
    }
    if (!empty($_GET['counterparty_id'])) {
        $where[] = 'counterparty_id = ?';
        $params[] = (int)$_GET['counterparty_id'];
    }
    if (!empty($_GET['q'])) {
        $where[] = 'description LIKE ?';
        $params[] = '%' . $_GET['q'] . '%';
    }
    $where_sql = $where ? 'WHERE ' . implode(' AND ', $where) : '';

    $limit = min(500, max(1, (int)($_GET['limit'] ?? 50)));
    $offset = max(0, (int)($_GET['offset'] ?? 0));

    // Tổng count
    $cnt = db()->prepare("SELECT COUNT(*) FROM accounting_entries $where_sql");
    $cnt->execute($params);
    $total = (int)$cnt->fetchColumn();

    // Sum amount cho filter hiện tại — LOẠI inventory_in/out (đó là định giá tồn kho,
    // không phải dòng tiền) để 'tổng' không bị thổi phồng/trùng với income/expense.
    $sum = db()->prepare("SELECT COALESCE(SUM(CASE WHEN entry_type IN ('inventory_in','inventory_out') THEN 0 ELSE amount END),0)
        FROM accounting_entries $where_sql");
    $sum->execute($params);
    $total_amount = (float)$sum->fetchColumn();

    $sql = "SELECT e.*, c.name AS counterparty_name, i.code AS inventory_code, i.name AS inventory_name
            FROM accounting_entries e
            LEFT JOIN counterparties c ON e.counterparty_id = c.id
            LEFT JOIN inventory_items i ON e.inventory_item_id = i.id
            $where_sql
            ORDER BY e.entry_date DESC, e.id DESC
            LIMIT $limit OFFSET $offset";
    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();
    foreach ($rows as &$r) {
        if ($r['data']) $r['data'] = json_decode($r['data'], true);
        $r['amount'] = (float)$r['amount'];
        $r['quantity'] = $r['quantity'] !== null ? (float)$r['quantity'] : null;
    }

    json_response([
        'ok' => true,
        'total' => $total,
        'total_amount' => $total_amount,
        'limit' => $limit,
        'offset' => $offset,
        'entries' => $rows,
    ]);
}

function handle_get_one(int $id): void {
    $stmt = db()->prepare('SELECT e.*, c.name AS counterparty_name, i.code AS inventory_code
        FROM accounting_entries e
        LEFT JOIN counterparties c ON e.counterparty_id = c.id
        LEFT JOIN inventory_items i ON e.inventory_item_id = i.id
        WHERE e.id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) json_error('Entry not found', 404);
    if ($row['data']) $row['data'] = json_decode($row['data'], true);
    $row['amount'] = (float)$row['amount'];
    json_response(['ok' => true, 'entry' => $row]);
}

function handle_update(array $token, int $id): void {
    $data = read_json_body();
    // Lấy bản ghi hiện tại 1 lần (để gộp data, tính lại hash, đối soát công nợ)
    $cur = db()->prepare('SELECT * FROM accounting_entries WHERE id = ?');
    $cur->execute([$id]);
    $row = $cur->fetch();
    if (!$row) json_error('Entry not found', 404);

    $allowed = ['description','amount','category','entry_date','payment_method'];
    $sets = []; $params = [];
    foreach ($allowed as $f) {
        if (array_key_exists($f, $data)) {
            if ($f === 'entry_date')          $data[$f] = validate_date($data[$f]);
            elseif ($f === 'amount')          $data[$f] = validate_amount($data[$f]);
            elseif ($f === 'payment_method')  $data[$f] = validate_payment_method($data[$f]);
            elseif ($f === 'description')     $data[$f] = trim($data[$f]);     // đồng nhất với handle_create
            $sets[] = "$f = ?";
            $params[] = $data[$f];
        }
    }
    // data JSON: GỘP ở tầng PHP (giữ key cũ như notes/due_date) — KHÔNG dùng JSON_MERGE_PATCH
    // để không phụ thuộc phiên bản MariaDB.
    if (array_key_exists('data', $data) && is_array($data['data'])) {
        $old = $row['data'] ? (json_decode($row['data'], true) ?: []) : [];
        $sets[] = "data = ?";
        $params[] = json_encode(array_merge($old, $data['data']), JSON_UNESCAPED_UNICODE);
    }
    if (!$sets) json_error('No updatable fields provided', 422);

    // Tính lại dedup_hash nếu date/amount/description đổi. Chuẩn hoá amount qua validate_amount
    // để KHỚP định dạng lúc tạo (float "1000" chứ không phải chuỗi DECIMAL "1000.00").
    if (array_key_exists('entry_date', $data) || array_key_exists('amount', $data) || array_key_exists('description', $data)) {
        $nd    = array_key_exists('entry_date', $data)  ? $data['entry_date']  : $row['entry_date'];
        $na    = array_key_exists('amount', $data)      ? $data['amount']      : validate_amount($row['amount']);
        $ndesc = array_key_exists('description', $data) ? $data['description'] : $row['description'];
        $sets[] = "dedup_hash = ?";
        $params[] = dedup_hash($row['entry_type'], $nd, $na, $ndesc);
    }

    db()->beginTransaction();
    try {
        // Đối soát công nợ khi sửa amount của receivable/payable (trigger chỉ chạy AFTER INSERT)
        if (array_key_exists('amount', $data) && $row['counterparty_id']
                && in_array($row['entry_type'], ['receivable','payable'], true)) {
            $delta = (float)$data['amount'] - (float)$row['amount'];
            $sign = $row['entry_type'] === 'receivable' ? 1 : -1;   // giống trigger: receivable +, payable -
            $upd = db()->prepare('UPDATE counterparties SET current_balance = current_balance + ? WHERE id = ?');
            $upd->execute([$sign * $delta, (int)$row['counterparty_id']]);
        }
        $params[] = $id;
        $stmt = db()->prepare('UPDATE accounting_entries SET ' . implode(', ', $sets) . ' WHERE id = ?');
        $stmt->execute($params);
        db()->commit();
    } catch (PDOException $e) {
        if (db()->inTransaction()) db()->rollBack();
        if (($e->errorInfo[1] ?? 0) == 1062) json_error('Update would duplicate an existing entry (same date+amount+description)', 409);
        throw $e;
    } catch (Throwable $e) {
        if (db()->inTransaction()) db()->rollBack();
        throw $e;
    }
    audit_log($token['id'], 200, $id);
    json_response(['ok' => true, 'updated' => $stmt->rowCount()]);
}

function handle_delete(array $token, int $id): void {
    $sel = db()->prepare('SELECT * FROM accounting_entries WHERE id = ?');
    $sel->execute([$id]);
    $row = $sel->fetch();
    if (!$row) { audit_log($token['id'], 200, $id); json_response(['ok' => true, 'deleted' => 0]); }

    db()->beginTransaction();
    try {
        // Gom cả entry con auto-link (vd inventory_in/out sinh ra từ income/expense này)
        $targets = [$row];
        if (in_array($row['entry_type'], ['income','expense'], true)) {
            $ch = db()->prepare("SELECT * FROM accounting_entries
                WHERE CAST(JSON_EXTRACT(data, '$.auto_from_entry_id') AS UNSIGNED) = ?");
            $ch->execute([(int)$id]);
            foreach ($ch->fetchAll() as $c) $targets[] = $c;
        }
        $deleted = 0;
        foreach ($targets as $r) {
            reverse_entry_effects($r);                    // hoàn tác tồn kho / công nợ trước khi xoá
            $d = db()->prepare('DELETE FROM accounting_entries WHERE id = ?');
            $d->execute([(int)$r['id']]);
            $deleted += $d->rowCount();
        }
        db()->commit();
    } catch (Throwable $e) {
        if (db()->inTransaction()) db()->rollBack();
        throw $e;
    }
    audit_log($token['id'], 200, $id);
    json_response(['ok' => true, 'deleted' => $deleted]);
}

// Hoàn tác ảnh hưởng của 1 entry lên tồn kho / công nợ (đảo ngược trigger AFTER INSERT)
function reverse_entry_effects(array $r): void {
    $type = $r['entry_type'];
    if ($type === 'inventory_in' && $r['inventory_item_id'] && $r['quantity'] !== null) {
        $s = db()->prepare('UPDATE inventory_items SET current_qty = current_qty - ? WHERE id = ?');
        $s->execute([(float)$r['quantity'], (int)$r['inventory_item_id']]);
    } elseif ($type === 'inventory_out' && $r['inventory_item_id'] && $r['quantity'] !== null) {
        $s = db()->prepare('UPDATE inventory_items SET current_qty = current_qty + ? WHERE id = ?');
        $s->execute([(float)$r['quantity'], (int)$r['inventory_item_id']]);
    } elseif ($type === 'receivable' && $r['counterparty_id']) {
        $s = db()->prepare('UPDATE counterparties SET current_balance = current_balance - ? WHERE id = ?');
        $s->execute([(float)$r['amount'], (int)$r['counterparty_id']]);
    } elseif ($type === 'payable' && $r['counterparty_id']) {
        $s = db()->prepare('UPDATE counterparties SET current_balance = current_balance + ? WHERE id = ?');
        $s->execute([(float)$r['amount'], (int)$r['counterparty_id']]);
    }
}

function find_or_create_counterparty(string $name, string $type = 'supplier'): int {
    $stmt = db()->prepare('SELECT id FROM counterparties WHERE name = ? OR short_name = ? LIMIT 1');
    $stmt->execute([$name, $name]);
    $row = $stmt->fetch();
    if ($row) return (int)$row['id'];

    $stmt = db()->prepare('INSERT INTO counterparties (type, name, short_name) VALUES (?, ?, ?)');
    $stmt->execute([$type, $name, mb_substr($name, 0, 100)]);
    return (int)db()->lastInsertId();
}
