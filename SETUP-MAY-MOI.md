# ⚙️ Thiết lập máy phát triển mới — Phần mềm kế toán DALI

Checklist chuyển sang máy tính mới để tiếp tục phát triển phần mềm.

> **Kiến trúc tóm tắt:** App vanilla JS + PHP/MySQL, chạy 2 chế độ.
> - **Máy dev (máy này):** phát triển ở **chế độ OFFLINE** — mở bằng server tĩnh, dữ liệu lưu trong trình duyệt (localStorage). **KHÔNG cần cài PHP/MySQL tại máy.**
> - **Máy chủ thật:** VPS Hostinger (`ketoan.tranhdali.vn`) chạy PHP+MySQL — **độc lập với máy tính**, không bị ảnh hưởng khi đổi máy.
> - Mọi thứ đồng bộ qua GitHub. Đổi máy = clone lại repo + đăng nhập GitHub.

---

## A. Bắt buộc — để code & deploy được

### 1. Cài Git
Tải tại <https://git-scm.com/download/win> → cài mặc định.
Sau khi cài, đặt tên/email (1 lần):
```bash
git config --global user.name "tranhsohoadali-png"
git config --global user.email "tranhsohoadali@gmail.com"
```

### 2. Clone mã nguồn
Repo **public** → clone/pull **không cần token**. Clone vào thư mục nào cũng được; chỉ cần **nhớ đường dẫn đã chọn** (nó quyết định tên thư mục trí nhớ Claude Code — xem mục D).
```powershell
git clone https://github.com/tranhsohoadali-png/party-world-accounting.git "E:\Kế toán"
```
> Toàn bộ code + tài liệu đã đưa lên Git sẽ về theo bước này.
>
> 📍 **Đường dẫn đang dùng thực tế:** `E:\Kế toán`. Nếu bạn clone chỗ khác, thay đường dẫn ở mọi lệnh phía dưới cho khớp.

### 3. Đăng nhập GitHub để PUSH
Lần `git push` **đầu tiên**, Windows sẽ bật cửa sổ đăng nhập GitHub (hoặc hỏi dán **Personal Access Token** `party-world`, hết hạn **27/09/2026**).
- **Tự đăng nhập bằng tài khoản của mình** — clone/pull không cần token, chỉ **push** mới cần.
- Token **KHÔNG nằm trong file nào** của dự án; máy cũ lưu ở *Windows Credential Manager*. Máy mới phải đăng nhập lại từ đầu.

### 4. (Khuyến nghị) Cài Node.js
Tải bản LTS tại <https://nodejs.org> → dùng để kiểm lỗi cú pháp (`node --check`) và mở server xem trước (`npx http-server`).
> App **không cần build**. Nếu không muốn cài Node, dùng luôn `dev-server.ps1` (thuần PowerShell, có sẵn trong repo).

---

## B. File LOCAL không nằm trong Git — chép tay (USB/ổ mây) nếu muốn giữ

Các file dưới đây bị `.gitignore` (không lên GitHub) nên **clone sẽ KHÔNG có**. Copy thủ công từ máy cũ nếu cần:

| File / thư mục | Là gì | Có cần? |
|---|---|---|
| `auto-push.ps1`, `register-schedule.ps1`, `CAI-LICH-MOI-GIO.bat`, `DAY LEN GITHUB.bat` | Tự động commit + push theo lịch | Chỉ nếu dùng tự-đẩy |
| `deploy/` (+ `HƯỚNG DẪN TRIỂN KHAI.txt`) | Tài liệu bàn giao, cấu hình nginx, runbook MCP, **lệnh & chi tiết deploy VPS** | Nên giữ (tham khảo + deploy) |
| `.claude/launch.json` | Cấu hình server xem trước (cổng 8123) | Dễ tạo lại, tùy |

> ✅ Máy dev **không có** `api/config.php` hay `api/ai-key*` (đó là mật khẩu CSDL / khóa AI — chỉ nằm trên VPS). Nên **không có mật khẩu nào cần mang theo** cho việc dev offline.

---

## C. KHÔNG cần đụng tới
- **VPS + cơ sở dữ liệu kế toán:** nằm trên Hostinger, tách biệt hoàn toàn với máy tính. Đổi máy không ảnh hưởng. Dữ liệu thật + bản backup vẫn an toàn trên server.

---

## D. (Tùy chọn) Giữ "trí nhớ" của Claude Code cho dự án
Claude Code lưu trí nhớ dự án ở `C:\Users\<USER>\.claude\projects\<MÃ_ĐƯỜNG_DẪN>\memory\`.

**`<MÃ_ĐƯỜNG_DẪN>` sinh ra từ đường dẫn dự án** — thay mọi ký tự không phải chữ/số bằng dấu `-`:

| Đường dẫn dự án | Mã thư mục trí nhớ |
|---|---|
| `D:\phần mềm kế toán` (máy cũ) | `D--ph-n-m-m-k--to-n` |
| `E:\Kế toán` (máy hiện tại) | `E--K--to-n` |

Để mang trí nhớ sang máy mới, chép **nội dung bên trong** thư mục `memory\` của máy cũ vào thư mục `memory\` của máy mới:
```powershell
# Ví dụ: từ USB (ổ F:) sang máy hiện tại
Copy-Item "F:\memory\*" "C:\Users\Admin\.claude\projects\E--K--to-n\memory\" -Recurse -Force
```
> ⚠️ Chép **ruột** của `memory\`, đừng để lồng thành `memory\memory\`.
> Đổi đường dẫn dự án ⇒ mã thư mục đổi theo ⇒ nhớ chép trí nhớ sang mã mới, nếu không Claude Code sẽ khởi động với trí nhớ rỗng.

---

## E. Xem trước app (offline) trên máy mới
Chọn 1 trong 2 cách, rồi mở <http://localhost:8123>:
```powershell
# Cách 1 — PowerShell thuần (không cần Node):
powershell -ExecutionPolicy Bypass -File dev-server.ps1
```
```bash
# Cách 2 — nếu đã cài Node:
npx http-server . -p 8123 -c-1
```

---

## F. Kiểm tra "đã sẵn sàng" (sau khi clone)
- [ ] `git remote -v` → hiện đúng URL repo.
- [ ] `git pull` chạy được (kéo bản mới nhất).
- [ ] Mở `http://localhost:8123` → phần mềm chạy ở chế độ offline (có dữ liệu mẫu).
- [ ] Sửa 1 chữ nhỏ → `git commit` → **`git push` thử** → đăng nhập GitHub thành công.
- [ ] Deploy thử lên VPS (lệnh nằm trong `deploy/` — **không để trong repo công khai**).

---

## G. Deploy lên máy chủ (nhắc lại)
Sau mỗi lần `git push`, cập nhật VPS bằng lệnh trong **`deploy/`** (chạy trên *Terminal của panel Hostinger*). Lệnh + IP + đường dẫn **cố ý không để trong repo public** vì lý do bảo mật. Nếu cần, mở tài liệu trong `deploy/` hoặc hỏi Claude.

> ⚠️ **Đừng bao giờ** commit `api/config.php`, `api/ai-key*`, hay token GitHub lên repo — chúng đã nằm trong `.gitignore`, giữ nguyên như vậy.
