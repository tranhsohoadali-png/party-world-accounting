<?php
/**
 * /api/v1/inventory.php  - quản lý item tồn kho
 */
require_once __DIR__ . '/../helpers.php';
set_cors();

$method = $_SERVER['REQUEST_METHOD'];
$path_info = trim($_SERVER['PATH_INFO'] ?? '', '/');

try {
    switch ($method) {
        case 'POST':
            $token = require_token('inventory:write');
            handle_create_item($token);
            break;
        case 'GET':
            $token = require_token('inventory:read');
            if ($path_info === '') handle_list_items();
            elseif (preg_match('/^(\d+)$/', $path_info, $m)) handle_get_item((int)$m[1]);
            elseif ($path_info === 'low-stock') handle_low_stock();
            else json_error('Endpoint not found', 404);
            break;
        case 'PUT':
            $token = require_token('inventory:write');
            if (!preg_match('/^(\d+)$/', $path_info, $m)) json_error('Item id required', 400);
            handle_update_item($token, (int)$m[1]);
            break;
        default:
            json_error('Method not allowed', 405);
    }
} catch (Throwable $e) {
    json_error('Server error: ' . $e->getMessage(), 500);
}

function handle_create_item(array $token): void {
    $data = read_json_body();
    require_fields($data, ['code', 'name']);
    $stmt = db()->prepare('INSERT INTO inventory_items (code, name, unit, category, current_qty, cost_per_unit, data)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
        name = VALUES(name), unit = VALUES(unit), category = VALUES(category)');
    $stmt->execute([
        $data['code'],
        $data['name'],
        $data['unit'] ?? 'cái',
        $data['category'] ?? null,
        $data['current_qty'] ?? 0,
        $data['cost_per_unit'] ?? null,
        isset($data['data']) ? json_encode($data['data'], JSON_UNESCAPED_UNICODE) : null,
    ]);
    $id = (int)(db()->lastInsertId() ?: 0);
    if ($id === 0) {
        $stmt = db()->prepare('SELECT id FROM inventory_items WHERE code = ?');
        $stmt->execute([$data['code']]);
        $id = (int)$stmt->fetchColumn();
    }
    audit_log($token['id'], 201, $id);
    json_response(['ok' => true, 'id' => $id], 201);
}

function handle_list_items(): void {
    $where = []; $params = [];
    if (!empty($_GET['category'])) { $where[] = 'category = ?'; $params[] = $_GET['category']; }
    if (!empty($_GET['q'])) {
        $where[] = '(code LIKE ? OR name LIKE ?)';
        $params[] = '%'.$_GET['q'].'%';
        $params[] = '%'.$_GET['q'].'%';
    }
    if (!isset($_GET['include_inactive'])) {
        $where[] = 'is_active = TRUE';
    }
    $where_sql = $where ? 'WHERE ' . implode(' AND ', $where) : '';
    $limit = min(500, max(1, (int)($_GET['limit'] ?? 100)));
    $stmt = db()->prepare("SELECT * FROM inventory_items $where_sql ORDER BY code ASC LIMIT $limit");
    $stmt->execute($params);
    $rows = $stmt->fetchAll();
    foreach ($rows as &$r) {
        if ($r['data']) $r['data'] = json_decode($r['data'], true);
        $r['current_qty'] = (float)$r['current_qty'];
        $r['cost_per_unit'] = $r['cost_per_unit'] !== null ? (float)$r['cost_per_unit'] : null;
    }
    json_response(['ok' => true, 'items' => $rows]);
}

function handle_get_item(int $id): void {
    $stmt = db()->prepare('SELECT * FROM inventory_items WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) json_error('Item not found', 404);
    if ($row['data']) $row['data'] = json_decode($row['data'], true);

    // Lấy 20 transaction gần nhất
    $stmt = db()->prepare("SELECT id, entry_type, entry_date, quantity, amount, description
        FROM accounting_entries
        WHERE inventory_item_id = ?
        ORDER BY entry_date DESC LIMIT 20");
    $stmt->execute([$id]);
    $row['recent_movements'] = $stmt->fetchAll();
    json_response(['ok' => true, 'item' => $row]);
}

function handle_low_stock(): void {
    // Tồn kho < ngưỡng cảnh báo (đọc từ data.low_stock_threshold)
    $stmt = db()->query("SELECT * FROM inventory_items
        WHERE is_active = TRUE
        AND JSON_EXTRACT(data, '$.low_stock_threshold') IS NOT NULL
        AND current_qty <= JSON_EXTRACT(data, '$.low_stock_threshold')
        ORDER BY current_qty ASC");
    $rows = $stmt->fetchAll();
    foreach ($rows as &$r) {
        if ($r['data']) $r['data'] = json_decode($r['data'], true);
    }
    json_response(['ok' => true, 'low_stock_items' => $rows, 'count' => count($rows)]);
}

function handle_update_item(array $token, int $id): void {
    $data = read_json_body();
    $allowed = ['name','unit','category','cost_per_unit','data','is_active'];
    $sets = []; $params = [];
    foreach ($allowed as $f) {
        if (array_key_exists($f, $data)) {
            if ($f === 'data') $data[$f] = json_encode($data[$f], JSON_UNESCAPED_UNICODE);
            $sets[] = "$f = ?";
            $params[] = $data[$f];
        }
    }
    if (!$sets) json_error('No updatable fields', 422);
    $params[] = $id;
    $stmt = db()->prepare('UPDATE inventory_items SET ' . implode(', ', $sets) . ' WHERE id = ?');
    $stmt->execute($params);
    audit_log($token['id'], 200, $id);
    json_response(['ok' => true, 'updated' => $stmt->rowCount()]);
}
