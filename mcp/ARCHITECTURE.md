# Kiến trúc tích hợp Claude ↔ Party World (ketoan.tranhdali.vn)

## Mục tiêu
Cho phép upload hóa đơn vào Claude → tự động extract → đẩy thẳng vào sổ kế toán Party World, không cần thao tác trung gian.

## Sơ đồ luồng

```
┌──────────────────┐
│  User chụp HĐ    │
│  gửi lên Claude  │
└────────┬─────────┘
         │ (image/text)
         ▼
┌──────────────────────────────┐
│   Claude.ai (vision + LLM)   │
│   - Đọc ảnh                  │
│   - Trích: ngày, mô tả, tiền │
│   - Phân loại tự động        │
└────────┬─────────────────────┘
         │ MCP tool call
         │ (HTTPS, JSON-RPC)
         ▼
┌──────────────────────────────┐
│  MCP Server (Python)         │  ← chạy trên VPS Hostinger
│  ketoan.tranhdali.vn/mcp     │     systemd service
│  - Validate                  │     port 8765 (internal)
│  - Add API key auth          │
└────────┬─────────────────────┘
         │ HTTPS + Bearer token
         ▼
┌──────────────────────────────┐
│  Party World REST API (PHP)  │  ← cùng VPS, mở rộng repo có sẵn
│  ketoan.tranhdali.vn/api/v1  │
│  - Auth check                │
│  - Dedup hash                │
│  - INSERT vào MariaDB        │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│  MariaDB (Party World DB)    │
│  - accounting_entries        │
│  - inventory_items           │
│  - counterparties            │
│  - api_tokens                │
└──────────────────────────────┘
```

## 4 module sổ kế toán

| Module | Loại entry | Mô tả |
|---|---|---|
| **Chi** (Expense) | `expense` | Tiền ra: NVL, lương, thuế, dịch vụ |
| **Thu** (Income) | `income` | Tiền vào: Shopee, Fahasa, bán lẻ |
| **Công nợ phải thu** | `receivable` | Khách hàng nợ |
| **Công nợ phải trả** | `payable` | Mình nợ nhà cung cấp |
| **Tồn kho** | `inventory_movement` | Nhập/xuất kho có liên kết item_code |

Dùng **1 bảng chung** `accounting_entries` với cột `entry_type` để tận dụng pattern JSON document của Party World — không phải tạo 4 bảng riêng.

## Bảo mật

1. **API token** lưu trong MariaDB (bảng `api_tokens`), Bearer auth.
2. **MCP server** chỉ chấp nhận request từ Claude.ai (whitelist IP optional).
3. **Dedup hash**: SHA256 của `entry_type|date|amount|description_normalized` → chống insert trùng khi cùng 1 hóa đơn được gửi 2 lần.
4. Toàn bộ traffic qua HTTPS (Let's Encrypt cert hiện có).
5. **Audit log**: cột `source` ghi nhận entry đến từ `mcp`, `manual`, hay `import`.

## Triển khai trên VPS hiện tại (72.62.76.78)

| Thành phần | Đặt tại | Service |
|---|---|---|
| API PHP | `/var/www/ketoan/api/v1/` | PHP-FPM (đã có) |
| MCP Server | `/opt/mcp-ketoan-dali/` | systemd: `mcp-ketoan-dali.service` |
| Nginx | `/etc/nginx/sites-available/` | Reload sau khi thêm route `/mcp` và `/api/v1` |
| DB | MariaDB hiện tại | Thêm 4 bảng mới |

## Đăng ký với Claude.ai

Sau khi MCP server chạy ổn ở `https://ketoan.tranhdali.vn/mcp`:
1. Vào Claude.ai → Settings → Connectors → "Add custom connector"
2. URL: `https://ketoan.tranhdali.vn/mcp`
3. Token: API token tạo ở bước cài đặt
4. Save → bật connector → mỗi chat mới Claude sẽ thấy các tool: `add_expense`, `add_income`, `add_receivable`, `add_payable`, `add_inventory_movement`, `list_recent_entries`, etc.

## Phạm vi MVP đợt này

✅ DB schema đầy đủ 4 module  
✅ PHP REST API: CRUD entries, inventory, counterparties  
✅ MCP server: 7 tool đầy đủ cho 4 module  
✅ Migrate 140+ dòng chi phí Q1-Q2/2026 hiện có  
⏸ Frontend Party World hiển thị data MCP — để sau, vì frontend đã có sẵn, chỉ cần thêm vài view  
⏸ Báo cáo P&L tự động — phase 2
