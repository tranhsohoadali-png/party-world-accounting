/* ============================================================
   modules17.js — Hệ thống IN dùng chung
   - Thông tin doanh nghiệp (header chứng từ) lưu ở PW.data.meta.company
   - M.printHTML: bọc nội dung + CSS + khổ giấy (A4 / A5 / 80mm máy in nhiệt)
     rồi mở cửa sổ in (in qua hộp thoại trình duyệt -> máy in bất kỳ).
   - M.printInvoice: hóa đơn bán bản đẹp (có VAT, công ty).
   - M.deliveryNote: PHIẾU GIAO HÀNG (chứng từ giao hàng / thu hộ COD).
   ============================================================ */

M.company = function () {
  const c = (PW.data.meta && PW.data.meta.company) || {};
  return {
    name: c.name || (PW.data.meta && PW.data.meta.companyName) || 'DALI — Tô điểm cuộc sống',
    address: c.address || '', phone: c.phone || '', mst: c.mst || '',
    bank: c.bank || '', note: c.note || '', printSize: c.printSize || 'A4',
  };
};
M._logoUrl = function () { try { return new URL('assets/logo-dali.png', location.href).href; } catch (e) { return ''; } };

// Bọc nội dung -> trang in hoàn chỉnh + tự bật hộp thoại in
M.printHTML = function (title, innerHtml, size) {
  size = size || M.company().printSize || 'A4';
  const page = {
    'A4': '@page{size:A4;margin:13mm}',
    'A5': '@page{size:A5;margin:9mm}',
    '80': '@page{size:80mm auto;margin:3mm}',
  }[size] || '@page{size:A4;margin:13mm}';
  const narrow = size === '80';
  const html = '<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>' + U.esc(title) + '</title><style>'
    + page
    + '*{box-sizing:border-box}'
    + 'body{font-family:\'Segoe UI\',Roboto,Arial,sans-serif;color:#1f2a16;margin:0;'
    + (narrow ? 'width:74mm;font-size:12px}' : 'font-size:13.5px}')
    + '.ph-head{display:flex;align-items:center;gap:14px;border-bottom:2px solid #7cb342;padding-bottom:10px;margin-bottom:14px}'
    + (narrow ? '.ph-head{flex-direction:column;text-align:center;gap:4px}' : '')
    + '.ph-logo{height:' + (narrow ? '40' : '56') + 'px;width:auto}'
    + '.ph-name{font-weight:800;color:#5a8e2e;font-size:' + (narrow ? '15' : '18') + 'px}'
    + '.ph-co div{font-size:' + (narrow ? '11' : '12.5') + 'px;color:#444;line-height:1.5}'
    + 'h1.doc-title{text-align:center;font-size:' + (narrow ? '16' : '22') + 'px;margin:6px 0 2px;letter-spacing:.5px}'
    + '.doc-sub{text-align:center;color:#555;margin-bottom:12px;font-size:12.5px}'
    + '.party{line-height:1.7;margin:8px 0}'
    + 'table.it{width:100%;border-collapse:collapse;margin-top:8px}'
    + 'table.it th,table.it td{border:1px solid #b9c4a8;padding:' + (narrow ? '4px 5px' : '7px 9px') + ';font-size:' + (narrow ? '11' : '12.5') + 'px}'
    + 'table.it th{background:#eef6e1;text-align:left}'
    + 'table.it tfoot{display:table-row-group}'   // tổng chỉ hiện 1 lần ở CUỐI, không lặp mỗi trang
    + 'table.it tfoot tr{break-inside:avoid}'
    + '.r{text-align:right}.c{text-align:center}'
    + '.tot{text-align:right;margin-top:6px}.tot.big{font-size:' + (narrow ? '14' : '16') + 'px;font-weight:800;color:#5a8e2e}'
    + '.cod{margin-top:10px;padding:8px 10px;border:1.5px dashed #e0922a;border-radius:8px;background:#fff6e5;font-size:' + (narrow ? '13' : '15') + 'px}'
    + '.note{margin-top:10px;font-style:italic;color:#555}'
    + '.sign{display:flex;justify-content:space-around;margin-top:' + (narrow ? '24' : '46') + 'px;text-align:center;font-size:12.5px}'
    + '.sign i{color:#777;font-weight:400}'
    + '.foot{text-align:center;color:#777;margin-top:16px;font-size:11.5px}'
    + '</style></head><body>' + innerHtml
    + '<script>window.onload=function(){setTimeout(function(){window.print()},120)}<\/script></body></html>';
  const w = window.open('', '_blank');
  if (!w) { U.toast('Trình duyệt chặn cửa sổ in — hãy cho phép pop-up rồi thử lại.', 'error'); return; }
  w.document.write(html); w.document.close();
};

