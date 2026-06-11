<?php
/* ============================================================
   productivity.php — Sản lượng/Năng suất (nguồn: mau.tranhdali.vn)
   • action=pull : ketoan KÉO từ mau /api/nang-suat (proxy server-side,
                   khoá kín, header X-API-Key) rồi UPSERT — NGUỒN CHÍNH.
   • action=push : mau ĐẨY sang (key productivity_api_key) — DỰ PHÒNG.
   • action=list : web kế toán ĐỌC để hiển thị (session auth).
   Khoá chống trùng = (entry_date, employee_code) → pull/push không nhân đôi.
   ============================================================ */
require __DIR__ . '/lib.php';

$pdo = pdo();
$action = $_GET['action'] ?? 'list';

$pdo->exec("CREATE TABLE IF NOT EXISTS productivity_entries (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  entry_date DATE NOT NULL,
  employee_code VARCHAR(50) DEFAULT NULL,
  employee_name VARCHAR(120) DEFAULT NULL,
  pha INT NOT NULL DEFAULT 0,
  tranh_rot INT NOT NULL DEFAULT 0,
  mau_rot INT NOT NULL DEFAULT 0,
  sx INT NOT NULL DEFAULT 0,
  note VARCHAR(255) DEFAULT NULL,
  source VARCHAR(20) NOT NULL DEFAULT 'mau',
  dedup_hash VARCHAR(64) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_date (entry_date),
  INDEX idx_emp (employee_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

// Khoá chống trùng theo (ngày, nhân viên) — pull & push ghi đè lẫn nhau, không nhân đôi.
function pr_hash($date, $emp) { return hash('sha256', $date . '|' . $emp); }

// Chuẩn hoá 1 bản ghi (chấp nhận nhiều tên trường: snake/camel/tiếng Việt)
function pr_norm($it) {
  $g = function ($keys) use ($it) { foreach ($keys as $k) { if (isset($it[$k]) && $it[$k] !== '') return $it[$k]; } return null; };
  return [
    'date' => (string)($g(['date', 'entry_date', 'ngay']) ?? ''),
    'code' => trim((string)($g(['employee_code', 'code', 'user', 'username', 'ma_nv']) ?? '')),
    'name' => trim((string)($g(['employee_name', 'name', 'ho_ten', 'fullname', 'ten']) ?? '')),
    'pha'  => (int)($g(['pha', 'me_pha', 'so_me_pha']) ?? 0),
    'tr'   => (int)($g(['tranh_rot', 'tranhRot', 'so_tranh_rot']) ?? 0),
    'mr'   => (int)($g(['mau_rot', 'mauRot', 'so_mau_rot']) ?? 0),
    'sx'   => (int)($g(['sx', 'tranh_sx', 'so_tranh_sx']) ?? 0),
    'note' => (string)($g(['note', 'ghi_chu']) ?? ''),
  ];
}

// Lấy mảng bản ghi từ nhiều dạng JSON
function pr_extract($data) {
  if (!is_array($data)) return [];
  if ($data === [] || array_keys($data) === range(0, count($data) - 1)) return $data;
  foreach (['data', 'entries', 'nang_suat', 'nangsuat', 'results', 'items', 'rows', 'list'] as $k) {
    if (isset($data[$k]) && is_array($data[$k])) {
      $v = $data[$k];
      if ($v === [] || array_keys($v) === range(0, count($v) - 1)) return $v;
      return pr_extract($v);
    }
  }
  return [];
}

function pr_upsert(PDO $pdo, $r, $source) {
  static $st = null;
  if (!$st) $st = $pdo->prepare("INSERT INTO productivity_entries
      (entry_date, employee_code, employee_name, pha, tranh_rot, mau_rot, sx, note, source, dedup_hash)
      VALUES (?,?,?,?,?,?,?,?,?,?)
      ON DUPLICATE KEY UPDATE employee_name=VALUES(employee_name), pha=VALUES(pha),
        tranh_rot=VALUES(tranh_rot), mau_rot=VALUES(mau_rot), sx=VALUES(sx),
        note=VALUES(note), source=VALUES(source), updated_at=CURRENT_TIMESTAMP");
  $emp = $r['code'] !== '' ? $r['code'] : $r['name'];
  $st->execute([$r['date'], $r['code'] ?: null, $r['name'] ?: null,
    $r['pha'], $r['tr'], $r['mr'], $r['sx'], $r['note'] ?: null, $source, pr_hash($r['date'], $emp)]);
}

/* ---------- KÉO từ mau (pull) — NGUỒN CHÍNH ---------- */
if ($action === 'pull') {
  require_login();
  $cfg = require __DIR__ . '/config.php';
  $url = $cfg['productivity_url'] ?? '';
  $key = $cfg['timekeeping_key'] ?? '';     // dùng lại khoá chấm công (= KETOAN_API_KEY)
  if (!$url || !$key || $key === 'DAN_KHOA_API_CHAM_CONG_VAO_DAY') {
    json_out(['error' => 'Chưa cấu hình productivity_url / khoá API trong api/config.php'], 500);
  }
  $qs = [];
  if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $_GET['day'] ?? '')) $qs['day'] = $_GET['day'];
  elseif (preg_match('/^\d{4}-\d{2}-\d{2}$/', $_GET['from'] ?? '') && preg_match('/^\d{4}-\d{2}-\d{2}$/', $_GET['to'] ?? '')) { $qs['from'] = $_GET['from']; $qs['to'] = $_GET['to']; }
  else { $d = (int)($_GET['days'] ?? 31); $qs['days'] = max(1, min(92, $d)); }
  $full = $url . (strpos($url, '?') !== false ? '&' : '?') . http_build_query($qs);

  $raw = null; $http = 0;
  if (function_exists('curl_init')) {
    $ch = curl_init($full);
    curl_setopt_array($ch, [
      CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 25,
      CURLOPT_SSL_VERIFYPEER => true, CURLOPT_FOLLOWLOCATION => true,
      CURLOPT_HTTPHEADER => ['Accept: application/json', 'X-API-Key: ' . $key],  // khoá qua HEADER (an toàn hơn ?key=)
    ]);
    $raw = curl_exec($ch); $http = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
  } else {
    $ctx = stream_context_create(['http' => ['timeout' => 25, 'header' => "Accept: application/json\r\nX-API-Key: " . $key . "\r\n"]]);
    $raw = @file_get_contents($full, false, $ctx);
    $http = ($raw === false) ? 0 : 200;
  }
  if ($raw === false || $raw === null) json_out(['error' => 'Không gọi được API năng suất bên mau'], 502);
  if ($http && ($http < 200 || $http >= 300)) json_out(['error' => 'API năng suất trả HTTP ' . $http, 'body' => mb_substr($raw, 0, 300)], 502);
  $data = json_decode($raw, true);
  if ($data === null) json_out(['error' => 'API năng suất trả về không phải JSON', 'body' => mb_substr($raw, 0, 300)], 502);

  $n = 0; $skipped = 0;
  foreach (pr_extract($data) as $it) {
    if (!is_array($it)) { $skipped++; continue; }
    $r = pr_norm($it);
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $r['date']) || ($r['code'] === '' && $r['name'] === '')) { $skipped++; continue; }
    pr_upsert($pdo, $r, 'mau');
    $n++;
  }
  json_out(['ok' => true, 'synced' => $n, 'skipped' => $skipped]);
}

