<?php
/* ============================================================
   lib.php — Kết nối CSDL + hàm tiện ích dùng chung cho API
   ============================================================ */

ini_set('display_errors', '0');
error_reporting(E_ALL);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, private');   // API JSON không bao giờ được cache

// Phiên đăng nhập
if (session_status() === PHP_SESSION_NONE) {
  // Bật cờ Secure khi chạy HTTPS (production) — tự tắt khi chạy HTTP nội bộ.
  $pw_secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
            || (($_SERVER['SERVER_PORT'] ?? '') == '443');
  session_set_cookie_params(['httponly' => true, 'samesite' => 'Lax', 'secure' => $pw_secure]);
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

/* ---------- Phân quyền GHI theo "section" (top-level key của PW.data) ----------
   Mô hình document-store: mỗi lần lưu là ghi đè cả cục JSON. Để chặn nhân viên
   giả mạo request sửa phần ngoài quyền, ta so sánh JSON cũ vs mới và chỉ cho qua
   nếu các section thay đổi đều nằm trong whitelist của vai trò.
   Trả về null = toàn quyền ghi (admin/ketoan). */
function pw_allowed_sections(string $role): ?array {
  if ($role === 'admin' || $role === 'ketoan') return null;
  if ($role === 'nhanvien') {
    return [
      'meta',            // BẮT BUỘC: nextCode() tăng meta.counters mỗi lần tạo chứng từ
      'activityLog',     // BẮT BUỘC: A4 ghi nhật ký vào mỗi thao tác của nhân viên
      'salesInvoices',   // Lập/sửa HĐ bán; trạm quét đóng gói; gom đơn ký gửi; convert báo giá/đơn
      'quotations',      // Báo giá
      'salesOrders',     // Đơn đặt hàng
      'salesReturns',    // Trả lại hàng bán + trạm quét nhận trả
      'salesDiscounts',  // Giảm giá hàng bán
      'products',        // Thêm/sửa hàng hóa (màn Hàng hóa + quick-add trong form)
      'customers',       // Thêm/sửa khách hàng
      'productAliases',  // Học bí danh khi gom đơn ký gửi
      'employees',       // quick-add nhân viên từ form HĐ bán
      'paymentTerms',    // quick-add điều khoản thanh toán từ form HĐ bán
    ];
  }
  return []; // vai trò lạ -> không được ghi gì
}
// Trả về danh sách top-level key bị thêm/xóa/đổi nội dung giữa $old và $new.
function pw_changed_top_keys($old, $new): array {
  if (!is_array($new)) $new = [];
  if (!is_array($old)) $old = [];   // old=null (lần lưu đầu) -> mọi key trong new coi là 'thay đổi'
  $changed = [];
  $keys = array_unique(array_merge(array_keys($old), array_keys($new)));
  foreach ($keys as $k) {
    $oHas = array_key_exists($k, $old);
    $nHas = array_key_exists($k, $new);
    if ($oHas !== $nHas) { $changed[] = $k; continue; }
    if (json_encode($old[$k], JSON_UNESCAPED_UNICODE) !== json_encode($new[$k], JSON_UNESCAPED_UNICODE)) {
      $changed[] = $k;
    }
  }
  return $changed;
}

/* ---------- Chống CSRF (giả mạo yêu cầu từ trang khác) ----------
   Chỉ áp dụng cho request THAY ĐỔI dữ liệu (POST/PUT/PATCH/DELETE).
   Request đọc (GET/HEAD) và lệnh chạy nền (CLI/cron, không có REQUEST_METHOD)
   được bỏ qua. Dựa vào header trình duyệt tự gửi nên KHÔNG cần token ở frontend:
   - Sec-Fetch-Site: fetch() cùng nguồn luôn là 'same-origin'/'same-site'.
   - Trình duyệt cũ không có header này -> đối chiếu Origin với Host. */
function require_csrf(): void {
  $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
  if (in_array($method, ['GET', 'HEAD', 'OPTIONS'], true)) return;

  $sfs = $_SERVER['HTTP_SEC_FETCH_SITE'] ?? '';
  if ($sfs !== '') {
    if (in_array($sfs, ['same-origin', 'same-site'], true)) return;
    json_out(['error' => 'Yêu cầu bị từ chối (nguồn khác — CSRF)'], 403);
  }
  // Không có Sec-Fetch-Site -> đối chiếu Origin với Host
  $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
  if ($origin === '') return; // không xác định được nguồn (vd POST từ công cụ nội bộ) -> cho qua
  $oHost = parse_url($origin, PHP_URL_HOST);
  $host  = $_SERVER['HTTP_HOST'] ?? '';
  if ($oHost !== null && $oHost !== '' && strcasecmp($oHost, $host) === 0) return;
  json_out(['error' => 'Yêu cầu bị từ chối (Origin không khớp — CSRF)'], 403);
}

// Tự động bảo vệ MỌI endpoint dùng lib.php: chạy ngay khi nạp thư viện.
require_csrf();

/* ---------- Cấu hình AI hợp nhất ----------
   Khóa Anthropic có thể nằm ở config.php (sửa tay) HOẶC api/ai-key.local.php
   (do màn hình "Cấu hình AI" trong phần mềm ghi ra — không cần SSH).
   File ai-key.local.php được ưu tiên (giá trị rỗng thì bỏ qua). */
function ai_cfg(): array {
  $cfg = [];
  if (file_exists(__DIR__ . '/config.php')) {
    $c = require __DIR__ . '/config.php';
    if (is_array($c)) $cfg = $c;
  }
  $f = __DIR__ . '/ai-key.local.php';
  if (file_exists($f)) {
    $o = require $f;
    if (is_array($o)) {
      foreach ($o as $k => $v) {
        if ($v !== '' && $v !== null) $cfg[$k] = $v;
      }
    }
  }
  return $cfg;
}

/* Giới hạn tần suất theo phiên đăng nhập (chống bấm dồn dập làm tốn phí AI).
   $bucket: tên nhóm, $max: số lần tối đa trong $windowSec giây. */
function ai_rate_limit(string $bucket, int $max, int $windowSec = 60): void {
  $k = 'rl_' . $bucket;
  $now = time();
  $arr = $_SESSION[$k] ?? [];
  $arr = array_values(array_filter($arr, function ($t) use ($now, $windowSec) { return $t > $now - $windowSec; }));
  if (count($arr) >= $max) {
    json_out(['error' => 'Gọi AI quá nhanh — đợi khoảng 1 phút rồi thử lại'], 429);
  }
  $arr[] = $now;
  $_SESSION[$k] = $arr;
}

/* ---------- Gọi API của mau.tranhdali.vn (chung server) ----------
   nginx bên mau chặn các endpoint API-key theo IP (chỉ cho nội bộ).
   Gọi qua domain công khai sẽ bị 403 -> tự thử lại bằng kết nối thẳng
   127.0.0.1 nhưng GIỮ nguyên https + hostname (CURLOPT_RESOLVE) để
   chứng chỉ SSL vẫn khớp và đi đúng server block của mau.
   Trả về [raw_body, http_code]. */
function mau_http_get(string $url, array $headers = []): array {
  $headers[] = 'Accept: application/json';
  $attempt = function (bool $loopback) use ($url, $headers) {
    if (function_exists('curl_init')) {
      $ch = curl_init($url);
      $opts = [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 25,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_HTTPHEADER => $headers,
      ];
      if ($loopback) {
        $host = parse_url($url, PHP_URL_HOST);
        $port = (parse_url($url, PHP_URL_SCHEME) === 'http') ? 80 : 443;
        $opts[CURLOPT_RESOLVE] = [$host . ':' . $port . ':127.0.0.1'];
      }
      curl_setopt_array($ch, $opts);
      $raw = curl_exec($ch);
      $http = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
      curl_close($ch);
      return [$raw, $http];
    }
    if ($loopback) return [false, 0]; // file_get_contents không giả lập loopback được
    $ctx = stream_context_create(['http' => ['timeout' => 25, 'header' => implode("\r\n", $headers) . "\r\n"]]);
    $raw = @file_get_contents($url, false, $ctx);
    $http = 0;
    if (isset($http_response_header[0]) && preg_match('/\s(\d{3})\s/', $http_response_header[0], $m)) $http = (int)$m[1];
    elseif ($raw !== false) $http = 200;
    return [$raw, $http];
  };
  list($raw, $http) = $attempt(false);
  // Bị chặn IP (403) hoặc không nối được -> thử đường nội bộ loopback
  if (($http === 403 || $http === 0 || $raw === false) && function_exists('curl_init')) {
    list($raw2, $http2) = $attempt(true);
    if ($http2 >= 200 && $http2 < 300) return [$raw2, $http2];
  }
  return [$raw, $http];
}
