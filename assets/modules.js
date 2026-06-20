/* ============================================================
   modules.js — Các phân hệ nghiệp vụ
   ============================================================ */
const M = {};

/* =====================================================================
   BỘ LỌC DÙNG CHUNG (filterBar) + áp bộ lọc (applyFilter)
   Dùng cho mọi danh sách: kỳ (preset MISA) + select/trạng thái + tìm +
   đối tượng KH/NCC + khoảng số tiền. Trả { el, getState() }; danh sách tự draw lại.
   ===================================================================== */
M.filterBar = function (cfg) {
  cfg = cfg || {};
  const el = U.el('div', { class: 'toolbar' });
  const readers = [];
  const debounceMs = cfg.debounce != null ? cfg.debounce : 250;
  let saved = {};
  if (cfg.storageKey) { try { saved = JSON.parse(localStorage.getItem('PW_FLT_' + cfg.storageKey) || '{}') || {}; } catch (e) { saved = {}; } }
  let timer = null;
  function getState() { const s = { _raw: {} }; readers.forEach(rd => rd(s)); return s; }
  function emit(now) {
    const run = () => { const s = getState(); if (cfg.storageKey) { try { localStorage.setItem('PW_FLT_' + cfg.storageKey, JSON.stringify(s._raw)); } catch (e) {} } (cfg.onChange || function () {})(s); };
    clearTimeout(timer); if (now) run(); else timer = setTimeout(run, debounceMs);
  }
  function fld(label, ctrl) { return label ? U.el('div', { class: 'field', style: 'margin:0' }, [U.el('label', null, label), ctrl]) : ctrl; }
  function optsFromSource(src) {
    let o;
    if (typeof src === 'function') o = src();
    else if (src === 'cashAccounts') o = PW.data.cashAccounts.map(a => ({ value: a.id, label: a.name }));
    else if (src === 'customers') o = PW.data.customers.map(a => ({ value: a.id, label: a.name }));
    else if (src === 'suppliers') o = PW.data.suppliers.map(a => ({ value: a.id, label: a.name }));
    else if (Array.isArray(src)) o = src;
    else o = [];
    // tự chèn "Tất cả" nếu chưa có option rỗng
    if (!o.some(x => String(x.value) === '')) o = [{ value: '', label: 'Tất cả' }].concat(o);
    return o;
  }
  function buildField(f) {
    if (f.type === 'period') {
      const presets = f.presets || U.PERIOD_PRESETS;
      const sel = C.select(presets.map(k => ({ value: k, label: U.PERIOD_LABEL[k] || k })), saved[f.key] || f.default || 'thisMonth');
      const fromI = C.input({ type: 'date', style: 'width:140px' });
      const toI = C.input({ type: 'date', style: 'width:140px' });
      const dateWrap = U.el('div', { style: 'display:flex;gap:6px' }, [fromI, toI]);
      function applyPreset() { if (sel.value !== 'custom') { const p = U.periodPreset(sel.value); fromI.value = p.from || ''; toI.value = p.to || ''; } }
      if (saved[f.key] === 'custom') { fromI.value = saved[f.key + '_from'] || ''; toI.value = saved[f.key + '_to'] || ''; } else applyPreset();
      function syncVis() { dateWrap.style.display = sel.value === 'custom' ? 'flex' : 'none'; }
      syncVis();
      sel.addEventListener('change', () => { applyPreset(); syncVis(); emit(true); });
      fromI.addEventListener('change', () => emit(true));
      toI.addEventListener('change', () => emit(true));
      el.appendChild(fld(f.label || 'Kỳ', U.el('div', { style: 'display:flex;gap:6px;align-items:center;flex-wrap:wrap' }, [sel, dateWrap])));
      readers.push(s => {
        let from, to;
        if (sel.value === 'custom') { from = fromI.value || null; to = toI.value || null; }
        else { const p = U.periodPreset(sel.value); from = p.from; to = p.to; }
        s.from = from; s.to = to; s.periodKey = sel.value;
        s._raw[f.key] = sel.value; if (sel.value === 'custom') { s._raw[f.key + '_from'] = fromI.value; s._raw[f.key + '_to'] = toI.value; }
      });
    } else if (f.type === 'search') {
      const inp = U.el('input', { class: 'search', placeholder: f.placeholder || 'Tìm...', value: saved[f.key] || '' });
      inp.addEventListener('input', () => emit());
      el.appendChild(inp);
      readers.push(s => { s[f.key] = inp.value.trim().toLowerCase(); s._raw[f.key] = inp.value; });
    } else if (f.type === 'amountRange') {
      const minI = C.input({ type: 'number', placeholder: f.minLabel || 'Từ', style: 'width:100px', value: saved[f.key + '_min'] || '' });
      const maxI = C.input({ type: 'number', placeholder: f.maxLabel || 'Đến', style: 'width:100px', value: saved[f.key + '_max'] || '' });
      minI.addEventListener('input', () => emit()); maxI.addEventListener('input', () => emit());
      el.appendChild(fld(f.label || 'Khoảng số', U.el('div', { style: 'display:flex;gap:6px' }, [minI, maxI])));
      readers.push(s => { s.amountMin = minI.value !== '' ? Number(minI.value) : null; s.amountMax = maxI.value !== '' ? Number(maxI.value) : null; s._raw[f.key + '_min'] = minI.value; s._raw[f.key + '_max'] = maxI.value; });
    } else if (f.type === 'partySearch') {
      const opts = [{ value: '', label: '-- Tất cả đối tượng --' }];
      PW.data.customers.forEach(c => opts.push({ value: 'c:' + c.id, label: 'KH: ' + c.name }));
      PW.data.suppliers.forEach(sp => opts.push({ value: 's:' + sp.id, label: 'NCC: ' + sp.name }));
      const sel = C.select(opts, saved[f.key] || '');
      sel.addEventListener('change', () => emit(true));
      el.appendChild(fld(f.label || 'Đối tượng', sel));
      readers.push(s => { const v = sel.value; s._raw[f.key] = v; if (v) { s.partyKind = v[0] === 'c' ? 'customer' : 'supplier'; s.partyId = v.slice(2); } else { s.partyKind = null; s.partyId = null; } });
    } else { // select | status
      const sel = C.select(f.options || optsFromSource(f.source), saved[f.key] || f.default || '');
      sel.addEventListener('change', () => emit(true));
      el.appendChild(fld(f.label || '', sel));
      readers.push(s => { s[f.key] = sel.value; s._raw[f.key] = sel.value; });
    }
  }
  (cfg.fields || []).forEach(buildField);
  if (cfg.actions && cfg.actions.length) {
    el.appendChild(U.el('div', { class: 'spacer' }));
    cfg.actions.forEach(a => el.appendChild(a && a.nodeType ? a : C.btn(a.label, a.onClick, a.cls)));
  }
  return { el: el, getState: getState };
};

