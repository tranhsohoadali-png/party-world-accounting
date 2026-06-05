/* ============================================================
   modules3.js — Quy trình bán hàng + Báo giá / Đơn đặt hàng /
   Trả lại hàng bán / Giảm giá hàng bán
   ============================================================ */

/* =====================================================================
   TRÌNH SOẠN DÒNG HÀNG DÙNG CHUNG (cho báo giá / đơn / trả lại)
   ===================================================================== */
M.itemsEditor = function (items, opts) {
  opts = opts || {};
  const priceKey = opts.priceKey || 'price';
  const onChange = opts.onChange || function () {};
  if (!items.length) items.push({ productId: '', qty: 1, [priceKey]: 0 });
  const tbody = U.el('tbody');

  function subtotal() {
    return items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it[priceKey]) || 0), 0);
  }
  function draw() {
    tbody.innerHTML = '';
    items.forEach((it, idx) => {
      const prodSel = C.select(
        [{ value: '', label: '-- Chọn hàng --' }].concat(PW.data.products.map(p => ({ value: p.id, label: p.code + ' - ' + p.name }))),
        it.productId);
      prodSel.addEventListener('change', () => {
        it.productId = prodSel.value;
        const p = PW.product(prodSel.value);
        if (p) it[priceKey] = p[opts.productPriceKey || 'price'];
        draw(); onChange();
      });
      const qtyI = U.el('input', { type: 'number', value: it.qty, min: 0, style: 'text-align:right' });
      const priceI = U.el('input', { type: 'number', value: it[priceKey], min: 0, style: 'text-align:right' });
      const lt = U.el('span');
      function upd() { lt.textContent = U.money((Number(it.qty) || 0) * (Number(it[priceKey]) || 0)); onChange(); }
      qtyI.addEventListener('input', () => { it.qty = Number(qtyI.value) || 0; upd(); });
      priceI.addEventListener('input', () => { it[priceKey] = Number(priceI.value) || 0; upd(); });
      lt.textContent = U.money((Number(it.qty) || 0) * (Number(it[priceKey]) || 0));
      const p = PW.product(it.productId);
      const stockInfo = opts.showStock && p ? U.el('div', { style: 'font-size:11px;color:#7b8794;margin-top:2px' }, 'Tồn: ' + U.num(PW.stockOf(p.id))) : null;
      tbody.appendChild(U.el('tr', null, [
        U.el('td', { class: 'center' }, String(idx + 1)),
        U.el('td', null, [prodSel, stockInfo].filter(Boolean)),
        U.el('td', { style: 'width:90px' }, qtyI),
        U.el('td', { style: 'width:130px' }, priceI),
        U.el('td', { class: 'num', style: 'width:130px' }, lt),
        U.el('td', { class: 'center', style: 'width:40px' },
          U.el('button', { class: 'btn sm danger', onclick: () => { items.splice(idx, 1); if (!items.length) items.push({ productId: '', qty: 1, [priceKey]: 0 }); draw(); onChange(); } }, '×')),
      ]));
    });
  }
  const table = U.el('table', { class: 'items-tbl' });
  table.appendChild(U.el('thead', null, U.el('tr', null, [
    U.el('th', { style: 'width:36px' }, '#'),
    U.el('th', null, 'Hàng hóa'),
    U.el('th', null, 'SL'),
    U.el('th', null, opts.priceLabel || 'Đơn giá'),
    U.el('th', { class: 'num' }, 'Thành tiền'),
    U.el('th', null, ''),
  ])));
  table.appendChild(tbody);
  const addBtn = C.btn('+ Thêm dòng', () => { items.push({ productId: '', qty: 1, [priceKey]: 0 }); draw(); onChange(); }, 'sm');
  draw();
  return {
    wrap: U.el('div', null, [U.el('div', { class: 'table-wrap' }, table), U.el('div', { class: 'mt8' }, addBtn)]),
    subtotal,
    getValid: () => items.filter(it => it.productId && Number(it.qty) > 0).map(it => ({ productId: it.productId, qty: Number(it.qty), [priceKey]: Number(it[priceKey]) })),
  };
};

/* =====================================================================
   QUY TRÌNH BÁN HÀNG (màn hình tổng quan nghiệp vụ)
   ===================================================================== */
