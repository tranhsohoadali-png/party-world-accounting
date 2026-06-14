/* ============================================================
   modules2.js — Bán hàng & Mua hàng (chứng từ nhiều dòng)
   ============================================================ */

/* ---------- Tự lưu nháp form (B3) — chỉ localStorage, KHÔNG vào PW.data ----------
   Chống mất dữ liệu khi đóng nhầm/refresh. Mỗi loại form 1 key riêng. */
M.draft = {
  key: function (mode) { return 'PW_DRAFT_DOC_' + mode; },
  save: function (mode, obj) { try { localStorage.setItem(this.key(mode), JSON.stringify({ at: Date.now(), data: obj })); } catch (e) {} },
  load: function (mode) { try { return JSON.parse(localStorage.getItem(this.key(mode)) || 'null'); } catch (e) { return null; } },
  clear: function (mode) { try { localStorage.removeItem(this.key(mode)); } catch (e) {} },
  age: function (at) {
    const m = Math.round((Date.now() - (at || 0)) / 60000);
    if (m < 1) return 'vừa xong';
    if (m < 60) return m + ' phút trước';
    const h = Math.round(m / 60);
    return h < 24 ? h + ' giờ trước' : Math.round(h / 24) + ' ngày trước';
  },
};

/* =====================================================================
   BÁN HÀNG (Hóa đơn bán + công nợ phải thu)
   ===================================================================== */
M.sales = function (root) {
  const card = U.el('div', { class: 'card' });
  const host = U.el('div');
  const fb = M.filterBar({
    storageKey: 'sales',
    onChange: draw,
    fields: [
      { type: 'period', key: 'period', label: 'Kỳ', default: 'all', presets: ['today', 'thisWeek', 'thisMonth', 'lastMonth', 'thisQuarter', 'ytd', 'thisYear', 'all', 'custom'] },
      { type: 'select', key: 'customerId', label: 'Khách hàng', source: 'customers' },
      { type: 'select', key: 'channelId', label: 'Kênh bán', source: () => (PW.data.channels || []).map(c => ({ value: c.id, label: c.name })) },
      { type: 'select', key: 'paymentStatus', label: 'Thanh toán', options: [{ value: '', label: 'Tất cả' }, { value: 'no', label: 'Còn nợ' }, { value: 'paid', label: 'Đã thu đủ' }] },
      { type: 'amountRange', key: 'amount', label: 'Tổng tiền' },
      { type: 'search', key: 'q', placeholder: 'Tìm số HĐ / khách hàng...' },
    ],
    actions: [C.btn('+ Lập hóa đơn bán', () => M.salesForm(), 'primary')],
  });
  card.appendChild(fb.el);
  card.appendChild(host);
  root.appendChild(card);

  function draw() {
    const st = fb.getState();
    const rows = M.applyFilter(PW.data.salesInvoices, st, {
      date: si => si.date,
      customerId: si => si.customerId,
      channelId: si => si.channelId || '',
      amount: si => PW.invoiceTotal(si),
      paymentStatus: si => (PW.invoiceTotal(si) - (si.paid || 0) > 0 ? 'no' : 'paid'),
      text: si => { const c = PW.customer(si.customerId); return [si.code, c ? c.name : ''].join(' '); },
    }).sort((a, b) => (b.date + b.code).localeCompare(a.date + a.code));
    host.innerHTML = '';
    host.appendChild(C.table(rows, [
      { label: 'Ngày', render: si => U.date(si.date) },
      { label: 'Số HĐ', render: si => U.esc(si.code) },
      { label: 'Khách hàng', render: si => { const c = PW.customer(si.customerId); return c ? U.esc(c.name) : ''; } },
      { label: 'Số mặt hàng', center: true, render: si => si.items.length },
      { label: 'Tổng tiền', num: true, render: si => U.money(PW.invoiceTotal(si)) },
      { label: 'Đã thu', num: true, render: si => U.money(si.paid || 0) },
      { label: 'Còn nợ', num: true, render: si => {
          const d = PW.invoiceTotal(si) - (si.paid || 0);
          return d > 0 ? `<span class="text-red">${U.money(d)}</span>` : '<span class="tag green">Đã thu đủ</span>';
        } },
      { label: '', render: si => C.actions([
          { label: 'Sửa', onClick: () => M.salesForm(si) },
          { label: 'Sao chép', title: 'Tạo hóa đơn mới từ hóa đơn này', onClick: () => M.docCopy(si, 'sale') },
          { label: '🖨 In', cls: 'primary', title: 'In phiếu xuất kho / hóa đơn / phiếu giao hàng', onClick: () => M.printMenu(si) },
          { label: 'Xóa', cls: 'danger', onClick: () => {
              if (U.confirm('Xóa hóa đơn ' + si.code + '?')) {
                PW.logActivity('delete', 'salesInvoice', si.code, U.money(PW.invoiceTotal(si)) + ' đ');
                PW.data.salesInvoices = PW.data.salesInvoices.filter(x => x.id !== si.id);
                PW.save(); App.refresh(); U.toast('Đã xóa');
              }
            } },
        ]) },
    ], { empty: 'Chưa có hóa đơn bán hàng phù hợp bộ lọc' }));
  }
  draw();
};

/* Sao chép chứng từ -> mở form MỚI đã điền sẵn dòng hàng (số/ngày/đã trả làm mới) */
M.docCopy = function (src, kind) {
  const c = JSON.parse(JSON.stringify(src));
  delete c.id;                                   // không id => form coi là chứng từ mới
  c.code = PW.nextCode(kind === 'sale' ? 'HD' : 'PN');
  c.date = U.today();
  c.dueDate = null;
  c.paid = 0;
  c.paidAccountId = null;
  // Bỏ mọi dấu vết riêng của chứng từ gốc (đối soát sàn, nguồn, đóng gói, thuế...)
  ['reconciled', 'settledAmount', 'reconciledDate', 'sourceType', 'sourceId', 'sourceCode',
   'packed', 'packedAt', 'orderStatus', 'trackingCode', 'taxInvoice', 'taxRecordId'].forEach(k => delete c[k]);
  if (kind === 'sale') M.salesForm(c); else M.purchaseForm(c);
  U.toast('Đã sao chép — kiểm tra rồi bấm Lưu để tạo chứng từ mới');
};

M.salesForm = function (si, presetCustomerId) {
  const isNew = !si || !si.id;   // không có id => chứng từ mới (kể cả khi sao chép có sẵn dữ liệu)
  const isCopy = !!(si && !si.id);   // sao chép: bỏ qua khôi phục/tự lưu nháp
  si = si ? JSON.parse(JSON.stringify(si)) : {
    code: PW.nextCode('HD'), date: U.today(),
    customerId: presetCustomerId || (PW.data.customers[0] ? PW.data.customers[0].id : ''),
    items: [], discount: 0, paid: 0, paidAccountId: PW.data.cashAccounts[0].id, note: '',
  };
  M.docForm({
    mode: 'sale', doc: si, isNew, skipDraft: isCopy,
    title: isNew ? 'Lập hóa đơn bán hàng' : 'Sửa hóa đơn bán',
    partnerLabel: 'Khách hàng',
    partners: PW.data.customers,
    partnerKey: 'customerId',
    priceKey: 'price',
    onSave: (obj) => {
      if (isNew) PW.data.salesInvoices.push(obj);
      else { const idx = PW.data.salesInvoices.findIndex(x => x.id === obj.id); PW.data.salesInvoices[idx] = obj; }
    },
  });
};

