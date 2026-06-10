#!/bin/bash
# Test các API endpoints. Set token trước khi chạy:
#   export PW_API_TOKEN="..."
set -e

API="${PW_API_BASE:-https://ketoan.tranhdali.vn/api/v1}"
TOKEN="${PW_API_TOKEN:?Set PW_API_TOKEN}"
H="Authorization: Bearer $TOKEN"

pretty() { python3 -m json.tool 2>/dev/null || cat; }

echo "════════ 1. Tạo expense ════════"
curl -s -X POST "$API/entries" -H "$H" -H "Content-Type: application/json" -d '{
  "entry_type": "expense",
  "entry_date": "2026-06-10",
  "description": "Test API - Mua bút bi văn phòng",
  "amount": 50000,
  "category": "Văn phòng phẩm"
}' | pretty

echo ""
echo "════════ 2. Tạo expense lần 2 (test dedup) ════════"
curl -s -X POST "$API/entries" -H "$H" -H "Content-Type: application/json" -d '{
  "entry_type": "expense",
  "entry_date": "2026-06-10",
  "description": "Test API - Mua bút bi văn phòng",
  "amount": 50000,
  "category": "Văn phòng phẩm"
}' | pretty

echo ""
echo "════════ 3. List entries 7 ngày gần nhất ════════"
curl -s -G "$API/entries" -H "$H" \
  --data-urlencode "from=2026-06-03" \
  --data-urlencode "to=2026-06-10" \
  --data-urlencode "limit=5" | pretty

echo ""
echo "════════ 4. Báo cáo summary cả năm ════════"
curl -s -G "$API/reports/summary" -H "$H" | pretty

echo ""
echo "════════ 5. Phân tích theo danh mục ════════"
curl -s -G "$API/reports/by-category" -H "$H" \
  --data-urlencode "type=expense" \
  --data-urlencode "from=2026-03-01" | pretty

echo ""
echo "════════ 6. Tạo inventory item test ════════"
curl -s -X POST "$API/inventory" -H "$H" -H "Content-Type: application/json" -d '{
  "code": "TEST-BVB11",
  "name": "Tranh BVB.11 thử nghiệm",
  "unit": "cái",
  "category": "Tranh thành phẩm",
  "initial_qty": 10
}' | pretty

echo ""
echo "════════ 7. Nhập kho test ════════"
curl -s -X POST "$API/entries" -H "$H" -H "Content-Type: application/json" -d '{
  "entry_type": "inventory_in",
  "entry_date": "2026-06-10",
  "description": "Nhập 5 BVB.11 từ xưởng",
  "amount": 0,
  "inventory_item_code": "TEST-BVB11",
  "quantity": 5
}' | pretty

echo ""
echo "════════ 8. Kiểm tra tồn ════════"
curl -s -G "$API/inventory" -H "$H" --data-urlencode "q=TEST-BVB11" | pretty
