/* ============================================================
   reports.js — Báo cáo
   ============================================================ */

M.reports = function (root) {
  // Bộ lọc thời gian
  const year = U.today().slice(0, 4);
  const fromI = C.input({ type: 'date', value: year + '-01-01' });
  const toI = C.input({ type: 'date', value: U.today() });
  const typeSel = C.select([
    { value: 'pl', label: 'Kết quả kinh doanh (Lãi/Lỗ)' },
    { value: 'revenue', label: 'Doanh thu theo mặt hàng' },
    { value: 'revenueByEmployee', label: 'Doanh thu theo nhân viên bán' },
    { value: 'purchaseByItem', label: 'Tổng hợp mua hàng theo mặt hàng' },
    { value: 'inventory', label: 'Tồn kho hiện tại' },
    { value: 'productCost', label: 'Giá thành sản phẩm (sản xuất)' },
    { value: 'inout', label: 'Nhập - Xuất - Tồn kho' },
    { value: 'receivable', label: 'Công nợ phải thu' },
    { value: 'payable', label: 'Công nợ phải trả' },
    { value: 'cashbook', label: 'Sổ quỹ tiền (thu/chi)' },
  ], App._reportPreset || 'pl');
  App._reportPreset = null;

  const toolbar = U.el('div', { class: 'toolbar' });
  toolbar.appendChild(U.el('div', { class: 'field', style: 'margin:0' }, [U.el('label', null, 'Loại báo cáo'), typeSel]));
  toolbar.appendChild(U.el('div', { class: 'field', style: 'margin:0' }, [U.el('label', null, 'Từ ngày'), fromI]));
  toolbar.appendChild(U.el('div', { class: 'field', style: 'margin:0' }, [U.el('label', null, 'Đến ngày'), toI]));
  toolbar.appendChild(U.el('div', { class: 'field', style: 'margin:0' }, [U.el('label', null, ' '), C.btn('Xem báo cáo', run, 'primary')]));
  toolbar.appendChild(U.el('div', { class: 'field', style: 'margin:0' }, [U.el('label', null, ' '), C.btn('📊 Xuất Excel', exportReport)]));
  toolbar.appendChild(U.el('div', { class: 'field', style: 'margin:0' }, [U.el('label', null, ' '), C.btn('🖨 In', () => window.print())]));

  const card = U.el('div', { class: 'card' });
  card.appendChild(toolbar);
  const host = U.el('div');
  card.appendChild(host);
  root.appendChild(card);

  function run() {
    const from = fromI.value, to = toI.value, type = typeSel.value;
    host.innerHTML = '';
    const title = U.el('div', { class: 'card-title' }, typeSel.options[typeSel.selectedIndex].text +
      `  (${U.date(from)} – ${U.date(to)})`);
    host.appendChild(title);

    if (type === 'pl') return M.reportPL(host, from, to);
    if (type === 'revenue') return M.reportRevenue(host, from, to);
    if (type === 'revenueByEmployee') return M.reportRevenueByEmployee(host, from, to);
    if (type === 'purchaseByItem') return M.reportPurchaseByItem(host, from, to);
    if (type === 'inventory') return M.reportInventory(host);
    if (type === 'productCost') return M.reportProductCost(host, from, to);
    if (type === 'inout') return M.reportInOut(host, from, to);
    if (type === 'receivable') return M.reportReceivable(host);
    if (type === 'payable') return M.reportPayable(host);
    if (type === 'cashbook') return M.reportCashbook(host, from, to);
  }
  function exCell(s) {
    if (s === '' || s === '-') return '';
    const neg = /^\(.*\)$/.test(s);
    const core = s.replace(/[()₫đ\s]/g, '').replace(/\./g, '').replace(',', '.');
    if (/^-?\d+(\.\d+)?$/.test(core)) { const n = parseFloat(core); return neg ? -n : n; }
    return s;
  }
  function exportReport() {
    const t = host.querySelector('table');
    if (!t) return U.toast('Chưa có dữ liệu để xuất', 'error');
    let headers = [].map.call(t.querySelectorAll('thead th'), th => th.textContent.trim());
    const rows = [];
    t.querySelectorAll('tr').forEach(tr => {
      if (tr.closest('thead') || tr.closest('tfoot')) return; // bỏ dòng tiêu đề & tổng cộng
      const tds = tr.querySelectorAll('td');
      if (!tds.length) return;
      rows.push([].map.call(tds, td => exCell(td.textContent.trim())));
    });
    if (!rows.length) return U.toast('Báo cáo trống', 'error');
    if (!headers.length) headers = rows[0].map((_, i) => (rows[0].length === 2 ? ['Nội dung', 'Số tiền'][i] : 'Cột ' + (i + 1)));
    const label = typeSel.options[typeSel.selectedIndex].text;
    U.exportExcel('BaoCao_' + typeSel.value, headers, rows, label + ' (' + U.date(fromI.value) + ' - ' + U.date(toI.value) + ')');
  }

  typeSel.addEventListener('change', run);
  run();
};