M._companyHeader = function () {
  const c = M.company();
  return '<div class="ph-head">'
    + (M._logoUrl() ? '<img class="ph-logo" src="' + M._logoUrl() + '" onerror="this.style.display=\'none\'">' : '')
    + '<div class="ph-co"><div class="ph-name">' + U.esc(c.name) + '</div>'
    + (c.address ? '<div>Địa chỉ: ' + U.esc(c.address) + '</div>' : '')
    + ((c.phone || c.mst) ? '<div>' + (c.phone ? 'ĐT: ' + U.esc(c.phone) : '') + (c.phone && c.mst ? ' · ' : '') + (c.mst ? 'MST: ' + U.esc(c.mst) : '') + '</div>' : '')
    + '</div></div>';
};

// Bảng hàng hóa dùng chung (showPrice=false -> ẩn cột giá, cho phiếu giao gọn)
M._itemRows = function (doc, showPrice) {
  return doc.items.map((it, i) => {
    const p = PW.product(it.productId);
    const price = Number(it.price != null ? it.price : it.cost || 0);
    const lt = Number(it.qty) * price;
    return '<tr><td class="c">' + (i + 1) + '</td><td>' + U.esc(p ? (p.code ? p.code + ' - ' : '') + p.name : '') + '</td>'
      + '<td class="c">' + U.esc(p ? p.unit : '') + '</td><td class="r">' + U.num(it.qty) + '</td>'
      + (showPrice ? '<td class="r">' + U.money(price) + '</td><td class="r">' + U.money(lt) + '</td>' : '') + '</tr>';
  }).join('');
};

/* ---------- Hóa đơn bán (bản đẹp, có VAT + công ty) ---------- */
M.printInvoice = function (si, size) {
  const cus = PW.customer(si.customerId);
  const sub = PW.invoiceTotal(si);
  const vat = Math.round(sub * Number(si.vatRate || 0) / 100);
  const grand = sub + vat;
  const head = '<th class="c" style="width:34px">STT</th><th>Tên hàng hóa</th><th class="c">ĐVT</th><th class="r">SL</th><th class="r">Đơn giá</th><th class="r">Thành tiền</th>';
  const inner = M._companyHeader()
    + '<h1 class="doc-title">HÓA ĐƠN BÁN HÀNG</h1>'
    + '<div class="doc-sub">Số: ' + U.esc(si.code) + ' &nbsp;·&nbsp; Ngày ' + U.date(si.date) + '</div>'
    + '<div class="party"><b>Khách hàng:</b> ' + U.esc(cus ? cus.name : '') + '<br>'
    + '<b>Điện thoại:</b> ' + U.esc(cus ? cus.phone : '') + ' &nbsp; <b>Địa chỉ:</b> ' + U.esc(cus ? cus.address : '')
    + (cus && cus.taxCode ? '<br><b>MST:</b> ' + U.esc(cus.taxCode) : '') + '</div>'
    + '<table class="it"><thead><tr>' + head + '</tr></thead><tbody>' + M._itemRows(si, true) + '</tbody>'
    + '<tfoot>'
    + '<tr><td colspan="5" class="r">Cộng tiền hàng</td><td class="r">' + U.money(sub) + '</td></tr>'
    + (Number(si.vatRate) ? '<tr><td colspan="5" class="r">Thuế GTGT (' + si.vatRate + '%)</td><td class="r">' + U.money(vat) + '</td></tr>' : '')
    + '<tr><td colspan="5" class="r" style="font-weight:800;color:#5a8e2e">TỔNG THANH TOÁN</td><td class="r" style="font-weight:800;color:#5a8e2e">' + U.money(grand) + '</td></tr>'
    + '<tr><td colspan="5" class="r">Đã thu</td><td class="r">' + U.money(si.paid || 0) + '</td></tr>'
    + '<tr><td colspan="5" class="r"><b>Còn lại</b></td><td class="r"><b>' + U.money(grand - (si.paid || 0)) + '</b></td></tr>'
    + '</tfoot></table>'
    + (si.note ? '<div class="note">Ghi chú: ' + U.esc(si.note) + '</div>' : '')
    + '<div class="sign"><div>Người mua hàng<br><i>(Ký, ghi rõ họ tên)</i></div><div>Người bán hàng<br><i>(Ký, ghi rõ họ tên)</i></div></div>'
    + (M.company().note ? '<div class="foot">' + U.esc(M.company().note) + '</div>' : '');
  M.printHTML('Hóa đơn ' + si.code, inner, size);
};

