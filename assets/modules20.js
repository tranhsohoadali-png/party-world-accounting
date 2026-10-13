/* ============================================================
   modules20.js — THÔNG BÁO (chuông trên thanh tiêu đề)

   Báo hai nhóm việc mà chủ sổ muốn biết ngay:
     • GÓP VỐN  — ai vừa góp thêm, ai rút vốn, lợi nhuận vừa chia,
                   và phần lợi nhuận đã chia mà CHƯA chi trả
     • DOANH THU — hôm nay, 7 ngày, tháng này so tháng trước,
                   và mốc doanh thu lũy kế trong năm

   KHÔNG trùng với "Việc cần làm" (modules16): bên đó lo công nợ đến hạn,
   tồn kho thấp, đơn sàn chưa đối soát, hạn kê khai thuế. Bên này chỉ lo
   những gì VỪA XẢY RA và con số doanh thu.

   Cách biết "mới": mỗi bản ghi có id, lưu lại danh sách id ĐÃ XEM trong
   localStorage của chính tên miền này. Lần chạy đầu tiên đánh dấu tất cả là
   đã xem — không ai muốn mở app lần đầu đã thấy 50 thông báo cũ.

   Thông báo hệ thống (hiện ra ngoài màn hình điện thoại) chỉ bắn cho bản ghi
   THẬT SỰ MỚI, và bản tin doanh thu nhiều nhất một lần mỗi ngày. Bắn mỗi lần
   mở app là thành rác, người dùng tắt luôn quyền thông báo.
   ============================================================ */

M.TB_MOC = [50e6, 100e6, 200e6, 500e6, 1e9, 2e9, 5e9, 10e9];   // mốc doanh thu năm

M._tbKey = () => 'PW_TB_' + (PW.ws || 1);
M.tbTrangThai = function () {
  try {
    const o = JSON.parse(localStorage.getItem(M._tbKey()) || 'null');
    if (o && typeof o === 'object') return Object.assign({ ids: [], moc: 0, ngayBaoDT: '', batNative: false }, o);
  } catch (e) {}
  return null;
};
M.tbLuu = function (st) { try { localStorage.setItem(M._tbKey(), JSON.stringify(st)); } catch (e) {} };

// Mọi bản ghi "có thể thông báo", kèm id ổn định
M._tbNguon = function () {
  const ds = [];
  const coVon = !!(PW.data.meta && PW.data.meta.features && PW.data.meta.features.capital);
  if (coVon) {
    (PW.data.capitalContributions || []).forEach(c => ds.push({
      id: 'gv:' + c.id, nhom: 'von', ngay: c.date, route: 'capital',
      tieuDe: 'Khoản góp vốn mới',
      noiDung: M._capName(c.memberId) + ' góp ' + U.money(c.amount) + ' đ — ' + M.capitalKind(c.kind).t,
    }));
    (PW.data.capitalWithdrawals || []).forEach(w => ds.push({
      id: 'rv:' + w.id, nhom: 'von', ngay: w.date, route: 'capital',
      tieuDe: 'Có người rút vốn',
      noiDung: M._capName(w.memberId) + ' rút ' + U.money(w.amount) + ' đ — ' + (w.reason || 'rút vốn góp'),
    }));
    (PW.data.profitShares || []).forEach(ps => ds.push({
      id: 'pl:' + ps.id, nhom: 'von', ngay: ps.date, route: 'capital',
      tieuDe: 'Đã chia lợi nhuận',
      noiDung: (ps.label ? ps.label + ': ' : '') + U.money(ps.profit) + ' đ chia cho ' + (ps.lines || []).length + ' thành viên',
    }));
  }
  return ds.sort((a, b) => (b.ngay || '').localeCompare(a.ngay || ''));
};