M.reportPL = function (host, from, to) {
  const rev = PW.revenue(from, to);
  const cogs = PW.cogs(from, to);
  const gross = rev - cogs;
  const exp = PW.expenses(from, to);
  const profit = gross - exp;
  const rows = [
    ['Doanh thu bán hàng', rev, 'text-green'],
    ['Giá vốn hàng bán', -cogs, 'text-red'],
    ['Lợi nhuận gộp', gross, gross >= 0 ? 'text-green' : 'text-red'],
    ['Chi phí hoạt động (phiếu chi)', -exp, 'text-red'],
    ['LỢI NHUẬN THUẦN', profit, profit >= 0 ? 'text-green' : 'text-red'],
  ];
  const t = U.el('table', { class: 'tbl' });
  rows.forEach(([k, v, cls], i) => {
    const bold = (i === rows.length - 1 || k === 'Lợi nhuận gộp');
    t.appendChild(U.el('tr', null, [
      U.el('td', { style: bold ? 'font-weight:700' : '' }, k),
      U.el('td', { class: 'num ' + cls, style: bold ? 'font-weight:700' : '' }, U.money(v)),
    ]));
  });
  host.appendChild(U.el('div', { class: 'table-wrap' }, t));
};

M.reportRevenue = function (host, from, to) {
  const agg = {};
  PW.data.salesInvoices.filter(si => si.date >= from && si.date <= to).forEach(si =>
    si.items.forEach(it => {
      agg[it.productId] = agg[it.productId] || { qty: 0, rev: 0, cogs: 0 };
      const p = PW.product(it.productId);
      agg[it.productId].qty += Number(it.qty);
      agg[it.productId].rev += Number(it.qty) * Number(it.price);
      agg[it.productId].cogs += Number(it.qty) * Number(p ? p.cost : 0);
    }));
  const rows = Object.keys(agg).map(pid => ({ p: PW.product(pid), ...agg[pid] })).filter(r => r.p)
    .sort((a, b) => b.rev - a.rev);
  const totRev = rows.reduce((s, r) => s + r.rev, 0);
  const totCogs = rows.reduce((s, r) => s + r.cogs, 0);
  host.appendChild(C.table(rows, [
    { label: 'Mã', render: r => U.esc(r.p.code) },
    { label: 'Tên hàng', render: r => U.esc(r.p.name) },
    { label: 'SL bán', num: true, render: r => U.num(r.qty) },
    { label: 'Doanh thu', num: true, render: r => U.money(r.rev) },
    { label: 'Giá vốn', num: true, render: r => U.money(r.cogs) },
    { label: 'Lãi gộp', num: true, render: r => `<span class="${r.rev - r.cogs >= 0 ? 'text-green' : 'text-red'}">${U.money(r.rev - r.cogs)}</span>` },
  ], { empty: 'Không có dữ liệu trong kỳ', footer: [
    { html: 'TỔNG CỘNG', colspan: 3 },
    { html: U.money(totRev), num: true },
    { html: U.money(totCogs), num: true },
    { html: U.money(totRev - totCogs), num: true },
  ] }));
};

