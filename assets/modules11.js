/* ============================================================
   modules11.js — Kiểm kê kho (#5) · CRM (#4) · Phân tích KD (#6)
   ============================================================ */

/* =====================================================================
   #5 — KIỂM KÊ KHO (điều chỉnh tồn theo thực tế đếm)
   ===================================================================== */
M.stockCount = function (root) {
  const card = U.el('div', { class: 'card' });
  const toolbar = U.el('div', { class: 'toolbar' });
  toolbar.appendChild(U.el('div', { class: 'card-title', style: 'margin:0' }, '📋 Kiểm kê kho'));
  toolbar.appendChild(U.el('div', { class: 'spacer' }));
  toolbar.appendChild(C.btn('+ Lập phiếu kiểm kê', () => M.stockCountForm(), 'primary'));
  card.appendChild(toolbar);
  const host = U.el('div');
  card.appendChild(host);
  root.appendChild(card);

  function draw() {
    const rows = PW.data.stockAdjustments.slice().sort((a, b) => (b.date + b.code).localeCompare(a.date + a.code));
    host.innerHTML = '';
    host.appendChild(C.table(rows, [
      { label: 'Ngày', render: a => U.date(a.date) },
      { label: 'Số phiếu', render: a => U.esc(a.code) },
      { label: 'Số mặt hàng lệch', center: true, render: a => (a.items || []).length },
      { label: 'Ghi chú', render: a => U.esc(a.note || '') },
      { label: '', render: a => C.actions([
          { label: 'Sửa', onClick: () => M.stockCountForm(a) },
          { label: 'Xóa', cls: 'danger', onClick: () => {
              if (U.confirm('Xóa phiếu kiểm kê ' + a.code + '?')) {
                PW.data.stockAdjustments = PW.data.stockAdjustments.filter(x => x.id !== a.id);
                PW.save(); App.refresh(); U.toast('Đã xóa');
              }
            } },
        ]) },
    ], { empty: 'Chưa có phiếu kiểm kê' }));
  }
  draw();
};

M.stockCountForm = function (ad) {
  const isNew = !ad;
  ad = ad ? JSON.parse(JSON.stringify(ad)) : { code: PW.nextCode('KK'), date: U.today(), note: '', items: [] };
  const codeI = C.input({ value: ad.code });
  const dateI = C.input({ type: 'date', value: ad.date });
  const noteI = C.input({ value: ad.note || '' });
  const existing = {}; (ad.items || []).forEach(it => existing[it.productId] = it);

  const inputs = {};
  const tbody = U.el('tbody');
  PW.data.products.forEach(p => {
    const savedDelta = existing[p.id] ? Number(existing[p.id].delta) : 0;
    // Tồn sổ thực = tồn hiện tại TRỪ delta của chính phiếu đang sửa
    // (vì PW.stockOf đã cộng cả delta phiếu này -> nếu không trừ ra sẽ tính trùng).
    const book = PW.stockOf(p.id) - savedDelta;
    // Số đã đếm trước đó = tồn sổ + delta đã lưu (phiếu mới: = tồn sổ).
    const counted = C.input({ type: 'number', value: book + savedDelta, style: 'width:110px;text-align:right' });
    const deltaCell = U.el('span');
    function upd() {
      const d = (Number(counted.value) || 0) - book;
      deltaCell.textContent = (d > 0 ? '+' : '') + U.num(d);
      deltaCell.className = d === 0 ? 'text-muted' : (d > 0 ? 'text-green' : 'text-red');
    }
    counted.addEventListener('input', upd); upd();
    inputs[p.id] = { counted, book };
    tbody.appendChild(U.el('tr', null, [
      U.el('td', null, U.esc(p.code)),
      U.el('td', null, U.esc(p.name)),
      U.el('td', { class: 'num' }, U.num(book)),
      U.el('td', { class: 'num' }, counted),
      U.el('td', { class: 'num' }, deltaCell),
    ]));
  });
  const tbl = U.el('table', { class: 'items-tbl' });
  tbl.appendChild(U.el('thead', null, U.el('tr', null,
    ['Mã', 'Tên hàng', 'Tồn sổ', 'Thực tế đếm', 'Chênh lệch'].map(h => U.el('th', { class: /Tồn|Thực|Chênh/.test(h) ? 'num' : '' }, h)))));
  tbl.appendChild(tbody);

  const body = U.el('div', null, [
    U.el('div', { class: 'form-grid' }, [C.field('Số phiếu', codeI), C.field('Ngày', dateI, { required: true }), C.field('Ghi chú', noteI, { full: true })]),
    U.el('div', { class: 'section-sub mt8' }, 'Nhập số lượng đếm thực tế. Chênh lệch sẽ tự điều chỉnh tồn kho.'),
    U.el('div', { class: 'table-wrap' }, tbl),
  ]);
  C.modal({
    title: isNew ? 'Lập phiếu kiểm kê' : 'Sửa phiếu kiểm kê', wide: true, body,
    footer: [C.btn('Hủy', C.closeModal), C.btn('Lưu & điều chỉnh tồn', () => {
      const items = [];
      Object.keys(inputs).forEach(pid => {
        const delta = (Number(inputs[pid].counted.value) || 0) - inputs[pid].book;
        if (delta !== 0) items.push({ productId: pid, delta });
      });
      const obj = { id: ad.id || PW.uid(), code: codeI.value, date: dateI.value, note: noteI.value, items };
      if (isNew) PW.data.stockAdjustments.push(obj);
      else { const i = PW.data.stockAdjustments.findIndex(x => x.id === obj.id); PW.data.stockAdjustments[i] = obj; }
      PW.save(); C.closeModal(); App.refresh(); U.toast('Đã lưu kiểm kê (' + items.length + ' mặt hàng điều chỉnh)');
    }, 'primary')],
  });
};

