#!/usr/bin/env bash
# ============================================================
#  install-ktparty.sh — Tach so Bong bay ra ban cai rieng
#  ktparty.tranhdali.vn  (webroot rieng + CSDL rieng)
#
#  Lam: B2 (CSDL) + B3 (ma nguon/cau hinh) + B5 (tao bang + di tru du lieu)
#  KHONG lam: B1 (DNS), B4 (nginx+SSL), B7 (xoa co so #2 o ban cu)
#             -> ba viec do co y de thu cong vi dung vao cau hinh dang chay.
#
#  Chay:  sudo bash /var/www/ketoan/mcp/5-deployment/install-ktparty.sh
#  Kiem:  sudo bash /var/www/ketoan/mcp/5-deployment/install-ktparty.sh --check
# ============================================================
set -euo pipefail

SRC_DB=partyworld           # CSDL ban cu
SRC_WS=2                    # id co so Bong bay trong ban cu
NEW_DB=ktparty
NEW_USER=ktparty
NEW_ROOT=/var/www/ktparty
OLD_ROOT=/var/www/ketoan
MCP_CFG=$OLD_ROOT/api365/config.php     # cau hinh CSDL ketoan365 (so MCP Bong bay)
PASS_FILE=/root/.ktparty-db-pass
REPO=https://github.com/tranhsohoadali-png/party-world-accounting.git