// Áp bộ lọc lên mảng rows theo map field->getter. '' / null = bỏ qua.
M.applyFilter = function (rows, s, map) {
  return rows.filter(r => {
    if (map.date) { const d = map.date(r); if (s.from && d < s.from) return false; if (s.to && d > s.to) return false; }
    if (map.amount) { const v = Number(map.amount(r)) || 0; if (s.amountMin != null && v < s.amountMin) return false; if (s.amountMax != null && v > s.amountMax) return false; }
    if (map.party && s.partyId) { const pp = map.party(r); if (!pp || pp.kind !== s.partyKind || pp.id !== s.partyId) return false; }
    if (map.text && s.q) { if (String(map.text(r) || '').toLowerCase().indexOf(s.q) < 0) return false; }
    for (const k in map) {
      if (k === 'date' || k === 'amount' || k === 'party' || k === 'text') continue;
      const want = s[k];
      if (want === '' || want == null) continue;
      if (String(map[k](r)) !== String(want)) return false;
    }
    return true;
  });
};

/* Trình soạn NHIỀU DÒNG trong form (người liên hệ / tài khoản NH / địa chỉ...).
   fields: [{key,label,placeholder,type:'text'|'select',options,width}]. Trả { el, get() }. */
M._rowsEditor = function (rows, fields, addLabel) {
  rows = (rows || []).map(r => Object.assign({}, r));
  if (!rows.length) rows.push({});
  const tbody = U.el('tbody');
  function draw() {
    tbody.innerHTML = '';
    rows.forEach((r, idx) => {
      const tds = fields.map(fd => {
        let inp;
        if (fd.type === 'select') inp = C.select(fd.options || [], r[fd.key] || '');
        else inp = U.el('input', { class: 'inp', type: fd.type || 'text', value: r[fd.key] || '', placeholder: fd.placeholder || '' });
        if (fd.width) inp.style.width = fd.width;
        const sync = () => { r[fd.key] = inp.value; };
        inp.addEventListener('input', sync); inp.addEventListener('change', sync);
        return U.el('td', { 'data-label': fd.label || '' }, inp);
      });
      tds.push(U.el('td', { class: 'center', style: 'width:36px', 'data-label': '' },
        U.el('button', { class: 'btn sm danger', type: 'button', onclick: () => { rows.splice(idx, 1); if (!rows.length) rows.push({}); draw(); } }, '×')));
      tbody.appendChild(U.el('tr', null, tds));
    });
  }
  draw();
  const tbl = U.el('table', { class: 'items-tbl' }, [
    U.el('thead', null, U.el('tr', null, fields.map(fd => U.el('th', null, fd.label)).concat([U.el('th', null, '')]))),
    tbody,
  ]);
  const wrap = U.el('div', null, [
    U.el('div', { class: 'table-wrap' }, tbl),
    U.el('div', { class: 'mt8' }, C.btn('+ ' + addLabel, () => { rows.push({}); draw(); }, 'sm')),
  ]);
  return { el: wrap, get: () => rows.filter(r => fields.some(fd => String(r[fd.key] || '').trim())) };
};

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
  const tableHost = U.el('div');
  function kindOpts() { return [{ value: '', label: 'Tất cả' }].concat((M.PRODUCT_KINDS || []).map(k => ({ value: k.kind, label: k.label }))); }
  function groupOpts() { const set = new Set(); PW.data.products.forEach(p => p.group && set.add(p.group)); return [{ value: '', label: 'Tất cả' }].concat([...set].sort().map(g => ({ value: g, label: g }))); }
  const fb = M.filterBar({
    storageKey: 'products',
    onChange: draw,
    fields: [
      { type: 'select', key: 'kind', label: 'Tính chất', source: kindOpts },
      { type: 'select', key: 'group', label: 'Nhóm hàng', source: groupOpts },
      { type: 'select', key: 'stockStatus', label: 'Tồn kho', options: [{ value: '', label: 'Tất cả' }, { value: 'in', label: 'Còn tồn' }, { value: 'low', label: 'Dưới tối thiểu' }, { value: 'out', label: 'Hết hàng' }] },
      { type: 'amountRange', key: 'amount', label: 'Giá bán' },
      { type: 'search', key: 'q', placeholder: 'Tìm theo tên / mã hàng...' },
    ],
    actions: [C.btn('+ Thêm hàng hóa', () => M.productForm(), 'primary')],
  });
  card.appendChild(fb.el);
  card.appendChild(tableHost);
  root.appendChild(card);

  function draw() {
    const st = fb.getState();
    const rows = M.applyFilter(PW.data.products, st, {
      kind: p => PW.productKind(p),
      group: p => p.group || '',
      amount: p => Number(p.price || 0),
      stockStatus: p => { const q = PW.stockOf(p.id); if (q <= 0) return 'out'; if (p.minStock && q < Number(p.minStock)) return 'low'; return 'in'; },
      text: p => [p.code, p.name, p.group].join(' '),
    });
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
    ], { empty: 'Không có hàng hóa phù hợp bộ lọc' }));
  }
  draw();
};

