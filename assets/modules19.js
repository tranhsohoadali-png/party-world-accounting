/* ============================================================
   modules19.js — GÓP VỐN (dự án hợp tác nhiều thành viên)

   Dựng cho các dự án hai/nhiều người cùng bỏ vốn (vd xưởng in 3D):
   theo dõi ai góp gì, góp bao nhiêu, quy ra tỷ lệ sở hữu, rồi chia
   lợi nhuận theo tỷ lệ đó — và in được biên bản để hai bên ký.

   Góp vốn có thể bằng:
     • tiền (mặt / chuyển khoản)
     • máy móc, thiết bị          -> định giá theo thỏa thuận
     • ý tưởng, kinh nghiệm, quan hệ (know-how) -> tài sản vô hình
     • vật tư, hàng hóa
   Khoản vô hình PHẢI được các thành viên cùng định giá bằng văn bản
   (Luật Doanh nghiệp 2020, Điều 36) — nút "In biên bản góp vốn" sinh
   đúng văn bản đó.

   KẾ TOÁN — điểm dễ sai, đã xử lý:
   Vốn góp KHÔNG phải doanh thu, rút vốn / chia lợi nhuận KHÔNG phải
   chi phí. Nhưng chúng VẪN là dòng tiền thật ra/vào quỹ. Nên chứng từ
   quỹ sinh kèm được gắn cờ `isCapital: true`:
     - phiếu thu: không có cờ isRevenue -> PW.revenue() đã bỏ qua
     - phiếu chi: PW.expenses() và các bảng phân tích chi phí lọc
       `!p.isCapital` -> không bị trừ oan vào lợi nhuận
   Quỹ tiền / dòng tiền vẫn cộng bình thường (đúng bản chất).
   ============================================================ */

M.CAPITAL_KINDS = [
  { v: 'tien',   t: 'Tiền (mặt / chuyển khoản)',     ic: '💵', color: '#43a047' },
  { v: 'maymoc', t: 'Máy móc, thiết bị',              ic: '🖨️', color: '#1e88e5' },
  { v: 'tsvh',   t: 'Ý tưởng, kinh nghiệm, know-how', ic: '💡', color: '#fb8c00' },
  { v: 'vattu',  t: 'Vật tư, hàng hóa',               ic: '📦', color: '#8e24aa' },
  { v: 'khac',   t: 'Tài sản khác',                   ic: '🧰', color: '#607d8b' },
];
M.capitalKind = v => M.CAPITAL_KINDS.find(k => k.v === v) || M.CAPITAL_KINDS[4];
M.capitalMember = id => (PW.data.capitalMembers || []).find(m => m.id === id);
M._capName = id => { const m = M.capitalMember(id); return m ? m.name : '(đã xóa)'; };

/* ---------- Tổng hợp cơ cấu vốn ----------
   Tỷ lệ sở hữu tính trên VỐN RÒNG (đã góp − đã rút): ai rút vốn ra thì
   tỷ lệ giảm theo, đó mới là phần thực còn nằm trong dự án. */
M.capitalSummary = function () {
  const members = PW.data.capitalMembers || [];
  const contribs = PW.data.capitalContributions || [];
  const draws = PW.data.capitalWithdrawals || [];
  const shares = PW.data.profitShares || [];

  const rows = members.map(m => {
    const byKind = {};
    let gop = 0;
    contribs.forEach(c => {
      if (c.memberId !== m.id) return;
      const a = Number(c.amount) || 0;
      byKind[c.kind] = (byKind[c.kind] || 0) + a;
      gop += a;
    });
    const rut = draws.filter(w => w.memberId === m.id).reduce((s, w) => s + (Number(w.amount) || 0), 0);
    let duocChia = 0, daNhan = 0;
    shares.forEach(ps => (ps.lines || []).forEach(l => {
      if (l.memberId !== m.id) return;
      duocChia += Number(l.amount) || 0;
      if (l.paid) daNhan += Number(l.amount) || 0;
    }));
    return { m, byKind, gop, rut, net: gop - rut, duocChia, daNhan, percent: 0 };
  });

  const totalGop = rows.reduce((s, r) => s + r.gop, 0);
  const totalRut = rows.reduce((s, r) => s + r.rut, 0);
  const totalNet = rows.reduce((s, r) => s + r.net, 0);
  rows.forEach(r => { r.percent = totalNet > 0 ? r.net / totalNet * 100 : 0; });

  const byKind = {};
  contribs.forEach(c => { byKind[c.kind] = (byKind[c.kind] || 0) + (Number(c.amount) || 0); });

  return {
    rows, totalGop, totalRut, totalNet, byKind,
    totalChia: rows.reduce((s, r) => s + r.duocChia, 0),
    totalNhan: rows.reduce((s, r) => s + r.daNhan, 0),
  };
};

// Lợi nhuận thuần của một kỳ, lấy đúng công thức của Báo cáo kết quả kinh doanh.
M.capitalNetProfit = function (from, to) {
  return PW.revenue(from, to) - PW.cogs(from, to) - PW.sellingFees(from, to) - PW.expenses(from, to);
};

/* ---------- Đồng bộ chứng từ quỹ cho một bản ghi vốn ----------
   loai: 'thu' (vốn vào) | 'chi' (vốn/lợi nhuận ra). ref = khóa liên kết.
   info rỗng hoặc thiếu tài khoản -> xóa chứng từ cũ (người dùng bỏ chọn ghi quỹ). */
M._capCashSync = function (loai, ref, info) {
  const arr = loai === 'thu' ? PW.data.receipts : PW.data.payments;
  const i = arr.findIndex(x => x.capitalRef === ref);
  if (!info || !info.accountId || !(Number(info.amount) > 0)) {
    if (i >= 0) arr.splice(i, 1);
    return null;
  }
  const base = {
    date: info.date, accountId: info.accountId, amount: Number(info.amount) || 0,
    reason: info.reason, note: info.note || '', isCapital: true, capitalRef: ref,
  };
  if (loai === 'thu') base.customerId = null; else base.supplierId = null;
  if (i >= 0) { Object.assign(arr[i], base); return arr[i].id; }
  const obj = Object.assign({ id: PW.uid(), code: PW.nextCode(loai === 'thu' ? 'PT' : 'PC') }, base);
  arr.push(obj);
  return obj.id;
};
/* ---------- Đồng bộ PHIẾU NHẬP KHO cho khoản góp bằng vật tư ----------
   Vật tư góp vào là hàng có thật, phải nằm trong kho chứ không chỉ là một con
   số trên bảng vốn — nếu không thì sản xuất không trừ được nguyên liệu và giá
   thành tính sai. Ghi thành PHIẾU NHẬP MUA, nhưng:
     supplierId = null  -> không sinh công nợ phải trả (PW.totalPayable cộng
                           theo từng nhà cung cấp nên phiếu này vô hình)
     paid = 0, paidAccountId = null -> quỹ tiền không đổi
   Đúng bản chất: hàng vào kho, tiền không đi đâu cả, đối ứng là vốn góp. */
M._capStockSync = function (ref, info) {
  const i = PW.data.purchases.findIndex(x => x.capitalRef === ref);
  const items = (info && info.items || []).filter(it => it.productId && Number(it.qty) > 0);
  if (!items.length) {                       // đổi sang hình thức góp khác -> bỏ phiếu nhập cũ
    if (i >= 0) PW.data.purchases.splice(i, 1);
    return null;
  }
  const base = {
    date: info.date, supplierId: null, items: items.map(it => ({
      productId: it.productId, qty: Number(it.qty) || 0, cost: Number(it.cost) || 0,
    })),
    discount: 0, paid: 0, paidAccountId: null,
    note: 'Vật tư góp vốn — ' + info.tenThanhVien + ' (' + info.code + ')',
    isCapital: true, capitalRef: ref,
  };
  if (i >= 0) { Object.assign(PW.data.purchases[i], base); return PW.data.purchases[i].code; }
  const obj = Object.assign({ id: PW.uid(), code: PW.nextCode('PN') }, base);
  PW.data.purchases.push(obj);
  return obj.code;
};
M._capPhieuNhap = ref => PW.data.purchases.find(x => x.capitalRef === ref);

// Xóa mọi chứng từ gắn với ref (kể cả các dòng con "ref:memberId" của phiếu chia lợi nhuận).
M._capCashDrop = function (ref) {
  const hit = x => x.capitalRef === ref || (typeof x.capitalRef === 'string' && x.capitalRef.indexOf(ref + ':') === 0);
  PW.data.receipts = PW.data.receipts.filter(x => !hit(x));
  PW.data.payments = PW.data.payments.filter(x => !hit(x));
  PW.data.purchases = PW.data.purchases.filter(x => !hit(x));   // phiếu nhập kho của vật tư góp vốn
};

M._capBar = function (pct, color) {
  const w = Math.max(0, Math.min(100, Number(pct) || 0));
  return U.el('div', { style: 'background:#eceff1;border-radius:6px;height:8px;overflow:hidden;min-width:70px;margin-top:4px' },
    U.el('div', { style: 'height:100%;border-radius:6px;width:' + w.toFixed(1) + '%;background:' + (color || 'var(--teal)') }));
};
M._capKpi = function (label, val, sub, cls) {
  return U.el('div', { class: 'kpi' }, [
    U.el('div', { class: 'label' }, label),
    U.el('div', { class: 'value ' + (cls || '') }, typeof val === 'number' ? U.money(val) : val),
    U.el('div', { class: 'sub' }, sub || 'đồng'),
  ]);
};
M._capAccOpts = extra => [{ value: '', label: extra || '— Không ghi vào quỹ —' }]
  .concat(PW.data.cashAccounts.map(a => ({ value: a.id, label: a.name })));
M._capMemberOpts = () => (PW.data.capitalMembers || []).map(m => ({ value: m.id, label: m.name }));

/* =====================================================================
   TRANG CHÍNH
   ===================================================================== */
M.capital = function (root) {
  if (!(PW.data.capitalMembers || []).length) return M._capSetup(root);
  root.appendChild(C.tabs([
    { label: '📊 Cơ cấu vốn',         content: M._capOverviewTab() },
    { label: '➕ Khoản góp vốn',       content: M._capContribTab() },
    { label: '➖ Rút vốn',             content: M._capWithdrawTab() },
    { label: '💰 Phân chia lợi nhuận', content: M._capProfitTab() },
    { label: '👥 Thành viên',          content: M._capMemberTab() },
  ]));
};

