/* ============================================================
   DALI - Phần mềm kế toán
   db.js — Lớp dữ liệu (lưu trong localStorage của trình duyệt)
   ============================================================ */

const PW = {
  KEY: 'PARTY_WORLD_DB_V1',
  data: null,
  mode: 'local',     // 'local' (localStorage) | 'server' (PHP+MySQL)
  user: null,        // người dùng đang đăng nhập (chế độ server)
  _version: 0,       // phiên bản dữ liệu (chống ghi đè)
  _saveTimer: null,
};

/* ---------- Chuẩn hóa cấu trúc dữ liệu ---------- */
PW._normalize = function () {
  const tables = ['products', 'customers', 'suppliers', 'cashAccounts',
    'receipts', 'payments', 'salesInvoices', 'purchases',
    'quotations', 'salesOrders', 'salesReturns', 'salesDiscounts',
    'purchaseOrders', 'purchaseReturns', 'purchaseDiscounts',
    'employees', 'productGroups', 'units', 'warehouses', 'expenseItems', 'paymentTerms', 'partnerGroups',
    'payrolls', 'productionOrders', 'channels', 'stockAdjustments', 'productivityEntries', 'productAliases', 'taxInvoices', 'activityLog', 'cashCounts'];
  tables.forEach(t => { if (!PW.data[t]) PW.data[t] = []; });
  if (!PW.data.meta) PW.data.meta = { companyName: 'DALI', counters: {} };
  if (!PW.data.meta.counters) PW.data.meta.counters = {};

  // (1 lần) Đảm bảo có sẵn nhóm NVL theo kích thước người dùng yêu cầu
  if (!PW.data.meta.seededNvlGroups) {
    ['20x20', '30x30', '37.5'].forEach(sz => {
      const nm = 'Nguyên vật liệu ' + sz;
      if (!PW.data.productGroups.some(g => (g.name || '').trim().toLowerCase() === nm.toLowerCase()))
        PW.data.productGroups.push({ id: PW.uid(), name: nm, kind: 'nvl' });
    });
    PW.data.meta.seededNvlGroups = true;
  }

  // (1 lần) Tách Nhóm hàng khỏi Tính chất: nếu nhóm trống hoặc chỉ lặp lại tên tính chất
  // -> đặt nhóm theo kích thước phát hiện trong tên (NVL: "Nguyên vật liệu 20x20", TP: "20x20").
  if (!PW.data.meta.migratedSizeGroups) {
    const kindLabel = { hanghoa: 'Hàng hóa', dichvu: 'Dịch vụ', nvl: 'Nguyên vật liệu', thanhpham: 'Thành phẩm', ccdc: 'Công cụ dụng cụ', combo: 'Combo' };
    (PW.data.products || []).forEach(p => {
      const g = (p.group || '').trim();
      const echoesKind = !g || g.toLowerCase() === (kindLabel[p.kind] || '').toLowerCase();
      if (!echoesKind) return;                       // giữ nguyên nhóm tùy chỉnh có ý nghĩa
      const sz = PW.detectSize((p.code || '') + ' ' + p.name);
      if (!sz) return;
      p.group = (p.kind === 'nvl' ? 'Nguyên vật liệu ' : '') + sz;
    });
    PW.data.meta.migratedSizeGroups = true;
  }
};

// Phát hiện kích thước trong tên/mã hàng: "20x20", "20×20", "37.5", "40x50", "1m52"...
PW.detectSize = function (s) {
  s = String(s || '');
  let m = s.match(/(\d{1,3}(?:[.,]\d+)?)\s*[x×]\s*(\d{1,3}(?:[.,]\d+)?)/i);   // 20x20 / 40×50
  if (m) return m[1].replace(',', '.') + 'x' + m[2].replace(',', '.');
  m = s.match(/(\d{1,2})\s*m\s*(\d{1,2})\b/i);                                 // 1m52
  if (m) return m[1] + 'm' + m[2];
  m = s.match(/(?:^|[\s_\-])(\d{2,3}[.,]\d+)(?:$|[\s_\-])/);                   // 37.5 đứng riêng
  if (m) return m[1].replace(',', '.');
  return '';
};

/* ---------- Gọi API server ---------- */
PW.api = async function (path, opts) {
  const res = await fetch('api/' + path, Object.assign({
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
  }, opts));
  let data = null;
  try { data = await res.json(); } catch (e) {}
  return { status: res.status, data };
};

/* ---------- Phát hiện chế độ: có server PHP hay không ---------- */
PW.detectSession = async function () {
  try {
    const r = await PW.api('auth.php?action=me');
    if (r.status === 200 && r.data && 'user' in r.data) {
      PW.mode = 'server';
      PW.user = r.data.user;       // null nếu chưa đăng nhập
      return { server: true, user: r.data.user };
    }
  } catch (e) {}
  PW.mode = 'local';               // không có PHP -> chạy offline như cũ
  return { server: false, user: null };
};

/* ---------- Nạp dữ liệu ---------- */
PW.load = async function () {
  if (PW.mode === 'server') {
    const r = await PW.api('data.php?action=get');
    if (r.status === 200 && r.data) {
      PW._version = r.data.version || 0;
      if (r.data.data) {
        PW.data = r.data.data;
        PW._normalize();
        return PW.data;
      }
    }
    // Server chưa có dữ liệu -> tạo dữ liệu mẫu lần đầu rồi lưu lên
    PW.data = PW.seed();
    PW._normalize();
    await PW.saveNow();
    return PW.data;
  }
  // ----- Chế độ offline (localStorage) -----
  const raw = localStorage.getItem(PW.KEY);
  if (raw) {
    try { PW.data = JSON.parse(raw); }
    catch (e) { console.error('Lỗi đọc dữ liệu, tạo mới', e); PW.data = PW.seed(); }
  } else {
    PW.data = PW.seed();
  }
  PW._normalize();
  return PW.data;
};

/* ---------- Lưu dữ liệu ---------- */
PW.save = function (force) {
  if (PW.mode === 'server') {
    // Gộp nhiều thay đổi liên tiếp, lưu sau 600ms
    clearTimeout(PW._saveTimer);
    PW._saveTimer = setTimeout(() => { PW.saveNow(force); }, 600);
    return;
  }
  localStorage.setItem(PW.KEY, JSON.stringify(PW.data));
};

