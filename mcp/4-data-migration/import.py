"""
Migrate dữ liệu chi phí Q1-Q2/2026 từ Excel hiện có lên Party World API.

Sử dụng:
    export PW_API_BASE="https://ketoan.tranhdali.vn/api/v1"
    export PW_API_TOKEN="your-token-here"
    python import.py

Chạy LẠI an toàn: dedup_hash chống insert trùng — đã có thì bỏ qua.
"""
import os
import json
import sys
import time
import httpx

API_BASE = os.getenv("PW_API_BASE", "https://ketoan.tranhdali.vn/api/v1")
TOKEN = os.getenv("PW_API_TOKEN") or sys.exit("Set PW_API_TOKEN")

HEADERS = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": "application/json",
}


def categorize(description: str) -> str:
    """Tự động phân loại danh mục dựa trên từ khóa trong mô tả."""
    d = description.lower()
    rules = [
        ("Lương", ["lương", "luong", "ts lương"]),
        ("Thuế-BHXH", ["bhxh", "thuế", "thue", "kế toán", "ke toan", "bảo hiểm"]),
        ("Vận chuyển", ["xe", "ship", "vận chuyển", "phí gửi", "cước"]),
        ("Tiện ích", ["điện", "dien", "nước", "nuoc", "mạng", "mang"]),
        ("Thiết bị-Sửa chữa", ["sửa", "sua", "đầu in", "máy", "phụ kiện", "cáp",
                                "dây curoa", "vòng bi", "linh kiện"]),
        ("Phần mềm", ["claude", "midjourney", "illustrator", "phần mềm", "domain",
                       "matbao", "subscription"]),
        ("NVL canvas", ["canvas", "vải", "vai"]),
        ("NVL sơn", ["sơn", "son"]),
        ("NVL khung", ["khung"]),
        ("NVL phụ liệu", ["khay", "bút", "but", "tem", "ghim", "túi bóng",
                          "màng co", "mang co", "dây", "chiếu"]),
        ("Văn phòng phẩm", ["giấy", "giay", "khăn giấy", "barcode"]),
        ("Tài chính", ["lãi vay", "lai vay"]),
    ]
    for cat, kws in rules:
        if any(k in d for k in kws):
            return cat
    return "Khác"