M.reportRevenueByEmployee = function (host, from, to) {
  const agg = {}; const noEmp = { rev: 0, cnt: 0 };
  PW.data.salesInvoices.filter(si => si.date >= from && si.date <= to).forEach(si => {
    const total = PW.invoiceTotal(si);
    if (si.employeeId) {
      agg[si.employeeId] = agg[si.employeeId] || { rev: 0, cnt: 0 };
      agg[si.employeeId].rev += total; agg[si.employeeId].cnt++;
    } else { noEmp.rev += total; noEmp.cnt++; }
  });
  const rows = Object.keys(agg).map(eid => {
    const e = PW.data.employees.find(x => x.id === eid);
    return { name: e ? e.name : '(NV đã xóa)', code: e ? e.code : '', rev: agg[eid].rev, cnt: agg[eid].cnt };
  }).sort((a, b) => b.rev - a.rev);
  if (noEmp.cnt) rows.push({ name: '(Chưa gán nhân viên)', code: '', rev: noEmp.rev, cnt: noEmp.cnt });
  const tot = rows.reduce((s, r) => s + r.rev, 0);
  const totCnt = rows.reduce((s, r) => s + r.cnt, 0);
  host.appendChild(C.table(rows, [
    { label: 'Mã NV', render: r => U.esc(r.code) },
    { label: 'Nhân viên bán', render: r => U.esc(r.name) },
    { label: 'Số hóa đơn', num: true, render: r => U.num(r.cnt) },
    { label: 'Doanh thu', num: true, render: r => U.money(r.rev) },
    { label: 'Tỷ trọng', num: true, render: r => (tot > 0 ? (r.rev / tot * 100).toFixed(1) : '0') + '%' },
  ], { empty: 'Chưa có hóa đơn bán trong kỳ', footer: [
    { html: 'TỔNG CỘNG', colspan: 2 },
    { html: U.num(totCnt), num: true },
    { html: U.money(tot), num: true },
    { html: '100%', num: true },
  ] }));
};

M.reportPurchaseByItem = function (host, from, to) {
  const agg = {};
  PW.data.purchases.filter(pu => pu.date >= from && pu.date <= to).forEach(pu =>
    pu.items.forEach(it => {
      agg[it.productId] = agg[it.productId] || { qty: 0, val: 0 };
      agg[it.productId].qty += Number(it.qty);
      agg[it.productId].val += Number(it.qty) * Number(it.cost);
    }));
  // trừ hàng trả lại nhà cung cấp
  PW.data.purchaseReturns.filter(pr => pr.date >= from && pr.date <= to).forEach(pr =>
    pr.items.forEach(it => {
      agg[it.productId] = agg[it.productId] || { qty: 0, val: 0 };
      agg[it.productId].qty -= Number(it.qty);
      agg[it.productId].val -= Number(it.qty) * Number(it.cost);
    }));
  const rows = Object.keys(agg).map(pid => ({ p: PW.product(pid), ...agg[pid] })).filter(r => r.p)
    .sort((a, b) => b.val - a.val);
  const totQty = rows.reduce((s, r) => s + r.qty, 0);
  const totVal = rows.reduce((s, r) => s + r.val, 0);
  host.appendChild(C.table(rows, [
    { label: 'Mã', render: r => U.esc(r.p.code) },
    { label: 'Tên hàng', render: r => U.esc(r.p.name) },
    { label: 'ĐVT', center: true, render: r => U.esc(r.p.unit) },
    { label: 'SL nhập (đã trừ trả lại)', num: true, render: r => U.num(r.qty) },
    { label: 'Giá trị mua', num: true, render: r => U.money(r.val) },
  ], { empty: 'Không có dữ liệu mua hàng trong kỳ', footer: [
    { html: 'TỔNG CỘNG', colspan: 3 },
    { html: U.num(totQty), num: true },
    { html: U.money(totVal), num: true },
  ] }));
};

M.reportProductCost = function (host, from, to) {
  // Giá thành SX trung bình từ các lệnh sản xuất trong kỳ (theo từng thành phẩm)
  const prodAgg = {};
  PW.data.productionOrders.filter(po => po.date >= from && po.date <= to).forEach(po => {
    prodAgg[po.productId] = prodAgg[po.productId] || { qty: 0, cost: 0 };
    prodAgg[po.productId].qty += Number(po.qty);
    prodAgg[po.productId].cost += PW.productionTotalCost(po);
  });
  // Thành phẩm = có BOM hoặc từng được sản xuất
  const rows = PW.data.products.filter(p => (p.bom && p.bom.length) || prodAgg[p.id]).map(p => {
    const nvl = PW.bomMaterialCost(p);
    const ag = prodAgg[p.id];
    const avgCost = ag && ag.qty > 0 ? ag.cost / ag.qty : null;
    const cost = avgCost != null ? avgCost : Number(p.cost || 0);
    const profit = Number(p.price || 0) - cost;
    return { p, nvl, avgCost, cost, price: Number(p.price || 0), profit };
  });
  host.appendChild(C.table(rows, [
    { label: 'Mã', render: r => U.esc(r.p.code) },
    { label: 'Thành phẩm', render: r => U.esc(r.p.name) },
    { label: 'NVL/đv (định mức)', num: true, render: r => U.money(r.nvl) },
    { label: 'Giá thành SX TB', num: true, render: r => r.avgCost != null ? U.money(r.avgCost) : '<span class="text-muted">—</span>' },
    { label: 'Giá vốn đang dùng', num: true, render: r => U.money(r.cost) },
    { label: 'Giá bán', num: true, render: r => U.money(r.price) },
    { label: 'Lãi gộp/đv', num: true, render: r => `<b class="${r.profit >= 0 ? 'text-green' : 'text-red'}">${U.money(r.profit)}</b>` },
    { label: '% lãi', num: true, render: r => (r.price > 0 ? (r.profit / r.price * 100).toFixed(1) : '0') + '%' },
  ], { empty: 'Chưa có thành phẩm nào có định mức hoặc lệnh sản xuất trong kỳ' }));
};