/* ---------- Màn khởi tạo: chưa có thành viên nào ---------- */
M._capSetup = function (root) {
  const card = U.el('div', { class: 'card' });
  card.appendChild(U.el('div', { class: 'card-title' }, '🤝 Thiết lập dự án góp vốn'));
  card.appendChild(U.el('p', { class: 'section-sub' },
    'Chưa có thành viên góp vốn nào. Khai hai bên góp vốn ở đây là xong — sau đó mỗi lần ai bỏ thêm tiền '
    + 'hay mang máy vào thì ghi một khoản góp vốn, phần mềm tự tính lại tỷ lệ sở hữu.'));

  const n1 = C.input({ placeholder: 'Họ tên của bạn', style: 'width:100%' });
  const n2 = C.input({ value: 'Cường', placeholder: 'Họ tên thành viên thứ hai', style: 'width:100%' });
  const ttVal = C.money({ value: 400000000, style: 'width:100%;text-align:right;font-weight:700' });
  const ttNote = C.input({ value: 'Ý tưởng, kinh nghiệm và quan hệ khách hàng đưa vào dự án', style: 'width:100%' });

  card.appendChild(U.el('div', { class: 'form-grid' }, [
    C.field('Thành viên 1 (bạn)', n1, { required: true }),
    C.field('Thành viên 2', n2, { required: true }),
    C.field('Ghi cho thành viên 1 — giá trị ý tưởng & kinh nghiệm (đ)',
      U.el('div', null, [ttVal, C.moneyWords(ttVal)]), { full: true }),
    C.field('Diễn giải khoản góp vô hình', ttNote, { full: true }),
  ]));
  card.appendChild(U.el('p', { class: 'section-sub mt8' },
    'Phần máy móc để trống — vào thẻ "Khoản góp vốn" nhập từng máy sau, ghi rõ ai mua và giá bao nhiêu.'));
  card.appendChild(U.el('div', { class: 'pill-row mt8' }, [
    C.btn('Khởi tạo dự án góp vốn', () => {
      const a = n1.value.trim(), b = n2.value.trim();
      if (!a || !b) return U.toast('Nhập tên cả hai thành viên', 'error');
      const mk = name => ({ id: PW.uid(), code: PW.nextCode('TV'), name: name, phone: '', address: '', idNo: '', title: 'Thành viên sáng lập', note: '' });
      const m1 = mk(a), m2 = mk(b);
      PW.data.capitalMembers.push(m1, m2);
      const v = ttVal.soTien();
      if (v > 0) PW.data.capitalContributions.push({
        id: PW.uid(), code: PW.nextCode('GV'), date: U.today(), memberId: m1.id, kind: 'tsvh',
        assetName: 'Ý tưởng, kinh nghiệm & know-how', qty: 1, unit: 'gói', amount: v,
        accountId: '', note: ttNote.value.trim(),
      });
      PW.logActivity('create', 'capital', 'Khởi tạo dự án góp vốn', a + ' & ' + b);
      PW.save(); App.refresh(); U.toast('Đã tạo dự án góp vốn');
    }, 'primary'),
  ]));
  root.appendChild(card);
};

/* =====================================================================
   THẺ 1 — CƠ CẤU VỐN
   ===================================================================== */
M._capOverviewTab = function () {
  const host = U.el('div');
  function draw() {
    host.innerHTML = '';
    const S = M.capitalSummary();
    const conLai = S.totalChia - S.totalNhan;

    const kpi = U.el('div', { class: 'grid c4' }, [
      M._capKpi('Tổng vốn đã góp', S.totalGop, (PW.data.capitalContributions || []).length + ' khoản góp'),
      M._capKpi('Vốn ròng hiện tại', S.totalNet, S.totalRut ? 'đã trừ ' + U.money(S.totalRut) + ' đ rút vốn' : 'chưa ai rút vốn', 'text-green'),
      M._capKpi('Lợi nhuận đã chia', S.totalChia, (PW.data.profitShares || []).length + ' lần chia'),
      M._capKpi('Còn phải trả thành viên', conLai, conLai > 0 ? 'chưa chi trả' : 'đã trả hết', conLai > 0 ? 'text-red' : 'text-green'),
    ]);
    host.appendChild(kpi);

    // --- Bảng cơ cấu vốn theo thành viên ---
    const card = U.el('div', { class: 'card mt16' });
    const tb = U.el('div', { class: 'toolbar' }, [
      U.el('div', { class: 'card-title', style: 'margin:0' }, '📊 Cơ cấu vốn & tỷ lệ sở hữu'),
      U.el('div', { class: 'spacer' }),
      C.btn('📊 Xuất Excel', () => M.capitalExcel()),
      C.btn('🖨 In biên bản góp vốn', () => M.capitalMinutes(), 'primary'),
    ]);
    card.appendChild(tb);

    const kinds = M.CAPITAL_KINDS.filter(k => S.byKind[k.v]);   // chỉ hiện hình thức góp thực có
    const cols = [
      { label: 'Thành viên', render: r => '<b>' + U.esc(r.m.name) + '</b>'
          + (r.m.title ? '<div class="text-muted" style="font-size:11px">' + U.esc(r.m.title) + '</div>' : '') },
    ].concat(kinds.map(k => ({
      label: k.ic + ' ' + k.t.split(' (')[0].split(',')[0], num: true,
      render: r => r.byKind[k.v] ? U.money(r.byKind[k.v]) : '',
    }))).concat([
      { label: 'Tổng góp', num: true, render: r => '<b>' + U.money(r.gop) + '</b>' },
      { label: 'Đã rút', num: true, render: r => r.rut ? '<span class="text-red">' + U.money(r.rut) + '</span>' : '' },
      { label: 'Vốn ròng', num: true, render: r => '<b class="text-green">' + U.money(r.net) + '</b>' },
      { label: 'Tỷ lệ sở hữu', num: true, render: r => {
          const d = U.el('div');
          d.appendChild(U.el('div', { style: 'font-weight:700' }, r.percent.toFixed(2) + '%'));
          d.appendChild(M._capBar(r.percent));
          return d;
        } },
    ]);
    const footer = [{ html: 'CỘNG', colspan: 1 }]
      .concat(kinds.map(k => ({ html: U.money(S.byKind[k.v] || 0), num: true })))
      .concat([
        { html: U.money(S.totalGop), num: true },
        { html: S.totalRut ? U.money(S.totalRut) : '', num: true },
        { html: U.money(S.totalNet), num: true },
        { html: '100%', num: true },
      ]);
    card.appendChild(C.table(S.rows, cols, { footer: footer, empty: 'Chưa có thành viên' }));
    host.appendChild(card);

    // --- Cơ cấu theo hình thức góp ---
    const kCard = U.el('div', { class: 'card mt16' });
    kCard.appendChild(U.el('div', { class: 'card-title' }, '🧩 Vốn góp theo hình thức'));
    if (!S.totalGop) {
      kCard.appendChild(U.el('div', { class: 'empty' }, 'Chưa có khoản góp vốn nào.'));
    } else {
      M.CAPITAL_KINDS.forEach(k => {
        const v = S.byKind[k.v] || 0;
        if (!v) return;
        const pct = v / S.totalGop * 100;
        const row = U.el('div', { style: 'margin-bottom:12px' });
        row.appendChild(U.el('div', { class: 'fin-row', style: 'border:0;padding:0 0 2px' }, [
          U.el('span', { class: 'k' }, k.ic + ' ' + k.t),
          U.el('span', { class: 'v' }, U.money(v) + ' đ · ' + pct.toFixed(1) + '%'),
        ]));
        row.appendChild(M._capBar(pct, k.color));
        kCard.appendChild(row);
      });
      const vh = S.byKind.tsvh || 0;
      if (vh > 0) kCard.appendChild(U.el('p', { class: 'section-sub mt16', html:
        '⚠️ Trong tổng vốn có <b>' + U.money(vh) + ' đ</b> là tài sản vô hình (ý tưởng, kinh nghiệm) — '
        + 'đây là <b>giá trị do các thành viên tự thỏa thuận</b>, không phải tiền thật đã vào quỹ. '
        + 'Hãy in biên bản góp vốn và cùng ký để khoản này có căn cứ khi chia lợi nhuận về sau.' }));
    }
    host.appendChild(kCard);
  }
  draw();
  return host;
};

/* =====================================================================
   THẺ 2 — KHOẢN GÓP VỐN
   ===================================================================== */
M._capContribTab = function () {
  const wrap = U.el('div', { class: 'card' });
  const listHost = U.el('div');
  const flt = M.filterBar({
    storageKey: 'capContrib',
    fields: [
      { type: 'period', key: 'ky', default: 'all' },
      { type: 'select', key: 'memberId', label: 'Thành viên', source: () => M._capMemberOpts() },
      { type: 'select', key: 'kind', label: 'Hình thức', options: [{ value: '', label: 'Tất cả' }].concat(M.CAPITAL_KINDS.map(k => ({ value: k.v, label: k.t }))) },
      { type: 'search', key: 'q', placeholder: 'Tìm tài sản / diễn giải...' },
    ],
    actions: [
      // Xuất đúng những gì đang nhìn thấy: dùng lại bộ lọc hiện hành, không xuất cả sổ
      C.btn('📊 Xuất Excel', () => { const d = locHienTai(); M.capitalListExcel(d.rows, d.moTa); }),
      C.btn('🖨 In / PDF', () => { const d = locHienTai(); M.capitalListPrint(d.rows, d.moTa); }),
      C.btn('+ Ghi khoản góp vốn', () => M.capitalContribForm(), 'primary'),
    ],
    onChange: draw,
  });

  // Danh sách đang hiển thị + mô tả bộ lọc để in lên đầu file
  function locHienTai() {
    const s = flt.getState();
    const rows = M.applyFilter((PW.data.capitalContributions || []).slice(), s, {
      date: c => c.date, memberId: c => c.memberId, kind: c => c.kind,
      text: c => (c.assetName || '') + ' ' + (c.note || '') + ' ' + (c.code || ''),
    }).sort((a, b) => (a.date + a.code).localeCompare(b.date + b.code));   // in thì xếp từ cũ -> mới
    const ph = [];
    ph.push('Kỳ: ' + (s.from || s.to ? (s.from ? U.date(s.from) : '…') + ' – ' + (s.to ? U.date(s.to) : '…') : 'Tất cả'));
    ph.push('Thành viên: ' + (s.memberId ? M._capName(s.memberId) : 'Tất cả'));
    ph.push('Hình thức: ' + (s.kind ? M.capitalKind(s.kind).t : 'Tất cả'));
    if (s.q) ph.push('Tìm: "' + s.q + '"');
    return { rows: rows, moTa: ph.join('   ·   ') };
  }
  wrap.appendChild(U.el('div', { class: 'card-title' }, '➕ Các khoản góp vốn'));
  wrap.appendChild(flt.el);
  wrap.appendChild(listHost);

  function draw() {
    const s = flt.getState();
    const rows = M.applyFilter((PW.data.capitalContributions || []).slice(), s, {
      date: c => c.date, memberId: c => c.memberId, kind: c => c.kind,
      text: c => (c.assetName || '') + ' ' + (c.note || '') + ' ' + (c.code || ''),
    }).sort((a, b) => (b.date + b.code).localeCompare(a.date + a.code));
    const tong = rows.reduce((t, c) => t + (Number(c.amount) || 0), 0);
    listHost.innerHTML = '';
    listHost.appendChild(C.table(rows, [
      { label: 'Ngày', render: c => U.date(c.date) },
      { label: 'Số CT', render: c => U.esc(c.code) },
      { label: 'Thành viên', render: c => U.esc(M._capName(c.memberId)) },
      { label: 'Hình thức', render: c => { const k = M.capitalKind(c.kind); return k.ic + ' ' + U.esc(k.t); } },
      { label: 'Tài sản góp / diễn giải', render: c => U.esc(c.assetName || '')
          + (c.note ? '<div class="text-muted" style="font-size:11px">' + U.esc(c.note) + '</div>' : '') },
      { label: 'SL', num: true, render: c => c.qty ? U.num(c.qty) + ' ' + U.esc(c.unit || '') : '' },
      { label: 'Giá trị', num: true, render: c => '<b>' + U.money(c.amount) + '</b>' },
      { label: 'Chứng từ kèm', center: true, render: c => {
          if (c.accountId) return '<span class="text-green" title="Đã tạo phiếu thu vào quỹ">✔ phiếu thu</span>';
          const pn = M._capPhieuNhap(c.id);
          if (!pn) return '<span class="text-muted">—</span>';
          // Bấm vào mở thẳng phiếu nhập để soát lại số lượng / đơn giá
          return U.el('a', {
            href: '#', title: 'Đã nhập kho — bấm để mở phiếu nhập',
            onclick: e => { e.preventDefault(); M.purchaseForm(pn); },
          }, '📦 ' + pn.code);
        } },
      { label: '', render: c => C.actions([
          { label: 'Sửa', onClick: () => M.capitalContribForm(c) },
          { label: 'Xóa', cls: 'danger', onClick: () => {
              const pn = M._capPhieuNhap(c.id);
              if (!U.confirm('Xóa khoản góp vốn ' + c.code + ' (' + U.money(c.amount) + ' đ)?\n\n'
                + (pn ? 'Phiếu nhập kho ' + pn.code + ' cũng bị xóa — tồn kho sẽ giảm tương ứng.'
                      : 'Phiếu thu quỹ gắn kèm (nếu có) cũng bị xóa.'))) return;
              M._capCashDrop(c.id);
              PW.data.capitalContributions = PW.data.capitalContributions.filter(x => x.id !== c.id);
              PW.logActivity('delete', 'capital', c.code, M._capName(c.memberId) + ' · ' + U.money(c.amount));
              PW.save(); App.refresh(); U.toast('Đã xóa');
            } },
        ]) },
    ], {
      empty: 'Chưa có khoản góp vốn nào khớp bộ lọc.',
      footer: [{ html: 'CỘNG ' + rows.length + ' khoản', colspan: 6 }, { html: U.money(tong), num: true }, { html: '' }, { html: '' }],
    }));
  }
  draw();
  return wrap;
};