// Lưu ngay lên server (chế độ server). force=true -> bỏ qua lớp chắn mất dữ liệu (chỉ dùng cho xóa/khôi phục có xác nhận)
PW.saveNow = async function (force) {
  if (PW.mode !== 'server') return;
  clearTimeout(PW._saveTimer);
  const r = await PW.api('data.php?action=save', {
    method: 'POST',
    body: JSON.stringify({ data: PW.data, version: PW._version, force: !!force }),
  });
  if (r.status === 200 && r.data && r.data.ok) {
    PW._version = r.data.version;
  } else if (r.status === 409 && r.data && r.data.error === 'data_loss_guard') {
    // Server chặn vì bản mới làm mất nhiều dữ liệu. Lúc này PW.data trên máy đang LỆCH (chưa lưu được);
    // mọi lần lưu sau cũng sẽ bị chặn -> TẢI LẠI để đồng bộ về bản tốt trên máy chủ (tránh kẹt + RAM hỏng).
    if (typeof U !== 'undefined') U.toast((r.data.message || 'Lưu bị chặn để tránh mất dữ liệu.') + ' Đang tải lại bản trên máy chủ...', 'error');
    setTimeout(() => location.reload(), 3000);
  } else if (r.status === 409) {
    // Người khác vừa cập nhật -> tải lại để tránh mất dữ liệu
    if (typeof U !== 'undefined') U.toast('Dữ liệu vừa được người khác cập nhật, đang tải lại...', 'error');
    setTimeout(() => location.reload(), 1500);
  } else if (r.status === 403) {
    // Không đủ quyền sửa một số phần dữ liệu -> KHÔNG reload (giữ nguyên màn hình)
    const secs = (r.data && r.data.sections) ? r.data.sections.join(', ') : '';
    if (typeof U !== 'undefined')
      U.toast('Không đủ quyền lưu thay đổi' + (secs ? ' (mục: ' + secs + ')' : '') + '. Liên hệ kế toán/admin.', 'error');
  } else if (r.status === 401) {
    location.reload();
  } else if (typeof U !== 'undefined') {
    U.toast('Lỗi lưu dữ liệu lên server', 'error');
  }
  return r;
};

/* ---------- Sinh mã / id ---------- */
PW.uid = function () {
  return 'id' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
};

/* ---------- Nhật ký hoạt động (audit log) ---------- */
// Người thực hiện: server -> tên người đăng nhập; offline -> tên thiết bị (Cài đặt) hoặc 'offline'
PW.currentActor = function () {
  if (PW.mode === 'server' && PW.user) return PW.user.fullname || PW.user.username;
  return (PW.data && PW.data.meta && PW.data.meta.deviceName) || 'offline';
};
PW.ACT_LOG_MAX = 2000;
// action: 'create'|'update'|'delete'; entity: mã loại; name: mã/tên chứng từ; detail: mô tả ngắn.
// KHÔNG tự gọi PW.save() — để caller lưu chung 1 lượt (log là 1 phần của PW.data).
PW.logActivity = function (action, entity, name, detail) {
  try {
    if (!PW.data.activityLog) PW.data.activityLog = [];
    PW.data.activityLog.push({
      id: PW.uid(),
      ts: new Date().toISOString(),
      actor: PW.currentActor(),
      role: (PW.user && PW.user.role) || (PW.mode === 'server' ? '' : 'offline'),
      action: action, entity: entity, name: name || '', detail: detail || '',
    });
    if (PW.data.activityLog.length > PW.ACT_LOG_MAX)
      PW.data.activityLog.splice(0, PW.data.activityLog.length - PW.ACT_LOG_MAX);
  } catch (e) { /* không được làm vỡ luồng lưu chính */ }
};

// Số lớn nhất đang dùng của 1 tiền tố (quét MỌI bảng có .code = prefix+số) -> chống trùng kể cả khi counter lệch
PW._maxCodeNum = function (prefix) {
  let max = 0;
  const re = new RegExp('^' + prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '0*(\\d+)$');
  Object.keys(PW.data).forEach(k => {
    const arr = PW.data[k];
    if (!Array.isArray(arr)) return;
    arr.forEach(x => { if (x && typeof x.code === 'string') { const m = x.code.match(re); if (m) { const n = +m[1]; if (n > max) max = n; } } });
  });
  return max;
};
PW.nextCode = function (prefix) {
  const c = PW.data.meta.counters;
  let n = (c[prefix] || 0) + 1;
  const mx = PW._maxCodeNum(prefix);   // nếu đã có mã >= n (counter lệch) -> nhảy qua max để KHÔNG trùng
  if (mx >= n) n = mx + 1;
  c[prefix] = n;
  PW.save();
  return prefix + String(n).padStart(5, '0');
};

/* ---------- Truy vấn nhanh ---------- */
PW.product = id => PW.data.products.find(p => p.id === id);
PW.customer = id => PW.data.customers.find(c => c.id === id);
PW.supplier = id => PW.data.suppliers.find(s => s.id === id);
PW.account = id => PW.data.cashAccounts.find(a => a.id === id);

/* ---------- Tính toán số dư / công nợ / tồn kho ---------- */

// Tồn kho hiện tại của 1 sản phẩm
// Tính chất hàng hóa: hanghoa | dichvu | nvl | thanhpham | ccdc | combo
PW.productKind = p => (p && p.kind) || 'hanghoa';
// Có theo dõi tồn kho không? Dịch vụ: không. Combo: tồn suy từ thành phần (xử lý riêng).
PW.isStocked = p => !!p && p.kind !== 'dichvu' && p.kind !== 'combo';
// Giá mua BÌNH QUÂN của 1 hàng (theo các phiếu nhập, có thể giới hạn khoảng ngày)
PW.avgPurchaseCost = function (productId, from, to) {
  let qty = 0, val = 0;
  PW.data.purchases.forEach(pu => {
    if (from && pu.date < from) return;
    if (to && pu.date > to) return;
    pu.items.forEach(it => { if (it.productId === productId) { qty += Number(it.qty); val += Number(it.qty) * Number(it.cost || 0); } });
  });
  return qty > 0 ? val / qty : 0;
};
// Giá vốn 1 đơn vị (dùng thống nhất): combo -> tổng thành phần; có giá vốn nhập tay -> dùng;
// NVL/hàng để trống giá vốn -> lấy BÌNH QUÂN giá mua (tới ngày 'to' nếu có).
PW.unitCost = function (p, to) {
  if (!p) return 0;
  if (p.kind === 'combo') return PW.comboCost(p, to);
  if (Number(p.cost) > 0) return Number(p.cost);
  return PW.avgPurchaseCost(p.id, null, to);
};
// Giá vốn 1 combo = tổng giá vốn các thành phần × số lượng
PW.comboCost = function (p, to) {
  if (!p || !p.components || !p.components.length) return Number(p ? (p.cost || 0) : 0);
  return p.components.reduce((s, c) => { const m = PW.product(c.productId); return s + Number(c.qty || 0) * PW.unitCost(m, to); }, 0);
};

