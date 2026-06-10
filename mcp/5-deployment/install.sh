#!/bin/bash
# ============================================================
# INSTALLATION SCRIPT
# Chạy trên VPS Hostinger 72.62.76.78 (Ubuntu 24.04)
# SSH vào VPS với quyền sudo trước khi chạy
# ============================================================
set -euo pipefail

echo "🚀 Party World Accounting - MCP Integration Installer"
echo "====================================================="
echo ""

# Kiểm tra prerequisites
command -v php >/dev/null    || { echo "❌ PHP chưa cài"; exit 1; }
command -v mysql >/dev/null  || { echo "❌ MariaDB chưa cài"; exit 1; }
command -v python3 >/dev/null || { echo "❌ Python3 chưa cài"; exit 1; }
command -v nginx >/dev/null  || { echo "❌ Nginx chưa cài"; exit 1; }

# Thư mục source (sau khi unzip package)
SRC_DIR="$(cd "$(dirname "$0")/.." && pwd)"
echo "📁 Source: $SRC_DIR"

# ====== 1. DATABASE ======
echo ""
echo "📊 [1/5] Tạo schema database..."
# Tự đọc thông tin CSDL từ config.php của app DALI (đã cài ở Bước B)
CONFIG="/var/www/ketoan/api/config.php"
if [ -f "$CONFIG" ]; then
  DB_NAME=$(php -r '$c=require $argv[1]; echo $c["db_name"];' "$CONFIG")
  DB_USER=$(php -r '$c=require $argv[1]; echo $c["db_user"];' "$CONFIG")
  DB_PASS=$(php -r '$c=require $argv[1]; echo $c["db_pass"];' "$CONFIG")
  echo "    Dùng CSDL từ config.php: DB=$DB_NAME, user=$DB_USER"
else
  read -p "    Tên DB [partyworld]: " DB_NAME;  DB_NAME=${DB_NAME:-partyworld}
  read -p "    DB user [pwuser]: " DB_USER;     DB_USER=${DB_USER:-pwuser}
  read -sp "    DB password: " DB_PASS;         echo ""
fi

mysql -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" < "$SRC_DIR/1-database/schema.sql"
echo "    ✅ Schema OK"

# Sinh API token random
API_TOKEN=$(python3 -c "import secrets; print(secrets.token_hex(32))")
mysql -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "
  UPDATE api_tokens
  SET token = '$API_TOKEN'
  WHERE name = 'claude-mcp-default';
"
echo "    🔑 API Token đã tạo: ${API_TOKEN:0:8}...${API_TOKEN: -4}"
echo "    (Toàn bộ token được lưu vào /root/.ketoan-mcp-token)"
echo "$API_TOKEN" | sudo tee /root/.ketoan-mcp-token >/dev/null
sudo chmod 600 /root/.ketoan-mcp-token

# ====== 2. PHP API ======
echo ""
echo "📦 [2/5] Cài PHP API endpoints..."
sudo mkdir -p /var/www/ketoan/api/v1
sudo cp -r "$SRC_DIR/2-php-api/api/"* /var/www/ketoan/api/
sudo chown -R www-data:www-data /var/www/ketoan/api
sudo chmod -R 755 /var/www/ketoan/api

# API dùng chung config.php của app DALI (helpers.php tự đọc) -> không cần ghi ENV
echo "    ✅ PHP API OK (dùng chung CSDL với app DALI qua config.php)"

# ====== 3. NGINX ROUTES ======
echo ""
echo "🌐 [3/5] Cấu hình Nginx..."
NGINX_CONF="/etc/nginx/sites-available/ketoan.tranhdali.vn"
if [ ! -f "$NGINX_CONF" ]; then
    echo "    ⚠️  Không tìm thấy $NGINX_CONF — bạn cần copy thủ công nginx-snippet.conf vào server block."
else
    if ! grep -q "location ~ \^/api/v1" "$NGINX_CONF"; then
        # Chèn snippet vào trước dòng "}" cuối của server block
        sudo cp "$NGINX_CONF" "$NGINX_CONF.bak.$(date +%s)"
        sudo sed -i '/^}/i \
\
# === Party World API + MCP (auto-added) ===' "$NGINX_CONF"
        cat "$SRC_DIR/2-php-api/nginx-snippet.conf" | sudo tee -a "$NGINX_CONF" >/dev/null
        echo "    ✅ Đã chèn route /api/v1 và /mcp vào nginx config"
    else
        echo "    ℹ️  Routes đã tồn tại, skip"
    fi
    sudo nginx -t && sudo systemctl reload nginx
fi

# ====== 4. MCP SERVER ======
echo ""
echo "🐍 [4/5] Cài Python MCP server..."
sudo mkdir -p /opt/mcp-ketoan-dali
sudo cp "$SRC_DIR/3-mcp-server/server.py" /opt/mcp-ketoan-dali/
sudo cp "$SRC_DIR/3-mcp-server/requirements.txt" /opt/mcp-ketoan-dali/

cd /opt/mcp-ketoan-dali
sudo python3 -m venv venv
sudo ./venv/bin/pip install --upgrade pip -q
sudo ./venv/bin/pip install -r requirements.txt -q
echo "    ✅ Python venv + dependencies OK"

# Systemd service
SVC_FILE="$SRC_DIR/3-mcp-server/systemd/mcp-ketoan-dali.service"
sudo sed "s|TOKEN_HERE|$API_TOKEN|g" "$SVC_FILE" | sudo tee /etc/systemd/system/mcp-ketoan-dali.service >/dev/null
sudo chown -R www-data:www-data /opt/mcp-ketoan-dali
sudo systemctl daemon-reload
sudo systemctl enable mcp-ketoan-dali
sudo systemctl restart mcp-ketoan-dali
sleep 2
if sudo systemctl is-active --quiet mcp-ketoan-dali; then
    echo "    ✅ MCP service đang chạy"
else
    echo "    ❌ MCP service không khởi động được. Xem log:"
    sudo journalctl -u mcp-ketoan-dali -n 30 --no-pager
    exit 1
fi

# ====== 5. SMOKE TEST ======
echo ""
echo "🧪 [5/5] Test API..."
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" -X GET \
    "https://ketoan.tranhdali.vn/api/v1/entries?limit=1" \
    -H "Authorization: Bearer $API_TOKEN")
if [ "$HEALTH" = "200" ]; then
    echo "    ✅ API trả về 200 OK"
else
    echo "    ⚠️  API trả về HTTP $HEALTH — kiểm tra Nginx + PHP-FPM"
fi

MCP_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "https://ketoan.tranhdali.vn/mcp")
echo "    MCP endpoint HTTP $MCP_HEALTH"

echo ""
echo "✅ HOÀN TẤT!"
echo ""
echo "📋 Bước tiếp theo:"
echo "  1. Import data hiện có:"
echo "       export PW_API_BASE='https://ketoan.tranhdali.vn/api/v1'"
echo "       export PW_API_TOKEN='$API_TOKEN'"
echo "       python3 $SRC_DIR/4-data-migration/import.py"
echo ""
echo "  2. Đăng ký MCP với Claude.ai:"
echo "       https://claude.ai → Settings → Connectors → Add custom"
echo "       URL:   https://ketoan.tranhdali.vn/mcp"
echo "       Token: $API_TOKEN"
echo ""
echo "  3. Token này đã được lưu tại: /root/.ketoan-mcp-token"
echo "     Lưu ra notebook an toàn rồi xoá file đó."
echo ""