/* ---------- Sinh danh sách thông báo ---------- */
M.tbSinh = function () {
  const st = M.tbTrangThai() || { ids: [], moc: 0, ngayBaoDT: '', batNative: false };
  const daXem = new Set(st.ids || []);
  const tb = [];

  // 1) Bản ghi mới kể từ lần xem trước
  M._tbNguon().forEach(x => {
    if (daXem.has(x.id)) return;
    tb.push(Object.assign({ moi: true, muc: 'tin', ic: '🤝' }, x));
  });

  const coVon = !!(PW.data.meta && PW.data.meta.features && PW.data.meta.features.capital);

  // 2) Lợi nhuận đã chia nhưng chưa chi trả — nhắc đều, không cần "mới"
  if (coVon) {
    let conNo = 0, ai = [];
    (PW.data.profitShares || []).forEach(ps => (ps.lines || []).forEach(l => {
      if (l.paid) return;
      conNo += Number(l.amount) || 0;
      const t = M._capName(l.memberId);
      if (ai.indexOf(t) < 0) ai.push(t);
    }));
    if (conNo > 0) tb.push({
      id: 'no-chia-lai', nhom: 'von', muc: 'nhac', ic: '💸', route: 'capital',
      tieuDe: 'Còn phải trả lợi nhuận',
      noiDung: U.money(conNo) + ' đ chưa chi cho ' + ai.join(', '),
    });
  }

  // 3) Doanh thu
  const homNay = U.today();
  const dtHomNay = PW.revenue(homNay, homNay);
  const t7 = U.addDays(homNay, -6);
  const dt7 = PW.revenue(t7, homNay);
  const thangNay = U.periodPreset('thisMonth'), thangTruoc = U.periodPreset('lastMonth');
  const dtThangNay = PW.revenue(thangNay.from, homNay);             // tới hôm nay, không tính phần chưa tới
  const dtThangTruoc = PW.revenue(thangTruoc.from, thangTruoc.to);

  tb.push({
    id: 'dt-hom-nay', nhom: 'dt', muc: 'tin', ic: '📈', route: 'reports',
    tieuDe: 'Doanh thu hôm nay',
    noiDung: dtHomNay > 0 ? U.money(dtHomNay) + ' đ' : 'Chưa ghi nhận doanh thu nào hôm nay',
  });
  tb.push({
    id: 'dt-7-ngay', nhom: 'dt', muc: 'tin', ic: '📊', route: 'reports',
    tieuDe: 'Doanh thu 7 ngày qua',
    noiDung: U.money(dt7) + ' đ  (' + U.date(t7) + ' – ' + U.date(homNay) + ')',
  });

  let soSanh = '';
  if (dtThangTruoc > 0) {
    const ch = (dtThangNay - dtThangTruoc) / dtThangTruoc * 100;
    soSanh = ' · ' + (ch >= 0 ? '▲ tăng ' : '▼ giảm ') + Math.abs(ch).toFixed(1) + '% so với cả tháng trước';
  }
  tb.push({
    id: 'dt-thang', nhom: 'dt', muc: 'tin', ic: '🗓️', route: 'reports',
    tieuDe: 'Doanh thu tháng này',
    noiDung: U.money(dtThangNay) + ' đ' + soSanh,
  });

  // 4) Mốc doanh thu lũy kế năm — chúc mừng một lần cho mỗi mốc
  const nam = homNay.slice(0, 4);
  const dtNam = PW.revenue(nam + '-01-01', homNay);
  const mocDat = M.TB_MOC.filter(m => dtNam >= m).pop() || 0;
  if (mocDat > (st.moc || 0)) tb.push({
    id: 'moc:' + mocDat, nhom: 'dt', muc: 'vui', ic: '🎉', route: 'reports', moi: true,
    tieuDe: 'Vượt mốc doanh thu',
    noiDung: 'Doanh thu năm ' + nam + ' đã vượt ' + U.money(mocDat) + ' đ (hiện ' + U.money(dtNam) + ' đ)',
  });

  return { tb: tb, st: st, mocDat: mocDat, dtHomNay: dtHomNay, dtThangNay: dtThangNay };
};