// Tồn kho. asOf (yyyy-mm-dd, tùy chọn) -> chỉ tính chứng từ có date <= asOf (tồn TẠI thời điểm đó).
PW.stockOf = function (productId, asOf) {
  const p = PW.product(productId);
  if (!p) return 0;
  const ok = d => !asOf || (d || '') <= asOf;   // lọc theo mốc thời gian
  // Dịch vụ: không có tồn kho
  if (p.kind === 'dichvu') return 0;
  // Combo: tồn = số bộ tối đa lắp được từ thành phần
  if (p.kind === 'combo') {
    if (!p.components || !p.components.length) return 0;
    let n = Infinity;
    p.components.forEach(c => { const cq = Number(c.qty || 0); if (cq > 0) n = Math.min(n, Math.floor(PW.stockOf(c.productId, asOf) / cq)); });
    return n === Infinity ? 0 : n;
  }
  let qty = Number(p.openingStock || 0);
  PW.data.purchases.forEach(pu => {
    if (!ok(pu.date)) return;
    pu.items.forEach(it => { if (it.productId === productId) qty += Number(it.qty); });
  });
  PW.data.salesInvoices.forEach(si => {
    if (!ok(si.date)) return;
    si.items.forEach(it => {
      if (it.productId === productId) qty -= Number(it.qty);
      // Bán combo -> trừ kho từng thành phần
      else { const cp = PW.product(it.productId); if (cp && cp.kind === 'combo' && cp.components)
        cp.components.forEach(c => { if (c.productId === productId) qty -= Number(c.qty || 0) * Number(it.qty); }); }
    });
  });
  // Trả lại hàng bán -> hàng nhập lại kho (BỎ QUA phiếu "thất lạc" noRestock: hàng không về)
  PW.data.salesReturns.forEach(sr => {
    if (sr.noRestock || !ok(sr.date)) return;
    sr.items.forEach(it => {
      if (it.productId === productId) qty += Number(it.qty);
      else { const cp = PW.product(it.productId); if (cp && cp.kind === 'combo' && cp.components)
        cp.components.forEach(c => { if (c.productId === productId) qty += Number(c.qty || 0) * Number(it.qty); }); }
    });
  });
  // Trả lại hàng mua -> xuất khỏi kho trả nhà cung cấp
  PW.data.purchaseReturns.forEach(pr => {
    if (!ok(pr.date)) return;
    pr.items.forEach(it => { if (it.productId === productId) qty -= Number(it.qty); });
  });
  // Sản xuất: thành phẩm nhập kho (+), NVL tiêu hao (-)
  PW.data.productionOrders.forEach(po => {
    if (!ok(po.date)) return;
    if (po.productId === productId) qty += Number(po.qty);
    (po.materials || []).forEach(m => { if (m.productId === productId) qty -= Number(m.qty); });
  });
  // Điều chỉnh kiểm kê (delta + hoặc -)
  PW.data.stockAdjustments.forEach(ad => {
    if (!ok(ad.date)) return;
    (ad.items || []).forEach(it => { if (it.productId === productId) qty += Number(it.delta || 0); });
  });
  return qty;
};

// Danh sách hàng dưới mức tồn tối thiểu
PW.stockBelowMin = function () {
  return PW.data.products
    .filter(p => p.kind !== 'dichvu' && Number(p.minStock || 0) > 0 && PW.stockOf(p.id) < Number(p.minStock))
    .map(p => ({ p, stock: PW.stockOf(p.id), min: Number(p.minStock) }));
};

// Thuế GTGT đầu ra / đầu vào trong khoảng
PW.vatOutput = function (from, to) {
  return PW.data.salesInvoices.filter(si => (!from || si.date >= from) && (!to || si.date <= to))
    .reduce((s, si) => s + Math.round(PW.invoiceTotal(si) * Number(si.vatRate || 0) / 100), 0);
};
PW.vatInput = function (from, to) {
  return PW.data.purchases.filter(pu => (!from || pu.date >= from) && (!to || pu.date <= to))
    .reduce((s, pu) => s + Math.round(PW.purchaseTotal(pu) * Number(pu.vatRate || 0) / 100), 0);
};

// Hoa hồng CTV của 1 khách trong khoảng
PW.commissionOf = function (customer, from, to) {
  const pct = Number(customer.commissionPercent || 0);
  if (pct <= 0) return 0;
  const rev = PW.data.salesInvoices
    .filter(si => si.customerId === customer.id && (!from || si.date >= from) && (!to || si.date <= to))
    .reduce((s, si) => s + PW.invoiceTotal(si), 0);
  return Math.round(rev * pct / 100);
};

// Thống kê 1 khách hàng (cho CRM): tổng mua, số đơn, lần mua cuối
PW.customerStats = function (customerId) {
  const invs = PW.data.salesInvoices.filter(si => si.customerId === customerId);
  let total = 0, last = '';
  invs.forEach(si => { total += PW.invoiceTotal(si); if (si.date > last) last = si.date; });
  return { total, count: invs.length, last };
};

// Giá vốn NVL theo định mức (BOM) cho 1 thành phẩm
PW.bomMaterialCost = function (product) {
  return (product.bom || []).reduce((s, b) => {
    const p = PW.product(b.materialId);
    return s + Number(b.qty) * PW.unitCost(p);
  }, 0);
};
// Giá thành 1 đơn vị của 1 lệnh sản xuất = (NVL + công + chi phí khác) / số lượng
PW.productionUnitCost = function (po) {
  const matCost = (po.materials || []).reduce((s, m) => {
    const p = PW.product(m.productId);
    return s + Number(m.qty) * PW.unitCost(p, po.date);
  }, 0);
  const total = matCost + Number(po.laborCost || 0) + Number(po.otherCost || 0);
  return Number(po.qty) > 0 ? total / Number(po.qty) : 0;
};
PW.productionTotalCost = function (po) {
  const matCost = (po.materials || []).reduce((s, m) => {
    const p = PW.product(m.productId);
    return s + Number(m.qty) * PW.unitCost(p, po.date);
  }, 0);
  return matCost + Number(po.laborCost || 0) + Number(po.otherCost || 0);
};