/* =====================================================================
   #4 — CRM (chân dung khách hàng)
   ===================================================================== */
M.crm = function (root) {
  const rows = PW.data.customers.map(c => {
    const st = PW.customerStats(c.id);
    return { c, total: st.total, count: st.count, last: st.last, debt: PW.customerDebt(c.id) };
  }).sort((a, b) => b.total - a.total);
  function rank(total) {
    if (total >= 10000000) return '<span class="tag orange">VIP</span>';
    if (total >= 3000000) return '<span class="tag green">Thân thiết</span>';
    if (total > 0) return '<span class="tag gray">Thường</span>';
    return '<span class="text-muted">—</span>';
  }
  const totalRev = rows.reduce((s, r) => s + r.total, 0);
  const vip = rows.filter(r => r.total >= 10000000).length;

  const kpi = U.el('div', { class: 'grid c4' });
  [['Tổng khách hàng', rows.length, 'var(--teal)', true], ['Khách VIP', vip, 'var(--orange)', true],
   ['Tổng doanh số KH', totalRev, 'var(--green)'], ['Khách có công nợ', rows.filter(r => r.debt > 0).length, 'var(--red)', true]]
    .forEach(a => kpi.appendChild(U.el('div', { class: 'kpi' }, [
      U.el('div', { class: 'value', style: 'color:' + a[2] }, a[3] ? U.num(a[1]) : U.money(a[1])),
      U.el('div', { class: 'sub text-muted' }, a[0]),
    ])));
  root.appendChild(kpi);

  const card = U.el('div', { class: 'card' });
  card.appendChild(U.el('div', { class: 'card-title' }, '👑 Chân dung khách hàng (CRM)'));
  card.appendChild(C.table(rows, [
    { label: 'Khách hàng', render: r => U.esc(r.c.name) },
    { label: 'Hạng', center: true, render: r => rank(r.total) },
    { label: 'Số đơn', num: true, render: r => U.num(r.count) },
    { label: 'Tổng mua', num: true, render: r => U.money(r.total) },
    { label: 'Lần mua cuối', center: true, render: r => r.last ? U.date(r.last) : '—' },
    { label: 'Còn nợ', num: true, render: r => r.debt > 0 ? `<span class="text-red">${U.money(r.debt)}</span>` : '<span class="text-muted">0</span>' },
    { label: '', render: r => C.actions([{ label: 'Sổ công nợ', onClick: () => M.debtLedger('customer', r.c.id) }, { label: 'Bán hàng', cls: 'primary', onClick: () => M.salesForm(null, r.c.id) }]) },
  ], { empty: 'Chưa có khách hàng' }));
  root.appendChild(card);
};

/* =====================================================================
   #6 — PHÂN TÍCH KINH DOANH (BI dashboard — thiết kế đẹp)
   ===================================================================== */