M.reportInventory = function (host) {
  const rows = PW.data.products.map(p => ({ p, qty: PW.stockOf(p.id), val: PW.stockOf(p.id) * p.cost }));
  const tot = rows.reduce((s, r) => s + r.val, 0);
  host.appendChild(C.table(rows, [
    { label: 'Mã', render: r => U.esc(r.p.code) },
    { label: 'Tên hàng', render: r => U.esc(r.p.name) },
    { label: 'ĐVT', center: true, render: r => U.esc(r.p.unit) },
    { label: 'Tồn kho', num: true, render: r => `<span class="${r.qty <= 0 ? 'text-red' : ''}">${U.num(r.qty)}</span>` },
    { label: 'Giá vốn', num: true, render: r => U.money(r.p.cost) },
    { label: 'Giá trị tồn', num: true, render: r => U.money(r.val) },
  ], { footer: [
    { html: 'TỔNG GIÁ TRỊ TỒN KHO', colspan: 5 },
    { html: U.money(tot), num: true },
  ] }));
};

M.reportInOut = function (host, from, to) {
  // Tồn đầu kỳ = openingStock + nhập trước 'from' - xuất trước 'from' + trả lại trước 'from'
  function qtyBefore(pid) {
    const p = PW.product(pid);
    let q = Number(p.openingStock || 0);
    PW.data.purchases.forEach(pu => { if (pu.date < from) pu.items.forEach(it => { if (it.productId === pid) q += Number(it.qty); }); });
    PW.data.salesInvoices.forEach(si => { if (si.date < from) si.items.forEach(it => { if (it.productId === pid) q -= Number(it.qty); }); });
    PW.data.salesReturns.forEach(sr => { if (sr.date < from) sr.items.forEach(it => { if (it.productId === pid) q += Number(it.qty); }); });
    return q;
  }
  function qtyInRange(rows, pid, kind) {
    let q = 0;
    rows.forEach(doc => {
      if (doc.date >= from && doc.date <= to) doc.items.forEach(it => { if (it.productId === pid) q += Number(it.qty); });
    });
    return q;
  }
  const rows = PW.data.products.map(p => {
    const dau = qtyBefore(p.id);
    const nhap = qtyInRange(PW.data.purchases, p.id);
    const tralai = qtyInRange(PW.data.salesReturns, p.id);
    const xuat = qtyInRange(PW.data.salesInvoices, p.id);
    const cuoi = dau + nhap + tralai - xuat;
    return { p, dau, nhap, tralai, xuat, cuoi, val: cuoi * Number(p.cost || 0) };
  });
  const tot = rows.reduce((s, r) => s + r.val, 0);
  host.appendChild(C.table(rows, [
    { label: 'Mã', render: r => U.esc(r.p.code) },
    { label: 'Tên hàng', render: r => U.esc(r.p.name) },
    { label: 'ĐVT', center: true, render: r => U.esc(r.p.unit) },
    { label: 'Tồn đầu', num: true, render: r => U.num(r.dau) },
    { label: 'Nhập', num: true, render: r => `<span class="text-green">${U.num(r.nhap)}</span>` },
    { label: 'Khách trả', num: true, render: r => U.num(r.tralai) },
    { label: 'Xuất bán', num: true, render: r => `<span class="text-red">${U.num(r.xuat)}</span>` },
    { label: 'Tồn cuối', num: true, render: r => `<b class="${r.cuoi <= 0 ? 'text-red' : ''}">${U.num(r.cuoi)}</b>` },
    { label: 'Giá trị tồn', num: true, render: r => U.money(r.val) },
  ], { footer: [
    { html: 'TỔNG GIÁ TRỊ TỒN CUỐI KỲ', colspan: 8 },
    { html: U.money(tot), num: true },
  ] }));
};

