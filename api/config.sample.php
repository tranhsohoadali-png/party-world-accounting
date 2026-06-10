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

  // Kết nối nguồn chấm công (mau.tranhdali.vn -> lấy chấm công về)
  'timekeeping_url' => 'https://mau.tranhdali.vn/api/luong',
  'timekeeping_key' => 'DAN_KHOA_API_CHAM_CONG_VAO_DAY',

  // Khoá để mau.tranhdali.vn GỌI NGƯỢC sang lấy lương (endpoint /api/luong-nhan-vien.php)
  // Đặt cùng một chuỗi này ở cả 2 bên (mau + ketoan).
  'salary_api_key' => 'dali-luong-2026',
];
