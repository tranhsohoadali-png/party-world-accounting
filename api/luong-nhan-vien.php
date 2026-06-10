<?php
/* ============================================================
   luong-nhan-vien.php — Endpoint để mau.tranhdali.vn GỌI SANG
   lấy lương của 1 nhân viên (lương ngày + lương tháng tới hiện tại).

   GET /api/luong-nhan-vien.php?key=...&user=<tên đăng nhập>&month=2026-06[&day=2026-06-10]
   Trả: { "ok": true, "day": 211538, "month": 5447115, "month_label": "06/2026" }
   ============================================================ */
require __DIR__ . '/lib.php';
header('Access-Control-Allow-Origin: *'); // đã bảo vệ bằng key, cho phép gọi từ nơi khác

$cfg = require __DIR__ . '/config.php';
$expect = $cfg['salary_api_key'] ?? '';
$key = $_GET['key'] ?? '';
if (!$expect) json_out(['ok' => false, 'error' => 'chua cau hinh khoa luong'], 500);
if ($key !== $expect) json_out(['ok' => false, 'error' => 'sai key'], 401);

$user = trim($_GET['user'] ?? '');
$month = (isset($_GET['month']) && preg_match('/^\d{4}-\d{2}$/', $_GET['month'])) ? $_GET['month'] : date('Y-m');
if ($user === '') json_out(['ok' => false, 'error' => 'thieu user'], 400);

// Đọc dữ liệu app (blob JSON)
$row = pdo()->query('SELECT data FROM app_data WHERE id=1')->fetch();
$data = ($row && $row['data']) ? json_decode($row['data'], true) : null;
if (!is_array($data)) json_out(['ok' => false, 'error' => 'chua co du lieu'], 200);
$emps = $data['employees'] ?? [];
$payrolls = $data['payrolls'] ?? [];

$norm = function ($s) { return mb_strtolower(trim((string)$s)); };

// Tìm nhân viên theo mã chấm công (tkCode) -> mã NV -> tên
$e = null;
foreach ($emps as $x) {
  if ($norm($x['tkCode'] ?? '') === $norm($user) || $norm($x['code'] ?? '') === $norm($user) || $norm($x['name'] ?? '') === $norm($user)) { $e = $x; break; }
}
if (!$e) json_out(['ok' => false, 'error' => 'khong tim thay nhan vien: ' . $user], 200);

// Tìm bảng lương tháng + dòng của NV
$line = null; $sd = 26;
foreach ($payrolls as $p) {
  if (($p['month'] ?? '') === $month) {
    $sd = (int)($p['standardDays'] ?? 26) ?: 26;
    foreach (($p['lines'] ?? []) as $ln) if (($ln['employeeId'] ?? '') === ($e['id'] ?? '')) { $line = $ln; break; }
    break;
  }
}

$base = (float)($e['salaryBase'] ?? 0);
$dayWage = $sd ? $base / $sd : 0;     // lương 1 ngày công

// Lương tháng tới hiện tại (thực lĩnh theo ngày công đã có)
$net = 0;
if ($line) {
  $totalDays = (float)($line['totalDays'] ?? 0);
  $allowDays = (float)($line['allowDays'] ?? 0);
  $hourWage = $dayWage / 8;
  $luongChinh = $dayWage * $totalDays;
  $luongTN = ((float)($e['allowResp'] ?? 0) / $sd) * $allowDays;
  $pc = (((float)($e['allowTransport'] ?? 0) + (float)($e['allowLunch'] ?? 0) + (float)($e['allowSeniority'] ?? 0)) / $sd) * $allowDays;
  $lamThem = $hourWage * (float)($line['otHours'] ?? 0);
  $congThem = (float)($line['bonus'] ?? 0) + $lamThem + $pc + (float)($line['extra'] ?? 0);
  $tongTru = (float)($line['lateFine'] ?? 0) + (float)($line['bhxh'] ?? 0) + (float)($line['advance'] ?? 0) + (float)($line['phoneUse'] ?? 0);
  $net = $luongChinh + $luongTN + $congThem - $tongTru;
}

json_out([
  'ok' => true,
  'user' => $user,
  'day' => (int)round($dayWage),
  'month' => (int)round($net),
  'month_label' => substr($month, 5, 2) . '/' . substr($month, 0, 4),
]);
