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
  // Thành phẩm sản xuất = bộ chọn CÓ TÌM KIẾM, chỉ thành phẩm (hoặc món có định mức / đang chọn)
  const onProd = () => { const p = PW.product(prodSel.ppValue()); if (p && p.bom && p.bom.length) fillFromBom(); else { drawMats(); calc(); } veNhacLoai(); };
  /* Đầu ra của sản xuất. Trước đây chỉ cho chọn tính chất "Thành phẩm" nên ô này
     gần như rỗng: nhiều xưởng khai sản phẩm mình tự làm là "Hàng hóa" (mã HH), và
     hàng nhập từ sổ cũ thì KHÔNG CÓ trường kind nào cả.
     Nên lọc theo chiều ngược lại — loại ra những thứ chắc chắn không phải đầu ra
     (nguyên vật liệu, công cụ, dịch vụ, combo); chúng là ĐẦU VÀO, khai ở bảng dưới.
     Món nào có định mức sẵn hoặc đang được chọn thì luôn giữ. */
  const KHONG_PHAI_DAU_RA = ['nvl', 'ccdc', 'dichvu', 'combo'];
  const prodSel = M.productPicker(po.productId, onProd, { isSale: false,
    filter: p => KHONG_PHAI_DAU_RA.indexOf(p.kind) < 0
      || (p.bom && p.bom.length) || p.id === po.productId });
  // Nhắc phân loại khi chọn phải một mặt hàng đang để "Hàng hóa"
  const nhacLoai = U.el('div', { class: 'text-muted', style: 'font-size:11.5px;margin-top:4px' });
  function veNhacLoai() {
    const p = PW.product(prodSel.ppValue());
    nhacLoai.innerHTML = (p && p.kind === 'hanghoa')
      ? '💡 Mặt hàng này đang để tính chất <b>Hàng hóa</b>. Nếu đây là hàng bạn tự in / tự sản xuất '
        + 'thì nên đổi sang <b>Thành phẩm</b> trong Danh mục hàng hóa cho đúng bản chất.'
      : '';
  }
  const qtyI = C.input({ type: 'number', value: po.qty, min: 0, style: 'width:120px;text-align:right' });
  const laborI = C.input({ type: 'number', value: po.laborCost, min: 0, style: 'width:150px;text-align:right' });
  const otherI = C.input({ type: 'number', value: po.otherCost, min: 0, style: 'width:150px;text-align:right' });
  const noteI = C.input({ value: po.note || '' });
  const updateChk = U.el('input', { type: 'checkbox' }); if (po.updateCost !== false) updateChk.checked = true;

  let materials = (po.materials || []).map(m => Object.assign({}, m));
  const matBody = U.el('tbody');
  const matCostCell = U.el('span'), totalCell = U.el('span', { style: 'font-weight:700' }), unitCell = U.el('span', { style: 'font-weight:700;color:var(--teal-d)' });

  function matCost() {
    return materials.reduce((s, m) => {
      const dg = (m.cost != null && m.cost !== '') ? Number(m.cost) : Number(PW.unitCost(PW.product(m.productId)) || 0);
      return s + (Number(m.qty) || 0) * (dg || 0);
    }, 0);
  }
  function calc() {
    const mc = matCost();
    const total = mc + (Number(laborI.value) || 0) + (Number(otherI.value) || 0);
    const q = Number(qtyI.value) || 0;
    matCostCell.textContent = U.money(mc) + ' đ';
    totalCell.textContent = U.money(total) + ' đ';
    unitCell.textContent = U.money(q > 0 ? total / q : 0) + ' đ/đv';
  }
  // Đơn giá mặc định của một dòng: giá vốn đang khai ở danh mục hàng hóa
  const giaMacDinh = pid => { const p = PW.product(pid); return p ? Number(PW.unitCost(p) || 0) : 0; };

  function drawMats() {
    matBody.innerHTML = '';
    materials.forEach((m, idx) => {
      const sel = M.materialSelect(prodSel.ppValue() || '', m.productId);   // loại thành phẩm/combo/dịch vụ, gom theo kích thước
      sel.addEventListener('change', () => {
        m.productId = sel.value;
        m.cost = giaMacDinh(sel.value);     // đổi NVL -> lấy lại giá vốn của món mới
        drawMats(); calc();
      });
      if (m.cost == null || m.cost === '') m.cost = giaMacDinh(m.productId);
      const q = U.el('input', { type: 'number', value: m.qty, min: 0, step: '0.001', style: 'text-align:right' });
      /* Đơn giá và Thành tiền đều NHẬP ĐƯỢC, giống bảng hàng trên hóa đơn:
         mua cả lô thì biết tổng tiền trước, còn đơn giá là phép chia. Và nhiều
         mặt hàng mới khai chưa có giá vốn (bằng 0) nên phải gõ tay được ở đây,
         không thì giá thành sản xuất ra 0. */
      const dg = C.money({ value: m.cost, style: 'text-align:right' });
      const tt = C.money({ value: Math.round((Number(m.qty) || 0) * (Number(m.cost) || 0)), style: 'text-align:right' });
      const ghi = U.el('div', { style: 'font-size:11px;color:#7b8794;margin-top:2px' });

      function veTong() {                        // đơn giá là cái bất biến khi đổi SL
        tt.datSoTien(Math.round((Number(m.qty) || 0) * (Number(m.cost) || 0)));
        ghi.textContent = ''; calc();
      }
      q.addEventListener('input', () => { m.qty = Number(q.value) || 0; veTong(); });
      dg.addEventListener('input', () => { m.cost = dg.soTien(); veTong(); });
      tt.addEventListener('input', () => {
        const sl = Number(m.qty) || 0;
        if (sl <= 0) { ghi.textContent = 'Nhập SL tiêu hao trước thì mới chia ra đơn giá được'; return; }
        m.cost = tt.soTien() / sl;               // giữ số lẻ để tổng tiền khớp đúng
        dg.datSoTien(m.cost);
        ghi.textContent = Math.round(m.cost) !== m.cost
          ? 'Đơn giá lẻ ' + m.cost.toLocaleString('vi-VN', { maximumFractionDigits: 2 }) : '';
        calc();
      });

      const p = PW.product(m.productId);
      matBody.appendChild(U.el('tr', null, [
        U.el('td', { class: 'center' }, String(idx + 1)),
        U.el('td', null, [sel, p ? U.el('div', { style: 'font-size:11px;color:#7b8794' },
          'Tồn: ' + U.num(PW.stockOf(p.id)) + ' · vốn danh mục ' + U.money(PW.unitCost(p))) : null].filter(Boolean)),
        U.el('td', { style: 'width:90px' }, q),
        U.el('td', { style: 'width:120px' }, dg),
        U.el('td', { style: 'width:130px' }, [tt, ghi]),
        U.el('td', { class: 'center', style: 'width:40px' }, U.el('button', { class: 'btn sm danger', type: 'button', onclick: () => { materials.splice(idx, 1); drawMats(); calc(); } }, '×')),
      ]));
    });
  }
  /* Khai định mức ngay trong lệnh sản xuất thay vì phải thoát ra màn Hàng hóa.
     Định mức lưu cho MỘT đơn vị thành phẩm nên phải chia cho số lượng sản xuất. */
  function luuDinhMuc() {
    const p = PW.product(prodSel.ppValue());
    if (!p) return U.toast('Chọn thành phẩm sản xuất trước', 'error');
    const q = Number(qtyI.value) || 0;
    if (!(q > 0)) return U.toast('Nhập số lượng sản xuất trước — định mức tính cho 1 đơn vị', 'error');
    const ds = materials.filter(m => m.productId && Number(m.qty) > 0);
    if (!ds.length) return U.toast('Khai nguyên vật liệu tiêu hao trước đã', 'error');

    const bom = ds.map(m => ({ materialId: m.productId, qty: Number(m.qty) / q }));
    const xem = bom.map(b => {
      const mp = PW.product(b.materialId);
      return '· ' + (mp ? mp.name : b.materialId) + ': ' + U.num(Math.round(b.qty * 1000) / 1000) + ' ' + (mp && mp.unit ? mp.unit : '');
    }).join('\n');
    /* Nhiều NVL mới khai chưa có giá vốn trong danh mục (bằng 0). Nếu chỉ lưu định
       mức thì lần sau "Lấy theo định mức" ra đúng số lượng nhưng đơn giá vẫn 0,
       phải gõ lại giá mỗi lần. Nên ghi luôn giá vừa gõ vào danh mục — CHỈ cho món
       đang để 0, không bao giờ đè lên giá vốn đã có. */
    const themGia = ds.filter(m => Number(m.cost) > 0 && Number(PW.unitCost(PW.product(m.productId)) || 0) === 0);
    const xemGia = themGia.map(m => {
      const mp = PW.product(m.productId);
      return '· ' + (mp ? mp.name : '') + ': ' + U.money(m.cost) + ' đ/' + (mp && mp.unit ? mp.unit : 'đv');
    }).join('\n');

    const daCo = p.bom && p.bom.length;
    if (!U.confirm((daCo ? 'GHI ĐÈ định mức hiện có của ' : 'Lưu định mức cho ') + p.name
      + '?\n\nĐịnh mức cho 1 ' + (p.unit || 'đơn vị') + ':\n' + xem
      + (themGia.length ? '\n\nĐồng thời ghi giá vốn cho NVL chưa có giá:\n' + xemGia : ''))) return;

    themGia.forEach(m => { const mp = PW.product(m.productId); if (mp) mp.cost = Number(m.cost) || 0; });
    p.bom = bom;
    PW.logActivity('update', 'product', (p.code || '') + ' ' + p.name, 'khai định mức ' + bom.length + ' NVL');
    PW.save();
    U.toast('Đã lưu định mức cho ' + p.name
      + (themGia.length ? ' và giá vốn cho ' + themGia.length + ' nguyên vật liệu' : '')
      + ' — lần sau bấm "Lấy theo định mức"');
  }

  function fillFromBom() {
    const p = PW.product(prodSel.ppValue());
    const q = Number(qtyI.value) || 0;
    if (!p || !p.bom || !p.bom.length) {
      U.toast('Chưa có định mức. Khai nguyên vật liệu bên dưới rồi bấm "Lưu thành định mức" — lần sau lấy lại một nút.', 'error');
      return;
    }
    materials = p.bom.map(b => ({ productId: b.materialId, qty: Number(b.qty) * q, cost: giaMacDinh(b.materialId) }));
    drawMats(); calc();
  }
  // tự nạp theo định mức khi đổi số lượng (đổi thành phẩm -> onProd ở trên xử lý)
  qtyI.addEventListener('input', () => { const p = PW.product(prodSel.ppValue()); if (p && p.bom && p.bom.length) fillFromBom(); else calc(); });
  laborI.addEventListener('input', calc);
  otherI.addEventListener('input', calc);

  const matTable = U.el('table', { class: 'items-tbl' });
  matTable.appendChild(U.el('thead', null, U.el('tr', null, [
    U.el('th', { style: 'width:36px' }, '#'), U.el('th', null, 'Nguyên vật liệu'), U.el('th', null, 'SL tiêu hao'),
    U.el('th', null, 'Đơn giá'), U.el('th', { class: 'num' }, 'Thành tiền'), U.el('th', null, ''),
  ])));
  matTable.appendChild(matBody);

  const body = U.el('div', null, [
    U.el('div', { class: 'form-grid' }, [
      C.field('Số lệnh', codeI),
      C.field('Ngày', dateI, { required: true }),
      C.field('Thành phẩm sản xuất', U.el('div', null, [prodSel, nhacLoai]), { required: true, full: true }),
      C.field('Số lượng sản xuất', qtyI),
    ]),
    U.el('div', { class: 'toolbar', style: 'margin:14px 0 4px' }, [
      U.el('div', { style: 'font-weight:600' }, 'Nguyên vật liệu tiêu hao'),
      U.el('div', { class: 'spacer' }),
      C.btn('📋 Lấy theo định mức', fillFromBom, 'sm'),
      C.btn('💾 Lưu thành định mức', luuDinhMuc, 'sm'),
      C.btn('+ Thêm NVL', () => { materials.push({ productId: '', qty: 0, cost: 0 }); drawMats(); }, 'sm'),
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

  drawMats(); calc(); veNhacLoai();

  C.modal({
    title: isNew ? 'Lập lệnh sản xuất' : 'Sửa lệnh sản xuất', wide: true, body,
    footer: [C.btn('Hủy', C.closeModal), C.btn('Lưu', () => {
      const valid = materials.filter(m => m.productId && Number(m.qty) > 0);
      if (!prodSel.ppValue()) return U.toast('Chọn thành phẩm', 'error');
      if (!(Number(qtyI.value) > 0)) return U.toast('Nhập số lượng sản xuất', 'error');
      const obj = {
        id: po.id || PW.uid(), code: codeI.value, date: dateI.value,
        productId: prodSel.ppValue(), qty: Number(qtyI.value),
        // Lưu kèm đơn giá của từng dòng để giá thành trong sổ đúng bằng số đang
        // hiện trên form, kể cả khi sau này giá vốn ở danh mục thay đổi.
        materials: valid.map(m => ({ productId: m.productId, qty: Number(m.qty), cost: Number(m.cost) || 0 })),
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