M.capitalContribForm = function (c) {
  const isNew = !c;
  const src = c;
  c = c ? JSON.parse(JSON.stringify(c)) : {
    code: PW.nextCode('GV'), date: U.today(), memberId: (PW.data.capitalMembers[0] || {}).id || '',
    kind: 'maymoc', assetName: '', qty: 1, unit: 'Cái', amount: 0, accountId: '', note: '',
  };

  const codeI = C.input({ value: c.code });
  const dateI = C.input({ type: 'date', value: c.date });
  const memI = C.select(M._capMemberOpts(), c.memberId);
  const kindI = C.select(M.CAPITAL_KINDS.map(k => ({ value: k.v, label: k.ic + ' ' + k.t })), c.kind);
  const nameI = C.input({ value: c.assetName || '', placeholder: 'VD: Máy in 3D Bambu Lab A1 + AMS lite', style: 'width:100%' });
  const qtyI = C.input({ type: 'number', value: c.qty, min: 0, step: '0.01', style: 'text-align:right' });
  const unitI = M.unitSelect(c.unit || '');
  const amtI = C.money({ value: c.amount, style: 'text-align:right;font-weight:700' });
  const accI = C.select(M._capAccOpts(), c.accountId || '');
  const noteI = C.textarea({ value: c.note || '', placeholder: 'Căn cứ định giá, số máy, tình trạng…', style: 'width:100%' });

  /* ----- Bảng vật tư: góp bằng vật tư thì phải khai từng món để nhập kho ----- */
  let items = (c.items || []).map(x => Object.assign({}, x));
  const itemBody = U.el('tbody');
  const tongItemEl = U.el('b');
  const tongItems = () => items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.cost) || 0), 0);

  function dongBoTongVatTu() {
    const t = tongItems();
    tongItemEl.textContent = U.money(t) + ' đ';
    amtI.datSoTien(t);                       // giá trị góp = đúng tổng hàng nhập kho
    amtI.dispatchEvent(new Event('input'));  // cập nhật dòng "Bằng chữ"
  }
  function veItems() {
    itemBody.innerHTML = '';
    items.forEach((it, idx) => {
      const pick = M.productPicker(it.productId, () => { it.productId = pick.ppValue(); veItems(); dongBoTongVatTu(); }, { isSale: false });
      const qty = U.el('input', { type: 'number', value: it.qty || 0, min: 0, step: '0.01', style: 'text-align:right' });
      const gia = C.money({ value: it.cost || 0, style: 'text-align:right' });
      // Thành tiền cũng NHẬP ĐƯỢC: mua cả lô thì thường biết tổng tiền trước,
      // còn đơn giá là phép chia — để máy chia, đỡ bấm máy tính rồi gõ nhầm.
      const tt = C.money({ value: Math.round((Number(it.qty) || 0) * (Number(it.cost) || 0)), style: 'text-align:right' });
      const ghiChu = U.el('div', { style: 'font-size:11px;color:#7b8794;margin-top:2px' });

      // Đơn giá là cái bất biến: đổi số lượng thì tổng tiền chạy theo.
      // Chỉ khi người dùng tự gõ Thành tiền mới suy ngược ra đơn giá.
      function veTong() {
        tt.datSoTien(Math.round((Number(it.qty) || 0) * (Number(it.cost) || 0)));
        ghiChu.textContent = '';
        dongBoTongVatTu();
      }
      qty.addEventListener('input', () => { it.qty = Number(qty.value) || 0; veTong(); });
      gia.addEventListener('input', () => { it.cost = gia.soTien(); veTong(); });
      tt.addEventListener('input', () => {
        const q = Number(it.qty) || 0;
        if (q <= 0) { ghiChu.textContent = 'Nhập số lượng trước thì mới chia ra đơn giá được'; return; }
        // Giữ ĐÚNG số lẻ: 2.000.000 chia 3 là 666.666,67 — làm tròn đơn giá rồi
        // nhân lại sẽ lệch mất mấy đồng so với số tiền thật đã trả.
        it.cost = tt.soTien() / q;
        gia.datSoTien(it.cost);
        const lam = Math.round(it.cost) !== it.cost;
        ghiChu.textContent = lam ? 'Đơn giá lẻ ' + it.cost.toLocaleString('vi-VN', { maximumFractionDigits: 2 })
          + ' — giữ nguyên số lẻ để tổng tiền khớp' : '';
        dongBoTongVatTu();
      });
      veTong();
      const p = PW.product(it.productId);
      itemBody.appendChild(U.el('tr', null, [
        U.el('td', { class: 'center', style: 'width:32px' }, String(idx + 1)),
        U.el('td', null, [pick, p ? U.el('div', { style: 'font-size:11px;color:#7b8794' },
          'Tồn hiện tại: ' + U.num(PW.stockOf(p.id)) + ' ' + (p.unit || '')) : null].filter(Boolean)),
        U.el('td', { style: 'width:92px' }, qty),
        U.el('td', { style: 'width:130px' }, gia),
        U.el('td', { style: 'width:140px' }, [tt, ghiChu]),
        U.el('td', { class: 'center', style: 'width:38px' },
          U.el('button', { class: 'btn sm danger', type: 'button', onclick: () => { items.splice(idx, 1); veItems(); dongBoTongVatTu(); } }, '×')),
      ]));
    });
  }
  const itemTbl = U.el('table', { class: 'items-tbl' });
  itemTbl.appendChild(U.el('thead', null, U.el('tr', null, [
    U.el('th', { style: 'width:32px' }, '#'), U.el('th', null, 'Vật tư / hàng hóa'),
    U.el('th', null, 'Số lượng'), U.el('th', null, 'Đơn giá'),
    U.el('th', { class: 'num' }, 'Thành tiền'), U.el('th', null, ''),
  ])));
  itemTbl.appendChild(itemBody);
  const vatTuBox = U.el('div', null, [
    U.el('div', { class: 'toolbar', style: 'margin:14px 0 4px' }, [
      U.el('div', { style: 'font-weight:600' }, '📦 Vật tư góp vào (sẽ nhập kho)'),
      U.el('div', { class: 'spacer' }),
      C.btn('+ Thêm dòng', () => { items.push({ productId: '', qty: 0, cost: 0 }); veItems(); dongBoTongVatTu(); }, 'sm'),
    ]),
    U.el('div', { class: 'table-wrap' }, itemTbl),
    U.el('div', { style: 'text-align:right;margin-top:6px' }, [U.el('span', { class: 'text-muted' }, 'Tổng giá trị vật tư: '), tongItemEl]),
  ]);

  // Chỉ góp bằng TIỀN mới có chuyện vào quỹ. Máy móc / ý tưởng không làm quỹ tăng.
  const accField = C.field('Ghi vào quỹ tiền (tạo phiếu thu)', accI, { full: true });
  const qtyField = C.field('Số lượng', qtyI);
  const unitField = C.field('Đơn vị', unitI);
  const hint = U.el('p', { class: 'section-sub' });
  function syncKind() {
    const isTien = kindI.value === 'tien';
    const isVatTu = kindI.value === 'vattu';
    accField.style.display = isTien ? '' : 'none';
    if (!isTien) accI.value = '';
    // Góp bằng tiền thì "2 cái" là vô nghĩa -> giấu hai ô này đi, khỏi lọt vào biên bản.
    // Góp vật tư thì số lượng nằm ở bảng bên dưới, ô này cũng thừa.
    qtyField.style.display = unitField.style.display = (isTien || isVatTu) ? 'none' : '';
    if (isTien) { qtyI.value = 0; unitI.value = ''; }
    // Vật tư: giá trị góp PHẢI bằng tổng hàng nhập kho, không cho gõ tay lệch đi
    vatTuBox.style.display = isVatTu ? '' : 'none';
    amtI.readOnly = isVatTu;
    amtI.style.background = isVatTu ? '#f4f7ee' : '';
    if (isVatTu) { if (!items.length) items.push({ productId: '', qty: 0, cost: 0 }); veItems(); dongBoTongVatTu(); }
    if (kindI.value === 'tsvh') {
      hint.innerHTML = '💡 Khoản vô hình: <b>không có tiền thật vào quỹ</b>. Giá trị dưới đây là mức '
        + 'hai bên tự thỏa thuận — nhớ in biên bản góp vốn và cùng ký để sau này không tranh chấp.';
    } else if (isTien) {
      hint.innerHTML = '💵 Chọn tài khoản quỹ để phần mềm tự tạo <b>phiếu thu</b> tương ứng — quỹ tiền tăng đúng, '
        + 'và khoản này <b>không</b> bị tính thành doanh thu.';
    } else if (isVatTu) {
      hint.innerHTML = '📦 Khai từng món ở bảng trên — phần mềm tự lập <b>phiếu nhập kho</b> để vật tư có mặt '
        + 'trong kho và sản xuất trừ được nguyên liệu. Phiếu đó <b>không</b> sinh công nợ phải trả và '
        + '<b>không</b> động vào quỹ tiền: hàng vào kho, đối ứng là vốn góp.';
    } else {
      hint.innerHTML = '📦 Tài sản mang vào dự án: nhập giá trị hai bên thống nhất. Quỹ tiền không đổi. '
        + 'Máy móc <b>không</b> vào kho hàng hóa (đó là tài sản cố định, không phải hàng để bán hay để sản xuất).';
    }
  }
  kindI.addEventListener('change', syncKind);
  syncKind();

  const body = U.el('div', null, [
    U.el('div', { class: 'form-grid' }, [
      C.field('Số chứng từ', codeI),
      C.field('Ngày góp', dateI, { required: true }),
      C.field('Thành viên góp', memI, { required: true }),
      C.field('Hình thức góp', kindI, { required: true }),
      C.field('Tài sản góp / diễn giải', nameI, { full: true, required: true }),
      qtyField, unitField,
    ]),
    vatTuBox,
    U.el('div', { class: 'form-grid', style: 'margin-top:14px' }, [
      C.field('Giá trị ghi nhận (đ)', U.el('div', null, [amtI, C.moneyWords(amtI)]), { full: true, required: true }),
      accField,
      C.field('Ghi chú / căn cứ định giá', noteI, { full: true }),
    ]),
    hint,
  ]);

  C.modal({
    title: (isNew ? '➕ Ghi khoản góp vốn' : '✏️ Sửa khoản góp vốn ' + c.code), wide: true, body,
    footer: [C.btn('Hủy', C.closeModal), C.btn('Lưu', () => {
      const obj = {
        id: isNew ? PW.uid() : src.id,
        code: codeI.value.trim() || c.code, date: dateI.value, memberId: memI.value,
        kind: kindI.value, assetName: nameI.value.trim(), qty: Number(qtyI.value) || 0,
        unit: unitI.value.trim(), amount: amtI.soTien(),
        accountId: accI.value || '', note: noteI.value.trim(),
        // Góp bằng vật tư: giữ lại chi tiết từng món để còn sửa và để dựng lại phiếu nhập
        items: kindI.value === 'vattu'
          ? items.filter(it => it.productId && Number(it.qty) > 0)
              .map(it => ({ productId: it.productId, qty: Number(it.qty) || 0, cost: Number(it.cost) || 0 }))
          : [],
      };
      if (!obj.date) return U.toast('Chọn ngày góp', 'error');
      if (!obj.memberId) return U.toast('Chọn thành viên góp', 'error');
      if (!obj.assetName) return U.toast('Nhập tài sản góp / diễn giải', 'error');
      if (obj.kind === 'vattu' && !obj.items.length)
        return U.toast('Khai ít nhất một dòng vật tư (chọn hàng và nhập số lượng)', 'error');
      if (!(obj.amount > 0)) return U.toast('Giá trị góp phải lớn hơn 0', 'error');

      if (isNew) PW.data.capitalContributions.push(obj);
      else Object.assign(src, obj);

      M._capCashSync('thu', obj.id, obj.accountId ? {
        date: obj.date, accountId: obj.accountId, amount: obj.amount,
        reason: 'Góp vốn — ' + M._capName(obj.memberId), note: obj.code + ' · ' + obj.assetName,
      } : null);
      // Vật tư -> phiếu nhập kho. Đổi sang hình thức khác thì items rỗng -> phiếu cũ bị gỡ.
      const maPN = M._capStockSync(obj.id, {
        date: obj.date, code: obj.code, items: obj.items, tenThanhVien: M._capName(obj.memberId),
      });

      PW.logActivity(isNew ? 'create' : 'update', 'capital', obj.code,
        M._capName(obj.memberId) + ' · ' + M.capitalKind(obj.kind).t + ' · ' + U.money(obj.amount));
      PW.save(); C.closeModal(); App.refresh();
      U.toast(maPN ? 'Đã lưu và nhập kho theo phiếu ' + maPN : 'Đã lưu khoản góp vốn');
    }, 'primary')],
  });
};

