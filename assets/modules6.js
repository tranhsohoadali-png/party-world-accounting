/* ============================================================
   modules6.js — Trang DANH MỤC (hub) + các danh mục đơn giản
   ============================================================ */

/* Cấu hình các danh mục đơn giản (CRUD dùng chung) */
M.CATALOGS = {
  'cat-employees': {
    data: 'employees', title: 'Nhân viên', icon: '🧑‍💼', codePrefix: 'NV',
    fields: [
      { k: 'name', l: 'Họ và tên', req: true, full: true },
      { k: 'phone', l: 'Điện thoại' },
      { k: 'position', l: 'Chức vụ' },
      { k: 'tkCode', l: 'Mã chấm công (mau.tranhdali.vn)' },
      { k: 'salaryBase', l: 'Lương cơ bản (đ)', type: 'number' },
      { k: 'allowResp', l: 'Phụ cấp trách nhiệm (đ)', type: 'number' },
      { k: 'allowTransport', l: 'Phụ cấp xăng xe (đ)', type: 'number' },
      { k: 'allowLunch', l: 'Phụ cấp ăn trưa (đ)', type: 'number' },
      { k: 'allowSeniority', l: 'Phụ cấp thâm niên (đ)', type: 'number' },
    ],
  },
  'cat-groups': {
    data: 'productGroups', title: 'Nhóm hàng hóa', icon: '🗂️',
    fields: [
      { k: 'name', l: 'Tên nhóm', req: true, full: true },
      { k: 'kind', l: 'Áp dụng cho tính chất', type: 'select',
        options: [{ value: '', label: 'Tất cả tính chất' }].concat((M.PRODUCT_KINDS || []).map(x => ({ value: x.kind, label: x.label }))) },
      { k: 'common', l: 'NVL dùng chung cho mọi kích thước (vd Cavas) — tự thêm vào định mức khi chọn size', type: 'check', full: true },
      { k: 'bom', l: 'Định mức NVL của nhóm (thành phẩm chọn nhóm này sẽ tự nạp)', type: 'bom', full: true },
    ],
  },
  'cat-units': {
    data: 'units', title: 'Đơn vị tính', icon: '📏',
    fields: [{ k: 'name', l: 'Tên đơn vị tính', req: true, full: true }],
  },
  'cat-warehouses': {
    data: 'warehouses', title: 'Kho', icon: '🏬', codePrefix: 'KHO',
    fields: [
      { k: 'name', l: 'Tên kho', req: true, full: true },
      { k: 'address', l: 'Địa chỉ', full: true },
    ],
  },
  'cat-expense-items': {
    data: 'expenseItems', title: 'Khoản mục chi phí', icon: '💳',
    fields: [{ k: 'name', l: 'Tên khoản mục', req: true, full: true }],
  },
  'cat-payment-terms': {
    data: 'paymentTerms', title: 'Điều khoản thanh toán', icon: '📆',
    fields: [
      { k: 'name', l: 'Tên điều khoản', req: true, full: true },
      { k: 'days', l: 'Số ngày được nợ', type: 'number' },
    ],
  },
  'cat-partner-groups': {
    data: 'partnerGroups', title: 'Nhóm khách hàng / NCC', icon: '🏷️',
    fields: [{ k: 'name', l: 'Tên nhóm', req: true, full: true }],
  },
  'cat-channels': {
    data: 'channels', title: 'Kênh bán hàng', icon: '🛒',
    fields: [
      { k: 'name', l: 'Tên kênh (Shopee, Đại lý, Lẻ...)', req: true, full: true },
      { k: 'feePercent', l: 'Phí sàn mặc định (%)', type: 'number' },
    ],
  },
};

/* ---------- Trang hub Danh mục ---------- */
M.catalogHub = function (root) {
  const groups = [
    { title: 'Đối tượng', items: [
      { label: 'Khách hàng', go: 'customers' },
      { label: 'Nhà cung cấp', go: 'suppliers' },
      { label: 'Nhân viên', go: 'cat-employees' },
      { label: 'Nhóm khách hàng / NCC', go: 'cat-partner-groups' },
    ]},
    { title: 'Hàng hóa - Kho', items: [
      { label: 'Hàng hóa, dịch vụ', go: 'products' },
      { label: 'Nhóm hàng hóa', go: 'cat-groups' },
      { label: 'Đơn vị tính', go: 'cat-units' },
      { label: 'Kho', go: 'cat-warehouses' },
      { label: 'Kênh bán hàng', go: 'cat-channels' },
    ]},
    { title: 'Tài chính', items: [
      { label: 'Tài khoản tiền / ngân hàng', go: 'settings' },
      { label: 'Khoản mục chi phí', go: 'cat-expense-items' },
      { label: 'Điều khoản thanh toán', go: 'cat-payment-terms' },
    ]},
  ];
  const card = U.el('div', { class: 'card' });
  card.appendChild(U.el('div', { class: 'card-title' }, '📚 Danh mục'));
  card.appendChild(U.el('div', { class: 'section-sub' }, 'Quản lý toàn bộ danh mục dùng chung trong phần mềm. Bấm vào từng mục để xem và chỉnh sửa.'));
  const grid = U.el('div', { class: 'cat-grid' });
  groups.forEach(g => {
    const col = U.el('div', { class: 'cat-group' });
    col.appendChild(U.el('div', { class: 'cat-group-title' }, g.title));
    g.items.forEach(it => {
      col.appendChild(U.el('a', {
        class: 'cat-link', href: '#' + it.go,
        onclick: (e) => { e.preventDefault(); App.go(it.go); },
      }, it.label));
    });
    grid.appendChild(col);
  });
  card.appendChild(grid);
  root.appendChild(card);
};

