#!/usr/bin/env bash
# ============================================================
# setup-install.sh — dựng MỘT BẢN CÀI MỚI của app kế toán trên VPS.
#
# Mỗi bản cài = một webroot riêng + một CSDL riêng + một tên miền con,
# nhưng dùng CHUNG mã nguồn (cùng repo). Đã dùng cho ketoan, ktparty;
# script này gom các bước lặp lại đó vào một chỗ để khỏi dán tay từng
# câu lệnh dài vào terminal web — dán tay rất dễ sai dấu nháy.
#
#   Dùng:  sudo bash scripts/setup-install.sh <ten> [tenmien]
#   VD:    sudo bash scripts/setup-install.sh kt3d
#          -> /var/www/kt3d, CSDL kt3d, kt3d.tranhdali.vn
#
# Script LÀM: sinh mật khẩu CSDL, tạo CSDL + user, clone mã nguồn,
#             ghi api/config.php, tạo server block nginx (HTTP), reload.
# Script KHÔNG làm: xin SSL (chạy certbot sau), tạo bảng (mở install.php),
#             đụng vào bản cài nào đang có.
#
# An toàn: dừng ngay nếu thư mục/CSDL/cấu hình nginx đã tồn tại —
#          không bao giờ ghi đè bản cài đang chạy.
# ============================================================
set -euo pipefail

REPO='https://github.com/tranhsohoadali-png/party-world-accounting.git'
DOMAIN_GOC='tranhdali.vn'

loi()  { echo "✖ $*" >&2; exit 1; }
ok()   { echo "✔ $*"; }
buoc() { echo; echo "── $* ──"; }

[ "$(id -u)" -eq 0 ] || loi "Phải chạy bằng sudo: sudo bash $0 <ten>"

TEN="${1:-}"
[ -n "$TEN" ] || loi "Thiếu tên bản cài. VD: sudo bash $0 kt3d"
# Tên dùng làm tên CSDL + user MySQL + thư mục + tên miền con -> giới hạn cho chắc
echo "$TEN" | grep -qE '^[a-z][a-z0-9]{1,15}$' \
  || loi "Tên '$TEN' không hợp lệ: chỉ chữ thường và số, bắt đầu bằng chữ, 2–16 ký tự."

TENMIEN="${2:-$TEN.$DOMAIN_GOC}"
WEBROOT="/var/www/$TEN"
PASSFILE="/root/.$TEN-db-pass"
NGINXCONF="/etc/nginx/sites-available/$TENMIEN"

echo "Sắp dựng bản cài mới:"
echo "  tên miền : $TENMIEN"
echo "  webroot  : $WEBROOT"
echo "  CSDL     : $TEN (user '$TEN'@'localhost')"
echo "  nginx    : $NGINXCONF"

buoc "Kiểm tra trước khi động vào gì"
[ -e "$WEBROOT" ]   && loi "$WEBROOT đã tồn tại. Dừng để khỏi đè lên bản cài đang chạy."
[ -e "$NGINXCONF" ] && loi "$NGINXCONF đã tồn tại. Dừng."
mysql -N -B -e "SHOW DATABASES LIKE '$TEN';" | grep -q . \
  && loi "CSDL '$TEN' đã tồn tại. Dừng — xóa tay nếu chắc chắn muốn làm lại."
command -v git >/dev/null     || loi "Chưa có git."
command -v nginx >/dev/null   || loi "Chưa có nginx."
command -v mysql >/dev/null   || loi "Chưa có mysql."
# DNS phải trỏ đúng máy này, nếu không certbot ở bước sau chắc chắn trượt
IP_MAY="$(curl -s --max-time 10 https://api.ipify.org || true)"
IP_TEN="$(getent hosts "$TENMIEN" | awk '{print $1}' | head -1 || true)"
if [ -z "$IP_TEN" ]; then
  echo "⚠ $TENMIEN chưa phân giải được. Vẫn dựng tiếp, nhưng certbot sẽ trượt cho tới khi DNS lan xong."
elif [ -n "$IP_MAY" ] && [ "$IP_TEN" != "$IP_MAY" ]; then
  echo "⚠ $TENMIEN đang trỏ $IP_TEN, còn máy này là $IP_MAY. Kiểm tra lại bản ghi DNS."