/* ---------- PHIẾU GIAO HÀNG (chứng từ giao hàng + thu hộ COD) ---------- */
M.deliveryNote = function (si, size) {
  const cus = PW.customer(si.customerId);
  const sub = PW.invoiceTotal(si);
  const vat = Math.round(sub * Number(si.vatRate || 0) / 100);
  const grand = sub + vat;
  const cod = grand - Number(si.paid || 0);
  const ch = PW.channel(si.channelId);
  const head = '<th class="c" style="width:34px">STT</th><th>Tên hàng hóa</th><th class="c">ĐVT</th><th class="r">SL</th><th class="r">Đơn giá</th><th class="r">Thành tiền</th>';
  const inner = M._companyHeader()
    + '<h1 class="doc-title">PHIẾU GIAO HÀNG</h1>'
    + '<div class="doc-sub">Số: ' + U.esc(si.code) + ' &nbsp;·&nbsp; Ngày ' + U.date(si.date)
    + (ch ? ' &nbsp;·&nbsp; Kênh: ' + U.esc(ch.name) : '') + (si.trackingCode ? ' &nbsp;·&nbsp; Mã VĐ: ' + U.esc(si.trackingCode) : '') + '</div>'
    + '<div class="party"><b>Người nhận:</b> ' + U.esc(cus ? cus.name : '') + '<br>'
    + '<b>Điện thoại:</b> ' + U.esc(cus ? cus.phone : '') + '<br>'
    + '<b>Địa chỉ giao:</b> ' + U.esc(cus ? cus.address : '') + '</div>'
    + '<table class="it"><thead><tr>' + head + '</tr></thead><tbody>' + M._itemRows(si, true) + '</tbody>'
    + '<tfoot>'
    + '<tr><td colspan="5" class="r">Cộng tiền hàng</td><td class="r">' + U.money(sub) + '</td></tr>'
    + (Number(si.vatRate) ? '<tr><td colspan="5" class="r">Thuế GTGT (' + si.vatRate + '%)</td><td class="r">' + U.money(vat) + '</td></tr>' : '')
    + '<tr><td colspan="5" class="r" style="font-weight:800;color:#5a8e2e">TỔNG GIÁ TRỊ</td><td class="r" style="font-weight:800;color:#5a8e2e">' + U.money(grand) + '</td></tr>'
    + '<tr><td colspan="5" class="r">Đã thanh toán</td><td class="r">' + U.money(si.paid || 0) + '</td></tr>'
    + '</tfoot></table>'
    + (cod > 0
        ? '<div class="cod"><b>TIỀN THU HỘ (COD): ' + U.money(cod) + ' đ</b> — thu của người nhận khi giao.</div>'
        : '<div class="cod" style="border-color:#27ae60;background:#e6f7ee"><b>ĐÃ THANH TOÁN ĐỦ</b> — không thu hộ.</div>')
    + (si.note ? '<div class="note">Ghi chú: ' + U.esc(si.note) + '</div>' : '')
    + '<div class="sign"><div>Người giao hàng<br><i>(Ký, ghi rõ họ tên)</i></div><div>Người nhận hàng<br><i>(Ký, ghi rõ họ tên)</i></div></div>'
    + (M.company().note ? '<div class="foot">' + U.esc(M.company().note) + '</div>' : '');
  M.printHTML('Phiếu giao hàng ' + si.code, inner, size);
};