function _prevRange(kind, from) {
  const y = Number(from.slice(0, 4)), m = Number(from.slice(5, 7));
  if (kind === 'year') return { from: (y - 1) + '-01-01', to: (y - 1) + '-12-31' };
  if (kind === 'quarter') { let pm = m - 3, py = y; if (pm < 1) { pm += 12; py--; } const sm = String(pm).padStart(2, '0'), em = String(pm + 2).padStart(2, '0'); return { from: `${py}-${sm}-01`, to: `${py}-${em}-31` }; }
  let pm = m - 1, py = y; if (pm < 1) { pm = 12; py--; } const mm = String(pm).padStart(2, '0'); return { from: `${py}-${mm}-01`, to: `${py}-${mm}-31` };
}
function _profit(from, to) { return PW.revenue(from, to) - PW.cogs(from, to) - PW.expenses(from, to) - PW.sellingFees(from, to); }
function _ordersCount(from, to) { return PW.data.salesInvoices.filter(si => si.date >= from && si.date <= to).length; }
function _trendBadge(cur, prev) {
  let pct; if (!prev) pct = cur > 0 ? 100 : 0; else pct = (cur - prev) / Math.abs(prev) * 100;
  const up = pct >= 0;
  return '<span class="trend ' + (up ? 'up' : 'down') + '">' + (up ? '▲' : '▼') + ' ' + Math.abs(pct).toFixed(0) + '% so với kỳ trước</span>';
}

