/* ============================================================
   modules.js — Các phân hệ nghiệp vụ
   ============================================================ */
const M = {};

/* =====================================================================
   TỔNG QUAN (Dashboard)
   ===================================================================== */
M.dashboard = function (root) {
  const period = U.period(App._dashPeriod || 'year');
  const year = period.year;
  const totalCash = PW.totalCash();
  const cashOnly = PW.data.cashAccounts.filter(a => a.type === 'cash').reduce((s, a) => s + PW.accountBalance(a.id), 0);
  const bankOnly = PW.data.cashAccounts.filter(a => a.type === 'bank').reduce((s, a) => s + PW.accountBalance(a.id), 0);
  const receivable = PW.totalReceivable();
  const payable = PW.totalPayable();
  const inv = PW.inventoryValue();
  const rev = PW.revenue(period.from, period.to);
  const cogs = PW.cogs(period.from, period.to);
  const exp = PW.expenses(period.from, period.to);
  const fees = PW.sellingFees(period.from, period.to);
  const profit = rev - cogs - exp - fees;

  // Banner thương hiệu
  root.appendChild(U.el('img', { src: 'assets/banner.svg', alt: 'DALI', class: 'hero-banner' }));

  // Thanh chọn kỳ xem
  const periodBar = U.el('div', { class: 'toolbar' });
  periodBar.appendChild(U.el('div', { class: 'spacer' }));
  periodBar.appendChild(U.el('span', { class: 'text-muted', style: 'margin-right:4px' }, 'Kỳ xem:'));
  const periodSel = C.select([
    { value: 'month', label: 'Tháng này' },
    { value: 'quarter', label: 'Quý này' },
    { value: 'year', label: 'Năm nay' },
  ], App._dashPeriod || 'year');
  periodSel.style.minWidth = '140px';
  periodSel.addEventListener('change', () => { App._dashPeriod = periodSel.value; App.refresh(); });
  periodBar.appendChild(periodSel);
  root.appendChild(periodBar);

  // Cảnh báo tồn tối thiểu
  const lowStock = PW.stockBelowMin();
  if (lowStock.length) {
    root.appendChild(U.el('div', { class: 'alert-bar' }, [
      U.el('span', { class: 'a-ic' }, '⚠️'),
      U.el('span', null, 'Có ' + lowStock.length + ' mặt hàng dưới mức tồn tối thiểu, cần nhập thêm.'),
      U.el('a', { href: '#reports', onclick: e => { e.preventDefault(); App._reportPreset = 'lowstock'; App.go('reports'); } }, 'Xem chi tiết →'),
    ]));
  }

  // KPI badges
  const kpiRow = U.el('div', { class: 'grid c4' });
  const kpis = [
    { label: 'Tổng tiền', value: U.money(totalCash), color: 'var(--teal)', ic: '💰' },
    { label: 'Phải thu', value: U.money(receivable), color: 'var(--blue)', ic: '📥' },
    { label: 'Phải trả', value: U.money(payable), color: 'var(--orange)', ic: '📤' },
    { label: 'Giá trị tồn kho', value: U.money(inv), color: '#9b59b6', ic: '📦' },
  ];
  kpis.forEach(k => {
    kpiRow.appendChild(U.el('div', { class: 'kpi' }, [
      U.el('div', { style: 'display:flex;justify-content:space-between;align-items:flex-start' }, [
        U.el('div', { class: 'label' }, k.label),
        U.el('div', { class: 'ic-badge', style: 'background:' + k.color }, k.ic),
      ]),
      U.el('div', { class: 'value' }, k.value),
      U.el('div', { class: 'sub' }, 'Đơn vị: đồng'),
    ]));
  });
  root.appendChild(kpiRow);

  // ===== Nợ phải thu / phải trả theo hạn nợ =====
  const agingRow = U.el('div', { class: 'grid c2' });
  function agingCard(title, aging, overdueColor) {
    const card = U.el('div', { class: 'card' });
    card.appendChild(U.el('div', { class: 'card-title' }, title));
    card.appendChild(U.el('div', null, [
      U.el('span', { style: 'font-size:24px;font-weight:700' }, U.money(aging.total)),
      U.el('span', { class: 'text-muted', style: 'margin-left:6px' }, 'đ — TỔNG'),
    ]));
    const pct = aging.total > 0 ? (aging.overdue / aging.total * 100) : 0;
    card.appendChild(U.el('div', { class: 'aging-bar mt16' }, [
      U.el('div', { class: 'aging-fill', style: `width:${pct}%;background:${overdueColor}` }),
    ]));
    card.appendChild(U.el('div', { style: 'display:flex;justify-content:space-between;margin-top:10px' }, [
      U.el('div', null, [
        U.el('div', { style: 'font-size:18px;font-weight:700;color:' + overdueColor }, U.money(aging.overdue)),
        U.el('div', { class: 'text-muted', style: 'font-size:12px' }, 'QUÁ HẠN'),
      ]),
      U.el('div', { style: 'text-align:right' }, [
        U.el('div', { style: 'font-size:18px;font-weight:700;color:var(--green)' }, U.money(aging.current)),
        U.el('div', { class: 'text-muted', style: 'font-size:12px' }, 'TRONG HẠN'),
      ]),
    ]));
    return card;
  }
  agingRow.appendChild(agingCard('📥 Nợ phải thu theo hạn nợ', PW.agingReceivable(), 'var(--red)'));
  agingRow.appendChild(agingCard('📤 Nợ phải trả theo hạn nợ', PW.agingPayable(), 'var(--orange)'));
  root.appendChild(agingRow);

  // ===== Sổ giao dịch (Claude/MCP) — chỉ chế độ server =====
  if (PW.mode === 'server') {
    const mcpCard = U.el('div', { class: 'card' });
    mcpCard.appendChild(U.el('div', { class: 'card-title' }, '📒 Sổ giao dịch — hóa đơn Claude ghi (' + period.label + ')'));
    const mcpBody = U.el('div', null, U.el('div', { class: 'section-sub' }, 'Đang tải...'));
    mcpCard.appendChild(mcpBody);
    root.appendChild(mcpCard);
    (async function () {
      const qs = new URLSearchParams({ action: 'summary', from: period.from, to: period.to });
      const r = await PW.api('ledger.php?' + qs.toString());
      mcpBody.innerHTML = '';
      if (r.status === 200 && r.data && r.data.ok && r.data.installed !== false && r.data.summary) {
        const s = r.data.summary;
        const g = U.el('div', { class: 'grid c4' });
        [['Thu (Claude)', s.income || 0, 'var(--green)'], ['Chi (Claude)', s.expense || 0, 'var(--red)'],
         ['Chênh lệch', (s.income || 0) - (s.expense || 0), 'var(--teal)'], ['Số giao dịch', s.count || 0, 'var(--navy)', true]]
          .forEach(a => g.appendChild(U.el('div', null, [
            U.el('div', { style: 'font-size:20px;font-weight:700;color:' + a[2] }, a[3] ? U.num(a[1]) : U.money(a[1])),
            U.el('div', { class: 'sub text-muted', style: 'font-size:12px' }, a[0]),
          ])));
        mcpBody.appendChild(g);
        mcpBody.appendChild(U.el('div', { class: 'section-sub mt8' },
          U.el('a', { href: '#ledger', onclick: e => { e.preventDefault(); App.go('ledger'); } }, 'Xem chi tiết Sổ giao dịch →')));
      } else if (r.data && r.data.installed === false) {
        mcpBody.appendChild(U.el('div', { class: 'section-sub' }, 'Chưa cài Sổ giao dịch (package MCP) — chạy install.sh trên VPS.'));
      } else {
        mcpBody.appendChild(U.el('div', { class: 'section-sub' }, 'Chưa tải được sổ giao dịch.'));
      }
    })();
  }

  // Tình hình tài chính + Doanh thu chi phí lợi nhuận
  const row2 = U.el('div', { class: 'grid c2' });

  const finCard = U.el('div', { class: 'card' });
  finCard.appendChild(U.el('div', { class: 'card-title' }, '📊 Tình hình tài chính'));
  const finRows = [
    ['TỔNG TIỀN', U.money(totalCash), 'b'],
    ['— Tiền mặt', U.money(cashOnly), ''],
    ['— Tiền gửi ngân hàng', U.money(bankOnly), ''],
    ['Phải thu khách hàng', U.money(receivable), ''],
    ['Phải trả nhà cung cấp', U.money(payable), payable > 0 ? 'r' : ''],
    ['Hàng tồn kho', U.money(inv), ''],
  ];
  finRows.forEach(([k, v, style]) => {
    finCard.appendChild(U.el('div', { class: 'fin-row' }, [
      U.el('div', { class: 'k' + (style === 'b' ? '' : '') }, k),
      U.el('div', { class: 'v ' + (style === 'r' ? 'text-red' : '') }, v),
    ]));
  });
  row2.appendChild(finCard);

  const plCard = U.el('div', { class: 'card' });
  plCard.appendChild(U.el('div', { class: 'card-title' }, '📈 Doanh thu · Chi phí · Lợi nhuận (' + period.label + ')'));
  const pl = U.el('div', { class: 'grid c3' });
  [
    ['DOANH THU', rev, 'text-green'],
    ['CHI PHÍ', cogs + exp + fees, 'text-red'],
    ['LỢI NHUẬN', profit, profit >= 0 ? 'text-green' : 'text-red'],
  ].forEach(([l, v, cls]) => {
    pl.appendChild(U.el('div', null, [
      U.el('div', { class: 'value ' + cls, style: 'font-size:22px;font-weight:700' }, U.money(v)),
      U.el('div', { class: 'sub text-muted', style: 'font-size:12px' }, l),
    ]));
  });
  plCard.appendChild(pl);

  // Biểu đồ doanh thu theo tháng
  const months = [];
  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, '0');
    const r = PW.revenue(`${year}-${mm}-01`, `${year}-${mm}-31`);
    months.push({ label: 'T' + m, value: r });
  }
  const maxV = Math.max(1, ...months.map(m => m.value));
  const bars = U.el('div', { class: 'bars' });
  months.forEach(m => {
    const col = U.el('div', { class: 'bar-col' });
    const bar = U.el('div', { class: 'bar', style: 'height:' + (m.value / maxV * 100) + '%' });
    if (m.value > 0) bar.appendChild(U.el('div', { class: 'val' }, U.money(m.value / 1000) + 'k'));
    col.appendChild(bar);
    col.appendChild(U.el('div', { class: 'lbl' }, m.label));
    bars.appendChild(col);
  });
  plCard.appendChild(U.el('div', { class: 'section-sub mt16' }, 'Doanh thu theo tháng (nghìn đồng)'));
  plCard.appendChild(bars);
  row2.appendChild(plCard);
  root.appendChild(row2);

  // ===== Doanh thu (biểu đồ đường) =====
  const cats = [], revArr = [], thuArr = [], chiArr = [], tonArr = [];
  const prevEnd = (Number(year) - 1) + '-12-31';
  let runTon = PW.openingCash() + PW.cashIn(null, prevEnd) - PW.cashOut(null, prevEnd);
  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, '0');
    const f = `${year}-${mm}-01`, t = `${year}-${mm}-31`;
    cats.push('Th' + m);
    revArr.push(PW.revenue(f, t));
    const thu = PW.cashIn(f, t), chi = PW.cashOut(f, t);
    thuArr.push(thu); chiArr.push(chi);
    runTon += thu - chi; tonArr.push(runTon);
  }

  const revCard = U.el('div', { class: 'card' });
  revCard.appendChild(U.el('div', { class: 'card-title' }, '📈 Doanh thu (năm ' + year + ')'));
  revCard.appendChild(U.el('div', null, [
    U.el('span', { style: 'font-size:24px;font-weight:700;color:var(--teal)' }, U.money(rev)),
    U.el('span', { class: 'text-muted', style: 'margin-left:8px' }, 'đ — Tổng doanh thu'),
  ]));
  revCard.appendChild(M.lineChart(cats, [{ name: 'Doanh thu', color: 'var(--teal)', values: revArr }]));
  root.appendChild(revCard);

  // ===== Dòng tiền + Chi phí =====
  const rowCF = U.el('div', { class: 'grid', style: 'grid-template-columns: 3fr 2fr' });

  const cfCard = U.el('div', { class: 'card' });
  cfCard.appendChild(U.el('div', { class: 'card-title' }, '💵 Dòng tiền (năm ' + year + ')'));
  const cfTot = U.el('div', { class: 'grid c3' });
  [
    ['TỔNG THU', thuArr.reduce((a, b) => a + b, 0), 'text-green'],
    ['TỔNG CHI', chiArr.reduce((a, b) => a + b, 0), 'text-red'],
    ['TỒN QUỸ', PW.totalCash(), 'text-blue'],
  ].forEach(([l, v, cls]) => cfTot.appendChild(U.el('div', null, [
    U.el('div', { class: 'value ' + cls, style: 'font-size:20px;font-weight:700' }, U.money(v)),
    U.el('div', { class: 'sub text-muted', style: 'font-size:12px' }, l),
  ])));
  cfCard.appendChild(cfTot);
  cfCard.appendChild(M.lineChart(cats, [
    { name: 'Thu', color: '#27ae60', values: thuArr },
    { name: 'Chi', color: '#e74c3c', values: chiArr },
    { name: 'Tồn quỹ', color: 'var(--orange)', values: tonArr },
  ]));
  rowCF.appendChild(cfCard);

  // Chi phí (donut theo loại)
  const expAgg = {};
  PW.data.payments.filter(p => !p.supplierId && p.date >= period.from && p.date <= period.to).forEach(p => {
    const k = (p.reason || '').trim() || 'Chi phí khác';
    expAgg[k] = (expAgg[k] || 0) + Number(p.amount);
  });
  const cogsY = PW.cogs(period.from, period.to);
  if (cogsY > 0) expAgg['Giá vốn hàng bán'] = (expAgg['Giá vốn hàng bán'] || 0) + cogsY;
  const expSegs = Object.keys(expAgg).map((k, i) => ({ label: k, value: expAgg[k], color: M.PALETTE[i % M.PALETTE.length] }))
    .sort((a, b) => b.value - a.value);
  const expCard = U.el('div', { class: 'card' });
  expCard.appendChild(U.el('div', { class: 'card-title' }, '🥧 Chi phí (' + period.label + ')'));
  expCard.appendChild(U.el('div', null, [
    U.el('span', { style: 'font-size:22px;font-weight:700;color:var(--red)' }, U.money(expSegs.reduce((s, x) => s + x.value, 0))),
    U.el('span', { class: 'text-muted', style: 'margin-left:8px' }, 'đ — Tổng chi phí'),
  ]));
  if (expSegs.length) expCard.appendChild(U.el('div', { class: 'mt16' }, M.donut(expSegs)));
  else expCard.appendChild(U.el('div', { class: 'empty' }, 'Chưa có chi phí phát sinh'));
  rowCF.appendChild(expCard);
  root.appendChild(rowCF);

  // Hàng tồn kho + Bán chạy
  const row3 = U.el('div', { class: 'grid c2' });

  const invCard = U.el('div', { class: 'card' });
  invCard.appendChild(U.el('div', { class: 'card-title' }, '📦 Hàng hóa tồn kho'));
  const stockRows = PW.data.products.map(p => ({ p, qty: PW.stockOf(p.id), val: PW.stockOf(p.id) * p.cost }))
    .sort((a, b) => b.val - a.val).slice(0, 6);
  invCard.appendChild(C.table(stockRows, [
    { label: 'Tên hàng', render: r => U.esc(r.p.name) },
    { label: 'SL tồn', num: true, render: r => U.num(r.qty) },
    { label: 'Giá trị', num: true, render: r => U.money(r.val) },
  ]));
  row3.appendChild(invCard);

  const bestCard = U.el('div', { class: 'card' });
  bestCard.appendChild(U.el('div', { class: 'card-title' }, '🔥 Mặt hàng bán chạy (' + period.label + ')'));
  const sold = {};
  PW.data.salesInvoices.filter(si => si.date >= period.from && si.date <= period.to).forEach(si => si.items.forEach(it => {
    sold[it.productId] = sold[it.productId] || { qty: 0, rev: 0 };
    sold[it.productId].qty += Number(it.qty);
    sold[it.productId].rev += Number(it.qty) * Number(it.price);
  }));
  const bestRows = Object.keys(sold).map(pid => ({ p: PW.product(pid), ...sold[pid] }))
    .filter(r => r.p).sort((a, b) => b.rev - a.rev).slice(0, 6);
  bestCard.appendChild(C.table(bestRows, [
    { label: 'Tên hàng', render: r => U.esc(r.p.name) },
    { label: 'SL bán', num: true, render: r => U.num(r.qty) },
    { label: 'Doanh thu', num: true, render: r => U.money(r.rev) },
  ], { empty: 'Chưa có dữ liệu bán hàng' }));
  row3.appendChild(bestCard);
  root.appendChild(row3);
};

