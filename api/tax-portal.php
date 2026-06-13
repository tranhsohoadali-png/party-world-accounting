<?php
// ============================================================
// tax-portal.php — Đồng bộ hóa đơn từ Cổng hóa đơn điện tử TCT
//   hoadondientu.gdt.gov.vn  (BÁN tự động: người dùng nhập captcha)
//   actions:
//     GET  ?action=captcha       -> { key, svg }
//     POST ?action=login         -> { username(MST), password, ckey, cvalue } -> { ok }
//     GET  ?action=session       -> { connected, mst }
//     GET  ?action=logout        -> { ok }
//     POST ?action=pull          -> { kind:'purchase'|'sold'|'both', from, to } -> { ok, invoices:[...] }
//   Token đăng nhập GIỮ TRONG SESSION máy chủ, KHÔNG trả về trình duyệt.
//   Mật khẩu chỉ dùng lúc đăng nhập, KHÔNG lưu.
// ============================================================
require __DIR__ . '/lib.php';

require_role(['admin', 'ketoan']);

$cfg = ai_cfg();
// API của cổng nằm dưới /api . Đổi qua config nếu cổng dời host/cổng.
$BASE = rtrim($cfg['tax_api_base'] ?? 'https://hoadondientu.gdt.gov.vn/api', '/');
$action = $_GET['action'] ?? '';

/* Gọi HTTP tới cổng thuế. $auth=true -> kèm Bearer token trong session. */
function gdt_http(string $method, string $url, $body = null, bool $auth = false): array {
  $headers = ['Accept: application/json, text/plain, */*', 'Accept-Language: vi'];
  if ($body !== null) $headers[] = 'Content-Type: application/json';
  if ($auth) {
    if (empty($_SESSION['tax_token'])) return [null, 401];
    $headers[] = 'Authorization: Bearer ' . $_SESSION['tax_token'];
  }
  $ch = curl_init($url);
  curl_setopt_array($ch, [
    CURLOPT_CUSTOMREQUEST => $method,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_SSL_VERIFYPEER => true,
    CURLOPT_TIMEOUT => 40,
    CURLOPT_CONNECTTIMEOUT => 15,
    CURLOPT_HTTPHEADER => $headers,
    CURLOPT_ENCODING => '',   // tự giải nén gzip
    CURLOPT_USERAGENT => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  ]);
  if ($body !== null) curl_setopt($ch, CURLOPT_POSTFIELDS, is_string($body) ? $body : json_encode($body, JSON_UNESCAPED_UNICODE));
  $raw = curl_exec($ch);
  $errno = curl_errno($ch);
  $err = curl_error($ch);
  $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
  curl_close($ch);
  // Lưu lý do lỗi kết nối để màn hình hiển thị (giúp chẩn đoán HTTP 0)
  $GLOBALS['gdt_err'] = ($raw === false) ? ('curl#' . $errno . ' ' . $err) : '';
  if ($raw === false) { error_log('tax-portal curl: #' . $errno . ' ' . $err . ' @ ' . $url); return [null, 0]; }
  return [$raw, $code];
}
function gdt_errsuffix(): string { return !empty($GLOBALS['gdt_err']) ? ' · ' . $GLOBALS['gdt_err'] : ''; }

/* ---------- Lấy captcha ---------- */
if ($action === 'captcha') {
  list($raw, $code) = gdt_http('GET', $BASE . '/captcha');
  if ($code !== 200 || !$raw) json_out(['error' => 'Không lấy được captcha từ cổng thuế (HTTP ' . $code . gdt_errsuffix() . ')'], 502);
  $j = json_decode($raw, true);
  if (!isset($j['content'])) json_out(['error' => 'Cổng thuế trả captcha không đúng định dạng'], 502);
  json_out(['ok' => true, 'key' => $j['key'] ?? '', 'svg' => $j['content']]);
}

/* ---------- Đăng nhập ---------- */
if ($action === 'login') {
  ai_rate_limit('taxlogin', 12, 60);
  $b = body();
  $username = trim((string)($b['username'] ?? ''));
  $password = (string)($b['password'] ?? '');
  $ckey = (string)($b['ckey'] ?? '');
  $cvalue = trim((string)($b['cvalue'] ?? ''));
  if ($username === '' || $password === '' || $cvalue === '') {
    json_out(['error' => 'Nhập đủ MST, mật khẩu và mã captcha'], 400);
  }
  // Cổng yêu cầu username dạng "MST-MST" cho hóa đơn (một số tài khoản); thử nguyên trước.
  $payload = ['ckey' => $ckey, 'cvalue' => $cvalue, 'username' => $username, 'password' => $password];
  list($raw, $code) = gdt_http('POST', $BASE . '/security-taxpayer/authenticate', $payload);
  $j = $raw ? json_decode($raw, true) : null;
  if ($code === 200 && !empty($j['token'])) {
    $_SESSION['tax_token'] = $j['token'];
    $_SESSION['tax_mst'] = $username;
    $_SESSION['tax_token_at'] = time();
    json_out(['ok' => true, 'mst' => $username]);
  }
  $msg = ($j && isset($j['message'])) ? $j['message'] : ('Đăng nhập thất bại (HTTP ' . $code . ')');
  // Thông điệp cổng thường: sai captcha / sai mật khẩu / tài khoản khóa
  json_out(['error' => $msg], 401);
}

