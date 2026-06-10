/* ============================================================
   modules9.js — Sản xuất & Giá thành (cho xưởng tranh DALI)
   Lệnh sản xuất: tiêu hao NVL theo định mức (BOM), nhập thành
   phẩm, tính giá vốn thật = NVL + công thợ + chi phí khác.
   ============================================================ */

M.production = function (root) {
  const card = U.el('div', { class: 'card' });
  const toolbar = U.el('div', { class: 'toolbar' });
  toolbar.appendChild(U.el('div', { class: 'card-title', style: 'margin:0' }, '🏭 Lệnh sản xuất'));
  toolbar.appendChild(U.el('div', { class: 'spacer' }));
  toolbar.appendChild(C.btn('+ Lập lệnh sản xuất', () => M.productionForm(), 'primary'));
  card.appendChild(toolbar);
  const host = U.el('div');
  card.appendChild(host);
  root.appendChild(card);

  function draw() {
    const rows = PW.data.productionOrders.slice().sort((a, b) => (b.date + b.code).localeCompare(a.date + a.code));
    host.innerHTML = '';
    host.appendChild(C.table(rows, [
      { label: 'Ngày', render: po => U.date(po.date) },
      { label: 'Số lệnh', render: po => U.esc(po.code) },
      { label: 'Thành phẩm', render: po => { const p = PW.product(po.productId); return p ? U.esc(p.name) : ''; } },
      { label: 'SL sản xuất', num: true, render: po => U.num(po.qty) },
      { label: 'Tổng giá thành', num: true, render: po => U.money(PW.productionTotalCost(po)) },
      { label: 'Giá thành/đv', num: true, render: po => `<b>${U.money(PW.productionUnitCost(po))}</b>` },
      { label: '', render: po => C.actions([
          { label: 'Sửa', onClick: () => M.productionForm(po) },
          { label: 'Xóa', cls: 'danger', onClick: () => {
              if (U.confirm('Xóa lệnh sản xuất ' + po.code + '?')) {
                PW.data.productionOrders = PW.data.productionOrders.filter(x => x.id !== po.id);
                PW.save(); App.refresh(); U.toast('Đã xóa');
              }
            } },
        ]) },
    ], { empty: 'Chưa có lệnh sản xuất. Bấm "Lập lệnh sản xuất".' }));
  }
  draw();
};