/* =====================================================================
   DANH MỤC HÀNG HÓA
   ===================================================================== */
M.products = function (root) {
  const card = U.el('div', { class: 'card' });
  const toolbar = U.el('div', { class: 'toolbar' });
  const search = U.el('input', { class: 'search', placeholder: 'Tìm theo tên / mã hàng...' });
  toolbar.appendChild(search);
  toolbar.appendChild(U.el('div', { class: 'spacer' }));
  toolbar.appendChild(C.btn('+ Thêm hàng hóa', () => M.productForm(), 'primary'));
  card.appendChild(toolbar);
  const tableHost = U.el('div');
  card.appendChild(tableHost);
  root.appendChild(card);

  function draw() {
    const q = search.value.trim().toLowerCase();
    const rows = PW.data.products.filter(p =>
      !q || p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q));
    tableHost.innerHTML = '';
    tableHost.appendChild(C.table(rows, [
      { label: 'Mã', render: p => U.esc(p.code) },
      { label: 'Tên hàng hóa', render: p => U.esc(p.name) },
      { label: 'Nhóm', render: p => U.esc(p.group || '') },
      { label: 'ĐVT', center: true, render: p => U.esc(p.unit) },
      { label: 'Giá vốn', num: true, render: p => U.money(p.cost) },
      { label: 'Giá bán', num: true, render: p => U.money(p.price) },
      { label: 'Tồn kho', num: true, render: p => {
          const q = PW.stockOf(p.id);
          return `<span class="${q <= 0 ? 'text-red' : ''}">${U.num(q)}</span>`;
        } },
      { label: '', render: p => C.actions([
          { label: 'Sửa', onClick: () => M.productForm(p) },
          { label: 'Xóa', cls: 'danger', onClick: () => {
              if (U.confirm('Xóa hàng hóa "' + p.name + '"?')) {
                PW.logActivity('delete', 'product', (p.code || '') + ' ' + p.name, '');
                PW.data.products = PW.data.products.filter(x => x.id !== p.id);
                PW.save(); draw(); U.toast('Đã xóa');
              }
            } },
        ]) },
    ], { empty: 'Chưa có hàng hóa' }));
  }
  search.addEventListener('input', draw);
  draw();
};

