<?php
/* ============================================================
   auth.php — Đăng nhập / đăng xuất / kiểm tra phiên + đổi mật khẩu
   ============================================================ */
require __DIR__ . '/lib.php';

$action = $_GET['action'] ?? '';

if ($action === 'login') {
  $b = body();
  $username = trim($b['username'] ?? '');
  $password = (string)($b['password'] ?? '');
  if ($username === '' || $password === '') json_out(['error' => 'Nhập tên đăng nhập và mật khẩu'], 400);
  $st = pdo()->prepare('SELECT * FROM users WHERE username = ?');
  $st->execute([$username]);
  $u = $st->fetch();
  if (!$u || (int)$u['active'] !== 1 || !password_verify($password, $u['password_hash'])) {
    json_out(['error' => 'Sai tên đăng nhập hoặc mật khẩu'], 401);
  }
  $_SESSION['uid'] = (int)$u['id'];
  json_out(['ok' => true, 'user' => [
    'id' => (int)$u['id'], 'username' => $u['username'],
    'fullname' => $u['fullname'], 'role' => $u['role'],
  ]]);
}

if ($action === 'logout') {
  $_SESSION = [];
  session_destroy();
  json_out(['ok' => true]);
}

if ($action === 'me') {
  $u = current_user();
  json_out(['user' => $u ? [
    'id' => (int)$u['id'], 'username' => $u['username'],
    'fullname' => $u['fullname'], 'role' => $u['role'],
  ] : null]);
}

if ($action === 'changepw') {
  $u = require_login();
  $b = body();
  $old = (string)($b['old'] ?? '');
  $new = (string)($b['new'] ?? '');
  if (strlen($new) < 6) json_out(['error' => 'Mật khẩu mới tối thiểu 6 ký tự'], 400);
  $st = pdo()->prepare('SELECT password_hash FROM users WHERE id = ?');
  $st->execute([$u['id']]);
  $hash = $st->fetchColumn();
  if (!password_verify($old, $hash)) json_out(['error' => 'Mật khẩu cũ không đúng'], 400);
  $up = pdo()->prepare('UPDATE users SET password_hash = ? WHERE id = ?');
  $up->execute([password_hash($new, PASSWORD_DEFAULT), $u['id']]);
  json_out(['ok' => true]);
}

json_out(['error' => 'Hành động không hợp lệ'], 400);
