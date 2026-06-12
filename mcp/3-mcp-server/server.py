"""
MCP Server cho Party World Accounting
======================================
Server này chạy trên VPS Hostinger, làm cầu nối giữa Claude.ai và Party World API.

Chạy:  uvicorn server:app --host 127.0.0.1 --port 8765
Nginx proxy: https://ketoan.tranhdali.vn/mcp → 127.0.0.1:8765

Đăng ký với Claude.ai:
  Settings → Connectors → Add custom connector
  URL: https://ketoan.tranhdali.vn/mcp
"""
from __future__ import annotations

import os
import json
from datetime import date as Date
from typing import Any, Optional
import httpx

from mcp.server.fastmcp import FastMCP
from mcp.server.transport_security import TransportSecuritySettings


# ============ CONFIG ============
PARTY_WORLD_API = os.getenv("PW_API_BASE", "https://ketoan.tranhdali.vn/api/v1")
PARTY_WORLD_TOKEN = os.getenv("PW_API_TOKEN", "")
HTTP_TIMEOUT = 15.0

if not PARTY_WORLD_TOKEN:
    raise RuntimeError(
        "PW_API_TOKEN environment variable is required. "
        "Set it in /etc/systemd/system/mcp-ketoan-dali.service.d/override.conf"
    )

mcp = FastMCP(
    name="ketoan-tranhdali",
    instructions=(
        "Sổ kế toán Party World của Công ty Sản xuất & Thương mại Dali. "
        "Dùng để ghi nhận chi phí, doanh thu, công nợ, và biến động tồn kho từ ảnh "
        "hóa đơn / sao kê ngân hàng / đơn hàng Shopee. "
        "Tất cả số tiền mặc định bằng VND. Ngày dùng định dạng YYYY-MM-DD."
    ),
    # Chống DNS-rebinding của MCP SDK chỉ cho localhost mặc định -> phải khai báo
    # host công khai, nếu không sẽ trả "421 Invalid Host header" qua reverse proxy.
    transport_security=TransportSecuritySettings(
        enable_dns_rebinding_protection=True,
        allowed_hosts=[
            "ketoan.tranhdali.vn", "ketoan.tranhdali.vn:*",
            "127.0.0.1:*", "localhost:*",
        ],
        allowed_origins=[
            "https://ketoan.tranhdali.vn", "https://ketoan.tranhdali.vn:*",
            "https://claude.ai", "https://claude.com",
        ],
    ),
)