M.productForm = function (p) {
  const isNew = !p;
  p = p || { code: PW.nextCode('HH'), name: '', group: '', unit: 'Cái', cost: 0, price: 0, openingStock: 0 };
  const f = {
    kind: C.select((M.PRODUCT_KINDS || [{ kind: 'hanghoa', label: 'Hàng hóa' }]).map(k => ({ value: k.kind, label: k.label })), p.kind || 'hanghoa'),
    code: C.input({ value: p.code }),
    name: C.input({ value: p.name }),
    group: C.input({ value: p.group || '', list: 'dl-pgroups' }),
    unit: C.input({ value: p.unit, list: 'dl-punits' }),
    cost: C.input({ type: 'number', value: p.cost, min: 0 }),
    price: C.input({ type: 'number', value: p.price, min: 0 }),
    stock: C.input({ type: 'number', value: p.openingStock, min: 0 }),
    minStock: C.input({ type: 'number', value: p.minStock || 0, min: 0 }),
  };
  // ----- Định mức NVL (BOM) cho thành phẩm sản xuất -----
  let bom = (p.bom || []).map(b => Object.assign({}, b));
  const bomBody = U.el('tbody');
  const bomCostCell = U.el('span', { class: 'text-muted' });
  function bomCost() { return bom.reduce((s, b) => { const m = PW.product(b.materialId); return s + (Number(b.qty) || 0) * PW.unitCost(m); }, 0); }
  function refreshBomCost() { bomCostCell.textContent = U.money(bomCost()) + ' đ'; }
  function drawBom() {
    bomBody.innerHTML = '';
    bom.forEach((b, idx) => {
      const sel = C.select([{ value: '', label: '-- Chọn NVL --' }].concat(
        PW.data.products.filter(x => x.id !== (p.id || '')).map(x => ({ value: x.id, label: x.code + ' - ' + x.name }))), b.materialId);
      sel.addEventListener('change', () => { b.materialId = sel.value; drawBom(); refreshBomCost(); });
      const q = U.el('input', { type: 'number', value: b.qty, min: 0, step: 'any', style: 'text-align:right' });
      q.addEventListener('input', () => { b.qty = Number(q.value) || 0; refreshBomCost(); });
      bomBody.appendChild(U.el('tr', null, [
        U.el('td', null, sel),
        U.el('td', { style: 'width:120px' }, q),
        U.el('td', { class: 'center', style: 'width:40px' }, U.el('button', { class: 'btn sm danger', onclick: () => { bom.splice(idx, 1); drawBom(); refreshBomCost(); } }, '×')),
      ]));
    });
    refreshBomCost();
  }
  const bomTable = U.el('table', { class: 'items-tbl' });
  bomTable.appendChild(U.el('thead', null, U.el('tr', null, [U.el('th', null, 'Nguyên vật liệu'), U.el('th', null, 'Định mức /1 thành phẩm'), U.el('th', null, '')])));
  bomTable.appendChild(bomBody);
  const bomSection = U.el('div', null, [
    U.el('div', { class: 'card-title mt16', style: 'font-size:14px' }, '🧩 Định mức NVL (nếu là thành phẩm sản xuất)'),
    U.el('div', { class: 'section-sub' }, 'Khai báo NVL cần để làm ra 1 đơn vị thành phẩm — dùng cho Lệnh sản xuất tính giá thành. Để trống nếu đây là NVL/hàng mua.'),
    U.el('div', { class: 'table-wrap' }, bomTable),
    U.el('div', { class: 'mt8', style: 'display:flex;justify-content:space-between;align-items:center' }, [
      C.btn('+ Thêm NVL', () => { bom.push({ materialId: '', qty: 1 }); drawBom(); }, 'sm'),
      U.el('div', null, [U.el('span', { class: 'text-muted' }, 'Giá vốn NVL theo định mức: '), bomCostCell]),
    ]),
  ]);
  drawBom();

  // ----- Thành phần combo -----
  let components = (p.components || []).map(c => Object.assign({}, c));
  const comboBody = U.el('tbody');
  function drawCombo() {
    comboBody.innerHTML = '';
    components.forEach((c, idx) => {
      const picker = M.productPicker(c.productId, (pp) => { c.productId = pp.id; drawCombo(); }, { isSale: true });
      const q = U.el('input', { type: 'number', value: c.qty, min: 0, step: 'any', style: 'text-align:right' });
      q.addEventListener('input', () => { c.qty = Number(q.value) || 0; });
      comboBody.appendChild(U.el('tr', null, [
        U.el('td', null, picker),
        U.el('td', { style: 'width:130px' }, q),
        U.el('td', { class: 'center', style: 'width:40px' }, U.el('button', { class: 'btn sm danger', onclick: () => { components.splice(idx, 1); drawCombo(); } }, '×')),
      ]));
    });
  }
  const comboTable = U.el('table', { class: 'items-tbl' });
  comboTable.appendChild(U.el('thead', null, U.el('tr', null, [U.el('th', null, 'Hàng thành phần'), U.el('th', null, 'Số lượng /1 combo'), U.el('th', null, '')])));
  comboTable.appendChild(comboBody);
  const comboSection = U.el('div', null, [
    U.el('div', { class: 'card-title mt16', style: 'font-size:14px' }, '▦ Thành phần combo'),
    U.el('div', { class: 'section-sub' }, 'Combo gồm những hàng nào — khi bán combo sẽ TỰ trừ kho + tính giá vốn theo từng món. Tồn của combo = số bộ tối đa lắp được.'),
    U.el('div', { class: 'table-wrap' }, comboTable),
    U.el('div', { class: 'mt8' }, C.btn('+ Thêm thành phần', () => { components.push({ productId: '', qty: 1 }); drawCombo(); }, 'sm')),
  ]);
  drawCombo();

  // Hiện/ẩn section theo tính chất
  function applyKind() {
    const k = f.kind.value;
    bomSection.style.display = (k === 'thanhpham' || (bom.length && k !== 'combo')) ? '' : 'none';
    comboSection.style.display = (k === 'combo') ? '' : 'none';
    // NVL: ẩn giá vốn + giá bán (giá đổi theo NCC/thời điểm -> báo cáo lấy giá mua bình quân)
    const hide = (k === 'nvl');
    f.cost.parentElement.style.display = hide ? 'none' : '';
    f.price.parentElement.style.display = hide ? 'none' : '';
  }
  f.kind.addEventListener('change', applyKind);

  // ----- Bảng giá theo kênh -----
  const chInputs = {};
  const chPriceGrid = U.el('div', { class: 'form-grid' });
  (PW.data.channels || []).forEach(c => {
    const cur = (p.channelPrices || {})[c.id];
    const inp = C.input({ type: 'number', min: 0, value: cur != null ? cur : '', placeholder: 'mặc định' });
    chInputs[c.id] = inp;
    chPriceGrid.appendChild(C.field('Giá ' + c.name, inp));
  });
  const chSection = (PW.data.channels || []).length ? U.el('div', null, [
    U.el('div', { class: 'card-title mt16', style: 'font-size:14px' }, '🛒 Bảng giá theo kênh (để trống = dùng giá bán mặc định)'),
    chPriceGrid,
  ]) : null;

  const body = U.el('div', null, [
    U.el('div', { class: 'form-grid' }, [
      C.field('Tính chất', f.kind),
      C.field('Mã hàng', f.code, { required: true }),
      C.field('Tên hàng hóa', f.name, { required: true, full: true }),
      C.field('Nhóm hàng', f.group),
      C.field('Đơn vị tính', f.unit),
      C.field('Tồn kho đầu kỳ', f.stock),
      C.field('Tồn tối thiểu (cảnh báo)', f.minStock),
      C.field('Giá vốn (đ)', f.cost),
      C.field('Giá bán (đ)', f.price),
    ]),
    M.datalist('dl-pgroups', PW.data.productGroups.map(g => g.name)),
    M.datalist('dl-punits', PW.data.units.map(u => u.name)),
    chSection,
    bomSection,
    comboSection,
  ]);
  applyKind();
  C.modal({
    title: isNew ? 'Thêm hàng hóa' : 'Sửa hàng hóa', wide: true,
    body,
    footer: [
      C.btn('Hủy', C.closeModal),
      C.btn('Lưu', () => {
        if (!f.name.value.trim()) return U.toast('Nhập tên hàng hóa', 'error');
        if (f.kind.value === 'combo') {
          const comps = components.filter(c => c.productId && Number(c.qty) > 0);
          if (!comps.length) return U.toast('Combo cần ít nhất 1 thành phần', 'error');
          const bad = comps.map(c => PW.product(c.productId)).find(m => m && (m.kind === 'combo' || m.kind === 'dichvu'));
          if (bad) return U.toast('Combo không được chứa ' + (bad.kind === 'combo' ? 'combo khác' : 'dịch vụ') + ': ' + bad.name, 'error');
        }
        const obj = {
          id: p.id || PW.uid(), code: f.code.value.trim(), name: f.name.value.trim(),
          kind: f.kind.value,
          group: f.group.value.trim(), unit: f.unit.value.trim() || 'Cái',
          cost: Number(f.cost.value) || 0, price: Number(f.price.value) || 0,
          openingStock: Number(f.stock.value) || 0,
          minStock: Number(f.minStock.value) || 0,
          bom: bom.filter(b => b.materialId && Number(b.qty) > 0).map(b => ({ materialId: b.materialId, qty: Number(b.qty) })),
          channelPrices: (function () { const o = {}; Object.keys(chInputs).forEach(id => { const v = chInputs[id].value; if (v !== '' && Number(v) >= 0) o[id] = Number(v); }); return o; })(),
        };
        if (f.kind.value === 'combo') obj.components = components.filter(c => c.productId && Number(c.qty) > 0).map(c => ({ productId: c.productId, qty: Number(c.qty) }));
        if (isNew) PW.data.products.push(obj);
        else Object.assign(p, obj);
        PW.logActivity(isNew ? 'create' : 'update', 'product', (obj.code || '') + ' ' + obj.name, '');
        PW.save(); C.closeModal(); App.refresh(); U.toast('Đã lưu hàng hóa');
      }, 'primary'),
    ],
  });
};