/* =====================================================================
   MUA HÀNG (Phiếu nhập + công nợ phải trả)
   ===================================================================== */
M.purchases = function (root) {
  const card = U.el('div', { class: 'card' });
  const host = U.el('div');
  const fb = M.filterBar({
    storageKey: 'purchases',
    onChange: draw,
    fields: [
      { type: 'period', key: 'period', label: 'Kỳ', default: 'all', presets: ['today', 'thisWeek', 'thisMonth', 'lastMonth', 'thisQuarter', 'ytd', 'thisYear', 'all', 'custom'] },
      { type: 'select', key: 'supplierId', label: 'Nhà cung cấp', source: 'suppliers' },
      { type: 'select', key: 'paymentStatus', label: 'Thanh toán', options: [{ value: '', label: 'Tất cả' }, { value: 'no', label: 'Còn nợ' }, { value: 'paid', label: 'Đã trả đủ' }] },
      { type: 'amountRange', key: 'amount', label: 'Tổng tiền' },
      { type: 'search', key: 'q', placeholder: 'Tìm số phiếu / NCC...' },
    ],
    actions: [C.btn('+ Lập phiếu nhập mua', () => M.purchaseForm(), 'primary')],
  });
  card.appendChild(fb.el);
  card.appendChild(host);
  root.appendChild(card);

  function draw() {
    const st = fb.getState();
    const rows = M.applyFilter(PW.data.purchases, st, {
      date: pu => pu.date,
      supplierId: pu => pu.supplierId,
      amount: pu => PW.purchaseTotal(pu),
      paymentStatus: pu => (PW.purchaseTotal(pu) - (pu.paid || 0) > 0 ? 'no' : 'paid'),
      text: pu => { const s = PW.supplier(pu.supplierId); return [pu.code, s ? s.name : ''].join(' '); },
    }).sort((a, b) => (b.date + b.code).localeCompare(a.date + a.code));
    host.innerHTML = '';
    host.appendChild(C.table(rows, [
      { label: 'Ngày', render: pu => U.date(pu.date) },
      { label: 'Số phiếu', render: pu => U.esc(pu.code) },
      { label: 'Nhà cung cấp', render: pu => { const s = PW.supplier(pu.supplierId); return s ? U.esc(s.name) : ''; } },
      { label: 'Số mặt hàng', center: true, render: pu => pu.items.length },
      { label: 'Tổng tiền', num: true, render: pu => U.money(PW.purchaseTotal(pu)) },
      { label: 'Đã trả', num: true, render: pu => U.money(pu.paid || 0) },
      { label: 'Còn nợ', num: true, render: pu => {
          const d = PW.purchaseTotal(pu) - (pu.paid || 0);
          return d > 0 ? `<span class="text-red">${U.money(d)}</span>` : '<span class="tag green">Đã trả đủ</span>';
        } },
      { label: '', render: pu => C.actions([
          { label: 'Sửa', onClick: () => M.purchaseForm(pu) },
          { label: 'Sao chép', title: 'Tạo phiếu nhập mới từ phiếu này', onClick: () => M.docCopy(pu, 'purchase') },
          { label: 'In', onClick: () => M.printDoc('purchase', pu) },
          { label: 'Xóa', cls: 'danger', onClick: () => {
              if (U.confirm('Xóa phiếu nhập ' + pu.code + '?')) {
                PW.logActivity('delete', 'purchase', pu.code, U.money(PW.purchaseTotal(pu)) + ' đ');
                PW.data.purchases = PW.data.purchases.filter(x => x.id !== pu.id);
                PW.save(); App.refresh(); U.toast('Đã xóa');
              }
            } },
        ]) },
    ], { empty: 'Chưa có phiếu nhập mua phù hợp bộ lọc' }));
  }
  draw();
};

M.purchaseForm = function (pu, presetSupplierId) {
  const isNew = !pu || !pu.id;   // không có id => phiếu mới (kể cả khi sao chép có sẵn dữ liệu)
  const isCopy = !!(pu && !pu.id);   // sao chép: bỏ qua khôi phục/tự lưu nháp
  pu = pu ? JSON.parse(JSON.stringify(pu)) : {
    code: PW.nextCode('PN'), date: U.today(),
    supplierId: presetSupplierId || (PW.data.suppliers[0] ? PW.data.suppliers[0].id : ''),
    items: [], discount: 0, paid: 0, paidAccountId: PW.data.cashAccounts[0].id, note: '',
  };
  M.docForm({
    mode: 'purchase', doc: pu, isNew, skipDraft: isCopy,
    title: isNew ? 'Lập phiếu nhập mua hàng' : 'Sửa phiếu nhập',
    partnerLabel: 'Nhà cung cấp',
    partners: PW.data.suppliers,
    partnerKey: 'supplierId',
    priceKey: 'cost',
    onSave: (obj) => {
      if (isNew) PW.data.purchases.push(obj);
      else { const idx = PW.data.purchases.findIndex(x => x.id === obj.id); PW.data.purchases[idx] = obj; }
    },
  });
};

/* =====================================================================
   FORM CHỨNG TỪ NHIỀU DÒNG (dùng chung cho Bán & Mua)
   ===================================================================== */