M.analytics = function (root) {
  const kind = App._analyticsPeriod || 'month';
  const cur = U.period(kind);
  const prev = _prevRange(kind, cur.from);
  const from = cur.from, to = cur.to;

  // Bộ chọn kỳ
  const bar = U.el('div', { class: 'toolbar' });
  bar.appendChild(U.el('div', { class: 'card-title', style: 'margin:0' }, '📊 Phân tích kinh doanh'));
  bar.appendChild(U.el('div', { class: 'spacer' }));
  bar.appendChild(U.el('span', { class: 'text-muted', style: 'margin-right:4px' }, 'Kỳ:'));
  const sel = C.select([{ value: 'month', label: 'Tháng này' }, { value: 'quarter', label: 'Quý này' }, { value: 'year', label: 'Năm nay' }], kind);
  sel.style.minWidth = '130px';
  sel.addEventListener('change', () => { App._analyticsPeriod = sel.value; App.refresh(); });
  bar.appendChild(sel);
  root.appendChild(bar);

  // ===== KPI có xu hướng =====
  const rev = PW.revenue(from, to), revP = PW.revenue(prev.from, prev.to);
  const pro = _profit(from, to), proP = _profit(prev.from, prev.to);
  const ord = _ordersCount(from, to), ordP = _ordersCount(prev.from, prev.to);
  const aov = ord ? rev / ord : 0, aovP = ordP ? revP / ordP : 0;
  const kpis = [
    { l: 'Doanh thu', v: U.money(rev), cur: rev, prev: revP, grad: 'linear-gradient(135deg,#7cb342,#aed581)', ic: '💰' },
    { l: 'Lợi nhuận', v: U.money(pro), cur: pro, prev: proP, grad: 'linear-gradient(135deg,#26a69a,#80cbc4)', ic: '📈' },
    { l: 'Số đơn hàng', v: U.num(ord), cur: ord, prev: ordP, grad: 'linear-gradient(135deg,#5c9ce6,#90caf9)', ic: '🧾' },
    { l: 'Giá trị TB/đơn', v: U.money(aov), cur: aov, prev: aovP, grad: 'linear-gradient(135deg,#ab7df0,#ce93d8)', ic: '🛍️' },
  ];
  const kpiRow = U.el('div', { class: 'grid c4' });
  kpis.forEach(k => kpiRow.appendChild(U.el('div', { class: 'kpi-fancy', style: 'background:' + k.grad }, [
    U.el('div', { class: 'kf-top' }, [U.el('span', { class: 'kf-label' }, k.l), U.el('span', { class: 'kf-ic' }, k.ic)]),
    U.el('div', { class: 'kf-value' }, k.v),
    U.el('div', { class: 'kf-trend', html: _trendBadge(k.cur, k.prev) }),
  ])));
  root.appendChild(kpiRow);

  // ===== Doanh thu & LN theo tháng + Doanh thu theo kênh =====
  const year = cur.year, cats = [], revArr = [], proArr = [];
  for (let m = 1; m <= 12; m++) { const mm = String(m).padStart(2, '0'); const f = `${year}-${mm}-01`, t = `${year}-${mm}-31`; cats.push('T' + m); revArr.push(PW.revenue(f, t)); proArr.push(_profit(f, t)); }
  const row1 = U.el('div', { class: 'grid', style: 'grid-template-columns:3fr 2fr' });
  const c1 = U.el('div', { class: 'card' });
  c1.appendChild(U.el('div', { class: 'card-title' }, '📈 Doanh thu & Lợi nhuận theo tháng (' + year + ')'));
  c1.appendChild(M.columnChart(cats, [{ name: 'Doanh thu', color: 'var(--teal)', values: revArr }, { name: 'Lợi nhuận', color: 'var(--orange)', values: proArr }]));
  row1.appendChild(c1);

  const chAgg = {};
  PW.data.salesInvoices.filter(si => si.date >= from && si.date <= to).forEach(si => {
    const k = si.channelId || '_none'; chAgg[k] = (chAgg[k] || 0) + PW.invoiceTotal(si);
  });
  const chSegs = Object.keys(chAgg).map((k, i) => ({ label: (PW.channel(k) || {}).name || 'Chưa gán', value: chAgg[k], color: M.PALETTE[i % M.PALETTE.length] })).sort((a, b) => b.value - a.value);
  const c2 = U.el('div', { class: 'card' });
  c2.appendChild(U.el('div', { class: 'card-title' }, '🛒 Doanh thu theo kênh'));
  c2.appendChild(chSegs.length ? M.donut(chSegs) : U.el('div', { class: 'empty' }, 'Chưa có dữ liệu'));
  row1.appendChild(c2);
  root.appendChild(row1);

  // ===== Top sản phẩm + Top khách hàng =====
  const prodAgg = {}, custAgg = {}, empAgg = {};
  PW.data.salesInvoices.filter(si => si.date >= from && si.date <= to).forEach(si => {
    custAgg[si.customerId] = (custAgg[si.customerId] || 0) + PW.invoiceTotal(si);
    if (si.employeeId) empAgg[si.employeeId] = (empAgg[si.employeeId] || 0) + PW.invoiceTotal(si);
    si.items.forEach(it => prodAgg[it.productId] = (prodAgg[it.productId] || 0) + Number(it.qty) * Number(it.price));
  });
  const topProd = Object.keys(prodAgg).map(id => ({ label: (PW.product(id) || {}).name || '?', value: prodAgg[id] })).sort((a, b) => b.value - a.value).slice(0, 7);
  const topCust = Object.keys(custAgg).map(id => ({ label: (PW.customer(id) || {}).name || '?', value: custAgg[id] })).sort((a, b) => b.value - a.value).slice(0, 7);
  const row2 = U.el('div', { class: 'grid c2' });
  const c3 = U.el('div', { class: 'card' }); c3.appendChild(U.el('div', { class: 'card-title' }, '🔥 Top sản phẩm bán chạy')); c3.appendChild(M.rankBars(topProd, { color: 'var(--teal)' })); row2.appendChild(c3);
  const c4 = U.el('div', { class: 'card' }); c4.appendChild(U.el('div', { class: 'card-title' }, '👑 Top khách hàng')); c4.appendChild(M.rankBars(topCust, { color: 'var(--orange)' })); row2.appendChild(c4);
  root.appendChild(row2);

  // ===== Cơ cấu chi phí + Doanh thu theo nhân viên =====
  const row3 = U.el('div', { class: 'grid c2' });
  const expAgg = {};
  PW.data.payments.filter(p => !p.supplierId && p.date >= from && p.date <= to).forEach(p => { const k = (p.category || p.reason || 'Khác').trim() || 'Khác'; expAgg[k] = (expAgg[k] || 0) + Number(p.amount); });
  const cogsV = PW.cogs(from, to); if (cogsV > 0) expAgg['Giá vốn hàng bán'] = cogsV;
  const feesV = PW.sellingFees(from, to); if (feesV > 0) expAgg['Phí sàn & vận chuyển'] = feesV;
  const expSegs = Object.keys(expAgg).map((k, i) => ({ label: k, value: expAgg[k], color: M.PALETTE[i % M.PALETTE.length] })).sort((a, b) => b.value - a.value);
  const c5 = U.el('div', { class: 'card' }); c5.appendChild(U.el('div', { class: 'card-title' }, '🥧 Cơ cấu chi phí')); c5.appendChild(expSegs.length ? M.donut(expSegs) : U.el('div', { class: 'empty' }, 'Chưa có chi phí')); row3.appendChild(c5);
  const topEmp = Object.keys(empAgg).map(id => ({ label: (PW.data.employees.find(e => e.id === id) || {}).name || '?', value: empAgg[id] })).sort((a, b) => b.value - a.value).slice(0, 7);
  const c6 = U.el('div', { class: 'card' }); c6.appendChild(U.el('div', { class: 'card-title' }, '🧑‍💼 Doanh thu theo nhân viên')); c6.appendChild(topEmp.length ? M.rankBars(topEmp, { color: '#9b59b6' }) : U.el('div', { class: 'empty' }, 'Chưa gán nhân viên cho hóa đơn')); row3.appendChild(c6);
  root.appendChild(row3);
};