/* =====================================================================
   THẺ 3 — RÚT VỐN
   ===================================================================== */
M._capWithdrawTab = function () {
  const wrap = U.el('div', { class: 'card' });
  const listHost = U.el('div');
  wrap.appendChild(U.el('div', { class: 'card-title' }, '➖ Rút vốn'));
  wrap.appendChild(U.el('p', { class: 'section-sub' },
    'Thành viên lấy lại phần vốn đã góp. Rút vốn làm giảm vốn ròng nên <b>tỷ lệ sở hữu tự tính lại</b>. '
    + 'Đây không phải chi phí của dự án nên không bị trừ vào lợi nhuận.'));
  wrap.appendChild(U.el('div', { class: 'toolbar' }, [
    U.el('div', { class: 'spacer' }),
    C.btn('+ Ghi rút vốn', () => M.capitalWithdrawForm(), 'primary'),
  ]));
  wrap.appendChild(listHost);

  function draw() {
    const rows = (PW.data.capitalWithdrawals || []).slice().sort((a, b) => (b.date + b.code).localeCompare(a.date + a.code));
    const tong = rows.reduce((t, w) => t + (Number(w.amount) || 0), 0);
    listHost.innerHTML = '';
    listHost.appendChild(C.table(rows, [
      { label: 'Ngày', render: w => U.date(w.date) },
      { label: 'Số CT', render: w => U.esc(w.code) },
      { label: 'Thành viên', render: w => U.esc(M._capName(w.memberId)) },
      { label: 'Lý do', render: w => U.esc(w.reason || '') },
      { label: 'Số tiền', num: true, render: w => '<b class="text-red">' + U.money(w.amount) + '</b>' },
      { label: 'Từ quỹ', render: w => { const a = PW.account(w.accountId); return a ? U.esc(a.name) : '<span class="text-muted">—</span>'; } },
      { label: '', render: w => C.actions([
          { label: 'Sửa', onClick: () => M.capitalWithdrawForm(w) },
          { label: 'Xóa', cls: 'danger', onClick: () => {
              if (!U.confirm('Xóa phiếu rút vốn ' + w.code + '?\n\nPhiếu chi quỹ gắn kèm (nếu có) cũng bị xóa.')) return;
              M._capCashDrop(w.id);
              PW.data.capitalWithdrawals = PW.data.capitalWithdrawals.filter(x => x.id !== w.id);
              PW.logActivity('delete', 'capital', w.code, 'rút vốn ' + U.money(w.amount));
              PW.save(); App.refresh(); U.toast('Đã xóa');
            } },
        ]) },
    ], {
      empty: 'Chưa có ai rút vốn.',
      footer: [{ html: 'CỘNG', colspan: 4 }, { html: U.money(tong), num: true }, { html: '' }, { html: '' }],
    }));
  }
  draw();
  return wrap;
};

M.capitalWithdrawForm = function (w) {
  const isNew = !w;
  const src = w;
  w = w ? JSON.parse(JSON.stringify(w)) : {
    code: PW.nextCode('RV'), date: U.today(), memberId: (PW.data.capitalMembers[0] || {}).id || '',
    amount: 0, reason: 'Rút vốn góp', accountId: (PW.data.cashAccounts[0] || {}).id || '', note: '',
  };
  const S = M.capitalSummary();

  const codeI = C.input({ value: w.code });
  const dateI = C.input({ type: 'date', value: w.date });
  const memI = C.select(M._capMemberOpts(), w.memberId);
  const amtI = C.money({ value: w.amount, style: 'text-align:right;font-weight:700' });
  const reasonI = C.input({ value: w.reason || '', style: 'width:100%' });
  const accI = C.select(M._capAccOpts(), w.accountId || '');
  const noteI = C.input({ value: w.note || '', style: 'width:100%' });

  const avail = U.el('p', { class: 'section-sub' });
  function syncAvail() {
    const r = S.rows.find(x => x.m.id === memI.value);
    const con = r ? r.net : 0;
    const xin = amtI.soTien();
    avail.innerHTML = 'Vốn ròng hiện có của thành viên này: <b>' + U.money(con) + ' đ</b>'
      + (xin > con ? ' — <span class="text-red">rút ' + U.money(xin) + ' đ là vượt quá phần đã góp</span>' : '');
  }
  memI.addEventListener('change', syncAvail);
  amtI.addEventListener('input', syncAvail);
  syncAvail();

  const body = U.el('div', null, [
    U.el('div', { class: 'form-grid' }, [
      C.field('Số chứng từ', codeI),
      C.field('Ngày rút', dateI, { required: true }),
      C.field('Thành viên', memI, { required: true }),
      C.field('Số tiền rút (đ)', U.el('div', null, [amtI, C.moneyWords(amtI)]), { required: true }),
      C.field('Lý do', reasonI, { full: true }),
      C.field('Chi từ quỹ (tạo phiếu chi)', accI, { full: true }),
      C.field('Ghi chú', noteI, { full: true }),
    ]),
    avail,
  ]);

  C.modal({
    title: (isNew ? '➖ Ghi rút vốn' : '✏️ Sửa phiếu rút vốn ' + w.code), wide: true, body,
    footer: [C.btn('Hủy', C.closeModal), C.btn('Lưu', () => {
      const obj = {
        id: isNew ? PW.uid() : src.id,
        code: codeI.value.trim() || w.code, date: dateI.value, memberId: memI.value,
        amount: amtI.soTien(), reason: reasonI.value.trim() || 'Rút vốn góp',
        accountId: accI.value || '', note: noteI.value.trim(),
      };
      if (!obj.date) return U.toast('Chọn ngày rút', 'error');
      if (!obj.memberId) return U.toast('Chọn thành viên', 'error');
      if (!(obj.amount > 0)) return U.toast('Số tiền rút phải lớn hơn 0', 'error');

      if (isNew) PW.data.capitalWithdrawals.push(obj);
      else Object.assign(src, obj);

      M._capCashSync('chi', obj.id, obj.accountId ? {
        date: obj.date, accountId: obj.accountId, amount: obj.amount,
        reason: 'Rút vốn — ' + M._capName(obj.memberId), note: obj.code + ' · ' + obj.reason,
      } : null);

      PW.logActivity(isNew ? 'create' : 'update', 'capital', obj.code,
        'rút vốn ' + M._capName(obj.memberId) + ' · ' + U.money(obj.amount));
      PW.save(); C.closeModal(); App.refresh(); U.toast('Đã lưu');
    }, 'primary')],
  });
};

/* =====================================================================
   THẺ 4 — PHÂN CHIA LỢI NHUẬN
   ===================================================================== */
M._capProfitTab = function () {
  const wrap = U.el('div', { class: 'card' });
  const listHost = U.el('div');
  wrap.appendChild(U.el('div', { class: 'card-title' }, '💰 Phân chia lợi nhuận'));
  wrap.appendChild(U.el('p', { class: 'section-sub' },
    'Chốt lợi nhuận một kỳ rồi chia cho các thành viên. Mặc định chia <b>theo tỷ lệ vốn góp</b>, '
    + 'nhưng sửa được nếu hai bên thỏa thuận khác (vd người trực tiếp vận hành ăn thêm phần công).'));
  wrap.appendChild(U.el('div', { class: 'toolbar' }, [
    U.el('div', { class: 'spacer' }),
    C.btn('+ Lập phiếu chia lợi nhuận', () => M.capitalProfitForm(), 'primary'),
  ]));
  wrap.appendChild(listHost);

  function draw() {
    const rows = (PW.data.profitShares || []).slice().sort((a, b) => (b.date + b.code).localeCompare(a.date + a.code));
    listHost.innerHTML = '';
    listHost.appendChild(C.table(rows, [
      { label: 'Ngày', render: ps => U.date(ps.date) },
      { label: 'Số CT', render: ps => U.esc(ps.code) },
      { label: 'Kỳ', render: ps => U.esc(ps.label || '') },
      { label: 'Lợi nhuận chia', num: true, render: ps => '<b>' + U.money(ps.profit) + '</b>' },
      { label: 'Chi tiết chia', render: ps => (ps.lines || []).map(l =>
          U.esc(M._capName(l.memberId)) + ': ' + U.money(l.amount) + (l.paid ? ' <span class="text-green">✔</span>' : '')
        ).join('<br>') },
      { label: 'Đã trả', num: true, render: ps => {
          const tong = (ps.lines || []).reduce((s, l) => s + (Number(l.amount) || 0), 0);
          const tra = (ps.lines || []).filter(l => l.paid).reduce((s, l) => s + (Number(l.amount) || 0), 0);
          return tra >= tong && tong > 0
            ? '<span class="text-green">đủ</span>'
            : '<span class="text-red">' + U.money(tong - tra) + '</span>';
        } },
      { label: '', render: ps => C.actions([
          { label: '🖨 In', onClick: () => M.capitalProfitMinutes(ps) },
          { label: 'Sửa', onClick: () => M.capitalProfitForm(ps) },
          { label: 'Xóa', cls: 'danger', onClick: () => {
              if (!U.confirm('Xóa phiếu chia lợi nhuận ' + ps.code + '?\n\nCác phiếu chi quỹ gắn kèm cũng bị xóa.')) return;
              M._capCashDrop(ps.id);
              PW.data.profitShares = PW.data.profitShares.filter(x => x.id !== ps.id);
              PW.logActivity('delete', 'capital', ps.code, 'chia lợi nhuận ' + U.money(ps.profit));
              PW.save(); App.refresh(); U.toast('Đã xóa');
            } },
        ]) },
    ], { empty: 'Chưa có lần chia lợi nhuận nào.' }));
  }
  draw();
  return wrap;
};