else
  ok "DNS: $TENMIEN -> $IP_TEN (khớp máy này)"
fi
# Socket PHP-FPM: tự dò thay vì đoán phiên bản
FPM_SOCK="$(ls -1 /run/php/php*-fpm.sock 2>/dev/null | sort -V | tail -1 || true)"
[ -n "$FPM_SOCK" ] || loi "Không tìm thấy socket PHP-FPM trong /run/php/."
ok "PHP-FPM: $FPM_SOCK"

buoc "Mật khẩu CSDL"
# Sinh TRÊN MÁY CHỦ, chmod 600, không bao giờ in ra màn hình
if [ -s "$PASSFILE" ]; then
  ok "Dùng lại mật khẩu sẵn có ở $PASSFILE"
else
  openssl rand -base64 24 > "$PASSFILE"
  chmod 600 "$PASSFILE"
  ok "Đã sinh mật khẩu mới, lưu ở $PASSFILE (chmod 600)"
fi
DBPASS="$(cat "$PASSFILE")"

buoc "Tạo CSDL và user"
mysql <<SQL
CREATE DATABASE \`$TEN\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '$TEN'@'localhost' IDENTIFIED BY '$DBPASS';
ALTER USER '$TEN'@'localhost' IDENTIFIED BY '$DBPASS';
GRANT ALL PRIVILEGES ON \`$TEN\`.* TO '$TEN'@'localhost';
FLUSH PRIVILEGES;
SQL
ok "CSDL '$TEN' + user '$TEN'@'localhost'"

buoc "Tải mã nguồn"
git clone --quiet "$REPO" "$WEBROOT"
chown -R www-data:www-data "$WEBROOT"
ok "Đã clone vào $WEBROOT ($(cd "$WEBROOT" && git rev-parse --short HEAD))"

buoc "Ghi api/config.php"
# Tạo file RỖNG với quyền chặt trước, rồi mới đổ nội dung vào ('cat >' giữ nguyên
# quyền và chủ sở hữu). Làm ngược lại thì có một khoảnh khắc file đã chứa mật khẩu
# mà quyền còn 644 — ai cũng đọc được.
install -o www-data -g www-data -m 640 /dev/null "$WEBROOT/api/config.php"
cat > "$WEBROOT/api/config.php" <<PHP
<?php
/* Sinh tự động bởi scripts/setup-install.sh — bản cài "$TEN" */
return [
  'db_host' => 'localhost',
  'db_name' => '$TEN',
  'db_user' => '$TEN',
  'db_pass' => '$DBPASS',
  'db_charset' => 'utf8mb4',
];
PHP
php -l "$WEBROOT/api/config.php" >/dev/null || loi "config.php sinh ra bị sai cú pháp PHP."
ok "config.php hợp lệ (mật khẩu không in ra màn hình)"

buoc "Cấu hình nginx"
cat > "$NGINXCONF" <<NGINX
server {
    listen 80;
    server_name $TENMIEN;
    root $WEBROOT;
    index index.html;

    location ~ \.php\$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:$FPM_SOCK;
    }
    location / { try_files \$uri \$uri/ =404; }

    # Không để lộ cấu hình / thư mục git qua web
    location ~ /\.git           { deny all; }
    location = /api/config.php  { deny all; }
}
NGINX
ln -sf "$NGINXCONF" /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
ok "nginx đã nhận $TENMIEN (mới chỉ HTTP)"

buoc "Xong phần tự động"
echo "Còn 3 việc phải làm tay:"
echo
echo "1) Xin chứng chỉ SSL:"
echo "     sudo certbot --nginx -d $TENMIEN"
echo
echo "2) Tạo bảng — mở MỘT LẦN trên trình duyệt:"
echo "     https://$TENMIEN/api/install.php"
echo "   Kiểm lại:  sudo mysql $TEN -e 'SHOW TABLES;'   (mong đợi 4 bảng)"
echo
echo "3) Đăng nhập, ĐỔI MẬT KHẨU quản trị ngay, rồi vào Người dùng thêm tài khoản."
echo
echo "Từ nay nhớ deploy cả bản này:"
echo "     cd $WEBROOT && git pull"
