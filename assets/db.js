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
    'payrolls', 'productionOrders'];
  tables.forEach(t => { if (!PW.data[t]) PW.data[t] = []; });
  if (!PW.data.meta) PW.data.meta = { companyName: 'DALI', counters: {} };
  if (!PW.data.meta.counters) PW.data.meta.counters = {};
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
PW.save = function () {
  if (PW.mode === 'server') {
    // Gộp nhiều thay đổi liên tiếp, lưu sau 600ms
    clearTimeout(PW._saveTimer);
    PW._saveTimer = setTimeout(() => { PW.saveNow(); }, 600);
    return;
  }
  localStorage.setItem(PW.KEY, JSON.stringify(PW.data));
};

// Lưu ngay lên server (chế độ server)
PW.saveNow = async function () {
  if (PW.mode !== 'server') return;
  clearTimeout(PW._saveTimer);
  const r = await PW.api('data.php?action=save', {
    method: 'POST',
    body: JSON.stringify({ data: PW.data, version: PW._version }),
  });
  if (r.status === 200 && r.data && r.data.ok) {
    PW._version = r.data.version;
  } else if (r.status === 409) {
    // Người khác vừa cập nhật -> tải lại để tránh mất dữ liệu
    if (typeof U !== 'undefined') U.toast('Dữ liệu vừa được người khác cập nhật, đang tải lại...', 'error');
    setTimeout(() => location.reload(), 1500);
  } else if (r.status === 401) {
    location.reload();
  } else if (typeof U !== 'undefined') {
    U.toast('Lỗi lưu dữ liệu lên server', 'error');
  }
};

/* ---------- Sinh mã / id ---------- */
PW.uid = function () {
  return 'id' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
};

PW.nextCode = function (prefix) {
  const c = PW.data.meta.counters;
  c[prefix] = (c[prefix] || 0) + 1;
  PW.save();
  return prefix + String(c[prefix]).padStart(5, '0');
};

/* ---------- Truy vấn nhanh ---------- */
PW.product = id => PW.data.products.find(p => p.id === id);
PW.customer = id => PW.data.customers.find(c => c.id === id);
PW.supplier = id => PW.data.suppliers.find(s => s.id === id);
PW.account = id => PW.data.cashAccounts.find(a => a.id === id);

/* ---------- Tính toán số dư / công nợ / tồn kho ---------- */

// Tồn kho hiện tại của 1 sản phẩm
PW.stockOf = function (productId) {
  const p = PW.product(productId);
  if (!p) return 0;
  let qty = Number(p.openingStock || 0);
  PW.data.purchases.forEach(pu => {
    pu.items.forEach(it => { if (it.productId === productId) qty += Number(it.qty); });
  });
  PW.data.salesInvoices.forEach(si => {
    si.items.forEach(it => { if (it.productId === productId) qty -= Number(it.qty); });
  });
  // Trả lại hàng bán -> hàng nhập lại kho
  PW.data.salesReturns.forEach(sr => {
    sr.items.forEach(it => { if (it.productId === productId) qty += Number(it.qty); });
  });
  // Trả lại hàng mua -> xuất khỏi kho trả nhà cung cấp
  PW.data.purchaseReturns.forEach(pr => {
    pr.items.forEach(it => { if (it.productId === productId) qty -= Number(it.qty); });
  });
  // Sản xuất: thành phẩm nhập kho (+), NVL tiêu hao (-)
  PW.data.productionOrders.forEach(po => {
    if (po.productId === productId) qty += Number(po.qty);
    (po.materials || []).forEach(m => { if (m.productId === productId) qty -= Number(m.qty); });
  });
  return qty;
};

// Giá vốn NVL theo định mức (BOM) cho 1 thành phẩm
PW.bomMaterialCost = function (product) {
  return (product.bom || []).reduce((s, b) => {
    const p = PW.product(b.materialId);
    return s + Number(b.qty) * Number(p ? p.cost : 0);
  }, 0);
};
// Giá thành 1 đơn vị của 1 lệnh sản xuất = (NVL + công + chi phí khác) / số lượng
PW.productionUnitCost = function (po) {
  const matCost = (po.materials || []).reduce((s, m) => {
    const p = PW.product(m.productId);
    return s + Number(m.qty) * Number(p ? p.cost : 0);
  }, 0);
  const total = matCost + Number(po.laborCost || 0) + Number(po.otherCost || 0);
  return Number(po.qty) > 0 ? total / Number(po.qty) : 0;
};
PW.productionTotalCost = function (po) {
  const matCost = (po.materials || []).reduce((s, m) => {
    const p = PW.product(m.productId);
    return s + Number(m.qty) * Number(p ? p.cost : 0);
  }, 0);
  return matCost + Number(po.laborCost || 0) + Number(po.otherCost || 0);
};