/* ---------- Thêm nhanh ngay trong form (khỏi ra trang danh mục) ---------- */
M.rebuildSelect = function (sel, options, value) {
  sel.innerHTML = '';
  options.forEach(o => {
    const op = U.el('option', { value: o.value }, o.label);
    if (String(o.value) === String(value)) op.selected = true;
    sel.appendChild(op);
  });
};
// Bọc 1 <select> + nút "+" bên cạnh
M.withAdd = function (inputEl, title, onClick) {
  inputEl.style.flex = '1';
  const b = C.btn('+', onClick, 'sm primary'); b.title = title; b.style.flexShrink = '0';
  return U.el('div', { style: 'display:flex;gap:6px;align-items:stretch' }, [inputEl, b]);
};
// Bọc 1 <select> đối tác + nút "+" thêm nhanh KH/NCC (giữ option đầu nếu có)
M.partnerAdd = function (sel, isCustomer, leadOpts) {
  return M.withAdd(sel, 'Thêm nhanh ' + (isCustomer ? 'khách hàng' : 'nhà cung cấp'), function () {
    M.quickAddPartner(isCustomer, function (np) {
      const list = isCustomer ? PW.data.customers : PW.data.suppliers;
      M.rebuildSelect(sel, (leadOpts || []).concat(list.map(function (x) { return { value: x.id, label: x.name }; })), np.id);
      sel.dispatchEvent(new Event('change'));
    });
  });
};
// "Thêm nhanh" = nút tắt mở FORM ĐẦY ĐỦ (Tổ chức/Cá nhân + các tab) dạng cửa sổ chồng,
// lưu xong tự chọn lại vào ô đang gọi (không cắt bớt chi tiết).
M.quickAddPartner = function (isSale, onAdded) {
  M.partnerForm(isSale ? 'customer' : 'supplier', null, { onSaved: onAdded });
};
M.quickAddEmployee = function (onAdded) {
  const nameI = C.input({ style: 'width:100%' });
  const phoneI = C.input({ style: 'width:100%' });
  C.miniModal({
    title: 'Thêm nhanh nhân viên',
    body: U.el('div', { class: 'form-grid' }, [C.field('Họ tên *', nameI, { full: true }), C.field('Điện thoại', phoneI)]),
    footer: [C.btn('Lưu & chọn', () => {
      const nm = nameI.value.trim();
      if (!nm) return U.toast('Nhập tên', 'error');
      const obj = { id: PW.uid(), code: PW.nextCode('NV'), name: nm, phone: phoneI.value.trim() };
      PW.data.employees.push(obj); PW.save(); C.closeMini(); onAdded(obj); U.toast('Đã thêm nhân viên');
    }, 'primary')],
  });
  setTimeout(() => nameI.focus(), 50);
};
// Tính chất hàng hóa (như MISA) — quyết định nhóm VTHH mặc định + cờ kind
M.PRODUCT_KINDS = [
  { kind: 'hanghoa', label: 'Hàng hóa', desc: 'Sản phẩm mua về bán lại cho khách', icon: 'box', group: 'Hàng hóa', prefix: 'HH' },
  { kind: 'dichvu', label: 'Dịch vụ', desc: 'Dịch vụ cung cấp cho khách (không theo dõi tồn kho)', icon: 'wand', group: 'Dịch vụ', prefix: 'DV' },
  { kind: 'nvl', label: 'Nguyên vật liệu', desc: 'Nguyên liệu đầu vào cho sản xuất', icon: 'package', group: 'Vật tư', prefix: 'VT' },
  { kind: 'thanhpham', label: 'Thành phẩm', desc: 'Sản phẩm đầu ra của quá trình sản xuất', icon: 'factory', group: 'Thành phẩm', prefix: 'TP' },
  { kind: 'ccdc', label: 'Công cụ dụng cụ', desc: 'Công cụ, dụng cụ dùng trong vận hành', icon: 'settings', group: 'Công cụ dụng cụ', prefix: 'CC' },
  { kind: 'combo', label: 'Combo sản phẩm', desc: 'Nhiều hàng hóa bán theo combo', icon: 'grid', group: 'Combo', prefix: 'CB' },
];

// Bước 1: chọn tính chất hàng hóa
M.productTypeChooser = function (onPick) {
  const list = U.el('div', { class: 'kind-list' });
  M.PRODUCT_KINDS.forEach(k => {
    const row = U.el('div', { class: 'kind-row' }, [
      U.el('span', { class: 'kind-ic', html: U.icon(k.icon) }),
      U.el('div', null, [U.el('div', { class: 'kind-title' }, k.label), U.el('div', { class: 'kind-desc' }, k.desc)]),
    ]);
    row.addEventListener('click', () => { C.closeMini(); onPick(k); });
    list.appendChild(row);
  });
  C.miniModal({ title: 'Chọn tính chất hàng hóa / dịch vụ', body: list });
};

// "Thêm hàng hóa mới" = nút tắt mở FORM ĐẦY ĐỦ (chọn Tính chất ngay trong form + đủ tab/giá kênh/BOM/combo)
// dạng cửa sổ chồng, lưu xong tự chọn lại vào ô đang gọi.
M.quickAddProduct = function (isSale, onAdded) {
  M.productForm(null, { onSaved: onAdded });
};

M._quickAddProductForm = function (isSale, kindObj, onAdded) {
  const codeP = C.input({ value: PW.nextCode(kindObj.prefix || 'HH'), style: 'width:100%' });
  const nameI = C.input({ style: 'width:100%' });
  const groupI = C.input({ value: kindObj.group, list: 'dl-qa-groups', style: 'width:100%' });
  const unitI = C.input({ value: kindObj.kind === 'dichvu' ? 'Lần' : 'Cái', style: 'width:100%' });
  const priceI = C.input({ type: 'number', value: 0, style: 'width:100%' });
  const costI = C.input({ type: 'number', value: 0, style: 'width:100%' });
  const isNVL = kindObj.kind === 'nvl';
  const head = U.el('div', { class: 'qa-kind' }, [
    U.el('span', { class: 'kind-ic sm', html: U.icon(kindObj.icon) }),
    U.el('b', null, 'Tính chất: ' + kindObj.label),
    U.el('a', { href: '#', style: 'margin-left:8px', onclick: e => { e.preventDefault(); C.closeMini(); M.quickAddProduct(isSale, onAdded); } }, 'Đổi tính chất'),
  ]);
  // Thành phần combo (chỉ khi tính chất = combo)
  const comboComps = [];
  const comboBody = U.el('tbody');
  function drawCombo() {
    comboBody.innerHTML = '';
    comboComps.forEach((c, idx) => {
      const pk = M.productPicker(c.productId, (pp) => { c.productId = pp.id; drawCombo(); }, { isSale: true });
      const q = U.el('input', { type: 'number', value: c.qty, min: 0, step: 'any', style: 'text-align:right' });
      q.addEventListener('input', () => { c.qty = Number(q.value) || 0; });
      comboBody.appendChild(U.el('tr', null, [U.el('td', null, pk), U.el('td', { style: 'width:110px' }, q),
        U.el('td', { class: 'center', style: 'width:36px' }, U.el('button', { class: 'btn sm danger', onclick: () => { comboComps.splice(idx, 1); drawCombo(); } }, '×'))]));
    });
  }
  let comboSection = null;
  if (kindObj.kind === 'combo') {
    const t = U.el('table', { class: 'items-tbl' });
    t.appendChild(U.el('thead', null, U.el('tr', null, [U.el('th', null, 'Hàng thành phần'), U.el('th', null, 'SL /1 combo'), U.el('th', null, '')])));
    t.appendChild(comboBody);
    comboSection = U.el('div', { class: 'mt8' }, [
      U.el('div', { class: 'section-sub', style: 'font-weight:600' }, 'Thành phần combo (bán combo sẽ trừ kho từng món)'),
      U.el('div', { class: 'table-wrap' }, t),
      U.el('div', { class: 'mt8' }, C.btn('+ Thêm thành phần', () => { comboComps.push({ productId: '', qty: 1 }); drawCombo(); }, 'sm')),
    ]);
    comboComps.push({ productId: '', qty: 1 }); drawCombo();
  }
  const gridFields = [
    C.field('Tên hàng *', nameI, { full: true }),
    C.field('Mã hàng', codeP), C.field('Nhóm (VTHH)', groupI),
    C.field('Đơn vị tính', unitI),
  ];
  if (!isNVL) gridFields.push(C.field('Giá bán', priceI), C.field('Giá vốn', costI));
  const body = U.el('div', null, [
    head,
    U.el('div', { class: 'form-grid' }, gridFields),
    isNVL ? U.el('div', { class: 'section-sub', style: 'margin:-4px 0 4px' }, '💡 Giá vốn NVL không cần nhập — báo cáo tự lấy giá mua bình quân theo kỳ.') : null,
    M.datalist('dl-qa-groups', PW.data.productGroups.map(g => g.name)),
    comboSection,
  ]);
  C.miniModal({
    title: 'Thêm ' + kindObj.label.toLowerCase(),
    body: body,
    footer: [C.btn('Lưu & chọn', () => {
      const nm = nameI.value.trim();
      if (!nm) return U.toast('Nhập tên hàng', 'error');
      const obj = { id: PW.uid(), code: codeP.value.trim() || PW.nextCode('HH'), name: nm,
        unit: unitI.value.trim() || 'Cái', group: groupI.value.trim(), kind: kindObj.kind,
        price: Number(priceI.value) || 0, cost: Number(costI.value) || 0, openingStock: 0 };
      if (kindObj.kind === 'combo') obj.components = comboComps.filter(c => c.productId && Number(c.qty) > 0).map(c => ({ productId: c.productId, qty: Number(c.qty) }));
      PW.data.products.push(obj); PW.save(); C.closeMini(); onAdded(obj); U.toast('Đã thêm ' + kindObj.label.toLowerCase());
    }, 'primary')],
  });
  setTimeout(() => nameI.focus(), 50);
};
M.quickAddTerm = function (onAdded) {
  const nameI = C.input({ style: 'width:100%', placeholder: 'VD: Thanh toán sau 30 ngày' });
  const daysI = C.input({ type: 'number', value: 30, style: 'width:100%' });
  C.miniModal({
    title: 'Thêm nhanh điều khoản thanh toán',
    body: U.el('div', { class: 'form-grid' }, [C.field('Tên *', nameI, { full: true }), C.field('Số ngày được nợ', daysI)]),
    footer: [C.btn('Lưu & chọn', () => {
      const nm = nameI.value.trim();
      if (!nm) return U.toast('Nhập tên', 'error');
      const obj = { id: PW.uid(), name: nm, days: Number(daysI.value) || 0 };
      PW.data.paymentTerms.push(obj); PW.save(); C.closeMini(); onAdded(obj); U.toast('Đã thêm điều khoản');
    }, 'primary')],
  });
  setTimeout(() => nameI.focus(), 50);
};

