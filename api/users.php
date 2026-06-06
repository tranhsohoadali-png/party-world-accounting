<?php
/* ============================================================
   users.php — Quản lý người dùng (chỉ admin)
   ============================================================ */
require __DIR__ . '/lib.php';

require_role(['admin']);
$action = $_GET['action'] ?? '';
$pdo = pdo();

if ($action === 'list') {
  $rows = $pdo->query('SELECT id, username, fullname, role, active, created_at FROM users ORDER BY id')->fetchAll();
  json_out(['users' => $rows]);
}

if ($action === 'create') {
  $b = body();
  $username = trim($b['username'] ?? '');
  $password = (string)($b['password'] ?? '');
  $fullname = trim($b['fullname'] ?? '');
  $role = $b['role'] ?? 'nhanvien';
  if ($username === '' || strlen($password) < 6) json_out(['error' => 'Tên đăng nhập và mật khẩu (≥6 ký tự) bắt buộc'], 400);
  if (!in_array($role, ['admin', 'ketoan', 'nhanvien'], true)) $role = 'nhanvien';
  try {
    $st = $pdo->prepare('INSERT INTO users (username, password_hash, fullname, role) VALUES (?,?,?,?)');
    $st->execute([$username, password_hash($password, PASSWORD_DEFAULT), $fullname, $role]);
  } catch (Throwable $e) {
    json_out(['error' => 'Tên đăng nhập đã tồn tại'], 400);
  }
  json_out(['ok' => true, 'id' => (int)$pdo->lastInsertId()]);
}

if ($action === 'update') {
  $b = body();
  $id = (int)($b['id'] ?? 0);
  $fullname = trim($b['fullname'] ?? '');
  $role = $b['role'] ?? 'nhanvien';
  $active = (int)($b['active'] ?? 1);
  if (!in_array($role, ['admin', 'ketoan', 'nhanvien'], true)) $role = 'nhanvien';
  $st = $pdo->prepare('UPDATE users SET fullname = ?, role = ?, active = ? WHERE id = ?');
  $st->execute([$fullname, $role, $active, $id]);
  json_out(['ok' => true]);
}

if ($action === 'resetpw') {
  $b = body();
  $id = (int)($b['id'] ?? 0);
  $password = (string)($b['password'] ?? '');
  if (strlen($password) < 6) json_out(['error' => 'Mật khẩu tối thiểu 6 ký tự'], 400);
  $st = $pdo->prepare('UPDATE users SET password_hash = ? WHERE id = ?');
  $st->execute([password_hash($password, PASSWORD_DEFAULT), $id]);
  json_out(['ok' => true]);
}

if ($action === 'delete') {
  $b = body();
  $id = (int)($b['id'] ?? 0);
  if ($id === (int)$_SESSION['uid']) json_out(['error' => 'Không thể tự xóa tài khoản đang đăng nhập'], 400);
  $st = $pdo->prepare('DELETE FROM users WHERE id = ?');
  $st->execute([$id]);
  json_out(['ok' => true]);
}

json_out(['error' => 'Hành động không hợp lệ'], 400);