# ============ HTTP CLIENT ============
def _headers() -> dict:
    return {
        "Authorization": f"Bearer {PARTY_WORLD_TOKEN}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }


async def _api_post(path: str, body: dict) -> dict:
    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
        r = await client.post(f"{PARTY_WORLD_API}{path}", json=body, headers=_headers())
        r.raise_for_status()
        return r.json()


async def _api_get(path: str, params: Optional[dict] = None) -> dict:
    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
        r = await client.get(f"{PARTY_WORLD_API}{path}", params=params, headers=_headers())
        r.raise_for_status()
        return r.json()


# ============ TOOLS: CHI PHÍ ============
@mcp.tool()
async def add_expense(
    entry_date: str,
    description: str,
    amount: float,
    category: Optional[str] = None,
    counterparty_name: Optional[str] = None,
    notes: Optional[str] = None,
) -> str:
    """
    Ghi nhận một khoản CHI PHÍ vào sổ kế toán.

    Dùng cho: tiền NVL, lương nhân viên, thuế, dịch vụ, sửa chữa, vận chuyển...

    Args:
        entry_date: Ngày phát sinh chi phí, định dạng YYYY-MM-DD (vd "2026-06-10")
        description: Mô tả ngắn gọn nội dung chi (vd "Mua dây cáp máy in", "TT lương cô Thim")
        amount: Số tiền VND (số dương)
        category: Danh mục chi phí. Khuyến nghị một trong:
            "NVL" (nguyên vật liệu), "Lương", "Thuế-BHXH", "Vận chuyển",
            "Tiện ích" (điện/nước/mạng), "Thiết bị-Sửa chữa", "Phần mềm",
            "Marketing", "Văn phòng phẩm", "Khác"
        counterparty_name: Tên nhà cung cấp / người nhận tiền (nếu có)
        notes: Ghi chú thêm (số HĐ, ảnh, mã giao dịch...)
    """
    body = {
        "entry_type": "expense",
        "entry_date": entry_date,
        "description": description,
        "amount": amount,
        "category": category,
        "counterparty_name": counterparty_name,
        "source": "mcp",
    }
    if notes:
        body["data"] = {"notes": notes}
    result = await _api_post("/entries", body)
    return _format_result(result, "chi phí")


# ============ TOOLS: DOANH THU ============
@mcp.tool()
async def add_income(
    entry_date: str,
    description: str,
    amount: float,
    category: Optional[str] = None,
    counterparty_name: Optional[str] = None,
    notes: Optional[str] = None,
) -> str:
    """
    Ghi nhận một khoản DOANH THU (tiền vào).

    Dùng cho: đơn hàng Shopee, doanh thu Fahasa, bán lẻ, thanh toán từ khách...

    Args:
        entry_date: Ngày YYYY-MM-DD
        description: Mô tả (vd "Đơn Shopee #SPX123 - tranh CG013 40x50")
        amount: Số tiền nhận được (VND)
        category: "Shopee", "Fahasa", "Bán lẻ kho", "METIS ART", "Khác"
        counterparty_name: Tên khách hàng (nếu có)
        notes: Ghi chú
    """
    body = {
        "entry_type": "income",
        "entry_date": entry_date,
        "description": description,
        "amount": amount,
        "category": category,
        "counterparty_name": counterparty_name,
        "counterparty_type": "customer",
        "source": "mcp",
    }
    if notes:
        body["data"] = {"notes": notes}
    result = await _api_post("/entries", body)
    return _format_result(result, "doanh thu")


# ============ TOOLS: CÔNG NỢ ============
@mcp.tool()
async def add_receivable(
    entry_date: str,
    counterparty_name: str,
    amount: float,
    description: str,
    due_date: Optional[str] = None,
) -> str:
    """
    Ghi nhận PHẢI THU (khách nợ mình). Tăng số dư nợ của KH.

    Args:
        entry_date: Ngày phát sinh
        counterparty_name: Tên khách hàng (sẽ tự tạo nếu chưa có)
        amount: Số tiền KH còn nợ
        description: Mô tả khoản nợ (vd "Bán tranh 50x65 chưa thu tiền")
        due_date: Hạn thanh toán (YYYY-MM-DD, không bắt buộc)
    """
    body = {
        "entry_type": "receivable",
        "entry_date": entry_date,
        "description": description,
        "amount": amount,
        "counterparty_name": counterparty_name,
        "counterparty_type": "customer",
        "source": "mcp",
    }
    if due_date:
        body["data"] = {"due_date": due_date}
    result = await _api_post("/entries", body)
    return _format_result(result, "công nợ phải thu")


@mcp.tool()
async def add_payable(
    entry_date: str,
    counterparty_name: str,
    amount: float,
    description: str,
    due_date: Optional[str] = None,
) -> str:
    """
    Ghi nhận PHẢI TRẢ (mình nợ nhà cung cấp). Tăng số dư nợ phải trả.

    Args:
        entry_date: Ngày phát sinh
        counterparty_name: Tên nhà cung cấp
        amount: Số tiền còn nợ NCC
        description: Mô tả khoản nợ
        due_date: Hạn thanh toán (YYYY-MM-DD)
    """
    body = {
        "entry_type": "payable",
        "entry_date": entry_date,
        "description": description,
        "amount": amount,
        "counterparty_name": counterparty_name,
        "counterparty_type": "supplier",
        "source": "mcp",
    }
    if due_date:
        body["data"] = {"due_date": due_date}
    result = await _api_post("/entries", body)
    return _format_result(result, "công nợ phải trả")


# ============ TOOLS: TỒN KHO ============
@mcp.tool()
async def add_inventory_movement(
    entry_date: str,
    movement: str,
    inventory_item_code: str,
    quantity: float,
    description: str,
    amount: float = 0,
) -> str:
    """
    Ghi nhận biến động TỒN KHO (nhập hoặc xuất kho).

    Args:
        entry_date: Ngày YYYY-MM-DD
        movement: "in" (nhập kho) hoặc "out" (xuất kho)
        inventory_item_code: Mã item (vd "BVB.11", "canvas-kansai")
        quantity: Số lượng nhập/xuất (số dương)
        description: Lý do (vd "Nhập hàng từ TQ", "Xuất bán đơn Shopee #123")
        amount: Giá trị giao dịch (tùy chọn, dùng cho nhập kho)
    """
    if movement not in ("in", "out"):
        return "❌ Lỗi: movement phải là 'in' hoặc 'out'"
    body = {
        "entry_type": f"inventory_{movement}",
        "entry_date": entry_date,
        "description": description,
        "amount": amount,
        "inventory_item_code": inventory_item_code,
        "quantity": quantity,
        "source": "mcp",
    }
    result = await _api_post("/entries", body)
    return _format_result(result, f"biến động tồn kho ({movement})")


@mcp.tool()
async def create_inventory_item(
    code: str,
    name: str,
    unit: str = "cái",
    category: Optional[str] = None,
    initial_qty: float = 0,
    cost_per_unit: Optional[float] = None,
) -> str:
    """
    Tạo MỘT ITEM tồn kho mới (mã tranh, NVL...).

    Args:
        code: Mã unique (vd "BVB.11", "canvas-kansai-100m")
        name: Tên đầy đủ
        unit: Đơn vị tính (cái, kg, m, lít, bộ, vỉ...)
        category: "Tranh thành phẩm", "NVL canvas", "NVL khung", "Sơn", "Phụ liệu"...
        initial_qty: Tồn kho khởi tạo
        cost_per_unit: Giá vốn / đơn vị
    """
    body = {
        "code": code,
        "name": name,
        "unit": unit,
        "category": category,
        "current_qty": initial_qty,
        "cost_per_unit": cost_per_unit,
    }
    result = await _api_post("/inventory", body)
    return f"✅ Đã tạo item '{code}' - {name} (id={result.get('id')})"


# ============ TOOLS: QUERY / VERIFICATION ============
@mcp.tool()
async def list_recent_entries(
    entry_type: Optional[str] = None,
    days: int = 7,
    limit: int = 20,
) -> str:
    """
    Liệt kê các entry gần đây để kiểm tra / xác nhận.

    Args:
        entry_type: Lọc theo loại: "expense", "income", "receivable", "payable",
                    "inventory_in", "inventory_out". Để trống = tất cả.
        days: Số ngày lùi lại (mặc định 7)
        limit: Số dòng tối đa trả về
    """
    from datetime import date, timedelta
    to_date = date.today().isoformat()
    from_date = (date.today() - timedelta(days=days)).isoformat()
    params = {"from": from_date, "to": to_date, "limit": limit}
    if entry_type:
        params["type"] = entry_type
    result = await _api_get("/entries", params)
    entries = result.get("entries", [])
    if not entries:
        return f"Không có entry nào trong {days} ngày gần nhất."

    lines = [f"📊 {len(entries)} entry gần nhất (tổng: {result.get('total_amount', 0):,.0f}đ):"]
    for e in entries:
        lines.append(
            f"  • {e['entry_date']} | {e['entry_type']} | "
            f"{e['amount']:>15,.0f}đ | {e['description'][:60]}"
        )
    return "\n".join(lines)


@mcp.tool()
async def get_summary_report(from_date: Optional[str] = None, to_date: Optional[str] = None) -> str:
    """
    Lấy báo cáo P&L tóm tắt (tổng thu, tổng chi, lãi/lỗ) trong khoảng thời gian.

    Args:
        from_date: Ngày bắt đầu YYYY-MM-DD (mặc định: đầu năm hiện tại)
        to_date: Ngày kết thúc YYYY-MM-DD (mặc định: hôm nay)
    """
    params = {}
    if from_date:
        params["from"] = from_date
    if to_date:
        params["to"] = to_date
    result = await _api_get("/reports/summary", params)
    p = result["period"]
    return (
        f"📈 Báo cáo {p['from']} → {p['to']}:\n"
        f"  • Doanh thu: {result['income']:>15,.0f}đ\n"
        f"  • Chi phí:   {result['expense']:>15,.0f}đ\n"
        f"  • Lãi/Lỗ:    {result['net_profit']:>15,.0f}đ"
    )


@mcp.tool()
async def list_outstanding_debts() -> str:
    """Liệt kê tất cả công nợ chưa tất toán (phải thu + phải trả)."""
    result = await _api_get("/counterparties/debts")
    lines = [
        f"💰 Công nợ tổng quan:",
        f"  • Tổng phải thu: {result['total_receivable']:>15,.0f}đ",
        f"  • Tổng phải trả: {result['total_payable']:>15,.0f}đ",
        f"  • Net:           {result['net']:>15,.0f}đ",
        "",
        "Chi tiết:",
    ]
    for c in result.get("counterparties", [])[:30]:
        sign = "📥" if c["current_balance"] > 0 else "📤"
        lines.append(
            f"  {sign} {c['name'][:40]:40s} {c['current_balance']:>15,.0f}đ"
        )
    return "\n".join(lines)


@mcp.tool()
async def search_inventory(query: Optional[str] = None, category: Optional[str] = None) -> str:
    """
    Tìm item tồn kho theo mã, tên, hoặc danh mục.

    Args:
        query: Từ khoá (vd "BVB", "canvas")
        category: Lọc danh mục
    """
    params = {}
    if query:
        params["q"] = query
    if category:
        params["category"] = category
    result = await _api_get("/inventory", params)
    items = result.get("items", [])
    if not items:
        return "Không tìm thấy item nào."
    lines = [f"📦 {len(items)} item:"]
    for i in items[:30]:
        lines.append(f"  • {i['code']:20s} | {i['name'][:40]:40s} | tồn: {i['current_qty']:.2f} {i['unit']}")
    return "\n".join(lines)


# ============ HELPER ============
def _format_result(result: dict, what: str) -> str:
    if result.get("duplicate"):
        return f"⚠️ Entry '{what}' đã tồn tại (id={result['id']}). Không tạo trùng."
    return f"✅ Đã ghi nhận {what} (id={result.get('id')})."


# ============ EXPOSE ASGI APP ============
# FastMCP có sẵn ASGI app cho HTTP transport
import hmac

# Bảo vệ /mcp: MẶC ĐỊNH dựa vào nginx allowlist IP outbound của Anthropic
# (160.79.104.0/21). claude.ai connector dùng OAuth — KHÔNG gửi được Bearer tĩnh,
# nên nếu bật lớp Bearer sẽ chặn luôn claude.ai. Chỉ bật khi đặt MCP_REQUIRE_BEARER=1.
MCP_AUTH_TOKEN = os.getenv("MCP_AUTH_TOKEN") or PARTY_WORLD_TOKEN
MCP_REQUIRE_BEARER = (os.getenv("MCP_REQUIRE_BEARER") or "").strip().lower() in ("1", "true", "yes")


class BearerAuthASGI:
    """ASGI middleware thuần: chặn request /mcp thiếu/sai Bearer token.
    Dùng ASGI cấp thấp (không phải BaseHTTPMiddleware) để KHÔNG đệm/đứt
    luồng streaming (SSE) của MCP. Chỉ chặn ở scope http; lifespan đi qua."""

    def __init__(self, app, token: str):
        self.app = app
        self.token = token or ""

    async def __call__(self, scope, receive, send):
        if scope.get("type") == "http":
            headers = dict(scope.get("headers") or [])
            auth = headers.get(b"authorization", b"").decode("latin-1")
            tok = auth[7:] if auth.startswith("Bearer ") else ""
            if not (self.token and tok and hmac.compare_digest(tok, self.token)):
                await send({"type": "http.response.start", "status": 401,
                            "headers": [(b"content-type", b"application/json")]})
                await send({"type": "http.response.body",
                            "body": b'{"error":"unauthorized"}'})
                return
        await self.app(scope, receive, send)


app = mcp.streamable_http_app()
if MCP_REQUIRE_BEARER:
    app = BearerAuthASGI(app, MCP_AUTH_TOKEN)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8765)
