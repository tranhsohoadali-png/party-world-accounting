<?php
/* ============================================================
   lib.php — Kết nối CSDL + hàm tiện ích dùng chung cho API
   ============================================================ */

ini_set('display_errors', '0');
error_reporting(E_ALL);
header('Content-Type: application/json; charset=utf-8');

// Phiên đăng nhập
if (session_status() === PHP_SESSION_NONE) {
  session_set_cookie_params(['httponly' => true, 'samesite' => 'Lax']);
  session_start();
}

// Trả JSON rồi dừng
function json_out($data, int $code = 200) {
  http_response_code($code);
  echo json_encode($data, JSON_UNESCAPED_UNICODE);
  exit;
}

// Đọc body JSON từ request
function body(): array {
  $raw = file_get_contents('php://input');
  $d = json_decode($raw, true);
  return is_array($d) ? $d : [];
}

// Kết nối PDO (singleton)
function pdo(): PDO {
  static $pdo = null;
  if ($pdo) return $pdo;
  $cfgFile = __DIR__ . '/config.php';
  if (!file_exists($cfgFile)) json_out(['error' => 'Chưa cấu hình. Hãy copy config.sample.php thành config.php'], 500);
  $cfg = require $cfgFile;
  $dsn = "mysql:host={$cfg['db_host']};dbname={$cfg['db_name']};charset={$cfg['db_charset']}";
  try {
    $pdo = new PDO($dsn, $cfg['db_user'], $cfg['db_pass'], [
      PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
      PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
      PDO::ATTR_EMULATE_PREPARES => false,
    ]);
  } catch (Throwable $e) {
    json_out(['error' => 'Không kết nối được CSDL'], 500);
  }
  return $pdo;
}

// Người dùng hiện tại (từ session) hoặc null
function current_user(): ?array {
  if (empty($_SESSION['uid'])) return null;
  $st = pdo()->prepare('SELECT id, username, fullname, role, active FROM users WHERE id = ?');
  $st->execute([$_SESSION['uid']]);
  $u = $st->fetch();
  if (!$u || (int)$u['active'] !== 1) return null;
  return $u;
}

// Bắt buộc đăng nhập
function require_login(): array {
  $u = current_user();
  if (!$u) json_out(['error' => 'Chưa đăng nhập'], 401);
  return $u;
}

// Bắt buộc đúng vai trò
function require_role(array $roles): array {
  $u = require_login();
  if (!in_array($u['role'], $roles, true)) json_out(['error' => 'Không đủ quyền'], 403);
  return $u;
}
