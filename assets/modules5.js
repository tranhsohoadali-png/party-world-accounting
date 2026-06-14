/* ============================================================
   modules5.js — Quy trình MUA HÀNG: Đơn mua hàng, Trả lại hàng
   mua, Giảm giá hàng mua
   ============================================================ */

/* =====================================================================
   QUY TRÌNH MUA HÀNG
   ===================================================================== */
M.purchaseWorkflow = function (root) {
  const wrap = U.el('div', { class: 'grid', style: 'grid-template-columns: 2fr 1fr' });

  const flow = U.el('div', { class: 'card' });
  flow.appendChild(U.el('div', { class: 'card-title', style: 'justify-content:center' }, 'NGHIỆP VỤ MUA HÀNG'));
  const steps = [
    { ic: '📝', label: 'Đơn mua hàng', go: 'purchase-orders' },
    { ic: '📦', label: 'Nhập hàng (Phiếu nhập)', go: 'purchases', primary: true },
    { ic: '💸', label: 'Trả tiền theo hóa đơn', go: 'cash' },
    { ic: '↪️', label: 'Trả lại hàng mua', go: 'purchase-returns' },
    { ic: '🏷️', label: 'Giảm giá hàng mua', go: 'purchase-discounts' },
  ];
  const flowGrid = U.el('div', { class: 'flow-grid' });
  steps.forEach((s, i) => {
    flowGrid.appendChild(U.el('div', { class: 'flow-node' + (s.primary ? ' primary' : ''), onclick: () => App.go(s.go) }, [
      U.el('div', { class: 'flow-ic' }, s.ic),
      U.el('div', { class: 'flow-lbl' }, s.label),
    ]));
    if (i < steps.length - 1) flowGrid.appendChild(U.el('div', { class: 'flow-arrow' }, '→'));
  });
  flow.appendChild(flowGrid);

  flow.appendChild(U.el('div', { class: 'card-title mt16', style: 'font-size:14px' }, 'Thao tác nhanh'));
  flow.appendChild(U.el('div', { class: 'pill-row' }, [
    C.btn('+ Đơn mua hàng', () => M.purchaseOrderForm(), 'sm'),
    C.btn('+ Phiếu nhập mua', () => M.purchaseForm(), 'sm primary'),
    C.btn('+ Trả lại hàng mua', () => M.purchaseReturnForm(), 'sm'),
    C.btn('+ Giảm giá hàng mua', () => M.purchaseDiscountForm(), 'sm'),
    C.btn('+ Phiếu chi (trả NCC)', () => M.paymentForm(), 'sm'),
    C.btn('+ Nhà cung cấp', () => M.partnerForm('supplier'), 'sm'),
    C.btn('+ Hàng hóa', () => M.productForm(), 'sm'),
  ]));
  wrap.appendChild(flow);

  const rep = U.el('div', { class: 'card' });
  rep.appendChild(U.el('div', { class: 'card-title', style: 'justify-content:center' }, 'BÁO CÁO'));
  const reps = [
    { label: 'Sổ chi tiết mua hàng', type: 'purchaseByItem' },
    { label: 'Chi tiết công nợ phải trả nhà cung cấp', type: 'payable' },
    { label: 'Tổng hợp mua hàng theo mặt hàng', type: 'purchaseByItem' },
    { label: 'Tổng hợp công nợ phải trả nhà cung cấp', type: 'payable' },
    { label: 'Báo cáo Nhập - Xuất - Tồn kho', type: 'inout' },
  ];
  const list = U.el('div');
  reps.forEach(r => list.appendChild(U.el('a', {
    class: 'rep-link', href: '#reports',
    onclick: (e) => { e.preventDefault(); App._reportPreset = r.type; App.go('reports'); },
  }, '• ' + r.label)));
  rep.appendChild(list);
  rep.appendChild(U.el('div', { style: 'text-align:center;margin-top:10px' },
    U.el('a', { href: '#reports', onclick: (e) => { e.preventDefault(); App.go('reports'); } }, 'Tất cả báo cáo')));
  wrap.appendChild(rep);
  root.appendChild(wrap);

  const sum = U.el('div', { class: 'grid c4 mt16' });
  const openPO = PW.data.purchaseOrders.filter(o => o.status === 'open').length;
  [
    { l: 'Đơn mua chưa nhập', v: openPO, ic: '📝', c: 'var(--orange)' },
    { l: 'Phiếu nhập mua', v: PW.data.purchases.length, ic: '📦', c: 'var(--teal)' },
    { l: 'Giá trị tồn kho', v: U.money(PW.inventoryValue()), ic: '🏬', c: '#9b59b6', money: true },
    { l: 'Phải trả nhà cung cấp', v: U.money(PW.totalPayable()), ic: '📤', c: 'var(--red)', money: true },
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
   ĐƠN MUA HÀNG
   ===================================================================== */
M.purchaseOrders = function (root) {
  const card = U.el('div', { class: 'card' });
  const toolbar = U.el('div', { class: 'toolbar' });
  const search = U.el('input', { class: 'search', placeholder: 'Tìm số đơn / NCC...' });
  toolbar.appendChild(search);
  toolbar.appendChild(U.el('div', { class: 'spacer' }));
  toolbar.appendChild(C.btn('+ Lập đơn mua hàng', () => M.purchaseOrderForm(), 'primary'));
  card.appendChild(toolbar);
  const host = U.el('div');
  card.appendChild(host);
  root.appendChild(card);

  function total(o) { return o.items.reduce((s, it) => s + Number(it.qty) * Number(it.cost), 0) - Number(o.discount || 0); }
  function draw() {
    const q = search.value.trim().toLowerCase();
    const rows = PW.data.purchaseOrders.filter(o => {
      const s = PW.supplier(o.supplierId);
      return !q || o.code.toLowerCase().includes(q) || (s && s.name.toLowerCase().includes(q));
    }).sort((a, b) => (b.date + b.code).localeCompare(a.date + a.code));
    host.innerHTML = '';
    host.appendChild(C.table(rows, [
      { label: 'Ngày', render: o => U.date(o.date) },
      { label: 'Số đơn', render: o => U.esc(o.code) },
      { label: 'Nhà cung cấp', render: o => { const s = PW.supplier(o.supplierId); return s ? U.esc(s.name) : ''; } },
      { label: 'Số mặt hàng', center: true, render: o => o.items.length },
      { label: 'Tổng tiền', num: true, render: o => U.money(total(o)) },
      { label: 'Trạng thái', center: true, render: o => o.status === 'converted'
          ? '<span class="tag green">Đã nhập kho</span>' : '<span class="tag orange">Chưa nhập</span>' },
      { label: '', render: o => C.actions([
          o.status !== 'converted' ? { label: '➜ Nhập kho', cls: 'primary', onClick: () => M.convertToPurchase(o) } : null,
          { label: 'In', onClick: () => M.printPurchaseDoc('order', o) },
          { label: 'Sửa', onClick: () => M.purchaseOrderForm(o) },
          { label: 'Xóa', cls: 'danger', onClick: () => {
              if (U.confirm('Xóa đơn ' + o.code + '?')) {
                PW.logActivity('delete', 'purchaseOrder', o.code, '');
                PW.data.purchaseOrders = PW.data.purchaseOrders.filter(x => x.id !== o.id);
                PW.save(); App.refresh(); U.toast('Đã xóa');
              }
            } },
        ].filter(Boolean)) },
    ], { empty: 'Chưa có đơn mua hàng' }));
  }
  search.addEventListener('input', draw);
  draw();
};

M.purchaseOrderForm = function (o) {
  const isNew = !o;
  o = o ? JSON.parse(JSON.stringify(o)) : {
    code: PW.nextCode('DMH'), date: U.today(),
    supplierId: PW.data.suppliers[0] ? PW.data.suppliers[0].id : '',
    items: [], discount: 0, status: 'open', note: '',
  };
  const codeI = C.input({ value: o.code });
  const dateI = C.input({ type: 'date', value: o.date });
  const supI = C.select(PW.data.suppliers.map(s => ({ value: s.id, label: s.name })), o.supplierId);
  const noteI = C.input({ value: o.note || '' });
  const discI = C.input({ type: 'number', value: o.discount || 0, min: 0, style: 'width:140px;text-align:right' });
  const grand = U.el('span', { style: 'font-weight:700' });
  const editor = M.itemsEditor(o.items.map(it => Object.assign({}, it)), {
    priceKey: 'cost', priceLabel: 'Đơn giá nhập', productPriceKey: 'cost',
    onChange: () => { grand.textContent = U.money(editor.subtotal() - (Number(discI.value) || 0)) + ' đ'; },
  });
  discI.addEventListener('input', () => grand.textContent = U.money(editor.subtotal() - (Number(discI.value) || 0)) + ' đ');
  grand.textContent = U.money(editor.subtotal() - (Number(discI.value) || 0)) + ' đ';

  const body = U.el('div', null, [
    U.el('div', { class: 'form-grid' }, [
      C.field('Số chứng từ', codeI),
      C.field('Ngày', dateI, { required: true }),
      C.field('Nhà cung cấp', M.partnerAdd(supI, false), { required: true, full: true }),
    ]),
    U.el('div', { class: 'section-sub mt16', style: 'font-weight:600;color:#2c3a47' }, 'Chi tiết hàng hóa đặt mua'),
    editor.wrap,
    C.field('Diễn giải', noteI, { full: true }),
    U.el('div', { style: 'margin-top:12px;display:flex;flex-direction:column;gap:8px;align-items:flex-end' }, [
      U.el('div', { style: 'display:flex;align-items:center;gap:10px' }, [U.el('span', { class: 'text-muted' }, 'Giảm giá: '), discI]),
      U.el('div', null, [U.el('span', { class: 'text-muted' }, 'TỔNG TIỀN: '), grand]),
    ]),
  ]);

  C.modal({
    title: (isNew ? 'Lập ' : 'Sửa ') + 'đơn mua hàng', wide: true, body,
    footer: [C.btn('Hủy', C.closeModal), C.btn('Lưu', () => {
      const valid = editor.getValid();
      if (!valid.length) return U.toast('Thêm ít nhất 1 dòng hàng', 'error');
      if (!supI.value) return U.toast('Chọn nhà cung cấp', 'error');
      const obj = { id: o.id || PW.uid(), code: codeI.value, date: dateI.value,
        supplierId: supI.value, items: valid, discount: Number(discI.value) || 0,
        status: o.status || 'open', note: noteI.value };
      if (isNew) PW.data.purchaseOrders.push(obj);
      else { const i = PW.data.purchaseOrders.findIndex(x => x.id === obj.id); PW.data.purchaseOrders[i] = obj; }
      PW.logActivity(isNew ? 'create' : 'update', 'purchaseOrder', obj.code, '');
      PW.save(); C.closeModal(); App.refresh(); U.toast('Đã lưu');
    }, 'primary')],
  });
};

M.convertToPurchase = function (o) {
  if (!U.confirm('Tạo phiếu nhập kho từ đơn mua ' + o.code + '?')) return;
  const pu = {
    id: PW.uid(), code: PW.nextCode('PN'), date: U.today(), supplierId: o.supplierId,
    items: o.items.map(it => ({ productId: it.productId, qty: Number(it.qty), cost: Number(it.cost) })),
    discount: Number(o.discount || 0), paid: 0, paidAccountId: null, note: 'Từ đơn mua hàng ' + o.code,
  };
  PW.data.purchases.push(pu);
  o.status = 'converted';
  PW.logActivity('create', 'purchase', pu.code, 'Từ ' + o.code);
  PW.save(); App.refresh(); U.toast('Đã tạo phiếu nhập ' + pu.code);
};

/* =====================================================================
   TRẢ LẠI HÀNG MUA
   ===================================================================== */
M.purchaseReturns = function (root) {
  const card = U.el('div', { class: 'card' });
  const toolbar = U.el('div', { class: 'toolbar' });
  toolbar.appendChild(U.el('div', { class: 'card-title', style: 'margin:0' }, '↪️ Phiếu trả lại hàng mua'));
  toolbar.appendChild(U.el('div', { class: 'spacer' }));
  toolbar.appendChild(C.btn('+ Lập phiếu trả lại', () => M.purchaseReturnForm(), 'primary'));
  card.appendChild(toolbar);
  const host = U.el('div');
  card.appendChild(host);
  root.appendChild(card);

  function draw() {
    const rows = PW.data.purchaseReturns.slice().sort((a, b) => (b.date + b.code).localeCompare(a.date + a.code));
    host.innerHTML = '';
    host.appendChild(C.table(rows, [
      { label: 'Ngày', render: r => U.date(r.date) },
      { label: 'Số phiếu', render: r => U.esc(r.code) },
      { label: 'Nhà cung cấp', render: r => { const s = PW.supplier(r.supplierId); return s ? U.esc(s.name) : ''; } },
      { label: 'Số mặt hàng', center: true, render: r => r.items.length },
      { label: 'Giá trị trả lại', num: true, render: r => `<span class="text-red">${U.money(PW.purchaseReturnTotal(r))}</span>` },
      { label: 'Lý do', render: r => U.esc(r.note || '') },
      { label: '', render: r => C.actions([
          { label: 'In', onClick: () => M.printPurchaseDoc('return', r) },
          { label: 'Sửa', onClick: () => M.purchaseReturnForm(r) },
          { label: 'Xóa', cls: 'danger', onClick: () => {
              if (U.confirm('Xóa phiếu ' + r.code + '?')) {
                PW.logActivity('delete', 'purchaseReturn', r.code, '');
                PW.data.purchaseReturns = PW.data.purchaseReturns.filter(x => x.id !== r.id);
                PW.save(); App.refresh(); U.toast('Đã xóa');
              }
            } },
        ]) },
    ], { empty: 'Chưa có phiếu trả lại hàng mua' }));
  }
  draw();
};

M.purchaseReturnForm = function (pr) {
  const isNew = !pr;
  pr = pr ? JSON.parse(JSON.stringify(pr)) : {
    code: PW.nextCode('TLM'), date: U.today(),
    supplierId: PW.data.suppliers[0] ? PW.data.suppliers[0].id : '',
    items: [], note: '',
  };
  const codeI = C.input({ value: pr.code });
  const dateI = C.input({ type: 'date', value: pr.date });
  const supI = C.select(PW.data.suppliers.map(s => ({ value: s.id, label: s.name })), pr.supplierId);
  const noteI = C.input({ value: pr.note || '' });
  const grand = U.el('span', { style: 'font-weight:700' });
  const editor = M.itemsEditor(pr.items.map(it => Object.assign({}, it)), {
    priceKey: 'cost', priceLabel: 'Đơn giá trả', productPriceKey: 'cost', showStock: true,
    onChange: () => { grand.textContent = U.money(editor.subtotal()) + ' đ'; },
  });
  grand.textContent = U.money(editor.subtotal()) + ' đ';

  const body = U.el('div', null, [
    U.el('div', { class: 'form-grid' }, [
      C.field('Số phiếu', codeI),
      C.field('Ngày', dateI, { required: true }),
      C.field('Trả lại nhà cung cấp', M.partnerAdd(supI, false), { required: true, full: true }),
    ]),
    U.el('div', { class: 'section-sub mt16', style: 'font-weight:600;color:#2c3a47' }, 'Hàng hóa trả lại nhà cung cấp'),
    editor.wrap,
    C.field('Lý do trả lại', noteI, { full: true }),
    U.el('div', { style: 'margin-top:12px;text-align:right' }, [U.el('span', { class: 'text-muted' }, 'TỔNG GIÁ TRỊ TRẢ LẠI: '), grand]),
    U.el('div', { class: 'section-sub', style: 'text-align:right' }, 'Hàng trả sẽ xuất khỏi kho và giảm công nợ phải trả nhà cung cấp.'),
  ]);

  C.modal({
    title: isNew ? 'Lập phiếu trả lại hàng mua' : 'Sửa phiếu trả lại', wide: true, body,
    footer: [C.btn('Hủy', C.closeModal), C.btn('Lưu', () => {
      const valid = editor.getValid();
      if (!valid.length) return U.toast('Thêm ít nhất 1 dòng hàng', 'error');
      if (!supI.value) return U.toast('Chọn nhà cung cấp', 'error');
      const obj = { id: pr.id || PW.uid(), code: codeI.value, date: dateI.value,
        supplierId: supI.value, items: valid, note: noteI.value };
      if (isNew) PW.data.purchaseReturns.push(obj);
      else { const i = PW.data.purchaseReturns.findIndex(x => x.id === obj.id); PW.data.purchaseReturns[i] = obj; }
      PW.logActivity(isNew ? 'create' : 'update', 'purchaseReturn', obj.code, '');
      PW.save(); C.closeModal(); App.refresh(); U.toast('Đã lưu phiếu trả lại');
    }, 'primary')],
  });
};

/* =====================================================================
   GIẢM GIÁ HÀNG MUA
   ===================================================================== */
M.purchaseDiscounts = function (root) {
  const card = U.el('div', { class: 'card' });
  const toolbar = U.el('div', { class: 'toolbar' });
  toolbar.appendChild(U.el('div', { class: 'card-title', style: 'margin:0' }, '🏷️ Giảm giá hàng mua'));
  toolbar.appendChild(U.el('div', { class: 'spacer' }));
  toolbar.appendChild(C.btn('+ Lập giảm giá', () => M.purchaseDiscountForm(), 'primary'));
  card.appendChild(toolbar);
  const host = U.el('div');
  card.appendChild(host);
  root.appendChild(card);

  function draw() {
    const rows = PW.data.purchaseDiscounts.slice().sort((a, b) => (b.date + b.code).localeCompare(a.date + a.code));
    host.innerHTML = '';
    host.appendChild(C.table(rows, [
      { label: 'Ngày', render: r => U.date(r.date) },
      { label: 'Số phiếu', render: r => U.esc(r.code) },
      { label: 'Nhà cung cấp', render: r => { const s = PW.supplier(r.supplierId); return s ? U.esc(s.name) : ''; } },
      { label: 'Số tiền giảm', num: true, render: r => `<span class="text-red">${U.money(r.amount)}</span>` },
      { label: 'Lý do', render: r => U.esc(r.reason || '') },
      { label: '', render: r => C.actions([
          { label: 'Sửa', onClick: () => M.purchaseDiscountForm(r) },
          { label: 'Xóa', cls: 'danger', onClick: () => {
              if (U.confirm('Xóa phiếu ' + r.code + '?')) {
                PW.logActivity('delete', 'purchaseDiscount', r.code, U.money(r.amount) + ' đ');
                PW.data.purchaseDiscounts = PW.data.purchaseDiscounts.filter(x => x.id !== r.id);
                PW.save(); App.refresh(); U.toast('Đã xóa');
              }
            } },
        ]) },
    ], { empty: 'Chưa có phiếu giảm giá hàng mua' }));
  }
  draw();
};

M.purchaseDiscountForm = function (g) {
  const isNew = !g;
  g = g || { code: PW.nextCode('GGM'), date: U.today(),
    supplierId: PW.data.suppliers[0] ? PW.data.suppliers[0].id : '', amount: 0, reason: '' };
  const f = {
    code: C.input({ value: g.code }),
    date: C.input({ type: 'date', value: g.date }),
    sup: C.select(PW.data.suppliers.map(s => ({ value: s.id, label: s.name })), g.supplierId),
    amount: C.input({ type: 'number', value: g.amount, min: 0 }),
    reason: C.input({ value: g.reason || '' }),
  };
  const body = U.el('div', { class: 'form-grid' }, [
    C.field('Số phiếu', f.code),
    C.field('Ngày', f.date, { required: true }),
    C.field('Nhà cung cấp', M.partnerAdd(f.sup, false), { required: true, full: true }),
    C.field('Số tiền giảm (đ)', f.amount, { required: true }),
    C.field('Lý do giảm giá', f.reason, { full: true }),
  ]);
  C.modal({
    title: isNew ? 'Lập giảm giá hàng mua' : 'Sửa giảm giá', body,
    footer: [C.btn('Hủy', C.closeModal), C.btn('Lưu', () => {
      const amt = Number(f.amount.value) || 0;
      if (amt <= 0) return U.toast('Nhập số tiền giảm', 'error');
      const obj = { id: g.id || PW.uid(), code: f.code.value, date: f.date.value,
        supplierId: f.sup.value, amount: amt, reason: f.reason.value };
      if (isNew) PW.data.purchaseDiscounts.push(obj);
      else Object.assign(g, obj);
      PW.logActivity(isNew ? 'create' : 'update', 'purchaseDiscount', obj.code, U.money(amt) + ' đ');
      PW.save(); C.closeModal(); App.refresh(); U.toast('Đã lưu giảm giá');
    }, 'primary')],
  });
};

/* ---------- In đơn mua hàng / phiếu trả lại hàng mua ---------- */
M.printPurchaseDoc = function (kind, doc) {
  const titles = { order: 'ĐƠN MUA HÀNG', return: 'PHIẾU TRẢ LẠI HÀNG MUA' };
  const sup = PW.supplier(doc.supplierId);
  const sub = doc.items.reduce((s, it) => s + Number(it.qty) * Number(it.cost), 0);
  const disc = Number(doc.discount || 0);
  const total = sub - disc;
  const rows = doc.items.map((it, i) => {
    const p = PW.product(it.productId);
    return `<tr><td style="text-align:center">${i + 1}</td><td>${U.esc(p ? p.name : '')}</td>
      <td style="text-align:center">${p ? U.esc(p.unit) : ''}</td>
      <td style="text-align:right">${U.num(it.qty)}</td>
      <td style="text-align:right">${U.money(it.cost)}</td>
      <td style="text-align:right">${U.money(Number(it.qty) * Number(it.cost))}</td></tr>`;
  }).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${doc.code}</title>
    <style>body{font-family:'Segoe UI',Arial;padding:30px;color:#222}
    .company{text-align:center;color:#1ea7a0;font-weight:700;font-size:18px}
    h2{text-align:center;margin:6px 0} table{width:100%;border-collapse:collapse;margin-top:16px}
    th,td{border:1px solid #999;padding:7px 9px;font-size:13px} th{background:#f0f0f0}
    .meta{margin-top:10px;font-size:14px;line-height:1.7} .tot{text-align:right;margin-top:10px;font-size:15px}
    .sign{display:flex;justify-content:space-around;margin-top:50px;text-align:center}</style></head><body>
    <div class="company">DALI — Tô điểm cuộc sống</div>
    <h2>${titles[kind]}</h2>
    <div style="text-align:center">Số: ${U.esc(doc.code)} &nbsp;|&nbsp; Ngày ${U.date(doc.date)}</div>
    <div class="meta"><div><b>Nhà cung cấp:</b> ${U.esc(sup ? sup.name : '')}</div>
      <div><b>Điện thoại:</b> ${U.esc(sup ? sup.phone : '')} &nbsp; <b>Địa chỉ:</b> ${U.esc(sup ? sup.address : '')}</div>
      ${doc.note ? `<div><b>Diễn giải:</b> ${U.esc(doc.note)}</div>` : ''}</div>
    <table><thead><tr><th>STT</th><th>Tên hàng hóa</th><th>ĐVT</th><th>SL</th><th>Đơn giá</th><th>Thành tiền</th></tr></thead>
    <tbody>${rows}</tbody></table>
    <div class="tot">Cộng tiền hàng: <b>${U.money(sub)} đ</b></div>
    ${disc ? `<div class="tot">Giảm giá: ${U.money(disc)} đ</div>` : ''}
    <div class="tot">TỔNG CỘNG: <b>${U.money(total)} đ</b></div>
    <div class="sign"><div>Nhà cung cấp<br/><i>(Ký, ghi rõ họ tên)</i></div><div>DALI<br/><i>(Ký, ghi rõ họ tên)</i></div></div>
    <script>window.onload=function(){window.print();}</script></body></html>`;
  const w = window.open('', '_blank');
  if (!w) return U.toast('Trình duyệt chặn cửa sổ in. Hãy cho phép pop-up.', 'error');
  w.document.write(html); w.document.close();
};
