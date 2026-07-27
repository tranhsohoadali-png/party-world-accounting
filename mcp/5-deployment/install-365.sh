#!/usr/bin/env bash
# ============================================================
#  install-365.sh — Dung instance MCP thu hai: "Chi tieu 365" (Bong bay Party)
#
#  Chay SAU khi da hoan tat B1 (tao DB ketoan365 + user kt365 + token).
#  Yeu cau 2 file bi mat da ton tai tren VPS:
#     /root/.kt365-db-pass     mat khau MySQL user kt365
#     /root/.kt365-api-token   token cho /api365/v1
#
#  Script KHONG in bi mat ra man hinh. KHONG sua cau hinh cua ban 1.
#  Cach dung:  sudo bash /var/www/ketoan/mcp/5-deployment/install-365.sh
# ============================================================
set -euo pipefail

WEBROOT=/var/www/ketoan
API_DIR=$WEBROOT/api365
OPT_DIR=/opt/mcp-365
DB=ketoan365
DB_USER=kt365
PORT=8766
SNIPPET=/etc/nginx/snippets/mcp-365.conf

ok()   { printf '  \033[32mOK\033[0m  %s\n' "$1"; }
info() { printf '\n\033[1m== %s\033[0m\n' "$1"; }
die()  { printf '  \033[31mLOI\033[0m %s\n' "$1" >&2; exit 1; }

run_tests() {
  info "KIEM TRA"
  c1=$(curl -s -o /dev/null -w '%{http_code}' "https://ketoan.tranhdali.vn/api365/v1/reports/summary" || true)
  c2=$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $API_TOKEN" \
       "https://ketoan.tranhdali.vn/api365/v1/reports/summary" || true)
  c3=$(curl -s -o /dev/null -w '%{http_code}' -X POST "http://127.0.0.1:$PORT/mcp" \
       -H 'Accept: text/event-stream, application/json' -H 'Content-Type: application/json' --data '{}' || true)
  printf '  /api365 khong token : %s   (mong doi 401)\n' "$c1"
  printf '  /api365 co token    : %s   (mong doi 200)\n' "$c2"
  printf '  loopback :%s/mcp    : %s   (mong doi KHAC 404)\n' "$PORT" "$c3"
  echo
  echo "  So 365 phai TRONG (expense = 0):"
  curl -s -H "Authorization: Bearer $API_TOKEN" \
    "https://ketoan.tranhdali.vn/api365/v1/reports/summary?from=2026-01-01&to=2026-12-31" || true
  echo
  printf '  Ban 1 (so tranh) phai van song: '
  systemctl is-active mcp-ketoan-dali
}

[ "$(id -u)" -eq 0 ] || die "Phai chay bang sudo/root."

# ---------------------------------------------------------------
info "0. Kiem tra dieu kien (B1 da xong chua)"

[ -s /root/.kt365-db-pass ]   || die "Thieu/rong /root/.kt365-db-pass — chua lam B1."
[ -s /root/.kt365-api-token ] || die "Thieu/rong /root/.kt365-api-token — chua lam B1."
ok "2 file bi mat da co"

DB_PASS=$(cat /root/.kt365-db-pass)
API_TOKEN=$(cat /root/.kt365-api-token)