M.capitalProfitForm = function (ps) {
  const isNew = !ps;
  const src = ps;
  const S = M.capitalSummary();
  const p = U.periodPreset('lastMonth');
  ps = ps ? JSON.parse(JSON.stringify(ps)) : {
    code: PW.nextCode('PL'), date: U.today(), label: p.label + ' (' + U.date(p.from) + ' – ' + U.date(p.to) + ')',
    from: p.from, to: p.to, profit: 0, mode: 'prorata', lines: [], note: '',
  };
  if (!ps.lines || !ps.lines.length) ps.lines = S.rows.map(r => ({ memberId: r.m.id, percent: r.percent, amount: 0, paid: false }));

  const codeI = C.input({ value: ps.code });
  const dateI = C.input({ type: 'date', value: ps.date });
  const labelI = C.input({ value: ps.label || '', style: 'width:100%' });
  const fromI = C.input({ type: 'date', value: ps.from || '' });
  const toI = C.input({ type: 'date', value: ps.to || '' });
  const profitI = C.money({ value: ps.profit, style: 'text-align:right;font-weight:700' });
  const accI = C.select(M._capAccOpts('— Chưa chi trả —'), ps.accountId || '');

  const lineBody = U.el('tbody');
  const sumCell = U.el('span', { style: 'font-weight:700' });
  const pctCell = U.el('span');

  // Chia theo % rồi làm tròn thì tổng hay lệch vài đồng -> dồn phần lẻ vào dòng
  // cuối để tổng chia luôn bằng đúng lợi nhuận, khỏi báo "lệch" vô cớ khi lưu.
  function chiaTheoTyLe(total) {
    let con = Math.round(total);
    ps.lines.forEach((l, i) => {
      if (i === ps.lines.length - 1) { l.amount = con; return; }
      l.amount = Math.round(total * (Number(l.percent) || 0) / 100);
      con -= l.amount;
    });
  }
  function recalc(fromPercent) {
    const total = profitI.soTien();
    if (fromPercent) chiaTheoTyLe(total);
    const sum = ps.lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
    const sumPct = ps.lines.reduce((s, l) => s + (Number(l.percent) || 0), 0);
    sumCell.textContent = U.money(sum) + ' đ';
    sumCell.className = Math.abs(sum - total) < 1 ? 'text-green' : 'text-red';
    pctCell.innerHTML = sumPct.toFixed(2) + '%' + (Math.abs(sumPct - 100) > 0.01 ? ' <span class="text-red">(phải bằng 100%)</span>' : '');
  }
  function drawLines() {
    lineBody.innerHTML = '';
    ps.lines.forEach(l => {
      const pctI = U.el('input', { type: 'number', value: Number(l.percent || 0).toFixed(2), step: '0.01', min: 0, style: 'text-align:right' });
      const amtI = C.money({ value: l.amount || 0, style: 'text-align:right' });
      const paidI = U.el('input', { type: 'checkbox' });
      if (l.paid) paidI.checked = true;
      pctI.addEventListener('input', () => {
        l.percent = Number(pctI.value) || 0;
        l.amount = Math.round(profitI.soTien() * l.percent / 100);
        amtI.datSoTien(l.amount); recalc(false);
      });
      amtI.addEventListener('input', () => { l.amount = amtI.soTien(); recalc(false); });
      paidI.addEventListener('change', () => { l.paid = paidI.checked; });
      const r = S.rows.find(x => x.m.id === l.memberId);
      lineBody.appendChild(U.el('tr', null, [
        U.el('td', null, [
          U.el('div', { style: 'font-weight:600' }, M._capName(l.memberId)),
          U.el('div', { class: 'text-muted', style: 'font-size:11px' }, 'Vốn ròng ' + U.money(r ? r.net : 0) + ' đ · tỷ lệ gốc ' + (r ? r.percent.toFixed(2) : '0') + '%'),
        ]),
        U.el('td', { style: 'width:110px' }, pctI),
        U.el('td', { style: 'width:150px' }, amtI),
        U.el('td', { class: 'center', style: 'width:80px' }, paidI),
      ]));
    });
  }
  profitI.addEventListener('input', () => { recalc(true); drawLines(); });

  const tbl = U.el('table', { class: 'items-tbl' });
  tbl.appendChild(U.el('thead', null, U.el('tr', null, [
    U.el('th', null, 'Thành viên'), U.el('th', null, 'Tỷ lệ %'),
    U.el('th', null, 'Được chia (đ)'), U.el('th', { class: 'center' }, 'Đã trả'),
  ])));
  tbl.appendChild(lineBody);

  recalc(isNew);
  drawLines();

  const body = U.el('div', null, [
    U.el('div', { class: 'form-grid' }, [
      C.field('Số chứng từ', codeI),
      C.field('Ngày lập', dateI, { required: true }),
      C.field('Kỳ chia (ghi trên biên bản)', labelI, { full: true }),
      C.field('Từ ngày', fromI),
      C.field('Đến ngày', toI),
      C.field('Lợi nhuận đem chia (đ)', U.el('div', null, [profitI, C.moneyWords(profitI)]), { required: true }),
      C.field('Chi trả từ quỹ (tạo phiếu chi cho dòng đã trả)', accI),
    ]),
    U.el('div', { class: 'pill-row mt8' }, [
      C.btn('📈 Lấy lợi nhuận từ sổ sách', () => {
        if (!fromI.value || !toI.value) return U.toast('Chọn từ ngày / đến ngày trước', 'error');
        const v = M.capitalNetProfit(fromI.value, toI.value);
        profitI.datSoTien(Math.max(0, v));
        profitI.dispatchEvent(new Event('input'));   // để dòng "Bằng chữ" cập nhật theo
        recalc(true); drawLines();
        U.toast('Lợi nhuận thuần kỳ này: ' + U.money(v) + ' đ' + (v < 0 ? ' (đang lỗ)' : ''), v < 0 ? 'error' : 'success');
      }, 'sm'),
      C.btn('⚖️ Chia lại theo tỷ lệ vốn góp', () => {
        ps.lines = S.rows.map(r => ({ memberId: r.m.id, percent: r.percent, amount: 0, paid: false }));
        chiaTheoTyLe(profitI.soTien());
        recalc(false); drawLines();
      }, 'sm'),
    ]),
    U.el('div', { class: 'table-wrap mt8' }, tbl),
    U.el('div', { class: 'mt8', style: 'display:flex;gap:18px;justify-content:flex-end;align-items:center' }, [
      U.el('span', { class: 'text-muted' }, 'Tổng tỷ lệ: '), pctCell,
      U.el('span', { class: 'text-muted' }, 'Tổng chia: '), sumCell,
    ]),
  ]);

  C.modal({
    title: (isNew ? '💰 Lập phiếu chia lợi nhuận' : '✏️ Sửa phiếu ' + ps.code), wide: true, body,
    footer: [C.btn('Hủy', C.closeModal), C.btn('Lưu', () => {
      const obj = {
        id: isNew ? PW.uid() : src.id,
        code: codeI.value.trim() || ps.code, date: dateI.value, label: labelI.value.trim(),
        from: fromI.value || '', to: toI.value || '', profit: profitI.soTien(),
        accountId: accI.value || '',
        lines: ps.lines.map(l => ({ memberId: l.memberId, percent: Number(l.percent) || 0, amount: Number(l.amount) || 0, paid: !!l.paid })),
        note: ps.note || '',
      };
      if (!obj.date) return U.toast('Chọn ngày lập', 'error');
      if (!(obj.profit > 0)) return U.toast('Lợi nhuận đem chia phải lớn hơn 0', 'error');
      const sum = obj.lines.reduce((s, l) => s + l.amount, 0);
      if (Math.abs(sum - obj.profit) >= 1
        && !U.confirm('Tổng chia (' + U.money(sum) + ' đ) KHÁC lợi nhuận đem chia (' + U.money(obj.profit) + ' đ).\n\nVẫn lưu?')) return;

      if (isNew) PW.data.profitShares.push(obj);
      else Object.assign(src, obj);

      // Mỗi dòng "đã trả" sinh một phiếu chi riêng; bỏ tick thì phiếu chi bị xóa.
      obj.lines.forEach(l => {
        M._capCashSync('chi', obj.id + ':' + l.memberId, (l.paid && obj.accountId) ? {
          date: obj.date, accountId: obj.accountId, amount: l.amount,
          reason: 'Chia lợi nhuận — ' + M._capName(l.memberId), note: obj.code + ' · ' + (obj.label || ''),
        } : null);
      });

      PW.logActivity(isNew ? 'create' : 'update', 'capital', obj.code, 'chia lợi nhuận ' + U.money(obj.profit));
      PW.save(); C.closeModal(); App.refresh(); U.toast('Đã lưu phiếu chia lợi nhuận');
    }, 'primary')],
  });
};

/* =====================================================================
   THẺ 5 — THÀNH VIÊN
   ===================================================================== */
M._capMemberTab = function () {
  const wrap = U.el('div', { class: 'card' });
  const listHost = U.el('div');
  wrap.appendChild(U.el('div', { class: 'toolbar' }, [
    U.el('div', { class: 'card-title', style: 'margin:0' }, '👥 Thành viên góp vốn'),
    U.el('div', { class: 'spacer' }),
    C.btn('+ Thêm thành viên', () => M.capitalMemberForm(), 'primary'),
  ]));
  wrap.appendChild(U.el('p', { class: 'section-sub' },
    'Thông tin ở đây in lên biên bản góp vốn, nên khai đúng như trên giấy tờ (CCCD, địa chỉ thường trú).'));
  wrap.appendChild(listHost);

  function draw() {
    const S = M.capitalSummary();
    listHost.innerHTML = '';
    listHost.appendChild(C.table(S.rows, [
      { label: 'Mã', render: r => U.esc(r.m.code || '') },
      { label: 'Họ tên', render: r => '<b>' + U.esc(r.m.name) + '</b>'
          + (r.m.title ? '<div class="text-muted" style="font-size:11px">' + U.esc(r.m.title) + '</div>' : '') },
      { label: 'CCCD', render: r => U.esc(r.m.idNo || '') },
      { label: 'Điện thoại', render: r => U.esc(r.m.phone || '') },
      { label: 'Địa chỉ', render: r => U.esc(r.m.address || '') },
      { label: 'Vốn ròng', num: true, render: r => '<b>' + U.money(r.net) + '</b>' },
      { label: 'Tỷ lệ', num: true, render: r => r.percent.toFixed(2) + '%' },
      { label: '', render: r => C.actions([
          { label: 'Sửa', onClick: () => M.capitalMemberForm(r.m) },
          { label: 'Xóa', cls: 'danger', onClick: () => {
              if (r.gop || r.rut || r.duocChia)
                return U.toast('Thành viên này đã có phát sinh vốn / lợi nhuận — xóa các chứng từ đó trước.', 'error');
              if (!U.confirm('Xóa thành viên ' + r.m.name + '?')) return;
              PW.data.capitalMembers = PW.data.capitalMembers.filter(x => x.id !== r.m.id);
              PW.logActivity('delete', 'capital', r.m.code || r.m.name, '');
              PW.save(); App.refresh(); U.toast('Đã xóa');
            } },
        ]) },
    ], { empty: 'Chưa có thành viên' }));
  }
  draw();
  return wrap;
};

M.capitalMemberForm = function (m) {
  const isNew = !m;
  const src = m;
  m = m ? JSON.parse(JSON.stringify(m)) : { code: PW.nextCode('TV'), name: '', phone: '', address: '', idNo: '', title: 'Thành viên góp vốn', note: '' };

  const codeI = C.input({ value: m.code });
  const nameI = C.input({ value: m.name || '', style: 'width:100%' });
  const titleI = C.input({ value: m.title || '', placeholder: 'VD: Thành viên sáng lập / Giám đốc', style: 'width:100%' });
  const idI = C.input({ value: m.idNo || '', placeholder: 'Số CCCD', style: 'width:100%' });
  const phoneI = C.input({ value: m.phone || '', style: 'width:100%' });
  const addrI = C.input({ value: m.address || '', placeholder: 'Địa chỉ thường trú', style: 'width:100%' });
  const noteI = C.input({ value: m.note || '', style: 'width:100%' });

  C.modal({
    title: isNew ? '👤 Thêm thành viên góp vốn' : '✏️ Sửa ' + m.name, wide: true,
    body: U.el('div', { class: 'form-grid' }, [
      C.field('Mã', codeI),
      C.field('Chức danh', titleI),
      C.field('Họ và tên', nameI, { full: true, required: true }),
      C.field('Số CCCD', idI),
      C.field('Điện thoại', phoneI),
      C.field('Địa chỉ thường trú', addrI, { full: true }),
      C.field('Ghi chú', noteI, { full: true }),
    ]),
    footer: [C.btn('Hủy', C.closeModal), C.btn('Lưu', () => {
      const obj = {
        id: isNew ? PW.uid() : src.id, code: codeI.value.trim(), name: nameI.value.trim(),
        title: titleI.value.trim(), idNo: idI.value.trim(), phone: phoneI.value.trim(),
        address: addrI.value.trim(), note: noteI.value.trim(),
      };
      if (!obj.name) return U.toast('Nhập họ tên', 'error');
      if (isNew) PW.data.capitalMembers.push(obj); else Object.assign(src, obj);
      PW.logActivity(isNew ? 'create' : 'update', 'capital', obj.code + ' ' + obj.name, '');
      PW.save(); C.closeModal(); App.refresh(); U.toast('Đã lưu');
    }, 'primary')],
  });
};