/* ---------- PHIẾU XUẤT KHO BÁN HÀNG (mẫu chuẩn VN / MISA) ---------- */
M.warehouseIssueNote = function (si, size) {
  const c = M.company();
  const cus = PW.customer(si.customerId);
  const emp = si.employeeId && PW.data.employees ? PW.data.employees.find(e => e.id === si.employeeId) : null;
  const sub = PW.invoiceTotal(si);
  const vat = Math.round(sub * Number(si.vatRate || 0) / 100);
  const grand = sub + vat;
  const accD = c.accDebit || '131';   // Nợ: phải thu khách hàng
  const accC = c.accCredit || '5111';  // Có: doanh thu bán hàng
  const [yy, mm, dd] = (si.date || U.today()).split('-');

  const rows = si.items.map((it, i) => {
    const p = PW.product(it.productId);
    const price = Number(it.price || 0);
    return '<tr><td class="c">' + (i + 1) + '</td><td>' + U.esc(p ? p.code : '') + '</td><td>' + U.esc(p ? p.name : '') + '</td>'
      + '<td class="c">' + U.esc(p ? p.unit : '') + '</td><td class="r">' + U.num(it.qty) + '</td>'
      + '<td class="r">' + U.money(price) + '</td><td class="r">' + U.money(Number(it.qty) * price) + '</td></tr>';
  }).join('');

  const inner =
    '<div style="display:flex;gap:12px;align-items:flex-start">'
    + (M._logoUrl() ? '<img src="' + M._logoUrl() + '" style="height:46px" onerror="this.style.display=\'none\'">' : '')
    + '<div><div style="font-weight:700;text-transform:uppercase">' + U.esc(c.name) + '</div>'
    + (c.address ? '<div style="font-style:italic;font-size:12px">' + U.esc(c.address) + '</div>' : '') + '</div></div>'
    + '<h1 class="doc-title" style="margin-top:14px">PHIẾU XUẤT KHO BÁN HÀNG</h1>'
    + '<div class="doc-sub" style="font-style:italic">Ngày ' + dd + ' tháng ' + mm + ' năm ' + yy + '</div>'
    + '<div class="c" style="margin:-6px 0 12px;font-size:14px">Số: <b>' + U.esc(si.code) + '</b></div>'
    + '<table style="width:100%"><tr>'
    + '<td style="vertical-align:top;line-height:1.9;font-size:13px">'
    + 'Người mua:<br>Tên khách hàng: <b>' + U.esc(cus ? cus.name : '') + '</b><br>'
    + 'Địa chỉ: ' + U.esc(cus ? cus.address : '') + '<br>'
    + 'Điện thoại: ' + U.esc(cus ? cus.phone : '') + '<br>'
    + 'Mã số thuế: ' + U.esc(cus ? (cus.taxCode || '') : '') + '<br>'
    + 'Diễn giải: ' + U.esc(si.note || '') + '<br>'
    + 'Nhân viên bán hàng: ' + U.esc(emp ? emp.name : '') + '</td>'
    + '<td style="vertical-align:top;line-height:1.9;font-size:13px;width:200px">'
    + 'Nợ: ' + U.esc(accD) + '<br>Có: ' + U.esc(accC) + '<br>Loại tiền: VND</td>'
    + '</tr></table>'
    + '<table class="it"><thead><tr><th class="c" style="width:32px">STT</th><th>Mã hàng</th><th>Tên hàng</th>'
    + '<th class="c">Đơn vị</th><th class="r">Số lượng</th><th class="r">Đơn giá</th><th class="r">Thành tiền</th></tr></thead>'
    + '<tbody>' + rows + '</tbody>'
    + '<tfoot>'
    + '<tr><td colspan="6" class="r"><b>Cộng tiền hàng</b></td><td class="r"><b>' + U.money(sub) + '</b></td></tr>'
    + '<tr><td colspan="6" class="r">Thuế GTGT (' + (Number(si.vatRate) || 0) + '%)</td><td class="r">' + U.money(vat) + '</td></tr>'
    + '<tr><td colspan="6" class="r" style="font-weight:800;color:#5a8e2e">TỔNG TIỀN THANH TOÁN</td><td class="r" style="font-weight:800;color:#5a8e2e">' + U.money(grand) + '</td></tr>'
    + '</tfoot></table>'
    + '<div style="margin-top:8px;font-size:13.5px">Số tiền bằng chữ: <i><b>' + U.readMoneyVN(grand) + '</b></i></div>'
    + '<div style="margin-top:4px;font-size:13px">Số chứng từ gốc kèm theo: .....</div>'
    + '<div class="r" style="margin-top:14px;font-style:italic">Ngày ..... tháng ..... năm ........</div>'
    + '<div class="sign"><div>Người mua hàng<br><i>(Ký, họ tên)</i></div><div>Kế toán trưởng<br><i>(Ký, họ tên)</i></div><div>Giám đốc<br><i>(Ký, họ tên, đóng dấu)</i></div></div>';
  M.printHTML('Phiếu xuất kho ' + si.code, inner, size);
};