M.salesWorkflow = function (root) {
  const wrap = U.el('div', { class: 'grid', style: 'grid-template-columns: 2fr 1fr' });

  // --- Cột trái: sơ đồ nghiệp vụ ---
  const flow = U.el('div', { class: 'card' });
  flow.appendChild(U.el('div', { class: 'card-title', style: 'justify-content:center' }, 'NGHIỆP VỤ BÁN HÀNG'));
  const steps = [
    { ic: '🧾', label: 'Báo giá', go: 'quotes' },
    { ic: '📋', label: 'Đơn đặt hàng', go: 'orders' },
    { ic: '🛒', label: 'Lập hóa đơn bán', go: 'sales', primary: true },
    { ic: '💰', label: 'Thu tiền theo hóa đơn', go: 'cash' },
    { ic: '↩️', label: 'Trả lại hàng bán', go: 'returns' },
    { ic: '🏷️', label: 'Giảm giá hàng bán', go: 'discounts' },
  ];
  const flowGrid = U.el('div', { class: 'flow-grid' });
  steps.forEach((s, i) => {
    const node = U.el('div', { class: 'flow-node' + (s.primary ? ' primary' : ''), onclick: () => App.go(s.go) }, [
      U.el('div', { class: 'flow-ic' }, s.ic),
      U.el('div', { class: 'flow-lbl' }, s.label),
    ]);
    flowGrid.appendChild(node);
    if (i < steps.length - 1) flowGrid.appendChild(U.el('div', { class: 'flow-arrow' }, '→'));
  });
  flow.appendChild(flowGrid);

  // Thao tác nhanh
  flow.appendChild(U.el('div', { class: 'card-title mt16', style: 'font-size:14px' }, 'Thao tác nhanh'));
  const quick = U.el('div', { class: 'pill-row' }, [
    C.btn('+ Báo giá', () => M.quoteForm(), 'sm'),
    C.btn('+ Đơn đặt hàng', () => M.orderForm(), 'sm'),
    C.btn('+ Hóa đơn bán', () => M.salesForm(), 'sm primary'),
    C.btn('+ Trả lại hàng', () => M.returnForm(), 'sm'),
    C.btn('+ Giảm giá', () => M.discountForm(), 'sm'),
    C.btn('+ Khách hàng', () => M.partnerForm('customer'), 'sm'),
    C.btn('+ Hàng hóa', () => M.productForm(), 'sm'),
  ]);
  flow.appendChild(quick);
  wrap.appendChild(flow);

  // --- Cột phải: báo cáo ---
  const rep = U.el('div', { class: 'card' });
  rep.appendChild(U.el('div', { class: 'card-title', style: 'justify-content:center' }, 'BÁO CÁO'));
  const reps = [
    { label: 'Sổ chi tiết bán hàng', type: 'revenue' },
    { label: 'Chi tiết công nợ phải thu khách hàng', type: 'receivable' },
    { label: 'Tổng hợp bán hàng theo mặt hàng', type: 'revenue' },
    { label: 'Tổng hợp công nợ phải thu khách hàng', type: 'receivable' },
    { label: 'Báo cáo kết quả kinh doanh (lãi/lỗ)', type: 'pl' },
  ];
  const list = U.el('div');
  reps.forEach(r => {
    list.appendChild(U.el('a', {
      class: 'rep-link', href: '#reports',
      onclick: (e) => { e.preventDefault(); App._reportPreset = r.type; App.go('reports'); },
    }, '• ' + r.label));
  });
  rep.appendChild(list);
  rep.appendChild(U.el('div', { style: 'text-align:center;margin-top:10px' },
    U.el('a', { href: '#reports', onclick: (e) => { e.preventDefault(); App.go('reports'); } }, 'Tất cả báo cáo')));
  wrap.appendChild(rep);

  root.appendChild(wrap);

  // Thẻ tóm tắt số liệu nhanh
  const sum = U.el('div', { class: 'grid c4 mt16' });
  const openQuotes = PW.data.quotations.filter(q => q.status === 'open').length;
  const openOrders = PW.data.salesOrders.filter(o => o.status === 'open').length;
  [
    { l: 'Báo giá chưa lập HĐ', v: openQuotes, ic: '🧾', c: 'var(--blue)' },
    { l: 'Đơn hàng chưa lập HĐ', v: openOrders, ic: '📋', c: 'var(--orange)' },
    { l: 'Hóa đơn bán', v: PW.data.salesInvoices.length, ic: '🛒', c: 'var(--teal)' },
    { l: 'Phải thu khách hàng', v: U.money(PW.totalReceivable()), ic: '📥', c: '#9b59b6', money: true },
  ].forEach(k => {
    sum.appendChild(U.el('div', { class: 'kpi' }, [
      U.el('div', { style: 'display:flex;justify-content:space-between' }, [
        U.el('div', { class: 'label' }, k.l),
        U.el('div', { class: 'ic-badge', style: 'background:' + k.c }, k.ic),
      ]),
      U.el('div', { class: 'value', style: k.money ? 'font-size:20px' : '' }, k.money ? k.v : U.num(k.v)),
    ]));
  });
  root.appendChild(sum);
};