M.productionForm = function (po) {
  const isNew = !po;
  po = po ? JSON.parse(JSON.stringify(po)) : {
    code: PW.nextCode('SX'), date: U.today(),
    productId: (PW.data.products.find(p => p.bom && p.bom.length) || PW.data.products[0] || {}).id || '',
    qty: 1, materials: [], laborCost: 0, otherCost: 0, note: '', updateCost: true,
  };

  const codeI = C.input({ value: po.code });
  const dateI = C.input({ type: 'date', value: po.date });
  const prodSel = C.select(PW.data.products.map(p => ({ value: p.id, label: p.code + ' - ' + p.name })), po.productId);
  const qtyI = C.input({ type: 'number', value: po.qty, min: 0, style: 'width:120px;text-align:right' });
  const laborI = C.input({ type: 'number', value: po.laborCost, min: 0, style: 'width:150px;text-align:right' });
  const otherI = C.input({ type: 'number', value: po.otherCost, min: 0, style: 'width:150px;text-align:right' });
  const noteI = C.input({ value: po.note || '' });
  const updateChk = U.el('input', { type: 'checkbox' }); if (po.updateCost !== false) updateChk.checked = true;

  let materials = (po.materials || []).map(m => Object.assign({}, m));
  const matBody = U.el('tbody');
  const matCostCell = U.el('span'), totalCell = U.el('span', { style: 'font-weight:700' }), unitCell = U.el('span', { style: 'font-weight:700;color:var(--teal-d)' });

  function matCost() {
    return materials.reduce((s, m) => { const p = PW.product(m.productId); return s + (Number(m.qty) || 0) * Number(p ? p.cost : 0); }, 0);
  }
  function calc() {
    const mc = matCost();
    const total = mc + (Number(laborI.value) || 0) + (Number(otherI.value) || 0);
    const q = Number(qtyI.value) || 0;
    matCostCell.textContent = U.money(mc) + ' đ';
    totalCell.textContent = U.money(total) + ' đ';
    unitCell.textContent = U.money(q > 0 ? total / q : 0) + ' đ/đv';
  }
  function drawMats() {
    matBody.innerHTML = '';
    materials.forEach((m, idx) => {
      const sel = C.select([{ value: '', label: '-- NVL --' }].concat(PW.data.products.map(p => ({ value: p.id, label: p.code + ' - ' + p.name }))), m.productId);
      sel.addEventListener('change', () => { m.productId = sel.value; drawMats(); calc(); });
      const q = U.el('input', { type: 'number', value: m.qty, min: 0, style: 'text-align:right' });
      q.addEventListener('input', () => { m.qty = Number(q.value) || 0; lt(); });
      const p = PW.product(m.productId);
      const costTxt = U.el('span');
      function lt() { costTxt.textContent = U.money((Number(m.qty) || 0) * Number(p ? p.cost : 0)); calc(); }
      lt();
      matBody.appendChild(U.el('tr', null, [
        U.el('td', { class: 'center' }, String(idx + 1)),
        U.el('td', null, [sel, p ? U.el('div', { style: 'font-size:11px;color:#7b8794' }, 'Tồn: ' + U.num(PW.stockOf(p.id)) + ' · vốn ' + U.money(p.cost)) : null].filter(Boolean)),
        U.el('td', { style: 'width:90px' }, q),
        U.el('td', { class: 'num', style: 'width:120px' }, costTxt),
        U.el('td', { class: 'center', style: 'width:40px' }, U.el('button', { class: 'btn sm danger', onclick: () => { materials.splice(idx, 1); drawMats(); calc(); } }, '×')),
      ]));
    });
  }
  function fillFromBom() {
    const p = PW.product(prodSel.value);
    const q = Number(qtyI.value) || 0;
    if (!p || !p.bom || !p.bom.length) { U.toast('Thành phẩm này chưa có định mức NVL. Vào Hàng hóa để khai báo.', 'error'); return; }
    materials = p.bom.map(b => ({ productId: b.materialId, qty: Number(b.qty) * q }));
    drawMats(); calc();
  }
  // tự nạp theo định mức khi đổi thành phẩm / số lượng
  prodSel.addEventListener('change', () => { const p = PW.product(prodSel.value); if (p && p.bom && p.bom.length) fillFromBom(); });
  qtyI.addEventListener('input', () => { const p = PW.product(prodSel.value); if (p && p.bom && p.bom.length) fillFromBom(); else calc(); });
  laborI.addEventListener('input', calc);
  otherI.addEventListener('input', calc);

  const matTable = U.el('table', { class: 'items-tbl' });
  matTable.appendChild(U.el('thead', null, U.el('tr', null, [
    U.el('th', { style: 'width:36px' }, '#'), U.el('th', null, 'Nguyên vật liệu'), U.el('th', null, 'SL tiêu hao'),
    U.el('th', { class: 'num' }, 'Thành tiền'), U.el('th', null, ''),
  ])));
  matTable.appendChild(matBody);

  const body = U.el('div', null, [
    U.el('div', { class: 'form-grid' }, [
      C.field('Số lệnh', codeI),
      C.field('Ngày', dateI, { required: true }),
      C.field('Thành phẩm sản xuất', prodSel, { required: true, full: true }),
      C.field('Số lượng sản xuất', qtyI),
    ]),
    U.el('div', { class: 'toolbar', style: 'margin:14px 0 4px' }, [
      U.el('div', { style: 'font-weight:600' }, 'Nguyên vật liệu tiêu hao'),
      U.el('div', { class: 'spacer' }),
      C.btn('📋 Lấy theo định mức', fillFromBom, 'sm'),
      C.btn('+ Thêm NVL', () => { materials.push({ productId: '', qty: 0 }); drawMats(); }, 'sm'),
    ]),
    U.el('div', { class: 'table-wrap' }, matTable),
    U.el('div', { style: 'margin-top:12px;display:flex;flex-direction:column;gap:6px;align-items:flex-end' }, [
      U.el('div', null, [U.el('span', { class: 'text-muted' }, 'Tổng NVL: '), matCostCell]),
      U.el('div', { style: 'display:flex;align-items:center;gap:10px' }, [U.el('span', { class: 'text-muted' }, 'Công thợ: '), laborI]),
      U.el('div', { style: 'display:flex;align-items:center;gap:10px' }, [U.el('span', { class: 'text-muted' }, 'Chi phí khác: '), otherI]),
      U.el('div', null, [U.el('span', { class: 'text-muted' }, 'TỔNG GIÁ THÀNH: '), totalCell]),
      U.el('div', null, [U.el('span', { class: 'text-muted' }, 'GIÁ THÀNH ĐƠN VỊ: '), unitCell]),
    ]),
    C.field('Diễn giải', noteI, { full: true }),
    U.el('label', { class: 'radio', style: 'margin-top:8px' }, [updateChk, ' Cập nhật giá vốn thành phẩm = giá thành đơn vị này']),
  ]);

  drawMats(); calc();

  C.modal({
    title: isNew ? 'Lập lệnh sản xuất' : 'Sửa lệnh sản xuất', wide: true, body,
    footer: [C.btn('Hủy', C.closeModal), C.btn('Lưu', () => {
      const valid = materials.filter(m => m.productId && Number(m.qty) > 0);
      if (!prodSel.value) return U.toast('Chọn thành phẩm', 'error');
      if (!(Number(qtyI.value) > 0)) return U.toast('Nhập số lượng sản xuất', 'error');
      const obj = {
        id: po.id || PW.uid(), code: codeI.value, date: dateI.value,
        productId: prodSel.value, qty: Number(qtyI.value),
        materials: valid.map(m => ({ productId: m.productId, qty: Number(m.qty) })),
        laborCost: Number(laborI.value) || 0, otherCost: Number(otherI.value) || 0,
        note: noteI.value, updateCost: updateChk.checked,
      };
      if (isNew) PW.data.productionOrders.push(obj);
      else { const i = PW.data.productionOrders.findIndex(x => x.id === obj.id); PW.data.productionOrders[i] = obj; }
      // Cập nhật giá vốn thành phẩm nếu chọn
      if (updateChk.checked) {
        const p = PW.product(obj.productId);
        if (p) p.cost = Math.round(PW.productionUnitCost(obj));
      }
      PW.save(); C.closeModal(); App.refresh(); U.toast('Đã lưu lệnh sản xuất');
    }, 'primary')],
  });
};
