<?php
/* ============================================================
   timekeeping.php — Proxy lấy dữ liệu chấm công từ mau.tranhdali.vn
   Server tự gọi sang API chấm công (khoá nằm kín ở config.php),
   trả dữ liệu thô về cho giao diện. Tránh lộ khoá & lỗi CORS.
   ============================================================ */
require __DIR__ . '/lib.php';
require_login();

$cfg = require __DIR__ . '/config.php';

/* ---------- action=days: CHI TIẾT TỪNG NGÀY, đọc THẲNG từ CSDL của mau ----------
   mau nằm cùng MySQL instance nên không cần đi vòng qua HTTP + khoá API
   (xem cách productivity.php đọc VIEW năng suất). mau chỉ cần tạo 1 VIEW và
   GRANT SELECT cho user DB của ketoan — không phải sửa API.
   Hợp đồng cột: work_date, employee_code, check_in, check_out, work_day,
                 late_count, ot_hours, fine                                     */
if (($_GET['action'] ?? '') === 'days') {
  $src = $cfg['timekeeping_days_source'] ?? '';
  if (!$src) json_out(['ok' => true, 'configured' => false, 'rows' => [],
    'note' => 'Chưa khai timekeeping_days_source trong api/config.php']);
  if (!preg_match('/^[A-Za-z0-9_]+(\.[A-Za-z0-9_]+)?$/', $src)) {
    json_out(['ok' => false, 'error' => 'timekeeping_days_source không hợp lệ'], 500);
  }
  $srcSql = implode('.', array_map(function ($x) { return '`' . $x . '`'; }, explode('.', $src)));
  $m = preg_replace('/[^0-9\-]/', '', $_GET['month'] ?? '');
  if (!preg_match('/^\d{4}-\d{2}$/', $m)) json_out(['ok' => false, 'error' => 'Tháng không hợp lệ (YYYY-MM)'], 400);
  try {
    $st = pdo()->prepare("SELECT work_date, employee_code, check_in, check_out,
                                 work_day, late_count, ot_hours, fine
                          FROM $srcSql
                          WHERE work_date >= ? AND work_date < DATE_ADD(?, INTERVAL 1 MONTH)
                          ORDER BY employee_code, work_date LIMIT 5000");
    $st->execute([$m . '-01', $m . '-01']);
    json_out(['ok' => true, 'configured' => true, 'source' => $src, 'rows' => $st->fetchAll()]);
  } catch (Throwable $e) {
    json_out(['ok' => false, 'error' => 'Không đọc được nguồn "' . $src . '". Kiểm tra VIEW đã tạo và đã GRANT SELECT chưa.'], 500);
  }
}

$base = $cfg['timekeeping_url'] ?? '';
$key  = $cfg['timekeeping_key'] ?? '';
if (!$base || !$key || $key === 'DAN_KHOA_API_CHAM_CONG_VAO_DAY') {
  json_out(['error' => 'Chưa cấu hình khoá API chấm công trong api/config.php'], 500);
}

$month = preg_replace('/[^0-9\-]/', '', $_GET['month'] ?? '');
if (!preg_match('/^\d{4}-\d{2}$/', $month)) json_out(['error' => 'Tháng không hợp lệ (YYYY-MM)'], 400);

$url = $base . '?key=' . urlencode($key) . '&month=' . urlencode($month);

// Gọi qua mau_http_get (lib.php): tự retry đường loopback 127.0.0.1
// nếu nginx bên mau chặn IP ngoài (403). Kèm khoá ở header cho chắc.
list($raw, $http) = mau_http_get($url, ['X-API-Key: ' . $key]);

if ($raw === false || $raw === null) json_out(['error' => 'Không gọi được API chấm công'], 502);
if ($http && ($http < 200 || $http >= 300)) json_out(['error' => 'API chấm công trả lỗi HTTP ' . $http, 'body' => mb_substr($raw, 0, 500)], 502);

$data = json_decode($raw, true);
if ($data === null) {
  // Không phải JSON -> trả thô để giao diện xem & xử lý
  json_out(['ok' => true, 'raw' => $raw]);
}
json_out(['ok' => true, 'data' => $data]);
