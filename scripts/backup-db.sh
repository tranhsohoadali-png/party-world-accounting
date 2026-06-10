#!/bin/bash
# ============================================================
# backup-db.sh — Sao luu CSDL DALI (partyworld) hang ngay
# Nen gzip, giu N ngay gan nhat. Chay bang cron tren VPS.
# ============================================================
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/root/db-backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
CONFIG="/var/www/ketoan/api/config.php"
mkdir -p "$BACKUP_DIR"

# Lay thong tin CSDL tu config.php cua app DALI (neu co), fallback root socket
if [ -f "$CONFIG" ] && command -v php >/dev/null; then
  DB=$(php -r '$c=require $argv[1]; echo $c["db_name"];' "$CONFIG")
  DB_USER=$(php -r '$c=require $argv[1]; echo $c["db_user"];' "$CONFIG")
  DB_PASS=$(php -r '$c=require $argv[1]; echo $c["db_pass"];' "$CONFIG")
  AUTH=(-u "$DB_USER" -p"$DB_PASS")
else
  DB="partyworld"
  AUTH=()
fi

TS=$(date +%F_%H%M)
FILE="$BACKUP_DIR/${DB}-${TS}.sql.gz"

mysqldump --single-transaction --quick "${AUTH[@]}" "$DB" | gzip > "$FILE"
echo "$(date '+%F %T')  Backup OK: $FILE ($(du -h "$FILE" | cut -f1))"

# Xoa ban sao luu cu hon KEEP_DAYS ngay
find "$BACKUP_DIR" -name "${DB}-*.sql.gz" -mtime +"$KEEP_DAYS" -delete
echo "$(date '+%F %T')  Da don ban sao luu cu hon $KEEP_DAYS ngay. Tong: $(ls -1 "$BACKUP_DIR"/${DB}-*.sql.gz 2>/dev/null | wc -l) ban."
