/* ============================================================
   modules15.js — Đồng bộ hóa đơn từ Cổng hóa đơn điện tử (TCT)
   hoadondientu.gdt.gov.vn — bán tự động: nhập captcha 1 lần/phiên,
   sau đó kéo hóa đơn mua vào / bán ra theo khoảng ngày về sổ thuế.
   Hóa đơn lưu vào PW.data.taxInvoices (KHÔNG đụng kho) phục vụ kê khai VAT.
   ============================================================ */

M._taxKey = inv => [inv.direction, inv.khmshdon, inv.khhdon, inv.shdon, inv.partnerMst].join('|');

/* ---------- Đọc file hóa đơn điện tử XML/ZIP (định dạng chuẩn TCT) ---------- */
// Lấy text của 1 thẻ con (không đệ quy quá sâu — getElementsByTagName lấy thẻ đầu tiên)
M._xt = function (el, tag) {
  if (!el) return '';
  const n = el.getElementsByTagName(tag)[0];
  return n ? (n.textContent || '').trim() : '';
};
M._xnum = function (el, tag) { return Number((M._xt(el, tag) || '0').replace(/[^\d.\-]/g, '')) || 0; };

// 1 phần tử <HDon> -> object hóa đơn (cùng shape với dữ liệu kéo từ cổng)
M._taxParseHDon = function (hdon, companyMst) {
  const get = t => M._xt(hdon, t);
  const nban = hdon.getElementsByTagName('NBan')[0];
  const nmua = hdon.getElementsByTagName('NMua')[0];
  const ttoan = hdon.getElementsByTagName('TToan')[0] || hdon;
  const base = M._xnum(ttoan, 'TgTCThue');
  const vat = M._xnum(ttoan, 'TgTThue');
  let total = M._xnum(ttoan, 'TgTTTBSo');
  if (!total) total = base + vat;
  const sellMst = M._xt(nban, 'MST');
  const buyMst = M._xt(nmua, 'MST');
  const cm = (companyMst || '').replace(/\s/g, '');
  let dir = 'in';
  if (cm && sellMst.replace(/\s/g, '') === cm) dir = 'out';
  else if (cm && buyMst.replace(/\s/g, '') === cm) dir = 'in';
  return {
    direction: dir,
    khmshdon: get('KHMSHDon'), khhdon: get('KHHDon'), shdon: get('SHDon'),
    date: (get('NLap') || get('TDLap') || '').slice(0, 10),
    partnerMst: dir === 'in' ? sellMst : buyMst,
    partnerName: dir === 'in' ? M._xt(nban, 'Ten') : M._xt(nmua, 'Ten'),
    base: base, vat: vat, total: total,
    vatRate: base > 0 ? Math.round(vat / base * 100) : 0,
    status: '', source: 'xml',
  };
};

M._taxParseXmlText = function (xmlText, companyMst) {
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) return [];
  const hdons = doc.getElementsByTagName('HDon');
  const out = [];
  for (let i = 0; i < hdons.length; i++) {
    const inv = M._taxParseHDon(hdons[i], companyMst);
    if (inv.shdon || inv.khhdon) out.push(inv);
  }
  return out;
};

// File (.xml hoặc .zip nhiều xml) -> mảng hóa đơn
M._taxFileToInvoices = async function (file, companyMst) {
  const head = new Uint8Array(await file.slice(0, 2).arrayBuffer());
  if (head[0] === 0x50 && head[1] === 0x4b && M._ciZipRead) {       // ZIP
    const zip = await M._ciZipRead(await file.arrayBuffer());
    let all = [];
    for (const name of zip.names) {
      if (!/\.xml$/i.test(name)) continue;
      try { all = all.concat(M._taxParseXmlText(await zip.read(name), companyMst)); } catch (e) {}
    }
    return all;
  }
  return M._taxParseXmlText(await file.text(), companyMst);   // XML đơn
};

