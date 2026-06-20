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
  if (action === 'pdf' || action === 'pdf-blob') return M.exportDocPdf(title, innerHtml, size, css, action === 'pdf-blob' ? (opts && opts.then) : null, opts && opts.fname);
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
  // Tự host trong assets/vendor (không phụ thuộc CDN -> chạy cả khi mạng bị chặn / offline)
  if (!window.html2canvas) await M._loadScript('assets/vendor/html2canvas.min.js');
  if (!(window.jspdf && window.jspdf.jsPDF)) await M._loadScript('assets/vendor/jspdf.umd.min.js');
};
M._ensureXlsxLib = async function () {
  if (!window.XLSX) await M._loadScript('assets/vendor/xlsx.full.min.js');
};
M._download = function (blob, name) {
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
};
// Hỏi tên file trước khi lưu
M.askFileName = function (defaultName, ext, cb) {
  const inp = C.input({ value: defaultName, style: 'width:100%' });
  C.modal({
    title: 'Đặt tên file (.' + ext + ')',
    body: U.el('div', null, [C.field('Tên file', inp, { full: true })]),
    footer: [C.btn('Hủy', C.closeModal), C.btn('Lưu', () => {
      const nm = ((inp.value || defaultName).trim().replace(/[\\/:*?"<>|]+/g, '-')) || defaultName;
      C.closeModal(); cb(nm);
    }, 'primary')],
  });
  setTimeout(() => { inp.focus(); inp.select(); }, 50);
};
// Tạo file PDF thật từ HTML chứng từ (ảnh hóa -> giữ đúng tiếng Việt & bố cục). onBlob: nếu có -> trả Blob (để gửi Zalo) thay vì tải. fname: tên file tải về.
M.exportDocPdf = async function (title, innerHtml, size, css, onBlob, fname) {
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
    M._download(blob, (fname || title) + '.pdf');
    U.toast('Đã xuất PDF: ' + (fname || title));
    return blob;
  } catch (e) {
    if (wrap && wrap.parentNode) document.body.removeChild(wrap);
    U.toast('Không tạo được PDF (cần mạng) — mở hộp thoại in để "Lưu thành PDF"', 'error');
    M.printHTML(title, innerHtml, size);   // fallback: in -> Lưu PDF
  }
};

/* ============================================================
   PDF NATIVE (chữ thật, nét căng như MISA) — jsPDF + autotable + font Việt
   Chỉ tải font/plugin khi xuất PDF (lazy). Khổ A4/A5; 80mm vẫn dùng ảnh.
   ============================================================ */
M._ensurePdfNative = async function () {
  if (!(window.jspdf && window.jspdf.jsPDF)) await M._loadScript('assets/vendor/jspdf.umd.min.js');
  if (!window.jspdf.jsPDF.API.autoTable) await M._loadScript('assets/vendor/jspdf.plugin.autotable.min.js');
  if (!window.PW_VN_FONT) await M._loadScript('assets/vendor/pw-vn-font.js');
};
M._PDF_CFG = {
  invoice: { title: 'HÓA ĐƠN BÁN HÀNG', fname: 'Hóa đơn ', showCode: false, party: 'buyer', acct: true, totalLabel: 'TỔNG THANH TOÁN', vatAlways: false, signs: ['Người mua hàng', 'Người bán hàng'] },
  warehouse: { title: 'PHIẾU XUẤT KHO BÁN HÀNG', fname: 'Phiếu xuất kho ', showCode: true, party: 'buyer', acct: true, totalLabel: 'TỔNG TIỀN THANH TOÁN', vatAlways: true, signs: ['Người mua hàng', 'Kế toán trưởng', 'Giám đốc'] },
  delivery: { title: 'PHIẾU GIAO HÀNG', fname: 'Phiếu giao hàng ', showCode: false, party: 'receiver', acct: false, totalLabel: 'TỔNG GIÁ TRỊ', vatAlways: false, signs: ['Người giao hàng', 'Người nhận hàng'] },
};
M.docPdfNative = async function (si, type, size, action, opts) {
  U.toast('Đang tạo PDF...');
  const CFG = M._PDF_CFG[type] || M._PDF_CFG.invoice;
  try {
    await M._ensurePdfNative();
    const jsPDF = window.jspdf.jsPDF;
    const doc = new jsPDF({ unit: 'mm', format: size === 'A5' ? 'a5' : 'a4', orientation: 'p' });
    const F = window.PW_VN_FONT;
    doc.addFileToVFS('VN-Regular.ttf', F.regular); doc.addFont('VN-Regular.ttf', 'VN', 'normal');
    doc.addFileToVFS('VN-Bold.ttf', F.bold); doc.addFont('VN-Bold.ttf', 'VN', 'bold');
    doc.setFont('VN', 'normal');

    const c = M.company(), cus = PW.customer(si.customerId);
    const emp = si.employeeId && PW.data.employees ? PW.data.employees.find(e => e.id === si.employeeId) : null;
    const ch = PW.channel && PW.channel(si.channelId);
    const sub = PW.invoiceTotal(si), vat = Math.round(sub * Number(si.vatRate || 0) / 100), grand = sub + vat;
    const paid = Number(si.paid || 0), cod = grand - paid;
    const accD = c.accDebit || '131', accC = c.accCredit || '5111';
    const GREEN = [90, 142, 46], A5 = size === 'A5';
    const pageW = doc.internal.pageSize.getWidth(), pageH = doc.internal.pageSize.getHeight();
    const M0 = A5 ? 9 : 13, right = pageW - M0, lh = A5 ? 5 : 5.6;
    let y = M0;

    // ---- Header công ty ----
    doc.setFont('VN', 'bold'); doc.setTextColor(GREEN[0], GREEN[1], GREEN[2]); doc.setFontSize(A5 ? 12 : 14);
    doc.text((c.name || 'DALI').toUpperCase(), M0, y); y += A5 ? 5 : 6;
    doc.setFont('VN', 'normal'); doc.setTextColor(60, 60, 60); doc.setFontSize(A5 ? 8 : 9.5);
    if (c.address) { doc.text('Địa chỉ: ' + c.address, M0, y); y += 4.5; }
    const cl = []; if (c.phone) cl.push('ĐT: ' + c.phone); if (c.mst) cl.push('MST: ' + c.mst);
    if (cl.length) { doc.text(cl.join('     ·     '), M0, y); y += 4.5; }
    doc.setDrawColor(GREEN[0], GREEN[1], GREEN[2]); doc.setLineWidth(0.5); doc.line(M0, y, right, y); y += A5 ? 6 : 8;

    // ---- Tiêu đề ----
    doc.setFont('VN', 'bold'); doc.setTextColor(25, 25, 25); doc.setFontSize(A5 ? 15 : 19);
    doc.text(CFG.title, pageW / 2, y, { align: 'center' }); y += A5 ? 6 : 7;
    doc.setFont('VN', 'normal'); doc.setFontSize(A5 ? 9 : 10.5); doc.setTextColor(80, 80, 80);
    const parts = (si.date || U.today()).split('-'), yy = parts[0], mm = parts[1], dd = parts[2];
    if (type === 'warehouse') {
      doc.text('Ngày ' + dd + ' tháng ' + mm + ' năm ' + yy, pageW / 2, y, { align: 'center' }); y += 5.5;
      doc.setFont('VN', 'bold'); doc.setTextColor(25, 25, 25); doc.text('Số: ' + si.code, pageW / 2, y, { align: 'center' }); y += 7.5;
    } else {
      let s2 = 'Số: ' + si.code + '       Ngày ' + U.date(si.date);
      if (type === 'delivery' && ch) s2 += '       Kênh: ' + ch.name;
      if (type === 'delivery' && si.trackingCode) s2 += '       Mã VĐ: ' + si.trackingCode;
      doc.text(s2, pageW / 2, y, { align: 'center' }); y += 7.5;
    }

    // ---- Khối đối tác (trái) + tài khoản (phải) ----
    doc.setFontSize(A5 ? 8.5 : 10);
    const yParty = y;
    if (CFG.acct) {
      const rx = right - 40; let ry = y; doc.setTextColor(40, 40, 40); doc.setFont('VN', 'normal');
      [['Nợ: ', accD], ['Có: ', accC], ['Loại tiền: ', 'VND']].forEach(kv => { doc.text(kv[0] + kv[1], rx, ry); ry += lh; });
    }
    const leftW = (CFG.acct ? (pageW - 2 * M0 - 46) : (pageW - 2 * M0));
    const lines = [];
    if (CFG.party === 'receiver') {
      lines.push(['Người nhận: ', cus ? cus.name : '', true]);
      lines.push(['Điện thoại: ', cus ? (cus.phone || '') : '', false]);
      lines.push(['Địa chỉ giao: ', cus ? (cus.address || '') : '', false]);
      if (si.note) lines.push(['Diễn giải: ', si.note, false]);
    } else {
      lines.push(['Tên khách hàng: ', cus ? cus.name : '', true]);
      lines.push(['Địa chỉ: ', cus ? (cus.address || '') : '', false]);
      lines.push(['Điện thoại: ', cus ? (cus.phone || '') : '', false]);
      lines.push(['Mã số thuế: ', cus ? (cus.taxCode || '') : '', false]);
      if (si.note) lines.push(['Diễn giải: ', si.note, false]);
      if (emp) lines.push(['Nhân viên bán hàng: ', emp.name, false]);
    }
    lines.forEach(ln => {
      doc.setFont('VN', 'normal'); doc.setTextColor(40, 40, 40);
      const labelW = doc.getTextWidth(ln[0]); doc.text(ln[0], M0, y);
      doc.setFont('VN', ln[2] ? 'bold' : 'normal'); doc.setTextColor(20, 20, 20);
      const wrapped = doc.splitTextToSize(String(ln[1] || ''), Math.max(20, leftW - labelW));
      doc.text(wrapped, M0 + labelW, y); y += lh * wrapped.length;
    });
    y = Math.max(y, yParty + lh * 3) + 3;

    // ---- Bảng hàng hóa (autotable) ----
    const sc = CFG.showCode;
    const head = sc ? [['STT', 'Mã hàng', 'Tên hàng', 'ĐVT', 'Số lượng', 'Đơn giá', 'Thành tiền']]
      : [['STT', 'Tên hàng hóa', 'ĐVT', 'SL', 'Đơn giá', 'Thành tiền']];
    const body = si.items.map((it, i) => {
      const p = PW.product(it.productId), price = Number(it.price != null ? it.price : it.cost || 0), lt = Number(it.qty) * price;
      return sc ? [i + 1, p ? p.code : '', p ? p.name : '', p ? p.unit : '', U.num(it.qty), U.money(price), U.money(lt)]
        : [i + 1, p ? ((p.code ? p.code + ' - ' : '') + p.name) : '', p ? p.unit : '', U.num(it.qty), U.money(price), U.money(lt)];
    });
    const totalQty = si.items.reduce((s, it) => s + Number(it.qty || 0), 0);
    const span = sc ? 4 : 3;
    const totSpan = (sc ? 7 : 6) - 1;
    const foot = [];
    foot.push([{ content: 'Cộng', colSpan: span, styles: { halign: 'right', fontStyle: 'bold' } },
      { content: U.num(totalQty), styles: { halign: 'right', fontStyle: 'bold' } }, '',
      { content: U.money(sub), styles: { halign: 'right', fontStyle: 'bold' } }]);
    const totRow = (label, val, big) => foot.push([
      { content: label, colSpan: totSpan, styles: { halign: 'right', fontStyle: big ? 'bold' : 'normal', textColor: big ? GREEN : [55, 55, 55] } },
      { content: val, styles: { halign: 'right', fontStyle: big ? 'bold' : 'normal', textColor: big ? GREEN : [55, 55, 55] } }]);
    totRow('Cộng tiền hàng', U.money(sub));
    if (CFG.vatAlways || Number(si.vatRate)) totRow('Tiền thuế GTGT (' + (Number(si.vatRate) || 0) + '%)', U.money(vat));
    totRow(CFG.totalLabel, U.money(grand), true);
    if (type === 'delivery') totRow('Đã thanh toán', U.money(paid));

    doc.autoTable({
      startY: y, head: head, body: body, foot: foot, theme: 'grid', showFoot: 'lastPage',
      styles: { font: 'VN', fontSize: A5 ? 8 : 9.5, cellPadding: A5 ? 1.3 : 1.9, lineColor: [185, 196, 168], lineWidth: 0.1, textColor: [30, 30, 30], overflow: 'linebreak', valign: 'middle' },
      headStyles: { font: 'VN', fontStyle: 'bold', fillColor: [238, 246, 225], textColor: [40, 60, 20], halign: 'center', lineColor: [185, 196, 168] },
      footStyles: { font: 'VN', fillColor: [255, 255, 255], textColor: [55, 55, 55], lineColor: [185, 196, 168] },
      bodyStyles: { lineColor: [185, 196, 168] },
      columnStyles: sc
        ? { 0: { halign: 'center', cellWidth: 9 }, 3: { halign: 'center' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' } }
        : { 0: { halign: 'center', cellWidth: 9 }, 2: { halign: 'center' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } },
      margin: { left: M0, right: M0, top: M0, bottom: M0 },
    });
    y = doc.lastAutoTable.finalY + 6;
    const need = h => { if (y + h > pageH - M0) { doc.addPage(); y = M0; } };

    // ---- Số tiền bằng chữ ----
    need(8); doc.setFont('VN', 'normal'); doc.setFontSize(A5 ? 8.5 : 10); doc.setTextColor(30, 30, 30);
    const bw = doc.splitTextToSize('Số tiền viết bằng chữ: ' + U.readMoneyVN(grand), pageW - 2 * M0);
    doc.text(bw, M0, y); y += bw.length * lh;

    // ---- COD (phiếu giao) ----
    if (type === 'delivery') {
      need(13); y += 2; const bh = 9;
      if (cod > 0) { doc.setFillColor(255, 246, 229); doc.setDrawColor(224, 146, 42); }
      else { doc.setFillColor(230, 247, 238); doc.setDrawColor(39, 174, 96); }
      doc.setLineWidth(0.4); doc.roundedRect(M0, y, pageW - 2 * M0, bh, 1.5, 1.5, 'FD');
      doc.setFont('VN', 'bold'); doc.setTextColor(30, 30, 30); doc.setFontSize(A5 ? 9 : 11);
      doc.text(cod > 0 ? ('TIỀN THU HỘ (COD): ' + U.money(cod) + ' đ — thu của người nhận khi giao.') : 'ĐÃ THANH TOÁN ĐỦ — không thu hộ.', M0 + 3, y + bh / 2 + 1.5);
      y += bh + 4;
    }

    // ---- Phiếu xuất kho: dòng phụ ----
    if (type === 'warehouse') {
      need(10); doc.setFont('VN', 'normal'); doc.setFontSize(A5 ? 8.5 : 9.5); doc.setTextColor(40, 40, 40);
      doc.text('Số chứng từ gốc kèm theo: .....', M0, y); y += 5;
      doc.text('Ngày ..... tháng ..... năm ........', right, y, { align: 'right' }); y += 4;
    }

    // ---- Chữ ký ----
    need(24); y += A5 ? 6 : 11; doc.setFontSize(A5 ? 8.5 : 10);
    const segW = (pageW - 2 * M0) / CFG.signs.length;
    CFG.signs.forEach((s, i) => {
      const cx = M0 + segW * i + segW / 2;
      doc.setFont('VN', 'bold'); doc.setTextColor(30, 30, 30); doc.text(s, cx, y, { align: 'center' });
      doc.setFont('VN', 'normal'); doc.setTextColor(120, 120, 120); doc.setFontSize(A5 ? 7.5 : 8.5);
      doc.text('(Ký, ghi rõ họ tên)', cx, y + 4.5, { align: 'center' });
      doc.setFontSize(A5 ? 8.5 : 10);
    });
    if (c.note) { doc.setFont('VN', 'normal'); doc.setTextColor(120, 120, 120); doc.setFontSize(A5 ? 7.5 : 9); doc.text(c.note, pageW / 2, pageH - M0 / 2 - 1, { align: 'center' }); }

    const blob = doc.output('blob');
    if (action === 'pdf-blob') { if (opts && opts.then) opts.then(blob, CFG.fname + si.code); return blob; }
    M._download(blob, ((opts && opts.fname) || (CFG.fname + si.code)) + '.pdf');
    U.toast('Đã xuất PDF: ' + ((opts && opts.fname) || si.code));
    return blob;
  } catch (e) {
    console.error('docPdfNative', e);
    U.toast('PDF nét cao lỗi — dùng bản ảnh', 'error');
    M._pdfNativeOff = true;
    try { ({ invoice: M.printInvoice, warehouse: M.warehouseIssueNote, delivery: M.deliveryNote }[type] || M.printInvoice)(si, size, action, opts); }
    finally { M._pdfNativeOff = false; }
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
  if (!M._pdfNativeOff && (action === 'pdf' || action === 'pdf-blob') && size !== '80') return M.docPdfNative(si, 'invoice', size, action, opts);
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
  if (!M._pdfNativeOff && (action === 'pdf' || action === 'pdf-blob') && size !== '80') return M.docPdfNative(si, 'delivery', size, action, opts);
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
  if (!M._pdfNativeOff && (action === 'pdf' || action === 'pdf-blob') && size !== '80') return M.docPdfNative(si, 'warehouse', size, action, opts);
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

/* ---------- Xuất EXCEL 1 chứng từ -> file .xlsx THẬT (SheetJS) — đúng tiếng Việt, đúng cột, không cảnh báo ---------- */
M._invoiceAoa = function (si) {
  const c = M.company();
  const cus = PW.customer(si.customerId);
  const emp = si.employeeId && PW.data.employees ? PW.data.employees.find(e => e.id === si.employeeId) : null;
  const ch = PW.channel && PW.channel(si.channelId);
  const grand = PW.invoiceGrand(si);
  const rows = [];
  // Đầu: thông tin doanh nghiệp
  rows.push([c.name || 'DALI']);
  if (c.address) rows.push([c.address]);
  if (c.phone || c.mst) rows.push([(c.phone ? 'ĐT: ' + c.phone : '') + (c.phone && c.mst ? '   ' : '') + (c.mst ? 'MST: ' + c.mst : '')]);
  rows.push([]);
  rows.push(['HÓA ĐƠN BÁN HÀNG']);
  rows.push(['Số chứng từ:', si.code, '', 'Ngày:', U.date(si.date)]);
  // Khối NGƯỜI MUA (đầy đủ như bản in)
  rows.push(['Khách hàng:', cus ? cus.name : '']);
  rows.push(['Địa chỉ:', cus ? (cus.address || '') : '']);
  rows.push(['Điện thoại:', cus ? (cus.phone || '') : '', '', 'Mã số thuế:', cus ? (cus.taxCode || '') : '']);
  if (ch) rows.push(['Kênh bán:', ch.name]);
  if (emp) rows.push(['Nhân viên bán:', emp.name]);
  if (si.note) rows.push(['Diễn giải:', si.note]);
  if (si.dueDate) rows.push(['Hạn thanh toán:', U.date(si.dueDate)]);
  rows.push([]);
  // Bảng hàng hóa
  rows.push(['STT', 'Mã hàng', 'Tên hàng', 'ĐVT', 'SL', 'Đơn giá', 'Thành tiền']);
  si.items.forEach((it, i) => { const p = PW.product(it.productId); rows.push([i + 1, p ? p.code : '', p ? p.name : '', p ? p.unit : '', Number(it.qty), Number(it.price || 0), Number(it.qty) * Number(it.price || 0)]); });
  rows.push(['', '', 'Cộng', '', si.items.reduce((s, it) => s + Number(it.qty || 0), 0), '', PW.invoiceTotal(si)]);
  rows.push([]);
  // Tổng
  rows.push(['', '', '', '', '', 'Cộng tiền hàng', PW.invoiceTotal(si)]);
  if (PW.invoiceVat(si)) rows.push(['', '', '', '', '', 'Thuế GTGT (' + (Number(si.vatRate) || 0) + '%)', PW.invoiceVat(si)]);
  rows.push(['', '', '', '', '', 'TỔNG THANH TOÁN', grand]);
  rows.push(['', '', '', '', '', 'Đã thu', Number(si.paid || 0)]);
  rows.push(['', '', '', '', '', 'Còn nợ', grand - Number(si.paid || 0)]);
  rows.push(['Số tiền bằng chữ:', U.readMoneyVN(grand)]);
  return rows;
};
// Trả về { blob, ext }. Ưu tiên .xlsx (SheetJS); nếu lib lỗi -> CSV (BOM, KHÔNG dùng sep= để Excel đọc đúng UTF-8).
M._invoiceExcelBlob = async function (si) {
  try {
    await M._ensureXlsxLib();
    const X = window.XLSX;
    const c = M.company(), cus = PW.customer(si.customerId);
    const emp = si.employeeId && PW.data.employees ? PW.data.employees.find(e => e.id === si.employeeId) : null;
    const ch = PW.channel && PW.channel(si.channelId);
    const total = PW.invoiceTotal(si), vat = PW.invoiceVat(si), grand = PW.invoiceGrand(si);
    const NC = 7;                              // A..G
    const rows = [], merges = [], money = [];  // money: [rowIdx, colIdx] cần định dạng số
    // Dòng trải full chiều ngang (gộp A:G) -> không bị cắt chữ
    const wide = (txt) => { rows.push([txt]); merges.push({ s: { r: rows.length - 1, c: 0 }, e: { r: rows.length - 1, c: NC - 1 } }); };
    wide((c.name || 'DALI').toUpperCase());
    if (c.address) wide(c.address);
    if (c.phone || c.mst) wide((c.phone ? 'ĐT: ' + c.phone : '') + (c.phone && c.mst ? '    ' : '') + (c.mst ? 'MST: ' + c.mst : ''));
    rows.push([]);
    wide('HÓA ĐƠN BÁN HÀNG');
    wide('Số: ' + si.code + '          Ngày ' + U.date(si.date));
    wide('Khách hàng: ' + (cus ? cus.name : ''));
    wide('Địa chỉ: ' + (cus ? (cus.address || '') : ''));
    wide('Điện thoại: ' + (cus ? (cus.phone || '') : '') + '          Mã số thuế: ' + (cus ? (cus.taxCode || '') : ''));
    if (ch) wide('Kênh bán: ' + ch.name);
    if (emp) wide('Nhân viên bán hàng: ' + emp.name);
    if (si.note) wide('Diễn giải: ' + si.note);
    if (si.dueDate) wide('Hạn thanh toán: ' + U.date(si.dueDate));
    rows.push([]);
    // Bảng hàng hóa
    rows.push(['STT', 'Mã hàng', 'Tên hàng', 'ĐVT', 'Số lượng', 'Đơn giá', 'Thành tiền']);
    si.items.forEach((it, i) => {
      const p = PW.product(it.productId), r = rows.length;
      rows.push([i + 1, p ? p.code : '', p ? p.name : '', p ? p.unit : '', Number(it.qty), Number(it.price || 0), Number(it.qty) * Number(it.price || 0)]);
      money.push([r, 5], [r, 6]);
    });
    { const r = rows.length; rows.push(['', 'Cộng', '', '', si.items.reduce((s, it) => s + Number(it.qty || 0), 0), '', total]); merges.push({ s: { r, c: 1 }, e: { r, c: 3 } }); money.push([r, 6]); }
    rows.push([]);
    // Tổng — nhãn gộp B:F (rộng, không cắt), giá trị ở G
    const tot = (label, val) => { const r = rows.length; rows.push(['', label, '', '', '', '', val]); merges.push({ s: { r, c: 1 }, e: { r, c: 5 } }); money.push([r, 6]); };
    tot('Cộng tiền hàng', total);
    if (vat) tot('Tiền thuế GTGT (' + (Number(si.vatRate) || 0) + '%)', vat);
    tot('TỔNG THANH TOÁN', grand);
    tot('Đã thanh toán', Number(si.paid || 0));
    tot('Còn phải thu', grand - Number(si.paid || 0));
    wide('Số tiền viết bằng chữ: ' + U.readMoneyVN(grand));
    const ws = X.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 6 }, { wch: 16 }, { wch: 46 }, { wch: 9 }, { wch: 10 }, { wch: 14 }, { wch: 16 }];
    ws['!merges'] = merges;
    money.forEach(([r, col]) => { const ref = X.utils.encode_cell({ r, c: col }); if (ws[ref] && typeof ws[ref].v === 'number') ws[ref].z = '#,##0'; });
    const wb = X.utils.book_new(); X.utils.book_append_sheet(wb, ws, 'HoaDon');
    const arr = X.write(wb, { bookType: 'xlsx', type: 'array' });
    return { blob: new Blob([arr], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), ext: 'xlsx' };
  } catch (e) {
    const q = v => { v = (v == null ? '' : String(v)); return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    const csv = M._invoiceAoa(si).map(r => r.map(q).join(',')).join('\r\n');
    return { blob: new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }), ext: 'csv' };
  }
};
M.exportDocExcel = async function (si, fname) {
  U.toast('Đang tạo Excel...');
  const { blob, ext } = await M._invoiceExcelBlob(si);
  M._download(blob, (fname || 'HoaDon-' + si.code) + '.' + ext);
  U.toast('Đã xuất Excel: ' + (fname || si.code));
};

/* ---------- Gửi chứng từ qua Zalo ----------
   Ưu tiên đính kèm FILE PDF (builderFn tạo PDF). Điện thoại: Web Share -> chọn Zalo.
   Máy tính: tải tệp + copy nội dung + mở Zalo để đính kèm. (Gửi PDF tự động tới từng KH cần Zalo OA.) */
M.sendZalo = function (si, builderFn, size, fmt) {
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
  function sendExcel() {
    M._invoiceExcelBlob(si).then(({ blob, ext }) => {
      let f = null; try { f = new File([blob], 'HoaDon-' + si.code + '.' + ext, { type: blob.type }); } catch (e) {}
      shareFile(f);
    });
  }
  if (fmt === 'excel' || !builderFn) return sendExcel();   // gửi Excel (.xlsx)
  builderFn(si, size || 'A4', 'pdf-blob', { then: (blob) => {   // gửi PDF
    if (!blob) return sendExcel();
    let f = null; try { f = new File([blob], 'HoaDon-' + si.code + '.pdf', { type: 'application/pdf' }); } catch (e) {}
    shareFile(f);
  } });
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
        C.btn('📄 Xuất PDF', () => { const fn = fnOf(), sz = sizeSel.value; M.askFileName('HoaDon-' + si.code, 'pdf', nm => fn(si, sz, 'pdf', { fname: nm })); }),
        C.btn('📊 Xuất Excel', () => { M.askFileName('HoaDon-' + si.code, 'csv', nm => M.exportDocExcel(si, nm)); }),
      ]),
      U.el('p', { class: 'section-sub', style: 'margin:14px 0 6px;font-weight:600' }, 'Gửi cho khách qua Zalo:'),
      U.el('div', { class: 'pill-row' }, [
        C.btn('💬 Gửi Zalo (PDF)', () => { M.sendZalo(si, fnOf(), sizeSel.value, 'pdf'); }, 'primary'),
        C.btn('📊 Gửi Zalo (Excel)', () => { M.sendZalo(si, null, sizeSel.value, 'excel'); }),
      ]),
      U.el('p', { class: 'section-sub', style: 'margin:6px 0 0;font-size:11.5px' },
        'Xuất PDF/Excel: đặt tên file rồi tải về máy. Gửi Zalo: điện thoại mở khay chia sẻ chọn Zalo (kèm PDF); máy tính tự tải PDF + copy nội dung + mở Zalo để đính kèm.'),
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