# ============ DATA Q1-Q2/2026 ============
ENTRIES = [
    # T3/2026
    ("2026-03-21", "Mua dây buộc tranh", 54000),
    ("2026-03-21", "Phí vào bến xe gửi hàng NS Tiến Thọ", 20000),
    ("2026-03-21", "Nhập Sơn trắng 3D", 8640000),
    ("2026-03-22", "Vải canvas", 5400000),
    ("2026-03-23", "Sửa máy tính", 1790000),
    ("2026-03-24", "Canvas Kansai", 10000000),
    ("2026-03-24", "Đóng gói", 1933200),
    ("2026-03-24", "BHXH", 30720000),
    ("2026-03-24", "Khăn giấy", 160000),
    ("2026-03-24", "Đóng thuế", 4554000),
    ("2026-03-24", "Tiền lãi vay", 1200000),
    ("2026-03-25", "Tiền khay", 14000000),
    ("2026-03-25", "Tiền lãi vay + trả dần", 6000000),
    ("2026-03-27", "Tiền vải kansai", 9078589),
    ("2026-03-27", "Tiền vải asean", 9700236),
    ("2026-03-27", "Tiền sơn phước", 30000000),
    ("2026-03-27", "Giấy ăn", 400000),
    ("2026-03-27", "Xăng", 495000),
    ("2026-03-27", "TT Lương Hương", 6673177),
    # T4/2026
    ("2026-04-03", "Trả cước xe sơn", 2600000),
    ("2026-04-07", "Mạng", 235000),
    ("2026-04-07", "Linh kiện máy", 350000),
    ("2026-04-07", "Cờ lê", 280000),
    ("2026-04-10", "Túi bóng", 680000),
    ("2026-04-10", "Tiền bảo hiểm", 750000),
    ("2026-04-10", "Phí gửi hợp đồng", 55000),
    ("2026-04-10", "Tiền khung", 75135906),
    ("2026-04-11", "Tiền chiếu", 90000),
    ("2026-04-20", "Điện", 3390453),
    ("2026-04-20", "Màng co", 1205280),
    ("2026-04-20", "(chưa rõ mục) - giá trị 4.553.280", 4553280),
    ("2026-04-20", "Canvas kansai", 7621182),
    ("2026-04-20", "Tem", 12636000),
    ("2026-04-30", "Sơn", 50000000),
    ("2026-04-29", "Canvas", 1401138),
    ("2026-04-29", "Thuế", 1275658),
    ("2026-04-29", "(chưa rõ mục) - giá trị 56.305.363", 56305363),
    ("2026-04-29", "(chưa rõ mục) - giá trị 491.306", 491306),
    ("2026-04-29", "Bút", 13000000),
    ("2026-04-29", "Phí nộp thuế", 45000),
    # T5/2026
    ("2026-05-01", "Sửa máy", 700000),
    ("2026-05-01", "Thay vòng bi + sửa máy", 250000),
    ("2026-05-01", "Mua dây curoa", 200000),
    ("2026-05-08", "Đặt khay + bút", 30200000),
    ("2026-05-08", "Canvas Asean", 19733868),
    ("2026-05-08", "Màng co", 2792394),
    ("2026-05-08", "Khay", 25001082),
    ("2026-05-08", "Phần mềm thuế", 3493000),
    ("2026-05-15", "Tiền lương", 51069722),
    ("2026-05-20", "Tiền điện", 4076186),
    ("2026-05-20", "Khung Thái Nguyên", 13000000),
    ("2026-05-21", "Đầu in i3200 + 4 cáp (HĐ BH296837)", 28400000),
    ("2026-05-21", "Sửa máy in", 500000),
    ("2026-05-22", "Vé xe", 13000),
    ("2026-05-22", "Tiền mạng", 350000),
    ("2026-05-22", "Tiền nước", 32000),
    ("2026-05-22", "Ghim", 1850000),
    ("2026-05-22", "Phụ kiện máy căng khung", 261000),
    ("2026-05-22", "Dây chằng", 26000),
    ("2026-05-26", "TT lương cô Thim - dịch vụ KT thuế", 12000000),
    ("2026-05-26", "Khay", 27000000),
    ("2026-05-27", "Claude.AI subscription (22 USD)", 604495),
    ("2026-05-28", "Dây film 180pl-4.5m (HĐ BH297023)", 600000),
    ("2026-05-28", "Mua TK Midjourney", 250000),
    ("2026-05-28", "Dung môi + Nước rửa (HĐ Thuận Thiên - VAT 8%)", 3628800),
    ("2026-05-29", "Cài đặt phần mềm Illustrator", 150000),
    ("2026-05-29", "Giấy in barcode", 304000),
    ("2026-05-30", "Xy lanh khí nén mini robot STAR MCD-20 (x2)", 255200),
    ("2026-05-30", "Túi bóng kính OPP 12,5x20,5 (1KG x5)", 490445),
    ("2026-05-30", "Đầu nối khí nhựa PC 10-03 (x3)", 74475),
    ("2026-05-30", "Gia hạn domain tranhdali.vn 3 năm + DNSSEC (MatBao)", 1524760),
    ("2026-05-30", "Nâng cấp Claude.AI (89.80 USD)", 2467433),
    # T6/2026
    ("2026-06-02", "Giấy A3 + Pin thang máy (Art Design and Communication JSC)", 1071600),
    ("2026-06-04", "Vải (TT cho Đỗ Thị Thu Trang - BIDV)", 36995000),
    ("2026-06-04", "Sửa máy tính (HACOM)", 2399000),
    ("2026-06-04", "TT bút và khay (CTCP TM&DV LUZ - TPBank)", 14210400),
    ("2026-06-04", "Thuê xe vận chuyển", 200000),
    ("2026-06-08", "TT hóa đơn Hnabp4676", 235000),
    ("2026-06-08", "Tiền dán khay (cô Xuyến - Đoàn Thị Xuyến)", 20388000),
    ("2026-06-09", "Thay mực + phụ kiện máy in (Hoàng Đức Anh)", 1120000),
    ("2026-06-10", "Dây cáp màn hình máy tính (HACOM)", 99000),
]


def main():
    print(f"🚀 Bắt đầu migration {len(ENTRIES)} entries lên {API_BASE}")
    print(f"   Token: {TOKEN[:8]}...{TOKEN[-4:]}\n")

    stats = {"created": 0, "duplicate": 0, "error": 0}

    with httpx.Client(timeout=15.0) as client:
        for i, (date_str, desc, amount) in enumerate(ENTRIES, 1):
            body = {
                "entry_type": "expense",
                "entry_date": date_str,
                "description": desc,
                "amount": amount,
                "category": categorize(desc),
                "source": "import",
            }
            try:
                r = client.post(f"{API_BASE}/entries", json=body, headers=HEADERS)
                r.raise_for_status()
                result = r.json()
                if result.get("duplicate"):
                    stats["duplicate"] += 1
                    print(f"  [{i:3d}/{len(ENTRIES)}] ⚠️  Trùng: {desc[:50]}")
                else:
                    stats["created"] += 1
                    print(f"  [{i:3d}/{len(ENTRIES)}] ✅ id={result['id']:>5} | {body['category']:20s} | {desc[:50]}")
            except Exception as e:
                stats["error"] += 1
                print(f"  [{i:3d}/{len(ENTRIES)}] ❌ Lỗi: {e}")
            time.sleep(0.05)  # tránh flood API

    total_amount = sum(amount for _, _, amount in ENTRIES)
    print(f"\n📊 Kết quả:")
    print(f"   • Tạo mới:    {stats['created']}")
    print(f"   • Đã tồn tại: {stats['duplicate']}")
    print(f"   • Lỗi:        {stats['error']}")
    print(f"   • Tổng tiền:  {total_amount:,.0f}đ")


if __name__ == "__main__":
    main()
