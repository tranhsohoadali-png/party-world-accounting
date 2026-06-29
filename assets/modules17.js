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
M._ensureExcelJsLib = async function () {
  if (!window.ExcelJS) await M._loadScript('assets/vendor/exceljs.min.js');
};
// Logo công ty -> base64 (để chèn ảnh vào Excel). Lỗi/không có -> null.
M._logoBase64 = async function () {
  try {
    const u = M._logoUrl(); if (!u) return null;
    const r = await fetch(u); if (!r.ok) return null;
    const ab = await r.arrayBuffer(); const bytes = new Uint8Array(ab);
    let bin = ''; for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  } catch (e) { return null; }
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
  invoice: { title: 'HÓA ĐƠN BÁN HÀNG', fname: 'Hóa đơn ', showCode: true, party: 'buyer', acct: true, totalLabel: 'TỔNG THANH TOÁN', vatAlways: false, signs: ['Người mua hàng', 'Người bán hàng'] },
  warehouse: { title: 'PHIẾU XUẤT KHO BÁN HÀNG', fname: 'Phiếu xuất kho ', showCode: true, party: 'buyer', acct: true, totalLabel: 'TỔNG TIỀN THANH TOÁN', vatAlways: true, signs: ['Người mua hàng', 'Kế toán trưởng', 'Giám đốc'] },
  delivery: { title: 'PHIẾU GIAO HÀNG', fname: 'Phiếu giao hàng ', showCode: true, party: 'receiver', acct: false, totalLabel: 'TỔNG GIÁ TRỊ', vatAlways: false, signs: ['Người giao hàng', 'Người nhận hàng'] },
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
    const disc = Number(si.discount || 0), gross = sub + disc;
    const bcMode = opts && opts.bcMode;
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
      if (si.subStore) lines.push(['Cửa hàng con (giao tại): ', si.subStore, true]);
      lines.push(['Điện thoại: ', cus ? (cus.phone || '') : '', false]);
      lines.push(['Địa chỉ giao: ', cus ? (cus.address || '') : '', false]);
      if (si.note) lines.push(['Diễn giải: ', si.note, false]);
    } else {
      lines.push(['Tên khách hàng: ', cus ? cus.name : '', true]);
      if (si.subStore) lines.push(['Cửa hàng con (giao tại): ', si.subStore, true]);
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

    // ---- Bảng hàng hóa (autotable) — cột dựng theo vai trò, có cột Mã vạch khi cần (FAHASA) ----
    const sc = CFG.showCode, showBC = M._anyBarcode(si.items, bcMode);
    const colDefs = [{ key: 'stt', label: 'STT', align: 'center', w: 9 }];
    if (sc) colDefs.push({ key: 'code', label: 'Mã hàng' });
    if (showBC) colDefs.push({ key: 'barcode', label: M._barcodeLabel(bcMode), align: 'center' });
    colDefs.push({ key: 'name', label: sc ? 'Tên hàng' : 'Tên hàng hóa' });
    colDefs.push({ key: 'unit', label: 'ĐVT', align: 'center' });
    colDefs.push({ key: 'qty', label: sc ? 'Số lượng' : 'SL', align: 'right' });
    colDefs.push({ key: 'price', label: 'Đơn giá', align: 'right' });
    colDefs.push({ key: 'amount', label: 'Thành tiền', align: 'right' });
    const head = [colDefs.map(c => c.label)];
    const body = si.items.map((it, i) => {
      const p = PW.product(it.productId), price = Number(it.price != null ? it.price : it.cost || 0), lt = Number(it.qty) * price;
      return colDefs.map(c => {
        switch (c.key) {
          case 'stt': return i + 1;
          case 'code': return p ? p.code : '';
          case 'barcode': return M._barcodeVal(p, bcMode);
          case 'name': return p ? (sc ? p.name : ((p.code ? p.code + ' - ' : '') + p.name)) : '';
          case 'unit': return p ? p.unit : '';
          case 'qty': return U.num(it.qty);
          case 'price': return U.money(price);
          default: return U.money(lt);
        }
      });
    });
    const totalQty = si.items.reduce((s, it) => s + Number(it.qty || 0), 0);
    const qtyIdx = colDefs.findIndex(c => c.key === 'qty');
    const amountIdx = colDefs.length - 1;
    const foot = [];
    const cong = [{ content: 'Cộng', colSpan: qtyIdx, styles: { halign: 'right', fontStyle: 'bold' } },
      { content: U.num(totalQty), styles: { halign: 'right', fontStyle: 'bold' } }];
    for (let k = qtyIdx + 1; k < amountIdx; k++) cong.push('');   // cột đơn giá -> để trống
    cong.push({ content: U.money(gross), styles: { halign: 'right', fontStyle: 'bold' } });
    foot.push(cong);
    const totRow = (label, val, big) => foot.push([
      { content: label, colSpan: amountIdx, styles: { halign: 'right', fontStyle: big ? 'bold' : 'normal', textColor: big ? GREEN : [55, 55, 55] } },
      { content: val, styles: { halign: 'right', fontStyle: big ? 'bold' : 'normal', textColor: big ? GREEN : [55, 55, 55] } }]);
    totRow('Cộng tiền hàng', U.money(gross));
    if (disc > 0) totRow('Giảm giá', '-' + U.money(disc));
    if (CFG.vatAlways || Number(si.vatRate)) totRow('Tiền thuế GTGT (' + (Number(si.vatRate) || 0) + '%)', U.money(vat));
    totRow(CFG.totalLabel, U.money(grand), true);
    if (type === 'delivery') totRow('Đã thanh toán', U.money(paid));
    const columnStyles = {};
    colDefs.forEach((c, i) => { const s = {}; if (c.align) s.halign = c.align; if (c.w) s.cellWidth = c.w; if (Object.keys(s).length) columnStyles[i] = s; });

    doc.autoTable({
      startY: y, head: head, body: body, foot: foot, theme: 'grid', showFoot: 'lastPage',
      styles: { font: 'VN', fontSize: A5 ? 8 : 9.5, cellPadding: A5 ? 1.3 : 1.9, lineColor: [185, 196, 168], lineWidth: 0.1, textColor: [30, 30, 30], overflow: 'linebreak', valign: 'middle' },
      headStyles: { font: 'VN', fontStyle: 'bold', fillColor: [238, 246, 225], textColor: [40, 60, 20], halign: 'center', lineColor: [185, 196, 168] },
      footStyles: { font: 'VN', fillColor: [255, 255, 255], textColor: [55, 55, 55], lineColor: [185, 196, 168] },
      bodyStyles: { lineColor: [185, 196, 168] },
      columnStyles: columnStyles,
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

// Mã vạch theo HỆ THỐNG: 'fahasa' -> product.barcode ; 'pn' (Phương Nam) -> product.barcodePN ;
// 'none' -> rỗng ; mặc định/'any' -> ưu tiên FAHASA, không có thì Phương Nam.
M._barcodeVal = function (p, mode) {
  if (!p) return '';
  if (mode === 'none') return '';
  if (mode === 'pn') return p.barcodePN || '';
  if (mode === 'fahasa') return p.barcode || '';
  return p.barcode || p.barcodePN || '';
};
M._barcodeLabel = function (mode) {
  return mode === 'pn' ? 'Mã vạch Phương Nam' : (mode === 'fahasa' ? 'Mã vạch FAHASA' : 'Mã vạch');
};
// Có dòng hàng nào có mã vạch (theo mode) không -> để hiện/ẩn cột "Mã vạch"
M._anyBarcode = function (items, mode) {
  if (mode === 'none') return false;
  return (items || []).some(it => M._barcodeVal(PW.product(it.productId), mode));
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

// Bảng hàng hóa dùng chung (showPrice=false -> ẩn cột giá; showBC -> cột Mã vạch theo bcMode; showCode -> tách cột Mã hàng)
M._itemRows = function (doc, showPrice, showBC, showCode, bcMode) {
  return doc.items.map((it, i) => {
    const p = PW.product(it.productId);
    const price = Number(it.price != null ? it.price : it.cost || 0);
    const lt = Number(it.qty) * price;
    const nameCell = showCode ? (p ? p.name : '') : (p ? (p.code ? p.code + ' - ' : '') + p.name : '');
    return '<tr><td class="c">' + (i + 1) + '</td>'
      + (showBC ? '<td class="c">' + U.esc(M._barcodeVal(p, bcMode)) + '</td>' : '')
      + (showCode ? '<td>' + U.esc(p ? (p.code || '') : '') + '</td>' : '')
      + '<td>' + U.esc(nameCell) + '</td>'
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
  const disc = Number(si.discount || 0), gross = sub + disc;   // gross = tiền hàng TRƯỚC giảm giá (khớp cột Thành tiền)
  const accD = c.accDebit || '131';   // Nợ: phải thu khách hàng
  const accC = c.accCredit || '5111';  // Có: doanh thu bán hàng
  const bcMode = opts && opts.bcMode;
  const bc = M._anyBarcode(si.items, bcMode);
  const congSpan = (bc ? 5 : 4), totSpan = (bc ? 7 : 6);   // có cột Mã hàng (+1) và Mã vạch (+1 khi có)
  const head = '<th class="c" style="width:34px">STT</th>' + (bc ? '<th class="c">' + M._barcodeLabel(bcMode) + '</th>' : '') + '<th>Mã hàng</th><th>Tên hàng hóa</th><th class="c">ĐVT</th><th class="r">SL</th><th class="r">Đơn giá</th><th class="r">Thành tiền</th>';
  const inner = M._companyHeader()
    + '<h1 class="doc-title">HÓA ĐƠN BÁN HÀNG</h1>'
    + '<div class="doc-sub">Số: ' + U.esc(si.code) + ' &nbsp;·&nbsp; Ngày ' + U.date(si.date) + '</div>'
    + '<table style="width:100%"><tr>'
    + '<td style="vertical-align:top;line-height:1.9;font-size:13px">'
    + 'Người mua:<br>Tên khách hàng: <b>' + U.esc(cus ? cus.name : '') + '</b><br>'
    + (si.subStore ? 'Cửa hàng con (giao tại): <b>' + U.esc(si.subStore) + '</b><br>' : '')
    + 'Địa chỉ: ' + U.esc(cus ? (cus.address || '') : '') + '<br>'
    + 'Điện thoại: ' + U.esc(cus ? (cus.phone || '') : '') + '<br>'
    + 'Mã số thuế: ' + U.esc(cus ? (cus.taxCode || '') : '') + '<br>'
    + 'Diễn giải: ' + U.esc(si.note || '') + '<br>'
    + 'Nhân viên bán hàng: ' + U.esc(emp ? emp.name : '') + '</td>'
    + '<td style="vertical-align:top;line-height:1.9;font-size:13px;width:200px">'
    + 'Nợ: ' + U.esc(accD) + '<br>Có: ' + U.esc(accC) + '<br>Loại tiền: VND</td>'
    + '</tr></table>'
    + '<table class="it"><thead><tr>' + head + '</tr></thead><tbody>' + M._itemRows(si, true, bc, true, bcMode) + '</tbody>'
    + '<tfoot>'
    + '<tr><td colspan="' + congSpan + '" class="r"><b>Cộng</b></td><td class="r"><b>' + U.num(si.items.reduce((s, it) => s + Number(it.qty || 0), 0)) + '</b></td><td></td><td class="r"><b>' + U.money(gross) + '</b></td></tr>'
    + '<tr><td colspan="' + totSpan + '" class="r">Cộng tiền hàng</td><td class="r">' + U.money(gross) + '</td></tr>'
    + (disc > 0 ? '<tr><td colspan="' + totSpan + '" class="r">Giảm giá</td><td class="r">-' + U.money(disc) + '</td></tr>' : '')
    + (Number(si.vatRate) ? '<tr><td colspan="' + totSpan + '" class="r">Thuế GTGT (' + si.vatRate + '%)</td><td class="r">' + U.money(vat) + '</td></tr>' : '')
    + '<tr><td colspan="' + totSpan + '" class="r" style="font-weight:800;color:#5a8e2e">TỔNG THANH TOÁN</td><td class="r" style="font-weight:800;color:#5a8e2e">' + U.money(grand) + '</td></tr>'
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
  const disc = Number(si.discount || 0), gross = sub + disc;
  const ch = PW.channel(si.channelId);
  const bcMode = opts && opts.bcMode;
  const bc = M._anyBarcode(si.items, bcMode);
  const totSpan = bc ? 7 : 6;   // có cột Mã hàng (+1) và Mã vạch (+1 khi có)
  const head = '<th class="c" style="width:34px">STT</th>' + (bc ? '<th class="c">' + M._barcodeLabel(bcMode) + '</th>' : '') + '<th>Mã hàng</th><th>Tên hàng hóa</th><th class="c">ĐVT</th><th class="r">SL</th><th class="r">Đơn giá</th><th class="r">Thành tiền</th>';
  const inner = M._companyHeader()
    + '<h1 class="doc-title">PHIẾU GIAO HÀNG</h1>'
    + '<div class="doc-sub">Số: ' + U.esc(si.code) + ' &nbsp;·&nbsp; Ngày ' + U.date(si.date)
    + (ch ? ' &nbsp;·&nbsp; Kênh: ' + U.esc(ch.name) : '') + (si.trackingCode ? ' &nbsp;·&nbsp; Mã VĐ: ' + U.esc(si.trackingCode) : '') + '</div>'
    + '<div class="party"><b>Người nhận:</b> ' + U.esc(cus ? cus.name : '') + '<br>'
    + '<b>Điện thoại:</b> ' + U.esc(cus ? cus.phone : '') + '<br>'
    + '<b>Địa chỉ giao:</b> ' + U.esc(cus ? cus.address : '') + '</div>'
    + '<table class="it"><thead><tr>' + head + '</tr></thead><tbody>' + M._itemRows(si, true, bc, true, bcMode) + '</tbody>'
    + '<tfoot>'
    + '<tr><td colspan="' + totSpan + '" class="r">Cộng tiền hàng</td><td class="r">' + U.money(gross) + '</td></tr>'
    + (disc > 0 ? '<tr><td colspan="' + totSpan + '" class="r">Giảm giá</td><td class="r">-' + U.money(disc) + '</td></tr>' : '')
    + (Number(si.vatRate) ? '<tr><td colspan="' + totSpan + '" class="r">Thuế GTGT (' + si.vatRate + '%)</td><td class="r">' + U.money(vat) + '</td></tr>' : '')
    + '<tr><td colspan="' + totSpan + '" class="r" style="font-weight:800;color:#5a8e2e">TỔNG GIÁ TRỊ</td><td class="r" style="font-weight:800;color:#5a8e2e">' + U.money(grand) + '</td></tr>'
    + '<tr><td colspan="' + totSpan + '" class="r">Đã thanh toán</td><td class="r">' + U.money(si.paid || 0) + '</td></tr>'
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
  const disc = Number(si.discount || 0), gross = sub + disc;
  const accD = c.accDebit || '131';   // Nợ: phải thu khách hàng
  const accC = c.accCredit || '5111';  // Có: doanh thu bán hàng
  const [yy, mm, dd] = (si.date || U.today()).split('-');

  const bcMode = opts && opts.bcMode;
  const bc = M._anyBarcode(si.items, bcMode);
  const congSpan = bc ? 5 : 4, totSpan = bc ? 7 : 6;   // colspan tfoot tăng 1 khi có cột Mã vạch
  const rows = si.items.map((it, i) => {
    const p = PW.product(it.productId);
    const price = Number(it.price || 0);
    return '<tr><td class="c">' + (i + 1) + '</td><td>' + U.esc(p ? p.code : '') + '</td>'
      + (bc ? '<td class="c">' + U.esc(M._barcodeVal(p, bcMode)) + '</td>' : '')
      + '<td>' + U.esc(p ? p.name : '') + '</td>'
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
    + (si.subStore ? 'Cửa hàng con (giao tại): <b>' + U.esc(si.subStore) + '</b><br>' : '')
    + 'Địa chỉ: ' + U.esc(cus ? cus.address : '') + '<br>'
    + 'Điện thoại: ' + U.esc(cus ? cus.phone : '') + '<br>'
    + 'Mã số thuế: ' + U.esc(cus ? (cus.taxCode || '') : '') + '<br>'
    + 'Diễn giải: ' + U.esc(si.note || '') + '<br>'
    + 'Nhân viên bán hàng: ' + U.esc(emp ? emp.name : '') + '</td>'
    + '<td style="vertical-align:top;line-height:1.9;font-size:13px;width:200px">'
    + 'Nợ: ' + U.esc(accD) + '<br>Có: ' + U.esc(accC) + '<br>Loại tiền: VND</td>'
    + '</tr></table>'
    + '<table class="it"><thead><tr><th class="c" style="width:32px">STT</th><th>Mã hàng</th>'
    + (bc ? '<th class="c">' + M._barcodeLabel(bcMode) + '</th>' : '') + '<th>Tên hàng</th>'
    + '<th class="c">Đơn vị</th><th class="r">Số lượng</th><th class="r">Đơn giá</th><th class="r">Thành tiền</th></tr></thead>'
    + '<tbody>' + rows + '</tbody>'
    + '<tfoot>'
    + '<tr><td colspan="' + congSpan + '" class="r"><b>Cộng</b></td><td class="r"><b>' + U.num(si.items.reduce((s, it) => s + Number(it.qty || 0), 0)) + '</b></td><td></td><td class="r"><b>' + U.money(gross) + '</b></td></tr>'
    + '<tr><td colspan="' + totSpan + '" class="r"><b>Cộng tiền hàng</b></td><td class="r"><b>' + U.money(gross) + '</b></td></tr>'
    + (disc > 0 ? '<tr><td colspan="' + totSpan + '" class="r">Giảm giá</td><td class="r">-' + U.money(disc) + '</td></tr>' : '')
    + '<tr><td colspan="' + totSpan + '" class="r">Thuế GTGT (' + (Number(si.vatRate) || 0) + '%)</td><td class="r">' + U.money(vat) + '</td></tr>'
    + '<tr><td colspan="' + totSpan + '" class="r" style="font-weight:800;color:#5a8e2e">TỔNG TIỀN THANH TOÁN</td><td class="r" style="font-weight:800;color:#5a8e2e">' + U.money(grand) + '</td></tr>'
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
  if (si.subStore) rows.push(['Cửa hàng con (giao tại):', si.subStore]);
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
  const _disc = Number(si.discount || 0), _gross = PW.invoiceTotal(si) + _disc;
  rows.push(['', '', 'Cộng', '', si.items.reduce((s, it) => s + Number(it.qty || 0), 0), '', _gross]);
  rows.push([]);
  // Tổng
  rows.push(['', '', '', '', '', 'Cộng tiền hàng', _gross]);
  if (_disc > 0) rows.push(['', '', '', '', '', 'Giảm giá', -_disc]);
  if (PW.invoiceVat(si)) rows.push(['', '', '', '', '', 'Thuế GTGT (' + (Number(si.vatRate) || 0) + '%)', PW.invoiceVat(si)]);
  rows.push(['', '', '', '', '', 'TỔNG THANH TOÁN', grand]);
  rows.push(['', '', '', '', '', 'Đã thu', Number(si.paid || 0)]);
  rows.push(['', '', '', '', '', 'Còn nợ', grand - Number(si.paid || 0)]);
  rows.push(['Số tiền bằng chữ:', U.readMoneyVN(grand)]);
  return rows;
};
// Trả về { blob, ext }. Ưu tiên Excel ĐẸP (ExcelJS: viền/đậm/font/in/freeze/lọc/SUM/logo);
// lỗi -> bản thường (SheetJS) -> CSV.
M._invoiceExcelBlob = async function (si, bcMode) {
  try { return await M._invoiceExcelExcelJS(si, bcMode); }
  catch (e) { console.warn('Excel đẹp (ExcelJS) lỗi -> bản thường:', e); }
  return M._invoiceExcelSheetJS(si);
};
/* ===== Excel ĐẸP như MISA (ExcelJS) — bcMode: 'none'|'fahasa'|'pn' ===== */
M._invoiceExcelExcelJS = async function (si, bcMode) {
  await M._ensureExcelJsLib();
  const EJS = window.ExcelJS;
  const c = M.company(), cus = PW.customer(si.customerId);
  const emp = si.employeeId && PW.data.employees ? PW.data.employees.find(e => e.id === si.employeeId) : null;
  const ch = PW.channel && PW.channel(si.channelId);
  const vatRate = Number(si.vatRate) || 0, paid = Number(si.paid || 0), grand = PW.invoiceGrand(si);
  const total = PW.invoiceTotal(si), vat = PW.invoiceVat(si);   // dùng làm GIÁ TRỊ ĐÃ TÍNH (cache) cho công thức
  const disc = Number(si.discount || 0), gross = total + disc;  // gross = tiền hàng trước giảm giá
  const FN = 'Times New Roman', GREEN = 'FF5A8E2E', HEADBG = 'FFEEF6E1', LINE = 'FFB9C4A8';
  const fnt = o => Object.assign({ name: FN }, o || {});
  const bThin = { style: 'thin', color: { argb: LINE } };
  const boxAll = { top: bThin, left: bThin, bottom: bThin, right: bThin };

  const wb = new EJS.Workbook();
  const ws = wb.addWorksheet('HoaDon', {
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, horizontalCentered: true, margins: { left: 0.5, right: 0.4, top: 0.6, bottom: 0.5, header: 0.3, footer: 0.3 } },
  });
  // Cấu trúc cột (thêm 'Mã vạch' theo bcMode khi chọn FAHASA/Phương Nam)
  const showBC = M._anyBarcode(si.items, bcMode);
  const colList = showBC
    ? [['stt', 'STT', 9], ['code', 'Mã hàng', 18], ['barcode', M._barcodeLabel(bcMode), 18], ['name', 'Tên hàng', 46], ['unit', 'ĐVT', 9], ['qty', 'Số lượng', 11], ['price', 'Đơn giá', 15], ['amount', 'Thành tiền', 17]]
    : [['stt', 'STT', 9], ['code', 'Mã hàng', 18], ['name', 'Tên hàng', 46], ['unit', 'ĐVT', 9], ['qty', 'Số lượng', 11], ['price', 'Đơn giá', 15], ['amount', 'Thành tiền', 17]];
  const NC = colList.length, idxOf = {};
  colList.forEach((c, i) => { idxOf[c[0]] = i + 1; });
  const L = n => { let s = ''; while (n > 0) { s = String.fromCharCode(65 + ((n - 1) % 26)) + s; n = Math.floor((n - 1) / 26); } return s; };
  const QC = L(idxOf.qty), PC = L(idxOf.price), AC = L(idxOf.amount);
  ws.columns = colList.map(c => ({ width: c[2] }));
  const merge = (r1, x1, r2, x2) => ws.mergeCells(r1, x1, r2, x2);
  let cc;

  // ---- Header công ty (logo trái + chữ) ----
  merge(1, 2, 1, NC); cc = ws.getCell(1, 2); cc.value = c.name || 'DALI'; cc.font = fnt({ bold: true, size: 14, color: { argb: GREEN } }); cc.alignment = { vertical: 'middle' };
  merge(2, 2, 2, NC); cc = ws.getCell(2, 2); cc.value = c.address ? 'Địa chỉ: ' + c.address : ''; cc.font = fnt({ size: 10, color: { argb: 'FF555555' } });
  merge(3, 2, 3, NC); cc = ws.getCell(3, 2); cc.value = [(c.phone ? 'ĐT: ' + c.phone : ''), (c.mst ? 'MST: ' + c.mst : '')].filter(Boolean).join('     ·     '); cc.font = fnt({ size: 10, color: { argb: 'FF555555' } });
  ws.getRow(1).height = 18; ws.getRow(2).height = 15; ws.getRow(3).height = 15;
  const logo = await M._logoBase64();
  if (logo) { try { const id = wb.addImage({ base64: logo, extension: 'png' }); ws.addImage(id, { tl: { col: 0.15, row: 0.1 }, ext: { width: 60, height: 54 } }); } catch (e) {} }

  // ---- Tiêu đề ----
  merge(5, 1, 5, NC); cc = ws.getCell(5, 1); cc.value = 'HÓA ĐƠN BÁN HÀNG'; cc.font = fnt({ bold: true, size: 17, color: { argb: 'FF1F2A16' } }); cc.alignment = { horizontal: 'center' }; ws.getRow(5).height = 24;
  merge(6, 1, 6, NC); cc = ws.getCell(6, 1); cc.value = 'Số: ' + si.code + '          Ngày ' + U.date(si.date); cc.font = fnt({ italic: true, size: 11, color: { argb: 'FF555555' } }); cc.alignment = { horizontal: 'center' };

  // ---- Khối người mua (nhãn đậm) ----
  let R = 6;
  const party = (label, val) => { R++; merge(R, 1, R, NC); const x = ws.getCell(R, 1); x.value = { richText: [{ font: fnt({ bold: true, size: 11 }), text: label }, { font: fnt({ size: 11 }), text: String(val || '') }] }; x.alignment = { vertical: 'middle' }; };
  party('Khách hàng: ', cus ? cus.name : '');
  if (si.subStore) party('Cửa hàng con (giao tại): ', si.subStore);
  party('Địa chỉ: ', cus ? (cus.address || '') : '');
  party('Điện thoại: ', (cus ? (cus.phone || '') : '') + '          Mã số thuế: ' + (cus ? (cus.taxCode || '') : ''));
  if (ch) party('Kênh bán: ', ch.name);
  if (emp) party('Nhân viên bán hàng: ', emp.name);
  if (si.note) party('Diễn giải: ', si.note);
  if (si.dueDate) party('Hạn thanh toán: ', U.date(si.dueDate));

  // ---- Bảng hàng hóa ----
  R += 2; const HEAD = R;
  colList.forEach((col, i) => {
    const x = ws.getCell(HEAD, i + 1); x.value = col[1]; x.font = fnt({ bold: true, size: 11, color: { argb: 'FF28471A' } });
    x.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADBG } }; x.border = boxAll; x.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });
  ws.getRow(HEAD).height = 18;
  const FIRST = HEAD + 1;
  si.items.forEach((it, i) => {
    R++; const p = PW.product(it.productId), qty = Number(it.qty) || 0, price = Number(it.price || 0);
    colList.forEach((col, ci) => {
      const x = ws.getCell(R, ci + 1); let v;
      switch (col[0]) {
        case 'stt': v = i + 1; break;
        case 'code': v = p ? p.code : ''; break;
        case 'barcode': v = M._barcodeVal(p, bcMode); break;
        case 'name': v = p ? p.name : ''; break;
        case 'unit': v = p ? p.unit : ''; break;
        case 'qty': v = qty; break;
        case 'price': v = price; break;
        default: v = { formula: QC + R + '*' + PC + R, result: qty * price };   // kèm GIÁ TRỊ -> trình xem không tự tính vẫn hiện đúng
      }
      x.value = v; x.font = fnt({ size: 10.5 }); x.border = boxAll;
      if (col[0] === 'stt' || col[0] === 'unit' || col[0] === 'barcode') x.alignment = { horizontal: 'center', vertical: 'middle' };
      else if (col[0] === 'qty' || col[0] === 'price' || col[0] === 'amount') { x.alignment = { horizontal: 'right', vertical: 'middle' }; x.numFmt = '#,##0'; }
      else x.alignment = { vertical: 'middle', wrapText: true };
    });
  });
  const LAST = R;
  const totalQty = si.items.reduce((s, it) => s + (Number(it.qty) || 0), 0);
  // Cộng
  R++;
  merge(R, 1, R, idxOf.qty - 1); cc = ws.getCell(R, 1); cc.value = 'Cộng'; cc.font = fnt({ bold: true, size: 11 }); cc.alignment = { horizontal: 'right', vertical: 'middle' };
  for (let k = 1; k <= NC; k++) ws.getCell(R, k).border = boxAll;
  cc = ws.getCell(R, idxOf.qty); cc.value = { formula: 'SUM(' + QC + FIRST + ':' + QC + LAST + ')', result: totalQty }; cc.font = fnt({ bold: true }); cc.alignment = { horizontal: 'right' }; cc.numFmt = '#,##0';
  cc = ws.getCell(R, idxOf.amount); cc.value = { formula: 'SUM(' + AC + FIRST + ':' + AC + LAST + ')', result: gross }; cc.font = fnt({ bold: true }); cc.alignment = { horizontal: 'right' }; cc.numFmt = '#,##0';

  // ---- Tổng (nhãn gộp đến trước cột Thành tiền, giá trị ở cột Thành tiền) ----
  const totalRow = (label, val, big) => {
    R += 1; merge(R, 2, R, idxOf.amount - 1); const lc = ws.getCell(R, 2);
    lc.value = label; lc.font = fnt({ bold: !!big, size: big ? 12 : 11, color: { argb: big ? GREEN : 'FF333333' } }); lc.alignment = { horizontal: 'right', vertical: 'middle' };
    const vc = ws.getCell(R, idxOf.amount); vc.value = val; vc.font = fnt({ bold: !!big, size: big ? 12 : 11, color: { argb: big ? GREEN : 'FF333333' } }); vc.alignment = { horizontal: 'right', vertical: 'middle' }; vc.numFmt = '#,##0';
    return R;
  };
  R += 1; // spacer
  const subR = totalRow('Cộng tiền hàng', { formula: 'SUM(' + AC + FIRST + ':' + AC + LAST + ')', result: gross });
  // Giảm giá -> dòng riêng; "baseR" = tiền hàng sau giảm (để VAT & TỔNG khớp công thức ↔ kết quả cache)
  let baseR = subR;
  if (disc > 0) {
    const discR = totalRow('Giảm giá', -disc);   // số âm, không công thức
    baseR = totalRow('Tiền hàng sau giảm', { formula: AC + subR + '+' + AC + discR, result: total });
  }
  let vatR = null;
  if (vatRate) vatR = totalRow('Tiền thuế GTGT (' + vatRate + '%)', { formula: 'ROUND(' + AC + baseR + '*' + vatRate + '/100,0)', result: vat });
  const tongR = totalRow('TỔNG THANH TOÁN', { formula: vatR ? (AC + baseR + '+' + AC + vatR) : (AC + baseR), result: grand }, true);
  const paidR = totalRow('Đã thanh toán', paid);
  totalRow('Còn phải thu', { formula: AC + tongR + '-' + AC + paidR, result: grand - paid });

  R += 1; merge(R, 1, R, NC); cc = ws.getCell(R, 1);
  cc.value = { richText: [{ font: fnt({ size: 11 }), text: 'Số tiền viết bằng chữ: ' }, { font: fnt({ italic: true, bold: true, size: 11 }), text: U.readMoneyVN(grand) }] };

  // ---- Chữ ký ----
  const half = Math.floor(NC / 2);
  R += 2; merge(R, 1, R, half); merge(R, half + 1, R, NC);
  cc = ws.getCell(R, 1); cc.value = 'Người mua hàng'; cc.font = fnt({ bold: true, size: 11 }); cc.alignment = { horizontal: 'center' };
  cc = ws.getCell(R, half + 1); cc.value = 'Người bán hàng'; cc.font = fnt({ bold: true, size: 11 }); cc.alignment = { horizontal: 'center' };
  R += 1; merge(R, 1, R, half); merge(R, half + 1, R, NC);
  cc = ws.getCell(R, 1); cc.value = '(Ký, ghi rõ họ tên)'; cc.font = fnt({ italic: true, size: 9.5, color: { argb: 'FF777777' } }); cc.alignment = { horizontal: 'center' };
  cc = ws.getCell(R, half + 1); cc.value = '(Ký, ghi rõ họ tên)'; cc.font = fnt({ italic: true, size: 9.5, color: { argb: 'FF777777' } }); cc.alignment = { horizontal: 'center' };
  const LASTROW = R;

  // ---- Freeze + Lọc + Vùng in + Lặp tiêu đề cột ----
  ws.views = [{ state: 'frozen', ySplit: HEAD }];
  if (LAST >= FIRST) ws.autoFilter = { from: { row: HEAD, column: 1 }, to: { row: LAST, column: NC } };
  ws.pageSetup.printArea = 'A1:' + L(NC) + LASTROW;
  ws.pageSetup.printTitlesRow = HEAD + ':' + HEAD;

  const buf = await wb.xlsx.writeBuffer();
  return { blob: new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), ext: 'xlsx' };
};
/* ===== Bản thường (SheetJS) — dự phòng khi ExcelJS lỗi ===== */
M._invoiceExcelSheetJS = async function (si) {
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
    if (si.subStore) wide('Cửa hàng con (giao tại): ' + si.subStore);
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
    const _disc = Number(si.discount || 0), _gross = total + _disc;
    { const r = rows.length; rows.push(['', 'Cộng', '', '', si.items.reduce((s, it) => s + Number(it.qty || 0), 0), '', _gross]); merges.push({ s: { r, c: 1 }, e: { r, c: 3 } }); money.push([r, 6]); }
    rows.push([]);
    // Tổng — nhãn gộp B:F (rộng, không cắt), giá trị ở G
    const tot = (label, val) => { const r = rows.length; rows.push(['', label, '', '', '', '', val]); merges.push({ s: { r, c: 1 }, e: { r, c: 5 } }); money.push([r, 6]); };
    tot('Cộng tiền hàng', _gross);
    if (_disc > 0) tot('Giảm giá', -_disc);
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
M.exportDocExcel = async function (si, fname, bcMode) {
  U.toast('Đang tạo Excel...');
  const { blob, ext } = await M._invoiceExcelBlob(si, bcMode);
  M._download(blob, (fname || 'HoaDon-' + si.code) + '.' + ext);
  U.toast('Đã xuất Excel: ' + (fname || si.code));
};

/* ============================================================
   XUẤT BÁO CÁO DANH SÁCH -> Excel ĐẸP (ExcelJS) — như MISA
   opts = {
     title, subtitle, fname,
     columns: [{header, width, align:'left'|'center'|'right', money:bool}],
     rows: [[cell,...]],                 // giá trị thô; cột money là số
     totals: [cell,...]|null,            // căn theo columns; số -> money đậm, chuỗi -> đậm, null -> trống
     totalsLabel, totalsLabelSpan        // gộp ô nhãn tổng ở đầu dòng tổng
   }
   Lỗi -> tự lui về .xlsx thường (SheetJS) -> .xls (HTML).
   ============================================================ */
M.exportListExcel = async function (opts) {
  U.toast('Đang tạo Excel báo cáo...');
  try { const r = await M._listExcelExcelJS(opts); M._download(r.blob, (opts.fname || 'BaoCao') + '.xlsx'); U.toast('Đã xuất Excel: ' + (opts.fname || 'báo cáo')); return; }
  catch (e) { console.warn('Excel báo cáo (ExcelJS) lỗi -> bản thường:', e); }
  try {
    await M._ensureXlsxLib(); const X = window.XLSX;
    const cols = opts.columns, head = cols.map(c => c.header);
    const aoa = [[opts.title || 'BÁO CÁO']];
    if (opts.subtitle) aoa.push([opts.subtitle]);
    aoa.push([]); aoa.push(head);
    opts.rows.forEach(r => aoa.push(r.slice()));
    if (opts.totals) aoa.push(opts.totals.map(v => v == null ? '' : v));
    const ws = X.utils.aoa_to_sheet(aoa);
    ws['!cols'] = cols.map(c => ({ wch: c.width || 14 }));
    const wb = X.utils.book_new(); X.utils.book_append_sheet(wb, ws, 'BaoCao');
    const arr = X.write(wb, { bookType: 'xlsx', type: 'array' });
    M._download(new Blob([arr], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), (opts.fname || 'BaoCao') + '.xlsx');
    U.toast('Đã xuất Excel: ' + (opts.fname || 'báo cáo'));
  } catch (e2) {
    U.exportExcel(opts.fname || 'BaoCao', opts.columns.map(c => c.header), opts.rows, opts.title);
  }
};
// Dòng phụ đề báo cáo: kỳ lọc + bộ lọc khác + ngày xuất
M._reportSubtitle = function (st, extra) {
  const parts = [];
  if (st && (st.from || st.to)) parts.push('Kỳ: ' + (st.from ? U.date(st.from) : '…') + ' → ' + (st.to ? U.date(st.to) : '…'));
  else parts.push('Kỳ: ' + ((st && U.PERIOD_LABEL[st.periodKey]) || 'Tất cả'));
  (extra || []).forEach(x => { if (x) parts.push(x); });
  parts.push('Ngày xuất: ' + U.date(U.today()));
  return parts.join('     ·     ');
};
M._listExcelExcelJS = async function (opts) {
  await M._ensureExcelJsLib();
  const EJS = window.ExcelJS, c = M.company();
  const cols = opts.columns, NC = cols.length;
  const FN = 'Times New Roman', GREEN = 'FF5A8E2E', HEADBG = 'FFEEF6E1', LINE = 'FFB9C4A8';
  const fnt = o => Object.assign({ name: FN }, o || {});
  const bThin = { style: 'thin', color: { argb: LINE } };
  const boxAll = { top: bThin, left: bThin, bottom: bThin, right: bThin };
  const wb = new EJS.Workbook();
  const ws = wb.addWorksheet('BaoCao', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 } },
  });
  ws.columns = cols.map(c2 => ({ width: c2.width || 14 }));
  const merge = (r1, x1, r2, x2) => ws.mergeCells(r1, x1, r2, x2);
  let cc;
  // Header công ty
  merge(1, 1, 1, NC); cc = ws.getCell(1, 1); cc.value = c.name || 'DALI'; cc.font = fnt({ bold: true, size: 13, color: { argb: GREEN } });
  let R = 1;
  if (c.address) { R = 2; merge(R, 1, R, NC); cc = ws.getCell(R, 1); cc.value = 'Địa chỉ: ' + c.address + (c.mst ? '     ·     MST: ' + c.mst : ''); cc.font = fnt({ size: 9.5, color: { argb: 'FF666666' } }); }
  // Tiêu đề báo cáo
  R += 2; merge(R, 1, R, NC); cc = ws.getCell(R, 1); cc.value = opts.title || 'BÁO CÁO'; cc.font = fnt({ bold: true, size: 16, color: { argb: 'FF1F2A16' } }); cc.alignment = { horizontal: 'center' }; ws.getRow(R).height = 22;
  if (opts.subtitle) { R += 1; merge(R, 1, R, NC); cc = ws.getCell(R, 1); cc.value = opts.subtitle; cc.font = fnt({ italic: true, size: 10.5, color: { argb: 'FF555555' } }); cc.alignment = { horizontal: 'center' }; }
  // Dòng tiêu đề cột
  R += 2; const HEAD = R;
  cols.forEach((col, i) => {
    const x = ws.getCell(HEAD, i + 1); x.value = col.header; x.font = fnt({ bold: true, size: 10.5, color: { argb: 'FF28471A' } });
    x.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADBG } }; x.border = boxAll; x.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });
  ws.getRow(HEAD).height = 20;
  const FIRST = HEAD + 1;
  opts.rows.forEach(row => {
    R++;
    cols.forEach((col, i) => {
      const x = ws.getCell(R, i + 1); x.value = (row[i] == null ? '' : row[i]); x.font = fnt({ size: 10 }); x.border = boxAll;
      const al = col.align || (col.money ? 'right' : 'left');
      x.alignment = { horizontal: al, vertical: 'middle', wrapText: col.align !== 'center' && !col.money };
      if (col.money) x.numFmt = '#,##0';
    });
  });
  const LAST = R;
  // Dòng TỔNG
  if (opts.totals) {
    R++;
    const span = opts.totalsLabelSpan || 0;
    if (span > 0) { merge(R, 1, R, span); cc = ws.getCell(R, 1); cc.value = opts.totalsLabel || 'TỔNG'; cc.font = fnt({ bold: true, size: 10.5 }); cc.alignment = { horizontal: 'left', vertical: 'middle' }; }
    cols.forEach((col, i) => {
      if (span > 0 && i < span) { ws.getCell(R, i + 1).border = boxAll; return; }
      const x = ws.getCell(R, i + 1); const v = opts.totals[i];
      x.value = (v == null ? '' : v); x.font = fnt({ bold: true, size: 10.5 }); x.border = boxAll;
      x.alignment = { horizontal: col.money ? 'right' : (col.align || 'left'), vertical: 'middle' };
      if (col.money && typeof v === 'number') x.numFmt = '#,##0';
    });
  }
  const LASTROW = R;
  ws.views = [{ state: 'frozen', ySplit: HEAD }];
  if (LAST >= FIRST) ws.autoFilter = { from: { row: HEAD, column: 1 }, to: { row: LAST, column: NC } };
  ws.pageSetup.printArea = 'A1:' + ws.getColumn(NC).letter + LASTROW;
  ws.pageSetup.printTitlesRow = HEAD + ':' + HEAD;
  const buf = await wb.xlsx.writeBuffer();
  return { blob: new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }) };
};

