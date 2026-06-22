# Party World Accounting × Claude MCP Integration

**Mục tiêu:** Cho phép upload hóa đơn vào Claude → tự động đẩy thẳng vào sổ kế toán Party World tại `ketoan.tranhdali.vn`, không cần thao tác trung gian.

## 📦 Package contents

```
ketoan-mcp-pkg/
├── ARCHITECTURE.md              # Tài liệu kiến trúc chi tiết
├── README.md                    # File bạn đang đọc
├── 1-database/
│   └── schema.sql               # Tạo 4 bảng mới + 1 trigger + dữ liệu khởi tạo
├── 2-php-api/
│   ├── api/
│   │   ├── helpers.php          # DB, auth, dedup helpers
│   │   └── v1/
│   │       ├── entries.php      # CRUD entries (chi/thu/công nợ)
│   │       ├── inventory.php    # CRUD inventory items
│   │       ├── counterparties.php  # CRUD NCC + khách hàng
│   │       └── reports.php      # Báo cáo summary / by-month / by-category
│   └── nginx-snippet.conf       # Route Nginx
├── 3-mcp-server/
│   ├── server.py                # FastMCP server (14 tools)
│   ├── requirements.txt         # Python deps
│   └── systemd/
│       └── mcp-ketoan-dali.service
├── 4-data-migration/
│   └── import.py                # Đẩy 80+ dòng chi phí Q1-Q2 hiện có lên DB
├── 5-deployment/
│   └── install.sh               # Master installer (chạy 1 lần là xong)
└── 6-test/
    └── test-curl.sh             # 8 smoke test bằng curl
```

## 🔧 Triển khai trên VPS Hostinger (72.62.76.78)

### Bước 1 — Upload package lên VPS

```bash
# Trên máy bạn (Windows)
scp -r ketoan-mcp-pkg root@72.62.76.78:/tmp/

# Hoặc dùng GitHub:
# Push package vào branch mcp-integration của party-world-accounting
# Trên VPS: git clone https://github.com/tranhsohoadali-png/party-world-accounting.git
```

### Bước 2 — Chạy installer

```bash
ssh root@72.62.76.78
cd /tmp/ketoan-mcp-pkg/5-deployment
chmod +x install.sh
./install.sh
```

Installer sẽ:
1. Tạo 4 bảng + trigger trong MariaDB
2. Sinh API token random và lưu vào `/root/.ketoan-mcp-token`
3. Cài PHP endpoints vào `/var/www/ketoan/api/v1/`
4. Cài MCP Python service vào `/opt/mcp-ketoan-dali/`
5. Cấu hình Nginx routes `/api/v1/*` và `/mcp`
6. Bật systemd service `mcp-ketoan-dali`
7. Test 1 GET request để xác nhận hoạt động

### Bước 3 — Migrate dữ liệu hiện có

```bash
export PW_API_BASE="https://ketoan.tranhdali.vn/api/v1"
export PW_API_TOKEN="$(cat /root/.ketoan-mcp-token)"
python3 /tmp/ketoan-mcp-pkg/4-data-migration/import.py
```

→ Đẩy 80+ dòng chi phí Q1-Q2/2026 lên DB. Chạy lại nhiều lần an toàn (dedup tự động).

### Bước 4 — Đăng ký MCP với Claude.ai

1. Vào https://claude.ai → Settings → Connectors → **Add custom connector**
2. URL: `https://ketoan.tranhdali.vn/mcp`
3. Authentication: Bearer token, dán token từ `/root/.ketoan-mcp-token`
4. Save → bật connector

Từ giờ trong mọi chat mới, Claude sẽ thấy 14 tool sau:

