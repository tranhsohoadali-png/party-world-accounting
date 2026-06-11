<?php
/* ============================================================
   cron_timekeeping.php — Chạy nền (cron) tự cập nhật chấm công
   vào bảng lương THÁNG HIỆN TẠI trong CSDL, kể cả khi không ai
   mở app. Chỉ cập nhật cột chấm công, GIỮ NGUYÊN khoản nhập tay.
   Chỉ ghi đè khi dữ liệu thực sự thay đổi (tránh xung đột).
   Cài cron: xem cuối file / hướng dẫn.
   ============================================================ */

if (php_sapi_name() !== 'cli') { http_response_code(403); exit('Chỉ chạy qua dòng lệnh (cron).'); }
date_default_timezone_set('Asia/Ho_Chi_Minh');

$cfgFile = __DIR__ . '/config.php';
if (!file_exists($cfgFile)) { logmsg('Thiếu config.php'); exit(1); }
$cfg = require $cfgFile;

function logmsg($m) { echo date('Y-m-d H:i:s') . '  ' . $m . "\n"; }

/* 1) Kết nối CSDL */
try {
  $dsn = "mysql:host={$cfg['db_host']};dbname={$cfg['db_name']};charset={$cfg['db_charset']}";
  $pdo = new PDO($dsn, $cfg['db_user'], $cfg['db_pass'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
} catch (Throwable $e) { logmsg('LỖI CSDL: ' . $e->getMessage()); exit(1); }

/* 2) Gọi API chấm công */
$month = date('Y-m');
if (empty($cfg['timekeeping_key']) || $cfg['timekeeping_key'] === 'DAN_KHOA_API_CHAM_CONG_VAO_DAY') { logmsg('Chưa cấu hình khoá API chấm công'); exit(1); }
// Giữ ?key= (hợp đồng cũ của /api/luong) + gửi kèm header X-API-Key; sẽ bỏ ?key=
// khi bên mau xác nhận endpoint đọc header (tránh key nằm trong access log).
$url = $cfg['timekeeping_url'] . '?key=' . urlencode($cfg['timekeeping_key']) . '&month=' . urlencode($month);
$raw = tk_http_get($url, ['X-API-Key: ' . $cfg['timekeeping_key']]);
if ($raw === null) { logmsg('LỖI gọi API chấm công'); exit(1); }
$api = json_decode($raw, true);
if (!is_array($api)) { logmsg('API không trả JSON'); exit(1); }
$recs = tk_extract_list($api);
if (!$recs) { logmsg('Không có bản ghi chấm công'); exit(0); }

/* 3) Đọc dữ liệu app (blob JSON) */
$row = $pdo->query('SELECT data, version FROM app_data WHERE id=1')->fetch(PDO::FETCH_ASSOC);
$version = (int)($row['version'] ?? 0);
$data = ($row && $row['data']) ? json_decode($row['data'], true) : null;
if (!is_array($data)) { logmsg('Chưa có dữ liệu app (chưa ai dùng app lần nào)'); exit(0); }
$data['employees'] = $data['employees'] ?? [];
$data['payrolls'] = $data['payrolls'] ?? [];

/* 4) Tìm / tạo bảng lương tháng hiện tại */
$pi = null;
foreach ($data['payrolls'] as $i => $p) if (($p['month'] ?? '') === $month) { $pi = $i; break; }
$created = false;
if ($pi === null) {
  $lines = [];
  foreach ($data['employees'] as $e) {
    $lines[] = ['employeeId' => $e['id'], 'totalDays' => 0, 'allowDays' => 0, 'otHours' => 0,
      'bonus' => 0, 'extra' => 0, 'lateFine' => 0, 'bhxh' => 0, 'advance' => 0, 'phoneUse' => 0, 'note' => ''];
  }
  $data['payrolls'][] = ['id' => 'cron' . substr(md5($month), 0, 8), 'month' => $month, 'standardDays' => 26, 'note' => '', 'lines' => $lines];
  $pi = count($data['payrolls']) - 1;
  $created = true;
}

/* 5) Ghép chấm công vào các dòng (giữ nguyên khoản nhập tay) */
$empById = [];
foreach ($data['employees'] as $e) $empById[$e['id']] = $e;
$matched = 0; $changed = $created;
foreach ($recs as $r) {
  if (!is_array($r)) continue;
  $n = tk_normalize($r);
  $li = null;
  foreach ($data['payrolls'][$pi]['lines'] as $j => $ln) {
    $e = $empById[$ln['employeeId']] ?? null; if (!$e) continue;
    $tk = norm($e['tkCode'] ?? ''); $code = norm($e['code'] ?? ''); $name = norm($e['name'] ?? '');
    $rc = norm((string)($n['code'] ?? '')); $rn = norm((string)($n['name'] ?? ''));
    if ($rc !== '' && ($tk === $rc || $code === $rc)) { $li = $j; break; }
    if ($rn !== '' && $name === $rn) { $li = $j; break; }
  }
  if ($li === null) continue;
  $matched++;
  $ln =& $data['payrolls'][$pi]['lines'][$li];
  $newTotal = $n['totalDays'] !== null ? $n['totalDays'] : ($ln['totalDays'] ?? 0);
  $newAllow = $n['allowDays'] !== null ? $n['allowDays'] : ($n['totalDays'] !== null ? $n['totalDays'] : ($ln['allowDays'] ?? 0));
  $newOt    = $n['otHours'] !== null ? $n['otHours'] : ($ln['otHours'] ?? 0);
  $newFine  = ($n['lateFine'] !== null && $n['lateFine'] > 0) ? $n['lateFine'] : ($ln['lateFine'] ?? 0);
  if ($ln['totalDays'] != $newTotal || $ln['allowDays'] != $newAllow || $ln['otHours'] != $newOt || $ln['lateFine'] != $newFine) $changed = true;
  $ln['totalDays'] = $newTotal; $ln['allowDays'] = $newAllow; $ln['otHours'] = $newOt; $ln['lateFine'] = $newFine;
  unset($ln);
}

/* 6) Chỉ ghi khi thực sự thay đổi, và chỉ khi version chưa đổi (tránh đè người đang sửa) */
if (!$changed) { logmsg("Không có thay đổi (đã khớp $matched NV)."); exit(0); }
$json = json_encode($data, JSON_UNESCAPED_UNICODE);
$st = $pdo->prepare('UPDATE app_data SET data=?, version=version+1, updated_by=\'cron\' WHERE id=1 AND version=?');
$st->execute([$json, $version]);
if ($st->rowCount() > 0) logmsg("OK: cập nhật chấm công $matched NV tháng $month" . ($created ? ' (đã tạo bảng lương)' : '') . '.');
else logmsg('Bỏ qua: dữ liệu vừa được người khác cập nhật, để lần chạy sau.');

/* ---------------- Hàm phụ ---------------- */
function norm($s) { return strtolower(trim((string)$s)); }
function tk_http_get($url, $headers = []) {
  // nginx bên mau chặn IP ngoài (403) -> nếu bị chặn, thử lại qua loopback
  // 127.0.0.1 nhưng giữ nguyên https + hostname (CURLOPT_RESOLVE, SSL vẫn khớp).
  $headers[] = 'Accept: application/json';
  $try = function ($loopback) use ($url, $headers) {
    if (!function_exists('curl_init')) {
      if ($loopback) return [null, 0];
      $ctx = stream_context_create(['http' => ['timeout' => 20, 'header' => implode("\r\n", $headers) . "\r\n"]]);
      $r = @file_get_contents($url, false, $ctx);
      return [$r === false ? null : $r, $r === false ? 0 : 200];
    }
    $ch = curl_init($url);
    $opts = [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 20, CURLOPT_SSL_VERIFYPEER => true, CURLOPT_HTTPHEADER => $headers];
    if ($loopback) {
      $host = parse_url($url, PHP_URL_HOST);
      $port = (parse_url($url, PHP_URL_SCHEME) === 'http') ? 80 : 443;
      $opts[CURLOPT_RESOLVE] = [$host . ':' . $port . ':127.0.0.1'];
    }
    curl_setopt_array($ch, $opts);
    $r = curl_exec($ch); $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
    return [$r === false ? null : $r, $code];
  };
  list($r, $code) = $try(false);
  if (($code === 403 || $code === 0 || $r === null) && function_exists('curl_init')) {
    list($r2, $code2) = $try(true);
    if ($code2 >= 200 && $code2 < 300) return $r2;
  }
  return ($r !== null && $code >= 200 && $code < 300) ? $r : null;
}
function tk_num($v) {
  if ($v === null || $v === '') return null;
  if (is_numeric($v)) return $v + 0;
  $s = trim((string)$v);
  if (strpos($s, ',') !== false) $s = str_replace('.', '', $s);
  $s = str_replace(',', '.', $s);
  return is_numeric($s) ? $s + 0 : null;
}
function tk_pick($a, $keys) { foreach ($keys as $k) { if (isset($a[$k]) && $a[$k] !== '') return $a[$k]; } return null; }
function tk_extract_list($raw) {
  if (!is_array($raw)) return [];
  foreach (['data', 'employees', 'nhanvien', 'result', 'results', 'items', 'rows', 'list'] as $k) {
    if (isset($raw[$k]) && is_array($raw[$k]) && array_keys($raw[$k]) === range(0, count($raw[$k]) - 1)) return $raw[$k];
  }
  if ($raw && array_keys($raw) === range(0, count($raw) - 1)) return $raw;
  return [];
}
function tk_normalize($r) {
  $att = (isset($r['attendance']) && is_array($r['attendance'])) ? $r['attendance'] : [];
  $pie = (isset($r['piece']) && is_array($r['piece'])) ? $r['piece'] : [];
  $flat = array_merge($pie, $att, $r);
  $wd = tk_num(tk_pick($flat, ['work_days', 'workDays', 'ngay_cong_thuc_te', 'di_lam', 'ngay_di_lam', 'days']));
  $total = tk_num(tk_pick($flat, ['tong_ngay_cong', 'tongNgayCong', 'tong_cong', 'totalDays']));
  $allow = tk_num(tk_pick($flat, ['ngay_cong_phu_cap', 'ngay_cong_co_phu_cap', 'ngay_cong_thuc_te', 'allowDays', 'ngay_cong', 'cong']));
  if ($total === null) $total = $wd;
  if ($allow === null) $allow = ($wd !== null ? $wd : $total);
  return [
    'code' => tk_pick($flat, ['user', 'username', 'ma', 'maNV', 'ma_nv', 'code', 'msnv', 'id', 'manv']),
    'name' => tk_pick($flat, ['user', 'username', 'ten', 'tenNV', 'ho_ten', 'hoTen', 'name', 'fullname']),
    'totalDays' => $total, 'allowDays' => $allow,
    'otHours' => tk_num(tk_pick($flat, ['ot_hours', 'otHours', 'tang_ca', 'gio_tang_ca', 'overtime'])),
    'lateFine' => tk_num(tk_pick($flat, ['late_fine', 'lateFine', 'phat_di_muon', 'phat'])),
  ];
}