/* ---------- Bộ chọn hàng hóa có tìm kiếm + cột Mã/Tên/Tồn/Giá (kiểu MISA) ----------
   Dùng thay <select> khi danh mục nhiều SKU. onPick(product) khi chọn.
   opts: { isSale } -> cột giá hiển thị giá bán (sale) hoặc giá vốn (mua). */
M.productPicker = function (initialId, onPick, opts) {
  opts = opts || {};
  const isSale = opts.isSale !== false;
  const norm = s => (M._ciNorm ? M._ciNorm(s) : String(s || '').toLowerCase());
  const wrap = U.el('div', { class: 'pp-wrap' });
  const btn = U.el('button', { type: 'button', class: 'inp pp-btn' });
  let selId = initialId || '';
  let panel = null, firstP = null;
  function lbl() { const p = PW.product(selId); return p ? ((p.code ? p.code + ' - ' : '') + p.name) : '-- Chọn hàng --'; }
  function refresh() { btn.textContent = lbl(); btn.classList.toggle('pp-empty', !selId); }
  refresh();

  function position() { if (!panel) return; const r = btn.getBoundingClientRect();
    // Trên điện thoại: panel rộng tối đa = vừa màn hình (chừa 16px lề), không tràn ngang
    const w = Math.min(Math.max(r.width, 450), window.innerWidth - 16);
    panel.style.width = w + 'px';
    panel.style.left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8)) + 'px';
    panel.style.top = (r.bottom + 2) + 'px'; }
  function close() { if (!panel) return; panel.remove(); panel = null;
    document.removeEventListener('mousedown', onDoc, true); window.removeEventListener('scroll', position, true); window.removeEventListener('resize', position); }
  function onDoc(e) { if (panel && !panel.contains(e.target) && e.target !== btn) close(); }

  function open() {
    if (panel) { close(); return; }
    const search = U.el('input', { class: 'inp', placeholder: 'Gõ mã / tên hàng để tìm...' });
    const onlyChk = U.el('input', { type: 'checkbox' });
    const list = U.el('div', { class: 'pp-list' });
    const head = U.el('div', { class: 'pp-head' }, [
      U.el('span', null, 'Mã hàng'), U.el('span', null, 'Tên hàng'),
      U.el('span', { style: 'text-align:right' }, 'Tồn'), U.el('span', { style: 'text-align:right' }, isSale ? 'Giá bán' : 'Giá nhập'),
    ]);
    const top = U.el('div', { class: 'pp-top' }, [search, U.el('label', { class: 'pp-only' }, [onlyChk, 'Chỉ hàng còn tồn'])]);
    const addBtn = U.el('button', { type: 'button' }, '+ Thêm hàng hóa mới');
    addBtn.addEventListener('click', () => { close(); M.quickAddProduct(isSale, np => { selId = np.id; refresh(); onPick(np); }); });
    const foot = U.el('div', { class: 'pp-foot' }, addBtn);
    panel = U.el('div', { class: 'pp-panel' }, [top, head, list, foot]);
    document.body.appendChild(panel); position();

    function render() {
      const q = norm(search.value); const only = onlyChk.checked;
      list.innerHTML = ''; firstP = null;
      const rows = PW.data.products.filter(p => {
        if (only && PW.stockOf(p.id) <= 0) return false;
        return !q || norm((p.code || '') + ' ' + p.name).indexOf(q) >= 0;
      }).slice(0, 300);
      if (!rows.length) { list.appendChild(U.el('div', { class: 'pp-empty-row' }, 'Không tìm thấy — bấm "+ Thêm hàng hóa mới" bên dưới')); return; }
      firstP = rows[0];
      rows.forEach((p, i) => {
        const st = PW.stockOf(p.id);
        const row = U.el('div', { class: 'pp-row' + (i === 0 ? ' pp-active' : '') }, [
          U.el('span', { class: 'pp-code' }, p.code || ''),
          U.el('span', { class: 'pp-name', title: p.name }, p.name),
          U.el('span', { class: 'pp-stock' + (st <= 0 ? ' text-red' : '') }, U.num(st)),
          U.el('span', { class: 'pp-price' }, U.money(isSale ? p.price : (p.cost || 0))),
        ]);
        row.addEventListener('mousedown', e => { e.preventDefault(); selId = p.id; refresh(); close(); onPick(p); });
        list.appendChild(row);
      });
    }
    search.addEventListener('input', render);
    search.addEventListener('keydown', e => {
      if (e.key === 'Escape') { close(); btn.focus(); }
      else if (e.key === 'Enter') { e.preventDefault(); if (firstP) { selId = firstP.id; refresh(); close(); onPick(firstP); } }
    });
    document.addEventListener('mousedown', onDoc, true);
    window.addEventListener('scroll', position, true);
    window.addEventListener('resize', position);
    render(); search.focus();
  }
  btn.addEventListener('click', open);
  wrap.appendChild(btn);
  wrap.ppValue = () => selId;
  return wrap;
};

