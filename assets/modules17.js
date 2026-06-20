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
// CSS dùng chung cho IN và XUẤT PDF (để file PDF trông y như bản in)
M._printCSS = function (size) {
  const page = {
    'A4': '@page{size:A4;margin:13mm}',
    'A5': '@page{size:A5;margin:9mm}',
    '80': '@page{size:80mm auto;margin:3mm}',
  }[size] || '@page{size:A4;margin:13mm}';
  const narrow = size === '80';
  return page
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
    + 'table.it tfoot{display:table-row-group}'
    + 'table.it tfoot tr{break-inside:avoid}'
    + '.r{text-align:right}.c{text-align:center}'
    + '.tot{text-align:right;margin-top:6px}.tot.big{font-size:' + (narrow ? '14' : '16') + 'px;font-weight:800;color:#5a8e2e}'
    + '.cod{margin-top:10px;padding:8px 10px;border:1.5px dashed #e0922a;border-radius:8px;background:#fff6e5;font-size:' + (narrow ? '13' : '15') + 'px}'
    + '.note{margin-top:10px;font-style:italic;color:#555}'
    + '.sign{display:flex;justify-content:space-around;margin-top:' + (narrow ? '24' : '46') + 'px;text-align:center;font-size:12.5px}'
    + '.sign i{color:#777;font-weight:400}'
    + '.foot{text-align:center;color:#777;margin-top:16px;font-size:11.5px}';
};

// action: 'print' (mặc định) | 'pdf' (xuất file PDF) | 'pdf-blob' (trả Blob qua opts.then)
M.printHTML = function (title, innerHtml, size, action, opts) {
  size = size || M.company().printSize || 'A4';
  const css = M._printCSS(size);
  if (action === 'pdf' || action === 'pdf-blob') return M.exportDocPdf(title, innerHtml, size, css, action === 'pdf-blob' ? (opts && opts.then) : null);
  const html = '<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>' + U.esc(title) + '</title><style>'
    + css + '</style></head><body>' + innerHtml
    + '<script>window.onload=function(){setTimeout(function(){window.print()},120)}<\/script></body></html>';
  const w = window.open('', '_blank');
  if (!w) { U.toast('Trình duyệt chặn cửa sổ in — hãy cho phép pop-up rồi thử lại.', 'error'); return; }
  w.document.write(html); w.document.close();
};