ok()   { printf '  \033[32mOK\033[0m  %s\n' "$1"; }
info() { printf '\n\033[1m== %s\033[0m\n' "$1"; }
die()  { printf '  \033[31mLOI\033[0m %s\n' "$1" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "Phai chay bang sudo/root."

kiem_tra() {
  info "KIEM TRA"
  printf '  CSDL %s      : ' "$NEW_DB"; mysql -e "USE $NEW_DB;" 2>/dev/null && echo "co" || echo "CHUA CO"
  printf '  User MySQL      : '; mysql -N -B -e "SELECT COUNT(*) FROM mysql.user WHERE user='$NEW_USER';"
  printf '  File mat khau   : '; [ -s "$PASS_FILE" ] && wc -c < "$PASS_FILE" || echo "CHUA CO"
  printf '  Webroot         : '; [ -d "$NEW_ROOT" ] && echo "co" || echo "CHUA CO"
  printf '  config.php      : '; [ -f "$NEW_ROOT/api/config.php" ] && echo "co" || echo "CHUA CO"
  printf '  mcp-ws-map.php  : '; [ -f "$NEW_ROOT/api/mcp-ws-map.php" ] && echo "co" || echo "CHUA CO"
  if mysql -e "USE $NEW_DB;" 2>/dev/null; then
    echo "  --- Du lieu trong $NEW_DB ---"
    mysql "$NEW_DB" -e "SELECT (SELECT COUNT(*) FROM users) AS tai_khoan, (SELECT COUNT(*) FROM app_data) AS so_sach, (SELECT IFNULL(LENGTH(data),0) FROM app_data WHERE id=1) AS kich_thuoc_so, (SELECT COUNT(*) FROM app_data_history) AS lich_su;" 2>/dev/null || echo "  (chua co bang)"
  fi
  echo
  echo "  Ban cu ($SRC_DB):"
  mysql "$SRC_DB" -e "SELECT id, LENGTH(data) AS kich_thuoc, version, updated_at FROM app_data;"
  exit 0
}
[ "${1:-}" = "--check" ] && kiem_tra

# ---------------------------------------------------------------
info "0. Kiem tra dieu kien"
mysql -e "USE $SRC_DB;" 2>/dev/null || die "Khong thay CSDL $SRC_DB."
N=$(mysql -N -B "$SRC_DB" -e "SELECT COUNT(*) FROM app_data WHERE id=$SRC_WS;")
[ "$N" = "1" ] || die "Khong thay app_data id=$SRC_WS trong $SRC_DB (co so Bong bay)."
SZ=$(mysql -N -B "$SRC_DB" -e "SELECT IFNULL(LENGTH(data),0) FROM app_data WHERE id=$SRC_WS;")
[ "$SZ" -gt 100 ] || die "So cua co so #$SRC_WS rong ($SZ byte) — dung lai, kiem tra lai id."
ok "Co so #$SRC_WS trong $SRC_DB: $SZ byte du lieu"
mysql -e "USE ketoan365;" 2>/dev/null || die "Khong thay CSDL ketoan365 (so MCP Bong bay)."
[ -f "$MCP_CFG" ] || die "Khong thay $MCP_CFG — can no de tro so MCP."
ok "ketoan365 + $MCP_CFG san sang"

# ---------------------------------------------------------------
info "1. (B2) CSDL rieng + user"
mysql -e "CREATE DATABASE IF NOT EXISTS $NEW_DB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
if [ ! -s "$PASS_FILE" ]; then
  openssl rand -base64 24 > "$PASS_FILE"; chmod 600 "$PASS_FILE"
  ok "Da sinh mat khau moi -> $PASS_FILE"
else
  ok "Dung lai mat khau da co o $PASS_FILE"
fi
P=$(cat "$PASS_FILE")
mysql <<SQL
CREATE USER IF NOT EXISTS '$NEW_USER'@'localhost' IDENTIFIED BY '$P';
ALTER USER '$NEW_USER'@'localhost' IDENTIFIED BY '$P';
GRANT ALL PRIVILEGES ON $NEW_DB.* TO '$NEW_USER'@'localhost';
GRANT SELECT ON ketoan365.* TO '$NEW_USER'@'localhost';
FLUSH PRIVILEGES;
SQL
ok "CSDL $NEW_DB + user $NEW_USER (co quyen doc ketoan365)"

# ---------------------------------------------------------------
info "2. (B3) Ma nguon + cau hinh"
if [ -d "$NEW_ROOT/.git" ]; then
  git -C "$NEW_ROOT" pull --ff-only >/dev/null 2>&1 || true
  ok "Webroot da co -> da pull ban moi"
else
  git clone -q "$REPO" "$NEW_ROOT"
  ok "Da clone ma nguon -> $NEW_ROOT"
fi

cat > "$NEW_ROOT/api/config.php" <<EOF
<?php
return [
    'db_host' => 'localhost',
    'db_name' => '$NEW_DB',
    'db_user' => '$NEW_USER',
    'db_pass' => '$P',
    'db_charset' => 'utf8mb4',
];
EOF

cat > "$NEW_ROOT/api/mcp-ws-map.php" <<EOF
<?php
// Ban ktparty: co so #1 LA Bong bay; so Claude (MCP) cua no nam o CSDL ketoan365
return [
    1 => '$MCP_CFG',
];
EOF

chown -R www-data:www-data "$NEW_ROOT"
chmod 640 "$NEW_ROOT/api/config.php" "$NEW_ROOT/api/mcp-ws-map.php"
ok "config.php + mcp-ws-map.php da tao"

sudo -u www-data php -r '
$c = require "'"$NEW_ROOT"'/api/config.php";
new PDO("mysql:host={$c["db_host"]};dbname={$c["db_name"]}", $c["db_user"], $c["db_pass"]);
' || die "PHP (www-data) khong ket noi duoc $NEW_DB."
ok "PHP chay bang www-data ket noi duoc $NEW_DB"

# ---------------------------------------------------------------
info "3. (B5) Tao bang + di tru du lieu"
DA_CO=$(mysql -N -B "$NEW_DB" -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$NEW_DB';")
if [ "$DA_CO" -lt 4 ]; then
  mysqldump --no-data "$SRC_DB" users app_data workspaces app_data_history | mysql "$NEW_DB"
  ok "Da tao 4 bang tu cau truc cua $SRC_DB"
else
  ok "Bang da ton tai ($DA_CO bang) — bo qua buoc tao"
fi

mkdir -p /root/db-backups
BK=/root/db-backups/partyworld-truoc-tach-ktparty-$(date +%F-%H%M).sql
mysqldump "$SRC_DB" > "$BK"
ok "Da sao luu ban cu -> $BK"

CO_SO=$(mysql -N -B "$NEW_DB" -e "SELECT COUNT(*) FROM app_data WHERE id=1;")
if [ "$CO_SO" = "0" ]; then
  mysql <<SQL
INSERT INTO $NEW_DB.users SELECT * FROM $SRC_DB.users
  ON DUPLICATE KEY UPDATE username = VALUES(username);
INSERT INTO $NEW_DB.app_data (id, data, version, updated_at, updated_by)
  SELECT 1, data, version, updated_at, updated_by FROM $SRC_DB.app_data WHERE id = $SRC_WS;
INSERT INTO $NEW_DB.workspaces (id, name) VALUES (1, 'Bong bay Party')
  ON DUPLICATE KEY UPDATE name = VALUES(name);
INSERT INTO $NEW_DB.app_data_history (data, version, updated_by, app_data_id, saved_at)
  SELECT data, version, updated_by, 1, saved_at FROM $SRC_DB.app_data_history WHERE app_data_id = $SRC_WS;
SQL
  ok "Da chuyen so sach + tai khoan sang $NEW_DB"
else
  ok "$NEW_DB da co so sach roi — KHONG ghi de (chay lai an toan)"
fi

# ---------------------------------------------------------------
info "KET QUA"
mysql "$NEW_DB" -e "SELECT (SELECT COUNT(*) FROM users) AS tai_khoan, (SELECT LENGTH(data) FROM app_data WHERE id=1) AS kich_thuoc_so, (SELECT COUNT(*) FROM app_data_history) AS ban_lich_su, (SELECT name FROM workspaces WHERE id=1) AS ten_co_so;"
echo
echo "So sanh voi ban cu (phai KHOP kich thuoc):"
mysql "$SRC_DB" -e "SELECT id, LENGTH(data) AS kich_thuoc FROM app_data WHERE id IN (1,$SRC_WS);"

cat <<EOF

CON LAI 2 VIEC THU CONG:

  B4. nginx + SSL cho ktparty.tranhdali.vn
      sudo tee /etc/nginx/sites-available/ktparty.tranhdali.vn ... (xem runbook)
      sudo certbot --nginx -d ktparty.tranhdali.vn

  B7. Xoa co so #2 khoi ban cu — CHI sau khi da doi chieu xong tren web.
      Script nay CO Y khong lam, vi khong hoan tac duoc.

EOF