/* =====================================================================
   BÁO GIÁ
   ===================================================================== */
M.quotations = function (root) { M.docListSimple(root, 'quote'); };
M.salesOrdersPage = function (root) { M.docListSimple(root, 'order'); };

M.docListSimple = function (root, kind) {
  const isQuote = kind === 'quote';
  const list = isQuote ? PW.data.quotations : PW.data.salesOrders;
  const card = U.el('div', { class: 'card' });
  const toolbar = U.el('div', { class: 'toolbar' });
  const search = U.el('input', { class: 'search', placeholder: '🔍 Tìm...' });
  toolbar.appendChild(search);
  toolbar.appendChild(U.el('div', { class: 'spacer' }));
  toolbar.appendChild(C.btn(isQuote ? '+ Lập báo giá' : '+ Lập đơn đặt hàng',
    () => isQuote ? M.quoteForm() : M.orderForm(), 'primary'));
  card.appendChild(toolbar);
  const host = U.el('div');
  card.appendChild(host);
  root.appendChild(card);

  function total(doc) { return doc.items.reduce((s, it) => s + Number(it.qty) * Number(it.price), 0) - Number(doc.discount || 0); }
  function draw() {
    const q = search.value.trim().toLowerCase();
    const rows = list.filter(x => {
      const c = PW.customer(x.customerId);
      return !q || x.code.toLowerCase().includes(q) || (c && c.name.toLowerCase().includes(q));
    }).sort((a, b) => (b.date + b.code).localeCompare(a.date + a.code));
    host.innerHTML = '';
    host.appendChild(C.table(rows, [
      { label: 'Ngày', render: x => U.date(x.date) },
      { label: isQuote ? 'Số báo giá' : 'Số đơn hàng', render: x => U.esc(x.code) },
      { label: 'Khách hàng', render: x => { const c = PW.customer(x.customerId); return c ? U.esc(c.name) : ''; } },
      { label: 'Số mặt hàng', center: true, render: x => x.items.length },
      { label: 'Tổng tiền', num: true, render: x => U.money(total(x)) },
      { label: 'Trạng thái', center: true, render: x => x.status === 'converted'
          ? '<span class="tag green">Đã lập HĐ</span>' : '<span class="tag orange">Chưa lập HĐ</span>' },
      { label: '', render: x => C.actions([
          x.status !== 'converted' ? { label: '➜ Lập hóa đơn', cls: 'primary', onClick: () => M.convertToInvoice(x, kind) } : null,
          { label: 'In', onClick: () => M.printSalesDoc(kind, x) },
          { label: 'Sửa', onClick: () => isQuote ? M.quoteForm(x) : M.orderForm(x) },
          { label: 'Xóa', cls: 'danger', onClick: () => {
              if (U.confirm('Xóa ' + x.code + '?')) {
                if (isQuote) PW.data.quotations = PW.data.quotations.filter(y => y.id !== x.id);
                else PW.data.salesOrders = PW.data.salesOrders.filter(y => y.id !== x.id);
                PW.save(); App.refresh(); U.toast('Đã xóa');
              }
            } },
        ].filter(Boolean)) },
    ], { empty: isQuote ? 'Chưa có báo giá' : 'Chưa có đơn đặt hàng' }));
  }
  search.addEventListener('input', draw);
  draw();
};