// Lazy-load thư viện tạo PDF (chỉ tải khi cần, có mạng)
M._loadScript = function (src) {
  return new Promise((res, rej) => {
    if ([].slice.call(document.scripts).some(s => s.src === src)) return res();
    const s = document.createElement('script'); s.src = src; s.async = true;
    s.onload = res; s.onerror = function () { rej(new Error('Không tải được ' + src)); };
    document.head.appendChild(s);
  });
};
M._ensurePdfLibs = async function () {
  if (!window.html2canvas) await M._loadScript('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js');
  if (!(window.jspdf && window.jspdf.jsPDF)) await M._loadScript('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js');
};
// Tạo file PDF thật từ HTML chứng từ (ảnh hóa -> giữ đúng tiếng Việt & bố cục). onBlob: nếu có -> trả Blob (để gửi Zalo) thay vì tải.
M.exportDocPdf = async function (title, innerHtml, size, css, onBlob) {
  U.toast('Đang tạo PDF...');
  let wrap;
  try {
    await M._ensurePdfLibs();
    const wmm = size === '80' ? 74 : (size === 'A5' ? 148 : 210);
    const pxW = Math.round(wmm * 3.78);   // mm -> px (96dpi)
    wrap = document.createElement('div');
    wrap.style.cssText = 'position:fixed;left:-99999px;top:0;width:' + pxW + 'px;background:#fff;padding:' + (size === '80' ? 8 : 24) + 'px';
    wrap.innerHTML = '<style>' + css.replace(/@page\{[^}]*\}/, '') + '</style><div>' + innerHtml + '</div>';
    document.body.appendChild(wrap);
    const canvas = await window.html2canvas(wrap, { scale: 2, useCORS: true, backgroundColor: '#fff', windowWidth: pxW });
    const img = canvas.toDataURL('image/jpeg', 0.82);   // JPEG -> file nhỏ gọn (gửi Zalo nhẹ)
    const jsPDF = window.jspdf.jsPDF;
    const pdf = new jsPDF({ unit: 'mm', format: size === 'A5' ? 'a5' : (size === '80' ? [80, Math.max(120, canvas.height * 74 / canvas.width + 10)] : 'a4'), orientation: 'p' });
    const pageW = pdf.internal.pageSize.getWidth(), pageH = pdf.internal.pageSize.getHeight();
    const margin = size === '80' ? 3 : 8;
    const imgW = pageW - margin * 2, imgH = canvas.height * imgW / canvas.width;
    let hLeft = imgH, pos = margin;
    pdf.addImage(img, 'JPEG', margin, pos, imgW, imgH);
    hLeft -= (pageH - margin * 2);
    while (hLeft > 0) { pdf.addPage(); pos = margin - (imgH - hLeft); pdf.addImage(img, 'JPEG', margin, pos, imgW, imgH); hLeft -= (pageH - margin * 2); }
    document.body.removeChild(wrap); wrap = null;
    const blob = pdf.output('blob');
    if (onBlob) { onBlob(blob, title); return blob; }
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = title + '.pdf'; a.click(); URL.revokeObjectURL(url);
    U.toast('Đã xuất PDF: ' + title);
    return blob;
  } catch (e) {
    if (wrap && wrap.parentNode) document.body.removeChild(wrap);
    U.toast('Không tạo được PDF (cần mạng) — mở hộp thoại in để "Lưu thành PDF"', 'error');
    M.printHTML(title, innerHtml, size);   // fallback: in -> Lưu PDF
  }
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
M.printInvoice = function (si, size, action, opts) {
  const c = M.company();
  const cus = PW.customer(si.customerId);
  const emp = si.employeeId && PW.data.employees ? PW.data.employees.find(e => e.id === si.employeeId) : null;
  const sub = PW.invoiceTotal(si);
  const vat = Math.round(sub * Number(si.vatRate || 0) / 100);
  const grand = sub + vat;
  const accD = c.accDebit || '131';   // Nợ: phải thu khách hàng
  const accC = c.accCredit || '5111';  // Có: doanh thu bán hàng
  const head = '<th class="c" style="width:34px">STT</th><th>Tên hàng hóa</th><th class="c">ĐVT</th><th class="r">SL</th><th class="r">Đơn giá</th><th class="r">Thành tiền</th>';
  const inner = M._companyHeader()
    + '<h1 class="doc-title">HÓA ĐƠN BÁN HÀNG</h1>'
    + '<div class="doc-sub">Số: ' + U.esc(si.code) + ' &nbsp;·&nbsp; Ngày ' + U.date(si.date) + '</div>'
    + '<table style="width:100%"><tr>'
    + '<td style="vertical-align:top;line-height:1.9;font-size:13px">'
    + 'Người mua:<br>Tên khách hàng: <b>' + U.esc(cus ? cus.name : '') + '</b><br>'
    + 'Địa chỉ: ' + U.esc(cus ? (cus.address || '') : '') + '<br>'
    + 'Điện thoại: ' + U.esc(cus ? (cus.phone || '') : '') + '<br>'
    + 'Mã số thuế: ' + U.esc(cus ? (cus.taxCode || '') : '') + '<br>'
    + 'Diễn giải: ' + U.esc(si.note || '') + '<br>'
    + 'Nhân viên bán hàng: ' + U.esc(emp ? emp.name : '') + '</td>'
    + '<td style="vertical-align:top;line-height:1.9;font-size:13px;width:200px">'
    + 'Nợ: ' + U.esc(accD) + '<br>Có: ' + U.esc(accC) + '<br>Loại tiền: VND</td>'
    + '</tr></table>'
    + '<table class="it"><thead><tr>' + head + '</tr></thead><tbody>' + M._itemRows(si, true) + '</tbody>'
    + '<tfoot>'
    + '<tr><td colspan="3" class="r"><b>Cộng</b></td><td class="r"><b>' + U.num(si.items.reduce((s, it) => s + Number(it.qty || 0), 0)) + '</b></td><td></td><td class="r"><b>' + U.money(sub) + '</b></td></tr>'
    + '<tr><td colspan="5" class="r">Cộng tiền hàng</td><td class="r">' + U.money(sub) + '</td></tr>'
    + (Number(si.vatRate) ? '<tr><td colspan="5" class="r">Thuế GTGT (' + si.vatRate + '%)</td><td class="r">' + U.money(vat) + '</td></tr>' : '')
    + '<tr><td colspan="5" class="r" style="font-weight:800;color:#5a8e2e">TỔNG THANH TOÁN</td><td class="r" style="font-weight:800;color:#5a8e2e">' + U.money(grand) + '</td></tr>'
    + '</tfoot></table>'
    + '<div style="margin-top:8px;font-size:13.5px">Số tiền bằng chữ: <i><b>' + U.readMoneyVN(grand) + '</b></i></div>'
    + '<div class="sign"><div>Người mua hàng<br><i>(Ký, ghi rõ họ tên)</i></div><div>Người bán hàng<br><i>(Ký, ghi rõ họ tên)</i></div></div>'
    + (M.company().note ? '<div class="foot">' + U.esc(M.company().note) + '</div>' : '');
  M.printHTML('Hóa đơn ' + si.code, inner, size, action, opts);
};

