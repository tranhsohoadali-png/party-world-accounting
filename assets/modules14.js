/* ============================================================
   modules14.js — Gom đơn ký gửi (tự khớp mã hàng từ nhiều nhà sách)
   ------------------------------------------------------------
   Bài toán: hàng ký gửi, mỗi nhà sách đặt tên một kiểu; chỉ mã hàng
   (vd "K452 20x25" = mã tranh + kích thước) là chung. Màn này nhận
   danh sách bán (dán văn bản / file CSV / ảnh chụp qua AI), tự nhận
   diện mã + size + SL + giá, khớp về danh mục hàng hóa, học bí danh
   theo từng nhà sách, rồi tạo Hóa đơn bán / Đơn đặt hàng một nút.
   ============================================================ */

/* ---------- Chuẩn hóa & nhận diện ---------- */

// Bỏ dấu tiếng Việt, thường hóa, gọn khoảng trắng
M._ciNorm = function (s) {
  return String(s || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')
    .replace(/[×*]/g, 'x')
    .replace(/[^a-z0-9x\s\-_.:|,]/g, ' ')
    .replace(/\s+/g, ' ').trim();
};

// Kích thước "20x25" -> { token:'20x25', key:'20X25' } (key sắp xếp để 25x20 == 20x25)
M._ciSize = function (normed) {
  const m = normed.match(/(\d{2,3})\s*x\s*(\d{2,3})/);
  if (!m) return null;
  const a = Number(m[1]), b = Number(m[2]);
  return { token: m[0], key: Math.min(a, b) + 'X' + Math.max(a, b) };
};

// Mã hàng "K452" / "k-452" / "TSH4050" (1-4 chữ cái + 1-5 số, ưu tiên viết liền)
M._ciCode = function (normed) {
  const re = /\b([a-z]{1,4})\s*[-_.]?\s*(\d{1,5})\b/g;
  // Từ thường gặp đứng cạnh số nhưng KHÔNG phải mã hàng ("x3"=SL, "gói 100", "mục 2"...)
  const SKIP = { x: 1, sl: 1, size: 1, gia: 1, goi: 1, cai: 1, bo: 1, set: 1, muc: 1,
    so: 1, ngay: 1, hop: 1, tui: 1, lo: 1, tam: 1, to: 1, cuon: 1, thung: 1, trang: 1 };
  let best = null, m;
  while ((m = re.exec(normed)) !== null) {
    if (SKIP[m[1]]) continue;
    const joined = m[0].indexOf(' ') === -1;
    if (!joined && m[2].length < 2) continue;   // mã cách quãng phải có >=2 chữ số ("k 452" ok, "mục 2" loại)
    const cand = { key: (m[1] + m[2]).toUpperCase(), token: m[0], joined: joined };
    if (!best || (cand.joined && !best.joined)) best = cand;
    if (cand.joined) break; // mã viết liền đầu tiên là chắc nhất
  }
  return best;
};

// Tách 1 dòng đơn hàng -> { raw, name, codeKey, sizeKey, qty, price }
M._ciParseLine = function (line) {
  const raw = line.trim();
  if (!raw) return null;
  const cells = raw.indexOf('\t') >= 0 ? raw.split('\t')
    : (raw.indexOf('|') >= 0 ? raw.split('|')
    : (raw.split(';').length > 2 ? raw.split(';') : null));
  let text = raw, qtyCell = null, priceCell = null;
  if (cells) {
    // Dòng Excel/CSV: ô chữ dài nhất = tên; ô số nguyên nhỏ = SL; ô số lớn = giá
    let name = '';
    cells.forEach(c => {
      const t = c.trim();
      if (!t) return;
      const pure = t.replace(/[.,\s]/g, '');
      if (/^\d+$/.test(pure)) {
        const n = Number(pure);
        if (n >= 1000) { if (priceCell == null) priceCell = n; }
        else if (n >= 1 && n <= 9999) { if (qtyCell == null) qtyCell = n; }
      } else if (t.length > name.length) name = t;
    });
    text = name || raw;
  }
  let normed = M._ciNorm(text);
  if (!normed || !/\d|[a-z]{3,}/.test(normed)) return null;   // dòng không có nội dung hàng
  const size = M._ciSize(normed);
  if (size) normed = normed.replace(size.token, ' ');
  const code = M._ciCode(normed);
  let rest = code ? normed.replace(code.token, ' ') : normed;

  // Bí danh = tên chuẩn hóa SAU KHI loại SL/giá (để lần sau SL khác vẫn khớp)
  let aliasKey = M._ciNorm(text);
  // Số lượng trong văn bản tự do
  let qty = qtyCell;
  if (qty == null) {
    const qm = rest.match(/\bsl\s*[:=.]?\s*(\d{1,4})\b/) ||
               rest.match(/\bso luong\s*[:=.]?\s*(\d{1,4})\b/) ||
               rest.match(/(?:^|\s)x\s*(\d{1,4})\b/) ||
               rest.match(/\b(\d{1,4})\s*x(?:\s|$)/) ||
               rest.match(/\b(\d{1,4})\s*(?:cai|buc|chiec|bo|set|cuon|tam|to|tranh)\b/);
    if (qm) { qty = Number(qm[1]); rest = rest.replace(qm[0], ' '); aliasKey = aliasKey.replace(qm[0], ' '); }
  }
  // Đơn giá trong văn bản tự do
  let price = priceCell;
  if (price == null) {
    const pm = rest.match(/\b(\d{1,3}(?:[.,]\d{3})+)\b/) || rest.match(/\b(\d{4,9})\b/);
    if (pm) { price = Number(pm[1].replace(/[.,]/g, '')); aliasKey = aliasKey.replace(pm[0], ' '); }
    else {
      const km = rest.match(/\b(\d{1,4})\s*k\b/);
      if (km) { price = Number(km[1]) * 1000; aliasKey = aliasKey.replace(km[0], ' '); }
    }
  }
  return {
    raw: raw, name: text.trim(),
    aliasKey: aliasKey.replace(/[\s\-_.:|,]+/g, ' ').trim(),
    codeKey: code ? code.key : '', sizeKey: size ? size.key : '',
    qty: qty || 1, price: price || 0,
  };
};

/* ---------- Đọc file Excel (.xlsx) ngay trong trình duyệt ---------- */
// Đọc cấu trúc ZIP tối thiểu (đủ cho .xlsx): EOCD -> central directory -> entry.
// Giải nén deflate bằng DecompressionStream có sẵn của trình duyệt (không cần thư viện).
M._ciZipRead = async function (buf) {
  const dv = new DataView(buf);
  const u8 = new Uint8Array(buf);
  let eocd = -1;
  const stop = Math.max(0, buf.byteLength - 65557);
  for (let i = buf.byteLength - 22; i >= stop; i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('File không phải Excel (.xlsx) hợp lệ');
  const count = dv.getUint16(eocd + 10, true);
  let off = dv.getUint32(eocd + 16, true);
  const entries = {};
  for (let n = 0; n < count; n++) {
    if (dv.getUint32(off, true) !== 0x02014b50) break;
    const method = dv.getUint16(off + 10, true);
    const csize = dv.getUint32(off + 20, true);
    const nameLen = dv.getUint16(off + 28, true);
    const extraLen = dv.getUint16(off + 30, true);
    const cmtLen = dv.getUint16(off + 32, true);
    const lho = dv.getUint32(off + 42, true);
    const name = new TextDecoder().decode(u8.subarray(off + 46, off + 46 + nameLen));
    entries[name] = { method: method, csize: csize, lho: lho };
    off += 46 + nameLen + extraLen + cmtLen;
  }
  return {
    names: Object.keys(entries),
    read: async function (name) {
      const e = entries[name]; if (!e) return null;
      const lnl = dv.getUint16(e.lho + 26, true), lel = dv.getUint16(e.lho + 28, true);
      const start = e.lho + 30 + lnl + lel;
      const slice = u8.subarray(start, start + e.csize);
      if (e.method === 0) return new TextDecoder().decode(slice);
      if (e.method === 8) {
        const ds = new DecompressionStream('deflate-raw');
        return await new Response(new Blob([slice]).stream().pipeThrough(ds)).text();
      }
      throw new Error('File ZIP dùng kiểu nén chưa hỗ trợ');
    },
  };
};

// .xlsx -> mảng dòng "ô1<TAB>ô2..." (sheet đầu tiên, giữ đúng vị trí cột)
M._ciXlsxToLines = async function (file) {
  const zip = await M._ciZipRead(await file.arrayBuffer());
  const shared = [];
  const ssXml = await zip.read('xl/sharedStrings.xml');
  if (ssXml) {
    const sis = new DOMParser().parseFromString(ssXml, 'application/xml').getElementsByTagNameNS('*', 'si');
    for (let i = 0; i < sis.length; i++) {
      const ts = sis[i].getElementsByTagNameNS('*', 't');
      let s = ''; for (let j = 0; j < ts.length; j++) s += ts[j].textContent;
      shared.push(s);
    }
  }
  const sheetName = zip.names.filter(n => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))
    .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]))[0];
  if (!sheetName) throw new Error('Không tìm thấy worksheet trong file Excel');
  const doc = new DOMParser().parseFromString(await zip.read(sheetName), 'application/xml');
  const rows = doc.getElementsByTagNameNS('*', 'row');
  const lines = [];
  for (let i = 0; i < rows.length; i++) {
    const cells = rows[i].getElementsByTagNameNS('*', 'c');
    const vals = [];
    for (let j = 0; j < cells.length; j++) {
      const c = cells[j];
      const t = c.getAttribute('t') || '';
      let v = '';
      if (t === 'inlineStr') {
        const ts = c.getElementsByTagNameNS('*', 't');
        for (let k = 0; k < ts.length; k++) v += ts[k].textContent;
      } else {
        const vEl = c.getElementsByTagNameNS('*', 'v')[0];
        v = vEl ? vEl.textContent : '';
        if (t === 's') v = shared[Number(v)] != null ? shared[Number(v)] : '';
      }
      // Đặt theo chữ cột (r="B3") để giữ ô trống giữa các cột
      const colLetters = (c.getAttribute('r') || '').replace(/\d+/g, '');
      let col = 0;
      for (let k = 0; k < colLetters.length; k++) col = col * 26 + (colLetters.charCodeAt(k) - 64);
      if (col > 0) vals[col - 1] = v; else vals.push(v);
    }
    const line = Array.from(vals, x => x == null ? '' : x).join('\t').replace(/\t+$/, '').trim();
    if (line) lines.push(line);
  }
  return lines;
};

