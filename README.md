# 🌿 DALI — Phần mềm kế toán

Phần mềm kế toán cho **DALI — Tô điểm cuộc sống**. Chạy được cả 2 chế độ: mở trực tiếp `index.html` (offline) hoặc triển khai trên server (PHP + MySQL) để nhiều người dùng chung dữ liệu.

## ✨ Tính năng

- **Tổng quan**: chọn kỳ (tháng/quý/năm), biểu đồ doanh thu, dòng tiền, chi phí, nợ theo hạn nợ (quá hạn / trong hạn).
- **Biểu đồ**: doanh thu & lợi nhuận, cơ cấu tài sản, top hàng/khách (tự vẽ SVG, không thư viện ngoài).
- **Bán hàng**: quy trình, báo giá, đơn đặt hàng, hóa đơn bán, trả lại, giảm giá — tự trừ kho, theo dõi công nợ, in chứng từ.
- **Mua hàng**: quy trình, đơn mua, phiếu nhập, trả lại, giảm giá — tự tăng kho, công nợ phải trả.
- **Tiền**: phiếu thu / chi, số dư quỹ tiền mặt & ngân hàng.
- **Danh mục**: hàng hóa, khách hàng (form nhiều tab), nhà cung cấp, nhân viên, nhóm, đơn vị tính, kho, khoản mục chi phí, điều khoản thanh toán.
- **Báo cáo**: lãi/lỗ, doanh thu & mua hàng theo mặt hàng, tồn kho, Nhập–Xuất–Tồn, công nợ, sổ quỹ, sổ chi tiết công nợ từng đối tượng. In & xuất Excel.
- **Sao lưu**: xuất / phục hồi dữ liệu bằng file JSON.

## 🚀 Cách dùng

Nhấp đúp **`index.html`** để mở bằng trình duyệt (Chrome / Edge / Cốc Cốc...).

> Dữ liệu được lưu trong `localStorage` của trình duyệt trên máy. Hãy **Sao lưu** định kỳ ở mục *Dữ liệu & Sao lưu*.

## 🛠️ Công nghệ

- Vanilla JavaScript (không framework, không build step)
- Lưu dữ liệu: `localStorage`
- Biểu đồ & logo: SVG/CSS tự vẽ

## 📁 Cấu trúc

```
index.html              Trang chính
assets/
  styles.css            Giao diện (theme thương hiệu DALI - xanh lá)
  utils.js              Tiện ích (định dạng, ngày, xuất Excel)
  db.js                 Lớp dữ liệu + hạch toán (localStorage)
  components.js         Modal, bảng, form, tab
  modules*.js           Các phân hệ nghiệp vụ
  reports.js            Báo cáo
  app.js               Khung ứng dụng & điều hướng
  logo.svg / banner.svg Nhận diện thương hiệu
```