/* ---------- PHIẾU GIAO HÀNG (chứng từ giao hàng + thu hộ COD) ---------- */
M.deliveryNote = function (si, size, action, opts) {
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
  M.printHTML('Phiếu giao hàng ' + si.code, inner, size, action, opts);
};

/* ---------- PHIẾU XUẤT KHO BÁN HÀNG (mẫu chuẩn VN / MISA) ---------- */
M.warehouseIssueNote = function (si, size, action, opts) {
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
    + '<tr><td colspan="4" class="r"><b>Cộng</b></td><td class="r"><b>' + U.num(si.items.reduce((s, it) => s + Number(it.qty || 0), 0)) + '</b></td><td></td><td class="r"><b>' + U.money(sub) + '</b></td></tr>'
    + '<tr><td colspan="6" class="r"><b>Cộng tiền hàng</b></td><td class="r"><b>' + U.money(sub) + '</b></td></tr>'
    + '<tr><td colspan="6" class="r">Thuế GTGT (' + (Number(si.vatRate) || 0) + '%)</td><td class="r">' + U.money(vat) + '</td></tr>'
    + '<tr><td colspan="6" class="r" style="font-weight:800;color:#5a8e2e">TỔNG TIỀN THANH TOÁN</td><td class="r" style="font-weight:800;color:#5a8e2e">' + U.money(grand) + '</td></tr>'
    + '</tfoot></table>'
    + '<div style="margin-top:8px;font-size:13.5px">Số tiền bằng chữ: <i><b>' + U.readMoneyVN(grand) + '</b></i></div>'
    + '<div style="margin-top:4px;font-size:13px">Số chứng từ gốc kèm theo: .....</div>'
    + '<div class="r" style="margin-top:14px;font-style:italic">Ngày ..... tháng ..... năm ........</div>'
    + '<div class="sign"><div>Người mua hàng<br><i>(Ký, họ tên)</i></div><div>Kế toán trưởng<br><i>(Ký, họ tên)</i></div><div>Giám đốc<br><i>(Ký, họ tên, đóng dấu)</i></div></div>';
  M.printHTML('Phiếu xuất kho ' + si.code, inner, size, action, opts);
};

/* ---------- Xuất EXCEL 1 chứng từ (file .xls thật) ---------- */
M._invoiceXlsBlob = function (si) {
  const cus = PW.customer(si.customerId);
  const headers = ['STT', 'Mã hàng', 'Tên hàng', 'ĐVT', 'SL', 'Đơn giá', 'Thành tiền'];
  const rs = si.items.map((it, i) => { const p = PW.product(it.productId); return [i + 1, p ? p.code : '', p ? p.name : '', p ? p.unit : '', Number(it.qty), Number(it.price || 0), Number(it.qty) * Number(it.price || 0)]; });
  rs.push(['', '', '', '', '', 'Cộng tiền hàng', PW.invoiceTotal(si)]);
  if (PW.invoiceVat(si)) rs.push(['', '', '', '', '', 'Thuế GTGT', PW.invoiceVat(si)]);
  rs.push(['', '', '', '', '', 'TỔNG THANH TOÁN', PW.invoiceGrand(si)]);
  let h = '<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body><table border="1">';
  h += '<tr><td colspan="7" style="font-weight:bold">HÓA ĐƠN ' + U.esc(si.code) + ' — ' + U.esc(cus ? cus.name : '') + ' — ' + U.date(si.date) + '</td></tr>';
  h += '<tr>' + headers.map(x => '<th>' + U.esc(x) + '</th>').join('') + '</tr>';
  rs.forEach(r => { h += '<tr>' + r.map(cl => typeof cl === 'number' ? '<td>' + cl + '</td>' : '<td>' + U.esc(cl == null ? '' : cl) + '</td>').join('') + '</tr>'; });
  return new Blob(['﻿' + h + '</table></body></html>'], { type: 'application/vnd.ms-excel' });
};
M.exportDocExcel = function (si) {
  const blob = M._invoiceXlsBlob(si);
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'HoaDon-' + si.code + '.xls'; a.click(); URL.revokeObjectURL(url);
  U.toast('Đã xuất Excel: ' + si.code);
};

/* ---------- Gửi chứng từ qua Zalo ----------
   Ưu tiên đính kèm FILE PDF (builderFn tạo PDF). Điện thoại: Web Share -> chọn Zalo.
   Máy tính: tải tệp + copy nội dung + mở Zalo để đính kèm. (Gửi PDF tự động tới từng KH cần Zalo OA.) */