// Bảng HTML đội lốt .xls (chính dạng U.exportExcel xuất + nhiều phần mềm VN) -> dòng TSV
M._ciHtmlTableToLines = function (text) {
  const doc = new DOMParser().parseFromString(text, 'text/html');
  const lines = [];
  doc.querySelectorAll('tr').forEach(tr => {
    const cells = Array.prototype.map.call(tr.querySelectorAll('th,td'), td => td.textContent.trim());
    const line = cells.join('\t').trim();
    if (line) lines.push(line);
  });
  if (!lines.length) throw new Error('Không tìm thấy bảng dữ liệu trong file');
  return lines;
};

// Mọi loại file văn bản/bảng -> mảng dòng (tự nhận dạng theo nội dung)
M._ciFileToLines = async function (file) {
  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  // ZIP "PK.." -> .xlsx
  if (head[0] === 0x50 && head[1] === 0x4b) return M._ciXlsxToLines(file);
  // OLE ".xls đời cũ" (D0 CF 11 E0) -> không đọc được thuần JS
  if (head[0] === 0xd0 && head[1] === 0xcf) {
    throw new Error('File .xls đời cũ — mở bằng Excel rồi Lưu thành .xlsx, hoặc copy-paste dữ liệu vào ô dán');
  }
  const text = await file.text();
  if (/<table/i.test(text)) return M._ciHtmlTableToLines(text);   // .xls dạng HTML
  return text.split(/\r?\n/).filter(l => l.trim());
};

