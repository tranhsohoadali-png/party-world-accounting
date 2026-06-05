/* ============================================================
   modules2.js — Bán hàng & Mua hàng (chứng từ nhiều dòng)
   ============================================================ */

/* =====================================================================
   BÁN HÀNG (Hóa đơn bán + công nợ phải thu)
   ===================================================================== */
M.sales = function (root) {
  const card = U.el('div', { class: 'card' });
  const toolbar = U.el('div', { class: 'toolbar' });
  const search = U.el('input', { class: 'search', placeholder: '🔍 Tìm số HĐ / khách hàng...' });
  toolbar.appendChild(search);
  toolbar.appendChild(U.el('div', { class: 'spacer' }));
  toolbar.appendChild(C.btn('+ Lập hóa đơn bán', () => M.salesForm(), 'primary'));
  card.appendChild(toolbar);
  const host = U.el('div');
  card.appendChild(host);
  root.appendChild(card);

  function draw() {
    const q = search.value.trim().toLowerCase();
    const rows = PW.data.salesInvoices.filter(si => {
      const c = PW.customer(si.customerId);
      return !q || si.code.toLowerCase().includes(q) || (c && c.name.toLowerCase().includes(q));
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
          { label: 'In', onClick: () => M.printDoc('sale', si) },
          { label: 'Xóa', cls: 'danger', onClick: () => {
              if (U.confirm('Xóa hóa đơn ' + si.code + '?')) {
                PW.data.salesInvoices = PW.data.salesInvoices.filter(x => x.id !== si.id);
                PW.save(); App.refresh(); U.toast('Đã xóa');
              }
            } },
        ]) },
    ], { empty: 'Chưa có hóa đơn bán hàng' }));
  }
  search.addEventListener('input', draw);
  draw();
};

M.salesForm = function (si, presetCustomerId) {
  const isNew = !si;
  si = si ? JSON.parse(JSON.stringify(si)) : {
    code: PW.nextCode('HD'), date: U.today(),
    customerId: presetCustomerId || (PW.data.customers[0] ? PW.data.customers[0].id : ''),
    items: [], discount: 0, paid: 0, paidAccountId: PW.data.cashAccounts[0].id, note: '',
  };
  M.docForm({
    mode: 'sale', doc: si, isNew,
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
  const toolbar = U.el('div', { class: 'toolbar' });
  const search = U.el('input', { class: 'search', placeholder: '🔍 Tìm số phiếu / NCC...' });
  toolbar.appendChild(search);
  toolbar.appendChild(U.el('div', { class: 'spacer' }));
  toolbar.appendChild(C.btn('+ Lập phiếu nhập mua', () => M.purchaseForm(), 'primary'));
  card.appendChild(toolbar);
  const host = U.el('div');
  card.appendChild(host);
  root.appendChild(card);

  function draw() {
    const q = search.value.trim().toLowerCase();
    const rows = PW.data.purchases.filter(pu => {
      const s = PW.supplier(pu.supplierId);
      return !q || pu.code.toLowerCase().includes(q) || (s && s.name.toLowerCase().includes(q));
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
          { label: 'In', onClick: () => M.printDoc('purchase', pu) },
          { label: 'Xóa', cls: 'danger', onClick: () => {
              if (U.confirm('Xóa phiếu nhập ' + pu.code + '?')) {
                PW.data.purchases = PW.data.purchases.filter(x => x.id !== pu.id);
                PW.save(); App.refresh(); U.toast('Đã xóa');
              }
            } },
        ]) },
    ], { empty: 'Chưa có phiếu nhập mua' }));
  }
  search.addEventListener('input', draw);
  draw();
};