M.taxSync = function (root) {
  const server = PW.mode === 'server';
  const state = { captchaKey: '', pulled: [] };
  const previewHost = U.el('div');
  const savedCard = U.el('div', { class: 'card' });

  // Biến UI cổng thuế (chỉ dựng ở chế độ máy chủ)
  let statusLine, mstI, passI, capImg, capI, fromI, toI, kindSel, pullBtn, pullResult, conn, pullCard;

  if (server) {
    /* --- Thẻ 1: kết nối cổng thuế --- */
    conn = U.el('div', { class: 'card' });
    conn.appendChild(U.el('div', { class: 'card-title' }, '🔑 Kết nối Cổng hóa đơn điện tử (Tổng cục Thuế)'));
    conn.appendChild(U.el('p', { class: 'section-sub' },
      'Đăng nhập bằng tài khoản cổng thuế của bạn (MST + mật khẩu). Mật khẩu chỉ dùng để đăng nhập, KHÔNG lưu lại. ' +
      'Mỗi phiên nhập mã captcha một lần (yêu cầu bảo mật của cổng thuế), sau đó kéo hóa đơn tự động.'));
    statusLine = U.el('div', { class: 'section-sub' }, 'Đang kiểm tra phiên...');
    conn.appendChild(statusLine);

    mstI = C.input({ placeholder: 'Mã số thuế (đăng nhập)', value: localStorage.getItem('PW_TAX_MST') || '', style: 'min-width:220px' });
    passI = C.input({ type: 'password', placeholder: 'Mật khẩu cổng thuế', style: 'min-width:220px' });
    capImg = U.el('div', { class: 'tax-captcha', title: 'Bấm để lấy mã mới' });
    capImg.addEventListener('click', loadCaptcha);
    capI = C.input({ placeholder: 'Nhập mã trong ảnh', style: 'width:150px' });
    capI.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
    const reCapBtn = C.btn('↻', loadCaptcha); reCapBtn.title = 'Lấy mã captcha khác';
    const loginBtn = C.btn('Đăng nhập cổng thuế', doLogin, 'primary');
    const logoutBtn = C.btn('Đăng xuất', doLogout, 'ghost');

    const loginRow = U.el('div', { class: 'form-grid' });
    loginRow.appendChild(C.field('Mã số thuế', mstI, { required: true }));
    loginRow.appendChild(C.field('Mật khẩu', passI, { required: true }));
    loginRow.appendChild(U.el('div', { class: 'field full' }, [
      U.el('label', null, 'Mã captcha'),
      U.el('div', { style: 'display:flex;gap:10px;align-items:center;flex-wrap:wrap' }, [capImg, reCapBtn, capI]),
    ]));
    conn.appendChild(loginRow);
    conn.appendChild(U.el('div', { class: 'pill-row mt8' }, [loginBtn, logoutBtn]));

    /* --- Thẻ 2: kéo hóa đơn --- */
    pullCard = U.el('div', { class: 'card' });
    pullCard.appendChild(U.el('div', { class: 'card-title' }, '⬇ Kéo hóa đơn theo khoảng ngày'));
    const period = U.period('month');
    fromI = C.input({ type: 'date', value: period.from });
    toI = C.input({ type: 'date', value: U.today() });
    kindSel = C.select([
      { value: 'both', label: 'Cả mua vào & bán ra' },
      { value: 'purchase', label: 'Hóa đơn mua vào (đầu vào)' },
      { value: 'sold', label: 'Hóa đơn bán ra (đầu ra)' },
    ], 'both');
    pullBtn = C.btn('⬇ Kéo hóa đơn về', doPull, 'primary');
    const pg = U.el('div', { class: 'form-grid' });
    pg.appendChild(C.field('Từ ngày', fromI));
    pg.appendChild(C.field('Đến ngày', toI));
    pg.appendChild(C.field('Loại hóa đơn', kindSel));
    pg.appendChild(C.field(' ', pullBtn));
    pullCard.appendChild(pg);
    pullResult = U.el('div', { class: 'section-sub', style: 'min-height:18px' });
    pullCard.appendChild(pullResult);
  }

  /* --- Thẻ: nhập file XML/ZIP (chạy cả offline) --- */
  const xmlCard = U.el('div', { class: 'card' });
  xmlCard.appendChild(U.el('div', { class: 'card-title' }, '📄 Nhập file hóa đơn điện tử (XML / ZIP)'));
  xmlCard.appendChild(U.el('p', { class: 'section-sub' },
    'Tải file XML hóa đơn (tải từ cổng thuế bằng trình duyệt, hoặc nhà cung cấp gửi) — cả file .zip nhiều hóa đơn. ' +
    'Hệ thống tự đọc số HĐ, ngày, đối tác, tiền hàng, thuế. Dùng được kể cả khi chưa kết nối cổng.'));
  const coMstI = C.input({ placeholder: 'MST công ty mình', value: localStorage.getItem('PW_TAX_MST') || '', style: 'min-width:200px' });
  const xmlIn = U.el('input', { type: 'file', accept: '.xml,.zip', multiple: true, style: 'display:none' });
  const xmlResult = U.el('div', { class: 'section-sub', style: 'min-height:18px' });
  xmlIn.addEventListener('change', async () => {
    const files = Array.prototype.slice.call(xmlIn.files); xmlIn.value = '';
    if (!files.length) return;
    localStorage.setItem('PW_TAX_MST', coMstI.value.trim());
    xmlResult.textContent = 'Đang đọc ' + files.length + ' file...';
    let all = [];
    for (const f of files) {
      try { all = all.concat(await M._taxFileToInvoices(f, coMstI.value.trim())); }
      catch (e) { /* bỏ file lỗi */ }
    }
    if (!all.length) { xmlResult.innerHTML = '<b class="text-red">Không đọc được hóa đơn nào</b> — kiểm tra đúng file XML hóa đơn điện tử (.xml/.zip).'; return; }
    state.pulled = all;
    xmlResult.innerHTML = 'Đọc được <b>' + all.length + '</b> hóa đơn từ file.';
    drawPreview();
  });
  const fg2 = U.el('div', { class: 'form-grid' });
  fg2.appendChild(C.field('MST công ty (xác định mua vào/bán ra)', coMstI));
  fg2.appendChild(C.field(' ', C.btn('📄 Chọn file XML / ZIP', () => xmlIn.click(), 'primary')));
  xmlCard.appendChild(fg2);
  xmlCard.appendChild(xmlIn);
  xmlCard.appendChild(xmlResult);

  /* --- Thẻ xem trước (dùng chung cho cả kéo cổng & nhập XML) --- */
  const prevCard = U.el('div', { class: 'card' });
  prevCard.appendChild(U.el('div', { class: 'card-title' }, '📋 Xem trước & lưu vào sổ thuế'));
  prevCard.appendChild(previewHost);
  previewHost.appendChild(U.el('p', { class: 'section-sub' }, 'Chưa có hóa đơn — kéo từ cổng hoặc nhập file XML ở trên.'));

  /* --- Lắp ráp --- */
  if (server) { root.appendChild(conn); root.appendChild(pullCard); }
  root.appendChild(xmlCard);
  root.appendChild(prevCard);
  root.appendChild(savedCard);
  M._taxSavedList(savedCard, true);
  if (server) checkSession();

  /* ---------- Hành vi ---------- */
  function setConnected(connected, mst) {
    if (!server) return;
    if (connected) {
      statusLine.innerHTML = 'Trạng thái: <b class="text-green">Đã kết nối</b> — MST ' + U.esc(mst || mstI.value);
      pullCard.style.opacity = '1'; pullCard.style.pointerEvents = 'auto';
    } else {
      statusLine.innerHTML = 'Trạng thái: <b class="text-red">Chưa kết nối</b> — đăng nhập để kéo hóa đơn.';
      pullCard.style.opacity = '.55'; pullCard.style.pointerEvents = 'none';
    }
  }

  async function checkSession() {
    const r = await PW.api('tax-portal.php?action=session');
    if (r.status === 200 && r.data) setConnected(r.data.connected, r.data.mst);
    else setConnected(false);
    if (!(r.data && r.data.connected)) loadCaptcha();
  }

  async function loadCaptcha() {
    capImg.innerHTML = '<span class="text-muted" style="font-size:12px">Đang tải mã...</span>';
    const r = await PW.api('tax-portal.php?action=captcha');
    if (r.status === 200 && r.data && r.data.ok) {
      state.captchaKey = r.data.key;
      capImg.innerHTML = r.data.svg;   // SVG inline từ cổng thuế
    } else {
      capImg.innerHTML = '<span class="text-red" style="font-size:12px">' + U.esc((r.data && r.data.error) || 'Lỗi tải captcha') + '</span>';
    }
  }

  async function doLogin() {
    if (!mstI.value.trim() || !passI.value || !capI.value.trim()) { U.toast('Nhập đủ MST, mật khẩu, captcha', 'error'); return; }
    loginBtn.disabled = true;
    const r = await PW.api('tax-portal.php?action=login', { method: 'POST', body: JSON.stringify({
      username: mstI.value.trim(), password: passI.value, ckey: state.captchaKey, cvalue: capI.value.trim(),
    }) });
    loginBtn.disabled = false;
    if (r.status === 200 && r.data && r.data.ok) {
      localStorage.setItem('PW_TAX_MST', mstI.value.trim());
      passI.value = ''; capI.value = '';
      U.toast('Đã kết nối cổng thuế');
      setConnected(true, r.data.mst);
    } else {
      U.toast((r.data && r.data.error) || 'Đăng nhập thất bại', 'error');
      loadCaptcha();   // captcha dùng 1 lần -> lấy mã mới
      capI.value = '';
    }
  }

  async function doLogout() {
    await PW.api('tax-portal.php?action=logout');
    setConnected(false); loadCaptcha();
  }

  async function doPull() {
    pullBtn.disabled = true;
    pullResult.textContent = 'Đang kéo hóa đơn từ cổng thuế...';
    previewHost.innerHTML = '';
    const r = await PW.api('tax-portal.php?action=pull', { method: 'POST', body: JSON.stringify({
      kind: kindSel.value, from: fromI.value, to: toI.value,
    }) });
    pullBtn.disabled = false;
    if (r.status === 401 && r.data && r.data.need_login) {
      pullResult.innerHTML = '<b class="text-red">Phiên hết hạn</b> — đăng nhập lại ở trên.';
      setConnected(false); loadCaptcha(); return;
    }
    if (!(r.status === 200 && r.data && r.data.ok)) {
      pullResult.innerHTML = '<b class="text-red">Lỗi:</b> ' + U.esc((r.data && r.data.error) || ('HTTP ' + r.status));
      return;
    }
    state.pulled = r.data.invoices || [];
    const dbg = (r.data.debug && r.data.debug.length) ? ' · chẩn đoán: ' + U.esc(r.data.debug.join(' | ')) : '';
    pullResult.innerHTML = 'Cổng trả về <b>' + state.pulled.length + '</b> hóa đơn.' + dbg;
    drawPreview();
  }

  function drawPreview() {
    previewHost.innerHTML = '';
    if (!state.pulled.length) return;
    const saved = new Set((PW.data.taxInvoices || []).map(M._taxKey));
    state.pulled.forEach(inv => { inv._dup = saved.has(M._taxKey(inv)); inv._pick = !inv._dup; });
    const head = U.el('div', { class: 'toolbar mt8' }, [
      U.el('b', null, 'Xem trước & chọn hóa đơn để lưu'),
      U.el('span', { class: 'spacer' }),
      C.btn('✅ Lưu hóa đơn đã chọn vào sổ thuế', saveSelected, 'primary'),
    ]);
    previewHost.appendChild(head);
    previewHost.appendChild(C.table(state.pulled, [
      { label: '', center: true, width: '34px', render: inv => {
          const cb = U.el('input', { type: 'checkbox' }); cb.checked = inv._pick;
          cb.addEventListener('change', () => { inv._pick = cb.checked; });
          return cb;
        } },
      { label: 'Chiều', center: true, render: inv => inv.direction === 'in'
          ? '<span class="tag orange">Mua vào</span>' : '<span class="tag green">Bán ra</span>' },
      { label: 'Ký hiệu', render: inv => U.esc(inv.khhdon) },
      { label: 'Số HĐ', render: inv => U.esc(inv.shdon) },
      { label: 'Ngày', render: inv => U.date(inv.date) },
      { label: 'Đối tác (MST)', render: inv => U.esc(inv.partnerName) + '<div class="text-muted" style="font-size:11px">' + U.esc(inv.partnerMst) + '</div>' },
      { label: 'Tiền hàng', num: true, render: inv => U.money(inv.base) },
      { label: 'VAT', center: true, render: inv => inv.vatRate + '%' },
      { label: 'Tiền thuế', num: true, render: inv => U.money(inv.vat) },
      { label: 'Tổng', num: true, render: inv => `<b>${U.money(inv.total)}</b>` },
      { label: '', center: true, render: inv => inv._dup ? '<span class="tag gray">Đã có</span>' : '' },
    ], { empty: 'Không có hóa đơn' }));
  }

  function saveSelected() {
    const pick = state.pulled.filter(inv => inv._pick && !inv._dup);
    if (!pick.length) { U.toast('Không có hóa đơn mới nào được chọn', 'error'); return; }
    pick.forEach(inv => {
      PW.data.taxInvoices.push({
        id: PW.uid(), source: 'gdt',
        direction: inv.direction, khmshdon: inv.khmshdon, khhdon: inv.khhdon, shdon: inv.shdon,
        date: inv.date, partnerMst: inv.partnerMst, partnerName: inv.partnerName,
        base: inv.base, vat: inv.vat, total: inv.total, vatRate: inv.vatRate, status: inv.status,
      });
    });
    PW.save();
    U.toast('Đã lưu ' + pick.length + ' hóa đơn vào sổ thuế');
    drawPreview();
    M._taxSavedList(savedCard, true);
  }
};

