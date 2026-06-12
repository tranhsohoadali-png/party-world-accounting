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

  // Nguồn NĂNG SUẤT: ketoan KÉO (pull) từ mau. DÙNG LẠI timekeeping_key (cùng KETOAN_API_KEY),
  // gửi qua header X-API-Key. Tham số hỗ trợ: ?day= / ?from=&to= / ?days=N (tối đa 92).
  'productivity_url' => 'https://mau.tranhdali.vn/api/nang-suat',

  // Khoá để mau.tranhdali.vn GỌI NGƯỢC sang lấy lương (endpoint /api/luong-nhan-vien.php)
  // Đặt cùng một chuỗi này ở cả 2 bên (mau + ketoan).
  'salary_api_key' => 'dali-luong-2026',

  // Khoá để mau.tranhdali.vn ĐẨY sản lượng/năng suất sang (endpoint /api/productivity.php?action=push)
  // Đặt cùng chuỗi này ở mau khi gọi POST. ĐỔI thành chuỗi bí mật của bạn.
  'productivity_api_key' => 'dali-nangsuat-2026',

  // NGUỒN đọc năng suất cho trang hiển thị.
  //  - Mặc định 'productivity_entries' = đọc bảng do mau ĐẨY sang (push).
  //  - Nếu mau & ketoan CHUNG 1 MySQL: cho mau tạo VIEW rồi đặt ở đây
  //    (vd 'mau_db.v_nangsuat_ketoan') + cấp quyền SELECT cho DB user này
  //    → đọc TRỰC TIẾP, tự động, không cần đẩy. View phải có đủ 9 cột:
  //    entry_date, employee_code, employee_name, pha, tranh_rot, mau_rot, sx, note, source.
  'productivity_source' => 'productivity_entries',

  // AI: đọc ảnh/PDF bảng kê (api/ai-ocr.php) + Trợ lý AI chat (api/ai-chat.php)
  // — DÙNG CHUNG 1 khóa. Lấy tại https://console.anthropic.com -> API Keys.
  // Không có khóa thì các nút AI báo lỗi nhẹ nhàng, phần còn lại chạy bình thường.
  'anthropic_api_key' => '',
  'anthropic_model' => 'claude-haiku-4-5-20251001',      // model đọc ảnh/PDF
  // Model cho Trợ lý AI chat. Mặc định Haiku (rẻ, nhanh).
  // Muốn trả lời thông minh hơn: 'claude-sonnet-4-6'.
  'anthropic_chat_model' => 'claude-haiku-4-5-20251001',
];