M.reportReceivable = function (host) {
  const rows = PW.data.customers.map(c => ({ c, debt: PW.customerDebt(c.id) })).filter(r => r.debt !== 0);
  const tot = rows.reduce((s, r) => s + r.debt, 0);
  host.appendChild(C.table(rows, [
    { label: 'Mã KH', render: r => U.esc(r.c.code) },
    { label: 'Khách hàng', render: r => U.esc(r.c.name) },
    { label: 'Điện thoại', render: r => U.esc(r.c.phone || '') },
    { label: 'Còn phải thu', num: true, render: r => `<span class="text-red">${U.money(r.debt)}</span>` },
  ], { empty: 'Không có công nợ phải thu', footer: [
    { html: 'TỔNG PHẢI THU', colspan: 3 }, { html: U.money(tot), num: true },
  ] }));
};

M.reportPayable = function (host) {
  const rows = PW.data.suppliers.map(s => ({ s, debt: PW.supplierDebt(s.id) })).filter(r => r.debt !== 0);
  const tot = rows.reduce((s, r) => s + r.debt, 0);
  host.appendChild(C.table(rows, [
    { label: 'Mã NCC', render: r => U.esc(r.s.code) },
    { label: 'Nhà cung cấp', render: r => U.esc(r.s.name) },
    { label: 'Điện thoại', render: r => U.esc(r.s.phone || '') },
    { label: 'Còn phải trả', num: true, render: r => `<span class="text-red">${U.money(r.debt)}</span>` },
  ], { empty: 'Không có công nợ phải trả', footer: [
    { html: 'TỔNG PHẢI TRẢ', colspan: 3 }, { html: U.money(tot), num: true },
  ] }));
};

M.reportCashbook = function (host, from, to) {
  const rows = [];
  PW.data.receipts.filter(r => r.date >= from && r.date <= to).forEach(r => rows.push({ kind: 'thu', ...r }));
  PW.data.payments.filter(p => p.date >= from && p.date <= to).forEach(p => rows.push({ kind: 'chi', ...p }));
  // Cộng dòng tiền từ hóa đơn / phiếu nhập có thanh toán ngay
  PW.data.salesInvoices.filter(si => si.date >= from && si.date <= to && (si.paid > 0)).forEach(si =>
    rows.push({ kind: 'thu', date: si.date, code: si.code, accountId: si.paidAccountId, amount: si.paid, reason: 'Thu tiền bán hàng' }));
  PW.data.purchases.filter(pu => pu.date >= from && pu.date <= to && (pu.paid > 0)).forEach(pu =>
    rows.push({ kind: 'chi', date: pu.date, code: pu.code, accountId: pu.paidAccountId, amount: pu.paid, reason: 'Chi tiền mua hàng' }));
  rows.sort((a, b) => (a.date + a.code).localeCompare(b.date + b.code));
  const totThu = rows.filter(r => r.kind === 'thu').reduce((s, r) => s + r.amount, 0);
  const totChi = rows.filter(r => r.kind === 'chi').reduce((s, r) => s + r.amount, 0);
  host.appendChild(C.table(rows, [
    { label: 'Ngày', render: r => U.date(r.date) },
    { label: 'Số CT', render: r => U.esc(r.code) },
    { label: 'Tài khoản', render: r => { const a = PW.account(r.accountId); return a ? U.esc(a.name) : ''; } },
    { label: 'Diễn giải', render: r => U.esc(r.reason || '') },
    { label: 'Thu', num: true, render: r => r.kind === 'thu' ? `<span class="text-green">${U.money(r.amount)}</span>` : '' },
    { label: 'Chi', num: true, render: r => r.kind === 'chi' ? `<span class="text-red">${U.money(r.amount)}</span>` : '' },
  ], { empty: 'Không có giao dịch trong kỳ', footer: [
    { html: 'TỔNG CỘNG', colspan: 4 },
    { html: U.money(totThu), num: true },
    { html: U.money(totChi), num: true },
  ] }));
  host.appendChild(U.el('div', { class: 'mt16', style: 'text-align:right;font-weight:700' },
    'Chênh lệch thu - chi: ' + U.money(totThu - totChi) + ' đ'));
};