/* ---------- Nhận diện thông tin chứng từ từ văn bản dán vào ----------
   Tự tìm: nhà sách (tên KH xuất hiện trong văn bản), ngày, kênh bán, % thuế. */
M._ciDetectMeta = function (text) {
  const normed = M._ciNorm(text);
  const out = {};
  // Ngày: yyyy-mm-dd | dd/mm/yyyy | dd-mm-yyyy | "ngày 5 tháng 6 năm 2026"
  let m = text.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (m) out.date = m[1] + '-' + String(m[2]).padStart(2, '0') + '-' + String(m[3]).padStart(2, '0');
  if (!out.date) {
    m = text.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})\b/);
    if (m) out.date = m[3] + '-' + String(m[2]).padStart(2, '0') + '-' + String(m[1]).padStart(2, '0');
  }
  if (!out.date) {
    m = normed.match(/ngay\s+(\d{1,2})\s+thang\s+(\d{1,2})\s+nam\s+(\d{4})/);
    if (m) out.date = m[3] + '-' + String(m[2]).padStart(2, '0') + '-' + String(m[1]).padStart(2, '0');
  }
  if (out.date) {
    const y = +out.date.slice(0, 4), mo = +out.date.slice(5, 7), d = +out.date.slice(8, 10);
    if (y < 2020 || y > 2035 || mo < 1 || mo > 12 || d < 1 || d > 31) delete out.date;
  }
  // Nhà sách / khách hàng: tên KH (đã chuẩn hóa) xuất hiện trong văn bản — lấy tên dài nhất khớp
  let bestC = null;
  PW.data.customers.forEach(c => {
    const n = M._ciNorm(c.name);
    if (n.length >= 4 && normed.indexOf(n) >= 0 && (!bestC || n.length > bestC.n.length)) bestC = { id: c.id, n: n, name: c.name };
  });
  if (bestC) { out.customerId = bestC.id; out.customerName = bestC.name; }
  // Kênh bán: tên kênh xuất hiện trong văn bản
  let bestCh = null;
  (PW.data.channels || []).forEach(ch => {
    const n = M._ciNorm(ch.name);
    if (n.length >= 3 && normed.indexOf(n) >= 0 && (!bestCh || n.length > bestCh.n.length)) bestCh = { id: ch.id, n: n, name: ch.name };
  });
  if (bestCh) { out.channelId = bestCh.id; out.channelName = bestCh.name; }
  // % thuế: "VAT 8%", "thuế 8%", "GTGT 8%", "8% VAT" — dò trên văn bản gốc (norm đã xóa dấu %)
  const lower = text.toLowerCase();
  m = lower.match(/(?:vat|thuế|thue|gtgt)\s*[:=]?\s*(\d{1,2})\s*%/) || lower.match(/(\d{1,2})\s*%\s*(?:vat|thuế|thue|gtgt)/);
  if (m && [0, 5, 8, 10].indexOf(+m[1]) >= 0) out.vatRate = +m[1];
  return out;
};