/* =====================================================================
   IN BIÊN BẢN GÓP VỐN & THỎA THUẬN TỶ LỆ SỞ HỮU
   Đây là văn bản làm cho khoản góp VÔ HÌNH (ý tưởng, kinh nghiệm) có căn
   cứ: Luật Doanh nghiệp 2020 Điều 36 yêu cầu tài sản góp vốn không phải
   tiền phải được các thành viên định giá và nhất trí bằng văn bản.
   ===================================================================== */
M._capPrintCSS = `
@page{size:A4 portrait;margin:13mm}
*{box-sizing:border-box}
body{font-family:'Times New Roman',Georgia,serif;color:#1a1a1a;margin:0;padding:18px;background:#fff;font-size:13.5px;line-height:1.6}
.head{display:flex;align-items:center;gap:14px;border-bottom:2px solid #7cb342;padding-bottom:10px}
.head img{height:46px;width:auto}
.brand{font-weight:700;font-size:17px;color:#5a8e2e;line-height:1.25;font-family:'Segoe UI',Arial,sans-serif}
.brand small{display:block;font-weight:400;font-size:11px;color:#666;letter-spacing:.5px}
.head .right{margin-left:auto;text-align:right;font-size:11px;color:#666;line-height:1.6;font-family:'Segoe UI',Arial,sans-serif}
h2{text-align:center;margin:18px 0 2px;font-size:19px;letter-spacing:.4px;text-transform:uppercase}
.sub{text-align:center;color:#555;font-size:12.5px;font-style:italic;margin-bottom:10px}
.intro{margin:12px 0 6px;text-align:justify}
.basis{margin:4px 0 0 0;padding-left:22px}
.basis li{margin:2px 0}
.sec-h{margin-top:16px;font-weight:700;font-size:14px;color:#5a8e2e;
       border-left:4px solid #7cb342;padding-left:8px;font-family:'Segoe UI',Arial,sans-serif}
.party{border:1px solid #d8d8d8;border-left:4px solid #7cb342;border-radius:6px;
       padding:7px 12px;margin-top:8px;background:#fafcf7;line-height:1.6}
.party .pt{font-weight:700;color:#5a8e2e}
.party .lb{color:#666}
table{width:100%;border-collapse:collapse;margin-top:8px}
th,td{border:1px solid #c8c8c8;padding:5px 8px;font-size:12.5px;vertical-align:top}
th{background:#eef5e4;font-weight:700;text-align:center}
tfoot td{background:#f4f4f4;font-weight:700}
.c{text-align:center} .r{text-align:right;white-space:nowrap}
.net{margin-top:12px;text-align:right;font-size:15px;font-weight:700;color:#5a8e2e;
     border:2px solid #7cb342;border-radius:6px;padding:9px 14px;background:#f5faee}
.words{margin-top:5px;text-align:right;font-style:italic;color:#555;font-size:12.5px}
.terms{margin:6px 0 0 0;padding-left:22px;text-align:justify}
.terms li{margin:4px 0}
.warn{margin-top:8px;border:1px solid #ffcc80;background:#fff8e1;border-radius:6px;padding:8px 12px;text-align:justify}
.sign{display:flex;flex-wrap:wrap;justify-content:space-around;margin-top:26px;text-align:center;font-size:13px;gap:10px}
.sign>div{min-width:40%;flex:1}
.sign b{display:block;letter-spacing:.3px}
.sign i{color:#666;font-size:11.5px}
.sign .space{height:74px}
.foot{margin-top:20px;border-top:1px solid #e2e2e2;padding-top:6px;font-size:10.5px;color:#888;text-align:center;font-family:'Segoe UI',Arial,sans-serif}
.btnbar{text-align:center;margin-bottom:14px}
.btnbar button{padding:8px 18px;font-size:14px;border:0;border-radius:6px;background:#7cb342;color:#fff;cursor:pointer;font-family:'Segoe UI',Arial,sans-serif}
tr{break-inside:avoid;page-break-inside:avoid}
thead{display:table-header-group}
tfoot{display:table-row-group}
.sec-h,.net{break-after:avoid;page-break-after:avoid}
.sign,.party,.warn{break-inside:avoid;page-break-inside:avoid}
@media print{.btnbar{display:none}body{padding:0}}
`;

// Mở cửa sổ in với nội dung thân văn bản đã dựng sẵn.
// huong: 'portrait' (mặc định) | 'landscape' — bảng nhiều cột phải nằm ngang,
// in dọc thì các cột bị bóp lại không đọc nổi.
M._capOpenPrint = function (title, inner, huong) {
  const css = M._capPrintCSS + (huong === 'landscape'
    ? '@page{size:A4 landscape;margin:10mm}' : '');
  const html = '<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>' + U.esc(title) + '</title>'
    + '<style>' + css + '</style></head><body>'
    + '<div class="btnbar"><button onclick="window.print()">🖨️ In / Lưu PDF</button></div>'
    + inner
    + '<script>window.onload=function(){window.print();}<\/script></body></html>';
  const w = window.open('', '_blank');
  if (!w) return U.toast('Trình duyệt chặn cửa sổ in. Hãy cho phép pop-up.', 'error');
  w.document.write(html); w.document.close();
};

M._capHead = function (co, soCT) {
  const logo = (typeof M._logoUrl === 'function') ? M._logoUrl() : '';
  return '<div class="head">'
    + (logo ? '<img src="' + logo + '" alt="Logo">' : '')
    + '<div class="brand">' + U.esc(co.name) + '<small>' + U.esc(co.address || '') + '</small></div>'
    + '<div class="right">Số: ' + U.esc(soCT) + '<br>Ngày lập: ' + U.date(U.today()) + '</div>'
    + '</div>';
};

// Khối thông tin một thành viên (dùng cho cả hai loại biên bản).
M._capPartyBlock = function (m, idx) {
  const line = (lb, v) => v ? '<div><span class="lb">' + lb + ':</span> ' + U.esc(v) + '</div>' : '';
  return '<div class="party">'
    + '<div class="pt">THÀNH VIÊN ' + (idx + 1) + ': ' + U.esc(m.name || '') + '</div>'
    + line('Chức danh', m.title) + line('Số CCCD', m.idNo)
    + line('Địa chỉ thường trú', m.address) + line('Điện thoại', m.phone)
    + (!m.idNo && !m.address ? '<div><span class="lb">Số CCCD:</span> ……………………  <span class="lb">Địa chỉ:</span> ……………………………………</div>' : '')
    + '</div>';
};

// Các khối ký tên — xếp đều hàng, mỗi thành viên một khối.
M._capSignBlocks = function (members) {
  return '<div class="sign">' + members.map(m =>
    '<div><b>THÀNH VIÊN GÓP VỐN</b><i>(Ký và ghi rõ họ tên)</i><div class="space"></div>' + U.esc(m.name || '') + '</div>'
  ).join('') + '</div>';
};