/* =====================================================================
   DANH MỤC ĐỐI TƯỢNG (Khách hàng / Nhà cung cấp) — dùng chung
   ===================================================================== */
M.partners = function (root, kind) {
  // kind: 'customer' | 'supplier'
  const isCus = kind === 'customer';
  const list = isCus ? PW.data.customers : PW.data.suppliers;
  const debtFn = isCus ? PW.customerDebt : PW.supplierDebt;
  const today = U.today(), from30 = U.addDays(today, -30);

  // ===== 3 thẻ tổng hợp =====
  const aging = isCus ? PW.agingReceivable() : PW.agingPayable();
  const totalDebt = isCus ? PW.totalReceivable() : PW.totalPayable();
  const paid30 = isCus ? PW.cashIn(from30, today) : PW.cashOut(from30, today);
  const kpiRow = U.el('div', { class: 'grid c3' });
  [
    { l: 'Nợ quá hạn', v: aging.overdue, c: 'var(--red)' },
    { l: isCus ? 'Tổng nợ phải thu' : 'Tổng nợ phải trả', v: totalDebt, c: 'var(--navy)' },
    { l: (isCus ? 'Đã thu' : 'Đã trả') + ' (30 ngày gần đây)', v: paid30, c: 'var(--green)' },
  ].forEach(k => kpiRow.appendChild(U.el('div', { class: 'kpi' }, [
    U.el('div', { class: 'value', style: 'color:' + k.c }, U.money(k.v)),
    U.el('div', { class: 'sub text-muted' }, k.l),
  ])));
  root.appendChild(kpiRow);

  // ===== Danh sách =====
  let page = 1, pageSize = 50;
  const selected = new Set();
  const card = U.el('div', { class: 'card' });
  const toolbar = U.el('div', { class: 'toolbar' });
  const search = U.el('input', { class: 'search', placeholder: 'Tìm theo tên / mã / điện thoại...' });
  const bulkBtn = C.btn('🗑 Xóa đã chọn', () => bulkDelete(), 'danger sm');
  bulkBtn.style.display = 'none';
  toolbar.appendChild(search);
  toolbar.appendChild(bulkBtn);
  toolbar.appendChild(U.el('div', { class: 'spacer' }));
  toolbar.appendChild(C.btn('📊 Xuất Excel', () => doExport(), 'sm'));
  toolbar.appendChild(C.btn('+ Thêm ' + (isCus ? 'khách hàng' : 'nhà cung cấp'), () => M.partnerForm(kind), 'primary'));
  card.appendChild(toolbar);
  const host = U.el('div');
  card.appendChild(host);
  const pager = U.el('div', { class: 'pager' });
  card.appendChild(pager);
  root.appendChild(card);

  function filtered() {
    const q = search.value.trim().toLowerCase();
    return list.filter(x => !q || (x.name || '').toLowerCase().includes(q)
      || (x.code || '').toLowerCase().includes(q) || (x.phone || '').includes(q));
  }
  function fmtDebt(d) {
    if (d < 0) return `<span class="text-red">(${U.money(-d)})</span>`;
    if (d > 0) return `<span class="${isCus ? 'text-blue' : 'text-red'}">${U.money(d)}</span>`;
    return '<span class="text-muted">0</span>';
  }
  function updateBulk() {
    bulkBtn.style.display = selected.size ? 'inline-flex' : 'none';
    bulkBtn.textContent = '🗑 Xóa đã chọn (' + selected.size + ')';
  }
  function removeOne(id) {
    const o = (isCus ? PW.data.customers : PW.data.suppliers).find(y => y.id === id);
    PW.logActivity('delete', isCus ? 'customer' : 'supplier', o ? ((o.code || '') + ' ' + o.name) : id, '');
    if (isCus) PW.data.customers = PW.data.customers.filter(y => y.id !== id);
    else PW.data.suppliers = PW.data.suppliers.filter(y => y.id !== id);
    selected.delete(id); PW.save(); App.refresh(); U.toast('Đã xóa');
  }
  function bulkDelete() {
    if (!selected.size || !U.confirm('Xóa ' + selected.size + ' đối tượng đã chọn?')) return;
    PW.logActivity('delete', isCus ? 'customer' : 'supplier', '(' + selected.size + ' đối tượng)', 'Xóa hàng loạt');
    if (isCus) PW.data.customers = PW.data.customers.filter(y => !selected.has(y.id));
    else PW.data.suppliers = PW.data.suppliers.filter(y => !selected.has(y.id));
    selected.clear(); PW.save(); App.refresh(); U.toast('Đã xóa các đối tượng đã chọn');
  }
  function doExport() {
    const rows = filtered().map(x => [x.code, x.name, x.address || '', x.taxCode || '', x.phone || '', debtFn(x.id)]);
    U.exportExcel(isCus ? 'DanhSachKhachHang' : 'DanhSachNhaCungCap',
      ['Mã', 'Tên', 'Địa chỉ', 'MST/CCCD', 'Điện thoại', isCus ? 'Công nợ phải thu' : 'Công nợ phải trả'],
      rows, isCus ? 'DANH SÁCH KHÁCH HÀNG' : 'DANH SÁCH NHÀ CUNG CẤP');
  }

  function draw() {
    const rows = filtered();
    const total = rows.length;
    const size = pageSize === 'all' ? (total || 1) : pageSize;
    const pages = Math.max(1, Math.ceil(total / size));
    if (page > pages) page = pages;
    const pageRows = pageSize === 'all' ? rows : rows.slice((page - 1) * size, (page - 1) * size + size);

    const t = U.el('table', { class: 'tbl' });
    const headChk = U.el('input', { type: 'checkbox' });
    headChk.checked = pageRows.length > 0 && pageRows.every(r => selected.has(r.id));
    headChk.addEventListener('change', () => {
      pageRows.forEach(r => headChk.checked ? selected.add(r.id) : selected.delete(r.id));
      draw();
    });
    const htr = U.el('tr');
    htr.appendChild(U.el('th', { style: 'width:34px' }, headChk));
    ['Mã', 'Tên ' + (isCus ? 'khách hàng' : 'nhà cung cấp'), 'Địa chỉ', 'MST/CCCD', 'Điện thoại'].forEach(h =>
      htr.appendChild(U.el('th', null, h)));
    htr.appendChild(U.el('th', { class: 'num' }, isCus ? 'Công nợ phải thu' : 'Công nợ phải trả'));
    htr.appendChild(U.el('th', { class: 'center' }, 'Chức năng'));
    t.appendChild(U.el('thead', null, htr));

    const tb = U.el('tbody');
    if (!pageRows.length) {
      tb.appendChild(U.el('tr', null, U.el('td', { colspan: 8 }, U.el('div', { class: 'empty' }, 'Chưa có dữ liệu'))));
    }
    pageRows.forEach(x => {
      const chk = U.el('input', { type: 'checkbox' });
      chk.checked = selected.has(x.id);
      chk.addEventListener('change', () => { chk.checked ? selected.add(x.id) : selected.delete(x.id); updateBulk(); });
      const acts = isCus
        ? [{ label: 'Lập hóa đơn', cls: 'primary', onClick: () => M.salesForm(null, x.id) },
           { label: 'Thu tiền', onClick: () => M.receiptForm(null, x.id) }]
        : [{ label: 'Lập phiếu nhập', cls: 'primary', onClick: () => M.purchaseForm(null, x.id) },
           { label: 'Trả tiền', onClick: () => M.paymentForm(null, x.id) }];
      acts.push({ label: 'Sổ', onClick: () => M.debtLedger(kind, x.id) });
      acts.push({ label: 'Sửa', onClick: () => M.partnerForm(kind, x) });
      acts.push({ label: 'Xóa', cls: 'danger', onClick: () => { if (U.confirm('Xóa "' + x.name + '"?')) removeOne(x.id); } });
      tb.appendChild(U.el('tr', null, [
        U.el('td', null, chk),
        U.el('td', null, U.esc(x.code)),
        U.el('td', null, U.esc(x.name)),
        U.el('td', null, U.esc(x.address || '')),
        U.el('td', null, U.esc(x.taxCode || '')),
        U.el('td', null, U.esc(x.phone || '')),
        U.el('td', { class: 'num', html: fmtDebt(debtFn(x.id)) }),
        U.el('td', { class: 'center' }, C.actions(acts)),
      ]));
    });
    t.appendChild(tb);
    host.innerHTML = '';
    host.appendChild(U.el('div', { class: 'table-wrap' }, t));

    // Phân trang
    pager.innerHTML = '';
    pager.appendChild(U.el('div', { class: 'text-muted' }, 'Tổng số: ' + total + ' bản ghi'));
    pager.appendChild(U.el('div', { class: 'spacer' }));
    pager.appendChild(U.el('span', { class: 'text-muted', style: 'margin-right:6px' }, 'Số dòng/trang:'));
    const sizeSel = C.select([{ value: 20, label: '20' }, { value: 50, label: '50' }, { value: 100, label: '100' }, { value: 'all', label: 'Tất cả' }], pageSize);
    sizeSel.addEventListener('change', () => { pageSize = sizeSel.value === 'all' ? 'all' : Number(sizeSel.value); page = 1; draw(); });
    pager.appendChild(sizeSel);
    if (pageSize !== 'all' && pages > 1) {
      pager.appendChild(C.btn('‹', () => { if (page > 1) { page--; draw(); } }, 'sm'));
      pager.appendChild(U.el('span', { style: 'margin:0 8px' }, 'Trang ' + page + '/' + pages));
      pager.appendChild(C.btn('›', () => { if (page < pages) { page++; draw(); } }, 'sm'));
    }
    updateBulk();
  }
  search.addEventListener('input', () => { page = 1; draw(); });
  draw();
};