/* ---------- Chỉ mục sản phẩm & khớp ---------- */

M._ciProductIndex = function () {
  const idx = { full: {}, code: {}, all: [] };
  PW.data.products.forEach(p => {
    const source = M._ciNorm((p.code || '') + ' ' + (p.name || ''));
    const size = M._ciSize(source);
    const code = M._ciCode(size ? source.replace(size.token, ' ') : source);
    const ent = { p: p, codeKey: code ? code.key : '', sizeKey: size ? size.key : '',
                  tokens: source.split(' ').filter(t => t.length > 1) };
    idx.all.push(ent);
    if (ent.codeKey) {
      const fk = ent.codeKey + '|' + ent.sizeKey;
      (idx.full[fk] = idx.full[fk] || []).push(ent);
      (idx.code[ent.codeKey] = idx.code[ent.codeKey] || []).push(ent);
    }
  });
  return idx;
};

// Khớp 1 dòng đã tách -> { productId, status: 'alias'|'code'|'fuzzy'|'none' }
M._ciMatch = function (parsed, idx, customerId) {
  const aliasKey = parsed.aliasKey || M._ciNorm(parsed.name);
  // 1) Bí danh đã học (ưu tiên đúng nhà sách, rồi chung)
  const aliases = PW.data.productAliases || [];
  let al = aliases.find(a => a.customerId === customerId && a.alias === aliasKey) ||
           aliases.find(a => a.alias === aliasKey);
  if (al && PW.data.products.some(p => p.id === al.productId)) {
    return { productId: al.productId, status: 'alias' };
  }
  // 2) Mã + kích thước
  if (parsed.codeKey) {
    const hit = idx.full[parsed.codeKey + '|' + parsed.sizeKey];
    if (hit && hit.length) return { productId: hit[0].p.id, status: 'code' };
    // 3) Chỉ mã (duy nhất)
    const byCode = idx.code[parsed.codeKey];
    if (byCode && byCode.length === 1) return { productId: byCode[0].p.id, status: 'code' };
    if (byCode && byCode.length > 1) {
      const bySize = byCode.filter(e => e.sizeKey === parsed.sizeKey);
      if (bySize.length === 1) return { productId: bySize[0].p.id, status: 'code' };
      return { productId: byCode[0].p.id, status: 'fuzzy' };
    }
  }
  // 4) Khớp mờ theo từ + kích thước
  const tokens = aliasKey.split(' ').filter(t => t.length > 1);
  let best = null, bestScore = 0;
  idx.all.forEach(e => {
    if (parsed.sizeKey && e.sizeKey && e.sizeKey !== parsed.sizeKey) return;
    let n = 0;
    tokens.forEach(t => { if (e.tokens.indexOf(t) >= 0) n++; });
    const score = tokens.length ? n / tokens.length : 0;
    if (score > bestScore) { bestScore = score; best = e; }
  });
  if (best && bestScore >= 0.5) return { productId: best.p.id, status: 'fuzzy' };
  return { productId: '', status: 'none' };
};

/* ---------- Màn hình Gom đơn ký gửi ---------- */