| Tool | Chức năng |
|---|---|
| `add_expense` | Ghi nhận chi phí (có `payment_method`; kèm `inventory_item_code`+`quantity` → tự nhập kho) |
| `add_income` | Ghi nhận doanh thu (có `payment_method`; kèm `inventory_item_code`+`quantity` → tự xuất kho) |
| `add_receivable` | Ghi công nợ phải thu (KH nợ ta) |
| `add_payable` | Ghi công nợ phải trả (ta nợ NCC) |
| `add_inventory_movement` | Nhập/xuất kho |
| `create_inventory_item` | Tạo item tồn kho mới |
| `update_entry` | 🆕 Sửa entry đã ghi (ngày/tiền/mô tả/danh mục/payment_method/ghi chú) |
| `delete_entry` | 🆕 Xóa entry ghi nhầm |
| `get_cash_position` | 🆕 Số dư tiền mặt + tiền gửi ngân hàng hiện tại |
| `set_cash_opening` | 🆕 Đặt số dư đầu kỳ tiền mặt/ngân hàng (lấy từ MISA) |
| `list_recent_entries` | Liệt kê entry gần đây |
| `get_summary_report` | P&L tóm tắt |
| `list_outstanding_debts` | Công nợ chưa tất toán |
| `search_inventory` | Tìm item tồn kho |

> **Nâng cấp 2026-06:** trước khi dùng các tool 🆕, chạy migration:
> ```bash
> mysql -u <db_user> -p <db_name> < /var/www/ketoan/mcp/1-database/migration-2026-06-upgrades.sql
> sudo systemctl restart mcp-ketoan-dali
> ```
> Rồi đặt số dư đầu kỳ 1 lần: gọi `set_cash_opening(cash=..., bank=..., as_of="2026-01-01")`.

## 🧪 Kiểm tra hoạt động

```bash
export PW_API_TOKEN="$(cat /root/.ketoan-mcp-token)"
chmod +x /tmp/ketoan-mcp-pkg/6-test/test-curl.sh
/tmp/ketoan-mcp-pkg/6-test/test-curl.sh
```

8 test cases sẽ chạy lần lượt: tạo entry, test dedup, list, báo cáo, tạo item, nhập kho...

## 🔐 Bảo mật

- **API token**: 32-byte hex random, lưu trong DB và `/root/.ketoan-mcp-token` (chmod 600)
- **Bearer auth** bắt buộc cho mọi endpoint API
- **Dedup hash**: SHA256(type|date|amount|description) ngăn insert trùng
- **Audit log**: bảng `api_audit_log` ghi mọi POST/PUT/DELETE
- **HTTPS only**: dùng cert Let's Encrypt sẵn có của ketoan.tranhdali.vn
- **MCP service** chạy bằng user `www-data`, không có quyền root

## 🐛 Troubleshooting

| Triệu chứng | Cách xử lý |
|---|---|
| `502 Bad Gateway` ở `/mcp` | `sudo systemctl status mcp-ketoan-dali` → xem `journalctl -u mcp-ketoan-dali` |
| `401 Unauthorized` ở API | Kiểm tra token, header phải là `Authorization: Bearer xxx` |
| `500` ở PHP API | Xem `/var/log/nginx/ketoan.tranhdali.vn.error.log` và `/var/log/php8.3-fpm.log` |
| Trigger không cập nhật tồn kho | Kiểm tra `inventory_item_id` đã được resolve đúng từ `inventory_item_code` chưa |
| Migration nhiều dòng "Trùng" | Bình thường — entry đã có sẵn trong DB |

## 🗺️ Roadmap phase 2 (sau khi MVP chạy ổn)

- [ ] Frontend Party World: trang xem entries với filter + chart
- [ ] OCR PDF/ảnh hóa đơn tự động (tận dụng vision của Claude)
- [ ] Xuất báo cáo Excel/PDF cho cô Thim hạch toán
- [ ] Tự động phân loại chi phí bằng ML từ description
- [ ] Webhook chiều ngược: khi DB cập nhật → notify qua Telegram bot
- [ ] Sync 2 chiều với Google Sheets cũ (cho người không dùng Claude)
- [ ] Backup tự động MariaDB sang Google Drive (cron mysqldump)

## 📞 Hỗ trợ

Nếu cài lỗi, gửi log của:
```bash
sudo journalctl -u mcp-ketoan-dali -n 50
sudo tail -50 /var/log/nginx/ketoan.tranhdali.vn.error.log
sudo systemctl status mcp-ketoan-dali php8.3-fpm nginx
```

Vào chat với Claude kèm output trên, sẽ debug được ngay.

---

**Lưu ý quan trọng:** Bạn chưa đăng ký Anthropic API key — nhưng để Claude.ai gọi MCP server qua HTTPS, **KHÔNG cần API key**. Chỉ cần MCP server có HTTPS endpoint công khai là claude.ai connect được.