/* ---------- Gửi chứng từ qua Zalo ----------
   Ưu tiên đính kèm FILE PDF (builderFn tạo PDF). Điện thoại: Web Share -> chọn Zalo.
   Máy tính: tải tệp + copy nội dung + mở Zalo để đính kèm. (Gửi PDF tự động tới từng KH cần Zalo OA.) */
M.sendZalo = function (si, builderFn, size, fmt, bcMode) {
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
    M._invoiceExcelBlob(si, bcMode).then(({ blob, ext }) => {
      let f = null; try { f = new File([blob], 'HoaDon-' + si.code + '.' + ext, { type: blob.type }); } catch (e) {}
      shareFile(f);
    });
  }
  if (fmt === 'excel' || !builderFn) return sendExcel();   // gửi Excel (.xlsx)
  builderFn(si, size || 'A4', 'pdf-blob', { bcMode: bcMode, then: (blob) => {   // gửi PDF
    if (!blob) return sendExcel();
    let f = null; try { f = new File([blob], 'HoaDon-' + si.code + '.pdf', { type: 'application/pdf' }); } catch (e) {}
    shareFile(f);
  } });
};

/* ---------- Menu In / Xuất khẩu / Gửi Zalo (như MISA) ---------- */
/* ---------- Xuất file ĐÚNG QUY CÁCH lên PHẦN MỀM THUẾ (HĐĐT) ----------
   Sheet "SanPham" với 11 cột: STT | Mã sản phẩm | Tên sản phẩm | Đơn vị tính | Số lượng |
   Đơn giá | Thành tiền | Mức thuế | Ghi chú | Tiền thuế | Thành tiền có thuế.
   Mỗi dòng = 1 dòng hàng của hóa đơn. Mức thuế ghi dạng "8%" (như mẫu). */
