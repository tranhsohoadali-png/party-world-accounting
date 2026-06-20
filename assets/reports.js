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
    { value: 'revenueByChannel', label: 'Doanh thu & lãi theo kênh bán' },
    { value: 'purchaseByItem', label: 'Tổng hợp mua hàng theo mặt hàng' },
    { value: 'inventory', label: 'Tồn kho hiện tại' },
    { value: 'productCost', label: 'Giá thành sản phẩm (sản xuất)' },
    { value: 'inout', label: 'Nhập - Xuất - Tồn kho' },
    { value: 'receivable', label: 'Công nợ phải thu' },
    { value: 'agingReceivable', label: 'Tuổi nợ phải thu (0-30/30-60/60-90/>90)' },
    { value: 'payable', label: 'Công nợ phải trả' },
    { value: 'cashbook', label: 'Sổ quỹ tiền (thu/chi)' },
    { value: 'cashflow', label: 'Lưu chuyển tiền tệ (dòng tiền vào/ra)' },
    { value: 'dailyCash', label: 'Bảng kê số dư tiền theo ngày' },
    { value: 'lowstock', label: 'Cảnh báo tồn tối thiểu' },
    { value: 'vat', label: 'Thuế GTGT (đầu ra - đầu vào)' },
    { value: 'commission', label: 'Hoa hồng CTV' },
    { value: 'balance', label: 'Cân đối kế toán (đơn giản)' },
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
    if (type === 'revenueByChannel') return M.reportRevenueByChannel(host, from, to);
    if (type === 'purchaseByItem') return M.reportPurchaseByItem(host, from, to);
    if (type === 'inventory') return M.reportInventory(host);
    if (type === 'productCost') return M.reportProductCost(host, from, to);
    if (type === 'inout') return M.reportInOut(host, from, to);
    if (type === 'receivable') return M.reportReceivable(host);
    if (type === 'agingReceivable') return M.reportAgingDetail(host);
    if (type === 'payable') return M.reportPayable(host);
    if (type === 'cashbook') return M.reportCashbook(host, from, to);
    if (type === 'cashflow') return M.reportCashflow(host, from, to);
    if (type === 'dailyCash') return M.reportDailyCash(host, from, to);
    if (type === 'lowstock') return M.reportLowStock(host);
    if (type === 'vat') return M.reportVAT(host, from, to);
    if (type === 'commission') return M.reportCommission(host, from, to);
    if (type === 'balance') return M.reportBalance(host);
  }
  function exCell(s) {
    if (s === '' || s === '-') return '';
    const neg = /^\(.*\)$/.test(s);
    const core = s.replace(/[()₫đ\s]/g, '').replace(/\./g, '').replace(',', '.');
    if (/^-?\d+(\.\d+)?$/.test(core)) { const n = parseFloat(core); return neg ? -n : n; }
    return s;
  }
  function exportReport() {
    // Xuất TẤT CẢ các bảng trong báo cáo (báo cáo thuế có 3 bảng) — bảng sau
    // ngăn cách bằng dòng trống + dòng tiêu đề cột riêng của nó.
    const tables = host.querySelectorAll('table');
    if (!tables.length) return U.toast('Chưa có dữ liệu để xuất', 'error');
    let headers = [];
    const rows = [];
    tables.forEach((t, ti) => {
      const ths = [].map.call(t.querySelectorAll('thead th'), th => th.textContent.trim());
      if (ti === 0) headers = ths;
      else {
        rows.push([]);                       // dòng trống ngăn cách
        if (ths.length) rows.push(ths);      // tiêu đề cột của bảng tiếp theo
      }
      t.querySelectorAll('tr').forEach(tr => {
        if (tr.closest('thead')) return;
        const tds = tr.querySelectorAll('td');
        if (!tds.length) return;
        rows.push([].map.call(tds, td => exCell(td.textContent.trim())));
      });
    });
    if (!rows.length) return U.toast('Báo cáo trống', 'error');
    if (!headers.length) headers = (rows[0] || []).map((_, i) => (rows[0].length === 2 ? ['Nội dung', 'Số tiền'][i] : 'Cột ' + (i + 1)));
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
  const fees = PW.sellingFees(from, to);
  const exp = PW.expenses(from, to);
  const profit = gross - fees - exp;
  const rows = [
    ['Doanh thu bán hàng', rev, 'text-green'],
    ['Giá vốn hàng bán', -cogs, 'text-red'],
    ['Lợi nhuận gộp', gross, gross >= 0 ? 'text-green' : 'text-red'],
    ['Phí sàn & vận chuyển', -fees, 'text-red'],
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
      agg[it.productId].cogs += Number(it.qty) * PW.unitCost(p, si.date);
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

M.reportRevenueByChannel = function (host, from, to) {
  const agg = {};
  function cogsOf(si) { return si.items.reduce((s, it) => { const p = PW.product(it.productId); return s + Number(it.qty) * PW.unitCost(p, si.date); }, 0); }
  PW.data.salesInvoices.filter(si => si.date >= from && si.date <= to).forEach(si => {
    const key = si.channelId || '_none';
    agg[key] = agg[key] || { cnt: 0, rev: 0, fees: 0, cogs: 0 };
    agg[key].cnt++; agg[key].rev += PW.invoiceTotal(si);
    agg[key].fees += PW.invoiceFees(si); agg[key].cogs += cogsOf(si);
  });
  const rows = Object.keys(agg).map(k => {
    const c = k === '_none' ? null : PW.channel(k);
    const a = agg[k];
    return { name: c ? c.name : '(Chưa gán kênh)', cnt: a.cnt, rev: a.rev, fees: a.fees, cogs: a.cogs, profit: a.rev - a.fees - a.cogs };
  }).sort((a, b) => b.rev - a.rev);
  const T = rows.reduce((t, r) => ({ cnt: t.cnt + r.cnt, rev: t.rev + r.rev, fees: t.fees + r.fees, cogs: t.cogs + r.cogs, profit: t.profit + r.profit }), { cnt: 0, rev: 0, fees: 0, cogs: 0, profit: 0 });
  host.appendChild(C.table(rows, [
    { label: 'Kênh bán', render: r => U.esc(r.name) },
    { label: 'Số đơn', num: true, render: r => U.num(r.cnt) },
    { label: 'Doanh thu', num: true, render: r => U.money(r.rev) },
    { label: 'Phí sàn + ship', num: true, render: r => `<span class="text-red">${U.money(r.fees)}</span>` },
    { label: 'Giá vốn', num: true, render: r => U.money(r.cogs) },
    { label: 'Lãi thuần', num: true, render: r => `<b class="${r.profit >= 0 ? 'text-green' : 'text-red'}">${U.money(r.profit)}</b>` },
    { label: '% lãi/DT', num: true, render: r => (r.rev > 0 ? (r.profit / r.rev * 100).toFixed(1) : '0') + '%' },
  ], { empty: 'Chưa có hóa đơn bán trong kỳ', footer: [
    { html: 'TỔNG CỘNG' }, { html: U.num(T.cnt), num: true }, { html: U.money(T.rev), num: true },
    { html: U.money(T.fees), num: true }, { html: U.money(T.cogs), num: true }, { html: U.money(T.profit), num: true },
    { html: (T.rev > 0 ? (T.profit / T.rev * 100).toFixed(1) : '0') + '%', num: true },
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
  const rows = PW.data.products.filter(p => p.kind !== 'dichvu').map(p => { const u = PW.unitCost(p); return { p, qty: PW.stockOf(p.id), unit: u, val: PW.stockOf(p.id) * u }; });
  const tot = rows.reduce((s, r) => s + r.val, 0);
  host.appendChild(C.table(rows, [
    { label: 'Mã', render: r => U.esc(r.p.code) },
    { label: 'Tên hàng', render: r => U.esc(r.p.name) },
    { label: 'ĐVT', center: true, render: r => U.esc(r.p.unit) },
    { label: 'Tồn kho', num: true, render: r => `<span class="${r.qty <= 0 ? 'text-red' : ''}">${U.num(r.qty)}</span>` },
    { label: 'Giá vốn (BQ nếu NVL)', num: true, render: r => U.money(r.unit) },
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
    return { p, dau, nhap, tralai, xuat, cuoi, val: cuoi * PW.unitCost(p, to) };
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

/* Báo cáo Lưu chuyển tiền tệ — dòng tiền vào/ra phân nhóm + số dư đầu/cuối kỳ.
   Nguồn tiền chuẩn (KHÔNG đếm trùng): vào = receipts[] + salesInvoices.paid;
   ra = payments[] + purchases.paid. Lương đã nằm sẵn trong payments[] (chỉ phân loại lại). */
M.reportCashflow = function (host, from, to) {
  const inR = d => (!from || d >= from) && (!to || d <= to);
  const isSalary = p => /lương|luong/i.test(p.reason || '');

  // Số dư của 1 tài khoản TRƯỚC kỳ (cắt theo ngày < from) — KHÔNG dùng PW.accountBalance (tính tới hiện tại)
  function balanceBefore(accId) {
    const a = PW.account(accId);
    let b = a ? Number(a.opening || 0) : 0;
    PW.data.receipts.forEach(r => { if (r.accountId === accId && r.date < from) b += Number(r.amount || 0); });
    PW.data.payments.forEach(p => { if (p.accountId === accId && p.date < from) b -= Number(p.amount || 0); });
    PW.data.salesInvoices.forEach(si => { if (si.paidAccountId === accId && si.date < from) b += Number(si.paid || 0); });
    PW.data.purchases.forEach(pu => { if (pu.paidAccountId === accId && pu.date < from) b -= Number(pu.paid || 0); });
    return b;
  }

  // Phân nhóm dòng tiền trong kỳ
  const IN = { ban: 0, thuNo: 0, khac: 0 };
  const OUT = { mua: 0, traNo: 0, luong: 0, khac: 0 };
  PW.data.salesInvoices.forEach(si => { if (inR(si.date) && Number(si.paid) > 0) IN.ban += Number(si.paid); });
  PW.data.receipts.forEach(r => { if (inR(r.date)) { if (r.customerId) IN.thuNo += Number(r.amount || 0); else IN.khac += Number(r.amount || 0); } });
  PW.data.purchases.forEach(pu => { if (inR(pu.date) && Number(pu.paid) > 0) OUT.mua += Number(pu.paid); });
  PW.data.payments.forEach(p => {
    if (!inR(p.date)) return;
    if (p.supplierId) OUT.traNo += Number(p.amount || 0);
    else if (isSalary(p)) OUT.luong += Number(p.amount || 0);
    else OUT.khac += Number(p.amount || 0);
  });
  const totIn = IN.ban + IN.thuNo + IN.khac;
  const totOut = OUT.mua + OUT.traNo + OUT.luong + OUT.khac;
  const opening = PW.data.cashAccounts.reduce((s, a) => s + balanceBefore(a.id), 0);
  const net = totIn - totOut;
  const closing = opening + net;

  // Bảng 1: tóm tắt
  const t = U.el('table', { class: 'tbl' });
  const sec = txt => U.el('tr', { style: 'background:#f7f9fb' }, [U.el('td', { style: 'font-weight:700' }, txt), U.el('td')]);
  const row = (label, val, indent, bold, cls) => U.el('tr', null, [
    U.el('td', { style: (indent ? 'padding-left:24px;' : '') + (bold ? 'font-weight:700' : '') }, label),
    U.el('td', { class: 'num ' + (cls || ''), style: bold ? 'font-weight:700' : '' }, U.money(val)),
  ]);
  t.appendChild(row('Số dư đầu kỳ (tiền mặt + ngân hàng)', opening, false, true));
  t.appendChild(sec('I. DÒNG TIỀN VÀO'));
  t.appendChild(row('Thu từ bán hàng (trả ngay)', IN.ban, true, false, 'text-green'));
  t.appendChild(row('Thu nợ khách hàng', IN.thuNo, true, false, 'text-green'));
  t.appendChild(row('Thu khác (góp vốn, hoàn, thu nhập...)', IN.khac, true, false, 'text-green'));
  t.appendChild(row('Cộng dòng tiền vào', totIn, false, true, 'text-green'));
  t.appendChild(sec('II. DÒNG TIỀN RA'));
  t.appendChild(row('Chi mua hàng (trả ngay)', OUT.mua, true, false, 'text-red'));
  t.appendChild(row('Trả nợ nhà cung cấp', OUT.traNo, true, false, 'text-red'));
  t.appendChild(row('Trả lương nhân viên', OUT.luong, true, false, 'text-red'));
  t.appendChild(row('Chi phí khác', OUT.khac, true, false, 'text-red'));
  t.appendChild(row('Cộng dòng tiền ra', totOut, false, true, 'text-red'));
  t.appendChild(row('Lưu chuyển tiền thuần trong kỳ', net, false, true, net >= 0 ? 'text-green' : 'text-red'));
  t.appendChild(row('SỐ DƯ CUỐI KỲ', closing, false, true, closing >= 0 ? '' : 'text-red'));
  host.appendChild(U.el('div', { class: 'table-wrap' }, t));

  // Bảng 2: chi tiết theo từng tài khoản
  host.appendChild(U.el('div', { class: 'card-title', style: 'margin-top:20px' }, '💳 Chi tiết theo tài khoản tiền'));
  const accRows = PW.data.cashAccounts.map(a => {
    const dau = balanceBefore(a.id);
    let vao = 0, ra = 0;
    PW.data.receipts.forEach(r => { if (r.accountId === a.id && inR(r.date)) vao += Number(r.amount || 0); });
    PW.data.salesInvoices.forEach(si => { if (si.paidAccountId === a.id && inR(si.date)) vao += Number(si.paid || 0); });
    PW.data.payments.forEach(p => { if (p.accountId === a.id && inR(p.date)) ra += Number(p.amount || 0); });
    PW.data.purchases.forEach(pu => { if (pu.paidAccountId === a.id && inR(pu.date)) ra += Number(pu.paid || 0); });
    return { a, dau, vao, ra, cuoi: dau + vao - ra };
  });
  const TT = accRows.reduce((s, r) => ({ dau: s.dau + r.dau, vao: s.vao + r.vao, ra: s.ra + r.ra, cuoi: s.cuoi + r.cuoi }),
    { dau: 0, vao: 0, ra: 0, cuoi: 0 });
  host.appendChild(C.table(accRows, [
    { label: 'Tài khoản', render: r => U.esc(r.a.name) },
    { label: 'Dư đầu kỳ', num: true, render: r => U.money(r.dau) },
    { label: 'Tiền vào', num: true, render: r => `<span class="text-green">${U.money(r.vao)}</span>` },
    { label: 'Tiền ra', num: true, render: r => `<span class="text-red">${U.money(r.ra)}</span>` },
    { label: 'Dư cuối kỳ', num: true, render: r => `<b class="${r.cuoi < 0 ? 'text-red' : ''}">${U.money(r.cuoi)}</b>` },
  ], { empty: 'Chưa có tài khoản tiền', footer: [
    { html: 'TỔNG CỘNG' }, { html: U.money(TT.dau), num: true }, { html: U.money(TT.vao), num: true },
    { html: U.money(TT.ra), num: true }, { html: U.money(TT.cuoi), num: true },
  ] }));

  host.appendChild(U.el('p', { class: 'section-sub', style: 'margin-top:10px' },
    'Dòng tiền vào = phiếu thu + tiền khách trả ngay trên hóa đơn. Dòng tiền ra = phiếu chi (gồm trả NCC, lương, chi phí) + tiền trả ngay khi mua. Lương nhận diện theo lý do phiếu chi có chữ "Lương".'));
};

/* Bảng kê số dư tiền theo ngày — tồn quỹ cuối mỗi ngày có phát sinh trong kỳ. */
M.reportDailyCash = function (host, from, to) {
  const inR = d => (!from || d >= from) && (!to || d <= to);
  const days = {};
  function add(date, i, o) { if (!inR(date)) return; if (!days[date]) days[date] = { in: 0, out: 0 }; days[date].in += i; days[date].out += o; }
  PW.data.receipts.forEach(r => add(r.date, Number(r.amount || 0), 0));
  PW.data.payments.forEach(p => add(p.date, 0, Number(p.amount || 0)));
  PW.data.salesInvoices.forEach(si => { if (Number(si.paid) > 0) add(si.date, Number(si.paid), 0); });
  PW.data.purchases.forEach(pu => { if (Number(pu.paid) > 0) add(pu.date, 0, Number(pu.paid)); });
  const opening = PW.data.cashAccounts.reduce((s, a) => s + PW.balanceAsOf(a.id, U.addDays(from, -1)), 0);
  let bal = opening;
  const rows = Object.keys(days).sort().map(d => { const x = days[d]; bal += x.in - x.out; return { date: d, in: x.in, out: x.out, bal: bal }; });
  const totIn = rows.reduce((s, r) => s + r.in, 0), totOut = rows.reduce((s, r) => s + r.out, 0);
  host.appendChild(U.el('div', { class: 'section-sub', style: 'margin-bottom:8px' },
    'Số dư đầu kỳ (trước ' + U.date(from) + '): ' + U.money(opening) + ' đ'));
  host.appendChild(C.table(rows, [
    { label: 'Ngày', render: r => U.date(r.date) },
    { label: 'Thu trong ngày', num: true, render: r => r.in ? `<span class="text-green">${U.money(r.in)}</span>` : '' },
    { label: 'Chi trong ngày', num: true, render: r => r.out ? `<span class="text-red">${U.money(r.out)}</span>` : '' },
    { label: 'Tồn quỹ cuối ngày', num: true, render: r => `<b class="${r.bal < 0 ? 'text-red' : ''}">${U.money(r.bal)}</b>` },
  ], { empty: 'Không có phát sinh tiền trong kỳ', footer: [
    { html: 'TỔNG CỘNG' }, { html: U.money(totIn), num: true }, { html: U.money(totOut), num: true }, { html: U.money(bal), num: true },
  ] }));
};

M.reportLowStock = function (host) {
  const rows = PW.stockBelowMin().sort((a, b) => (a.stock - a.min) - (b.stock - b.min));
  host.appendChild(C.table(rows, [
    { label: 'Mã', render: r => U.esc(r.p.code) },
    { label: 'Tên hàng', render: r => U.esc(r.p.name) },
    { label: 'ĐVT', center: true, render: r => U.esc(r.p.unit) },
    { label: 'Tồn hiện tại', num: true, render: r => `<b class="text-red">${U.num(r.stock)}</b>` },
    { label: 'Tồn tối thiểu', num: true, render: r => U.num(r.min) },
    { label: 'Cần nhập thêm', num: true, render: r => `<b>${U.num(Math.max(0, r.min - r.stock))}</b>` },
  ], { empty: 'Tất cả hàng hóa đều trên mức tồn tối thiểu' }));
};

M.reportAgingDetail = function (host) {
  const today = U.today();
  const diff = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);
  const tot = { cur: 0, b1: 0, b2: 0, b3: 0, b4: 0, sum: 0 };
  const rows = [];
  PW.data.customers.forEach(c => {
    const b = { cur: 0, b1: 0, b2: 0, b3: 0, b4: 0 };
    PW.data.salesInvoices.filter(si => si.customerId === c.id).forEach(si => {
      const rem = PW.invoiceGrand(si) - Number(si.paid || 0);
      if (rem <= 0) return;
      const od = diff(si.dueDate || si.date, today);   // số ngày quá hạn (âm = chưa đến hạn)
      if (od <= 0) b.cur += rem; else if (od <= 30) b.b1 += rem; else if (od <= 60) b.b2 += rem;
      else if (od <= 90) b.b3 += rem; else b.b4 += rem;
    });
    const s = b.cur + b.b1 + b.b2 + b.b3 + b.b4;
    if (s > 0) {
      rows.push({ c: c, cur: b.cur, b1: b.b1, b2: b.b2, b3: b.b3, b4: b.b4, sum: s });
      tot.cur += b.cur; tot.b1 += b.b1; tot.b2 += b.b2; tot.b3 += b.b3; tot.b4 += b.b4; tot.sum += s;
    }
  });
  rows.sort((a, b) => (b.b4 + b.b3) - (a.b4 + a.b3) || b.sum - a.sum);   // nợ xấu nhiều lên trước
  host.appendChild(C.table(rows, [
    { label: 'Khách hàng', render: r => U.esc(r.c.name) },
    { label: 'Chưa đến hạn', num: true, render: r => U.money(r.cur) },
    { label: '1–30 ngày', num: true, render: r => U.money(r.b1) },
    { label: '31–60 ngày', num: true, render: r => U.money(r.b2) },
    { label: '61–90 ngày', num: true, render: r => `<span class="text-red">${U.money(r.b3)}</span>` },
    { label: '> 90 ngày', num: true, render: r => `<b class="text-red">${U.money(r.b4)}</b>` },
    { label: 'Tổng nợ', num: true, render: r => `<b>${U.money(r.sum)}</b>` },
  ], {
    empty: 'Không có công nợ phải thu',
    footer: [{ html: 'TỔNG' }, { html: U.money(tot.cur), num: true }, { html: U.money(tot.b1), num: true },
      { html: U.money(tot.b2), num: true }, { html: U.money(tot.b3), num: true }, { html: U.money(tot.b4), num: true }, { html: U.money(tot.sum), num: true }],
  }));
  host.appendChild(U.el('p', { class: 'section-sub', style: 'margin-top:8px' },
    'Tuổi nợ tính theo từng hóa đơn chưa thu đủ; mốc = hạn thanh toán (trống thì lấy ngày hóa đơn). Nợ trên 60 ngày tô đỏ — cần đòi gấp.'));
};

M.reportVAT = function (host, from, to) {
  const out = PW.vatOutput(from, to), inp = PW.vatInput(from, to), pay = out - inp;
  // ----- Tổng hợp -----
  const t = U.el('table', { class: 'tbl' });
  [['Thuế GTGT đầu ra (bán hàng)', out, 'text-green'],
   ['Thuế GTGT đầu vào (mua hàng)', -inp, 'text-red'],
   [pay >= 0 ? 'Thuế GTGT phải nộp' : 'Thuế GTGT còn được khấu trừ', pay, pay >= 0 ? 'text-red' : 'text-green']]
    .forEach((r, i) => t.appendChild(U.el('tr', null, [
      U.el('td', { style: i === 2 ? 'font-weight:700' : '' }, r[0]),
      U.el('td', { class: 'num ' + r[2], style: i === 2 ? 'font-weight:700' : '' }, U.money(r[1])),
    ])));
  host.appendChild(U.el('div', { class: 'table-wrap' }, t));

  // ----- Bảng kê hóa đơn BÁN RA có thuế -----
  const sales = PW.data.salesInvoices
    .filter(si => si.date >= from && si.date <= to && Number(si.vatRate || 0) > 0)
    .sort((a, b) => a.date < b.date ? -1 : 1);
  const cusName = id => { const c = PW.data.customers.find(x => x.id === id); return c ? c.name : ''; };
  host.appendChild(U.el('div', { class: 'card-title', style: 'margin-top:20px' }, '📤 Bảng kê hóa đơn bán ra có thuế'));
  let sHang = 0, sThue = 0;
  const sRows = sales.map(si => {
    const hang = PW.invoiceTotal(si);
    const thue = Math.round(hang * Number(si.vatRate) / 100);
    sHang += hang; sThue += thue;
    return { si, hang, thue };
  });
  host.appendChild(C.table(sRows, [
    { label: 'Số HĐ', render: r => U.esc(r.si.code) },
    { label: 'Ngày', render: r => U.date(r.si.date) },
    { label: 'Khách hàng', render: r => U.esc(cusName(r.si.customerId)) },
    { label: 'Tiền hàng', num: true, render: r => U.money(r.hang) },
    { label: 'Thuế suất', center: true, render: r => r.si.vatRate + '%' },
    { label: 'Tiền thuế', num: true, render: r => U.money(r.thue) },
    { label: 'Tổng thanh toán', num: true, render: r => `<b>${U.money(r.hang + r.thue)}</b>` },
  ], {
    empty: 'Không có hóa đơn bán ra nào có thuế trong kỳ',
    footer: [{ html: 'TỔNG', colspan: 3 }, { html: U.money(sHang), num: true }, { html: '' },
      { html: U.money(sThue), num: true }, { html: U.money(sHang + sThue), num: true }],
  }));

  // ----- Bảng kê hóa đơn MUA VÀO có thuế -----
  const purch = PW.data.purchases
    .filter(pu => pu.date >= from && pu.date <= to && Number(pu.vatRate || 0) > 0)
    .sort((a, b) => a.date < b.date ? -1 : 1);
  const supName = id => { const s = PW.data.suppliers.find(x => x.id === id); return s ? s.name : ''; };
  host.appendChild(U.el('div', { class: 'card-title', style: 'margin-top:20px' }, '📥 Bảng kê hóa đơn mua vào có thuế (được khấu trừ)'));
  let pHang = 0, pThue = 0;
  const pRows = purch.map(pu => {
    const hang = PW.purchaseTotal(pu);
    const thue = Math.round(hang * Number(pu.vatRate) / 100);
    pHang += hang; pThue += thue;
    return { pu, hang, thue };
  });
  host.appendChild(C.table(pRows, [
    { label: 'Số phiếu', render: r => U.esc(r.pu.code) },
    { label: 'Ngày', render: r => U.date(r.pu.date) },
    { label: 'Nhà cung cấp', render: r => U.esc(supName(r.pu.supplierId)) },
    { label: 'Tiền hàng', num: true, render: r => U.money(r.hang) },
    { label: 'Thuế suất', center: true, render: r => r.pu.vatRate + '%' },
    { label: 'Tiền thuế', num: true, render: r => U.money(r.thue) },
    { label: 'Tổng thanh toán', num: true, render: r => `<b>${U.money(r.hang + r.thue)}</b>` },
  ], {
    empty: 'Không có phiếu nhập mua nào có thuế trong kỳ',
    footer: [{ html: 'TỔNG', colspan: 3 }, { html: U.money(pHang), num: true }, { html: '' },
      { html: U.money(pThue), num: true }, { html: U.money(pHang + pThue), num: true }],
  }));

  host.appendChild(U.el('p', { class: 'section-sub', style: 'margin-top:10px' },
    'Lưu ý: chỉ liệt kê chứng từ có thuế suất > 0%. Tiền thuế = tiền hàng × thuế suất. ' +
    'Hóa đơn nhập từ màn "Làm việc với AI" có thể chọn % thuế ngay khi tạo.'));
};

M.reportCommission = function (host, from, to) {
  const rows = PW.data.customers.filter(c => Number(c.commissionPercent || 0) > 0).map(c => {
    const rev = PW.data.salesInvoices.filter(si => si.customerId === c.id && si.date >= from && si.date <= to).reduce((s, si) => s + PW.invoiceTotal(si), 0);
    return { c, pct: Number(c.commissionPercent), rev, comm: Math.round(rev * Number(c.commissionPercent) / 100) };
  }).sort((a, b) => b.comm - a.comm);
  const totC = rows.reduce((s, r) => s + r.comm, 0);
  host.appendChild(C.table(rows, [
    { label: 'Mã', render: r => U.esc(r.c.code) },
    { label: 'CTV / Đại lý', render: r => U.esc(r.c.name) },
    { label: '% HH', num: true, render: r => r.pct + '%' },
    { label: 'Doanh số', num: true, render: r => U.money(r.rev) },
    { label: 'Hoa hồng', num: true, render: r => `<b class="text-green">${U.money(r.comm)}</b>` },
  ], { empty: 'Chưa có CTV (đặt % hoa hồng trong form khách hàng)', footer: [
    { html: 'TỔNG HOA HỒNG', colspan: 4 }, { html: U.money(totC), num: true },
  ] }));
};

M.reportBalance = function (host) {
  const cash = PW.totalCash(), ar = PW.totalReceivable(), inv = PW.inventoryValue();
  const assets = cash + ar + inv, ap = PW.totalPayable(), equity = assets - ap;
  const t = U.el('table', { class: 'tbl' });
  const sec = txt => U.el('tr', { style: 'background:#f7f9fb' }, [U.el('td', { style: 'font-weight:700' }, txt), U.el('td')]);
  const row = (label, val, indent, bold, cls) => U.el('tr', null, [
    U.el('td', { style: (indent ? 'padding-left:24px;' : '') + (bold ? 'font-weight:700' : '') }, label),
    U.el('td', { class: 'num ' + (cls || ''), style: bold ? 'font-weight:700' : '' }, U.money(val)),
  ]);
  t.appendChild(sec('TÀI SẢN'));
  t.appendChild(row('Tiền (mặt + ngân hàng)', cash, true));
  t.appendChild(row('Phải thu khách hàng', ar, true));
  t.appendChild(row('Hàng tồn kho', inv, true));
  t.appendChild(row('TỔNG TÀI SẢN', assets, false, true));
  t.appendChild(sec('NGUỒN VỐN'));
  t.appendChild(row('Phải trả nhà cung cấp', ap, true, false, 'text-red'));
  t.appendChild(row('Vốn chủ sở hữu (ước tính)', equity, true));
  t.appendChild(row('TỔNG NGUỒN VỐN', ap + equity, false, true));
  host.appendChild(U.el('div', { class: 'table-wrap' }, t));
  host.appendChild(U.el('div', { class: 'section-sub mt8' }, 'Cân đối đơn giản (snapshot hiện tại). Vốn chủ sở hữu = Tổng tài sản − Nợ phải trả.'));
};