M.partnerForm = function (kind, x) {
  const isCus = kind === 'customer';
  const isNew = !x;
  x = x || { code: PW.nextCode(isCus ? 'KH' : 'NCC'), type: 'org', name: '' };

  // Loại đối tượng + cờ "cũng là ..."
  const tOrg = U.el('input', { type: 'radio', name: 'pw-ptype', value: 'org' });
  const tInd = U.el('input', { type: 'radio', name: 'pw-ptype', value: 'individual' });
  (x.type === 'individual' ? tInd : tOrg).checked = true;
  const alsoChk = U.el('input', { type: 'checkbox' }); if (x.alsoOther) alsoChk.checked = true;
  const typeRow = U.el('div', { class: 'full', style: 'display:flex;gap:26px;align-items:center;flex-wrap:wrap' }, [
    U.el('label', { class: 'radio' }, [tOrg, ' Tổ chức']),
    U.el('label', { class: 'radio' }, [tInd, ' Cá nhân']),
    U.el('label', { class: 'radio' }, [alsoChk, ' ' + (isCus ? 'Là nhà cung cấp' : 'Là khách hàng')]),
  ]);

  const f = {
    code: C.input({ value: x.code || '' }),
    name: C.input({ value: x.name || '' }),
    tax: C.input({ value: x.taxCode || '' }),
    phone: C.input({ value: x.phone || '' }),
    email: C.input({ value: x.email || '', type: 'email' }),
    website: C.input({ value: x.website || '' }),
    debt: C.input({ type: 'number', value: x.openingDebt || 0 }),
    contactName: C.input({ value: x.contactName || '' }),
    contactEmail: C.input({ value: x.contactEmail || '' }),
    contactPhone: C.input({ value: x.contactPhone || '' }),
    rep: C.input({ value: x.rep || '' }),
    bankName: C.input({ value: x.bankName || '' }),
    bankAccount: C.input({ value: x.bankAccount || '' }),
  };
  const addrTa = C.textarea({ rows: 2, placeholder: 'VD: Số 82 Duy Tân, Cầu Giấy, Hà Nội' }); addrTa.value = x.address || '';
  const noteTa = C.textarea({ rows: 3 }); noteTa.value = x.note || '';

  // Nhóm KH/NCC (select + thêm nhanh)
  const groupOpts = () => [{ value: '', label: '-- Chọn nhóm --' }].concat(PW.data.partnerGroups.map(g => ({ value: g.id, label: g.name })));
  const groupSel = C.select(groupOpts(), x.groupId || '');
  const addGroupBtn = U.el('button', { class: 'btn sm', type: 'button', title: 'Thêm nhóm mới', onclick: () => {
    const name = prompt('Tên nhóm mới:');
    if (name && name.trim()) {
      const g = { id: PW.uid(), name: name.trim() };
      PW.data.partnerGroups.push(g); PW.save();
      groupSel.innerHTML = '';
      groupOpts().forEach(o => groupSel.appendChild(U.el('option', { value: o.value }, o.label)));
      groupSel.value = g.id; U.toast('Đã thêm nhóm');
    }
  } }, '+');
  const groupRow = U.el('div', { style: 'display:flex;gap:6px' }, [groupSel, addGroupBtn]);

  // Nhân viên phụ trách
  const empSel = C.select([{ value: '', label: '-- Không --' }].concat(PW.data.employees.map(e => ({ value: e.id, label: e.name }))), x.employeeId || '');
  // Điều khoản TT mặc định
  const termSel = C.select([{ value: '', label: '-- Mặc định --' }].concat(PW.data.paymentTerms.map(t => ({ value: t.id, label: t.name }))), x.paymentTermId || '');
  // Hoa hồng CTV (chỉ khách hàng)
  const commI = isCus ? C.input({ type: 'number', value: x.commissionPercent || 0, min: 0, max: 100 }) : null;

  const header = U.el('div', { class: 'form-grid' }, [
    typeRow,
    C.field('Mã số thuế / CCCD', f.tax),
    C.field('Mã ' + (isCus ? 'khách hàng' : 'NCC'), f.code, { required: true }),
    C.field('Tên ' + (isCus ? 'khách hàng' : 'nhà cung cấp'), f.name, { required: true, full: true }),
    C.field('Địa chỉ', addrTa, { full: true }),
    C.field('Điện thoại', f.phone),
    C.field('Email', f.email),
    C.field('Website', f.website),
    C.field('Nợ đầu kỳ ' + (isCus ? 'phải thu' : 'phải trả') + ' (đ)', f.debt),
    C.field('Nhóm ' + (isCus ? 'khách hàng' : 'NCC'), groupRow),
    C.field('Nhân viên phụ trách', empSel),
    isCus ? C.field('Hoa hồng CTV (%) — để 0 nếu không phải CTV', commI) : null,
  ]);

  const tabs = C.tabs([
    { label: 'Thông tin liên hệ', content: U.el('div', { class: 'form-grid' }, [
      C.field('Người liên hệ', f.contactName),
      C.field('Email liên hệ', f.contactEmail),
      C.field('Điện thoại liên hệ', f.contactPhone),
      C.field('Đại diện theo pháp luật', f.rep),
    ]) },
    { label: 'Điều khoản thanh toán', content: U.el('div', { class: 'form-grid' }, [
      C.field('Điều khoản TT mặc định', termSel, { full: true }),
      U.el('div', { class: 'section-sub full' }, 'Khi lập hóa đơn/chứng từ cho đối tượng này, "Hạn thanh toán" sẽ tự tính theo điều khoản mặc định.'),
    ]) },
    { label: 'Tài khoản ngân hàng', content: U.el('div', { class: 'form-grid' }, [
      C.field('Ngân hàng', f.bankName),
      C.field('Số tài khoản', f.bankAccount),
    ]) },
    { label: 'Ghi chú', content: C.field('Ghi chú', noteTa, { full: true }) },
  ]);

  const body = U.el('div', null, [header, tabs]);

  function buildObj() {
    return {
      id: x.id || PW.uid(), code: f.code.value.trim(), name: f.name.value.trim(),
      type: tInd.checked ? 'individual' : 'org', alsoOther: alsoChk.checked,
      taxCode: f.tax.value.trim(), phone: f.phone.value.trim(), email: f.email.value.trim(),
      website: f.website.value.trim(), address: addrTa.value.trim(),
      groupId: groupSel.value || null, employeeId: empSel.value || null, paymentTermId: termSel.value || null,
      contactName: f.contactName.value.trim(), contactEmail: f.contactEmail.value.trim(),
      contactPhone: f.contactPhone.value.trim(), rep: f.rep.value.trim(),
      bankName: f.bankName.value.trim(), bankAccount: f.bankAccount.value.trim(),
      note: noteTa.value.trim(), openingDebt: Number(f.debt.value) || 0,
      commissionPercent: commI ? (Number(commI.value) || 0) : (x.commissionPercent || 0),
      isCollaborator: commI ? (Number(commI.value) > 0) : (x.isCollaborator || false),
    };
  }
  function save(addAnother) {
    if (!f.name.value.trim()) return U.toast('Nhập tên', 'error');
    const obj = buildObj();
    const target = isCus ? PW.data.customers : PW.data.suppliers;
    if (isNew) target.push(obj); else Object.assign(x, obj);
    PW.logActivity(isNew ? 'create' : 'update', isCus ? 'customer' : 'supplier', (obj.code || '') + ' ' + obj.name, '');
    // Nếu đánh dấu "cũng là ...", tạo bản sao sang danh sách kia (nếu chưa có cùng mã)
    if (alsoChk.checked) {
      const other = isCus ? PW.data.suppliers : PW.data.customers;
      if (!other.some(o => o.code === obj.code)) other.push(Object.assign({}, obj, { id: PW.uid(), openingDebt: 0 }));
    }
    PW.save(); U.toast('Đã lưu');
    if (addAnother && isNew) { C.closeModal(); M.partnerForm(kind); }
    else { C.closeModal(); App.refresh(); }
  }

  const footer = [C.btn('Hủy', C.closeModal)];
  if (isNew) footer.push(C.btn('Cất và Thêm', () => save(true)));
  footer.push(C.btn('Cất', () => save(false), 'primary'));

  C.modal({
    title: (isNew ? 'Thêm ' : 'Sửa ') + (isCus ? 'khách hàng' : 'nhà cung cấp'),
    wide: true, body, footer,
  });
};

