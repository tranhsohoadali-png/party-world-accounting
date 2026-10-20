#!/usr/bin/env bash
# ============================================================
# vps-auto-deploy.sh — tự kéo mã nguồn mới về CẢ BA bản cài.
#
# Đặt lịch chạy mỗi 2 phút; push lên GitHub xong là khoảng 2 phút sau
# máy chủ có bản mới, không phải gõ `git pull` tay nữa.
#
# CÀI (chạy một lần, xem hướng dẫn ở cuối file):
#   sudo cp scripts/vps-auto-deploy.sh /root/deploy-dali.sh
#   sudo chmod +x /root/deploy-dali.sh
#
# CHẠY TỪ /root CHỨ KHÔNG PHẢI TỪ TRONG REPO: nếu chạy thẳng file nằm
# trong /var/www/ketoan thì chính `git pull` có thể ghi đè file đang
# chạy giữa chừng — bash đọc script theo từng đoạn nên sẽ chạy lẫn lộn
# nửa bản cũ nửa bản mới.
# ============================================================
set -uo pipefail

CAC_BAN_CAI=(/var/www/ketoan /var/www/ktparty /var/www/kt3d)
LOG=/root/deploy-dali.log
KHOA=/run/deploy-dali.lock
GIU_LOG_DONG=2000

ghi() { echo "[$(date '+%F %T')] $*" >> "$LOG"; }

# Không cho hai lần chạy chồng lên nhau (mạng chậm -> lần sau đã tới giờ).
# Máy thiếu flock thì VẪN CHẠY, chỉ ghi lại một lần: thoát im lặng ở đây đồng
# nghĩa deploy không bao giờ chạy mà không ai biết, tệ hơn là chạy chồng.
if command -v flock >/dev/null 2>&1; then
  exec 9>"$KHOA" || exit 0
  flock -n 9 || exit 0
else
  grep -q 'THIEU_FLOCK' "$LOG" 2>/dev/null || ghi "LƯU Ý THIEU_FLOCK: máy không có lệnh flock, chạy không có khóa chống chồng lượt."
fi

doi_moi=0
for d in "${CAC_BAN_CAI[@]}"; do
  [ -d "$d/.git" ] || continue                    # bản cài chưa dựng thì bỏ qua

  # git từ chối chạy trong thư mục của user khác ("dubious ownership").
  # Webroot thuộc www-data còn cron chạy bằng root -> khai báo một lần cho yên.
  git config --global --get-all safe.directory | grep -qx "$d" \
    || git config --global --add safe.directory "$d"

  truoc=$(git -C "$d" rev-parse --short HEAD 2>/dev/null) || continue
  # --ff-only: chỉ tua tới, KHÔNG bao giờ tự merge. Nếu ai đó sửa tay trên
  # máy chủ làm lệch nhánh thì dừng lại báo lỗi, chứ đừng đẻ ra commit merge.
  ket_qua=$(git -C "$d" pull --ff-only --quiet 2>&1)
  ma_loi=$?
  sau=$(git -C "$d" rev-parse --short HEAD 2>/dev/null)

  if [ $ma_loi -ne 0 ]; then
    # git in ra cả đống dòng "hint:" -> chỉ giữ dòng fatal/error cho nhật ký dễ đọc
    goi=$(printf '%s' "$ket_qua" | grep -iE '^(fatal|error):' | head -1)
    ghi "LỖI  $d: ${goi:-${ket_qua:-git pull thất bại (mã $ma_loi)}}"
    ghi "     -> sửa tay rồi chạy: git -C $d status   (tự động sẽ bỏ qua bản này cho tới khi hết lệch)"
    continue
  fi
  if [ "$truoc" != "$sau" ]; then
    doi_moi=1
    chown -R www-data:www-data "$d" 2>/dev/null || true   # pull bằng root -> trả lại quyền
    ghi "CẬP NHẬT $d: $truoc -> $sau"
  fi
done

if [ "$doi_moi" = 1 ]; then
  ver=$(grep -o "dali-pwa-v[0-9a-z]*" /var/www/ketoan/sw.js 2>/dev/null | head -1)
  ghi "Xong. Phiên bản đang phục vụ: ${ver:-không đọc được}"
fi

# Cắt bớt log cho khỏi phình (chạy 2 phút/lần, mỗi ngày 720 lượt)
if [ -f "$LOG" ] && [ "$(wc -l < "$LOG")" -gt "$GIU_LOG_DONG" ]; then
  tail -n $((GIU_LOG_DONG / 2)) "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"
fi
exit 0

# ============================================================
# CÀI ĐẶT (chạy một lần trên VPS)
#
# 1) Chép script ra /root và cho quyền chạy:
#      cd /var/www/ketoan && git pull
#      sudo cp scripts/vps-auto-deploy.sh /root/deploy-dali.sh && sudo chmod +x /root/deploy-dali.sh
#
# 2) Chạy thử một lần, xem có lỗi không:
#      sudo /root/deploy-dali.sh && sudo cat /root/deploy-dali.log
#
# 3) Đặt lịch 2 phút một lần (lệnh này thay thế dòng cũ nếu đã có,
#    chạy lại nhiều lần cũng không sinh ra hai dòng trùng):
#      ( sudo crontab -l 2>/dev/null | grep -v deploy-dali ; echo "*/2 * * * * /root/deploy-dali.sh >/dev/null 2>&1" ) | sudo crontab -
#
# 4) Kiểm tra đã vào lịch chưa:
#      sudo crontab -l | grep deploy-dali
#
# XEM NHẬT KÝ:      sudo tail -20 /root/deploy-dali.log
# TẠM DỪNG TỰ ĐỘNG: sudo crontab -l | grep -v deploy-dali | sudo crontab -
# ============================================================