M.consignImport = function (root) {
  const state = { rows: [], idx: M._ciProductIndex() };

  /* --- Thẻ 1: nguồn dữ liệu --- */
  const srcCard = U.el('div', { class: 'card' });
  srcCard.appendChild(U.el('div', { class: 'card-title' }, '🧩 Làm việc với AI — dán / tải file / chụp ảnh'));
  srcCard.appendChild(U.el('p', { class: 'section-sub' },
    'Dán danh sách bán từ nhà sách (copy từ Excel/Zalo), tải file Excel (.xlsx) / CSV, hoặc gửi ảnh chụp / PDF bảng kê để AI đọc. ' +
    'Hệ thống tự nhận diện mã hàng (vd K452 20x25), số lượng, đơn giá rồi khớp về danh mục. Bí danh đã xác nhận sẽ được nhớ cho lần sau.'));

  const ta = U.el('textarea', { class: 'inp', rows: 6, style: 'width:100%;font-family:Consolas,monospace',
    placeholder: 'Ví dụ:\nTranh cá chép hoa sen K452 20x25 - SL: 2 - 45.000\nk301 30x40 x3\nTranh tô màu công chúa (k512 20x20) 1 bức' });
  srcCard.appendChild(ta);

  const fileIn = U.el('input', { type: 'file', accept: '.csv,.txt,.tsv,.xlsx,.xls', style: 'display:none' });
  fileIn.addEventListener('change', async () => {
    const f = fileIn.files[0]; if (!f) return;
    fileIn.value = '';
    try {
      const lines = await M._ciFileToLines(f);
      ta.value = (ta.value ? ta.value + '\n' : '') + lines.join('\n');
      doParse();
      U.toast('Đã đọc ' + lines.length + ' dòng từ ' + f.name);
    } catch (e) { U.toast(e.message, 'error'); }
  });

  const photoIn = U.el('input', { type: 'file', accept: 'image/*,.pdf', capture: 'environment', style: 'display:none' });
  photoIn.addEventListener('change', () => {
    const f = photoIn.files[0]; if (!f) return;
    M._ciOcr(f, lines => { ta.value = (ta.value ? ta.value + '\n' : '') + lines.join('\n'); doParse(); });
    photoIn.value = '';
  });

  const parseBtn = C.btn('🧩 Nhận diện & khớp mã', () => doParse(), 'primary');
  const fileBtn = C.btn('⬆ Tải file Excel/CSV', () => fileIn.click());
  const photoBtn = C.btn('📷 Ảnh / PDF — AI đọc', () => {
    if (PW.mode !== 'server') { U.toast('AI đọc ảnh/PDF cần chạy trên máy chủ (ketoan.tranhdali.vn)', 'error'); return; }
    photoIn.click();
  });
  srcCard.appendChild(U.el('div', { class: 'pill-row mt8' }, [parseBtn, fileBtn, photoBtn, fileIn, photoIn]));

  /* --- Thẻ 2: thông tin chứng từ --- */
  const docCard = U.el('div', { class: 'card' });
  docCard.appendChild(U.el('div', { class: 'card-title' }, '🧾 Chứng từ sẽ tạo'));
  const cusSel = C.select(
    [{ value: '', label: '-- Chọn nhà sách / khách hàng --' }]
      .concat(PW.data.customers.map(c => ({ value: c.id, label: c.name }))), '');
  cusSel.style.flex = '1';
  cusSel.addEventListener('change', () => { if (state.rows.length) rematch(); });
  function rebuildCus(selectId) {
    cusSel.innerHTML = '';
    [{ value: '', label: '-- Chọn nhà sách / khách hàng --' }]
      .concat(PW.data.customers.map(c => ({ value: c.id, label: c.name })))
      .forEach(o => {
        const opt = U.el('option', { value: o.value }, o.label);
        if (String(o.value) === String(selectId || '')) opt.selected = true;
        cusSel.appendChild(opt);
      });
  }
  // Nút + : thêm nhanh nhà sách/khách hàng mới ngay tại chỗ (không rời màn hình)
  const addCusBtn = C.btn('+', () => {
    const nameI = C.input({ placeholder: 'Tên nhà sách / khách hàng *', style: 'width:100%' });
    const phoneI = C.input({ placeholder: 'Số điện thoại', style: 'width:100%' });
    const addrI = C.input({ placeholder: 'Địa chỉ', style: 'width:100%' });
    const wrap = U.el('div', { class: 'form-grid' }, [
      U.el('div', { class: 'full' }, nameI), U.el('div', null, phoneI), U.el('div', null, addrI),
    ]);
    C.modal({
      title: 'Thêm nhà sách / khách hàng mới',
      body: wrap,
      footer: [C.btn('Lưu & chọn', () => {
        const nm = nameI.value.trim();
        if (!nm) { U.toast('Nhập tên trước', 'error'); return; }
        const obj = { id: PW.uid(), code: PW.nextCode('KH'), name: nm, type: 'org',
          phone: phoneI.value.trim(), address: addrI.value.trim(), openingDebt: 0 };
        PW.data.customers.push(obj);
        PW.save();
        rebuildCus(obj.id);
        if (state.rows.length) rematch();
        C.closeModal();
        U.toast('Đã thêm "' + nm + '" và chọn làm nhà sách của đơn này');
      }, 'primary')],
    });
    nameI.focus();
  }, 'sm');
  addCusBtn.title = 'Thêm nhà sách / khách hàng mới';
  const cusRow = U.el('div', { style: 'display:flex;gap:6px;align-items:stretch' }, [cusSel, addCusBtn]);
  const typeSel = C.select([
    { value: 'invoice', label: 'Hóa đơn bán (ghi doanh thu + trừ kho)' },
    { value: 'order', label: 'Đơn đặt hàng (chưa ghi sổ)' },
  ], 'invoice');
  const dateI = C.input({ type: 'date', value: U.today() });
  const chSel = C.select(
    [{ value: '', label: '-- Kênh bán --' }]
      .concat((PW.data.channels || []).map(c => ({ value: c.id, label: c.name }))),
    (PW.data.channels.find(c => /ky gui|ki gui|nha sach/.test(M._ciNorm(c.name))) || { id: '' }).id);
  const vatSel = C.select([
    { value: 0, label: '0%' }, { value: 5, label: '5%' }, { value: 8, label: '8%' }, { value: 10, label: '10%' },
  ], 0);
  const detectLine = U.el('div', { class: 'section-sub', style: 'min-height:16px;margin:6px 0 0' });
  const fg = U.el('div', { class: 'form-grid' });
  fg.appendChild(C.field('Nhà sách (khách hàng)', cusRow, { required: true }));
  fg.appendChild(C.field('Loại chứng từ', typeSel));
  fg.appendChild(C.field('Ngày', dateI));
  fg.appendChild(C.field('Kênh bán', chSel));
  fg.appendChild(C.field('Thuế GTGT (%)', vatSel));
  docCard.appendChild(fg);
  docCard.appendChild(detectLine);

  // Áp kết quả nhận diện từ văn bản (chỉ điền, không xóa lựa chọn sẵn có khi không tìm thấy)
  function applyDetect(text) {
    const det = M._ciDetectMeta(text);
    const got = [];
    if (det.customerId) { cusSel.value = det.customerId; got.push('nhà sách: ' + det.customerName); }
    if (det.date) { dateI.value = det.date; got.push('ngày: ' + U.date(det.date)); }
    if (det.channelId) { chSel.value = det.channelId; got.push('kênh: ' + det.channelName); }
    if (det.vatRate != null) { vatSel.value = det.vatRate; got.push('VAT: ' + det.vatRate + '%'); }
    detectLine.innerHTML = got.length
      ? '✨ Tự nhận diện: <b>' + U.esc(got.join(' · ')) + '</b> — sai thì sửa lại ở trên.'
      : '';
    return det;
  }

  /* --- Thẻ 3: bảng duyệt --- */
  const revCard = U.el('div', { class: 'card' });
  revCard.appendChild(U.el('div', { class: 'card-title' }, '📋 Duyệt dòng hàng đã khớp'));
  const sumDiv = U.el('div', { class: 'section-sub' }, 'Chưa có dữ liệu — dán danh sách rồi bấm "Nhận diện & khớp mã".');
  const host = U.el('div');
  revCard.appendChild(sumDiv);
  revCard.appendChild(host);
  const createBtn = C.btn('✅ Tạo chứng từ & học bí danh', () => doCreate(), 'primary');
  revCard.appendChild(U.el('div', { class: 'pill-row mt16' }, [createBtn]));

  const STATUS_TAG = {
    alias: '<span class="tag green">Bí danh ✓</span>',
    code: '<span class="tag green">Mã hàng ✓</span>',
    fuzzy: '<span class="tag orange">Cần xem lại</span>',
    none: '<span class="tag red">Chưa khớp</span>',
  };

  function doParse() {
    applyDetect(ta.value);   // nhận diện nhà sách/ngày/kênh/VAT TRƯỚC (bí danh khớp theo nhà sách)
    const lines = ta.value.split(/\r?\n/);
    state.rows = [];
    lines.forEach(l => {
      const parsed = M._ciParseLine(l);
      if (!parsed) return;
      const m = M._ciMatch(parsed, state.idx, cusSel.value || null);
      const row = Object.assign(parsed, m);
      if (row.productId && !row.price) row.price = M._ciPrice(row.productId, chSel.value); // giá mặc định theo kênh
      state.rows.push(row);
    });
    draw();
  }

  function rematch() {
    state.rows.forEach(r => {
      const m = M._ciMatch(r, state.idx, cusSel.value || null);
      r.productId = m.productId; r.status = m.status;
      if (r.productId && !r.price) r.price = M._ciPrice(r.productId, chSel.value);
    });
    draw();
  }

  function draw() {
    host.innerHTML = '';
    if (!state.rows.length) { sumDiv.textContent = 'Không nhận diện được dòng hàng nào.'; return; }
    const ok = state.rows.filter(r => r.status === 'alias' || r.status === 'code').length;
    const warn = state.rows.filter(r => r.status === 'fuzzy').length;
    const bad = state.rows.filter(r => r.status === 'none').length;
    sumDiv.innerHTML = 'Tổng <b>' + state.rows.length + '</b> dòng — khớp chắc <b class="text-green">' + ok +
      '</b>, cần xem lại <b style="color:#c77f0a">' + warn + '</b>, chưa khớp <b class="text-red">' + bad + '</b>.';
    const prodOpts = [{ value: '', label: '-- Chọn hàng --' }]
      .concat(PW.data.products.map(p => ({ value: p.id, label: (p.code ? p.code + ' - ' : '') + p.name })));
    host.appendChild(C.table(state.rows, [
      { label: '#', width: '36px', render: r => String(state.rows.indexOf(r) + 1) },
      { label: 'Dòng gốc', render: r => U.esc(r.raw) },
      { label: 'Nhận diện', render: r =>
          (r.codeKey ? '<b>' + U.esc(r.codeKey) + '</b>' : '<span class="text-muted">—</span>') +
          (r.sizeKey ? ' · ' + U.esc(r.sizeKey.toLowerCase()) : '') },
      { label: 'Hàng hóa khớp', render: r => {
          const sel = C.select(prodOpts, r.productId);
          sel.addEventListener('change', () => {
            r.productId = sel.value; r.manual = true;
            if (r.productId && !r.priceTouched) { r.price = M._ciPrice(r.productId, chSel.value); }
            draw();
          });
          const wrap = U.el('div');
          wrap.appendChild(sel);
          if (r.productId) {
            wrap.appendChild(U.el('div', { class: 'text-muted', style: 'font-size:11px;margin-top:2px' },
              'Tồn kho: ' + U.num(PW.stockOf(r.productId))));
          }
          return wrap;
        } },
      { label: 'SL', num: true, width: '80px', render: r => {
          const i = C.input({ type: 'number', value: r.qty, min: 1, style: 'width:70px;text-align:right' });
          i.addEventListener('input', () => { r.qty = Number(i.value) || 1; });
          return i;
        } },
      { label: 'Đơn giá', num: true, width: '120px', render: r => {
          const i = C.input({ type: 'number', value: r.price, min: 0, style: 'width:110px;text-align:right' });
          i.addEventListener('input', () => { r.price = Number(i.value) || 0; r.priceTouched = true; });
          return i;
        } },
      { label: 'Trạng thái', center: true, render: r => STATUS_TAG[r.manual ? 'alias' : r.status] || '' },
      { label: '', width: '40px', render: r => C.actions([{ label: '✕', title: 'Bỏ dòng', onClick: () => {
          state.rows.splice(state.rows.indexOf(r), 1); draw();
        } }]) },
    ], { empty: 'Chưa có dòng nào' }));
  }

  function doCreate() {
    if (!cusSel.value) { U.toast('Chọn nhà sách / khách hàng trước', 'error'); return; }
    const valid = state.rows.filter(r => r.productId && r.qty > 0);
    if (!valid.length) { U.toast('Chưa có dòng nào khớp hàng hóa', 'error'); return; }
    const unmatched = state.rows.length - valid.length;
    if (unmatched > 0 && !U.confirm(unmatched + ' dòng chưa khớp sẽ bị bỏ qua. Tiếp tục?')) return;

    // Học bí danh theo nhà sách (dòng nào người dùng đã xác nhận / khớp chắc)
    valid.forEach(r => {
      const aliasKey = r.aliasKey || M._ciNorm(r.name);
      if (!aliasKey || aliasKey.length < 3) return;
      const exists = (PW.data.productAliases || []).find(a => a.customerId === cusSel.value && a.alias === aliasKey);
      if (exists) { exists.productId = r.productId; return; }
      PW.data.productAliases.push({ id: PW.uid(), customerId: cusSel.value, alias: aliasKey, productId: r.productId });
    });

    const items = valid.map(r => ({ productId: r.productId, qty: Number(r.qty), price: Number(r.price) || 0 }));
    let code;
    if (typeSel.value === 'order') {
      code = PW.nextCode('DH');
      PW.data.salesOrders.push({
        id: PW.uid(), code: code, date: dateI.value, customerId: cusSel.value,
        items: items, discount: 0, status: 'open', note: 'Gom đơn ký gửi tự động',
      });
    } else {
      code = PW.nextCode('HD');
      PW.data.salesInvoices.push({
        id: PW.uid(), code: code, date: dateI.value, customerId: cusSel.value,
        channelId: chSel.value || null, vatRate: Number(vatSel.value) || 0, items: items, discount: 0,
        paid: 0, paidAccountId: null, note: 'Gom đơn ký gửi tự động',
      });
    }
    PW.save();
    U.toast('Đã tạo ' + code + ' (' + items.length + ' mặt hàng) + nhớ ' + valid.length + ' bí danh');
    state.rows = [];
    ta.value = '';
    draw();
    sumDiv.innerHTML = 'Đã tạo chứng từ <b>' + U.esc(code) + '</b>. Xem ở mục ' +
      (typeSel.value === 'order' ? 'Đơn đặt hàng' : 'Hóa đơn bán') + '.';
  }

  root.appendChild(srcCard);
  root.appendChild(docCard);
  root.appendChild(revCard);
};