M.docForm = function (cfg) {
  const { mode, doc, isNew, title, partnerLabel, partners, partnerKey, priceKey, onSave } = cfg;
  const isSale = mode === 'sale';
  const unitField = isSale ? 'price' : 'cost'; // tên field giá trong item

  // (B3) Khôi phục bản nháp chưa lưu — chỉ với chứng từ MỚI thật (không phải sao chép)
  if (isNew && !cfg.skipDraft) {
    const dr = M.draft.load(mode);
    const drDirty = dr && dr.data && ((dr.data.items || []).some(it => it.productId) || (dr.data.note && dr.data.note.trim()));
    if (drDirty) {
      if (U.confirm('Có bản nhập ' + (isSale ? 'hóa đơn bán' : 'phiếu nhập') + ' chưa lưu (' + M.draft.age(dr.at) + ').\nKhôi phục để nhập tiếp?')) {
        Object.assign(doc, dr.data);
        if (dr.data.items && dr.data.items.length) doc.items = dr.data.items;
      } else { M.draft.clear(mode); }
    }
  }

  // (B3) Chụp trạng thái form -> object để lưu nháp (hoisted, chỉ gọi sau khi render)
  function _draftSnapshot() {
    return {
      code: codeI.value, date: dateI.value, dueDate: dueI.value || null,
      [partnerKey]: partnerI.value,
      employeeId: empSel ? (empSel.value || null) : undefined,
      channelId: channelSel ? (channelSel.value || null) : undefined,
      platformFee: platformFeeI ? (Number(platformFeeI.value) || 0) : undefined,
      shippingFee: shippingFeeI ? (Number(shippingFeeI.value) || 0) : undefined,
      vatRate: Number(vatRateI.value) || 0, discount: Number(discountI.value) || 0,
      paid: Number(paidI.value) || 0, paidAccountId: paidAccI.value, note: noteI.value,
      items: items.map(it => ({ productId: it.productId, qty: it.qty, [unitField]: it[unitField] })),
    };
  }
  let _draftTimer = null;
  function scheduleDraft() {
    if (!isNew || cfg.skipDraft) return;
    clearTimeout(_draftTimer);
    _draftTimer = setTimeout(function () {
      const s = _draftSnapshot();
      // chỉ lưu nháp khi "đáng" (cùng điều kiện với lúc hỏi khôi phục): có dòng hàng hoặc diễn giải
      if ((s.items || []).some(it => it.productId) || (s.note && s.note.trim()))
        M.draft.save(mode, s);
    }, 800);
  }

  // Header fields
  const codeI = C.input({ value: doc.code });
  const dateI = C.input({ type: 'date', value: doc.date });
  const dueI = C.input({ type: 'date', value: doc.dueDate || '' });
  const termSel = C.select(
    [{ value: '', label: '-- Chọn điều khoản --' }].concat(PW.data.paymentTerms.map(t => ({ value: t.days, label: t.name }))), '');
  termSel.addEventListener('change', () => {
    if (termSel.value !== '') dueI.value = U.addDays(dateI.value, Number(termSel.value));
  });
  const partnerI = C.select(partners.map(p => ({ value: p.id, label: p.name })), doc[partnerKey]);
  // Tự áp dụng điều khoản thanh toán mặc định của đối tượng
  function applyPartnerTerm() {
    const p = partners.find(x => x.id === partnerI.value);
    if (p && p.paymentTermId) {
      const t = PW.data.paymentTerms.find(x => x.id === p.paymentTermId);
      if (t) { termSel.value = String(t.days); dueI.value = U.addDays(dateI.value, t.days); }
    }
  }
  partnerI.addEventListener('change', applyPartnerTerm);
  if (isNew && !doc.dueDate) applyPartnerTerm();
  // Nhân viên bán (chỉ cho hóa đơn bán)
  const empSel = isSale ? C.select(
    [{ value: '', label: '-- Chọn nhân viên --' }].concat(PW.data.employees.map(e => ({ value: e.id, label: e.name }))),
    doc.employeeId || '') : null;
  // Kênh bán + phí sàn (chỉ hóa đơn bán)
  const channelSel = isSale ? C.select(
    [{ value: '', label: '-- Chọn kênh --' }].concat((PW.data.channels || []).map(c => ({ value: c.id, label: c.name }))),
    doc.channelId || '') : null;
  const platformFeeI = isSale ? C.input({ type: 'number', value: doc.platformFee || 0, min: 0, style: 'width:140px;text-align:right' }) : null;
  const shippingFeeI = isSale ? C.input({ type: 'number', value: doc.shippingFee || 0, min: 0, style: 'width:140px;text-align:right' }) : null;
  const netCell = isSale ? U.el('span', { style: 'font-weight:700;color:var(--teal-d)' }) : null;
  function curChannel() { return channelSel ? channelSel.value : null; }
  function suggestFee() {
    const c = PW.channel(curChannel());
    let sub = 0; items.forEach(it => sub += (Number(it.qty) || 0) * (Number(it[unitField]) || 0));
    const grand = sub - (Number(discountI.value) || 0);
    if (c && Number(c.feePercent) > 0) platformFeeI.value = Math.round(grand * Number(c.feePercent) / 100);
  }
  if (channelSel) channelSel.addEventListener('change', () => {
    items.forEach(it => { const p = PW.product(it.productId); if (p) it[unitField] = PW.channelPrice(p, curChannel()); });
    suggestFee(); drawItems(); calc();
  });
  // Thuế GTGT (cả bán & mua)
  const vatRateI = C.select([{ value: 0, label: '0%' }, { value: 5, label: '5%' }, { value: 8, label: '8%' }, { value: 10, label: '10%' }], doc.vatRate || 0);
  const vatCell = U.el('span');
  vatRateI.addEventListener('change', calc);
  const noteI = C.input({ value: doc.note || '' });

  // Items
  let items = doc.items.map(it => Object.assign({}, it));
  if (!items.length) items.push({ productId: '', qty: 1, [unitField]: 0 });

  const itemsBody = U.el('tbody');
  const totalCell = U.el('span');
  const discountI = C.input({ type: 'number', value: doc.discount || 0, min: 0, style: 'width:140px;text-align:right' });
  const paidI = C.input({ type: 'number', value: doc.paid || 0, min: 0, style: 'width:140px;text-align:right' });
  const paidAccI = C.select(PW.data.cashAccounts.map(a => ({ value: a.id, label: a.name })), doc.paidAccountId || PW.data.cashAccounts[0].id);
  const grandCell = U.el('span', { style: 'font-weight:700' });
  const remainCell = U.el('span', { style: 'font-weight:700' });

  function calc() {
    let sub = 0;
    items.forEach(it => { sub += (Number(it.qty) || 0) * (Number(it[unitField]) || 0); });
    const disc = Number(discountI.value) || 0;
    const grand = sub - disc;
    const paid = Number(paidI.value) || 0;
    totalCell.textContent = U.money(sub);
    grandCell.textContent = U.money(grand) + ' đ';
    remainCell.textContent = U.money(grand - paid) + ' đ';
    remainCell.className = (grand - paid) > 0 ? 'text-red' : 'text-green';
    if (isSale && netCell) {
      const fees = (Number(platformFeeI.value) || 0) + (Number(shippingFeeI.value) || 0);
      netCell.textContent = U.money(grand - fees) + ' đ';
    }
    const vat = Math.round(grand * (Number(vatRateI.value) || 0) / 100);
    vatCell.textContent = U.money(vat) + ' đ';
  }

  function drawItems() {
    itemsBody.innerHTML = '';
    items.forEach((it, idx) => {
      const prodSel = M.productPicker(it.productId, (p) => {
        it.productId = p.id;
        it[unitField] = isSale ? PW.channelPrice(p, curChannel()) : (p[priceKey] || 0);
        drawItems(); calc(); scheduleDraft();
      }, { isSale: isSale });
      const qtyI = U.el('input', { type: 'number', value: it.qty, min: 0, style: 'text-align:right' });
      qtyI.addEventListener('input', () => { it.qty = Number(qtyI.value) || 0; updateLine(); });
      const priceI = U.el('input', { type: 'number', value: it[unitField], min: 0, style: 'text-align:right' });
      priceI.addEventListener('input', () => { it[unitField] = Number(priceI.value) || 0; updateLine(); });
      // Thành tiền nhập được: gõ thành tiền -> tự chia ra đơn giá = thành tiền / SL
      const lineTotal = U.el('input', { type: 'number', value: Math.round((Number(it.qty) || 0) * (Number(it[unitField]) || 0)), min: 0, style: 'text-align:right' });
      function updateLine() { lineTotal.value = Math.round((Number(it.qty) || 0) * (Number(it[unitField]) || 0)); calc(); }
      lineTotal.addEventListener('input', () => {
        const tt = Number(lineTotal.value) || 0, q = Number(it.qty) || 0;
        if (q > 0) { it[unitField] = Math.round(tt / q * 100) / 100; priceI.value = it[unitField]; }
        calc(); scheduleDraft();
      });
      const p = PW.product(it.productId);
      const stockInfo = isSale && p ? U.el('div', { style: 'font-size:11px;color:#7b8794;margin-top:2px' }, 'Tồn: ' + U.num(PW.stockOf(p.id))) : null;

      const tr = U.el('tr', null, [
        U.el('td', { class: 'center' }, String(idx + 1)),
        U.el('td', null, [prodSel, stockInfo].filter(Boolean)),
        U.el('td', { style: 'width:90px' }, qtyI),
        U.el('td', { style: 'width:130px' }, priceI),
        U.el('td', { class: 'num', style: 'width:130px' }, lineTotal),
        U.el('td', { class: 'center', style: 'width:40px' },
          U.el('button', { class: 'btn sm danger', onclick: () => { items.splice(idx, 1); if (!items.length) items.push({ productId: '', qty: 1, [unitField]: 0 }); drawItems(); calc(); scheduleDraft(); } }, '×')),
      ]);
      itemsBody.appendChild(tr);
    });
  }

  const itemsTable = U.el('table', { class: 'items-tbl' });
  itemsTable.appendChild(U.el('thead', null, U.el('tr', null, [
    U.el('th', { style: 'width:36px' }, '#'),
    U.el('th', null, 'Hàng hóa'),
    U.el('th', null, 'SL'),
    U.el('th', null, isSale ? 'Đơn giá bán' : 'Đơn giá nhập'),
    U.el('th', { class: 'num' }, 'Thành tiền'),
    U.el('th', null, ''),
  ])));
  itemsTable.appendChild(itemsBody);

  discountI.addEventListener('input', calc);
  paidI.addEventListener('input', calc);
  if (platformFeeI) platformFeeI.addEventListener('input', calc);
  if (shippingFeeI) shippingFeeI.addEventListener('input', calc);

  // (B1) Dán nhiều dòng từ Excel/Google Sheets vào bảng hàng
  function _pasteTabular(text) { return text.indexOf('\t') >= 0 || text.split(/\r?\n/).filter(l => l.trim()).length >= 2; }
  function _applyPastedRows(rows) {
    const chosen = rows.filter(r => r.use && r.productId);
    if (!chosen.length) { U.toast('Chưa chọn dòng hàng nào để thêm', 'error'); return false; }
    if (items.length === 1 && !items[0].productId) items.length = 0;   // bỏ dòng trống mặc định
    chosen.forEach(r => {
      const p = PW.product(r.productId);
      let price = Number(r.price) || 0;
      if (!price && p) price = isSale ? PW.channelPrice(p, curChannel()) : (p[priceKey] || 0);
      items.push({ productId: r.productId, qty: Number(r.qty) || 1, [unitField]: price });
    });
    drawItems(); calc(); scheduleDraft();
    U.toast('Đã thêm ' + chosen.length + ' dòng hàng');
    return true;
  }
  function openPasteModal(text) {
    if (typeof M._ciParseLine !== 'function') return U.toast('Chưa nạp được bộ đọc dữ liệu', 'error');
    const lines = (text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const idx = M._ciProductIndex();
    const cid = isSale ? (partnerI.value || null) : null;
    const rows = lines.map(l => {
      const pr = M._ciParseLine(l);
      if (!pr) return null;
      const mt = M._ciMatch(pr, idx, cid);
      return { name: pr.name, productId: mt.productId, status: mt.status, qty: pr.qty, price: pr.price, use: true };
    }).filter(Boolean);
    if (!rows.length) return U.toast('Không đọc được dòng hàng nào từ nội dung dán', 'error');
    const prodOpts = [{ value: '', label: '— Bỏ qua —' }]
      .concat(PW.data.products.map(p => ({ value: p.id, label: (p.code ? p.code + ' · ' : '') + p.name })));
    const STATUS = { alias: ['Khớp bí danh', 'green'], code: ['Khớp mã', 'green'], fuzzy: ['Cần xem lại', 'orange'], none: ['Chưa khớp', 'red'] };
    const tb = U.el('tbody');
    rows.forEach(r => {
      const sel = C.select(prodOpts, r.productId); sel.addEventListener('change', () => { r.productId = sel.value; });
      const qi = U.el('input', { class: 'inp', type: 'number', value: r.qty, min: 0, style: 'width:70px;text-align:right' });
      qi.addEventListener('input', () => { r.qty = Number(qi.value) || 0; });
      const pi = U.el('input', { class: 'inp', type: 'number', value: r.price, min: 0, style: 'width:110px;text-align:right' });
      pi.addEventListener('input', () => { r.price = Number(pi.value) || 0; });
      const chk = U.el('input', { type: 'checkbox' }); chk.checked = true; chk.addEventListener('change', () => { r.use = chk.checked; });
      const st = STATUS[r.status] || ['?', 'gray'];
      tb.appendChild(U.el('tr', null, [
        U.el('td', { class: 'center' }, chk),
        U.el('td', { style: 'font-size:12px;color:#6b7785;max-width:170px' }, r.name),
        U.el('td', null, sel),
        U.el('td', null, qi),
        U.el('td', null, pi),
        U.el('td', { class: 'center', html: '<span class="tag ' + st[1] + '">' + st[0] + '</span>' }),
      ]));
    });
    const table = U.el('table', { class: 'items-tbl' }, [
      U.el('thead', null, U.el('tr', null, ['', 'Dòng dán', 'Hàng hóa', 'SL', 'Đơn giá', 'Khớp'].map(h => U.el('th', null, h)))),
      tb,
    ]);
    C.miniModal({
      title: 'Dán ' + rows.length + ' dòng từ Excel — kiểm tra & chọn hàng',
      body: U.el('div', null, [
        U.el('p', { class: 'section-sub' }, 'Đã tự khớp hàng hóa. Sửa cột "Hàng hóa" / SL / Đơn giá nếu cần; bỏ tick dòng không muốn thêm. Giá để 0 sẽ tự lấy giá mặc định.'),
        U.el('div', { class: 'table-wrap' }, table),
      ]),
      footer: [C.btn('Hủy', C.closeMini), C.btn('Thêm vào chứng từ', () => { if (_applyPastedRows(rows)) C.closeMini(); }, 'primary')],
    });
  }
  // Bắt Ctrl+V trên bảng hàng: nếu dán nội dung dạng bảng -> mở hộp soát
  itemsTable.addEventListener('paste', (e) => {
    const text = (e.clipboardData || window.clipboardData).getData('text');
    if (text && _pasteTabular(text)) { e.preventDefault(); openPasteModal(text); }
  });

  const addBtn = C.btn('+ Thêm dòng', () => { items.push({ productId: '', qty: 1, [unitField]: 0 }); drawItems(); calc(); }, 'sm');
  const pasteBtn = C.btn('📋 Dán từ Excel', () => {
    if (navigator.clipboard && navigator.clipboard.readText) {
      navigator.clipboard.readText().then(t => openPasteModal(t || '')).catch(() => U.toast('Hãy bấm vào bảng hàng rồi nhấn Ctrl+V để dán', 'error'));
    } else { U.toast('Hãy bấm vào ô trong bảng hàng rồi nhấn Ctrl+V để dán', 'error'); }
  }, 'sm');

  const partnerField = M.withAdd(partnerI, 'Thêm nhanh ' + partnerLabel, () =>
    M.quickAddPartner(isSale, np => {
      // np đã được quickAddPartner push vào PW.data.customers/suppliers (= partners) rồi
      M.rebuildSelect(partnerI, partners.map(p => ({ value: p.id, label: p.name })), np.id);
      applyPartnerTerm();
    }));
  const termField = M.withAdd(termSel, 'Thêm nhanh điều khoản thanh toán', () =>
    M.quickAddTerm(t => {
      M.rebuildSelect(termSel, [{ value: '', label: '-- Chọn điều khoản --' }]
        .concat(PW.data.paymentTerms.map(x => ({ value: x.days, label: x.name }))), t.days);
      dueI.value = U.addDays(dateI.value, t.days);
    }));
  const empField = empSel ? M.withAdd(empSel, 'Thêm nhanh nhân viên', () =>
    M.quickAddEmployee(ne => {
      M.rebuildSelect(empSel, [{ value: '', label: '-- Chọn nhân viên --' }]
        .concat(PW.data.employees.map(e => ({ value: e.id, label: e.name }))), ne.id);
    })) : null;

  const header = U.el('div', { class: 'form-grid' }, [
    C.field('Số chứng từ', codeI),
    C.field('Ngày', dateI, { required: true }),
    C.field('Điều khoản thanh toán', termField),
    C.field('Hạn thanh toán (để trống = không hạn)', dueI),
    C.field(partnerLabel, partnerField, { required: true, full: true }),
    C.field('Thuế GTGT (%)', vatRateI),
    isSale ? C.field('Kênh bán', channelSel) : null,
    isSale ? C.field('Nhân viên bán', empField) : null,
  ]);

  // Tham chiếu luồng chứng từ (hóa đơn tạo từ báo giá / đơn hàng)
  const refBar = doc.sourceCode ? U.el('div', { class: 'alert-bar', style: 'background:#eef6e1;border-color:#cfe3a8;color:#3d5a1e' }, [
    U.el('span', { class: 'a-ic', html: U.icon('route') }),
    U.el('span', null, 'Tham chiếu: tạo từ ' + (doc.sourceType === 'quote' ? 'báo giá ' : 'đơn đặt hàng ')),
    U.el('b', null, doc.sourceCode),
    U.el('a', { href: '#', onclick: (e) => { e.preventDefault(); C.closeModal(); App.go(doc.sourceType === 'quote' ? 'quotes' : 'orders'); } }, 'Mở chứng từ gốc →'),
  ]) : null;

  const summary = U.el('div', { style: 'margin-top:14px;display:flex;flex-direction:column;gap:8px;align-items:flex-end' }, [
    U.el('div', null, [U.el('span', { class: 'text-muted' }, 'Tổng tiền hàng: '), totalCell, ' đ']),
    U.el('div', { style: 'display:flex;align-items:center;gap:10px' }, [U.el('span', { class: 'text-muted' }, 'Giảm giá: '), discountI]),
    U.el('div', null, [U.el('span', { class: 'text-muted' }, 'THÀNH TIỀN: '), grandCell]),
    U.el('div', null, [U.el('span', { class: 'text-muted' }, 'Thuế GTGT: '), vatCell]),
    isSale ? U.el('div', { style: 'display:flex;align-items:center;gap:10px' }, [U.el('span', { class: 'text-muted' }, 'Phí sàn: '), platformFeeI]) : null,
    isSale ? U.el('div', { style: 'display:flex;align-items:center;gap:10px' }, [U.el('span', { class: 'text-muted' }, 'Phí vận chuyển: '), shippingFeeI]) : null,
    isSale ? U.el('div', null, [U.el('span', { class: 'text-muted' }, 'THỰC NHẬN (sau phí): '), netCell]) : null,
    U.el('div', { style: 'display:flex;align-items:center;gap:10px' }, [U.el('span', { class: 'text-muted' }, (isSale ? 'Đã thu: ' : 'Đã trả: ')), paidI]),
    U.el('div', { style: 'display:flex;align-items:center;gap:10px' }, [U.el('span', { class: 'text-muted' }, 'Vào/ra tài khoản: '), paidAccI]),
    U.el('div', null, [U.el('span', { class: 'text-muted' }, 'Còn nợ: '), remainCell]),
  ]);

  const body = U.el('div', null, [
    refBar,
    header,
    U.el('div', { class: 'section-sub mt16', style: 'font-weight:600;color:#2c3a47' }, 'Chi tiết hàng hóa'),
    U.el('div', { class: 'table-wrap' }, itemsTable),
    U.el('div', { class: 'mt8 pill-row' }, [addBtn, pasteBtn]),
    C.field('Diễn giải', noteI, { full: true }),
    summary,
  ]);

  drawItems(); calc();

  // (B3) Tự lưu nháp khi gõ/đổi giá trị trong form (debounce trong scheduleDraft)
  if (isNew && !cfg.skipDraft) {
    body.addEventListener('input', scheduleDraft, true);
    body.addEventListener('change', scheduleDraft, true);
  }

  C.modal({
    title, wide: true, body,
    footer: [C.btn('Hủy', () => { clearTimeout(_draftTimer); if (isNew) M.draft.clear(mode); C.closeModal(); }), C.btn('Lưu chứng từ', () => {
      const valid = items.filter(it => it.productId && Number(it.qty) > 0);
      if (!valid.length) return U.toast('Thêm ít nhất 1 dòng hàng hợp lệ', 'error');
      if (!partnerI.value) return U.toast('Chọn ' + partnerLabel.toLowerCase(), 'error');
      // Cảnh báo bán vượt tồn (chỉ hóa đơn bán)
      if (isSale) {
        const need = {};
        valid.forEach(it => { need[it.productId] = (need[it.productId] || 0) + Number(it.qty); });
        const over = [];
        Object.keys(need).forEach(pid => {
          const p = PW.product(pid);
          if (p && p.kind === 'dichvu') return; // dịch vụ không có tồn kho
          let avail = PW.stockOf(pid);
          // hoàn lại phần của chính HĐ đang sửa (combo -> khai triển thành phần)
          if (!isNew && doc.items) doc.items.forEach(oi => {
            if (oi.productId === pid) avail += Number(oi.qty);
            else { const cp = PW.product(oi.productId); if (cp && cp.kind === 'combo' && cp.components)
              cp.components.forEach(c => { if (c.productId === pid) avail += Number(c.qty || 0) * Number(oi.qty); }); }
          });
          if (need[pid] > avail) { over.push('• ' + (p ? p.name : pid) + ': cần ' + U.num(need[pid]) + ', tồn ' + U.num(avail)); }
        });
        if (over.length && !U.confirm('Tồn kho KHÔNG đủ:\n' + over.join('\n') + '\n\nVẫn lưu hóa đơn (tồn kho sẽ âm)?')) return;
      }
      const obj = {
        id: doc.id || PW.uid(),
        code: codeI.value, date: dateI.value, dueDate: dueI.value || null,
        [partnerKey]: partnerI.value,
        employeeId: empSel ? (empSel.value || null) : (doc.employeeId || null),
        channelId: channelSel ? (channelSel.value || null) : (doc.channelId || null),
        platformFee: platformFeeI ? (Number(platformFeeI.value) || 0) : (doc.platformFee || 0),
        shippingFee: shippingFeeI ? (Number(shippingFeeI.value) || 0) : (doc.shippingFee || 0),
        vatRate: Number(vatRateI.value) || 0,
        items: valid.map(it => ({ productId: it.productId, qty: Number(it.qty), [unitField]: Number(it[unitField]) })),
        discount: Number(discountI.value) || 0,
        paid: Number(paidI.value) || 0,
        paidAccountId: (Number(paidI.value) || 0) > 0 ? paidAccI.value : null,
        note: noteI.value,
      };
      // Giữ lại trạng thái đối soát sàn + tham chiếu nguồn khi sửa lại hóa đơn
      ['reconciled', 'settledAmount', 'reconciledDate', 'sourceType', 'sourceId', 'sourceCode',
       'packed', 'packedAt', 'orderStatus', 'trackingCode'].forEach(k => { if (doc[k] !== undefined) obj[k] = doc[k]; });
      onSave(obj);
      PW.logActivity(isNew ? 'create' : 'update', isSale ? 'salesInvoice' : 'purchase', obj.code,
        U.money(isSale ? PW.invoiceTotal(obj) : PW.purchaseTotal(obj)) + ' đ');
      clearTimeout(_draftTimer);        // (B3) chặn timer debounce ghi lại nháp sau khi đã lưu
      if (isNew) M.draft.clear(mode);   // (B3) xóa nháp sau khi lưu thành công
      PW.save(); C.closeModal(); App.refresh();
      U.toast(isSale ? 'Đã lưu hóa đơn bán' : 'Đã lưu phiếu nhập');
    }, 'primary')],
  });
};

/* =====================================================================
   IN CHỨNG TỪ
   ===================================================================== */
M.printDoc = function (mode, doc) {
  const isSale = mode === 'sale';
  const partner = isSale ? PW.customer(doc.customerId) : PW.supplier(doc.supplierId);
  const unitField = isSale ? 'price' : 'cost';
  const total = isSale ? PW.invoiceTotal(doc) : PW.purchaseTotal(doc);
  const rows = doc.items.map((it, i) => {
    const p = PW.product(it.productId);
    const lt = Number(it.qty) * Number(it[unitField]);
    return `<tr><td style="text-align:center">${i + 1}</td><td>${U.esc(p ? p.name : '')}</td>
      <td style="text-align:center">${p ? U.esc(p.unit) : ''}</td>
      <td style="text-align:right">${U.num(it.qty)}</td>
      <td style="text-align:right">${U.money(it[unitField])}</td>
      <td style="text-align:right">${U.money(lt)}</td></tr>`;
  }).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${doc.code}</title>
    <style>body{font-family:'Segoe UI',Arial;padding:30px;color:#222}
    h2{text-align:center;margin:4px 0} .company{text-align:center;color:#1ea7a0;font-weight:700;font-size:18px}
    table{width:100%;border-collapse:collapse;margin-top:16px} th,td{border:1px solid #999;padding:7px 9px;font-size:13px}
    th{background:#f0f0f0} .meta{margin-top:10px;font-size:14px;line-height:1.7}
    .tot{text-align:right;margin-top:12px;font-size:15px} .sign{display:flex;justify-content:space-around;margin-top:50px;text-align:center}
    </style></head><body>
    <div class="company">DALI — Tô điểm cuộc sống</div>
    <h2>${isSale ? 'HÓA ĐƠN BÁN HÀNG' : 'PHIẾU NHẬP MUA HÀNG'}</h2>
    <div style="text-align:center">Số: ${U.esc(doc.code)} &nbsp;|&nbsp; Ngày ${U.date(doc.date)}</div>
    <div class="meta">
      <div><b>${isSale ? 'Khách hàng' : 'Nhà cung cấp'}:</b> ${U.esc(partner ? partner.name : '')}</div>
      <div><b>Điện thoại:</b> ${U.esc(partner ? partner.phone : '')} &nbsp; <b>Địa chỉ:</b> ${U.esc(partner ? partner.address : '')}</div>
    </div>
    <table><thead><tr><th>STT</th><th>Tên hàng hóa</th><th>ĐVT</th><th>SL</th><th>Đơn giá</th><th>Thành tiền</th></tr></thead>
    <tbody>${rows}</tbody></table>
    <div class="tot">Cộng tiền hàng: <b>${U.money(total + (doc.discount || 0))} đ</b></div>
    ${doc.discount ? `<div class="tot">Giảm giá: ${U.money(doc.discount)} đ</div>` : ''}
    <div class="tot">TỔNG THANH TOÁN: <b>${U.money(total)} đ</b></div>
    <div class="tot">${isSale ? 'Đã thu' : 'Đã trả'}: ${U.money(doc.paid || 0)} đ &nbsp;|&nbsp; Còn nợ: <b>${U.money(total - (doc.paid || 0))} đ</b></div>
    <div class="sign"><div>Người mua<br/><i>(Ký, ghi rõ họ tên)</i></div><div>Người bán<br/><i>(Ký, ghi rõ họ tên)</i></div></div>
    <script>window.onload=function(){window.print();}</script>
    </body></html>`;
  const w = window.open('', '_blank');
  if (!w) return U.toast('Trình duyệt chặn cửa sổ in. Hãy cho phép pop-up.', 'error');
  w.document.write(html); w.document.close();
};