/* ---------- Sổ hóa đơn thuế đã lưu + tổng hợp VAT ---------- */
M._taxSavedList = function (host, isCard) {
  if (!isCard) { const c = U.el('div', { class: 'card' }); host.appendChild(c); host = c; }
  else host.innerHTML = '';
  host.appendChild(U.el('div', { class: 'card-title' }, '📚 Sổ hóa đơn thuế đã lưu'));

  const all = (PW.data.taxInvoices || []).slice().sort((a, b) => a.date < b.date ? 1 : -1);
  if (!all.length) {
    host.appendChild(U.el('p', { class: 'section-sub' }, 'Chưa có hóa đơn nào. Kéo từ cổng thuế ở trên để lưu vào đây.'));
    return;
  }
  const out = all.filter(i => i.direction === 'out'), inn = all.filter(i => i.direction === 'in');
  const sum = arr => arr.reduce((s, i) => s + Number(i.vat || 0), 0);
  const vatOut = sum(out), vatIn = sum(inn), pay = vatOut - vatIn;
  // Tổng hợp VAT
  const sm = U.el('div', { class: 'grid c3 mt8' });
  [['Thuế đầu ra (bán ra)', vatOut, 'text-green', out.length + ' HĐ'],
   ['Thuế đầu vào (mua vào)', vatIn, 'text-red', inn.length + ' HĐ'],
   [pay >= 0 ? 'Phải nộp' : 'Được khấu trừ', Math.abs(pay), pay >= 0 ? 'text-red' : 'text-green', '']]
    .forEach(k => {
      const c = U.el('div', { class: 'kpi' });
      c.appendChild(U.el('div', { class: 'label' }, k[0]));
      c.appendChild(U.el('div', { class: 'value ' + k[2] }, U.money(k[1])));
      if (k[3]) c.appendChild(U.el('div', { class: 'sub' }, k[3]));
      sm.appendChild(c);
    });
  host.appendChild(sm);

  host.appendChild(U.el('div', { class: 'toolbar mt16' }, [
    U.el('b', null, 'Chi tiết ' + all.length + ' hóa đơn'),
    U.el('span', { class: 'spacer' }),
    C.btn('📊 Xuất Excel', () => {
      U.exportExcel('SoHoaDonThue', ['Chiều', 'Ký hiệu', 'Số HĐ', 'Ngày', 'Đối tác', 'MST', 'Tiền hàng', 'VAT(%)', 'Tiền thuế', 'Tổng'],
        all.map(i => [i.direction === 'in' ? 'Mua vào' : 'Bán ra', i.khhdon, i.shdon, U.date(i.date), i.partnerName, i.partnerMst, i.base, i.vatRate, i.vat, i.total]),
        'Sổ hóa đơn thuế (từ cổng TCT)');
    }),
  ]));
  host.appendChild(C.table(all, [
    { label: 'Chiều', center: true, render: i => i.direction === 'in' ? '<span class="tag orange">Mua</span>' : '<span class="tag green">Bán</span>' },
    { label: 'Ký hiệu', render: i => U.esc(i.khhdon) },
    { label: 'Số HĐ', render: i => U.esc(i.shdon) },
    { label: 'Ngày', render: i => U.date(i.date) },
    { label: 'Đối tác', render: i => U.esc(i.partnerName) + '<div class="text-muted" style="font-size:11px">' + U.esc(i.partnerMst) + '</div>' },
    { label: 'Tiền hàng', num: true, render: i => U.money(i.base) },
    { label: 'VAT', center: true, render: i => i.vatRate + '%' },
    { label: 'Tiền thuế', num: true, render: i => U.money(i.vat) },
    { label: 'Tổng', num: true, render: i => U.money(i.total) },
    { label: '', center: true, render: i => C.actions([{ label: '✕', title: 'Xóa khỏi sổ', onClick: () => {
        if (!U.confirm('Xóa hóa đơn ' + i.khhdon + ' số ' + i.shdon + ' khỏi sổ thuế?')) return;
        PW.data.taxInvoices = PW.data.taxInvoices.filter(x => x.id !== i.id);
        PW.save(); M._taxSavedList(host, true);
      } }]) },
  ]));
};
