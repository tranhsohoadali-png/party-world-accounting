<?php
/* ============================================================
   data.php — Tải / lưu toàn bộ dữ liệu kế toán (JSON) trên server
   Có kiểm tra "version" để chống ghi đè khi nhiều người sửa cùng lúc.
   ============================================================ */
require __DIR__ . '/lib.php';

$user = require_login();
$action = $_GET['action'] ?? '';

/* ----- Danh sách cơ sở kinh doanh (mọi tài khoản đã đăng nhập đều xem được) ----- */
if ($action === 'ws_list') {
  $pdo = pdo();
  pw_ensure_workspaces_table($pdo);
  $rows = $pdo->query('SELECT id, name FROM workspaces ORDER BY id')->fetchAll();
  $out = [];
  foreach ($rows as $r) $out[] = ['id' => (int)$r['id'], 'name' => $r['name']];
  json_out(['workspaces' => $out]);
}

/* ----- Thêm cơ sở kinh doanh mới (chỉ admin/kế toán) -----
   Tạo dòng workspaces + dòng app_data rỗng tương ứng. KHÔNG đụng cơ sở khác. */
if ($action === 'ws_add') {
  if (!in_array($user['role'], ['admin', 'ketoan'], true))
    json_out(['error' => 'Chỉ admin hoặc kế toán mới được thêm cơ sở'], 403);
  $b = body();
  $name = trim((string)($b['name'] ?? ''));
  if ($name === '') json_out(['error' => 'Thiếu tên cơ sở'], 400);
  if (mb_strlen($name) > 120) $name = mb_substr($name, 0, 120);
  $pdo = pdo();
  pw_ensure_workspaces_table($pdo);
  $st = $pdo->prepare('INSERT INTO workspaces (name) VALUES (?)');
  $st->execute([$name]);
  $id = (int)$pdo->lastInsertId();
  // Tạo sẵn dòng dữ liệu RỖNG cho cơ sở này (client sẽ seed sổ trống khi mở lần đầu).
  $pdo->prepare('INSERT IGNORE INTO app_data (id, data, version) VALUES (?, NULL, 0)')->execute([$id]);
  json_out(['ok' => true, 'id' => $id, 'name' => $name]);
}

if ($action === 'get') {
  $ws = pw_current_ws();
  $st = pdo()->prepare('SELECT data, version, updated_at, updated_by FROM app_data WHERE id = ?');
  $st->execute([$ws]);
  $row = $st->fetch();
  if (!$row) json_out(['data' => null, 'version' => 0]);   // cơ sở mới chưa có dữ liệu -> client seed sổ trống
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
  $ws = pw_current_ws($b);         // cơ sở kinh doanh đang lưu (mặc định 1 = dữ liệu gốc)
  $clientVersion = (int)($b['version'] ?? -1);
  // force = bỏ qua lớp chắn mất dữ liệu — CHỈ admin/ketoan (UI gate là client-side, server phải tự chặn nhanvien giả request)
  $force = !empty($b['force']) && in_array($user['role'], ['admin', 'ketoan'], true);

  $pdo = pdo();
  pw_ensure_history_table($pdo);   // tạo bảng lịch sử (NGOÀI transaction — CREATE auto-commit)
  $pdo->beginTransaction();
  // Lấy cả data + version của ĐÚNG cơ sở (FOR UPDATE để khóa dòng)
  $sel = $pdo->prepare('SELECT data, version FROM app_data WHERE id = ? FOR UPDATE');
  $sel->execute([$ws]);
  $row = $sel->fetch();
  $cur = (int)($row['version'] ?? 0);
  // Chống ghi đè: nếu version client gửi lên khác version hiện tại -> xung đột
  if ($clientVersion !== -1 && $clientVersion !== $cur) {
    $pdo->rollBack();
    json_out(['error' => 'conflict', 'message' => 'Dữ liệu đã được người khác cập nhật. Hãy tải lại.', 'version' => $cur], 409);
  }
  $curData = (isset($row['data']) && $row['data'] !== null) ? json_decode($row['data'], true) : null;

  /* ----- Phân quyền GHI theo section (chỉ với vai trò bị giới hạn) ----- */
  $allowed = pw_allowed_sections($user['role']);
  if ($allowed !== null && $curData !== null) {   // null = admin/ketoan: bỏ qua; curData=null = seed đầu
    $changed = pw_changed_top_keys($curData, $b['data']);
    $violations = array_values(array_diff($changed, $allowed));
    if ($violations) {
      $pdo->rollBack();
      json_out([
        'error' => 'forbidden_sections',
        'message' => 'Tài khoản của bạn không được phép sửa: ' . implode(', ', $violations),
        'sections' => $violations,
      ], 403);
    }
  }

  /* ----- CHẶN MẤT DỮ LIỆU: payload mới làm mất phần lớn mục lớn -> từ chối (trừ khi force) ----- */
  if (!$force) {
    $loss = pw_data_loss_check($curData, $b['data']);
    if ($loss) {
      $pdo->rollBack();
      json_out([
        'error' => 'data_loss_guard',
        'message' => 'Lưu bị CHẶN để tránh mất dữ liệu — bản mới làm mất phần lớn: ' . implode('; ', $loss)
          . '. Hãy tải lại trang rồi thử lại. Nếu thực sự muốn xóa, dùng chức năng có xác nhận.',
        'dropped' => $loss,
      ], 409);
    }
  }

  /* ----- Lưu BẢN HIỆN TẠI vào lịch sử của cơ sở này trước khi ghi đè (để luôn rollback được) ----- */
  pw_snapshot_history($pdo, isset($row['data']) ? $row['data'] : null, $cur, $user['username'], $ws);

  $newVersion = $cur + 1;
  $json = json_encode($b['data'], JSON_UNESCAPED_UNICODE);
  if ($row) {
    // Cơ sở đã có dòng dữ liệu -> cập nhật
    $up = $pdo->prepare('UPDATE app_data SET data = ?, version = ?, updated_by = ? WHERE id = ?');
    $up->execute([$json, $newVersion, $user['username'], $ws]);
  } else {
    // Cơ sở mới chưa có dòng nào -> thêm mới (tránh UPDATE 0 dòng làm mất dữ liệu lần đầu)
    $in = $pdo->prepare('INSERT INTO app_data (id, data, version, updated_by) VALUES (?, ?, ?, ?)');
    $in->execute([$ws, $json, $newVersion, $user['username']]);
  }
  $pdo->commit();
  json_out(['ok' => true, 'version' => $newVersion]);
}

json_out(['error' => 'Hành động không hợp lệ'], 400);