// Tổng giá trị 1 phiếu trả lại hàng bán (theo giá bán)
PW.returnTotal = function (sr) {
  return sr.items.reduce((s, it) => s + Number(it.qty || 0) * Number(it.price || 0), 0);
};
// Tổng giá trị 1 phiếu trả lại hàng mua (theo giá nhập)
PW.purchaseReturnTotal = function (pr) {
  return pr.items.reduce((s, it) => s + Number(it.qty || 0) * Number(it.cost || 0), 0);
};
// Giá vốn hàng trả lại
PW.returnCost = function (sr) {
  return sr.items.reduce((s, it) => {
    const p = PW.product(it.productId);
    return s + Number(it.qty) * PW.unitCost(p, sr.date);
  }, 0);
};

// Tổng tiền 1 hóa đơn bán
PW.invoiceTotal = function (si) {
  const sub = si.items.reduce((s, it) => s + Number(it.qty || 0) * Number(it.price || 0), 0);
  return sub - Number(si.discount || 0);
};

// ----- Kênh bán & phí sàn -----
PW.channel = id => PW.data.channels.find(c => c.id === id);
PW.invoiceFees = si => Number(si.platformFee || 0) + Number(si.shippingFee || 0); // phí sàn + phí ship
PW.invoiceNet = si => PW.invoiceGrand(si) - PW.invoiceFees(si);                  // thực nhận sau phí (KH trả gồm thuế, trừ phí)
PW.channelPrice = function (product, channelId) {
  if (product && product.channelPrices && channelId &&
      product.channelPrices[channelId] != null && product.channelPrices[channelId] !== '') {
    return Number(product.channelPrices[channelId]);
  }
  return product ? Number(product.price || 0) : 0;
};
// Tổng phí sàn + vận chuyển (chi phí bán hàng) trong khoảng
PW.sellingFees = function (from, to) {
  return PW.data.salesInvoices
    .filter(si => (!from || si.date >= from) && (!to || si.date <= to))
    .reduce((s, si) => s + PW.invoiceFees(si), 0);
};

// Tổng tiền 1 phiếu nhập mua
PW.purchaseTotal = function (pu) {
  return pu.items.reduce((s, it) => s + Number(it.qty || 0) * Number(it.cost || 0), 0);
};

/* ---------- Tiền có THUẾ (khách/NCC trả gồm thuế) — dùng cho TỔNG phải thu/trả, công nợ ----------
   Lưu ý: DOANH THU (revenue) vẫn dùng invoiceTotal (TRƯỚC thuế) — thuế GTGT là khoản phải nộp, không phải doanh thu. */
PW.invoiceVat = si => Math.round(PW.invoiceTotal(si) * Number(si.vatRate || 0) / 100);
PW.purchaseVat = pu => Math.round(PW.purchaseTotal(pu) * Number(pu.vatRate || 0) / 100);
PW.invoiceGrand = si => PW.invoiceTotal(si) + PW.invoiceVat(si);     // tổng KH phải trả
PW.purchaseGrand = pu => PW.purchaseTotal(pu) + PW.purchaseVat(pu);  // tổng phải trả NCC
// Trả lại: kế thừa thuế từ hóa đơn/phiếu nhập gốc (nếu có gắn) để bù trừ công nợ khớp gồm thuế
PW.returnGrand = function (sr) {
  const base = PW.returnTotal(sr);
  const inv = sr.invoiceId && PW.data.salesInvoices.find(x => x.id === sr.invoiceId);
  const rate = inv ? Number(inv.vatRate || 0) : Number(sr.vatRate || 0);
  return base + Math.round(base * rate / 100);
};
PW.purchaseReturnGrand = function (pr) {
  const base = PW.purchaseReturnTotal(pr);
  const pu = (pr.purchaseId || pr.invoiceId) && PW.data.purchases.find(x => x.id === (pr.purchaseId || pr.invoiceId));
  const rate = pu ? Number(pu.vatRate || 0) : Number(pr.vatRate || 0);
  return base + Math.round(base * rate / 100);
};
// Giảm giá: số tiền nhập là TRƯỚC thuế; trừ công nợ thì GỒM thuế (kế thừa từ HĐ/PN gốc nếu có gắn)
PW.discountGrand = function (g) {
  const amt = Number(g.amount || 0);
  const src = (g.invoiceId && (PW.data.salesInvoices.find(x => x.id === g.invoiceId) || PW.data.purchases.find(x => x.id === g.invoiceId)))
    || (g.purchaseId && PW.data.purchases.find(x => x.id === g.purchaseId));
  const rate = src ? Number(src.vatRate || 0) : Number(g.vatRate || 0);
  return amt + Math.round(amt * rate / 100);
};

// Số dư tài khoản tiền
PW.accountBalance = function (accountId) {
  const a = PW.account(accountId);
  if (!a) return 0;
  let bal = Number(a.opening || 0);
  PW.data.receipts.forEach(r => { if (r.accountId === accountId) bal += Number(r.amount); });
  PW.data.payments.forEach(p => { if (p.accountId === accountId) bal -= Number(p.amount); });
  PW.data.salesInvoices.forEach(si => {
    if (si.paidAccountId === accountId) bal += Number(si.paid || 0);
  });
  PW.data.purchases.forEach(pu => {
    if (pu.paidAccountId === accountId) bal -= Number(pu.paid || 0);
  });
  return bal;
};

PW.totalCash = function () {
  return PW.data.cashAccounts.reduce((s, a) => s + PW.accountBalance(a.id), 0);
};

// Tổng số dư đầu kỳ của tất cả tài khoản tiền
PW.openingCash = function () {
  return PW.data.cashAccounts.reduce((s, a) => s + Number(a.opening || 0), 0);
};

// Tiền THU vào trong khoảng (phiếu thu + tiền thu từ bán hàng)
PW.cashIn = function (fromYmd, toYmd) {
  const inR = d => (!fromYmd || d >= fromYmd) && (!toYmd || d <= toYmd);
  let s = 0;
  PW.data.receipts.forEach(r => { if (inR(r.date)) s += Number(r.amount); });
  PW.data.salesInvoices.forEach(si => { if (inR(si.date)) s += Number(si.paid || 0); });
  return s;
};

