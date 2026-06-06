<?php
/* ============================================================
   data.php — Tải / lưu toàn bộ dữ liệu kế toán (JSON) trên server
   Có kiểm tra "version" để chống ghi đè khi nhiều người sửa cùng lúc.
   ============================================================ */
require __DIR__ . '/lib.php';

$user = require_login();
$action = $_GET['action'] ?? '';

if ($action === 'get') {
  $row = pdo()->query('SELECT data, version, updated_at, updated_by FROM app_data WHERE id = 1')->fetch();
  if (!$row) json_out(['data' => null, 'version' => 0]);
  json_out([
    'data' => $row['data'] !== null ? json_decode($row['data'], true) : null,
    'version' => (int)$row['version'],
    'updated_at' => $row['updated_at'],
    'updated_by' => $row['updated_by'],
  ]);
}

if ($action === 'save') {
  // Mọi tài khoản đã đăng nhập đều được lưu (phân quyền chi tiết theo menu ở giao diện).
  $b = body();
  if (!array_key_exists('data', $b)) json_out(['error' => 'Thiếu dữ liệu'], 400);
  $clientVersion = (int)($b['version'] ?? -1);

  $pdo = pdo();
  $pdo->beginTransaction();
  $cur = (int)$pdo->query('SELECT version FROM app_data WHERE id = 1 FOR UPDATE')->fetchColumn();
  // Chống ghi đè: nếu version client gửi lên khác version hiện tại -> xung đột
  if ($clientVersion !== -1 && $clientVersion !== $cur) {
    $pdo->rollBack();
    json_out(['error' => 'conflict', 'message' => 'Dữ liệu đã được người khác cập nhật. Hãy tải lại.', 'version' => $cur], 409);
  }
  $newVersion = $cur + 1;
  $json = json_encode($b['data'], JSON_UNESCAPED_UNICODE);
  $st = $pdo->prepare('UPDATE app_data SET data = ?, version = ?, updated_by = ? WHERE id = 1');
  $st->execute([$json, $newVersion, $user['username']]);
  $pdo->commit();
  json_out(['ok' => true, 'version' => $newVersion]);
}

json_out(['error' => 'Hành động không hợp lệ'], 400);