M.sendZalo = function (si, builderFn, size) {
  const c = M.company(), cus = PW.customer(si.customerId);
  const grand = PW.invoiceGrand(si), paid = Number(si.paid || 0);
  const lines = si.items.map(it => { const p = PW.product(it.productId); return '• ' + (p ? p.name : '') + '  x' + U.num(it.qty) + ' = ' + U.money(Number(it.qty) * Number(it.price || 0)) + 'đ'; }).join('\n');
  const text = (c.name || 'DALI') + ' — HÓA ĐƠN ' + si.code + '\n'
    + 'Ngày: ' + U.date(si.date) + (cus ? '\nKhách: ' + cus.name : '') + '\n' + lines + '\n'
    + 'TỔNG THANH TOÁN: ' + U.money(grand) + ' đ' + (paid < grand ? '\nCòn nợ: ' + U.money(grand - paid) + ' đ' : ' (đã thanh toán)');

  function shareFile(file) {
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: 'Hóa đơn ' + si.code, text: text }).catch(() => {});
    } else if (navigator.share) {
      navigator.share({ title: 'Hóa đơn ' + si.code, text: text }).catch(() => {});
      if (file) { const u = URL.createObjectURL(file); const a = document.createElement('a'); a.href = u; a.download = file.name; a.click(); URL.revokeObjectURL(u); }
    } else {
      if (file) { const u = URL.createObjectURL(file); const a = document.createElement('a'); a.href = u; a.download = file.name; a.click(); URL.revokeObjectURL(u); }
      try { if (navigator.clipboard) navigator.clipboard.writeText(text); } catch (e) {}
      window.open('https://chat.zalo.me/', '_blank');
      U.toast('Đã tải tệp + copy nội dung — đính kèm vào Zalo để gửi cho khách');
    }
  }
  function fallbackExcel() {
    const xb = M._invoiceXlsBlob(si); let f = null; try { f = new File([xb], 'HoaDon-' + si.code + '.xls', { type: 'application/vnd.ms-excel' }); } catch (e) {}
    shareFile(f);
  }
  if (builderFn) {
    builderFn(si, size || 'A4', 'pdf-blob', { then: (blob) => {
      if (!blob) return fallbackExcel();
      let f = null; try { f = new File([blob], 'HoaDon-' + si.code + '.pdf', { type: 'application/pdf' }); } catch (e) {}
      shareFile(f);
    } });
  } else { fallbackExcel(); }
};

/* ---------- Menu In / Xuất khẩu / Gửi Zalo (như MISA) ---------- */
M.printMenu = function (si) {
  const typeSel = C.select([
    { value: 'warehouse', label: 'Phiếu xuất kho bán hàng' },
    { value: 'invoice', label: 'Hóa đơn bán hàng' },
    { value: 'delivery', label: 'Phiếu giao hàng' },
  ], 'warehouse');
  const sizeSel = C.select([
    { value: 'A4', label: 'Khổ A4 (giấy thường)' },
    { value: 'A5', label: 'Khổ A5 (nửa trang)' },
    { value: '80', label: 'Khổ 80mm (máy in nhiệt)' },
  ], M.company().printSize || 'A4');
  const fnOf = () => ({ warehouse: M.warehouseIssueNote, invoice: M.printInvoice, delivery: M.deliveryNote }[typeSel.value] || M.warehouseIssueNote);
  C.modal({
    title: 'In / Xuất / Gửi — ' + si.code,
    body: U.el('div', null, [
      U.el('div', { class: 'form-grid' }, [C.field('Loại chứng từ', typeSel), C.field('Khổ giấy', sizeSel)]),
      U.el('p', { class: 'section-sub', style: 'margin:12px 0 6px;font-weight:600' }, 'In / Xuất file:'),
      U.el('div', { class: 'pill-row' }, [
        C.btn('🖨 In', () => { const fn = fnOf(); C.closeModal(); fn(si, sizeSel.value); }, 'primary'),
        C.btn('📄 Xuất PDF', () => { fnOf()(si, sizeSel.value, 'pdf'); }),
        C.btn('📊 Xuất Excel', () => { M.exportDocExcel(si); }),
      ]),
      U.el('p', { class: 'section-sub', style: 'margin:14px 0 6px;font-weight:600' }, 'Gửi cho khách:'),
      U.el('div', { class: 'pill-row' }, [
        C.btn('💬 Gửi qua Zalo (PDF)', () => { M.sendZalo(si, fnOf(), sizeSel.value); }, 'primary'),
      ]),
      U.el('p', { class: 'section-sub', style: 'margin:6px 0 0;font-size:11.5px' },
        'Xuất PDF/Excel tạo file tải về máy. Gửi Zalo: điện thoại mở khay chia sẻ chọn Zalo (kèm PDF); máy tính tự tải PDF + copy nội dung + mở Zalo để đính kèm. (Tạo PDF cần có mạng lần đầu.)'),
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