/* ---------- CRUD danh mục đơn giản ---------- */
M.simpleCatalog = function (root, id) {
  const cfg = M.CATALOGS[id];
  const list = PW.data[cfg.data];

  const card = U.el('div', { class: 'card' });
  const toolbar = U.el('div', { class: 'toolbar' });
  toolbar.appendChild(U.el('button', { class: 'btn ghost', onclick: () => App.go('catalog') }, '← Danh mục'));
  toolbar.appendChild(U.el('div', { class: 'card-title', style: 'margin:0' }, cfg.icon + ' ' + cfg.title));
  toolbar.appendChild(U.el('div', { class: 'spacer' }));
  toolbar.appendChild(C.btn('+ Thêm', () => M.catalogForm(id), 'primary'));
  card.appendChild(toolbar);
  const host = U.el('div');
  card.appendChild(host);
  root.appendChild(card);

  function draw() {
    const cols = [];
    if (cfg.codePrefix) cols.push({ label: 'Mã', render: r => U.esc(r.code) });
    cfg.fields.forEach(f => cols.push({
      label: f.l, num: f.type === 'number',
      render: r => {
        if (f.type === 'number') return U.num(r[f.k] || 0);
        if (f.type === 'check') return r[f.k] ? '✓' : '';
        if (f.type === 'bom') return (r[f.k] || []).length ? ((r[f.k] || []).length + ' NVL') : '<span class="text-muted">—</span>';
        if (f.type === 'select') { const o = (f.options || []).find(o => String(o.value) === String(r[f.k] || '')); return U.esc(o ? o.label : (r[f.k] || '')); }
        return U.esc(r[f.k] || '');
      },
    }));
    cols.push({ label: '', render: r => C.actions([
      { label: 'Sửa', onClick: () => M.catalogForm(id, r) },
      { label: 'Xóa', cls: 'danger', onClick: () => {
          if (U.confirm('Xóa "' + (r.name || r.code) + '"?')) {
            PW.data[cfg.data] = PW.data[cfg.data].filter(x => x.id !== r.id);
            PW.save(); draw(); U.toast('Đã xóa');
          }
        } },
    ]) });
    host.innerHTML = '';
    host.appendChild(C.table(list, cols, { empty: 'Chưa có dữ liệu' }));
  }
  draw();
};

M.catalogForm = function (id, item) {
  const cfg = M.CATALOGS[id];
  const isNew = !item;
  item = item || {};
  const inputs = {};
  const codeI = cfg.codePrefix ? C.input({ value: item.code || PW.nextCode(cfg.codePrefix) }) : null;
  const rows = [];
  if (codeI) rows.push(C.field('Mã', codeI));
  cfg.fields.forEach(f => {
    if (f.type === 'bom') {
      const ed = M.bomEditor(item[f.k] || []);
      inputs[f.k] = ed;
      rows.push(C.field(f.l, ed.el, { full: true }));
      return;
    }
    if (f.type === 'check') {
      const chk = U.el('input', { type: 'checkbox' }); if (item[f.k]) chk.checked = true;
      inputs[f.k] = chk;
      rows.push(U.el('div', { class: 'field' + (f.full ? ' full' : '') }, U.el('label', { class: 'radio' }, [chk, ' ' + f.l])));
      return;
    }
    const inp = f.type === 'select'
      ? C.select(f.options || [], item[f.k] != null ? item[f.k] : '')
      : C.input({ type: f.type || 'text', value: item[f.k] != null ? item[f.k] : '' });
    inputs[f.k] = inp;
    rows.push(C.field(f.l, inp, { required: f.req, full: f.full }));
  });
  const body = U.el('div', { class: 'form-grid' }, rows);
  C.modal({
    title: (isNew ? 'Thêm ' : 'Sửa ') + cfg.title.toLowerCase(), body,
    footer: [C.btn('Hủy', C.closeModal), C.btn('Lưu', () => {
      const obj = { id: item.id || PW.uid() };
      if (codeI) obj.code = codeI.value.trim();
      let ok = true;
      cfg.fields.forEach(f => {
        if (f.type === 'bom') { obj[f.k] = inputs[f.k].get(); return; }
        if (f.type === 'check') { obj[f.k] = inputs[f.k].checked; return; }
        const v = inputs[f.k].value;
        if (f.req && !String(v).trim()) ok = false;
        obj[f.k] = f.type === 'number' ? (Number(v) || 0) : v.trim();
      });
      if (!ok) return U.toast('Vui lòng nhập đủ thông tin bắt buộc', 'error');
      if (isNew) PW.data[cfg.data].push(obj);
      else { const i = PW.data[cfg.data].findIndex(x => x.id === obj.id); PW.data[cfg.data][i] = obj; }
      PW.save(); C.closeModal(); App.refresh(); U.toast('Đã lưu');
    }, 'primary')],
  });
};

/* ---------- Helper: tạo <datalist> gợi ý ---------- */
M.datalist = function (domId, values) {
  const dl = U.el('datalist', { id: domId });
  values.forEach(v => dl.appendChild(U.el('option', { value: v })));
  return dl;
};