M.capitalMinutes = function () {
  const S = M.capitalSummary();
  if (!S.rows.length) return U.toast('Chưa có thành viên góp vốn', 'error');
  const co = M.company();
  const members = S.rows.map(r => r.m);
  const today = U.today().split('-');
  const contribs = (PW.data.capitalContributions || []).slice()
    .sort((a, b) => (a.date + a.code).localeCompare(b.date + b.code));
  const coHienVat = contribs.some(c => c.kind !== 'tien');
  const vh = S.byKind.tsvh || 0;

  const ctRows = contribs.map((c, i) => {
    const k = M.capitalKind(c.kind);
    return '<tr>'
      + '<td class="c">' + (i + 1) + '</td>'
      + '<td>' + U.esc(M._capName(c.memberId)) + '</td>'
      + '<td>' + U.esc(k.t) + '</td>'
      + '<td>' + U.esc(c.assetName || '') + (c.note ? '<br><i style="color:#666;font-size:11px">' + U.esc(c.note) + '</i>' : '') + '</td>'
      + '<td class="c">' + (c.qty ? U.num(c.qty) + ' ' + U.esc(c.unit || '') : '') + '</td>'
      + '<td class="c">' + U.date(c.date) + '</td>'
      + '<td class="r">' + U.money(c.amount) + '</td>'
      + '</tr>';
  }).join('');

  const tongRows = S.rows.map(r => '<tr>'
    + '<td>' + U.esc(r.m.name) + '</td>'
    + '<td class="r">' + U.money(r.gop) + '</td>'
    + '<td class="r">' + (r.rut ? U.money(r.rut) : '—') + '</td>'
    + '<td class="r"><b>' + U.money(r.net) + '</b></td>'
    + '<td class="r"><b>' + r.percent.toFixed(2) + '%</b></td>'
    + '</tr>').join('');

  const inner = M._capHead(co, 'GV/' + today[0])
    + '<h2>Biên bản góp vốn và thỏa thuận tỷ lệ sở hữu</h2>'
    + '<div class="sub">Dự án: ' + U.esc(co.name) + '</div>'
    + '<div class="intro">Hôm nay, ngày ' + today[2] + ' tháng ' + today[1] + ' năm ' + today[0] + ', tại '
      + U.esc(co.address || '……………………………………') + ', các thành viên có tên dưới đây đã cùng nhau họp và '
      + '<b>thống nhất lập biên bản</b> ghi nhận phần vốn góp vào dự án cùng tỷ lệ sở hữu tương ứng.</div>'
    + '<div><b>Căn cứ:</b></div>'
    + '<ul class="basis">'
      + '<li>Bộ luật Dân sự số 91/2015/QH13;</li>'
      + '<li>Luật Doanh nghiệp số 59/2020/QH14 — Điều 34 (tài sản góp vốn) và Điều 36 (định giá tài sản góp vốn);</li>'
      + '<li>Sự tự nguyện thỏa thuận và nhất trí của toàn bộ các thành viên góp vốn.</li>'
    + '</ul>'

    + '<div class="sec-h">I. CÁC THÀNH VIÊN GÓP VỐN</div>'
    + members.map((m, i) => M._capPartyBlock(m, i)).join('')

    + '<div class="sec-h">II. CHI TIẾT TÀI SẢN GÓP VỐN</div>'
    + '<table><thead><tr>'
      + '<th style="width:34px">TT</th><th style="width:120px">Thành viên</th>'
      + '<th style="width:150px">Hình thức góp</th><th>Tài sản góp / diễn giải</th>'
      + '<th style="width:70px">Số lượng</th><th style="width:76px">Ngày góp</th>'
      + '<th class="r" style="width:110px">Giá trị (đ)</th>'
    + '</tr></thead><tbody>' + (ctRows || '<tr><td colspan="7" class="c"><i>Chưa ghi khoản góp vốn nào</i></td></tr>') + '</tbody>'
    + '<tfoot><tr><td colspan="6">TỔNG GIÁ TRỊ TÀI SẢN GÓP VỐN</td>'
      + '<td class="r">' + U.money(S.totalGop) + '</td></tr></tfoot></table>'

    + '<div class="sec-h">III. TỔNG HỢP VỐN GÓP VÀ TỶ LỆ SỞ HỮU</div>'
    + '<table><thead><tr><th>Thành viên</th><th class="r" style="width:120px">Tổng đã góp</th>'
      + '<th class="r" style="width:110px">Đã rút</th><th class="r" style="width:120px">Vốn ròng</th>'
      + '<th class="r" style="width:100px">Tỷ lệ sở hữu</th></tr></thead>'
    + '<tbody>' + tongRows + '</tbody>'
    + '<tfoot><tr><td>CỘNG</td><td class="r">' + U.money(S.totalGop) + '</td>'
      + '<td class="r">' + (S.totalRut ? U.money(S.totalRut) : '—') + '</td>'
      + '<td class="r">' + U.money(S.totalNet) + '</td><td class="r">100,00%</td></tr></tfoot></table>'
    + '<div class="net">TỔNG VỐN GÓP CỦA DỰ ÁN: ' + U.money(S.totalNet) + ' đ</div>'
    + '<div class="words">Bằng chữ: ' + U.esc(U.readMoneyVN(S.totalNet)) + '</div>'

    + (coHienVat ? '<div class="sec-h">IV. THỎA THUẬN VỀ ĐỊNH GIÁ TÀI SẢN GÓP VỐN</div>'
      + '<div class="intro">Các thành viên <b>cùng nhất trí</b> định giá toàn bộ tài sản góp vốn không phải là tiền '
      + 'theo đúng giá trị ghi tại Mục II nêu trên. Giá trị này do các thành viên tự nguyện thỏa thuận xác định, '
      + 'không thông qua tổ chức định giá độc lập; các bên cam kết không khiếu nại hay yêu cầu định giá lại về sau.</div>'
      + (vh > 0 ? '<div class="warn">Trong đó, phần góp vốn bằng <b>ý tưởng, kinh nghiệm và know-how</b> được các '
        + 'thành viên thống nhất ghi nhận giá trị <b>' + U.money(vh) + ' đ</b> (' + U.esc(U.readMoneyVN(vh)) + ') '
        + 'và tính vào vốn góp để xác định tỷ lệ sở hữu. Thành viên góp phần vô hình này có trách nhiệm trực tiếp '
        + 'tham gia định hướng, chuyển giao kinh nghiệm và hỗ trợ vận hành dự án trong suốt thời gian hợp tác.</div>' : '')
      : '')

    + '<div class="sec-h">' + (coHienVat ? 'V' : 'IV') + '. NGUYÊN TẮC PHÂN CHIA LỢI NHUẬN VÀ RỦI RO</div>'
    + '<ol class="terms">'
      + '<li>Lợi nhuận của dự án sau khi trừ toàn bộ chi phí hợp lệ được chia cho các thành viên '
        + '<b>theo tỷ lệ sở hữu</b> tại Mục III.</li>'
      + '<li>Trường hợp dự án phát sinh lỗ, các thành viên cùng chịu theo đúng tỷ lệ sở hữu nêu trên.</li>'
      + '<li>Kỳ chốt và chia lợi nhuận: ………………………… (tháng / quý / năm). Việc chia lợi nhuận mỗi kỳ được lập '
        + 'thành biên bản riêng có chữ ký của các thành viên.</li>'
      + '<li>Thành viên muốn rút vốn phải thông báo trước ………… ngày. Sau khi rút, tỷ lệ sở hữu của các thành viên '
        + 'được tính lại theo phần vốn thực còn lại trong dự án.</li>'
      + '<li>Việc tăng vốn, kết nạp thành viên mới hoặc chuyển nhượng phần vốn góp cho người ngoài phải được '
        + '<b>toàn bộ thành viên đồng ý bằng văn bản</b>.</li>'
      + '<li>Tài sản đã góp vào dự án thuộc sở hữu chung của các thành viên theo tỷ lệ; không thành viên nào được '
        + 'tự ý mang ra khỏi dự án, thế chấp hay định đoạt khi chưa có sự đồng ý của các thành viên còn lại.</li>'
    + '</ol>'

    + '<div class="sec-h">' + (coHienVat ? 'VI' : 'V') + '. ĐIỀU KHOẢN CHUNG</div>'
    + '<div class="intro">Biên bản này được lập thành <b>' + members.length + ' (' + U.esc(U.readMoneyVN(members.length).replace(' đồng chẵn.', '').toLowerCase()) + ') bản</b> '
      + 'có giá trị pháp lý như nhau, mỗi thành viên giữ 01 (một) bản, và có hiệu lực kể từ ngày ký. '
      + 'Mọi thay đổi phải được lập thành văn bản có chữ ký của toàn bộ các thành viên.</div>'

    + M._capSignBlocks(members)
    + '<div class="foot">Biên bản do phần mềm kế toán ' + U.esc(co.name) + ' lập ngày ' + U.date(U.today()) + '</div>';

  M._capOpenPrint('Bien ban gop von', inner);
};

M.capitalProfitMinutes = function (ps) {
  const S = M.capitalSummary();
  const co = M.company();
  const members = (ps.lines || []).map(l => M.capitalMember(l.memberId)).filter(Boolean);
  const today = U.today().split('-');
  const tongChia = (ps.lines || []).reduce((s, l) => s + (Number(l.amount) || 0), 0);

  const rows = (ps.lines || []).map((l, i) => '<tr>'
    + '<td class="c">' + (i + 1) + '</td>'
    + '<td>' + U.esc(M._capName(l.memberId)) + '</td>'
    + '<td class="r">' + Number(l.percent || 0).toFixed(2) + '%</td>'
    + '<td class="r"><b>' + U.money(l.amount) + '</b></td>'
    + '<td class="c">' + (l.paid ? 'Đã nhận' : 'Chưa nhận') + '</td>'
    + '</tr>').join('');

  const inner = M._capHead(co, U.esc(ps.code))
    + '<h2>Biên bản phân chia lợi nhuận</h2>'
    + '<div class="sub">Kỳ: ' + U.esc(ps.label || ((ps.from ? U.date(ps.from) : '…') + ' – ' + (ps.to ? U.date(ps.to) : '…'))) + '</div>'
    + '<div class="intro">Hôm nay, ngày ' + today[2] + ' tháng ' + today[1] + ' năm ' + today[0] + ', tại '
      + U.esc(co.address || '……………………………………') + ', các thành viên góp vốn của dự án '
      + '<b>' + U.esc(co.name) + '</b> cùng họp và thống nhất phân chia lợi nhuận của kỳ nêu trên như sau.</div>'

    + '<div class="sec-h">I. KẾT QUẢ KINH DOANH TRONG KỲ</div>'
    + '<div class="net">LỢI NHUẬN ĐEM CHIA: ' + U.money(ps.profit) + ' đ</div>'
    + '<div class="words">Bằng chữ: ' + U.esc(U.readMoneyVN(ps.profit)) + '</div>'

    + '<div class="sec-h">II. PHÂN CHIA CHO CÁC THÀNH VIÊN</div>'
    + '<table><thead><tr><th style="width:34px">TT</th><th>Thành viên</th>'
      + '<th class="r" style="width:90px">Tỷ lệ</th><th class="r" style="width:130px">Được chia (đ)</th>'
      + '<th class="c" style="width:100px">Tình trạng</th></tr></thead>'
    + '<tbody>' + (rows || '<tr><td colspan="5" class="c"><i>Chưa có dòng chia</i></td></tr>') + '</tbody>'
    + '<tfoot><tr><td colspan="3">CỘNG</td><td class="r">' + U.money(tongChia) + '</td><td></td></tr></tfoot></table>'
    + (Math.abs(tongChia - Number(ps.profit || 0)) >= 1
      ? '<div class="warn">Tổng số chia (' + U.money(tongChia) + ' đ) khác lợi nhuận đem chia ('
        + U.money(ps.profit) + ' đ). Phần chênh lệch ' + U.money(Number(ps.profit || 0) - tongChia)
        + ' đ được giữ lại trong dự án theo thỏa thuận của các thành viên.</div>'
      : '')

    + '<div class="sec-h">III. XÁC NHẬN CỦA CÁC THÀNH VIÊN</div>'
    + '<div class="intro">Các thành viên đã cùng kiểm tra số liệu và <b>thống nhất xác nhận</b> kết quả phân chia '
      + 'lợi nhuận nêu trên là đúng, phù hợp với tỷ lệ sở hữu đã thỏa thuận. Biên bản được lập thành '
      + members.length + ' bản, mỗi thành viên giữ 01 bản.</div>'

    + M._capSignBlocks(members.length ? members : S.rows.map(r => r.m))
    + '<div class="foot">Biên bản do phần mềm kế toán ' + U.esc(co.name) + ' lập ngày ' + U.date(U.today()) + '</div>';

  M._capOpenPrint('Bien ban phan chia loi nhuan ' + (ps.code || ''), inner);
};

/* =====================================================================
   XUẤT EXCEL — cơ cấu vốn + chi tiết các khoản góp
   Dựng thẳng bằng ExcelJS (không mượn M.exportListExcel, hàm đó dành cho
   danh sách nên tự chèn tiêu đề bảng ở đầu, phá bố cục văn bản).
   ===================================================================== */