/* ---------- mau ĐẨY sang (push) — DỰ PHÒNG ---------- */
if ($action === 'push') {
  $cfg = require __DIR__ . '/config.php';
  $expected = $cfg['productivity_api_key'] ?? '';
  $key = $_GET['key'] ?? ($_SERVER['HTTP_X_API_KEY'] ?? '');
  if ($expected === '' || !hash_equals((string)$expected, (string)$key)) json_out(['error' => 'Sai hoặc thiếu khoá API'], 401);
  $b = body();
  $items = isset($b['entries']) && is_array($b['entries']) ? $b['entries'] : pr_extract($b);
  if (!$items) json_out(['error' => 'Không có dữ liệu. Gửi {"entries":[...]}'], 400);
  $n = 0; $skipped = [];
  foreach ($items as $it) {
    if (!is_array($it)) continue;
    $r = pr_norm($it);
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $r['date'])) { $skipped[] = 'ngày sai: ' . $r['date']; continue; }
    if ($r['code'] === '' && $r['name'] === '') { $skipped[] = 'thiếu nhân viên (' . $r['date'] . ')'; continue; }
    pr_upsert($pdo, $r, (string)($it['source'] ?? 'mau'));
    $n++;
  }
  json_out(['ok' => true, 'received' => $n, 'skipped' => $skipped]);
}

/* ---------- web kế toán ĐỌC (session auth) ---------- */
require_login();
$cfg = require __DIR__ . '/config.php';
$src = $cfg['productivity_source'] ?? 'productivity_entries';
if (!preg_match('/^[A-Za-z0-9_]+(\.[A-Za-z0-9_]+)?$/', $src)) $src = 'productivity_entries';
$srcSql = implode('.', array_map(function ($x) { return '`' . $x . '`'; }, explode('.', $src)));

$from = preg_match('/^\d{4}-\d{2}-\d{2}$/', $_GET['from'] ?? '') ? $_GET['from'] : null;
$to   = preg_match('/^\d{4}-\d{2}-\d{2}$/', $_GET['to'] ?? '') ? $_GET['to'] : null;
$w = []; $p = [];
if ($from) { $w[] = 'entry_date >= ?'; $p[] = $from; }
if ($to)   { $w[] = 'entry_date <= ?'; $p[] = $to; }
$where = $w ? ('WHERE ' . implode(' AND ', $w)) : '';
try {
  $st = $pdo->prepare("SELECT entry_date, employee_code, employee_name, pha, tranh_rot, mau_rot, sx, note, source
                       FROM $srcSql $where ORDER BY entry_date DESC LIMIT 5000");
  $st->execute($p);
  json_out(['ok' => true, 'source' => $src, 'entries' => $st->fetchAll()]);
} catch (Throwable $e) {
  json_out(['ok' => false, 'error' => 'Không đọc được nguồn "' . $src . '".'], 500);
}