// Giá mặc định theo kênh
M._ciPrice = function (productId, channelId) {
  const p = PW.data.products.find(x => x.id === productId);
  if (!p) return 0;
  if (channelId && PW.channelPrice) return PW.channelPrice(p, channelId);
  return Number(p.price) || 0;
};

/* ---------- AI đọc ảnh / PDF (Claude qua api/ai-ocr.php) ---------- */
M._ciOcrSend = async function (dataUrl, onLines, kind) {
  try {
    const payload = { image: dataUrl };
    if (kind) payload.kind = kind;
    const r = await PW.api('ai-ocr.php', { method: 'POST', body: JSON.stringify(payload) });
    if (r.status === 200 && r.data && r.data.ok) {
      U.toast('AI đã đọc ' + r.data.lines.length + ' dòng');
      onLines(r.data.lines);
    } else {
      U.toast((r.data && r.data.error) || 'AI đọc thất bại (HTTP ' + r.status + ')', 'error');
    }
  } catch (e) {
    U.toast('Không gọi được AI: ' + e.message, 'error');
  }
};

M._ciOcr = function (file, onLines, kind) {
  // Ảnh HEIC/HEIF (iPhone) — trình duyệt lẫn AI đều không đọc được định dạng này
  if (/\.hei[cf]$/i.test(file.name) || /heic|heif/i.test(file.type)) {
    U.toast('Ảnh HEIC của iPhone chưa hỗ trợ — đổi Cài đặt > Camera > Định dạng sang "Tương thích nhất" (JPEG), hoặc gửi PDF', 'error');
    return;
  }
  // PDF: gửi nguyên văn (Claude đọc được cả PDF chữ lẫn PDF scan)
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
    if (file.size > 8 * 1024 * 1024) { U.toast('PDF quá lớn (tối đa 8MB) — tách nhỏ hoặc chụp ảnh từng trang', 'error'); return; }
    U.toast('Đang gửi PDF cho AI đọc...');
    const rd = new FileReader();
    rd.onload = () => M._ciOcrSend(rd.result, onLines, kind);
    rd.onerror = () => U.toast('Không đọc được file PDF', 'error');
    rd.readAsDataURL(file);
    return;
  }
  // Ảnh: thu nhỏ về tối đa 1600px để gửi nhanh, đủ nét để đọc chữ
  U.toast('Đang nén ảnh & gửi AI đọc...');
  const img = new Image();
  const url = URL.createObjectURL(file);
  img.onload = () => {
    URL.revokeObjectURL(url);
    const maxEdge = 1600;
    const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
    const cv = document.createElement('canvas');
    cv.width = Math.round(img.width * scale);
    cv.height = Math.round(img.height * scale);
    cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
    M._ciOcrSend(cv.toDataURL('image/jpeg', 0.85), onLines, kind);
  };
  img.onerror = () => {
    URL.revokeObjectURL(url);
    U.toast('Không đọc được file "' + file.name + '" (' + (file.type || 'không rõ định dạng') + ') — dùng ảnh JPG/PNG hoặc PDF', 'error');
  };
  img.src = url;
};
