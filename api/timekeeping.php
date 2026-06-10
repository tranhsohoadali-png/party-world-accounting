<?php
/* ============================================================
   timekeeping.php — Proxy lấy dữ liệu chấm công từ mau.tranhdali.vn
   Server tự gọi sang API chấm công (khoá nằm kín ở config.php),
   trả dữ liệu thô về cho giao diện. Tránh lộ khoá & lỗi CORS.
   ============================================================ */
require __DIR__ . '/lib.php';
require_login();

$cfg = require __DIR__ . '/config.php';
$base = $cfg['timekeeping_url'] ?? '';
$key  = $cfg['timekeeping_key'] ?? '';
if (!$base || !$key || $key === 'DAN_KHOA_API_CHAM_CONG_VAO_DAY') {
  json_out(['error' => 'Chưa cấu hình khoá API chấm công trong api/config.php'], 500);
}

$month = preg_replace('/[^0-9\-]/', '', $_GET['month'] ?? '');
if (!preg_match('/^\d{4}-\d{2}$/', $month)) json_out(['error' => 'Tháng không hợp lệ (YYYY-MM)'], 400);

$url = $base . '?key=' . urlencode($key) . '&month=' . urlencode($month);

// Gọi API: ưu tiên cURL, fallback file_get_contents
$raw = null; $http = 0;
if (function_exists('curl_init')) {
  $ch = curl_init($url);
  curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 20,
    CURLOPT_SSL_VERIFYPEER => true,
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_HTTPHEADER => ['Accept: application/json'],
  ]);
  $raw = curl_exec($ch);
  $http = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
  curl_close($ch);
} else {
  $ctx = stream_context_create(['http' => ['timeout' => 20, 'header' => "Accept: application/json\r\n"]]);
  $raw = @file_get_contents($url, false, $ctx);
  if (isset($http_response_header[0]) && preg_match('/\s(\d{3})\s/', $http_response_header[0], $m)) $http = (int)$m[1];
  else $http = $raw === false ? 0 : 200;
}

if ($raw === false || $raw === null) json_out(['error' => 'Không gọi được API chấm công'], 502);
if ($http && ($http < 200 || $http >= 300)) json_out(['error' => 'API chấm công trả lỗi HTTP ' . $http, 'body' => mb_substr($raw, 0, 500)], 502);

$data = json_decode($raw, true);
if ($data === null) {
  // Không phải JSON -> trả thô để giao diện xem & xử lý
  json_out(['ok' => true, 'raw' => $raw]);
}
json_out(['ok' => true, 'data' => $data]);
