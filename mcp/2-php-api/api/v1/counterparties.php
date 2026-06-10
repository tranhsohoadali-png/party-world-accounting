<?php
/**
 * /api/v1/counterparties.php  - nhà cung cấp + khách hàng
 */
require_once __DIR__ . '/../helpers.php';
set_cors();

$method = $_SERVER['REQUEST_METHOD'];
$path_info = trim($_SERVER['PATH_INFO'] ?? '', '/');

try {
    switch ($method) {
        case 'POST':
            $token = require_token('counterparties:write');
            handle_create($token);
            break;
        case 'GET':
            $token = require_token('counterparties:read');
            if ($path_info === '') handle_list();
            elseif (preg_match('/^(\d+)$/', $path_info, $m)) handle_get((int)$m[1]);
            elseif ($path_info === 'debts') handle_outstanding_debts();
            else json_error('Endpoint not found', 404);
            break;
        case 'PUT':
            $token = require_token('counterparties:write');
            if (!preg_match('/^(\d+)$/', $path_info, $m)) json_error('Id required', 400);
            handle_update($token, (int)$m[1]);
            break;
        default:
            json_error('Method not allowed', 405);
    }
} catch (Throwable $e) {
    json_error('Server error: ' . $e->getMessage(), 500);
}

function handle_create(array $token): void {
    $data = read_json_body();
    require_fields($data, ['name']);
    $stmt = db()->prepare('INSERT INTO counterparties
        (type, name, short_name, tax_code, phone, email, bank_account, bank_name, address, data)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    $stmt->execute([
        $data['type'] ?? 'supplier',
        $data['name'],
        $data['short_name'] ?? mb_substr($data['name'], 0, 100),
        $data['tax_code'] ?? null,
        $data['phone'] ?? null,
        $data['email'] ?? null,
        $data['bank_account'] ?? null,
        $data['bank_name'] ?? null,
        $data['address'] ?? null,
        isset($data['data']) ? json_encode($data['data'], JSON_UNESCAPED_UNICODE) : null,
    ]);
    $id = (int)db()->lastInsertId();
    audit_log($token['id'], 201, $id);
    json_response(['ok' => true, 'id' => $id], 201);
}

function handle_list(): void {
    $where = []; $params = [];
    if (!empty($_GET['type'])) { $where[] = 'type = ?'; $params[] = $_GET['type']; }
    if (!empty($_GET['q'])) {
        $where[] = '(name LIKE ? OR short_name LIKE ?)';
        $params[] = '%'.$_GET['q'].'%';
        $params[] = '%'.$_GET['q'].'%';
    }
    $where[] = 'is_active = TRUE';
    $where_sql = 'WHERE ' . implode(' AND ', $where);
    $limit = min(500, (int)($_GET['limit'] ?? 100));
    $stmt = db()->prepare("SELECT * FROM counterparties $where_sql ORDER BY name ASC LIMIT $limit");
    $stmt->execute($params);
    $rows = $stmt->fetchAll();
    foreach ($rows as &$r) {
        if ($r['data']) $r['data'] = json_decode($r['data'], true);
        $r['current_balance'] = (float)$r['current_balance'];
    }
    json_response(['ok' => true, 'counterparties' => $rows]);
}

function handle_get(int $id): void {
    $stmt = db()->prepare('SELECT * FROM counterparties WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) json_error('Counterparty not found', 404);
    if ($row['data']) $row['data'] = json_decode($row['data'], true);

    // Lịch sử giao dịch
    $stmt = db()->prepare("SELECT id, entry_type, entry_date, amount, description
        FROM accounting_entries WHERE counterparty_id = ? ORDER BY entry_date DESC LIMIT 50");
    $stmt->execute([$id]);
    $row['recent_transactions'] = $stmt->fetchAll();
    json_response(['ok' => true, 'counterparty' => $row]);
}

function handle_outstanding_debts(): void {
    $stmt = db()->query("SELECT id, type, name, current_balance
        FROM counterparties
        WHERE is_active = TRUE AND current_balance != 0
        ORDER BY ABS(current_balance) DESC");
    $rows = $stmt->fetchAll();
    $total_receivable = 0; $total_payable = 0;
    foreach ($rows as &$r) {
        $r['current_balance'] = (float)$r['current_balance'];
        if ($r['current_balance'] > 0) $total_receivable += $r['current_balance'];
        else                            $total_payable += abs($r['current_balance']);
    }
    json_response([
        'ok' => true,
        'total_receivable' => $total_receivable,
        'total_payable' => $total_payable,
        'net' => $total_receivable - $total_payable,
        'counterparties' => $rows,
    ]);
}

function handle_update(array $token, int $id): void {
    $data = read_json_body();
    $allowed = ['type','name','short_name','tax_code','phone','email','bank_account','bank_name','address','data','is_active'];
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
    $stmt = db()->prepare('UPDATE counterparties SET ' . implode(', ', $sets) . ' WHERE id = ?');
    $stmt->execute($params);
    audit_log($token['id'], 200, $id);
    json_response(['ok' => true, 'updated' => $stmt->rowCount()]);
}