/* ---------- Menu in: chọn loại chứng từ + khổ giấy ---------- */
M.printMenu = function (si) {
  const sizeSel = C.select([
    { value: 'A4', label: 'Khổ A4 (giấy thường)' },
    { value: 'A5', label: 'Khổ A5 (nửa trang)' },
    { value: '80', label: 'Khổ 80mm (máy in nhiệt / bill)' },
  ], M.company().printSize || 'A4');
  const doc = (fn) => () => { const s = sizeSel.value; C.closeModal(); fn(si, s); };
  C.modal({
    title: 'In chứng từ — ' + si.code,
    body: U.el('div', null, [
      C.field('Khổ giấy', sizeSel),
      U.el('p', { class: 'section-sub', style: 'margin:10px 0 6px' }, 'Chọn loại chứng từ để in:'),
      U.el('div', { class: 'pill-row' }, [
        C.btn('🧾 Phiếu xuất kho bán hàng', doc(M.warehouseIssueNote), 'primary'),
        C.btn('📄 Hóa đơn bán hàng', doc(M.printInvoice)),
        C.btn('🚚 Phiếu giao hàng', doc(M.deliveryNote)),
      ]),
    ]),
  });
};

// Hộp chọn khổ giấy rồi in (dùng khi muốn chọn nhanh A4/A5/80mm)
M.printChooser = function (label, fn) {
  const sizes = [['A4', 'A4 (giấy thường)'], ['A5', 'A5 (nửa trang)'], ['80', '80mm (máy in nhiệt / bill)']];
  const btns = sizes.map(s => C.btn(s[1], () => { C.closeModal(); fn(s[0]); }, s[0] === (M.company().printSize || 'A4') ? 'primary' : ''));
  C.modal({
    title: label,
    body: U.el('div', null, [
      U.el('p', { class: 'section-sub' }, 'Chọn khổ giấy để in. Sau khi bấm, hộp thoại in của trình duyệt sẽ hiện ra — chọn đúng máy in (kể cả máy in nhiệt/tem).'),
      U.el('div', { class: 'pill-row' }, btns),
    ]),
  });
};

/* ============================================================
   NHẬT KÝ HOẠT ĐỘNG (audit log) — A4
   Đọc PW.data.activityLog (ring buffer 2000). Lọc client-side.
   ============================================================ */
M.ACT_ENTITY_LABEL = {
  salesInvoice: 'Hóa đơn bán', purchase: 'Phiếu nhập mua',
  receipt: 'Phiếu thu', payment: 'Phiếu chi', product: 'Hàng hóa',
  customer: 'Khách hàng', supplier: 'Nhà cung cấp', payroll: 'Bảng lương',
  salesReturn: 'Trả lại hàng bán', purchaseReturn: 'Trả lại hàng mua',
  salesDiscount: 'Giảm giá hàng bán', purchaseDiscount: 'Giảm giá hàng mua',
  quotation: 'Báo giá', salesOrder: 'Đơn đặt hàng', purchaseOrder: 'Đơn mua hàng',
};
M.ACT_ACTION = { create: ['Tạo mới', 'green'], update: ['Sửa', 'orange'], delete: ['Xóa', 'red'] };