M.quoteForm = function (q) { M.simpleDocForm('quote', q); };
M.orderForm = function (o) { M.simpleDocForm('order', o); };

M.simpleDocForm = function (kind, doc) {
  const isQuote = kind === 'quote';
  const isNew = !doc;
  doc = doc ? JSON.parse(JSON.stringify(doc)) : {
    code: PW.nextCode(isQuote ? 'BG' : 'DH'), date: U.today(),
    customerId: PW.data.customers[0] ? PW.data.customers[0].id : '',
    items: [], discount: 0, status: 'open', note: '',
  };
  const codeI = C.input({ value: doc.code });
  const dateI = C.input({ type: 'date', value: doc.date });
  const custI = C.select(PW.data.customers.map(c => ({ value: c.id, label: c.name })), doc.customerId);
  const noteI = C.input({ value: doc.note || '' });
  const discI = C.input({ type: 'number', value: doc.discount || 0, min: 0, style: 'width:140px;text-align:right' });
  const grand = U.el('span', { style: 'font-weight:700' });
  const editor = M.itemsEditor(doc.items.map(it => Object.assign({}, it)), {
    priceKey: 'price', priceLabel: 'Đơn giá bán', productPriceKey: 'price',
    onChange: () => { grand.textContent = U.money(editor.subtotal() - (Number(discI.value) || 0)) + ' đ'; },
  });
  discI.addEventListener('input', () => grand.textContent = U.money(editor.subtotal() - (Number(discI.value) || 0)) + ' đ');
  grand.textContent = U.money(editor.subtotal() - (Number(discI.value) || 0)) + ' đ';

  const body = U.el('div', null, [
    U.el('div', { class: 'form-grid' }, [
      C.field('Số chứng từ', codeI),
      C.field('Ngày', dateI, { required: true }),
      C.field('Khách hàng', custI, { required: true, full: true }),
    ]),
    U.el('div', { class: 'section-sub mt16', style: 'font-weight:600;color:#2c3a47' }, 'Chi tiết hàng hóa'),
    editor.wrap,
    C.field('Diễn giải', noteI, { full: true }),
    U.el('div', { style: 'margin-top:12px;display:flex;flex-direction:column;gap:8px;align-items:flex-end' }, [
      U.el('div', { style: 'display:flex;align-items:center;gap:10px' }, [U.el('span', { class: 'text-muted' }, 'Giảm giá: '), discI]),
      U.el('div', null, [U.el('span', { class: 'text-muted' }, 'TỔNG TIỀN: '), grand]),
    ]),
  ]);

  C.modal({
    title: (isNew ? 'Lập ' : 'Sửa ') + (isQuote ? 'báo giá' : 'đơn đặt hàng'), wide: true, body,
    footer: [C.btn('Hủy', C.closeModal), C.btn('Lưu', () => {
      const valid = editor.getValid();
      if (!valid.length) return U.toast('Thêm ít nhất 1 dòng hàng', 'error');
      if (!custI.value) return U.toast('Chọn khách hàng', 'error');
      const obj = { id: doc.id || PW.uid(), code: codeI.value, date: dateI.value,
        customerId: custI.value, items: valid, discount: Number(discI.value) || 0,
        status: doc.status || 'open', note: noteI.value };
      const target = isQuote ? PW.data.quotations : PW.data.salesOrders;
      if (isNew) target.push(obj);
      else { const i = target.findIndex(x => x.id === obj.id); target[i] = obj; }
      PW.save(); C.closeModal(); App.refresh(); U.toast('Đã lưu');
    }, 'primary')],
  });
};

M.convertToInvoice = function (src, kind) {
  if (!U.confirm('Tạo hóa đơn bán hàng từ ' + src.code + '?')) return;
  const inv = {
    id: PW.uid(), code: PW.nextCode('HD'), date: U.today(), customerId: src.customerId,
    items: src.items.map(it => ({ productId: it.productId, qty: Number(it.qty), price: Number(it.price) })),
    discount: Number(src.discount || 0), paid: 0, paidAccountId: null,
    note: (kind === 'quote' ? 'Từ báo giá ' : 'Từ đơn đặt hàng ') + src.code,
  };
  PW.data.salesInvoices.push(inv);
  src.status = 'converted';
  PW.save(); App.refresh(); U.toast('Đã tạo hóa đơn ' + inv.code);
};

