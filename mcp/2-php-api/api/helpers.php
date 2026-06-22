<?php
/**
 * Party World Accounting - API Config & Helpers
 * Drop vào /var/www/ketoan/api/ trên VPS
 */

// ============ DB CONNECTION ============
// Ưu tiên dùng chung config.php của app DALI (cùng CSDL), fallback sang ENV.
function db(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $host = getenv('PW_DB_HOST') ?: 'localhost';
        $name = getenv('PW_DB_NAME') ?: 'partyworld';
        $user = getenv('PW_DB_USER') ?: 'pwuser';
        $pass = getenv('PW_DB_PASS') ?: '';
        $cfgFile = __DIR__ . '/config.php'; // /var/www/ketoan/api/config.php (của app DALI)
        if (file_exists($cfgFile)) {
            $cfg = require $cfgFile;
            $host = $cfg['db_host'] ?? $host;
            $name = $cfg['db_name'] ?? $name;
            $user = $cfg['db_user'] ?? $user;
            $pass = $cfg['db_pass'] ?? $pass;
        }
        $dsn = sprintf('mysql:host=%s;dbname=%s;charset=utf8mb4', $host, $name);
        $pdo = new PDO($dsn, $user, $pass, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
    }
    return $pdo;
}

// ============ JSON HELPERS ============
function json_response($data, int $code = 200): void {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

function json_error(string $message, int $code = 400, $extra = null): void {
    $response = ['ok' => false, 'error' => $message];
    if ($extra !== null) $response['detail'] = $extra;
    json_response($response, $code);
}

function read_json_body(): array {
    $raw = file_get_contents('php://input');
    if (!$raw) return [];
    $data = json_decode($raw, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        json_error('Invalid JSON body: ' . json_last_error_msg(), 400);
    }
    return $data ?: [];
}

// ============ AUTHENTICATION ============
function require_token(string $required_scope): array {
    $auth = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (!preg_match('/^Bearer\s+([a-f0-9]{32,64})$/i', $auth, $m)) {
        json_error('Missing or invalid Authorization header', 401);
    }
    $token = $m[1];

    $stmt = db()->prepare('SELECT id, name, scopes, is_active, expires_at
                            FROM api_tokens WHERE token = ?');
    $stmt->execute([$token]);
    $row = $stmt->fetch();
    if (!$row || !$row['is_active']) {
        json_error('Token invalid or revoked', 403);
    }
    if ($row['expires_at'] && strtotime($row['expires_at']) < time()) {
        json_error('Token expired', 403);
    }
    $scopes = array_map('trim', explode(',', $row['scopes']));
    if (!in_array($required_scope, $scopes, true)) {
        json_error("Token lacks scope: $required_scope", 403);
    }

    // Update last_used
    $stmt = db()->prepare('UPDATE api_tokens
                            SET last_used_at = NOW(), last_used_ip = ?
                            WHERE id = ?');
    $stmt->execute([$_SERVER['REMOTE_ADDR'] ?? null, $row['id']]);

    return ['id' => (int)$row['id'], 'name' => $row['name']];
}

// ============ DEDUP HASH ============
function dedup_hash(string $entry_type, string $entry_date, $amount, string $description): string {
    $norm_desc = preg_replace('/\s+/u', ' ', mb_strtolower(trim($description)));
    $key = sprintf('%s|%s|%s|%s', $entry_type, $entry_date, (string)$amount, $norm_desc);
    return hash('sha256', $key);
}

// ============ VALIDATION ============
function require_fields(array $data, array $fields): void {
    $missing = [];
    foreach ($fields as $f) {
        if (!array_key_exists($f, $data) || $data[$f] === '' || $data[$f] === null) {
            $missing[] = $f;
        }
    }
    if ($missing) json_error('Missing required fields: ' . implode(', ', $missing), 422);
}

function validate_date(string $date): string {
    // Chấp nhận YYYY-MM-DD hoặc DD/MM/YYYY
    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) return $date;
    if (preg_match('/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/', $date, $m)) {
        return sprintf('%04d-%02d-%02d', (int)$m[3], (int)$m[2], (int)$m[1]);
    }
    json_error("Invalid date format: $date (use YYYY-MM-DD or DD/MM/YYYY)", 422);
}

function validate_amount($amount): float {
    if (!is_numeric($amount)) json_error("Amount must be numeric, got: $amount", 422);
    return round((float)$amount, 2);
}

// Hình thức thanh toán: chuẩn hoá tiếng Việt/viết tắt -> enum cash|bank|ewallet|other. '' / null -> null.
function validate_payment_method($pm): ?string {
    if ($pm === null || $pm === '') return null;
    $pm = mb_strtolower(trim((string)$pm));
    $map = [
        'cash' => 'cash', 'tiền mặt' => 'cash', 'tien mat' => 'cash', 'tm' => 'cash', 'mặt' => 'cash',
        'bank' => 'bank', 'chuyển khoản' => 'bank', 'chuyen khoan' => 'bank', 'ck' => 'bank',
        'ngân hàng' => 'bank', 'ngan hang' => 'bank', 'tiền gửi' => 'bank', 'transfer' => 'bank',
        'ewallet' => 'ewallet', 'ví' => 'ewallet', 'vi' => 'ewallet', 'momo' => 'ewallet', 'zalopay' => 'ewallet',
        'other' => 'other', 'khác' => 'other', 'khac' => 'other',
    ];
    if (isset($map[$pm])) $pm = $map[$pm];
    if (!in_array($pm, ['cash', 'bank', 'ewallet', 'other'], true)) {
        json_error("Invalid payment_method: $pm (dùng cash|bank|ewallet|other)", 422);
    }
    return $pm;
}

// ============ APP SETTINGS (key-value) ============
function get_setting(string $key): ?string {
    // Trả null êm nếu bảng app_settings chưa tồn tại (chưa chạy migration) -> không vỡ báo cáo
    try {
        $stmt = db()->prepare('SELECT svalue FROM app_settings WHERE skey = ?');
        $stmt->execute([$key]);
        $v = $stmt->fetchColumn();
        return $v === false ? null : $v;
    } catch (PDOException $e) {
        return null;
    }
}

function set_setting(string $key, string $value): void {
    $stmt = db()->prepare('INSERT INTO app_settings (skey, svalue) VALUES (?, ?)
        ON DUPLICATE KEY UPDATE svalue = VALUES(svalue)');
    $stmt->execute([$key, $value]);
}

// ============ AUDIT LOG ============
function audit_log(?int $token_id, int $response_code, ?int $affected_id = null, ?string $error = null): void {
    try {
        $stmt = db()->prepare('INSERT INTO api_audit_log
            (token_id, endpoint, method, ip, request_body, response_code, affected_id, error)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        $stmt->execute([
            $token_id,
            $_SERVER['REQUEST_URI'] ?? '',
            $_SERVER['REQUEST_METHOD'] ?? '',
            $_SERVER['REMOTE_ADDR'] ?? null,
            file_get_contents('php://input') ?: null,
            $response_code,
            $affected_id,
            $error,
        ]);
    } catch (Throwable $e) {
        // Audit lỗi không nên crash request chính
        error_log('Audit log failed: ' . $e->getMessage());
    }
}

// ============ CORS (cho phép MCP server gọi vào) ============
function set_cors(): void {
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Authorization, Content-Type');
    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}