M.capitalExcel = async function () {
  const S = M.capitalSummary();
  if (!S.rows.length) return U.toast('Chưa có thành viên góp vốn', 'error');
  const co = M.company();
  await M._ensureExcelJsLib();

  const kinds = M.CAPITAL_KINDS.filter(k => S.byKind[k.v]);
  // Thành viên | <từng hình thức góp có thật> | Tổng góp | Đã rút | Vốn ròng | Tỷ lệ
  const cols = [{ t: 'Thành viên', w: 26 }]
    .concat(kinds.map(k => ({ t: k.t, w: 18, money: true })))
    .concat([
      { t: 'Tổng đã góp', w: 17, money: true },
      { t: 'Đã rút', w: 15, money: true },
      { t: 'Vốn ròng', w: 17, money: true },
      { t: 'Tỷ lệ sở hữu', w: 13, pct: true },
    ]);
  const N = cols.length, LAST = String.fromCharCode(64 + N);

  const wb = new window.ExcelJS.Workbook();
  const ws = wb.addWorksheet('Co cau von', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0,
                 margins: { left: 0.5, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } },
  });
  ws.columns = cols.map(c => ({ width: c.w }));

  let r = 0;
  const merge = (text, opt) => {
    r++; ws.mergeCells('A' + r + ':' + LAST + r);
    const c = ws.getCell('A' + r); c.value = text;
    c.font = Object.assign({ name: 'Times New Roman', size: 11 }, (opt || {}).font);
    c.alignment = Object.assign({ vertical: 'middle', wrapText: true }, (opt || {}).align);
    if ((opt || {}).h) ws.getRow(r).height = opt.h;
    return c;
  };
  const trong = () => { r++; };
  const vien = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

  merge(co.name, { font: { bold: true, size: 12 }, align: { horizontal: 'left' } });
  if (co.address) merge('Địa chỉ: ' + co.address, { font: { size: 10, italic: true }, align: { horizontal: 'left' } });
  trong();
  merge('CƠ CẤU VỐN GÓP VÀ TỶ LỆ SỞ HỮU', { font: { bold: true, size: 15 }, align: { horizontal: 'center' }, h: 24 });
  merge('Lập ngày: ' + U.date(U.today()), { font: { size: 10, italic: true }, align: { horizontal: 'center' } });
  trong();

  // ----- Bảng tổng hợp -----
  const hdrRow = (titles) => {
    r++;
    const row = ws.getRow(r);
    titles.forEach((t, k) => {
      const cell = row.getCell(k + 1);
      cell.value = t;
      cell.font = { name: 'Times New Roman', size: 11, bold: true };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF5E4' } };
      cell.border = vien;
    });
    row.height = 30;
  };
  const dataRow = (vals, spec, dam) => {
    r++;
    const row = ws.getRow(r);
    vals.forEach((v, k) => {
      const cell = row.getCell(k + 1);
      cell.value = (v === '' || v === null || v === undefined) ? null : v;
      cell.font = { name: 'Times New Roman', size: 11, bold: !!dam };
      cell.border = vien;
      const s = spec[k] || {};
      if (s.money) { cell.numFmt = '#,##0'; cell.alignment = { horizontal: 'right' }; }
      else if (s.pct) { cell.numFmt = '0.00"%"'; cell.alignment = { horizontal: 'right' }; }
      else cell.alignment = { horizontal: 'left', wrapText: true };
    });
  };

  hdrRow(cols.map(c => c.t));
  S.rows.forEach(x => {
    dataRow([x.m.name].concat(kinds.map(k => x.byKind[k.v] || null))
      .concat([x.gop, x.rut || null, x.net, Number(x.percent.toFixed(2))]), cols);
  });
  dataRow(['CỘNG'].concat(kinds.map(k => S.byKind[k.v] || null))
    .concat([S.totalGop, S.totalRut || null, S.totalNet, 100]), cols, true);

  trong();
  merge('Tổng vốn góp của dự án: ' + U.money(S.totalNet) + ' đ — bằng chữ: ' + U.readMoneyVN(S.totalNet),
        { font: { bold: true, size: 11 }, align: { horizontal: 'left' }, h: 20 });
  const vh = S.byKind.tsvh || 0;
  if (vh > 0) merge('Trong đó ' + U.money(vh) + ' đ là tài sản vô hình (ý tưởng, kinh nghiệm) do các thành viên '
    + 'tự thỏa thuận định giá, không phải tiền thật đã vào quỹ.',
    { font: { size: 10, italic: true }, align: { horizontal: 'left' }, h: 26 });
  trong();

  // ----- Chi tiết từng khoản góp -----
  merge('CHI TIẾT CÁC KHOẢN GÓP VỐN', { font: { bold: true, size: 12 }, align: { horizontal: 'left' } });
  const dspec = [{}, {}, {}, {}, {}, {}, { money: true }];
  hdrRow(['Ngày', 'Số CT', 'Thành viên', 'Hình thức góp', 'Tài sản góp / diễn giải', 'Số lượng', 'Giá trị (đ)']);
  const contribs = (PW.data.capitalContributions || []).slice()
    .sort((a, b) => (a.date + a.code).localeCompare(b.date + b.code));
  contribs.forEach(c => dataRow([
    U.date(c.date), c.code || '', M._capName(c.memberId), M.capitalKind(c.kind).t,
    (c.assetName || '') + (c.note ? ' — ' + c.note : ''),
    c.qty ? U.num(c.qty) + ' ' + (c.unit || '') : '', Number(c.amount) || 0,
  ], dspec));
  dataRow(['', '', '', '', 'CỘNG ' + contribs.length + ' khoản', '', S.totalGop], dspec, true);

  // ----- Rút vốn (chỉ in khi có) -----
  const draws = (PW.data.capitalWithdrawals || []).slice().sort((a, b) => (a.date + a.code).localeCompare(b.date + b.code));
  if (draws.length) {
    trong();
    merge('CÁC LẦN RÚT VỐN', { font: { bold: true, size: 12 }, align: { horizontal: 'left' } });
    const wspec = [{}, {}, {}, {}, {}, {}, { money: true }];
    hdrRow(['Ngày', 'Số CT', 'Thành viên', 'Lý do', 'Từ quỹ', '', 'Số tiền (đ)']);
    draws.forEach(w => {
      const a = PW.account(w.accountId);
      dataRow([U.date(w.date), w.code || '', M._capName(w.memberId), w.reason || '', a ? a.name : '', '', Number(w.amount) || 0], wspec);
    });
    dataRow(['', '', '', '', 'CỘNG', '', S.totalRut], wspec, true);
  }

  const buf = await wb.xlsx.writeBuffer();
  M._download(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    'CoCauVonGop-' + U.today() + '.xlsx');
  U.toast('Đã xuất file Excel cơ cấu vốn');
};

/* =====================================================================
   XUẤT DANH SÁCH KHOẢN GÓP VỐN — Excel và In/PDF
   Xuất ĐÚNG những dòng đang hiển thị (đã qua bộ lọc), và in luôn điều kiện
   lọc lên đầu văn bản: cầm tờ giấy lên phải biết nó lọc theo cái gì, nếu
   không người nhận tưởng đó là toàn bộ sổ.
   ===================================================================== */

// Một dòng dữ liệu -> các ô, dùng chung cho cả Excel lẫn bản in.
M._capDongXuat = function (c) {
  const pn = M._capPhieuNhap(c.id);
  const kem = c.accountId ? 'Phiếu thu' : (pn ? pn.code : '');
  return {
    ngay: U.date(c.date),
    ct: c.code || '',
    thanhVien: M._capName(c.memberId),
    hinhThuc: M.capitalKind(c.kind).t,
    dienGiai: (c.assetName || '') + (c.note ? ' — ' + c.note : ''),
    sl: c.qty ? U.num(c.qty) + ' ' + (c.unit || '') : '',
    giaTri: Number(c.amount) || 0,
    kem: kem,
  };
};

M.capitalListExcel = async function (rows, moTa) {
  if (!rows || !rows.length) return U.toast('Không có dòng nào để xuất', 'error');
  const co = M.company();
  await M._ensureExcelJsLib();

  const cols = [
    { t: 'Ngày', w: 12 }, { t: 'Số CT', w: 13 }, { t: 'Thành viên', w: 22 },
    { t: 'Hình thức góp', w: 26 }, { t: 'Tài sản góp / diễn giải', w: 46 },
    { t: 'Số lượng', w: 13 }, { t: 'Giá trị (đ)', w: 17, money: true }, { t: 'Chứng từ kèm', w: 15 },
  ];
  const N = cols.length, LAST = String.fromCharCode(64 + N);

  const wb = new window.ExcelJS.Workbook();
  const ws = wb.addWorksheet('Khoan gop von', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0,
                 margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } },
  });
  ws.columns = cols.map(c => ({ width: c.w }));

  let r = 0;
  const merge = (text, opt) => {
    r++; ws.mergeCells('A' + r + ':' + LAST + r);
    const c = ws.getCell('A' + r); c.value = text;
    c.font = Object.assign({ name: 'Times New Roman', size: 11 }, (opt || {}).font);
    c.alignment = Object.assign({ vertical: 'middle', wrapText: true }, (opt || {}).align);
    if ((opt || {}).h) ws.getRow(r).height = opt.h;
  };
  const vien = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

  merge(co.name, { font: { bold: true, size: 12 }, align: { horizontal: 'left' } });
  if (co.address) merge('Địa chỉ: ' + co.address, { font: { size: 10, italic: true }, align: { horizontal: 'left' } });
  r++;
  merge('DANH SÁCH CÁC KHOẢN GÓP VỐN', { font: { bold: true, size: 15 }, align: { horizontal: 'center' }, h: 24 });
  merge(moTa || '', { font: { size: 10, italic: true }, align: { horizontal: 'center' }, h: 18 });
  merge('Lập ngày: ' + U.date(U.today()), { font: { size: 10, italic: true }, align: { horizontal: 'center' } });
  r++;

  r++;
  const hdr = ws.getRow(r);
  cols.forEach((c, k) => {
    const cell = hdr.getCell(k + 1);
    cell.value = c.t;
    cell.font = { name: 'Times New Roman', size: 11, bold: true };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF5E4' } };
    cell.border = vien;
  });
  hdr.height = 24;

  const dong = (vals, dam) => {
    r++;
    const row = ws.getRow(r);
    vals.forEach((v, k) => {
      const cell = row.getCell(k + 1);
      cell.value = (v === '' || v === null || v === undefined) ? null : v;
      cell.font = { name: 'Times New Roman', size: 11, bold: !!dam };
      cell.border = vien;
      if (cols[k].money) { cell.numFmt = '#,##0'; cell.alignment = { horizontal: 'right' }; }
      else if (k <= 1 || k === 5 || k === 7) cell.alignment = { horizontal: 'center', wrapText: true };
      else cell.alignment = { horizontal: 'left', wrapText: true };
    });
  };

  let tong = 0;
  rows.forEach(c => {
    const d = M._capDongXuat(c);
    tong += d.giaTri;
    dong([d.ngay, d.ct, d.thanhVien, d.hinhThuc, d.dienGiai, d.sl, d.giaTri, d.kem]);
  });
  dong(['', '', '', '', 'CỘNG ' + rows.length + ' khoản', '', tong, ''], true);

  r++;
  merge('Tổng giá trị: ' + U.money(tong) + ' đ — bằng chữ: ' + U.readMoneyVN(tong),
        { font: { bold: true, size: 11 }, align: { horizontal: 'left' }, h: 20 });

  const buf = await wb.xlsx.writeBuffer();
  M._download(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    'KhoanGopVon-' + U.today() + '.xlsx');
  U.toast('Đã xuất ' + rows.length + ' khoản ra Excel');
};

M.capitalListPrint = function (rows, moTa) {
  if (!rows || !rows.length) return U.toast('Không có dòng nào để in', 'error');
  const co = M.company();
  let tong = 0;
  const tr = rows.map((c, i) => {
    const d = M._capDongXuat(c);
    tong += d.giaTri;
    return '<tr>'
      + '<td class="c">' + (i + 1) + '</td>'
      + '<td class="c">' + U.esc(d.ngay) + '</td>'
      + '<td class="c">' + U.esc(d.ct) + '</td>'
      + '<td>' + U.esc(d.thanhVien) + '</td>'
      + '<td>' + U.esc(d.hinhThuc) + '</td>'
      + '<td>' + U.esc(d.dienGiai) + '</td>'
      + '<td class="c">' + U.esc(d.sl) + '</td>'
      + '<td class="r"><b>' + U.money(d.giaTri) + '</b></td>'
      + '<td class="c">' + U.esc(d.kem) + '</td>'
      + '</tr>';
  }).join('');

  const inner = M._capHead(co, 'DSGV/' + U.today().slice(0, 4))
    + '<h2>Danh sách các khoản góp vốn</h2>'
    + '<div class="sub">' + U.esc(moTa || '') + '</div>'
    + '<table style="margin-top:12px"><thead><tr>'
      + '<th style="width:30px">TT</th><th style="width:72px">Ngày</th><th style="width:78px">Số CT</th>'
      + '<th style="width:110px">Thành viên</th><th style="width:140px">Hình thức góp</th>'
      + '<th>Tài sản góp / diễn giải</th><th style="width:70px">Số lượng</th>'
      + '<th class="r" style="width:110px">Giá trị (đ)</th><th style="width:84px">Chứng từ kèm</th>'
    + '</tr></thead><tbody>' + tr + '</tbody>'
    + '<tfoot><tr><td colspan="7">CỘNG ' + rows.length + ' khoản</td>'
      + '<td class="r">' + U.money(tong) + '</td><td></td></tr></tfoot></table>'
    + '<div class="net">TỔNG GIÁ TRỊ GÓP VỐN: ' + U.money(tong) + ' đ</div>'
    + '<div class="words">Bằng chữ: ' + U.esc(U.readMoneyVN(tong)) + '</div>'
    + '<div class="sign">'
      + '<div><b>NGƯỜI LẬP BIỂU</b><i>(Ký, ghi rõ họ tên)</i><div class="space"></div></div>'
      + '<div><b>XÁC NHẬN CỦA CÁC THÀNH VIÊN</b><i>(Ký, ghi rõ họ tên)</i><div class="space"></div></div>'
    + '</div>'
    + '<div class="foot">Danh sách do phần mềm kế toán ' + U.esc(co.name) + ' lập ngày ' + U.date(U.today())
      + ' · Bấm "In / Lưu PDF" rồi chọn máy in là "Save as PDF" nếu muốn file PDF.</div>';

  M._capOpenPrint('Danh sach khoan gop von', inner, 'landscape');
};