/* =====================================================================
   SỔ CHI TIẾT CÔNG NỢ (theo từng khách hàng / nhà cung cấp)
   ===================================================================== */
M.debtLedgerData = function (kind, id) {
  const isCus = kind === 'customer';
  const partner = isCus ? PW.customer(id) : PW.supplier(id);
  const opening = Number(partner.openingDebt || 0);
  const rows = [];
  if (isCus) {
    PW.data.salesInvoices.filter(si => si.customerId === id).forEach(si =>
      rows.push({ date: si.date, code: si.code, desc: 'Hóa đơn bán hàng' + (si.dueDate ? ' (hạn ' + U.date(si.dueDate) + ')' : ''), tang: PW.invoiceTotal(si), giam: Number(si.paid || 0) }));
    PW.data.receipts.filter(r => r.customerId === id).forEach(r =>
      rows.push({ date: r.date, code: r.code, desc: r.reason || 'Thu tiền', tang: 0, giam: Number(r.amount) }));
    PW.data.salesReturns.filter(sr => sr.customerId === id).forEach(sr =>
      rows.push({ date: sr.date, code: sr.code, desc: 'Trả lại hàng bán', tang: 0, giam: PW.returnTotal(sr) }));
    PW.data.salesDiscounts.filter(g => g.customerId === id).forEach(g =>
      rows.push({ date: g.date, code: g.code, desc: 'Giảm giá hàng bán' + (g.reason ? ': ' + g.reason : ''), tang: 0, giam: Number(g.amount) }));
  } else {
    PW.data.purchases.filter(pu => pu.supplierId === id).forEach(pu =>
      rows.push({ date: pu.date, code: pu.code, desc: 'Phiếu nhập mua' + (pu.dueDate ? ' (hạn ' + U.date(pu.dueDate) + ')' : ''), tang: PW.purchaseTotal(pu), giam: Number(pu.paid || 0) }));
    PW.data.payments.filter(p => p.supplierId === id).forEach(p =>
      rows.push({ date: p.date, code: p.code, desc: p.reason || 'Trả tiền', tang: 0, giam: Number(p.amount) }));
    PW.data.purchaseReturns.filter(pr => pr.supplierId === id).forEach(pr =>
      rows.push({ date: pr.date, code: pr.code, desc: 'Trả lại hàng mua', tang: 0, giam: PW.purchaseReturnTotal(pr) }));
    PW.data.purchaseDiscounts.filter(g => g.supplierId === id).forEach(g =>
      rows.push({ date: g.date, code: g.code, desc: 'Giảm giá hàng mua' + (g.reason ? ': ' + g.reason : ''), tang: 0, giam: Number(g.amount) }));
  }
  rows.sort((a, b) => (a.date + a.code).localeCompare(b.date + b.code));
  let bal = opening;
  const display = [{ date: '', code: '', desc: 'Số dư đầu kỳ', tang: 0, giam: 0, bal: opening, opening: true }];
  rows.forEach(r => { bal += r.tang - r.giam; display.push(Object.assign({}, r, { bal })); });
  return { partner, isCus, display, opening, closing: bal,
    totalTang: rows.reduce((s, r) => s + r.tang, 0), totalGiam: rows.reduce((s, r) => s + r.giam, 0) };
};