// Tổng giá trị 1 phiếu trả lại hàng bán (theo giá bán)
PW.returnTotal = function (sr) {
  return sr.items.reduce((s, it) => s + Number(it.qty) * Number(it.price), 0);
};
// Tổng giá trị 1 phiếu trả lại hàng mua (theo giá nhập)
PW.purchaseReturnTotal = function (pr) {
  return pr.items.reduce((s, it) => s + Number(it.qty) * Number(it.cost), 0);
};
// Giá vốn hàng trả lại
PW.returnCost = function (sr) {
  return sr.items.reduce((s, it) => {
    const p = PW.product(it.productId);
    return s + Number(it.qty) * Number(p ? p.cost : 0);
  }, 0);
};

// Tổng tiền 1 hóa đơn bán
PW.invoiceTotal = function (si) {
  const sub = si.items.reduce((s, it) => s + Number(it.qty) * Number(it.price), 0);
  return sub - Number(si.discount || 0);
};

// Tổng tiền 1 phiếu nhập mua
PW.purchaseTotal = function (pu) {
  return pu.items.reduce((s, it) => s + Number(it.qty) * Number(it.cost), 0);
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

// Công nợ phải thu của 1 khách hàng (dương = khách còn nợ mình)
PW.customerDebt = function (customerId) {
  const c = PW.customer(customerId);
  if (!c) return 0;
  let debt = Number(c.openingDebt || 0);
  PW.data.salesInvoices.forEach(si => {
    if (si.customerId === customerId) {
      debt += PW.invoiceTotal(si) - Number(si.paid || 0);
    }
  });
  // Phiếu thu gắn với khách hàng (thu nợ)
  PW.data.receipts.forEach(r => {
    if (r.customerId === customerId) debt -= Number(r.amount);
  });
  // Trả lại hàng bán -> giảm công nợ phải thu
  PW.data.salesReturns.forEach(sr => {
    if (sr.customerId === customerId) debt -= PW.returnTotal(sr);
  });
  // Giảm giá hàng bán -> giảm công nợ phải thu
  PW.data.salesDiscounts.forEach(g => {
    if (g.customerId === customerId) debt -= Number(g.amount);
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
      debt += PW.purchaseTotal(pu) - Number(pu.paid || 0);
    }
  });
  PW.data.payments.forEach(p => {
    if (p.supplierId === supplierId) debt -= Number(p.amount);
  });
  // Trả lại hàng mua -> giảm công nợ phải trả
  PW.data.purchaseReturns.forEach(pr => {
    if (pr.supplierId === supplierId) debt -= PW.purchaseReturnTotal(pr);
  });
  // Giảm giá hàng mua -> giảm công nợ phải trả
  PW.data.purchaseDiscounts.forEach(g => {
    if (g.supplierId === supplierId) debt -= Number(g.amount);
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
    const rem = PW.invoiceTotal(si) - Number(si.paid || 0);
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
    const rem = PW.purchaseTotal(pu) - Number(pu.paid || 0);
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

// Giá trị tồn kho (theo giá vốn)
PW.inventoryValue = function () {
  return PW.data.products.reduce((s, p) => s + PW.stockOf(p.id) * Number(p.cost || 0), 0);
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
  return rev;
};

// Giá vốn hàng bán trong khoảng (đã trừ giá vốn hàng trả lại)
PW.cogs = function (fromYmd, toYmd) {
  const inRange = d => (!fromYmd || d >= fromYmd) && (!toYmd || d <= toYmd);
  let total = 0;
  PW.data.salesInvoices.filter(si => inRange(si.date))
    .forEach(si => si.items.forEach(it => {
      const p = PW.product(it.productId);
      total += Number(it.qty) * Number(p ? p.cost : 0);
    }));
  total -= PW.data.salesReturns.filter(sr => inRange(sr.date))
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
  PW.save();
};

/* ---------- Xuất / nhập dữ liệu (sao lưu) ---------- */
PW.exportJSON = function () {
  return JSON.stringify(PW.data, null, 2);
};
PW.importJSON = function (text) {
  PW.data = JSON.parse(text);
  PW.save();
};

/* ============================================================
   DỮ LIỆU MẪU — chủ đề đồ tiệc / trang trí
   ============================================================ */
PW.seed = function () {
  const today = '2026-06-03';
  const d = ymd => ymd;
  return {
    meta: { companyName: 'DALI', counters: { PT: 2, PC: 2, HD: 4, PN: 3, BG: 1, DH: 1, TL: 0, GG: 0, DMH: 1, TLM: 0, GGM: 0, NV: 3, KHO: 1, SX: 1 } },
    cashAccounts: [
      { id: 'acc_cash', name: 'Tiền mặt', type: 'cash', opening: 5000000 },
      { id: 'acc_bank', name: 'Tiền gửi ngân hàng (Vietcombank)', type: 'bank', opening: 30000000 },
    ],
    products: [
      { id: 'p1', code: 'TSH4050', name: 'Tranh số hóa 40x50 - Phong cảnh', unit: 'Bức', group: 'Tranh thành phẩm', cost: 45000, price: 75000, openingStock: 120,
        bom: [{ materialId: 'p7', qty: 1.2 }, { materialId: 'p5', qty: 0.3 }, { materialId: 'p4', qty: 1 }, { materialId: 'p10', qty: 1 }] },
      { id: 'p2', code: 'TSH3040', name: 'Tranh số hóa 30x40 - Hoa', unit: 'Bức', group: 'Tranh thành phẩm', cost: 18000, price: 35000, openingStock: 200 },
      { id: 'p3', code: 'TTM-A3', name: 'Tranh tô màu theo số A3 (bộ)', unit: 'Bộ', group: 'Tranh thành phẩm', cost: 85000, price: 150000, openingStock: 60 },
      { id: 'p4', code: 'KH4050', name: 'Khung tranh gỗ 40x50', unit: 'Cái', group: 'Khung', cost: 12000, price: 25000, openingStock: 150 },
      { id: 'p5', code: 'MAU24', name: 'Bộ màu acrylic 24 màu', unit: 'Bộ', group: 'Vật tư', cost: 8000, price: 20000, openingStock: 300 },
      { id: 'p6', code: 'COVE12', name: 'Bộ cọ vẽ 12 cây', unit: 'Bộ', group: 'Vật tư', cost: 5000, price: 15000, openingStock: 250 },
      { id: 'p7', code: 'CANVAS', name: 'Toan canvas (mét)', unit: 'Mét', group: 'Vật tư', cost: 3000, price: 10000, openingStock: 400 },
      { id: 'p8', code: 'TDD3040', name: 'Tranh đính đá 30x40', unit: 'Bức', group: 'Tranh thành phẩm', cost: 22000, price: 45000, openingStock: 90 },
      { id: 'p9', code: 'GIAYA3', name: 'Giấy in tranh A3 (ream)', unit: 'Ream', group: 'Vật tư', cost: 24000, price: 48000, openingStock: 80 },
      { id: 'p10', code: 'STK-SO', name: 'Sticker số dán tranh', unit: 'Bộ', group: 'Phụ liệu', cost: 15000, price: 35000, openingStock: 100 },
    ],
    customers: [
      { id: 'c1', code: 'KH001', name: 'Shop Tranh Hồng Hà', phone: '0901234567', address: 'Cầu Giấy, Hà Nội', openingDebt: 0 },
      { id: 'c2', code: 'KH002', name: 'Đại lý Tranh ABC', phone: '0912345678', address: 'Q.3, TP.HCM', openingDebt: 2500000 },
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
      { id: 'h1', code: 'HD00001', date: d('2026-05-05'), customerId: 'c1',
        items: [{ productId: 'p3', qty: 10, price: 150000 }, { productId: 'p1', qty: 5, price: 75000 }],
        discount: 0, paid: 1875000, paidAccountId: 'acc_cash', note: 'Bán sỉ shop tranh' },
      { id: 'h2', code: 'HD00002', date: d('2026-05-15'), customerId: 'c2', dueDate: d('2026-05-30'),
        items: [{ productId: 'p4', qty: 20, price: 25000 }, { productId: 'p5', qty: 30, price: 20000 }, { productId: 'p6', qty: 40, price: 15000 }],
        discount: 100000, paid: 0, paidAccountId: null, note: 'Công nợ - đã quá hạn' },
      { id: 'h3', code: 'HD00003', date: d('2026-05-25'), customerId: 'c3',
        items: [{ productId: 'p7', qty: 100, price: 10000 }, { productId: 'p8', qty: 20, price: 45000 }],
        discount: 0, paid: 1900000, paidAccountId: 'acc_bank', note: '' },
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
  };
};

/* ---------- Truy vấn nhanh (bổ sung) ---------- */
PW.quotation = id => PW.data.quotations.find(x => x.id === id);
PW.salesOrder = id => PW.data.salesOrders.find(x => x.id === id);
PW.purchaseOrder = id => PW.data.purchaseOrders.find(x => x.id === id);