/* ---------- In báo giá / đơn đặt hàng / phiếu trả lại ---------- */
M.printSalesDoc = function (kind, doc) {
  const titles = { quote: 'BÁO GIÁ', order: 'ĐƠN ĐẶT HÀNG', return: 'PHIẾU TRẢ LẠI HÀNG BÁN' };
  const cust = PW.customer(doc.customerId);
  const sub = doc.items.reduce((s, it) => s + Number(it.qty) * Number(it.price), 0);
  const disc = Number(doc.discount || 0);
  const total = sub - disc;
  const rows = doc.items.map((it, i) => {
    const p = PW.product(it.productId);
    return `<tr><td style="text-align:center">${i + 1}</td><td>${U.esc(p ? p.name : '')}</td>
      <td style="text-align:center">${p ? U.esc(p.unit) : ''}</td>
      <td style="text-align:right">${U.num(it.qty)}</td>
      <td style="text-align:right">${U.money(it.price)}</td>
      <td style="text-align:right">${U.money(Number(it.qty) * Number(it.price))}</td></tr>`;
  }).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${doc.code}</title>
    <style>body{font-family:'Segoe UI',Arial;padding:30px;color:#222}
    .company{text-align:center;color:#1ea7a0;font-weight:700;font-size:18px}
    h2{text-align:center;margin:6px 0} table{width:100%;border-collapse:collapse;margin-top:16px}
    th,td{border:1px solid #999;padding:7px 9px;font-size:13px} th{background:#f0f0f0}
    .meta{margin-top:10px;font-size:14px;line-height:1.7} .tot{text-align:right;margin-top:10px;font-size:15px}
    .sign{display:flex;justify-content:space-around;margin-top:50px;text-align:center}</style></head><body>
    <div class="company">PARTY WORLD — Thế giới đồ tiệc</div>
    <h2>${titles[kind]}</h2>
    <div style="text-align:center">Số: ${U.esc(doc.code)} &nbsp;|&nbsp; Ngày ${U.date(doc.date)}</div>
    <div class="meta"><div><b>Khách hàng:</b> ${U.esc(cust ? cust.name : '')}</div>
      <div><b>Điện thoại:</b> ${U.esc(cust ? cust.phone : '')} &nbsp; <b>Địa chỉ:</b> ${U.esc(cust ? cust.address : '')}</div>
      ${doc.note ? `<div><b>Diễn giải:</b> ${U.esc(doc.note)}</div>` : ''}</div>
    <table><thead><tr><th>STT</th><th>Tên hàng hóa</th><th>ĐVT</th><th>SL</th><th>Đơn giá</th><th>Thành tiền</th></tr></thead>
    <tbody>${rows}</tbody></table>
    <div class="tot">Cộng tiền hàng: <b>${U.money(sub)} đ</b></div>
    ${disc ? `<div class="tot">Giảm giá: ${U.money(disc)} đ</div>` : ''}
    <div class="tot">TỔNG CỘNG: <b>${U.money(total)} đ</b></div>
    ${kind === 'quote' ? '<div style="margin-top:8px;font-style:italic;font-size:13px">* Báo giá có hiệu lực trong 30 ngày kể từ ngày lập.</div>' : ''}
    <div class="sign"><div>Khách hàng<br/><i>(Ký, ghi rõ họ tên)</i></div><div>PARTY WORLD<br/><i>(Ký, ghi rõ họ tên)</i></div></div>
    <script>window.onload=function(){window.print();}</script></body></html>`;
  const w = window.open('', '_blank');
  if (!w) return U.toast('Trình duyệt chặn cửa sổ in. Hãy cho phép pop-up.', 'error');
  w.document.write(html); w.document.close();
};

/* =====================================================================
   TRẢ LẠI HÀNG BÁN
   ===================================================================== */
M.returns = function (root) {
  const card = U.el('div', { class: 'card' });
  const toolbar = U.el('div', { class: 'toolbar' });
  toolbar.appendChild(U.el('div', { class: 'card-title', style: 'margin:0' }, '↩️ Phiếu trả lại hàng bán'));
  toolbar.appendChild(U.el('div', { class: 'spacer' }));
  toolbar.appendChild(C.btn('+ Lập phiếu trả lại', () => M.returnForm(), 'primary'));
  card.appendChild(toolbar);
  const host = U.el('div');
  card.appendChild(host);
  root.appendChild(card);

  function draw() {
    const rows = PW.data.salesReturns.slice().sort((a, b) => (b.date + b.code).localeCompare(a.date + a.code));
    host.innerHTML = '';
    host.appendChild(C.table(rows, [
      { label: 'Ngày', render: r => U.date(r.date) },
      { label: 'Số phiếu', render: r => U.esc(r.code) },
      { label: 'Khách hàng', render: r => { const c = PW.customer(r.customerId); return c ? U.esc(c.name) : ''; } },
      { label: 'Số mặt hàng', center: true, render: r => r.items.length },
      { label: 'Giá trị trả lại', num: true, render: r => `<span class="text-red">${U.money(PW.returnTotal(r))}</span>` },
      { label: 'Lý do', render: r => U.esc(r.note || '') },
      { label: '', render: r => C.actions([
          { label: 'In', onClick: () => M.printSalesDoc('return', r) },
          { label: 'Sửa', onClick: () => M.returnForm(r) },
          { label: 'Xóa', cls: 'danger', onClick: () => {
              if (U.confirm('Xóa phiếu ' + r.code + '?')) {
                PW.data.salesReturns = PW.data.salesReturns.filter(x => x.id !== r.id);
                PW.save(); App.refresh(); U.toast('Đã xóa');
              }
            } },
        ]) },
    ], { empty: 'Chưa có phiếu trả lại hàng' }));
  }
  draw();
};

M.returnForm = function (sr) {
  const isNew = !sr;
  sr = sr ? JSON.parse(JSON.stringify(sr)) : {
    code: PW.nextCode('TL'), date: U.today(),
    customerId: PW.data.customers[0] ? PW.data.customers[0].id : '',
    items: [], note: '',
  };
  const codeI = C.input({ value: sr.code });
  const dateI = C.input({ type: 'date', value: sr.date });
  const custI = C.select(PW.data.customers.map(c => ({ value: c.id, label: c.name })), sr.customerId);
  const noteI = C.input({ value: sr.note || '' });
  const grand = U.el('span', { style: 'font-weight:700' });
  const editor = M.itemsEditor(sr.items.map(it => Object.assign({}, it)), {
    priceKey: 'price', priceLabel: 'Đơn giá trả', productPriceKey: 'price',
    onChange: () => { grand.textContent = U.money(editor.subtotal()) + ' đ'; },
  });
  grand.textContent = U.money(editor.subtotal()) + ' đ';

  const body = U.el('div', null, [
    U.el('div', { class: 'form-grid' }, [
      C.field('Số phiếu', codeI),
      C.field('Ngày', dateI, { required: true }),
      C.field('Khách hàng trả lại', custI, { required: true, full: true }),
    ]),
    U.el('div', { class: 'section-sub mt16', style: 'font-weight:600;color:#2c3a47' }, 'Hàng hóa khách trả lại'),
    editor.wrap,
    C.field('Lý do trả lại', noteI, { full: true }),
    U.el('div', { style: 'margin-top:12px;text-align:right' }, [U.el('span', { class: 'text-muted' }, 'TỔNG GIÁ TRỊ TRẢ LẠI: '), grand]),
    U.el('div', { class: 'section-sub', style: 'text-align:right' }, 'Hàng trả sẽ nhập lại kho, giảm doanh thu & công nợ phải thu của khách.'),
  ]);

  C.modal({
    title: isNew ? 'Lập phiếu trả lại hàng bán' : 'Sửa phiếu trả lại', wide: true, body,
    footer: [C.btn('Hủy', C.closeModal), C.btn('Lưu', () => {
      const valid = editor.getValid();
      if (!valid.length) return U.toast('Thêm ít nhất 1 dòng hàng', 'error');
      if (!custI.value) return U.toast('Chọn khách hàng', 'error');
      const obj = { id: sr.id || PW.uid(), code: codeI.value, date: dateI.value,
        customerId: custI.value, items: valid, note: noteI.value };
      if (isNew) PW.data.salesReturns.push(obj);
      else { const i = PW.data.salesReturns.findIndex(x => x.id === obj.id); PW.data.salesReturns[i] = obj; }
      PW.save(); C.closeModal(); App.refresh(); U.toast('Đã lưu phiếu trả lại');
    }, 'primary')],
  });
};

/* =====================================================================
   GIẢM GIÁ HÀNG BÁN
   ===================================================================== */
M.discounts = function (root) {
  const card = U.el('div', { class: 'card' });
  const toolbar = U.el('div', { class: 'toolbar' });
  toolbar.appendChild(U.el('div', { class: 'card-title', style: 'margin:0' }, '🏷️ Giảm giá hàng bán'));
  toolbar.appendChild(U.el('div', { class: 'spacer' }));
  toolbar.appendChild(C.btn('+ Lập giảm giá', () => M.discountForm(), 'primary'));
  card.appendChild(toolbar);
  const host = U.el('div');
  card.appendChild(host);
  root.appendChild(card);

  function draw() {
    const rows = PW.data.salesDiscounts.slice().sort((a, b) => (b.date + b.code).localeCompare(a.date + a.code));
    host.innerHTML = '';
    host.appendChild(C.table(rows, [
      { label: 'Ngày', render: r => U.date(r.date) },
      { label: 'Số phiếu', render: r => U.esc(r.code) },
      { label: 'Khách hàng', render: r => { const c = PW.customer(r.customerId); return c ? U.esc(c.name) : ''; } },
      { label: 'Số tiền giảm', num: true, render: r => `<span class="text-red">${U.money(r.amount)}</span>` },
      { label: 'Lý do', render: r => U.esc(r.reason || '') },
      { label: '', render: r => C.actions([
          { label: 'Sửa', onClick: () => M.discountForm(r) },
          { label: 'Xóa', cls: 'danger', onClick: () => {
              if (U.confirm('Xóa phiếu ' + r.code + '?')) {
                PW.data.salesDiscounts = PW.data.salesDiscounts.filter(x => x.id !== r.id);
                PW.save(); App.refresh(); U.toast('Đã xóa');
              }
            } },
        ]) },
    ], { empty: 'Chưa có phiếu giảm giá' }));
  }
  draw();
};

M.discountForm = function (g) {
  const isNew = !g;
  g = g || { code: PW.nextCode('GG'), date: U.today(),
    customerId: PW.data.customers[0] ? PW.data.customers[0].id : '', amount: 0, reason: '' };
  const f = {
    code: C.input({ value: g.code }),
    date: C.input({ type: 'date', value: g.date }),
    cust: C.select(PW.data.customers.map(c => ({ value: c.id, label: c.name })), g.customerId),
    amount: C.input({ type: 'number', value: g.amount, min: 0 }),
    reason: C.input({ value: g.reason || '' }),
  };
  const body = U.el('div', { class: 'form-grid' }, [
    C.field('Số phiếu', f.code),
    C.field('Ngày', f.date, { required: true }),
    C.field('Khách hàng', f.cust, { required: true, full: true }),
    C.field('Số tiền giảm (đ)', f.amount, { required: true }),
    C.field('Lý do giảm giá', f.reason, { full: true }),
  ]);
  C.modal({
    title: isNew ? 'Lập giảm giá hàng bán' : 'Sửa giảm giá', body,
    footer: [C.btn('Hủy', C.closeModal), C.btn('Lưu', () => {
      const amt = Number(f.amount.value) || 0;
      if (amt <= 0) return U.toast('Nhập số tiền giảm', 'error');
      const obj = { id: g.id || PW.uid(), code: f.code.value, date: f.date.value,
        customerId: f.cust.value, amount: amt, reason: f.reason.value };
      if (isNew) PW.data.salesDiscounts.push(obj);
      else Object.assign(g, obj);
      PW.save(); C.closeModal(); App.refresh(); U.toast('Đã lưu giảm giá');
    }, 'primary')],
  });
};
