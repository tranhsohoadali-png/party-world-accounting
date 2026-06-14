<?php
/* ============================================================
   install.php — Cài đặt lần đầu: tạo bảng + tài khoản admin
   Mở 1 lần trên trình duyệt: https://ketoan.tranhdali.vn/api/install.php
   Sau khi cài xong, NÊN XÓA file này đi cho an toàn.
   ============================================================ */
require __DIR__ . '/lib.php';

$pdo = pdo();

// Chốt an toàn: nếu đã cài (đã có người dùng) thì TỪ CHỐI chạy lại.
// Tránh việc bất kỳ ai mở URL này cũng dò được cấu trúc CSDL.
try {
  $already = (int)$pdo->query('SELECT COUNT(*) FROM users')->fetchColumn();
  if ($already > 0) {
    json_out([
      'ok' => false,
      'message' => 'Hệ thống đã được cài đặt. Vì an toàn, hãy XÓA file api/install.php trên máy chủ.',
    ], 403);
  }
} catch (Throwable $e) {
  // Bảng users chưa tồn tại -> đây là lần cài đầu tiên, cho phép tiếp tục.
}

// Tạo bảng users
$pdo->exec("CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  fullname VARCHAR(120) DEFAULT '',
  role ENUM('admin','ketoan','nhanvien') NOT NULL DEFAULT 'nhanvien',
  active TINYINT NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

// Tạo bảng dữ liệu (lưu toàn bộ JSON của app, có version chống ghi đè)
$pdo->exec("CREATE TABLE IF NOT EXISTS app_data (
  id INT PRIMARY KEY,
  data LONGTEXT,
  version INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by VARCHAR(50) DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

// Khởi tạo dòng dữ liệu rỗng (id=1) nếu chưa có
$pdo->exec("INSERT IGNORE INTO app_data (id, data, version) VALUES (1, NULL, 0)");

// Tạo admin mặc định nếu chưa có user nào
$count = (int)$pdo->query('SELECT COUNT(*) FROM users')->fetchColumn();
$created = null;
if ($count === 0) {
  $defaultPass = 'partyworld@123';
  $hash = password_hash($defaultPass, PASSWORD_DEFAULT);
  $st = $pdo->prepare("INSERT INTO users (username, password_hash, fullname, role) VALUES ('admin', ?, 'Quản trị viên', 'admin')");
  $st->execute([$hash]);
  $created = ['username' => 'admin', 'password' => $defaultPass];
}

json_out([
  'ok' => true,
  'message' => 'Cài đặt hoàn tất.',
  'admin_account' => $created,
  'note' => $created
    ? 'Hãy đăng nhập bằng tài khoản admin ở trên rồi ĐỔI MẬT KHẨU ngay. Sau đó xóa file install.php.'
    : 'Đã có người dùng từ trước — không tạo lại admin. Hãy xóa file install.php.',
]);
