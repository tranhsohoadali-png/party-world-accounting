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

    $hash = dedup_hash($data['entry_type'], $entry_date, $amount, $description);

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
        if (empty($data['inventory_item_code']) && empty($data['inventory_item_id'])) {
            json_error('inventory_item_code or inventory_item_id required for inventory entries', 422);
        }
        if (!empty($data['inventory_item_id'])) {
            $inventory_item_id = (int)$data['inventory_item_id'];
        } else {
            $stmt = db()->prepare('SELECT id FROM inventory_items WHERE code = ?');
            $stmt->execute([$data['inventory_item_code']]);
            $row = $stmt->fetch();
            if (!$row) json_error('Inventory item code not found: ' . $data['inventory_item_code'], 422);
            $inventory_item_id = (int)$row['id'];
        }
        if (!isset($data['quantity'])) json_error('quantity required for inventory entries', 422);
        $quantity = (float)$data['quantity'];
    }

    try {
        $stmt = db()->prepare('INSERT INTO accounting_entries
            (entry_type, entry_date, description, amount, currency, category,
             counterparty_id, inventory_item_id, quantity, data, dedup_hash, source, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        $stmt->execute([
            $data['entry_type'],
            $entry_date,
            $description,
            $amount,
            $data['currency'] ?? 'VND',
            $data['category'] ?? null,
            $counterparty_id,
            $inventory_item_id,
            $quantity,
            isset($data['data']) ? json_encode($data['data'], JSON_UNESCAPED_UNICODE) : null,
            $hash,
            $data['source'] ?? 'mcp',
            $token['name'],
        ]);
        $id = (int)db()->lastInsertId();
        audit_log($token['id'], 201, $id);
        json_response([
            'ok' => true,
            'id' => $id,
            'dedup_hash' => $hash,
            'message' => 'Entry created',
        ], 201);
    } catch (PDOException $e) {
        if ($e->errorInfo[1] == 1062) {
            // Duplicate hash → trả về entry đã tồn tại
            $stmt = db()->prepare('SELECT id FROM accounting_entries WHERE dedup_hash = ?');
            $stmt->execute([$hash]);
            $existing = $stmt->fetch();
            audit_log($token['id'], 200, (int)$existing['id'], 'Duplicate, returned existing');
            json_response([
                'ok' => true,
                'id' => (int)$existing['id'],
                'duplicate' => true,
                'message' => 'Entry already exists with same date+amount+description',
            ], 200);
        }
        throw $e;
    }
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

    // Sum amount cho filter hiện tại
    $sum = db()->prepare("SELECT COALESCE(SUM(amount),0) FROM accounting_entries $where_sql");
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
    $allowed = ['description','amount','category','data','entry_date'];
    $sets = []; $params = [];
    foreach ($allowed as $f) {
        if (array_key_exists($f, $data)) {
            if ($f === 'entry_date') $data[$f] = validate_date($data[$f]);
            if ($f === 'amount') $data[$f] = validate_amount($data[$f]);
            if ($f === 'data') $data[$f] = json_encode($data[$f], JSON_UNESCAPED_UNICODE);
            $sets[] = "$f = ?";
            $params[] = $data[$f];
        }
    }
    if (!$sets) json_error('No updatable fields provided', 422);
    $params[] = $id;
    $stmt = db()->prepare('UPDATE accounting_entries SET ' . implode(', ', $sets) . ' WHERE id = ?');
    $stmt->execute($params);
    audit_log($token['id'], 200, $id);
    json_response(['ok' => true, 'updated' => $stmt->rowCount()]);
}

function handle_delete(array $token, int $id): void {
    $stmt = db()->prepare('DELETE FROM accounting_entries WHERE id = ?');
    $stmt->execute([$id]);
    audit_log($token['id'], 200, $id);
    json_response(['ok' => true, 'deleted' => $stmt->rowCount()]);
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