if ($action === 'session') {
  json_out(['ok' => true, 'connected' => !empty($_SESSION['tax_token']), 'mst' => $_SESSION['tax_mst'] ?? '']);
}
if ($action === 'logout') {
  unset($_SESSION['tax_token'], $_SESSION['tax_mst'], $_SESSION['tax_token_at']);
  json_out(['ok' => true]);
}

/* ---------- Kéo hóa đơn ---------- */
if ($action === 'pull') {
  if (empty($_SESSION['tax_token'])) json_out(['error' => 'Chưa đăng nhập cổng thuế', 'need_login' => true], 401);
  $b = body();
  $kind = $b['kind'] ?? 'both';
  $from = (string)($b['from'] ?? '');   // yyyy-mm-dd
  $to = (string)($b['to'] ?? '');
  if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $from) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $to)) {
    json_out(['error' => 'Khoảng ngày không hợp lệ'], 400);
  }
  // Cổng dùng định dạng dd/MM/yyyy trong tham số search
  $vn = function ($ymd) { $p = explode('-', $ymd); return $p[2] . '/' . $p[1] . '/' . $p[0]; };
  $search = 'tdlap=ge=' . $vn($from) . 'T00:00:00;tdlap=le=' . $vn($to) . 'T23:59:59';
  $sort = 'tdlap:desc,khmshdon:asc,shdon:desc';

  $endpoints = [];
  if ($kind === 'purchase' || $kind === 'both') $endpoints['in'] = '/query/invoices/purchase';
  if ($kind === 'sold' || $kind === 'both') $endpoints['out'] = '/query/invoices/sold';

  $all = [];
  $debug = [];
  foreach ($endpoints as $dir => $path) {
    $state = null;
    for ($page = 0; $page < 25; $page++) {   // tối đa 25 trang (~1250 HĐ) chống vòng lặp vô tận
      $url = $BASE . $path . '?sort=' . rawurlencode($sort) . '&size=50&search=' . rawurlencode($search);
      if ($state) $url .= '&state=' . rawurlencode($state);
      list($raw, $code) = gdt_http('GET', $url, null, true);
      if ($code === 401) json_out(['error' => 'Phiên cổng thuế đã hết hạn — đăng nhập lại', 'need_login' => true], 401);
      if ($code !== 200 || !$raw) {
        if ($page === 0) $debug[] = $dir . ': HTTP ' . $code . ' ' . substr((string)$raw, 0, 200);
        break;
      }
      $j = json_decode($raw, true);
      $datas = $j['datas'] ?? ($j['data'] ?? []);
      if (!is_array($datas) || !count($datas)) break;
      foreach ($datas as $r) {
        $base = (float)($r['tgtcthue'] ?? 0);
        $vat = (float)($r['tgtthue'] ?? 0);
        $total = (float)($r['tgtttbso'] ?? ($base + $vat));
        $rate = $base > 0 ? round($vat / $base * 100) : 0;
        $all[] = [
          'direction' => $dir,
          'khmshdon' => (string)($r['khmshdon'] ?? ''),
          'khhdon' => (string)($r['khhdon'] ?? ''),
          'shdon' => (string)($r['shdon'] ?? ''),
          'date' => substr((string)($r['tdlap'] ?? ''), 0, 10),
          'partnerMst' => $dir === 'in' ? (string)($r['nbmst'] ?? '') : (string)($r['nmmst'] ?? ''),
          'partnerName' => $dir === 'in' ? (string)($r['nbten'] ?? '') : (string)($r['nmten'] ?? ''),
          'base' => $base, 'vat' => $vat, 'total' => $total, 'vatRate' => $rate,
          'status' => (string)($r['tthai'] ?? ($r['ttxly'] ?? '')),
        ];
      }
      $state = $j['state'] ?? null;
      if (!$state) break;
    }
  }
  json_out(['ok' => true, 'invoices' => $all, 'count' => count($all), 'debug' => $debug]);
}

json_out(['error' => 'Hành động không hợp lệ'], 400);