M.activityLogScreen = function (root) {
  const card = U.el('div', { class: 'card' });
  const log = (PW.data.activityLog || []).slice().reverse(); // mới nhất trước
  const _p2 = n => String(n).padStart(2, '0');
  // Ngày theo MÚI GIỜ ĐỊA PHƯƠNG (ts lưu dạng ISO/UTC)
  function localYmd(ts) { if (!ts) return ''; const d = new Date(ts); return d.getFullYear() + '-' + _p2(d.getMonth() + 1) + '-' + _p2(d.getDate()); }
  function fmtTs(ts) { if (!ts) return ''; const d = new Date(ts); return U.date(localYmd(ts)) + ' ' + _p2(d.getHours()) + ':' + _p2(d.getMinutes()); }
  function actorOpts() { const set = new Set(); log.forEach(x => x.actor && set.add(x.actor)); return [{ value: '', label: 'Tất cả' }].concat([...set].sort().map(a => ({ value: a, label: a }))); }
  function entityOpts() { return [{ value: '', label: 'Tất cả' }].concat(Object.keys(M.ACT_ENTITY_LABEL).map(k => ({ value: k, label: M.ACT_ENTITY_LABEL[k] }))); }
  function actionOpts() { return [{ value: '', label: 'Tất cả' }].concat(Object.keys(M.ACT_ACTION).map(k => ({ value: k, label: M.ACT_ACTION[k][0] }))); }

  const fb = M.filterBar({
    storageKey: 'activityLog',
    onChange: draw,
    fields: [
      { type: 'period', key: 'period', label: 'Kỳ', default: 'thisMonth', presets: ['today', 'thisWeek', 'thisMonth', 'lastMonth', 'ytd', 'thisYear', 'all', 'custom'] },
      { type: 'select', key: 'actor', label: 'Người', source: actorOpts },
      { type: 'select', key: 'entity', label: 'Loại', source: entityOpts },
      { type: 'select', key: 'action', label: 'Hành động', source: actionOpts },
      { type: 'search', key: 'q', placeholder: 'Tìm mã/tên/chi tiết...' },
    ],
    actions: [C.btn('📊 Xuất Excel', doExport)],
  });
  card.appendChild(fb.el);
  const host = U.el('div'); card.appendChild(host); root.appendChild(card);

  function rows() {
    return M.applyFilter(log, fb.getState(), {
      date: x => localYmd(x.ts),
      actor: x => x.actor,
      entity: x => x.entity,
      action: x => x.action,
      text: x => (x.name || '') + ' ' + (x.detail || ''),
    });
  }
  function draw() {
    host.innerHTML = '';
    host.appendChild(C.table(rows(), [
      { label: 'Thời gian', render: x => fmtTs(x.ts) },
      { label: 'Người', render: x => U.esc(x.actor) },
      { label: 'Hành động', center: true, render: x => { const a = M.ACT_ACTION[x.action] || [x.action, 'gray']; return '<span class="tag ' + a[1] + '">' + a[0] + '</span>'; } },
      { label: 'Loại', render: x => U.esc(M.ACT_ENTITY_LABEL[x.entity] || x.entity) },
      { label: 'Mã / Tên', render: x => U.esc(x.name) },
      { label: 'Chi tiết', render: x => U.esc(x.detail) },
    ], { empty: 'Không có nhật ký phù hợp bộ lọc' }));
  }
  function doExport() {
    const rs = rows().map(x => [fmtTs(x.ts), x.actor, (M.ACT_ACTION[x.action] || [x.action])[0],
      M.ACT_ENTITY_LABEL[x.entity] || x.entity, x.name, x.detail]);
    if (!rs.length) return U.toast('Không có dữ liệu để xuất', 'error');
    U.exportExcel('NhatKyHoatDong', ['Thời gian', 'Người', 'Hành động', 'Loại', 'Mã/Tên', 'Chi tiết'], rs, 'NHẬT KÝ HOẠT ĐỘNG');
  }
  draw();
};
