/* ============================================================
   modules18.js — QUÉT HÓA ĐƠN MUA (AI)
   Chụp ảnh / tải PDF hóa đơn nhà cung cấp -> Claude Vision đọc ->
   khớp hàng hóa / nguyên vật liệu -> soát lại -> tạo PHIẾU NHẬP MUA.
   Tái dùng bộ OCR (M._ciOcr kind='purchase') + bộ khớp (M._ciMatch / M._ciProductIndex)
   của modules14.js (nạp trước file này).
   ============================================================ */
M.purchaseScan = function (root) {
  const state = { rows: [], idx: M._ciProductIndex(), suggestSup: null };

  /* --- Thẻ 1: nguồn dữ liệu --- */
  const srcCard = U.el('div', { class: 'card' });
  srcCard.appendChild(U.el('div', { class: 'card-title' }, '📷 Quét hóa đơn mua — chụp ảnh / tải PDF / dán'));
  srcCard.appendChild(U.el('p', { class: 'section-sub' },
    'Chụp ảnh hóa đơn của nhà cung cấp (hoặc tải PDF), AI đọc nhà cung cấp + các dòng hàng rồi tự khớp về danh mục hàng hóa / nguyên vật liệu. ' +
    'Bí danh đã xác nhận sẽ được nhớ theo từng nhà cung cấp cho lần sau. Bạn cũng có thể dán danh sách dạng: TÊN HÀNG | SL | ĐƠN GIÁ.'));

  const ta = U.el('textarea', { class: 'inp', rows: 5, style: 'width:100%;font-family:Consolas,monospace',
    placeholder: 'Ví dụ:\nGiấy in A4 80gsm | 10 | 65.000\nMực đen HP 12A x2 250000' });
  srcCard.appendChild(ta);

  const fileIn = U.el('input', { type: 'file', accept: '.csv,.txt,.tsv,.xlsx,.xls', style: 'display:none' });
  fileIn.addEventListener('change', async () => {
    const f = fileIn.files[0]; if (!f) return; fileIn.value = '';
    try { const lines = await M._ciFileToLines(f); ta.value = (ta.value ? ta.value + '\n' : '') + lines.join('\n'); doParse(); U.toast('Đã đọc ' + lines.length + ' dòng từ ' + f.name); }
    catch (e) { U.toast(e.message, 'error'); }
  });
  const photoIn = U.el('input', { type: 'file', accept: 'image/*,.pdf', capture: 'environment', style: 'display:none' });
  photoIn.addEventListener('change', () => {
    const f = photoIn.files[0]; if (!f) return;
    M._ciOcr(f, lines => { ta.value = (ta.value ? ta.value + '\n' : '') + lines.join('\n'); doParse(); }, 'purchase');
    photoIn.value = '';
  });

  const parseBtn = C.btn('🧩 Nhận diện & khớp mã', () => doParse(), 'primary');
  const photoBtn = C.btn('📷 Chụp ảnh / PDF — AI đọc', () => {
    if (PW.mode !== 'server') { U.toast('AI đọc ảnh/PDF cần chạy trên máy chủ (ketoan.tranhdali.vn)', 'error'); return; }
    photoIn.click();
  });
  const fileBtn = C.btn('⬆ Tải file Excel/CSV', () => fileIn.click());
  srcCard.appendChild(U.el('div', { class: 'pill-row mt8' }, [parseBtn, photoBtn, fileBtn, fileIn, photoIn]));

  /* --- Thẻ 2: thông tin phiếu nhập --- */
  const docCard = U.el('div', { class: 'card' });
  docCard.appendChild(U.el('div', { class: 'card-title' }, '🧾 Phiếu nhập sẽ tạo'));
  const supSel = C.select([{ value: '', label: '-- Chọn nhà cung cấp --' }]
    .concat(PW.data.suppliers.map(s => ({ value: s.id, label: s.name }))), '');
  supSel.style.flex = '1';
  supSel.addEventListener('change', () => { if (state.rows.length) rematch(); });
  function rebuildSup(selId) {
    supSel.innerHTML = '';
    [{ value: '', label: '-- Chọn nhà cung cấp --' }].concat(PW.data.suppliers.map(s => ({ value: s.id, label: s.name })))
      .forEach(o => { const op = U.el('option', { value: o.value }, o.label); if (String(o.value) === String(selId || '')) op.selected = true; supSel.appendChild(op); });
  }
  const addSupBtn = C.btn('+', () => M.quickAddPartner(false, np => { rebuildSup(np.id); if (state.rows.length) rematch(); }), 'sm');
  addSupBtn.title = 'Thêm nhanh nhà cung cấp';
  const supRow = U.el('div', { style: 'display:flex;gap:6px;align-items:stretch' }, [supSel, addSupBtn]);
  const dateI = C.input({ type: 'date', value: U.today() });
  const vatSel = C.select([{ value: 0, label: '0%' }, { value: 5, label: '5%' }, { value: 8, label: '8%' }, { value: 10, label: '10%' }], 0);
  const detectLine = U.el('div', { class: 'section-sub', style: 'min-height:16px;margin:6px 0 0' });
  const fg = U.el('div', { class: 'form-grid' });
  fg.appendChild(C.field('Nhà cung cấp', supRow, { required: true }));
  fg.appendChild(C.field('Ngày nhập', dateI));
  fg.appendChild(C.field('Thuế GTGT (%)', vatSel));
  docCard.appendChild(fg);
  docCard.appendChild(detectLine);

  function suggestSupplier(name, tax) {
    const norm = M._ciNorm(name || '');
    const taxN = (tax || '').replace(/\s/g, '');
    let s = null;
    if (taxN) s = PW.data.suppliers.find(x => (x.taxCode || '').replace(/\s/g, '') === taxN);
    if (!s && norm) s = PW.data.suppliers.find(x => M._ciNorm(x.name) === norm)
      || PW.data.suppliers.find(x => { const n = M._ciNorm(x.name); return n && (n.indexOf(norm) >= 0 || norm.indexOf(n) >= 0); });
    if (s) { rebuildSup(s.id); detectLine.innerHTML = '✨ Nhà cung cấp: <b>' + U.esc(s.name) + '</b> — sai thì chọn lại.'; state.suggestSup = null; }
    else if (name) { detectLine.innerHTML = '⚠ Đọc được NCC: <b>' + U.esc(name) + '</b> — chưa có trong danh mục, bấm <b>+</b> để thêm rồi chọn.'; state.suggestSup = { name: name, tax: tax }; }
  }

  /* --- Thẻ 3: bảng duyệt --- */
  const revCard = U.el('div', { class: 'card' });
  revCard.appendChild(U.el('div', { class: 'card-title' }, '📋 Duyệt dòng hàng đã khớp'));
  const sumDiv = U.el('div', { class: 'section-sub' }, 'Chưa có dữ liệu — chụp ảnh hoặc dán danh sách rồi bấm "Nhận diện & khớp mã".');
  const host = U.el('div');
  revCard.appendChild(sumDiv); revCard.appendChild(host);
  const createBtn = C.btn('✅ Tạo phiếu nhập & học bí danh', () => doCreate(), 'primary');
  revCard.appendChild(U.el('div', { class: 'pill-row mt16' }, [createBtn]));

  const STATUS_TAG = {
    alias: '<span class="tag green">Bí danh ✓</span>', code: '<span class="tag green">Mã hàng ✓</span>',
    fuzzy: '<span class="tag orange">Cần xem lại</span>', none: '<span class="tag red">Chưa khớp</span>',
  };
  function costHint(pid) { return (PW.avgPurchaseCost ? PW.avgPurchaseCost(pid) : 0) || (PW.product(pid) || {}).cost || 0; }

  function doParse() {
    const all = ta.value.split(/\r?\n/);
    const itemLines = [];
    all.forEach(l => {
      const segs = l.split('|').map(s => s.trim());
      if (segs[0] && /^ncc$/i.test(segs[0].replace(/\s/g, ''))) { suggestSupplier(segs[1] || '', segs[2] || ''); return; }
      if (l.trim()) itemLines.push(l);
    });
    state.rows = [];
    itemLines.forEach(l => {
      const parsed = M._ciParseLine(l); if (!parsed) return;
      const m = M._ciMatch(parsed, state.idx, supSel.value || null);
      const row = Object.assign(parsed, m);
      if (row.productId && !row.price) row.price = costHint(row.productId);
      state.rows.push(row);
    });
    draw();
  }
  function rematch() {
    state.rows.forEach(r => {
      if (r.manual) return;
      const m = M._ciMatch(r, state.idx, supSel.value || null);
      r.productId = m.productId; r.status = m.status;
      if (r.productId && !r.priceTouched && !r.price) r.price = costHint(r.productId);
    });
    draw();
  }
  function draw() {
    host.innerHTML = '';
    if (!state.rows.length) { sumDiv.textContent = 'Chưa nhận diện được dòng hàng nào.'; return; }
    const ok = state.rows.filter(r => r.status === 'alias' || r.status === 'code' || r.manual).length;
    const warn = state.rows.filter(r => r.status === 'fuzzy' && !r.manual).length;
    const bad = state.rows.filter(r => r.status === 'none' && !r.manual).length;
    sumDiv.innerHTML = 'Tổng <b>' + state.rows.length + '</b> dòng — khớp chắc <b class="text-green">' + ok +
      '</b>, cần xem lại <b style="color:#c77f0a">' + warn + '</b>, chưa khớp <b class="text-red">' + bad + '</b>.';
    const prodOpts = [{ value: '', label: '-- Chọn hàng / NVL --' }]
      .concat(PW.data.products.map(p => ({ value: p.id, label: (p.code ? p.code + ' - ' : '') + p.name })));
    host.appendChild(C.table(state.rows, [
      { label: '#', width: '34px', render: r => String(state.rows.indexOf(r) + 1) },
      { label: 'Dòng gốc', render: r => U.esc(r.raw) },
      { label: 'Hàng hóa / NVL khớp', render: r => {
          const sel = C.select(prodOpts, r.productId);
          sel.addEventListener('change', () => { r.productId = sel.value; r.manual = true; if (r.productId && !r.priceTouched) r.price = costHint(r.productId); draw(); });
          const newBtn = C.btn('+ Tạo mới', () => M.quickAddProduct(false, np => { r.productId = np.id; r.manual = true; state.idx = M._ciProductIndex(); draw(); }), 'sm');
          newBtn.title = 'Tạo hàng hóa / nguyên vật liệu mới';
          const wrap = U.el('div', null, [sel, U.el('div', { class: 'pill-row', style: 'margin-top:4px' }, [newBtn])]);
          if (r.productId) wrap.appendChild(U.el('div', { class: 'text-muted', style: 'font-size:11px;margin-top:2px' }, 'Tồn hiện tại: ' + U.num(PW.stockOf(r.productId))));
          return wrap;
        } },
      { label: 'SL', num: true, width: '78px', render: r => { const i = C.input({ type: 'number', value: r.qty, min: 1, style: 'width:68px;text-align:right' }); i.addEventListener('input', () => { r.qty = Number(i.value) || 1; }); return i; } },
      { label: 'Đơn giá nhập', num: true, width: '120px', render: r => { const i = C.input({ type: 'number', value: r.price, min: 0, style: 'width:110px;text-align:right' }); i.addEventListener('input', () => { r.price = Number(i.value) || 0; r.priceTouched = true; }); return i; } },
      { label: 'Trạng thái', center: true, render: r => STATUS_TAG[r.manual ? 'alias' : r.status] || '' },
      { label: '', width: '40px', render: r => C.actions([{ label: '✕', title: 'Bỏ dòng', onClick: () => { state.rows.splice(state.rows.indexOf(r), 1); draw(); } }]) },
    ], { empty: 'Chưa có dòng nào' }));
  }
  function doCreate() {
    if (!supSel.value) { U.toast('Chọn nhà cung cấp trước', 'error'); return; }
    const valid = state.rows.filter(r => r.productId && r.qty > 0);
    if (!valid.length) { U.toast('Chưa có dòng nào khớp hàng hóa', 'error'); return; }
    const unmatched = state.rows.length - valid.length;
    if (unmatched > 0 && !U.confirm(unmatched + ' dòng chưa khớp sẽ bị bỏ qua. Tiếp tục?')) return;
    // Học bí danh theo nhà cung cấp (dùng chung mảng productAliases; customerId = supplierId, id duy nhất nên không lẫn)
    if (!PW.data.productAliases) PW.data.productAliases = [];
    valid.forEach(r => {
      const aliasKey = r.aliasKey || M._ciNorm(r.name);
      if (!aliasKey || aliasKey.length < 3) return;
      const ex = (PW.data.productAliases || []).find(a => a.customerId === supSel.value && a.alias === aliasKey);
      if (ex) { ex.productId = r.productId; return; }
      PW.data.productAliases.push({ id: PW.uid(), customerId: supSel.value, supplierId: supSel.value, alias: aliasKey, productId: r.productId });
    });
    const items = valid.map(r => ({ productId: r.productId, qty: Number(r.qty), cost: Number(r.price) || 0 }));
    const code = PW.nextCode('PN');
    const pu = { id: PW.uid(), code: code, date: dateI.value, supplierId: supSel.value,
      vatRate: Number(vatSel.value) || 0, items: items, discount: 0, paid: 0, paidAccountId: null, note: 'Quét hóa đơn mua (AI)' };
    PW.data.purchases.push(pu);
    PW.logActivity('create', 'purchase', code, U.money(PW.purchaseTotal(pu)) + ' đ (quét AI)');
    PW.save();
    U.toast('Đã tạo ' + code + ' (' + items.length + ' mặt hàng) + nhớ ' + valid.length + ' bí danh');
    state.rows = []; ta.value = ''; draw();
    sumDiv.innerHTML = 'Đã tạo phiếu nhập <b>' + U.esc(code) + '</b>. <a href="#" id="pscan-open">Mở để kiểm tra / nhập thanh toán →</a>';
    const lnk = document.getElementById('pscan-open');
    if (lnk) lnk.addEventListener('click', e => { e.preventDefault(); const cur = PW.data.purchases.find(x => x.id === pu.id); if (cur) M.purchaseForm(cur); });
  }

  root.appendChild(srcCard);
  root.appendChild(docCard);
  root.appendChild(revCard);
};