mysql -e "USE $DB;" 2>/dev/null || die "CSDL $DB chua ton tai — chua lam B1."
NTAB=$(mysql -N -B "$DB" -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$DB';")
[ "$NTAB" -ge 6 ] || die "CSDL $DB chi co $NTAB bang (can >=6) — chua nap schema.sql."
ok "CSDL $DB co $NTAB bang"

NTOK=$(mysql -N -B "$DB" -e "SELECT COUNT(*) FROM api_tokens WHERE is_active=1;")
[ "$NTOK" -ge 1 ] || die "Chua co token active nao trong $DB.api_tokens."
ok "Token active: $NTOK"

# Scope phai dung dinh dang <tai_nguyen>:<hanh_dong> — require_token() so khop CHINH XAC.
# Sai dinh dang (vd 'read,write') se ra 403 "Token lacks scope" du token hop le.
SCOPES=$(mysql -N -B "$DB" -e "SELECT scopes FROM api_tokens WHERE is_active=1 LIMIT 1;")
SCOPES=${SCOPES// /}
NEED="entries:write,entries:read,inventory:write,inventory:read,counterparties:write,counterparties:read,reports:read"
for s in ${NEED//,/ }; do
  case ",$SCOPES," in
    *",$s,"*) ;;
    *) die "Token thieu scope '$s'. Sua bang:
       mysql $DB -e \"UPDATE api_tokens SET scopes='$NEED' WHERE is_active=1;\"" ;;
  esac
done
ok "Token du 7 scope"

for f in "$WEBROOT/mcp/2-php-api/api/helpers.php" "$WEBROOT/mcp/3-mcp-server/server.py" \
         "$WEBROOT/mcp/3-mcp-server/requirements.txt"; do
  [ -f "$f" ] || die "Thieu $f — chay 'cd $WEBROOT && git pull' truoc."
done
ok "Ma nguon mcp/ day du trong webroot"

PHP_SOCK=$(ls /run/php/*-fpm.sock 2>/dev/null | head -1) || true
[ -n "${PHP_SOCK:-}" ] || die "Khong tim thay socket PHP-FPM trong /run/php/."
ok "Socket PHP: $PHP_SOCK"

# Che do chi kiem tra: khong cai lai gi ca
if [ "${1:-}" = "--test" ]; then
  run_tests
  exit 0
fi

# ---------------------------------------------------------------
info "1. (B2) Nhan ban tang PHP API -> $API_DIR"

mkdir -p "$API_DIR/v1"
cp "$WEBROOT/mcp/2-php-api/api/helpers.php" "$API_DIR/"
cp "$WEBROOT"/mcp/2-php-api/api/v1/*.php     "$API_DIR/v1/"

cat > "$API_DIR/config.php" <<EOF
<?php
return [
    'db_host' => 'localhost',
    'db_name' => '$DB',
    'db_user' => '$DB_USER',
    'db_pass' => '$DB_PASS',
];
EOF

chown -R www-data:www-data "$API_DIR"
chmod 640 "$API_DIR/config.php"
ok "Da chep API + tao config.php (tro sang $DB)"

sudo -u www-data php -r '
$c = require "'"$API_DIR"'/config.php";
new PDO("mysql:host={$c["db_host"]};dbname={$c["db_name"]}", $c["db_user"], $c["db_pass"]);
' || die "PHP (user www-data) KHONG ket noi duoc $DB. Kiem tra mat khau/quyen GRANT."
ok "PHP chay bang www-data ket noi duoc $DB"

# ---------------------------------------------------------------
info "2. (B4) Dung service Python thu hai (cong $PORT)"

mkdir -p "$OPT_DIR"
cp "$WEBROOT/mcp/3-mcp-server/server.py"        "$OPT_DIR/"
cp "$WEBROOT/mcp/3-mcp-server/requirements.txt" "$OPT_DIR/"

if [ ! -x "$OPT_DIR/venv/bin/python3" ]; then
  python3 -m venv "$OPT_DIR/venv"
fi
"$OPT_DIR/venv/bin/pip" install -U pip -q
"$OPT_DIR/venv/bin/pip" install -r "$OPT_DIR/requirements.txt" -q
ok "venv + thu vien da san sang"

touch /var/log/mcp-365.log /var/log/mcp-365.error.log
chown www-data:www-data /var/log/mcp-365*.log
chown -R www-data:www-data "$OPT_DIR"

cat > /etc/systemd/system/mcp-365.service <<EOF
[Unit]
Description=MCP Server - Chi tieu 365 (Bong bay Party)
After=network.target mariadb.service
Wants=network-online.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=$OPT_DIR
Environment="PW_API_BASE=https://ketoan.tranhdali.vn/api365/v1"
Environment="PW_API_TOKEN=$API_TOKEN"
# Danh tinh so: in vao MOI ket qua doc/ghi de ghi nham cua lo ra ngay.
Environment="PW_BOOK_NAME=Chi tiêu 365 — Bóng bay Party"
Environment="PW_BOOK_SLUG=chitieu-365"
Environment="HOME=$OPT_DIR"
Environment="XDG_CACHE_HOME=/tmp"
ExecStart=$OPT_DIR/venv/bin/uvicorn server:app --host 127.0.0.1 --port $PORT
Restart=on-failure
RestartSec=5s
StandardOutput=append:/var/log/mcp-365.log
StandardError=append:/var/log/mcp-365.error.log

NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=/var/log

[Install]
WantedBy=multi-user.target
EOF

chmod 600 /etc/systemd/system/mcp-365.service
systemctl daemon-reload
systemctl enable --now mcp-365 >/dev/null

for i in $(seq 1 15); do
  ss -ltn 2>/dev/null | grep -q "127.0.0.1:$PORT" && break
  sleep 1
done
ss -ltn | grep -q "127.0.0.1:$PORT" \
  || die "Service mcp-365 khong nghe cong $PORT. Xem: journalctl -u mcp-365 -n 40 --no-pager"
ok "mcp-365 dang chay, nghe 127.0.0.1:$PORT"

# ---------------------------------------------------------------
info "3. (B3+B5) Tao snippet nginx"

mkdir -p /etc/nginx/snippets
cat > "$SNIPPET" <<EOF
# Sinh boi install-365.sh — instance MCP thu hai (Chi tieu 365 / Bong bay)
# Nhung vao server block 443 cua ketoan.tranhdali.vn bang:  include snippets/mcp-365.conf;

location ~ ^/api365/v1/(entries|inventory|counterparties|reports)(/.*)?\$ {
    fastcgi_split_path_info ^/api365/v1/(entries|inventory|counterparties|reports)(/.*)?\$;
    fastcgi_param PATH_INFO \$fastcgi_path_info;
    fastcgi_param SCRIPT_FILENAME $API_DIR/v1/\$1.php;
    include fastcgi_params;
    fastcgi_pass unix:$PHP_SOCK;
}

location /mcp-365 {
    allow 160.79.104.0/21;     # outbound IPv4 cua Anthropic
    allow 2607:6bc0::/48;      # IPv6
    allow 127.0.0.1;
    deny all;

    # CO hau to /mcp — FastMCP mount o /mcp, phai doi tien to /mcp-365 -> /mcp
    proxy_pass http://127.0.0.1:$PORT/mcp;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;

    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 86400s;
    proxy_send_timeout 86400s;
    proxy_set_header Authorization \$http_authorization;
}
EOF
ok "Da tao $SNIPPET"

# ---------------------------------------------------------------
CONF=$(grep -rl 'server_name .*ketoan\.tranhdali\.vn' /etc/nginx/sites-available/ 2>/dev/null | head -1) || true

info "CON MOT BUOC THU CONG (co y de an toan)"
cat <<EOF

Script KHONG tu sua server block dang phuc vu so tranh. Ban tu them 1 dong:

  1) Mo file:      ${CONF:-/etc/nginx/sites-available/<file cua ketoan.tranhdali.vn>}
  2) Tim khoi:     server { ... listen 443 ... server_name ketoan.tranhdali.vn ... }
                   (dung khoi dang chua 'location /mcp')
  3) Them vao trong khoi do (canh 'location /mcp'), DUNG DUONG DAN TUYET DOI:

         include $SNIPPET;

  4) XAC NHAN include da vao cau hinh HIEU LUC (buoc hay bi bo qua):

         sudo nginx -T 2>/dev/null | grep -c "location /mcp-365"

     Phai ra 1. Ra 0 = dong include chua co tac dung, DUNG reload, quay lai buoc 1.
     Luu y: 'nginx -t' chi kiem CU PHAP nen no pass ca khi ban quen chen gi.
     Chi 'nginx -T' moi cho thay cau hinh thuc su dang chay.

  5) Nap lai:

         sudo nginx -t && sudo systemctl reload nginx

     CHI reload khi 'nginx -t' bao 'test is successful'.

Sau do chay kiem tra:

  sudo bash $WEBROOT/mcp/5-deployment/install-365.sh --test

EOF