// Tiền CHI ra trong khoảng (phiếu chi + tiền trả khi mua hàng)
PW.cashOut = function (fromYmd, toYmd) {
  const inR = d => (!fromYmd || d >= fromYmd) && (!toYmd || d <= toYmd);
  let s = 0;
  PW.data.payments.forEach(p => { if (inR(p.date)) s += Number(p.amount); });
  PW.data.purchases.forEach(pu => { if (inR(pu.date)) s += Number(pu.paid || 0); });
  return s;
};

// Số dư 1 tài khoản tiền TÍNH ĐẾN ngày (cắt theo ngày, dùng cho kiểm kê quỹ)
PW.balanceAsOf = function (accountId, toYmd) {
  const a = PW.account(accountId);
  if (!a) return 0;
  let bal = Number(a.opening || 0);
  const le = d => (!toYmd || d <= toYmd);
  PW.data.receipts.forEach(r => { if (r.accountId === accountId && le(r.date)) bal += Number(r.amount || 0); });
  PW.data.payments.forEach(p => { if (p.accountId === accountId && le(p.date)) bal -= Number(p.amount || 0); });
  PW.data.salesInvoices.forEach(si => { if (si.paidAccountId === accountId && le(si.date)) bal += Number(si.paid || 0); });
  PW.data.purchases.forEach(pu => { if (pu.paidAccountId === accountId && le(pu.date)) bal -= Number(pu.paid || 0); });
  return bal;
};

// Còn phải thu của 1 hóa đơn = gồm thuế − đã thu − trả lại (gắn HĐ) − giảm giá (gắn HĐ)
PW.invoiceRemaining = function (si) {
  let rem = PW.invoiceGrand(si) - Number(si.paid || 0);
  PW.data.salesReturns.forEach(sr => { if (sr.invoiceId === si.id) rem -= PW.returnGrand(sr); });
  PW.data.salesDiscounts.forEach(g => { if (g.invoiceId === si.id) rem -= PW.discountGrand(g); });
  return rem;
};
// Còn phải trả của 1 phiếu nhập = gồm thuế − đã trả − trả lại (gắn PN) − giảm giá (gắn PN)
PW.purchaseRemaining = function (pu) {
  let rem = PW.purchaseGrand(pu) - Number(pu.paid || 0);
  PW.data.purchaseReturns.forEach(pr => { if ((pr.purchaseId || pr.invoiceId) === pu.id) rem -= PW.purchaseReturnGrand(pr); });
  PW.data.purchaseDiscounts.forEach(g => { if ((g.purchaseId || g.invoiceId) === pu.id) rem -= PW.discountGrand(g); });
  return rem;
};

// Khoản phải THU đến hạn trong khoảng (dự báo dòng tiền vào)
PW.dueReceivables = function (fromYmd, toYmd) {
  const inR = d => (!fromYmd || d >= fromYmd) && (!toYmd || d <= toYmd);
  const out = [];
  PW.data.salesInvoices.forEach(si => {
    const rem = PW.invoiceRemaining(si);
    if (rem <= 0) return;
    const due = si.dueDate || si.date;
    if (inR(due)) out.push({ party: PW.customer(si.customerId), code: si.code, due: due, remaining: rem });
  });
  return out.sort((a, b) => a.due < b.due ? -1 : 1);
};

// Khoản phải TRẢ đến hạn trong khoảng (dự báo dòng tiền ra)
PW.duePayables = function (fromYmd, toYmd) {
  const inR = d => (!fromYmd || d >= fromYmd) && (!toYmd || d <= toYmd);
  const out = [];
  PW.data.purchases.forEach(pu => {
    const rem = PW.purchaseRemaining(pu);
    if (rem <= 0) return;
    const due = pu.dueDate || pu.date;
    if (inR(due)) out.push({ party: PW.supplier(pu.supplierId), code: pu.code, due: due, remaining: rem });
  });
  return out.sort((a, b) => a.due < b.due ? -1 : 1);
};

// Công nợ phải thu của 1 khách hàng (dương = khách còn nợ mình)
PW.customerDebt = function (customerId) {
  const c = PW.customer(customerId);
  if (!c) return 0;
  let debt = Number(c.openingDebt || 0);
  PW.data.salesInvoices.forEach(si => {
    if (si.customerId === customerId) {
      debt += PW.invoiceGrand(si) - Number(si.paid || 0);   // gồm thuế GTGT
    }
  });
  // Phiếu thu gắn với khách hàng (thu nợ)
  PW.data.receipts.forEach(r => {
    if (r.customerId === customerId) debt -= Number(r.amount);
  });
  // Trả lại hàng bán -> giảm công nợ phải thu (gồm thuế theo HĐ gốc)
  PW.data.salesReturns.forEach(sr => {
    if (sr.customerId === customerId) debt -= PW.returnGrand(sr);
  });
  // Giảm giá hàng bán -> giảm công nợ phải thu (gồm thuế)
  PW.data.salesDiscounts.forEach(g => {
    if (g.customerId === customerId) debt -= PW.discountGrand(g);
  });
  return debt;
};

// Công nợ phải trả cho 1 nhà cung cấp
PW.supplierDebt = function (supplierId) {
  const s = PW.supplier(supplierId);
  if (!s) return 0;
  let debt = Number(s.openingDebt || 0);
  PW.data.purchases.forEach(pu => {
    if (pu.supplierId === supplierId) {
      debt += PW.purchaseGrand(pu) - Number(pu.paid || 0);   // gồm thuế GTGT
    }
  });
  PW.data.payments.forEach(p => {
    if (p.supplierId === supplierId) debt -= Number(p.amount);
  });
  // Trả lại hàng mua -> giảm công nợ phải trả (gồm thuế theo phiếu nhập gốc)
  PW.data.purchaseReturns.forEach(pr => {
    if (pr.supplierId === supplierId) debt -= PW.purchaseReturnGrand(pr);
  });
  // Giảm giá hàng mua -> giảm công nợ phải trả (gồm thuế)
  PW.data.purchaseDiscounts.forEach(g => {
    if (g.supplierId === supplierId) debt -= PW.discountGrand(g);
  });
  return debt;
};

PW.totalReceivable = function () {
  return PW.data.customers.reduce((s, c) => s + PW.customerDebt(c.id), 0);
};
PW.totalPayable = function () {
  return PW.data.suppliers.reduce((s, x) => s + PW.supplierDebt(x.id), 0);
};