M.debtLedger = function (kind, id) {
  const d = M.debtLedgerData(kind, id);
  const cols = [
    { label: 'Ngày', render: r => r.opening ? '' : U.date(r.date) },
    { label: 'Số CT', render: r => U.esc(r.code) },
    { label: 'Diễn giải', render: r => r.opening ? '<b>' + U.esc(r.desc) + '</b>' : U.esc(r.desc) },
    { label: d.isCus ? 'Phát sinh nợ' : 'Phải trả tăng', num: true, render: r => r.tang ? U.money(r.tang) : '' },
    { label: d.isCus ? 'Đã thu' : 'Đã trả', num: true, render: r => r.giam ? `<span class="text-green">${U.money(r.giam)}</span>` : '' },
    { label: 'Số dư', num: true, render: r => `<b>${U.money(r.bal)}</b>` },
  ];
  const body = U.el('div', null, [
    U.el('div', { class: 'section-sub' }, [
      U.el('div', null, [U.el('b', null, (d.isCus ? 'Khách hàng: ' : 'Nhà cung cấp: ')), d.partner.name]),
      d.partner.phone ? U.el('div', null, 'Điện thoại: ' + d.partner.phone) : null,
    ].filter(Boolean)),
    C.table(d.display, cols, { footer: [
      { html: 'CỘNG PHÁT SINH', colspan: 3 },
      { html: U.money(d.totalTang), num: true },
      { html: U.money(d.totalGiam), num: true },
      { html: U.money(d.closing), num: true },
    ] }),
    U.el('div', { class: 'mt16', style: 'text-align:right;font-weight:700;font-size:15px',
      html: (d.isCus ? 'Số dư cuối kỳ (còn phải thu): ' : 'Số dư cuối kỳ (còn phải trả): ') +
        `<span class="${d.closing > 0 ? 'text-red' : 'text-green'}">${U.money(d.closing)} đ</span>` }),
  ]);
  C.modal({
    title: '📒 Sổ chi tiết công nợ — ' + d.partner.code, wide: true, body,
    footer: [C.btn('Đóng', C.closeModal), C.btn('🖨 In sổ', () => M.printLedger(kind, id), 'primary')],
  });
};