M.productForm = function (p, opts) {
  const isNew = !p;
  const quick = !!(opts && opts.onSaved);   // thêm nhanh: mở chồng (lớp 2) + chọn lại
  p = p || { code: PW.nextCode('HH'), name: '', group: '', unit: 'Cái', cost: 0, price: 0, openingStock: 0 };
  if (isNew && opts && opts.prefill) p = Object.assign(p, opts.prefill);   // điền sẵn khi thêm nhanh từ nơi khác
  const groupDLId = 'dl-pgroups-' + PW.uid();   // id riêng từng form -> tránh trùng id khi mở chồng (combo -> thêm nhanh)
  const f = {
    kind: C.select((M.PRODUCT_KINDS || [{ kind: 'hanghoa', label: 'Hàng hóa' }]).map(k => ({ value: k.kind, label: k.label })), p.kind || 'hanghoa'),
    code: C.input({ value: p.code }),
    name: C.input({ value: p.name }),
    group: C.input({ value: p.group || '', list: groupDLId }),
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
      const sel = M.materialSelect(p.id || '', b.materialId);   // loại thành phẩm/combo/dịch vụ + gom nhóm theo kích thước
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

  // Datalist "Nhóm hàng" lọc theo Tính chất (NVL gợi ý nhóm NVL theo kích thước, không lẫn nhóm thành phẩm)
  const groupDL = U.el('datalist', { id: groupDLId });
  function fillGroupDL() {
    const k = f.kind.value;
    const names = PW.data.productGroups.filter(g => !g.kind || g.kind === k).map(g => g.name);
    const sz = M.detectSize((f.code.value || '') + ' ' + f.name.value);
    if (sz) names.unshift((k === 'nvl' ? 'Nguyên vật liệu ' : '') + sz);   // gợi ý nhóm theo kích thước trong tên
    groupDL.innerHTML = '';
    [...new Set(names)].forEach(v => groupDL.appendChild(U.el('option', { value: v })));
  }
  f.name.addEventListener('input', fillGroupDL);
  f.code.addEventListener('input', fillGroupDL);

  // ----- Chọn nhanh KÍCH THƯỚC cho Nhóm hàng + tự nạp NVL cùng kích thước cho thành phẩm -----
  const sizeChips = U.el('div', { style: 'display:flex;flex-wrap:wrap;gap:6px;margin-top:6px' });
  const groupWrap = U.el('div', null, [f.group, sizeChips]);
  function loadBomForSize(sz) {
    const nvls = M.nvlForSize(sz).filter(x => x.id !== (p.id || ''));
    if (!nvls.length) { U.toast('Chưa có NVL nào thuộc kích thước ' + sz + ' — thêm NVL nhóm "Nguyên vật liệu ' + sz + '" trước', 'error'); return; }
    const existing = bom.filter(b => b.materialId);
    if (existing.length && !U.confirm('Thay định mức NVL hiện tại bằng ' + nvls.length + ' NVL kích thước ' + sz + '?')) return;
    bom = nvls.map(x => ({ materialId: x.id, qty: 1 }));
    bomSection.style.display = '';
    drawBom(); refreshBomCost();
    U.toast('Đã nạp ' + nvls.length + ' NVL theo kích thước ' + sz);
  }
  function pickSize(sz) {
    const k = f.kind.value;
    f.group.value = (k === 'nvl' ? 'Nguyên vật liệu ' : '') + sz;
    fillGroupDL();
    if (k === 'thanhpham') loadBomForSize(sz);   // thành phẩm: chọn size -> NVL cùng size nhảy ra ngay
  }
  function fillSizeChips() {
    sizeChips.innerHTML = '';
    const sizes = M.nvlSizes();
    if (!sizes.length) return;
    sizeChips.appendChild(U.el('span', { class: 'text-muted', style: 'font-size:11px;align-self:center;margin-right:2px' },
      f.kind.value === 'thanhpham' ? 'Chọn kích thước (tự nạp NVL):' : 'Kích thước:'));
    sizes.forEach(sz => { const c = C.btn(sz, () => pickSize(sz), 'sm'); c.type = 'button'; sizeChips.appendChild(c); });
  }

  // Hiện/ẩn section theo tính chất
  function applyKind() {
    const k = f.kind.value;
    bomSection.style.display = (k === 'thanhpham' || (bom.length && k !== 'combo')) ? '' : 'none';
    comboSection.style.display = (k === 'combo') ? '' : 'none';
    // NVL: ẩn giá vốn + giá bán (giá đổi theo NCC/thời điểm -> báo cáo lấy giá mua bình quân)
    const hide = (k === 'nvl');
    f.cost.parentElement.style.display = hide ? 'none' : '';
    f.price.parentElement.style.display = hide ? 'none' : '';
    fillGroupDL();
    fillSizeChips();
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
      C.field('Nhóm hàng', groupWrap),
      C.field('Đơn vị tính', f.unit),
      C.field('Tồn kho đầu kỳ', f.stock),
      C.field('Tồn tối thiểu (cảnh báo)', f.minStock),
      C.field('Giá vốn (đ)', f.cost),
      C.field('Giá bán (đ)', f.price),
    ]),
    groupDL,
    M.datalist('dl-punits', PW.data.units.map(u => u.name)),
    chSection,
    bomSection,
    comboSection,
  ]);
  applyKind();
  function saveProduct() {
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
    PW.save();
    if (quick) { C.closeMini(); opts.onSaved(obj); }
    else { C.closeModal(); App.refresh(); }
    U.toast('Đã lưu hàng hóa');
  }
  const title = isNew ? 'Thêm hàng hóa' : 'Sửa hàng hóa';
  if (quick) {
    C.miniModal({ title: title, wide: true, body,
      footer: [C.btn('Hủy', C.closeMini), C.btn('Cất & chọn', saveProduct, 'primary')] });
  } else {
    C.modal({ title: title, wide: true, body,
      footer: [C.btn('Hủy', C.closeModal), C.btn('Lưu', saveProduct, 'primary')] });
  }
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
  const debtSel = C.select([{ value: '', label: 'Tất cả công nợ' }, { value: 'owing', label: 'Còn nợ' }, { value: 'clear', label: 'Hết nợ' }, { value: 'over', label: 'Vượt hạn mức' }], '');
  const bulkBtn = C.btn('🗑 Xóa đã chọn', () => bulkDelete(), 'danger sm');
  bulkBtn.style.display = 'none';
  toolbar.appendChild(search);
  toolbar.appendChild(U.el('div', { class: 'field', style: 'margin:0' }, [U.el('label', null, 'Công nợ'), debtSel]));
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
    const ds = debtSel.value;
    return list.filter(x => {
      if (q && !((x.name || '').toLowerCase().includes(q) || (x.code || '').toLowerCase().includes(q) || (x.phone || '').includes(q))) return false;
      if (ds) {
        const d = debtFn(x.id);
        if (ds === 'owing' && d <= 0) return false;
        if (ds === 'clear' && d > 0) return false;
        if (ds === 'over' && !(Number(x.creditLimit) > 0 && d > Number(x.creditLimit))) return false;
      }
      return true;
    });
  }
  function fmtDebt(d) {
    if (d < 0) return `<span class="text-red">(${U.money(-d)})</span>`;
    if (d > 0) return `<span class="${isCus ? 'text-blue' : 'text-red'}">${U.money(d)}</span>`;
    return '<span class="text-muted">0</span>';
  }
  function debtCell(x) {
    const d = debtFn(x.id);
    let h = fmtDebt(d);
    if (Number(x.creditLimit) > 0 && d > Number(x.creditLimit)) h += ' <span class="tag red" style="font-size:10px">⚠ vượt HM ' + U.money(x.creditLimit) + '</span>';
    return h;
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

    const t = U.el('table', { class: 'tbl tbl-cards' });
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
    // Nhân viên (chế độ server) KHÔNG được thao tác tiền (thu/chi) -> ẩn nút, tránh 403 khó hiểu
    const restricted = PW.mode === 'server' && PW.user && PW.user.role === 'nhanvien';
    pageRows.forEach(x => {
      const chk = U.el('input', { type: 'checkbox' });
      chk.checked = selected.has(x.id);
      chk.addEventListener('change', () => { chk.checked ? selected.add(x.id) : selected.delete(x.id); updateBulk(); });
      const acts = isCus
        ? [{ label: 'Lập hóa đơn', cls: 'primary', onClick: () => M.salesForm(null, x.id) }]
        : [{ label: 'Lập phiếu nhập', cls: 'primary', onClick: () => M.purchaseForm(null, x.id) }];
      if (!restricted) acts.push(isCus
        ? { label: 'Thu tiền', onClick: () => M.receiptForm(null, x.id) }
        : { label: 'Trả tiền', onClick: () => M.paymentForm(null, x.id) });
      acts.push({ label: 'Sổ', onClick: () => M.debtLedger(kind, x.id) });
      acts.push({ label: 'Sửa', onClick: () => M.partnerForm(kind, x) });
      acts.push({ label: 'Xóa', cls: 'danger', onClick: () => { if (U.confirm('Xóa "' + x.name + '"?')) removeOne(x.id); } });
      tb.appendChild(U.el('tr', null, [
        U.el('td', { 'data-label': '' }, chk),
        U.el('td', { 'data-label': 'Mã' }, U.esc(x.code)),
        U.el('td', { 'data-label': 'Tên' }, U.esc(x.name)),
        U.el('td', { 'data-label': 'Địa chỉ' }, U.esc(x.address || '')),
        U.el('td', { 'data-label': 'MST/CCCD' }, U.esc(x.taxCode || '')),
        U.el('td', { 'data-label': 'Điện thoại' }, U.esc(x.phone || '')),
        U.el('td', { class: 'num', 'data-label': isCus ? 'Công nợ phải thu' : 'Công nợ phải trả', html: debtCell(x) }),
        U.el('td', { class: 'center', 'data-label': '' }, C.actions(acts)),
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
  debtSel.addEventListener('change', () => { page = 1; draw(); });
  draw();
};

M.partnerForm = function (kind, x, opts) {
  const isCus = kind === 'customer';
  const isNew = !x;
  const quick = !!(opts && opts.onSaved);   // chế độ "thêm nhanh": mở chồng (lớp 2) + chọn lại vào ô gọi
  x = x || { code: PW.nextCode(isCus ? 'KH' : 'NCC'), type: 'org', name: '' };

  const LABEL = isCus ? 'khách hàng' : 'nhà cung cấp';
  const empLabel = isCus ? 'Nhân viên phụ trách' : 'Nhân viên mua hàng';

  // ----- Hàng đầu: Tổ chức/Cá nhân + cờ chéo + đối tượng nội bộ -----
  const tOrg = U.el('input', { type: 'radio', name: 'pw-ptype', value: 'org' });
  const tInd = U.el('input', { type: 'radio', name: 'pw-ptype', value: 'individual' });
  (x.type === 'individual' ? tInd : tOrg).checked = true;
  const alsoChk = U.el('input', { type: 'checkbox' }); if (x.alsoOther) alsoChk.checked = true;
  const internalChk = U.el('input', { type: 'checkbox' }); if (x.isInternal) internalChk.checked = true;
  const pfRestricted = PW.mode === 'server' && PW.user && PW.user.role === 'nhanvien';
  const typeRow = U.el('div', { class: 'full', style: 'display:flex;gap:24px;align-items:center;flex-wrap:wrap' }, [
    U.el('label', { class: 'radio' }, [tOrg, ' Tổ chức']),
    U.el('label', { class: 'radio' }, [tInd, ' Cá nhân']),
    U.el('div', { style: 'flex:1' }),
    pfRestricted ? null : U.el('label', { class: 'radio' }, [alsoChk, ' Là ' + (isCus ? 'nhà cung cấp' : 'khách hàng')]),
    U.el('label', { class: 'radio' }, [internalChk, ' Là đối tượng nội bộ']),
  ]);

  const SALUT = ['', 'Ông', 'Bà', 'Anh', 'Chị', 'Cô', 'Chú'].map(s => ({ value: s, label: s || 'Xưng hô' }));
  const f = {
    code: C.input({ value: x.code || '' }),
    name: C.input({ value: x.name || '' }),
    tax: C.input({ value: x.taxCode || '' }),
    dvqhns: C.input({ value: x.dvqhns || '' }),
    cccd: C.input({ value: x.cccd || '' }),
    cccdDate: C.input({ type: 'date', value: x.cccdDate || '' }),
    cccdPlace: C.input({ value: x.cccdPlace || '' }),
    passport: C.input({ value: x.passport || '' }),
    phone: C.input({ value: x.phone || '' }),
    email: C.input({ value: x.email || '', type: 'email' }),
    website: C.input({ value: x.website || '' }),
    debt: C.input({ type: 'number', value: x.openingDebt || 0 }),
    contactSalut: C.select(SALUT, x.contactSalut || ''),
    contactName: C.input({ value: x.contactName || '' }),
    contactEmail: C.input({ value: x.contactEmail || '' }),
    contactPhone: C.input({ value: x.contactPhone || '' }),
    rep: C.input({ value: x.rep || '' }),
    bankName: C.input({ value: x.bankName || '' }),
    bankAccount: C.input({ value: x.bankAccount || '' }),
    bankHolder: C.input({ value: x.bankHolder || '' }),
  };
  const salutSel = C.select(SALUT, x.salutation || ''); salutSel.style.maxWidth = '110px';
  f.name.style.flex = '1';
  const nameWrap = U.el('div', { style: 'display:flex;gap:6px' }, [salutSel, f.name]);
  const addrTa = C.textarea({ rows: 2, placeholder: 'VD: Số 82 Duy Tân, Cầu Giấy, Hà Nội' }); addrTa.value = x.address || '';
  const addr2Ta = C.textarea({ rows: 2, placeholder: 'Địa chỉ giao hàng / nhận hàng khác (nếu khác địa chỉ chính)' }); addr2Ta.value = x.address2 || '';
  const noteTa = C.textarea({ rows: 3 }); noteTa.value = x.note || '';

  // Nhóm KH/NCC (select + thêm nhanh)
  const groupOpts = () => [{ value: '', label: '-- Chọn nhóm --' }].concat(PW.data.partnerGroups.map(g => ({ value: g.id, label: g.name })));
  const groupSel = C.select(groupOpts(), x.groupId || '');
  const addGroupBtn = U.el('button', { class: 'btn sm primary', type: 'button', title: 'Thêm nhóm mới', onclick: () => {
    const name = prompt('Tên nhóm ' + LABEL + ' mới:');
    if (name && name.trim()) {
      const g = { id: PW.uid(), name: name.trim() };
      PW.data.partnerGroups.push(g); PW.save();
      M.rebuildSelect(groupSel, groupOpts(), g.id); U.toast('Đã thêm nhóm');
    }
  } }, '+');
  const groupRow = U.el('div', { style: 'display:flex;gap:6px' }, [groupSel, addGroupBtn]);

  // Nhân viên phụ trách / mua hàng (+ thêm nhanh)
  const empOpts = () => [{ value: '', label: '-- Không --' }].concat(PW.data.employees.map(e => ({ value: e.id, label: e.name })));
  const empSel = C.select(empOpts(), x.employeeId || '');
  const empRow = quick ? empSel : U.el('div', { style: 'display:flex;gap:6px' }, [empSel,
    U.el('button', { class: 'btn sm primary', type: 'button', title: 'Thêm nhân viên', onclick: () => M.quickAddEmployee(ne => M.rebuildSelect(empSel, empOpts(), ne.id)) }, '+')]);

  const termSel = C.select([{ value: '', label: '-- Mặc định --' }].concat(PW.data.paymentTerms.map(t => ({ value: t.id, label: t.name }))), x.paymentTermId || '');
  const commI = isCus ? C.input({ type: 'number', value: x.commissionPercent || 0, min: 0, max: 100 }) : null;

  // ----- Các ô đổi theo Tổ chức/Cá nhân -----
  const fTax = C.field('Mã số thuế', f.tax);
  const fDvqhns = C.field('Mã ĐVQHNS', f.dvqhns);
  const fCccd = C.field('Số CCCD', f.cccd);
  const fCccdDate = C.field('Ngày cấp', f.cccdDate);
  const fCccdPlace = C.field('Nơi cấp', f.cccdPlace);
  const fWebsite = C.field('Website', f.website);
  const fName = C.field('Tên ' + LABEL, nameWrap, { required: true, full: true });

  const header = U.el('div', { class: 'form-grid' }, [
    typeRow,
    fCccd, fCccdDate, fCccdPlace,
    fTax, fDvqhns,
    C.field('Mã ' + (isCus ? 'KH' : 'NCC'), f.code, { required: true }),
    fWebsite,
    fName,
    C.field('Nhóm ' + (isCus ? 'KH' : 'NCC'), groupRow),
    C.field('Địa chỉ', addrTa, { full: true }),
    C.field('Điện thoại', f.phone),
    C.field('Email', f.email),
    C.field(empLabel, empRow),
    C.field('Nợ đầu kỳ ' + (isCus ? 'phải thu' : 'phải trả') + ' (đ)', f.debt),
    isCus ? C.field('Hoa hồng CTV (%) — 0 nếu không phải CTV', commI) : null,
  ]);

  // Chuyển giao diện Tổ chức <-> Cá nhân
  function applyType() {
    const ind = tInd.checked;
    [fCccd, fCccdDate, fCccdPlace].forEach(el => el.style.display = ind ? '' : 'none');
    [fDvqhns, fWebsite].forEach(el => el.style.display = ind ? 'none' : '');
    salutSel.style.display = ind ? '' : 'none';
  }
  tOrg.addEventListener('change', applyType);
  tInd.addEventListener('change', applyType);

  // ----- Chiều sâu từng tab: nhiều người liên hệ / TK ngân hàng / địa chỉ + hạn mức công nợ -----
  const initContacts = (x.contacts && x.contacts.length) ? x.contacts
    : (x.contactName ? [{ salutation: x.contactSalut || '', name: x.contactName, role: '', email: x.contactEmail || '', phone: x.contactPhone || '' }] : []);
  const contactsEd = M._rowsEditor(initContacts, [
    { key: 'salutation', label: 'Xưng hô', type: 'select', options: SALUT, width: '90px' },
    { key: 'name', label: 'Họ và tên', placeholder: 'Nguyễn Văn A' },
    { key: 'role', label: 'Chức danh', placeholder: 'Kế toán / GĐ' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Điện thoại', width: '120px' },
  ], 'Thêm người liên hệ');

  const initBanks = (x.banks && x.banks.length) ? x.banks
    : (x.bankName || x.bankAccount ? [{ bankName: x.bankName || '', account: x.bankAccount || '', holder: x.bankHolder || '', branch: '' }] : []);
  const banksEd = M._rowsEditor(initBanks, [
    { key: 'bankName', label: 'Ngân hàng', placeholder: 'Vietcombank' },
    { key: 'account', label: 'Số tài khoản', width: '150px' },
    { key: 'holder', label: 'Chủ tài khoản' },
    { key: 'branch', label: 'Chi nhánh' },
  ], 'Thêm tài khoản');

  const initAddrs = (x.addresses && x.addresses.length) ? x.addresses
    : (x.address2 ? [{ label: '', address: x.address2 }] : []);
  const addrsEd = M._rowsEditor(initAddrs, [
    { key: 'label', label: 'Nhãn', placeholder: 'Kho HN / CN2', width: '150px' },
    { key: 'address', label: 'Địa chỉ giao/nhận' },
  ], 'Thêm địa chỉ');

  const creditDaysI = C.input({ type: 'number', value: x.creditDays || 0, min: 0 });
  const creditLimitI = C.input({ type: 'number', value: x.creditLimit || 0, min: 0 });
  const industryI = C.input({ value: x.industry || '' });
  const payPrefSel = C.select([{ value: '', label: '-- Không --' }, { value: 'cash', label: 'Tiền mặt' }, { value: 'transfer', label: 'Chuyển khoản' }], x.payPref || '');

  const tabs = C.tabs([
    { label: 'Người liên hệ', content: U.el('div', null, [
      contactsEd.el,
      U.el('div', { class: 'form-grid mt16' }, [C.field('Đại diện theo pháp luật', f.rep, { full: true })]),
    ]) },
    { label: 'Điều khoản & công nợ', content: U.el('div', { class: 'form-grid' }, [
      C.field('Điều khoản TT mặc định', termSel),
      C.field('Số ngày được nợ', creditDaysI),
      C.field('Hạn mức công nợ (đ) — 0 = không giới hạn', creditLimitI, { full: true }),
      U.el('div', { class: 'section-sub full' }, 'Hạn thanh toán tự tính theo điều khoản. Khi lập ' + (isCus ? 'hóa đơn bán' : 'phiếu nhập') + ' làm công nợ VƯỢT hạn mức sẽ có cảnh báo.'),
    ]) },
    { label: 'Tài khoản ngân hàng', content: banksEd.el },
    { label: 'Địa chỉ giao/nhận', content: addrsEd.el },
    { label: 'Thông tin bổ sung', content: U.el('div', { class: 'form-grid' }, [
      C.field('Ngành nghề / lĩnh vực', industryI),
      C.field('Hình thức TT ưa thích', payPrefSel),
      C.field('Số hộ chiếu', f.passport),
    ]) },
    { label: 'Ghi chú', content: C.field('Ghi chú', noteTa, { full: true }) },
  ]);

  const body = U.el('div', null, [header, tabs]);
  applyType();

  function buildObj() {
    const contacts = contactsEd.get(), banks = banksEd.get(), addresses = addrsEd.get();
    const c0 = contacts[0] || {}, b0 = banks[0] || {};
    return {
      id: x.id || PW.uid(), code: f.code.value.trim(), name: f.name.value.trim(),
      type: tInd.checked ? 'individual' : 'org', alsoOther: alsoChk.checked, isInternal: internalChk.checked,
      salutation: tInd.checked ? salutSel.value : '',
      taxCode: f.tax.value.trim(), dvqhns: f.dvqhns.value.trim(),
      cccd: f.cccd.value.trim(), cccdDate: f.cccdDate.value || '', cccdPlace: f.cccdPlace.value.trim(), passport: f.passport.value.trim(),
      phone: f.phone.value.trim(), email: f.email.value.trim(), website: f.website.value.trim(),
      address: addrTa.value.trim(),
      groupId: groupSel.value || null, employeeId: empSel.value || null, paymentTermId: termSel.value || null,
      creditDays: Number(creditDaysI.value) || 0, creditLimit: Number(creditLimitI.value) || 0,
      industry: industryI.value.trim(), payPref: payPrefSel.value,
      // nhiều dòng + giữ ô đơn (tương thích nơi cũ đọc bankName/contactName/address2)
      contacts: contacts, contactSalut: c0.salutation || '', contactName: c0.name || '', contactEmail: c0.email || '', contactPhone: c0.phone || '',
      rep: f.rep.value.trim(),
      banks: banks, bankName: b0.bankName || '', bankAccount: b0.account || '', bankHolder: b0.holder || '',
      addresses: addresses, address2: (addresses[0] && addresses[0].address) || '',
      note: noteTa.value.trim(), openingDebt: Number(f.debt.value) || 0,
      commissionPercent: commI ? (Number(commI.value) || 0) : (x.commissionPercent || 0),
      isCollaborator: commI ? (Number(commI.value) > 0) : (x.isCollaborator || false),
    };
  }
  function save(mode) {  // mode: 'normal' | 'addAnother' | 'quick'
    if (!f.name.value.trim()) return U.toast('Nhập tên', 'error');
    // Cảnh báo trùng (theo SĐT hoặc tên) khi tạo mới — tránh tách công nợ
    if (isNew) {
      const list = isCus ? PW.data.customers : PW.data.suppliers;
      const ph = f.phone.value.trim();
      const norm = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
      const dup = list.find(c => (ph && c.phone && c.phone === ph) || norm(c.name) === norm(f.name.value));
      if (dup && !U.confirm('Đã có "' + dup.name + '"' + (dup.phone ? ' · ' + dup.phone : '') + ' tương tự.\nVẫn tạo MỚI? (nên dùng lại để không tách công nợ)')) return;
    }
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
    if (mode === 'quick') { C.closeMini(); opts.onSaved(obj); }
    else if (mode === 'addAnother' && isNew) { C.closeModal(); M.partnerForm(kind); }
    else { C.closeModal(); App.refresh(); }
  }

  const title = (isNew ? 'Thêm ' : 'Sửa ') + (isCus ? 'khách hàng' : 'nhà cung cấp');
  if (quick) {
    C.miniModal({ title: title, wide: true, body,
      footer: [C.btn('Hủy', C.closeMini), C.btn('Cất & chọn', () => save('quick'), 'primary')] });
  } else {
    const footer = [C.btn('Hủy', C.closeModal)];
    if (isNew) footer.push(C.btn('Cất và Thêm', () => save('addAnother')));
    footer.push(C.btn('Cất', () => save('normal'), 'primary'));
    C.modal({ title: title, wide: true, body, footer });
  }
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
  const yearStart = U.today().slice(0, 4) + '-01-01';
  // ----- KPI: tổng thu / chi từ đầu năm + tồn quỹ hiện tại -----
  root.appendChild(U.el('div', { class: 'grid c3' }, [
    M._cashKpi('💰 Tổng thu (từ đầu năm)', PW.cashIn(yearStart, U.today()), 'text-green'),
    M._cashKpi('💸 Tổng chi (từ đầu năm)', PW.cashOut(yearStart, U.today()), 'text-red'),
    M._cashKpi('🏦 Tồn quỹ hiện tại', PW.totalCash(), 'text-blue'),
  ]));
  // ----- Số dư từng tài khoản tiền -----
  root.appendChild(U.el('div', { class: 'grid c3', style: 'margin-top:4px' },
    PW.data.cashAccounts.map(a => M._cashKpi((a.type === 'cash' ? '💵 ' : '🏦 ') + a.name, PW.accountBalance(a.id), '', 'Số dư hiện tại'))));
  // ----- Tabs -----
  root.appendChild(C.tabs([
    { label: '📒 Sổ thu chi', content: M._cashLedgerTab() },
    { label: '🧮 Kiểm kê quỹ', content: M._cashCountTab() },
    { label: '📈 Dự báo dòng tiền', content: M._cashForecastTab() },
  ]));
};

M._cashKpi = function (label, val, cls, sub) {
  return U.el('div', { class: 'kpi' }, [
    U.el('div', { class: 'label' }, label),
    U.el('div', { class: 'value ' + (cls || '') }, U.money(val)),
    U.el('div', { class: 'sub' }, sub || 'đồng'),
  ]);
};
M._cashFld = function (label, el) { return U.el('div', { class: 'field', style: 'margin:0' }, [U.el('label', null, label), el]); };

/* ---------- Tab 1: Sổ thu chi (lọc kỳ + loại + tìm) ---------- */
M._cashLedgerTab = function () {
  const wrap = U.el('div');
  const card = U.el('div', { class: 'card' });
  const host = U.el('div');
  function distinctReasons() {
    const set = new Set();
    PW.data.receipts.forEach(x => x.reason && set.add(x.reason));
    PW.data.payments.forEach(x => x.reason && set.add(x.reason));
    return [{ value: '', label: 'Tất cả' }].concat([...set].sort().map(r => ({ value: r, label: r })));
  }
  const fb = M.filterBar({
    storageKey: 'cashLedger',
    onChange: draw,
    fields: [
      { type: 'period', key: 'period', label: 'Kỳ', default: 'thisYear', presets: ['today', 'thisWeek', 'thisMonth', 'lastMonth', 'thisQuarter', 'ytd', 'thisYear', 'lastYear', 'all', 'custom'] },
      { type: 'select', key: 'kind', label: 'Loại', options: [{ value: '', label: 'Tất cả' }, { value: 'thu', label: 'Phiếu thu' }, { value: 'chi', label: 'Phiếu chi' }] },
      { type: 'select', key: 'accountId', label: 'Tài khoản', source: 'cashAccounts' },
      { type: 'select', key: 'reason', label: 'Lý do thu/chi', source: distinctReasons },
      { type: 'partySearch', key: 'partyId', label: 'Đối tượng' },
      { type: 'amountRange', key: 'amount', label: 'Số tiền' },
      { type: 'search', key: 'q', placeholder: 'Tìm số phiếu / đối tượng / diễn giải...' },
    ],
    actions: [
      C.btn('+ Phiếu thu', () => M.receiptForm(), 'primary'),
      C.btn('+ Phiếu chi', () => M.paymentForm(), 'orange'),
    ],
  });
  card.appendChild(fb.el);
  card.appendChild(host);
  wrap.appendChild(card);

  function partyName(x) { if (x.customerId) { const c = PW.customer(x.customerId); return c ? c.name : ''; } if (x.supplierId) { const s = PW.supplier(x.supplierId); return s ? s.name : ''; } return ''; }
  function draw() {
    const st = fb.getState();
    let rows = [];
    PW.data.receipts.forEach(x => rows.push(Object.assign({ kind: 'thu' }, x)));
    PW.data.payments.forEach(x => rows.push(Object.assign({ kind: 'chi' }, x)));
    rows = M.applyFilter(rows, st, {
      date: x => x.date,
      kind: x => x.kind,
      accountId: x => x.accountId,
      reason: x => x.reason || '',
      amount: x => Number(x.amount || 0),
      party: x => x.customerId ? { kind: 'customer', id: x.customerId } : (x.supplierId ? { kind: 'supplier', id: x.supplierId } : null),
      text: x => [x.code, x.reason, partyName(x)].join(' '),
    });
    rows.sort((a, b) => (b.date + b.code).localeCompare(a.date + a.code));
    const totThu = rows.filter(x => x.kind === 'thu').reduce((s, x) => s + Number(x.amount || 0), 0);
    const totChi = rows.filter(x => x.kind === 'chi').reduce((s, x) => s + Number(x.amount || 0), 0);
    host.innerHTML = '';
    host.appendChild(C.table(rows, [
      { label: 'Ngày', render: x => U.date(x.date) },
      { label: 'Số phiếu', render: x => U.esc(x.code) },
      { label: 'Loại', center: true, render: x => x.kind === 'thu' ? '<span class="tag green">Phiếu thu</span>' : '<span class="tag orange">Phiếu chi</span>' },
      { label: 'Tài khoản', render: x => { const a = PW.account(x.accountId); return a ? U.esc(a.name) : ''; } },
      { label: 'Đối tượng', render: x => { if (x.customerId) { const c = PW.customer(x.customerId); return c ? U.esc(c.name) : ''; } if (x.supplierId) { const s = PW.supplier(x.supplierId); return s ? U.esc(s.name) : ''; } return ''; } },
      { label: 'Diễn giải', render: x => U.esc(x.reason || '') },
      { label: 'Thu', num: true, render: x => x.kind === 'thu' ? `<span class="text-green">${U.money(x.amount)}</span>` : '' },
      { label: 'Chi', num: true, render: x => x.kind === 'chi' ? `<span class="text-red">${U.money(x.amount)}</span>` : '' },
      { label: '', render: x => C.actions([
          { label: 'Sửa', onClick: () => x.kind === 'thu' ? M.receiptForm(x) : M.paymentForm(x) },
          { label: 'Xóa', cls: 'danger', onClick: () => {
              if (U.confirm('Xóa phiếu ' + x.code + '?')) {
                PW.logActivity('delete', x.kind === 'thu' ? 'receipt' : 'payment', x.code, U.money(x.amount) + ' đ');
                if (x.kind === 'thu') PW.data.receipts = PW.data.receipts.filter(y => y.id !== x.id);
                else PW.data.payments = PW.data.payments.filter(y => y.id !== x.id);
                PW.save(); App.refresh(); U.toast('Đã xóa');
              }
            } },
        ]) },
    ], { empty: 'Không có phiếu thu/chi trong kỳ', footer: [
      { html: 'TỔNG CỘNG', colspan: 6 }, { html: U.money(totThu), num: true }, { html: U.money(totChi), num: true }, { html: '' },
    ] }));
    host.appendChild(U.el('div', { class: 'mt8', style: 'text-align:right;font-weight:700' },
      'Chênh lệch thu - chi: ' + U.money(totThu - totChi) + ' đ'));
  }
  draw();
  return wrap;
};

/* ---------- Tab 2: Kiểm kê quỹ ---------- */
M._cashCountTab = function () {
  const wrap = U.el('div');
  const card = U.el('div', { class: 'card' });
  const bar = U.el('div', { class: 'toolbar' });
  bar.appendChild(U.el('div', { class: 'card-title', style: 'margin:0' }, '🧮 Kiểm kê quỹ tiền mặt'));
  bar.appendChild(U.el('div', { class: 'spacer' }));
  bar.appendChild(C.btn('+ Lập biên bản kiểm kê', () => M.cashCountForm(), 'primary'));
  card.appendChild(bar);
  card.appendChild(U.el('p', { class: 'section-sub' }, 'So sánh tồn quỹ trên sổ với tiền thực đếm tại một thời điểm; chênh lệch sẽ tự tạo phiếu thu/chi điều chỉnh để khớp sổ.'));
  const host = U.el('div');
  card.appendChild(host);
  wrap.appendChild(card);
  const rows = (PW.data.cashCounts || []).slice().sort((a, b) => (b.date + (b.id || '')).localeCompare(a.date + (a.id || '')));
  host.appendChild(C.table(rows, [
    { label: 'Ngày', render: c => U.date(c.date) },
    { label: 'Tài khoản', render: c => { const a = PW.account(c.accountId); return a ? U.esc(a.name) : ''; } },
    { label: 'Tồn sổ', num: true, render: c => U.money(c.bookBalance) },
    { label: 'Thực đếm', num: true, render: c => U.money(c.actualBalance) },
    { label: 'Chênh lệch', num: true, render: c => c.diff === 0 ? '<span class="text-muted">0</span>' : (c.diff > 0 ? '<span class="text-green">+' + U.money(c.diff) + '</span>' : '<span class="text-red">' + U.money(c.diff) + '</span>') },
    { label: 'Xử lý', center: true, render: c => c.adjustmentId ? '<span class="tag orange">Đã điều chỉnh</span>' : '<span class="tag green">Khớp sổ</span>' },
    { label: '', render: c => C.actions([{ label: 'Xóa', cls: 'danger', onClick: () => {
        if (U.confirm('Xóa biên bản kiểm kê ngày ' + U.date(c.date) + '? (phiếu điều chỉnh đã tạo vẫn giữ nguyên)')) {
          PW.data.cashCounts = PW.data.cashCounts.filter(x => x.id !== c.id); PW.save(); App.refresh(); U.toast('Đã xóa biên bản');
        } } }]) },
  ], { empty: 'Chưa có biên bản kiểm kê quỹ' }));
  return wrap;
};

M.cashCountForm = function () {
  const dateI = C.input({ type: 'date', value: U.today() });
  const accInputs = {};
  const body = U.el('div');
  body.appendChild(U.el('div', { class: 'form-grid' }, [C.field('Kiểm kê đến ngày', dateI)]));
  const tblHost = U.el('div', { style: 'margin-top:10px' });
  body.appendChild(tblHost);
  function drawTbl() {
    tblHost.innerHTML = '';
    const tbl = U.el('table', { class: 'tbl tbl-cards' });
    tbl.appendChild(U.el('thead', null, U.el('tr', null, ['Tài khoản', 'Tồn sổ', 'Thực đếm'].map((h, i) => U.el('th', { class: i ? 'num' : '' }, h)))));
    const tb = U.el('tbody');
    PW.data.cashAccounts.forEach(a => {
      const book = PW.balanceAsOf(a.id, dateI.value);
      let rec = accInputs[a.id];
      if (!rec) { rec = accInputs[a.id] = { input: C.input({ type: 'number', value: book, style: 'width:120px;text-align:right' }), touched: false };
        rec.input.addEventListener('input', () => { rec.touched = true; }); }
      rec.book = book;
      if (!rec.touched) rec.input.value = book;   // chưa sửa -> mặc định = tồn sổ
      tb.appendChild(U.el('tr', null, [
        U.el('td', { 'data-label': 'Tài khoản' }, U.esc(a.name)),
        U.el('td', { class: 'num', 'data-label': 'Tồn sổ' }, U.money(book)),
        U.el('td', { class: 'num', 'data-label': 'Thực đếm' }, rec.input),
      ]));
    });
    tbl.appendChild(tb);
    tblHost.appendChild(U.el('div', { class: 'table-wrap' }, tbl));
  }
  dateI.addEventListener('change', drawTbl);
  drawTbl();
  C.modal({
    title: 'Lập biên bản kiểm kê quỹ', body,
    footer: [C.btn('Hủy', C.closeModal), C.btn('Ghi nhận & điều chỉnh', () => {
      let made = 0;
      if (!PW.data.cashCounts) PW.data.cashCounts = [];
      PW.data.cashAccounts.forEach(a => {
        const book = PW.balanceAsOf(a.id, dateI.value);
        const actual = Number(accInputs[a.id].input.value) || 0;
        const diff = actual - book;
        const cc = { id: PW.uid(), date: dateI.value, accountId: a.id, bookBalance: book, actualBalance: actual, diff: diff, adjustmentId: null };
        if (Math.abs(diff) >= 1) {
          if (diff > 0) {
            const obj = { id: PW.uid(), code: PW.nextCode('PT'), date: dateI.value, accountId: a.id, customerId: null, amount: diff, reason: 'Thừa quỹ kiểm kê - ' + a.name, note: '' };
            PW.data.receipts.push(obj); cc.adjustmentId = obj.id;
            PW.logActivity('create', 'receipt', obj.code, U.money(diff) + ' đ — điều chỉnh kiểm kê');
          } else {
            const obj = { id: PW.uid(), code: PW.nextCode('PC'), date: dateI.value, accountId: a.id, supplierId: null, amount: -diff, reason: 'Thiếu quỹ kiểm kê - ' + a.name, note: '' };
            PW.data.payments.push(obj); cc.adjustmentId = obj.id;
            PW.logActivity('create', 'payment', obj.code, U.money(-diff) + ' đ — điều chỉnh kiểm kê');
          }
          made++;
        }
        PW.data.cashCounts.push(cc);
      });
      PW.save(); C.closeModal(); App.refresh();
      U.toast(made ? ('Đã kiểm kê & tạo ' + made + ' phiếu điều chỉnh') : 'Đã ghi nhận kiểm kê — khớp sổ, không cần điều chỉnh');
    }, 'primary')],
  });
};

/* ---------- Tab 3: Dự báo dòng tiền ---------- */
M._cashForecastTab = function () {
  const wrap = U.el('div');
  const card = U.el('div', { class: 'card' });
  card.appendChild(U.el('div', { class: 'card-title' }, '📈 Dự báo dòng tiền'));
  card.appendChild(U.el('p', { class: 'section-sub' }, 'Dự kiến tiền vào/ra dựa trên công nợ ĐẾN HẠN trong kỳ — để biết quỹ có đủ tiền hay không.'));
  const p = U.period('month');
  const fromI = C.input({ type: 'date', value: U.today() });
  const toI = C.input({ type: 'date', value: p.to });
  const bar = U.el('div', { class: 'toolbar' });
  bar.appendChild(M._cashFld('Từ ngày', fromI));
  bar.appendChild(M._cashFld('Đến ngày', toI));
  bar.appendChild(M._cashFld(' ', C.btn('Dự báo', () => draw(), 'primary')));
  card.appendChild(bar);
  const host = U.el('div');
  card.appendChild(host);
  wrap.appendChild(card);
  function draw() {
    const from = fromI.value, to = toI.value;
    const opening = PW.totalCash();
    const recv = PW.dueReceivables(from, to), pay = PW.duePayables(from, to);
    const dThu = recv.reduce((s, r) => s + r.remaining, 0);
    const dChi = pay.reduce((s, r) => s + r.remaining, 0);
    const closing = opening + dThu - dChi;
    host.innerHTML = '';
    host.appendChild(U.el('div', { class: 'grid c4' }, [
      M._cashKpi('Số dư hiện tại', opening, ''),
      M._cashKpi('Dự kiến THU', dThu, 'text-green'),
      M._cashKpi('Dự kiến CHI', dChi, 'text-red'),
      M._cashKpi('Số dư cuối kỳ dự kiến', closing, closing < 0 ? 'text-red' : 'text-blue'),
    ]));
    if (closing < 0) host.appendChild(U.el('div', { class: 'alert-bar', style: 'background:#fdecea;border-color:#f3c2bd;color:#a4362b;margin-top:10px;padding:10px 14px;border-radius:10px' },
      '⚠ Cảnh báo: số dư cuối kỳ dự kiến ÂM ' + U.money(closing) + ' đ — cần đẩy nhanh thu hồi công nợ hoặc giãn lịch chi.'));
    host.appendChild(U.el('div', { class: 'card-title', style: 'margin-top:18px' }, '⬇ Khoản phải THU đến hạn (' + recv.length + ')'));
    host.appendChild(C.table(recv, [
      { label: 'Đến hạn', render: r => U.date(r.due) },
      { label: 'Khách hàng', render: r => r.party ? U.esc(r.party.name) : '(không rõ)' },
      { label: 'Chứng từ', render: r => U.esc(r.code) },
      { label: 'Còn phải thu', num: true, render: r => '<span class="text-green">' + U.money(r.remaining) + '</span>' },
    ], { empty: 'Không có khoản phải thu đến hạn trong kỳ' }));
    host.appendChild(U.el('div', { class: 'card-title', style: 'margin-top:18px' }, '⬆ Khoản phải TRẢ đến hạn (' + pay.length + ')'));
    host.appendChild(C.table(pay, [
      { label: 'Đến hạn', render: r => U.date(r.due) },
      { label: 'Nhà cung cấp', render: r => r.party ? U.esc(r.party.name) : '(không rõ)' },
      { label: 'Chứng từ', render: r => U.esc(r.code) },
      { label: 'Còn phải trả', num: true, render: r => '<span class="text-red">' + U.money(r.remaining) + '</span>' },
    ], { empty: 'Không có khoản phải trả đến hạn trong kỳ' }));
  }
  draw();
  return wrap;
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
