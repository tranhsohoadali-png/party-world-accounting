<?php
/* ============================================================
   config.sample.php — MẪU cấu hình kết nối CSDL
   Cách dùng: COPY file này thành "config.php" (cùng thư mục)
   rồi điền thông tin MySQL thật của bạn.
   (File config.php KHÔNG được đưa lên GitHub — đã có trong .gitignore)
   ============================================================ */

return [
  'db_host' => 'localhost',
  'db_name' => 'partyworld',      // tên database đã tạo trong MySQL
  'db_user' => 'partyworld_user', // user MySQL
  'db_pass' => 'ĐỔI_MẬT_KHẨU',    // mật khẩu MySQL
  'db_charset' => 'utf8mb4',
];
