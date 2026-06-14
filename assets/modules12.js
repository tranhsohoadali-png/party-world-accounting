/* ============================================================
   modules12.js — Trạm quét đơn (camera điện thoại)  [Nguyên mẫu]
   PWA: quét QR/mã vạch trên phiếu giao → tìm đơn → 2 chế độ:
   • Đóng gói (hàng RA): kiểm tra đủ hàng rồi xác nhận xuất kho.
   • Nhận trả (hàng VÀO): nhập lại kho, hoặc ghi thất lạc/sai hàng.
   Cắm thẳng vào engine vòng đời đơn (orderStatus + salesReturns).
   Quét tự động dùng BarcodeDetector (Android/Chrome); thiết bị
   không hỗ trợ → nhập mã tay (vẫn đủ chức năng).
   Khớp mã theo: si.code | si.trackingCode | si.shopeeSN.
   ============================================================ */

M.scanStation = function (root) {
  let mode = App._scanMode || 'pack';                 // 'pack' | 'return'
  const hasBD = ('BarcodeDetector' in window);
  let detector = null, stream = null, scanning = false, lastCode = '', lastTime = 0;

  const wrap = U.el('div', { class: 'card', style: 'max-width:560px;margin:0 auto' });
  root.appendChild(wrap);

  // ----- Chuyển chế độ -----
  const packBtn = C.btn('📦 Đóng gói (hàng RA)', () => setMode('pack'));
  const retBtn = C.btn('↩️ Nhận trả (hàng VÀO)', () => setMode('return'));
  wrap.appendChild(U.el('div', { class: 'toolbar', style: 'gap:8px' }, [packBtn, retBtn]));
  const hint = U.el('div', { class: 'section-sub' });
  wrap.appendChild(hint);

  // ----- Camera -----
  const video = U.el('video', { style: 'width:100%;max-height:300px;background:#000;border-radius:10px;object-fit:cover' });
  video.setAttribute('playsinline', ''); video.muted = true;
  wrap.appendChild(U.el('div', { style: 'margin:10px 0' }, video));
  const camBtn = C.btn('📷 Bật camera quét', toggleCam, 'primary');
  const camNote = U.el('div', { class: 'section-sub' });
  wrap.appendChild(U.el('div', { class: 'toolbar', style: 'gap:8px;align-items:center' }, [camBtn, camNote]));

  // ----- Nhập mã tay (fallback / test) -----
  const manualI = U.el('input', { placeholder: 'Hoặc nhập / dán mã đơn (vd HD00003)', style: 'flex:1' });
  manualI.addEventListener('keydown', e => { if (e.key === 'Enter') { onScan(manualI.value); manualI.value = ''; } });
  wrap.appendChild(U.el('div', { class: 'toolbar', style: 'margin-top:8px;gap:8px' },
    [manualI, C.btn('Tìm', () => { onScan(manualI.value); manualI.value = ''; }, 'sm')]));

  const resultBox = U.el('div', { style: 'margin-top:12px' });
  wrap.appendChild(resultBox);
  const logBox = U.el('div', { style: 'margin-top:14px' });
  wrap.appendChild(logBox);

  // ====== Logic ======
  function setMode(m) { mode = App._scanMode = m; lastCode = ''; renderHeader(); renderResult(null); }

  function renderHeader() {
    packBtn.className = 'btn' + (mode === 'pack' ? ' primary' : '');
    retBtn.className = 'btn' + (mode === 'return' ? ' primary' : '');
    const plat = PW.data.salesInvoices.filter(si => { const c = PW.channel(si.channelId); return c && (Number(c.feePercent) > 0 || c.isPlatform); });
    if (mode === 'pack') {
      const unpacked = plat.filter(si => !si.packed && (si.orderStatus || 'delivered') === 'delivered').length;
      hint.textContent = 'Chế độ ĐÓNG GÓI: quét phiếu giao → kiểm tra đủ hàng → xác nhận xuất kho. Còn ' + unpacked + ' đơn sàn chưa đóng gói.';
    } else {
      hint.textContent = 'Chế độ NHẬN TRẢ: quét kiện hoàn về → nhập lại kho, hoặc ghi thất lạc/sai hàng.';
    }
    camNote.textContent = hasBD ? '' : '⚠ Thiết bị/trình duyệt này không quét tự động được — hãy nhập mã tay.';
    camNote.className = 'section-sub' + (hasBD ? '' : ' text-red');
  }

  function findOrder(raw) {
    const code = String(raw || '').trim().toLowerCase();
    if (!code) return null;
    return PW.data.salesInvoices.find(si =>
      [si.code, si.trackingCode, si.shopeeSN].filter(Boolean).some(v => String(v).toLowerCase() === code));
  }

  function beep() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext; if (Ctx) {
        const ac = new Ctx(), o = ac.createOscillator(), g = ac.createGain();
        o.frequency.value = 880; o.connect(g); g.connect(ac.destination); g.gain.value = 0.07;
        o.start(); setTimeout(() => { try { o.stop(); ac.close(); } catch (_) {} }, 120);
      }
    } catch (_) {}
    if (navigator.vibrate) { try { navigator.vibrate(80); } catch (_) {} }
  }

  function addLog(msg, cls) {
    const t = new Date(), p = x => String(x).padStart(2, '0');
    App._scanLog = App._scanLog || [];
    App._scanLog.unshift({ time: p(t.getHours()) + ':' + p(t.getMinutes()) + ':' + p(t.getSeconds()), msg, cls });
    App._scanLog = App._scanLog.slice(0, 10);
    renderLog();
  }
  function renderLog() {
    const items = App._scanLog || [];
    logBox.innerHTML = '';
    logBox.appendChild(U.el('div', { class: 'section-sub', style: 'font-weight:600' }, 'Nhật ký quét gần đây'));
    if (!items.length) { logBox.appendChild(U.el('div', { class: 'empty' }, 'Chưa có lượt quét nào.')); return; }
    items.forEach(it => logBox.appendChild(U.el('div', { style: 'padding:4px 0;border-bottom:1px solid #eee;font-size:13px' },
      [U.el('span', { class: 'text-muted' }, it.time + '  '), U.el('span', { class: it.cls || '' }, it.msg)])));
  }

  function onScan(raw) {
    const val = String(raw || '').trim(); if (!val) return;
    const now = Date.now();
    if (val === lastCode && now - lastTime < 2500) return;   // chống quét trùng liên tục
    lastCode = val; lastTime = now;
    beep();
    const si = findOrder(val);
    if (!si) { addLog('❓ Không tìm thấy đơn cho mã "' + val + '"', 'text-red'); renderResult(null, val); return; }
    renderResult(si);
  }

  function createReturn(si, noRestock) {
    const obj = {
      id: PW.uid(), code: PW.nextCode('TL'), date: U.today(), customerId: si.customerId,
      items: (si.items || []).map(it => ({ productId: it.productId, qty: Number(it.qty), price: Number(it.price) })),
      note: (noRestock ? 'Hàng hoàn THẤT LẠC/SAI (không về kho) — quét đơn ' : 'Nhập lại kho (quét nhận trả) — đơn ') + si.code,
      invoiceId: si.id,
    };
    if (noRestock) obj.noRestock = true;
    PW.data.salesReturns.push(obj); PW.save();
  }

  function renderResult(si, rawNotFound) {
    resultBox.innerHTML = '';
    if (!si) {
      if (rawNotFound) resultBox.appendChild(U.el('div', { class: 'card', style: 'border:1px solid var(--red)' },
        U.el('div', { class: 'text-red' }, 'Không có đơn nào khớp mã: ' + U.esc(rawNotFound) + '. (Mã đơn = si.code, hoặc mã vận đơn nếu đã đồng bộ từ sàn.)')));
      return;
    }
    const cust = PW.customer(si.customerId), ch = PW.channel(si.channelId);
    const st = (M.SHOPEE_STATUS && M.SHOPEE_STATUS[si.orderStatus || 'delivered']) || { label: si.orderStatus || 'Đã giao' };
    const box = U.el('div', { class: 'card', style: 'border:2px solid var(--teal)' });
    box.appendChild(U.el('div', { class: 'card-title', style: 'margin:0 0 6px' }, '📋 ' + U.esc(si.code) + (ch ? ' · ' + U.esc(ch.name) : '')));
    box.appendChild(U.el('div', { class: 'section-sub' }, 'Khách: ' + U.esc(cust ? cust.name : '—') + ' · ' + U.date(si.date) + ' · Trạng thái: ' + st.label));

    const tbl = U.el('table', { class: 'tbl tbl-cards', style: 'margin-top:8px' });
    tbl.appendChild(U.el('thead', null, U.el('tr', null, ['Hàng hóa', 'SL', 'Tồn'].map((h, i) => U.el('th', { class: i ? 'num' : '' }, h)))));
    const tb = U.el('tbody');
    (si.items || []).forEach(it => {
      const p = PW.product(it.productId);
      tb.appendChild(U.el('tr', null, [
        U.el('td', { 'data-label': 'Hàng hóa' }, p ? U.esc(p.code + ' - ' + p.name) : U.esc(it.productId)),
        U.el('td', { class: 'num', 'data-label': 'SL' }, U.num(it.qty)),
        U.el('td', { class: 'num', 'data-label': 'Tồn' }, p ? U.num(PW.stockOf(p.id)) : '—'),
      ]));
    });
    tbl.appendChild(tb); box.appendChild(U.el('div', { class: 'table-wrap' }, tbl));

    const actions = U.el('div', { class: 'toolbar', style: 'margin-top:10px;gap:8px' });
    if (mode === 'pack') {
      if (si.packed) actions.appendChild(U.el('span', { class: 'tag green' }, 'Đã đóng gói ' + (si.packedAt ? U.date(si.packedAt) : '')));
      actions.appendChild(C.btn('✅ Xác nhận đóng gói & xuất kho', () => {
        si.packed = true; si.packedAt = U.today(); si.orderStatus = 'delivered'; PW.save();
        addLog('✅ Đóng gói xong ' + si.code, 'text-green'); renderHeader(); renderResult(null);
      }, 'primary'));
    } else {
      actions.appendChild(C.btn('📥 Nhập lại kho (hàng về)', () => {
        si.orderStatus = 'returned'; createReturn(si, false);
        addLog('📥 Nhập lại kho ' + si.code, 'text-green'); renderHeader(); renderResult(null);
      }, 'primary'));
      actions.appendChild(C.btn('❌ Thất lạc / sai hàng', () => {
        if (!U.confirm('Ghi nhận đơn ' + si.code + ' THẤT LẠC / SAI HÀNG (không về kho)?')) return;
        si.orderStatus = 'lost'; createReturn(si, true);
        addLog('❌ Thất lạc/sai hàng ' + si.code, 'text-red'); renderHeader(); renderResult(null);
      }, 'danger'));
    }
    box.appendChild(actions);
    resultBox.appendChild(box);
  }

  // ----- Điều khiển camera -----
  async function startCam() {
    if (!hasBD) { U.toast('Trình duyệt không hỗ trợ quét tự động. Hãy nhập mã tay.', 'error'); return; }
    try {
      detector = detector || new window.BarcodeDetector();
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } });
      video.srcObject = stream; await video.play();
      scanning = true; camBtn.textContent = '⏹ Tắt camera'; tick();
    } catch (e) { U.toast('Không mở được camera: ' + ((e && e.message) || e), 'error'); scanning = false; }
  }
  async function tick() {
    if (!scanning) return;
    try { const codes = await detector.detect(video); if (codes && codes.length) onScan(codes[0].rawValue); } catch (_) {}
    if (scanning) setTimeout(tick, 350);
  }
  function stopCam() {
    scanning = false;
    if (stream) { try { stream.getTracks().forEach(t => t.stop()); } catch (_) {} stream = null; }
    try { video.srcObject = null; } catch (_) {}
    camBtn.textContent = '📷 Bật camera quét';
  }
  function toggleCam() { if (scanning) stopCam(); else startCam(); }
  M._scanStop = stopCam;     // App.refresh sẽ gọi để tắt camera khi rời trang

  renderHeader(); renderLog();
};