M.printLedger = function (kind, id) {
  const d = M.debtLedgerData(kind, id);
  const rows = d.display.map(r => `<tr>
    <td style="text-align:center">${r.opening ? '' : U.date(r.date)}</td>
    <td>${U.esc(r.code)}</td><td>${U.esc(r.desc)}</td>
    <td style="text-align:right">${r.tang ? U.money(r.tang) : ''}</td>
    <td style="text-align:right">${r.giam ? U.money(r.giam) : ''}</td>
    <td style="text-align:right"><b>${U.money(r.bal)}</b></td></tr>`).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>So cong no ${d.partner.code}</title>
    <style>body{font-family:'Segoe UI',Arial;padding:30px;color:#222}
    .company{text-align:center;color:#1ea7a0;font-weight:700;font-size:18px}
    h2{text-align:center;margin:6px 0} table{width:100%;border-collapse:collapse;margin-top:14px}
    th,td{border:1px solid #999;padding:6px 9px;font-size:13px} th{background:#f0f0f0}
    .meta{margin-top:8px;font-size:14px;line-height:1.6} .tot{text-align:right;margin-top:12px;font-size:15px}</style></head><body>
    <div class="company">DALI — Tô điểm cuộc sống</div>
    <h2>SỔ CHI TIẾT CÔNG NỢ ${d.isCus ? 'PHẢI THU' : 'PHẢI TRẢ'}</h2>
    <div class="meta"><div><b>${d.isCus ? 'Khách hàng' : 'Nhà cung cấp'}:</b> ${U.esc(d.partner.name)} (${U.esc(d.partner.code)})</div>
      <div><b>Điện thoại:</b> ${U.esc(d.partner.phone || '')} &nbsp; <b>Địa chỉ:</b> ${U.esc(d.partner.address || '')}</div></div>
    <table><thead><tr><th>Ngày</th><th>Số CT</th><th>Diễn giải</th><th>${d.isCus ? 'Phát sinh nợ' : 'Phải trả tăng'}</th><th>${d.isCus ? 'Đã thu' : 'Đã trả'}</th><th>Số dư</th></tr></thead>
    <tbody>${rows}</tbody></table>
    <div class="tot">Cộng phát sinh: ${U.money(d.totalTang)} / ${U.money(d.totalGiam)} đ</div>
    <div class="tot">SỐ DƯ CUỐI KỲ (còn ${d.isCus ? 'phải thu' : 'phải trả'}): <b>${U.money(d.closing)} đ</b></div>
    <script>window.onload=function(){window.print();}</script></body></html>`;
  const w = window.open('', '_blank');
  if (!w) return U.toast('Trình duyệt chặn cửa sổ in. Hãy cho phép pop-up.', 'error');
  w.document.write(html); w.document.close();
};

/* =====================================================================
   TIỀN — Quỹ, Phiếu thu, Phiếu chi
   ===================================================================== */
M.cash = function (root) {
  // Thẻ số dư tài khoản
  const accRow = U.el('div', { class: 'grid c3' });
  PW.data.cashAccounts.forEach(a => {
    accRow.appendChild(U.el('div', { class: 'kpi' }, [
      U.el('div', { style: 'display:flex;justify-content:space-between' }, [
        U.el('div', { class: 'label' }, (a.type === 'cash' ? '💵 ' : '🏦 ') + a.name),
      ]),
      U.el('div', { class: 'value' }, U.money(PW.accountBalance(a.id))),
      U.el('div', { class: 'sub' }, 'Số dư hiện tại (đ)'),
    ]));
  });
  root.appendChild(accRow);

  // Toolbar
  const card = U.el('div', { class: 'card' });
  const toolbar = U.el('div', { class: 'toolbar' });
  toolbar.appendChild(U.el('div', { class: 'card-title', style: 'margin:0' }, '📒 Sổ thu chi tiền'));
  toolbar.appendChild(U.el('div', { class: 'spacer' }));
  toolbar.appendChild(C.btn('+ Phiếu thu', () => M.receiptForm(), 'primary'));
  toolbar.appendChild(C.btn('+ Phiếu chi', () => M.paymentForm(), 'orange'));
  card.appendChild(toolbar);
  const host = U.el('div');
  card.appendChild(host);
  root.appendChild(card);

  function draw() {
    const rows = [];
    PW.data.receipts.forEach(r => rows.push({ kind: 'thu', ...r }));
    PW.data.payments.forEach(p => rows.push({ kind: 'chi', ...p }));
    rows.sort((a, b) => (b.date + b.code).localeCompare(a.date + a.code));
    host.innerHTML = '';
    host.appendChild(C.table(rows, [
      { label: 'Ngày', render: r => U.date(r.date) },
      { label: 'Số phiếu', render: r => U.esc(r.code) },
      { label: 'Loại', center: true, render: r => r.kind === 'thu'
          ? '<span class="tag green">Phiếu thu</span>' : '<span class="tag orange">Phiếu chi</span>' },
      { label: 'Tài khoản', render: r => { const a = PW.account(r.accountId); return a ? U.esc(a.name) : ''; } },
      { label: 'Đối tượng', render: r => {
          if (r.customerId) { const c = PW.customer(r.customerId); return c ? U.esc(c.name) : ''; }
          if (r.supplierId) { const s = PW.supplier(r.supplierId); return s ? U.esc(s.name) : ''; }
          return '';
        } },
      { label: 'Diễn giải', render: r => U.esc(r.reason || '') },
      { label: 'Thu', num: true, render: r => r.kind === 'thu' ? `<span class="text-green">${U.money(r.amount)}</span>` : '' },
      { label: 'Chi', num: true, render: r => r.kind === 'chi' ? `<span class="text-red">${U.money(r.amount)}</span>` : '' },
      { label: '', render: r => C.actions([
          { label: 'Sửa', onClick: () => r.kind === 'thu' ? M.receiptForm(r) : M.paymentForm(r) },
          { label: 'Xóa', cls: 'danger', onClick: () => {
              if (U.confirm('Xóa phiếu ' + r.code + '?')) {
                PW.logActivity('delete', r.kind === 'thu' ? 'receipt' : 'payment', r.code, U.money(r.amount) + ' đ');
                if (r.kind === 'thu') PW.data.receipts = PW.data.receipts.filter(x => x.id !== r.id);
                else PW.data.payments = PW.data.payments.filter(x => x.id !== r.id);
                PW.save(); App.refresh(); U.toast('Đã xóa');
              }
            } },
        ]) },
    ], { empty: 'Chưa có phiếu thu/chi' }));
  }
  draw();
};

M.receiptForm = function (r, presetCustomerId) {
  const isNew = !r;
  r = r || { code: PW.nextCode('PT'), date: U.today(), accountId: PW.data.cashAccounts[0].id, customerId: presetCustomerId || '', amount: 0, reason: 'Thu tiền', note: '' };
  const f = {
    code: C.input({ value: r.code }),
    date: C.input({ type: 'date', value: r.date }),
    account: C.select(PW.data.cashAccounts.map(a => ({ value: a.id, label: a.name })), r.accountId),
    customer: C.select([{ value: '', label: '-- Không gắn khách hàng --' }].concat(PW.data.customers.map(c => ({ value: c.id, label: c.name }))), r.customerId || ''),
    amount: C.input({ type: 'number', value: r.amount, min: 0 }),
    reason: C.input({ value: r.reason || '' }),
  };
  const body = U.el('div', { class: 'form-grid' }, [
    C.field('Số phiếu', f.code),
    C.field('Ngày', f.date, { required: true }),
    C.field('Nộp vào tài khoản', f.account, { required: true }),
    C.field('Khách hàng (thu nợ)', M.partnerAdd(f.customer, true, [{ value: '', label: '-- Không gắn khách hàng --' }])),
    C.field('Số tiền (đ)', f.amount, { required: true }),
    C.field('Lý do thu', f.reason, { full: true }),
  ]);
  C.modal({
    title: isNew ? 'Lập phiếu thu' : 'Sửa phiếu thu', body,
    footer: [C.btn('Hủy', C.closeModal), C.btn('Lưu', () => {
      const amt = Number(f.amount.value) || 0;
      if (amt <= 0) return U.toast('Nhập số tiền', 'error');
      const obj = { id: r.id || PW.uid(), code: f.code.value, date: f.date.value,
        accountId: f.account.value, customerId: f.customer.value || null,
        amount: amt, reason: f.reason.value, note: '' };
      if (isNew) PW.data.receipts.push(obj); else Object.assign(r, obj);
      PW.logActivity(isNew ? 'create' : 'update', 'receipt', obj.code, U.money(obj.amount) + ' đ — ' + (obj.reason || ''));
      PW.save(); C.closeModal(); App.refresh(); U.toast('Đã lưu phiếu thu');
    }, 'primary')],
  });
};

M.paymentForm = function (p, presetSupplierId) {
  const isNew = !p;
  p = p || { code: PW.nextCode('PC'), date: U.today(), accountId: PW.data.cashAccounts[0].id, supplierId: presetSupplierId || '', amount: 0, reason: 'Chi tiền', note: '' };
  const f = {
    code: C.input({ value: p.code }),
    date: C.input({ type: 'date', value: p.date }),
    account: C.select(PW.data.cashAccounts.map(a => ({ value: a.id, label: a.name })), p.accountId),
    supplier: C.select([{ value: '', label: '-- Chi phí (không gắn NCC) --' }].concat(PW.data.suppliers.map(s => ({ value: s.id, label: s.name }))), p.supplierId || ''),
    amount: C.input({ type: 'number', value: p.amount, min: 0 }),
    reason: C.input({ value: p.reason || '', list: 'dl-expitems' }),
  };
  const body = U.el('div', null, [
    U.el('div', { class: 'form-grid' }, [
      C.field('Số phiếu', f.code),
      C.field('Ngày', f.date, { required: true }),
      C.field('Chi từ tài khoản', f.account, { required: true }),
      C.field('Nhà cung cấp (trả nợ)', M.partnerAdd(f.supplier, false, [{ value: '', label: '-- Chi phí (không gắn NCC) --' }])),
      C.field('Số tiền (đ)', f.amount, { required: true }),
      C.field('Khoản mục / Lý do chi', f.reason, { full: true }),
    ]),
    M.datalist('dl-expitems', PW.data.expenseItems.map(e => e.name)),
  ]);
  C.modal({
    title: isNew ? 'Lập phiếu chi' : 'Sửa phiếu chi', body,
    footer: [C.btn('Hủy', C.closeModal), C.btn('Lưu', () => {
      const amt = Number(f.amount.value) || 0;
      if (amt <= 0) return U.toast('Nhập số tiền', 'error');
      // Cảnh báo chi vượt số dư quỹ (chỉ khi lập mới)
      if (isNew) {
        const bal = PW.accountBalance(f.account.value);
        const acc = PW.account(f.account.value);
        if (amt > bal && !U.confirm('Số dư "' + (acc ? acc.name : '') + '" chỉ còn ' + U.vnd(bal) + '.\nChi ' + U.vnd(amt) + ' sẽ làm quỹ ÂM ' + U.vnd(amt - bal) + '.\n\nVẫn lưu phiếu chi?')) return;
      }
      const obj = { id: p.id || PW.uid(), code: f.code.value, date: f.date.value,
        accountId: f.account.value, supplierId: f.supplier.value || null,
        amount: amt, reason: f.reason.value, note: '' };
      if (isNew) PW.data.payments.push(obj); else Object.assign(p, obj);
      PW.logActivity(isNew ? 'create' : 'update', 'payment', obj.code, U.money(obj.amount) + ' đ — ' + (obj.reason || ''));
      PW.save(); C.closeModal(); App.refresh(); U.toast('Đã lưu phiếu chi');
    }, 'orange')],
  });
};