M.tbSoMoi = function () { try { return M.tbSinh().tb.filter(x => x.moi).length; } catch (e) { return 0; } };

/* ---------- Thông báo hệ thống (ra ngoài màn hình) ---------- */
M.tbCoQuyen = () => (typeof Notification !== 'undefined') && Notification.permission === 'granted';
M.tbXinQuyen = async function () {
  if (typeof Notification === 'undefined') { U.toast('Trình duyệt này không hỗ trợ thông báo', 'error'); return false; }
  if (Notification.permission === 'denied') {
    U.toast('Bạn đã chặn thông báo cho trang này — mở cài đặt trình duyệt để bật lại', 'error');
    return false;
  }
  const kq = await Notification.requestPermission();
  if (kq === 'granted') { U.toast('Đã bật thông báo trên thiết bị này'); return true; }
  U.toast('Chưa được cấp quyền thông báo', 'error');
  return false;
};
// Dùng service worker để hiện thông báo: trên Android, new Notification() bị chặn
// trong trang, chỉ reg.showNotification() mới hiện ra ngoài màn hình.
// Icon thông báo theo đúng bản cài: thông báo của sổ in 3D mà hiện logo tranh
// thì người dùng mở nhầm app.
M._tbIcon = function () {
  const h = location.hostname;
  if (/^kt3d\./i.test(h)) return 'assets/icon-kt3d-192.png';
  if (/^ktparty\./i.test(h)) return 'assets/icon-bongbay-192.png';
  return 'assets/icon-192.png';
};
M._tbHien = async function (tieuDe, noiDung) {
  if (!M.tbCoQuyen()) return;
  const ic = M._tbIcon();
  const opt = {
    body: noiDung, icon: ic, badge: ic,
    tag: 'dali-tb', renotify: false,
    data: { url: location.pathname },
  };
  try {
    if (navigator.serviceWorker && navigator.serviceWorker.ready) {
      const reg = await navigator.serviceWorker.ready;
      if (reg && reg.showNotification) { reg.showNotification(tieuDe, opt); return; }
    }
    new Notification(tieuDe, opt);
  } catch (e) { /* không được phép thì thôi, không làm vỡ app */ }
};

/* ---------- Chuông trên thanh tiêu đề ---------- */
M.tbVeChuong = function () {
  const host = document.getElementById('notifbar');
  if (!host) return;
  host.innerHTML = '';
  let soMoi = 0;
  try { soMoi = M.tbSinh().tb.filter(x => x.moi).length; } catch (e) {}
  const btn = U.el('button', { class: 'btn sm tb-chuong', title: 'Thông báo' },
    [U.el('span', { html: U.icon ? U.icon('bell') : '🔔' })]);
  if (soMoi > 0) btn.appendChild(U.el('span', { class: 'tb-badge' }, soMoi > 9 ? '9+' : String(soMoi)));
  btn.onclick = (e) => { e.stopPropagation(); M.tbMoBang(); };
  host.appendChild(btn);
};

M.tbDongBang = function () { const p = document.getElementById('tb-panel'); if (p) p.remove(); };

