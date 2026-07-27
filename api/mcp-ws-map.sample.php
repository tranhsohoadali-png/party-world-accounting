<?php
/* ============================================================
   mcp-ws-map.php — Bản đồ CƠ SỞ KINH DOANH -> CSDL "Sổ Claude (MCP)"
   ------------------------------------------------------------
   Vì sao cần file này:
   Các bảng của sổ MCP (accounting_entries / inventory_items / counterparties)
   KHÔNG có cột workspace. Nên mỗi cơ sở muốn có sổ riêng thì phải chạy một
   instance MCP riêng, trỏ vào một CSDL riêng. File này nói cho web app biết
   cơ sở nào đọc CSDL nào.

   Cách dùng:
     1. Copy file này thành  api/mcp-ws-map.php  (bản thật, không lên Git)
     2. Điền: id cơ sở  =>  đường dẫn tuyệt đối tới file config.php của sổ đó

   Quy tắc:
   - Cơ sở #1 LUÔN dùng CSDL của app (không cần khai báo ở đây).
   - Cơ sở có khai báo  -> đọc CSDL tương ứng.
   - Cơ sở KHÔNG khai báo -> app báo "chưa có sổ MCP riêng" và hiện sổ TRỐNG.
     (Cố ý: thà trống còn hơn hiện nhầm sổ của cơ sở khác.)
   - KHÔNG có file này -> chỉ cơ sở #1 có sổ, các cơ sở khác đều trống.
   ============================================================ */

return [
    // id cơ sở => đường dẫn file config.php của CSDL sổ MCP tương ứng
    // Ví dụ: cơ sở #2 "Bóng bay Party" dùng instance "Chi tieu 365":
    // 2 => '/var/www/ketoan/api365/config.php',
];