// Tuổi nợ phải thu: quá hạn = công nợ còn lại của các hóa đơn đã quá hạn thanh toán
PW.agingReceivable = function (todayYmd) {
  const today = todayYmd || PW.todayStr();
  let overdue = 0;
  PW.data.salesInvoices.forEach(si => {
    const rem = PW.invoiceRemaining(si);
    if (rem > 0 && si.dueDate && si.dueDate < today) overdue += rem;
  });
  const total = PW.totalReceivable();
  overdue = Math.max(0, Math.min(overdue, total));
  return { total, overdue, current: Math.max(0, total - overdue) };
};

// Tuổi nợ phải trả
PW.agingPayable = function (todayYmd) {
  const today = todayYmd || PW.todayStr();
  let overdue = 0;
  PW.data.purchases.forEach(pu => {
    const rem = PW.purchaseRemaining(pu);
    if (rem > 0 && pu.dueDate && pu.dueDate < today) overdue += rem;
  });
  const total = PW.totalPayable();
  overdue = Math.max(0, Math.min(overdue, total));
  return { total, overdue, current: Math.max(0, total - overdue) };
};

PW.todayStr = function () {
  const d = new Date(), p = x => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

// Giá trị tồn kho (theo giá vốn). Dùng unitCost (NVL/giá vốn trống -> giá mua bình quân, khớp COGS);
// BỎ combo (giá trị đã tính ở thành phần -> tránh đếm trùng) và dịch vụ (không có tồn).
PW.inventoryValue = function () {
  return PW.data.products.reduce((s, p) => (p.kind === 'combo' || p.kind === 'dichvu') ? s : s + PW.stockOf(p.id) * PW.unitCost(p), 0);
};

// Doanh thu thuần trong khoảng (đã trừ trả lại & giảm giá hàng bán)
PW.revenue = function (fromYmd, toYmd) {
  const inRange = d => (!fromYmd || d >= fromYmd) && (!toYmd || d <= toYmd);
  let rev = PW.data.salesInvoices.filter(si => inRange(si.date))
    .reduce((s, si) => s + PW.invoiceTotal(si), 0);
  rev -= PW.data.salesReturns.filter(sr => inRange(sr.date))
    .reduce((s, sr) => s + PW.returnTotal(sr), 0);
  rev -= PW.data.salesDiscounts.filter(g => inRange(g.date))
    .reduce((s, g) => s + Number(g.amount), 0);
  // Thu nhập từ sổ Claude (phiếu thu có cờ isRevenue) -> tính là doanh thu
  rev += PW.data.receipts.filter(r => r.isRevenue && inRange(r.date))
    .reduce((s, r) => s + Number(r.amount), 0);
  return rev;
};

// Giá vốn hàng bán trong khoảng (đã trừ giá vốn hàng trả lại)
PW.cogs = function (fromYmd, toYmd) {
  const inRange = d => (!fromYmd || d >= fromYmd) && (!toYmd || d <= toYmd);
  let total = 0;
  PW.data.salesInvoices.filter(si => inRange(si.date))
    .forEach(si => si.items.forEach(it => {
      const p = PW.product(it.productId);
      total += Number(it.qty) * PW.unitCost(p, si.date);
    }));
  // Phiếu "thất lạc" (noRestock): hàng không về kho -> KHÔNG hoàn giá vốn (giữ làm tổn thất)
  total -= PW.data.salesReturns.filter(sr => inRange(sr.date) && !sr.noRestock)
    .reduce((s, sr) => s + PW.returnCost(sr), 0);
  return total;
};

// Chi phí (phiếu chi không gắn NCC = chi phí hoạt động)
PW.expenses = function (fromYmd, toYmd) {
  return PW.data.payments
    .filter(p => !p.supplierId)
    .filter(p => (!fromYmd || p.date >= fromYmd) && (!toYmd || p.date <= toYmd))
    .reduce((s, p) => s + Number(p.amount), 0);
};

/* ---------- Xóa & nạp lại dữ liệu mẫu ---------- */
PW.reset = function () {
  PW.data = PW.seed();
  PW.save(true);   // xóa cố ý -> qua lớp chắn mất dữ liệu
};

/* ---------- Xuất / nhập dữ liệu (sao lưu) ---------- */
PW.exportJSON = function () {
  return JSON.stringify(PW.data, null, 2);
};
// Nhập file sao lưu. KIỂM TRA cấu trúc để tránh nhập nhầm file (vd file xuất 1 danh mục)
// làm mất sạch dữ liệu như sự cố trước. Việc cảnh báo "mất bao nhiêu" do giao diện lo.
PW.importJSON = function (text, opts) {
  opts = opts || {};
  const obj = JSON.parse(text);
  if (!obj || typeof obj !== 'object' || Array.isArray(obj))
    throw new Error('File không phải dữ liệu sao lưu hợp lệ.');
  const markers = ['meta', 'products', 'customers', 'salesInvoices', 'cashAccounts', 'suppliers', 'purchases'];
  if (markers.filter(k => k in obj).length < 2)
    throw new Error('File này KHÔNG giống bản sao lưu đầy đủ (thiếu cấu trúc dữ liệu). Đã hủy để tránh mất dữ liệu.');
  // TỰ kiểm mất dữ liệu (KHÔNG phụ thuộc giao diện) — bảo vệ cả chế độ offline & mọi caller (vd gọi qua console)
  const big = ['salesInvoices', 'customers', 'products', 'purchases', 'payments', 'employees', 'suppliers', 'salesOrders'];
  const cur = PW.data || {};
  const loss = big.filter(k => (cur[k] || []).length >= 3 && (!Array.isArray(obj[k]) || obj[k].length === 0));
  if (loss.length && !opts.allowLoss)
    throw new Error('File thiếu dữ liệu ở các mục đang có: ' + loss.join(', ') + '. Đã hủy để tránh mất dữ liệu.');
  PW.data = obj;
  PW._normalize();
  PW.save(loss.length > 0);   // chỉ bỏ qua lớp chắn server khi THỰC SỰ mất & đã được xác nhận; không mất -> để guard bảo vệ
};

/* ============================================================
   DỮ LIỆU MẪU — chủ đề đồ tiệc / trang trí
   ============================================================ */
PW.seed = function () {
  const today = '2026-06-03';
  const d = ymd => ymd;
  return {
    meta: { companyName: 'DALI', counters: { PT: 2, PC: 2, HD: 4, PN: 3, BG: 1, DH: 1, TL: 0, GG: 0, DMH: 1, TLM: 0, GGM: 0, NV: 3, KHO: 1, SX: 1, KK: 0 } },
    cashAccounts: [
      { id: 'acc_cash', name: 'Tiền mặt', type: 'cash', opening: 5000000 },
      { id: 'acc_bank', name: 'Tiền gửi ngân hàng (Vietcombank)', type: 'bank', opening: 30000000 },
    ],
    products: [
      { id: 'p1', code: 'TSH4050', name: 'Tranh số hóa 40x50 - Phong cảnh', unit: 'Bức', group: 'Tranh thành phẩm', cost: 45000, price: 75000, openingStock: 120,
        bom: [{ materialId: 'p7', qty: 1.2 }, { materialId: 'p5', qty: 0.3 }, { materialId: 'p4', qty: 1 }, { materialId: 'p10', qty: 1 }],
        channelPrices: { ch_dl: 60000, ch_shopee: 89000, ch_fahasa: 99000 } },
      { id: 'p2', code: 'TSH3040', name: 'Tranh số hóa 30x40 - Hoa', unit: 'Bức', group: 'Tranh thành phẩm', cost: 18000, price: 35000, openingStock: 200 },
      { id: 'p3', code: 'TTM-A3', name: 'Tranh tô màu theo số A3 (bộ)', unit: 'Bộ', group: 'Tranh thành phẩm', cost: 85000, price: 150000, openingStock: 60 },
      { id: 'p4', code: 'KH4050', name: 'Khung tranh gỗ 40x50', unit: 'Cái', group: 'Khung', cost: 12000, price: 25000, openingStock: 150 },
      { id: 'p5', code: 'MAU24', name: 'Bộ màu acrylic 24 màu', unit: 'Bộ', group: 'Vật tư', cost: 8000, price: 20000, openingStock: 300, minStock: 280 },
      { id: 'p6', code: 'COVE12', name: 'Bộ cọ vẽ 12 cây', unit: 'Bộ', group: 'Vật tư', cost: 5000, price: 15000, openingStock: 250 },
      { id: 'p7', code: 'CANVAS', name: 'Toan canvas (mét)', unit: 'Mét', group: 'Vật tư', cost: 3000, price: 10000, openingStock: 400, minStock: 300 },
      { id: 'p8', code: 'TDD3040', name: 'Tranh đính đá 30x40', unit: 'Bức', group: 'Tranh thành phẩm', cost: 22000, price: 45000, openingStock: 90 },
      { id: 'p9', code: 'GIAYA3', name: 'Giấy in tranh A3 (ream)', unit: 'Ream', group: 'Vật tư', cost: 24000, price: 48000, openingStock: 80 },
      { id: 'p10', code: 'STK-SO', name: 'Sticker số dán tranh', unit: 'Bộ', group: 'Phụ liệu', cost: 15000, price: 35000, openingStock: 100 },
    ],
    customers: [
      { id: 'c1', code: 'KH001', name: 'Shop Tranh Hồng Hà', phone: '0901234567', address: 'Cầu Giấy, Hà Nội', openingDebt: 0 },
      { id: 'c2', code: 'KH002', name: 'Đại lý Tranh ABC', phone: '0912345678', address: 'Q.3, TP.HCM', openingDebt: 2500000, isCollaborator: true, commissionPercent: 5 },
      { id: 'c3', code: 'KH003', name: 'Shopee DALI Official', phone: '0987654321', address: 'Online', openingDebt: 0 },
      { id: 'c4', code: 'KH004', name: 'Khách lẻ', phone: '', address: '', openingDebt: 0 },
    ],
    suppliers: [
      { id: 's1', code: 'NCC001', name: 'Xưởng in canvas Kansai', phone: '02838123456', address: 'KCN Tân Bình', openingDebt: 0 },
      { id: 's2', code: 'NCC002', name: 'NCC màu & cọ vẽ Hà Nội', phone: '02839987654', address: 'Hoàn Kiếm, Hà Nội', openingDebt: 5000000 },
      { id: 's3', code: 'NCC003', name: 'Xưởng khung gỗ Thành Phát', phone: '0908111222', address: 'Q.7, TP.HCM', openingDebt: 0 },
    ],
    receipts: [
      { id: 'r1', code: 'PT00001', date: d('2026-05-10'), accountId: 'acc_cash', customerId: 'c2', amount: 1500000, reason: 'Thu nợ khách hàng', note: '' },
    ],
    payments: [
      { id: 'pm1', code: 'PC00001', date: d('2026-05-12'), accountId: 'acc_cash', supplierId: null, amount: 800000, reason: 'Chi phí vận chuyển', note: '' },
      { id: 'pm2', code: 'PC00002', date: d('2026-05-20'), accountId: 'acc_bank', supplierId: 's2', amount: 3000000, reason: 'Trả nợ nhà cung cấp', note: '' },
    ],
    salesInvoices: [
      { id: 'h1', code: 'HD00001', date: d('2026-05-05'), customerId: 'c1', channelId: 'ch_dl', vatRate: 8,
        items: [{ productId: 'p3', qty: 10, price: 150000 }, { productId: 'p1', qty: 5, price: 75000 }],
        discount: 0, paid: 1875000, paidAccountId: 'acc_cash', note: 'Bán sỉ shop tranh' },
      { id: 'h2', code: 'HD00002', date: d('2026-05-15'), customerId: 'c2', dueDate: d('2026-05-30'), channelId: 'ch_le',
        items: [{ productId: 'p4', qty: 20, price: 25000 }, { productId: 'p5', qty: 30, price: 20000 }, { productId: 'p6', qty: 40, price: 15000 }],
        discount: 100000, paid: 0, paidAccountId: null, note: 'Công nợ - đã quá hạn' },
      { id: 'h3', code: 'HD00003', date: d('2026-05-25'), customerId: 'c3', channelId: 'ch_shopee',
        platformFee: 209000, shippingFee: 30000,
        items: [{ productId: 'p7', qty: 100, price: 10000 }, { productId: 'p8', qty: 20, price: 45000 }],
        discount: 0, paid: 1661000, paidAccountId: 'acc_bank', note: 'Đơn Shopee đã đối soát' },
    ],
    purchases: [
      { id: 'pu1', code: 'PN00001', date: d('2026-05-02'), supplierId: 's1',
        items: [{ productId: 'p1', qty: 100, cost: 45000 }, { productId: 'p2', qty: 150, cost: 18000 }],
        paid: 7200000, paidAccountId: 'acc_bank', note: 'Nhập đầu tháng' },
      { id: 'pu2', code: 'PN00002', date: d('2026-05-18'), supplierId: 's2', dueDate: d('2026-06-20'),
        items: [{ productId: 'p4', qty: 100, cost: 12000 }, { productId: 'p5', qty: 200, cost: 8000 }],
        paid: 0, paidAccountId: null, note: 'Công nợ - trong hạn' },
    ],
    quotations: [
      { id: 'q1', code: 'BG00001', date: d('2026-05-28'), customerId: 'c3',
        items: [{ productId: 'p3', qty: 20, price: 150000 }, { productId: 'p10', qty: 30, price: 35000 }],
        discount: 0, status: 'open', note: 'Báo giá đại lý' },
    ],
    salesOrders: [
      { id: 'o1', code: 'DH00001', date: d('2026-05-30'), customerId: 'c1',
        items: [{ productId: 'p1', qty: 30, price: 75000 }, { productId: 'p6', qty: 50, price: 15000 }],
        discount: 0, status: 'open', note: 'Đơn đặt hàng tháng 6' },
    ],
    salesReturns: [],
    salesDiscounts: [],
    purchaseOrders: [
      { id: 'po1', code: 'DMH00001', date: d('2026-05-29'), supplierId: 's1',
        items: [{ productId: 'p2', qty: 100, cost: 18000 }, { productId: 'p3', qty: 40, cost: 85000 }],
        discount: 0, status: 'open', note: 'Đặt mua bổ sung tháng 6' },
    ],
    purchaseReturns: [],
    purchaseDiscounts: [],
    employees: [
      { id: 'nv1', code: 'NV00001', name: 'Nguyễn Thị Hoa', phone: '0903111222', position: 'Quản lý cửa hàng',
        salaryBase: 5500000, allowResp: 4500000, allowTransport: 1500000, allowLunch: 1500000, allowSeniority: 500000 },
      { id: 'nv2', code: 'NV00002', name: 'Trần Văn Nam', phone: '0903333444', position: 'Nhân viên bán hàng',
        salaryBase: 5000000, allowResp: 0, allowTransport: 1500000, allowLunch: 1500000, allowSeniority: 0 },
      { id: 'nv3', code: 'NV00003', name: 'Lê Thị Mai', phone: '0903555666', position: 'Kế toán',
        salaryBase: 5000000, allowResp: 0, allowTransport: 1500000, allowLunch: 1500000, allowSeniority: 0 },
    ],
    productGroups: [
      { id: 'g1', name: 'Bóng bay' }, { id: 'g2', name: 'Trang trí' },
      { id: 'g3', name: 'Phụ kiện' }, { id: 'g4', name: 'Quà tặng' },
    ],
    units: [
      { id: 'u1', name: 'Cái' }, { id: 'u2', name: 'Gói' }, { id: 'u3', name: 'Set' },
      { id: 'u4', name: 'Cuộn' }, { id: 'u5', name: 'Hộp' }, { id: 'u6', name: 'Chiếc' },
    ],
    warehouses: [
      { id: 'w1', code: 'KHO00001', name: 'Kho chính', address: 'Cửa hàng DALI' },
    ],
    expenseItems: [
      { id: 'e1', name: 'Chi phí vận chuyển' }, { id: 'e2', name: 'Chi phí mặt bằng' },
      { id: 'e3', name: 'Lương nhân viên' }, { id: 'e4', name: 'Chi phí điện nước' },
      { id: 'e5', name: 'Chi phí marketing' }, { id: 'e6', name: 'Chi phí khác' },
    ],
    paymentTerms: [
      { id: 't0', name: 'Trả ngay', days: 0 }, { id: 't1', name: 'Nợ 15 ngày', days: 15 },
      { id: 't2', name: 'Nợ 30 ngày', days: 30 }, { id: 't3', name: 'Nợ 45 ngày', days: 45 },
    ],
    partnerGroups: [
      { id: 'pg1', name: 'Khách lẻ' }, { id: 'pg2', name: 'Đại lý' },
      { id: 'pg3', name: 'Cộng tác viên (CTV)' }, { id: 'pg4', name: 'Khách sỉ' },
    ],
    payrolls: [],
    productionOrders: [
      { id: 'sx1', code: 'SX00001', date: d('2026-05-22'), productId: 'p1', qty: 50,
        materials: [{ productId: 'p7', qty: 60 }, { productId: 'p5', qty: 15 }, { productId: 'p4', qty: 50 }, { productId: 'p10', qty: 50 }],
        laborCost: 750000, otherCost: 50000, note: 'Sản xuất tranh 40x50 đợt 1' },
    ],
    stockAdjustments: [],
    productivityEntries: [
      { id: 'ns1', date: d('2026-06-02'), employeeId: 'nv1', pha: 5, tranhRot: 40, mauRot: 520, sx: 0, note: '' },
      { id: 'ns2', date: d('2026-06-02'), employeeId: 'nv2', pha: 0, tranhRot: 0, mauRot: 0, sx: 30, note: 'Sản xuất tranh' },
      { id: 'ns3', date: d('2026-06-03'), employeeId: 'nv1', pha: 6, tranhRot: 35, mauRot: 480, sx: 0, note: '' },
      { id: 'ns4', date: d('2026-06-03'), employeeId: 'nv3', pha: 0, tranhRot: 22, mauRot: 300, sx: 0, note: '' },
    ],
    channels: [
      { id: 'ch_le', name: 'Bán lẻ', feePercent: 0, isPlatform: false },
      { id: 'ch_dl', name: 'Đại lý / Sỉ', feePercent: 0, isPlatform: false },
      { id: 'ch_shopee', name: 'Shopee', feePercent: 11, isPlatform: true },
      { id: 'ch_fahasa', name: 'Fahasa (ký gửi)', feePercent: 30, isPlatform: true },
      { id: 'ch_tiktok', name: 'TikTok Shop', feePercent: 8, isPlatform: true },
    ],
  };
};

/* ---------- Truy vấn nhanh (bổ sung) ---------- */
PW.quotation = id => PW.data.quotations.find(x => x.id === id);
PW.salesOrder = id => PW.data.salesOrders.find(x => x.id === id);
PW.purchaseOrder = id => PW.data.purchaseOrders.find(x => x.id === id);