M._TAX_HEADERS = ['STT', 'Mã sản phẩm', 'Tên sản phẩm', 'Đơn vị tính', 'Số lượng', 'Đơn giá', 'Thành tiền', 'Mức thuế', 'Ghi chú', 'Tiền thuế', 'Thành tiền có thuế'];
M._taxRows = function (si) {
  const rate = Number(si.vatRate) || 0;
  return si.items.map((it, i) => {
    const p = PW.product(it.productId);
    const qty = Number(it.qty) || 0, price = Number(it.price || 0);
    const tien = qty * price, thue = Math.round(tien * rate / 100);
    return [i + 1, p ? (p.code || '') : '', p ? p.name : '', p ? (p.unit || '') : '', qty, price, tien, rate + '%', '', thue, tien + thue];
  });
};
// Đọc KÍCH THƯỚC của 1 sản phẩm — CHỈ cho hàng là TRANH (để không gắn nhãn/gộp nhầm
// khung tranh, vật tư... có số kiểu "40x50" trong tên). Quy tắc:
//  (a) group LÀ kích thước (do import ký gửi đặt) -> chắc chắn là tranh nhóm theo size;
//  (b) group không phải size -> chỉ nhận nếu tên BẮT ĐẦU bằng "tranh" và KHÔNG thuộc
//      nhóm khung/vật tư/dịch vụ (loại "Khung tranh gỗ 40x50", "Bộ màu...", dịch vụ, NVL).
M._prodSize = function (p) {
  if (!p) return null;
  const byGroup = M._ciSize(M._ciNorm(p.group || ''));
  if (byGroup) return byGroup;
  if (p.kind === 'dichvu' || p.kind === 'nvl') return null;
  const nm = M._ciNorm(p.name || '');
  const tag = nm + ' ' + M._ciNorm(p.group || '');
  if (/(khung|vat tu|vat lieu|nguyen lieu|phu kien|phu lieu|cong cu|dung cu|dich vu)/.test(tag)) return null;
  if (!/^tranh\b/.test(nm)) return null;   // không phải tranh -> không gộp theo size
  return M._ciSize(M._ciNorm((p.code || '') + ' ' + nm));
};
// Hóa đơn này có phải nhà sách Phương Nam? (tên KH chứa "Phương Nam" hoặc có cửa hàng con)
M._isPhuongNam = function (si) {
  const cus = PW.customer(si.customerId);
  return /phuong nam/.test(M._ciNorm(cus ? cus.name : '')) || !!si.subStore;
};
// GỘP dòng hàng theo KÍCH THƯỚC (luồng Phương Nam): mỗi (size + đơn giá) -> 1 dòng
// "Tranh tô màu số hóa {size}", ĐVT "Tranh", SL = tổng. SP không đọc được size -> giữ 1 dòng riêng.
M._taxRowsBySize = function (si) {
  const rate = Number(si.vatRate) || 0;
  const groups = new Map();   // key: sizeKey|price -> { sizeDisp, qty, price }
  const loose = [];           // SP không có size -> giữ nguyên
  (si.items || []).forEach(it => {
    const p = PW.product(it.productId);
    const qty = Number(it.qty) || 0, price = Number(it.price || 0);
    const sz = M._prodSize(p);
    if (!sz) { loose.push({ p: p, qty: qty, price: price }); return; }
    const key = sz.key + '|' + price;
    const g = groups.get(key) || { sizeDisp: sz.key.toLowerCase(), qty: 0, price: price };
    g.qty += qty;
    groups.set(key, g);
  });
  const rows = [];
  let i = 0;
  Array.from(groups.values())
    .sort((a, b) => a.sizeDisp.localeCompare(b.sizeDisp) || a.price - b.price)
    .forEach(g => {
      const tien = g.qty * g.price, thue = Math.round(tien * rate / 100);
      rows.push([++i, g.sizeDisp.toUpperCase(), 'Tranh tô màu số hóa ' + g.sizeDisp, 'Tranh', g.qty, g.price, tien, rate + '%', '', thue, tien + thue]);
    });
  loose.forEach(x => {
    const tien = x.qty * x.price, thue = Math.round(tien * rate / 100);
    rows.push([++i, x.p ? (x.p.code || '') : '', x.p ? x.p.name : '', x.p ? (x.p.unit || 'Tranh') : 'Tranh', x.qty, x.price, tien, rate + '%', '', thue, tien + thue]);
  });
  return rows;
};
M.exportTaxUpload = async function (si, fname, opts) {
  opts = opts || {};
  U.toast('Đang tạo file lên phần mềm thuế...');
  try {
    await M._ensureXlsxLib();
    const X = window.XLSX;
    const aoa = [M._TAX_HEADERS].concat(opts.groupBySize ? M._taxRowsBySize(si) : M._taxRows(si));
    const ws = X.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 6 }, { wch: 14 }, { wch: 62 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 9 }, { wch: 14 }, { wch: 13 }, { wch: 17 }];
    // Định dạng số có dấu phân cách cho cột tiền: G(6), J(9), K(10)
    [6, 9, 10].forEach(col => { for (let r = 1; r < aoa.length; r++) { const ref = X.utils.encode_cell({ r: r, c: col }); if (ws[ref] && typeof ws[ref].v === 'number') ws[ref].z = '#,##0'; } });
    const wb = X.utils.book_new();
    X.utils.book_append_sheet(wb, ws, 'SanPham');   // tên sheet PHẢI là "SanPham"
    const arr = X.write(wb, { bookType: 'xlsx', type: 'array' });
    M._download(new Blob([arr], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), (fname || ('FileUpThue-' + si.code)) + '.xlsx');
    U.toast('Đã xuất file lên thuế: ' + (fname || si.code));
  } catch (e) { console.error('exportTaxUpload', e); U.toast('Không tạo được file thuế: ' + e.message, 'error'); }
};

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
  // Cột mã vạch trên chứng từ/file: Không có / FAHASA / Phương Nam
  const bcSel = C.select([
    { value: 'none', label: 'Không có mã vạch' },
    { value: 'fahasa', label: 'Mã vạch FAHASA' },
    { value: 'pn', label: 'Mã vạch Phương Nam' },
  ], 'none');
  const fnOf = () => ({ warehouse: M.warehouseIssueNote, invoice: M.printInvoice, delivery: M.deliveryNote }[typeSel.value] || M.warehouseIssueNote);
  const bcSuffix = () => ({ fahasa: '-FAHASA', pn: '-PhuongNam' }[bcSel.value] || '');
  // Phương Nam: gộp dòng hàng theo kích thước khi xuất file thuế (tự bật nếu là hóa đơn Phương Nam)
  const groupSizeChk = U.el('input', { type: 'checkbox' });
  groupSizeChk.checked = M._isPhuongNam(si);
  C.modal({
    title: 'In / Xuất / Gửi — ' + si.code,
    body: U.el('div', null, [
      U.el('div', { class: 'form-grid' }, [C.field('Loại chứng từ', typeSel), C.field('Khổ giấy', sizeSel), C.field('Cột mã vạch', bcSel)]),
      U.el('p', { class: 'section-sub', style: 'margin:12px 0 6px;font-weight:600' }, 'In / Xuất file:'),
      U.el('div', { class: 'pill-row' }, [
        C.btn('🖨 In', () => { const fn = fnOf(); C.closeModal(); fn(si, sizeSel.value, 'print', { bcMode: bcSel.value }); }, 'primary'),
        C.btn('📄 Xuất PDF', () => { const fn = fnOf(), sz = sizeSel.value, bm = bcSel.value; M.askFileName('HoaDon-' + si.code + bcSuffix(), 'pdf', nm => fn(si, sz, 'pdf', { fname: nm, bcMode: bm })); }),
        C.btn('📊 Xuất Excel', () => { const bm = bcSel.value; M.askFileName('HoaDon-' + si.code + bcSuffix(), 'xlsx', nm => M.exportDocExcel(si, nm, bm)); }),
      ]),
      U.el('p', { class: 'section-sub', style: 'margin:14px 0 6px;font-weight:600' }, 'Hóa đơn điện tử (phần mềm thuế):'),
      U.el('div', { style: 'margin:0 0 8px' },
        U.el('label', { class: 'radio', style: 'font-size:12px' }, [groupSizeChk, ' Gộp theo kích thước (Phương Nam) — gộp các tranh cùng size thành 1 dòng "Tranh tô màu số hóa {size}"'])),
      U.el('div', { class: 'pill-row' }, [
        C.btn('🧾 Xuất file lên phần mềm thuế', () => { const gb = groupSizeChk.checked; M.askFileName('FileUpThue-' + si.code, 'xlsx', nm => M.exportTaxUpload(si, nm, { groupBySize: gb })); }, 'primary'),
      ]),
      U.el('p', { class: 'section-sub', style: 'margin:14px 0 6px;font-weight:600' }, 'Gửi cho khách qua Zalo:'),
      U.el('div', { class: 'pill-row' }, [
        C.btn('💬 Gửi Zalo (PDF)', () => { M.sendZalo(si, fnOf(), sizeSel.value, 'pdf', bcSel.value); }, 'primary'),
        C.btn('📊 Gửi Zalo (Excel)', () => { M.sendZalo(si, null, sizeSel.value, 'excel', bcSel.value); }),
      ]),
      U.el('p', { class: 'section-sub', style: 'margin:6px 0 0;font-size:11.5px' },
        'File lên thuế: đúng quy cách sheet "SanPham" (STT, Mã/Tên SP, ĐVT, SL, Đơn giá, Thành tiền, Mức thuế, Tiền thuế, Thành tiền có thuế) — tải về rồi up thẳng lên phần mềm HĐĐT. Xuất PDF/Excel: đặt tên file rồi tải về máy. Gửi Zalo: điện thoại mở khay chia sẻ chọn Zalo (kèm PDF).'),
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
