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
Repo **public** → clone/pull **không cần token**. Nên clone vào **đúng đường dẫn cũ** `D:\phần mềm kế toán` (để khớp cấu hình & trí nhớ Claude Code — xem mục D).
```bash
cd /d D:\
git clone https://github.com/tranhsohoadali-png/party-world-accounting.git "phần mềm kế toán"
```
> Toàn bộ code + tài liệu đã đưa lên Git sẽ về theo bước này.

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
Để Claude Code trên máy mới nhớ nguyên bối cảnh dự án (kiến trúc, định dạng file, cách deploy…), chép thư mục:
```
C:\Users\<TÊN_USER_CŨ>\.claude\projects\D--ph-n-m-m-k--to-n\memory\
```
sang vị trí tương ứng dưới `.claude\projects\` của user trên máy mới.
> Giữ **nguyên đường dẫn dự án `D:\phần mềm kế toán`** để Claude Code khớp đúng thư mục `D--ph-n-m-m-k--to-n`.

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