M.purchaseForm = function (pu, presetSupplierId) {
  const isNew = !pu;
  pu = pu ? JSON.parse(JSON.stringify(pu)) : {
    code: PW.nextCode('PN'), date: U.today(),
    supplierId: presetSupplierId || (PW.data.suppliers[0] ? PW.data.suppliers[0].id : ''),
    items: [], discount: 0, paid: 0, paidAccountId: PW.data.cashAccounts[0].id, note: '',
  };
  M.docForm({
    mode: 'purchase', doc: pu, isNew,
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
M.docForm = function (cfg) {
  const { mode, doc, isNew, title, partnerLabel, partners, partnerKey, priceKey, onSave } = cfg;
  const isSale = mode === 'sale';
  const unitField = isSale ? 'price' : 'cost'; // tên field giá trong item

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
  }

  function drawItems() {
    itemsBody.innerHTML = '';
    items.forEach((it, idx) => {
      const prodSel = C.select(
        [{ value: '', label: '-- Chọn hàng --' }].concat(PW.data.products.map(p => ({ value: p.id, label: p.code + ' - ' + p.name }))),
        it.productId);
      prodSel.addEventListener('change', () => {
        it.productId = prodSel.value;
        const p = PW.product(prodSel.value);
        if (p) { it[unitField] = p[priceKey]; }
        drawItems(); calc();
      });
      const qtyI = U.el('input', { type: 'number', value: it.qty, min: 0, style: 'text-align:right' });
      qtyI.addEventListener('input', () => { it.qty = Number(qtyI.value) || 0; updateLine(); });
      const priceI = U.el('input', { type: 'number', value: it[unitField], min: 0, style: 'text-align:right' });
      priceI.addEventListener('input', () => { it[unitField] = Number(priceI.value) || 0; updateLine(); });
      const lineTotal = U.el('span');
      function updateLine() { lineTotal.textContent = U.money((Number(it.qty) || 0) * (Number(it[unitField]) || 0)); calc(); }
      updateLine();
      const p = PW.product(it.productId);
      const stockInfo = isSale && p ? U.el('div', { style: 'font-size:11px;color:#7b8794;margin-top:2px' }, 'Tồn: ' + U.num(PW.stockOf(p.id))) : null;

      const tr = U.el('tr', null, [
        U.el('td', { class: 'center' }, String(idx + 1)),
        U.el('td', null, [prodSel, stockInfo].filter(Boolean)),
        U.el('td', { style: 'width:90px' }, qtyI),
        U.el('td', { style: 'width:130px' }, priceI),
        U.el('td', { class: 'num', style: 'width:130px' }, lineTotal),
        U.el('td', { class: 'center', style: 'width:40px' },
          U.el('button', { class: 'btn sm danger', onclick: () => { items.splice(idx, 1); if (!items.length) items.push({ productId: '', qty: 1, [unitField]: 0 }); drawItems(); calc(); } }, '×')),
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

  const addBtn = C.btn('+ Thêm dòng', () => { items.push({ productId: '', qty: 1, [unitField]: 0 }); drawItems(); calc(); }, 'sm');

  const header = U.el('div', { class: 'form-grid' }, [
    C.field('Số chứng từ', codeI),
    C.field('Ngày', dateI, { required: true }),
    C.field('Điều khoản thanh toán', termSel),
    C.field('Hạn thanh toán (để trống = không hạn)', dueI),
    C.field(partnerLabel, partnerI, { required: true, full: true }),
  ]);

  const summary = U.el('div', { style: 'margin-top:14px;display:flex;flex-direction:column;gap:8px;align-items:flex-end' }, [
    U.el('div', null, [U.el('span', { class: 'text-muted' }, 'Tổng tiền hàng: '), totalCell, ' đ']),
    U.el('div', { style: 'display:flex;align-items:center;gap:10px' }, [U.el('span', { class: 'text-muted' }, 'Giảm giá: '), discountI]),
    U.el('div', null, [U.el('span', { class: 'text-muted' }, 'THÀNH TIỀN: '), grandCell]),
    U.el('div', { style: 'display:flex;align-items:center;gap:10px' }, [U.el('span', { class: 'text-muted' }, (isSale ? 'Đã thu: ' : 'Đã trả: ')), paidI]),
    U.el('div', { style: 'display:flex;align-items:center;gap:10px' }, [U.el('span', { class: 'text-muted' }, 'Vào/ra tài khoản: '), paidAccI]),
    U.el('div', null, [U.el('span', { class: 'text-muted' }, 'Còn nợ: '), remainCell]),
  ]);

  const body = U.el('div', null, [
    header,
    U.el('div', { class: 'section-sub mt16', style: 'font-weight:600;color:#2c3a47' }, 'Chi tiết hàng hóa'),
    U.el('div', { class: 'table-wrap' }, itemsTable),
    U.el('div', { class: 'mt8' }, addBtn),
    C.field('Diễn giải', noteI, { full: true }),
    summary,
  ]);

  drawItems(); calc();

  C.modal({
    title, wide: true, body,
    footer: [C.btn('Hủy', C.closeModal), C.btn('Lưu chứng từ', () => {
      const valid = items.filter(it => it.productId && Number(it.qty) > 0);
      if (!valid.length) return U.toast('Thêm ít nhất 1 dòng hàng hợp lệ', 'error');
      if (!partnerI.value) return U.toast('Chọn ' + partnerLabel.toLowerCase(), 'error');
      const obj = {
        id: doc.id || PW.uid(),
        code: codeI.value, date: dateI.value, dueDate: dueI.value || null,
        [partnerKey]: partnerI.value,
        items: valid.map(it => ({ productId: it.productId, qty: Number(it.qty), [unitField]: Number(it[unitField]) })),
        discount: Number(discountI.value) || 0,
        paid: Number(paidI.value) || 0,
        paidAccountId: (Number(paidI.value) || 0) > 0 ? paidAccI.value : null,
        note: noteI.value,
      };
      onSave(obj);
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
    <div class="company">PARTY WORLD — Thế giới đồ tiệc</div>
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