M.tbMoBang = function () {
  if (document.getElementById('tb-panel')) { M.tbDongBang(); return; }
  const r = M.tbSinh();
  const panel = U.el('div', { class: 'tb-panel', id: 'tb-panel' });

  const dau = U.el('div', { class: 'tb-head' }, [
    U.el('b', null, 'Thông báo'),
    U.el('div', { class: 'spacer' }),
    C.btn('Đánh dấu đã đọc', () => { M.tbDanhDauDaDoc(); M.tbDongBang(); M.tbVeChuong(); }, 'sm ghost'),
  ]);
  panel.appendChild(dau);

  const than = U.el('div', { class: 'tb-body' });
  if (!r.tb.length) than.appendChild(U.el('div', { class: 'empty' }, 'Chưa có thông báo nào.'));
  r.tb.forEach(x => {
    const it = U.el('div', { class: 'tb-item' + (x.moi ? ' tb-moi' : '') });
    it.appendChild(U.el('div', { class: 'tb-ic' }, x.ic || '•'));
    it.appendChild(U.el('div', { class: 'tb-txt' }, [
      U.el('div', { class: 'tb-t' }, x.tieuDe),
      U.el('div', { class: 'tb-n' }, x.noiDung),
      x.ngay ? U.el('div', { class: 'tb-d' }, U.date(x.ngay)) : null,
    ].filter(Boolean)));
    it.onclick = () => { M.tbDanhDauDaDoc(); M.tbDongBang(); M.tbVeChuong(); if (x.route) App.go(x.route); };
    than.appendChild(it);
  });
  panel.appendChild(than);

  // Chân: bật/tắt thông báo hệ thống
  const chan = U.el('div', { class: 'tb-foot' });
  if (M.tbCoQuyen()) {
    chan.appendChild(U.el('span', { class: 'text-muted' }, '🔔 Thông báo trên thiết bị: đang bật'));
  } else {
    chan.appendChild(C.btn('🔔 Bật thông báo trên thiết bị này', async () => {
      if (await M.tbXinQuyen()) {
        const st = M.tbTrangThai() || { ids: [], moc: 0, ngayBaoDT: '' };
        st.batNative = true; M.tbLuu(st);
        M.tbDongBang(); M.tbVeChuong();
        M._tbHien('Đã bật thông báo', 'Từ giờ bạn sẽ được báo khi có khoản góp vốn mới và bản tin doanh thu hằng ngày.');
      }
    }, 'sm primary'));
  }
  panel.appendChild(chan);

  document.body.appendChild(panel);
  // Bấm ra ngoài thì đóng
  setTimeout(() => {
    const dong = (e) => {
      if (!panel.contains(e.target)) { M.tbDongBang(); document.removeEventListener('click', dong); }
    };
    document.addEventListener('click', dong);
  }, 0);
};

M.tbDanhDauDaDoc = function () {
  const r = M.tbSinh();
  const st = r.st;
  st.ids = M._tbNguon().map(x => x.id);
  st.moc = r.mocDat;
  M.tbLuu(st);
};

/* ---------- Khởi động: dựng chuông + bắn thông báo nếu có gì mới ---------- */
M.tbKhoiDong = function () {
  if (!PW.data) return;
  let st = M.tbTrangThai();
  if (!st) {
    // Lần đầu trên thiết bị này: coi như đã xem hết, khỏi dội một đống thông báo cũ
    const r0 = M.tbSinh();
    st = { ids: M._tbNguon().map(x => x.id), moc: r0.mocDat, ngayBaoDT: '', batNative: false };
    M.tbLuu(st);
  }
  M.tbVeChuong();

  if (!M.tbCoQuyen()) return;
  const r = M.tbSinh();
  const moi = r.tb.filter(x => x.moi);
  if (moi.length) {
    const d = moi[0];
    M._tbHien(moi.length > 1 ? moi.length + ' việc mới trong sổ' : d.tieuDe,
      moi.length > 1 ? moi.map(x => x.noiDung).slice(0, 3).join(' · ') : d.noiDung);
  }
  // Bản tin doanh thu: nhiều nhất một lần mỗi ngày
  const homNay = U.today();
  if (st.ngayBaoDT !== homNay) {
    st.ngayBaoDT = homNay; M.tbLuu(st);
    if (r.dtHomNay > 0 || r.dtThangNay > 0) {
      M._tbHien('Bản tin doanh thu',
        'Hôm nay ' + U.money(r.dtHomNay) + ' đ · Tháng này ' + U.money(r.dtThangNay) + ' đ');
    }
  }
};
