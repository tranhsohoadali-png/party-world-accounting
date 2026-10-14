/* ============================================================
   modules21.js — TÀI SẢN CỐ ĐỊNH (máy móc, thiết bị)

   Vì sao cần: mua máy 150 triệu bằng quỹ, trước đây chỉ ghi được bằng phiếu
   chi -> cả 150 triệu rơi vào chi phí tháng đó, sổ báo lỗ nặng; mà lợi nhuận
   lại là cơ sở chia lãi cho các thành viên góp vốn. Ghi vào đây thì:
     • quỹ tiền giảm đúng (phiếu chi mang cờ isAsset, KHÔNG tính là chi phí)
     • giá trị máy rải đều ra từng tháng theo số năm khấu hao
     • bảng cân đối có dòng "Tài sản cố định" thay vì tiền tự dưng biến mất

   Máy do thành viên GÓP VỐN cũng nằm ở đây (modules19 tự đẩy sang), vì nó
   cũng hao mòn — chỉ khác là không có tiền ra khỏi quỹ.
   ============================================================ */

M.TS_NGUON = [
  { v: 'quy',    t: 'Mua bằng quỹ của dự án' },
  { v: 'gopvon', t: 'Do thành viên góp vốn' },
  { v: 'khac',   t: 'Nguồn khác / được tặng' },
];
M.tsNguon = v => (M.TS_NGUON.find(x => x.v === v) || M.TS_NGUON[2]).t;
M.TS_NAM_MAC_DINH = 5;   // Thông tư 45/2013/TT-BTC: máy móc thiết bị 3–15 năm

/* Đồng bộ phiếu chi khi mua bằng quỹ. Cờ isAsset để PW.expenses() bỏ qua —
   bỏ tiền đổi lấy tài sản không phải là chi phí, phần hao mòn vào chi phí
   dần qua khấu hao. */
M._tsChiSync = function (ref, info) {
  const i = PW.data.payments.findIndex(x => x.assetRef === ref);
  if (!info || !info.accountId || !(Number(info.amount) > 0)) {
    if (i >= 0) PW.data.payments.splice(i, 1);
    return null;
  }
  const base = {
    date: info.date, accountId: info.accountId, supplierId: null,
    amount: Number(info.amount) || 0, reason: 'Mua tài sản cố định — ' + info.ten,
    note: info.code || '', isAsset: true, assetRef: ref,
  };
  if (i >= 0) { Object.assign(PW.data.payments[i], base); return PW.data.payments[i].code; }
  const obj = Object.assign({ id: PW.uid(), code: PW.nextCode('PC') }, base);
  PW.data.payments.push(obj);
  return obj.code;
};
M._tsDrop = function (ref) {
  PW.data.payments = PW.data.payments.filter(x => x.assetRef !== ref);
  PW.data.receipts = PW.data.receipts.filter(x => x.assetRef !== ref);
};
M._tsPhieuChi = ref => PW.data.payments.find(x => x.assetRef === ref);

/* =====================================================================
   TRANG TÀI SẢN CỐ ĐỊNH
   ===================================================================== */
M.fixedAssets = function (root) {
  const host = U.el('div');
  root.appendChild(host);

  function draw() {
    host.innerHTML = '';
    const homNay = U.today();
    const ds = (PW.data.fixedAssets || []).slice().sort((a, b) => (b.date + (b.code || '')).localeCompare(a.date + (a.code || '')));
    const conDung = ds.filter(a => !a.disposed);
    const nguyenGia = conDung.reduce((s, a) => s + (Number(a.cost) || 0), 0);
    const luyKe = conDung.reduce((s, a) => s + PW.assetAccumDep(a, homNay), 0);
    const conLai = PW.totalFixedAssets(homNay);
    const thang = U.periodPreset('thisMonth');
    const khThangNay = PW.depreciation(thang.from, thang.to);

    host.appendChild(U.el('div', { class: 'grid c4' }, [
      M._capKpi('Nguyên giá', nguyenGia, conDung.length + ' tài sản đang dùng'),
      M._capKpi('Đã khấu hao lũy kế', luyKe, 'tính đến ' + U.date(homNay), 'text-red'),
      M._capKpi('Giá trị còn lại', conLai, 'trên bảng cân đối', 'text-green'),
      M._capKpi('Khấu hao tháng này', khThangNay, 'vào chi phí tháng ' + thang.from.slice(5, 7)),
    ]));

    const card = U.el('div', { class: 'card mt16' });
    card.appendChild(U.el('div', { class: 'toolbar' }, [
      U.el('div', { class: 'card-title', style: 'margin:0' }, '🏭 Tài sản cố định'),
      U.el('div', { class: 'spacer' }),
      C.btn('📊 Xuất Excel', () => M.tsExcel(ds)),
      C.btn('🖨 In / PDF', () => M.tsPrint(ds)),
      C.btn('+ Ghi tăng tài sản', () => M.fixedAssetForm(), 'primary'),
    ]));
    card.appendChild(U.el('p', { class: 'section-sub' },
      'Khấu hao đường thẳng theo tháng, tính từ tháng đưa vào sử dụng. Mỗi tháng phần khấu hao '
      + 'tự vào chi phí nên báo cáo lãi lỗ — và tiền chia cho các thành viên góp vốn — mới đúng.'));

    card.appendChild(C.table(ds, [
      { label: 'Mã', render: a => U.esc(a.code || '') },
      { label: 'Tên tài sản', render: a => '<b>' + U.esc(a.name) + '</b>'
          + (a.note ? '<div class="text-muted" style="font-size:11px">' + U.esc(a.note) + '</div>' : '') },
      { label: 'Ngày dùng', render: a => U.date(a.date) },
      { label: 'Nguồn', render: a => U.esc(M.tsNguon(a.nguon)) },
      { label: 'Nguyên giá', num: true, render: a => U.money(a.cost) },
      { label: 'Số năm', center: true, render: a => U.num(a.years) },
      { label: 'KH/tháng', num: true, render: a => U.money(PW.assetDepMonthly(a)) },
      { label: 'Đã KH', num: true, render: a => '<span class="text-red">' + U.money(PW.assetAccumDep(a, homNay)) + '</span>' },
      { label: 'Còn lại', num: true, render: a => '<b class="text-green">' + U.money(PW.assetBookValue(a, homNay)) + '</b>' },
      { label: 'Trạng thái', center: true, render: a => {
          if (a.disposed) return '<span class="tag gray">Đã thanh lý ' + U.date(a.disposedDate) + '</span>';
          const het = PW.assetAccumDep(a, homNay) >= (Number(a.cost) || 0) - Number(a.salvage || 0);
          return het ? '<span class="tag orange">Hết khấu hao</span>' : '<span class="tag green">Đang dùng</span>';
        } },
      { label: '', render: a => C.actions([
          { label: 'Sửa', onClick: () => M.fixedAssetForm(a) },
          a.disposed ? null : { label: 'Thanh lý', onClick: () => M.fixedAssetDispose(a) },
          { label: 'Xóa', cls: 'danger', onClick: () => {
              const pc = M._tsPhieuChi(a.id);
              if (!U.confirm('Xóa tài sản ' + a.name + '?\n\n'
                + (pc ? 'Phiếu chi ' + pc.code + ' cũng bị xóa — quỹ tiền sẽ tăng lại.' : 'Không có phiếu chi gắn kèm.'))) return;
              M._tsDrop(a.id);
              PW.data.fixedAssets = PW.data.fixedAssets.filter(x => x.id !== a.id);
              PW.logActivity('delete', 'fixedAsset', a.code || a.name, U.money(a.cost));
              PW.save(); App.refresh(); U.toast('Đã xóa');
            } },
        ].filter(Boolean)) },
    ], { empty: 'Chưa ghi tài sản cố định nào. Mua máy bằng quỹ thì bấm "Ghi tăng tài sản".' }));
    host.appendChild(card);
  }
  draw();
};

M.fixedAssetForm = function (a) {
  const isNew = !a;
  const src = a;
  a = a ? JSON.parse(JSON.stringify(a)) : {
    code: PW.nextCode('TS'), date: U.today(), name: '', cost: 0, years: M.TS_NAM_MAC_DINH,
    salvage: 0, nguon: 'quy', accountId: (PW.data.cashAccounts[0] || {}).id || '', note: '',
  };
  const tuGopVon = !!a.capitalRef;   // máy do thành viên góp vào — không sửa ở đây

  const codeI = C.input({ value: a.code });
  const dateI = C.input({ type: 'date', value: a.date });
  const nameI = C.input({ value: a.name || '', placeholder: 'VD: Máy in 3D Bambu Lab A1 + AMS lite', style: 'width:100%' });
  const costI = C.money({ value: a.cost, style: 'text-align:right;font-weight:700' });
  const yearsI = C.input({ type: 'number', value: a.years, min: 1, max: 50, step: '1', style: 'text-align:right' });
  const salvageI = C.money({ value: a.salvage || 0, style: 'text-align:right' });
  const nguonI = C.select(M.TS_NGUON.map(x => ({ value: x.v, label: x.t })), a.nguon || 'quy');
  const accI = C.select(M._capAccOpts('— Không ghi phiếu chi —'), a.accountId || '');
  const noteI = C.input({ value: a.note || '', placeholder: 'Số máy, nơi mua, bảo hành…', style: 'width:100%' });

  const accField = C.field('Chi từ quỹ (tạo phiếu chi)', accI, { full: true });
  const xem = U.el('div', { class: 'card', style: 'background:#f5faee;margin-top:12px' });
  function tinhLai() {
    const gia = costI.soTien(), nam = Number(yearsI.value) || 0, tl = salvageI.soTien();
    const thang = nam > 0 ? (gia - tl) / (nam * 12) : 0;
    xem.innerHTML = '';
    xem.appendChild(U.el('div', { class: 'fin-row' }, [
      U.el('span', { class: 'k' }, 'Khấu hao mỗi tháng'), U.el('span', { class: 'v' }, U.money(thang) + ' đ')]));
    xem.appendChild(U.el('div', { class: 'fin-row' }, [
      U.el('span', { class: 'k' }, 'Khấu hao mỗi năm'), U.el('span', { class: 'v' }, U.money(thang * 12) + ' đ')]));
    xem.appendChild(U.el('div', { class: 'fin-row' }, [
      U.el('span', { class: 'k' }, 'Trích hết vào'),
      U.el('span', { class: 'v' }, nam > 0 ? ('tháng ' + U.date(U.addDays(dateI.value || U.today(), Math.round(nam * 365))).slice(3)) : '—')]));
  }
  [costI, yearsI, salvageI].forEach(i => i.addEventListener('input', tinhLai));
  dateI.addEventListener('change', tinhLai);

  function syncNguon() {
    const muaBangQuy = nguonI.value === 'quy';
    accField.style.display = muaBangQuy ? '' : 'none';
    if (!muaBangQuy) accI.value = '';
  }
  nguonI.addEventListener('change', syncNguon);
  if (tuGopVon) { nguonI.disabled = true; costI.readOnly = true; costI.style.background = '#f4f7ee'; }
  syncNguon(); tinhLai();

  const body = U.el('div', null, [
    tuGopVon ? U.el('p', { class: 'section-sub', html:
      '🤝 Tài sản này do <b>thành viên góp vốn</b> đưa vào. Nguyên giá lấy theo giá trị hai bên đã '
      + 'thỏa thuận ở phân hệ Góp vốn nên khóa tại đây — muốn đổi thì sửa ở khoản góp vốn. '
      + 'Số năm khấu hao vẫn sửa được.' }) : null,
    U.el('div', { class: 'form-grid' }, [
      C.field('Mã tài sản', codeI),
      C.field('Ngày đưa vào sử dụng', dateI, { required: true }),
      C.field('Tên tài sản', nameI, { full: true, required: true }),
      C.field('Nguyên giá (đ)', U.el('div', null, [costI, C.moneyWords(costI)]), { full: true, required: true }),
      C.field('Số năm khấu hao', yearsI),
      C.field('Giá trị thanh lý ước tính (đ)', salvageI),
      C.field('Nguồn hình thành', nguonI, { full: true }),
      accField,
      C.field('Ghi chú', noteI, { full: true }),
    ]),
    xem,
  ].filter(Boolean));

  C.modal({
    title: isNew ? '🏭 Ghi tăng tài sản cố định' : '✏️ Sửa tài sản ' + a.code, wide: true, body,
    footer: [C.btn('Hủy', C.closeModal), C.btn('Lưu', () => {
      const obj = {
        id: isNew ? PW.uid() : src.id,
        code: codeI.value.trim() || a.code, date: dateI.value, name: nameI.value.trim(),
        cost: costI.soTien(), years: Number(yearsI.value) || 0, salvage: salvageI.soTien(),
        nguon: nguonI.value, accountId: accI.value || '', note: noteI.value.trim(),
        capitalRef: a.capitalRef || '', disposed: !!a.disposed,
        disposedDate: a.disposedDate || '', disposedAmount: Number(a.disposedAmount || 0),
      };
      if (!obj.date) return U.toast('Chọn ngày đưa vào sử dụng', 'error');
      if (!obj.name) return U.toast('Nhập tên tài sản', 'error');
      if (!(obj.cost > 0)) return U.toast('Nguyên giá phải lớn hơn 0', 'error');
      if (!(obj.years > 0)) return U.toast('Số năm khấu hao phải lớn hơn 0', 'error');
      if (obj.salvage >= obj.cost) return U.toast('Giá trị thanh lý phải nhỏ hơn nguyên giá', 'error');

      if (isNew) PW.data.fixedAssets.push(obj); else Object.assign(src, obj);
      const maPC = M._tsChiSync(obj.id, (obj.nguon === 'quy' && obj.accountId) ? {
        date: obj.date, accountId: obj.accountId, amount: obj.cost, ten: obj.name, code: obj.code,
      } : null);
      PW.logActivity(isNew ? 'create' : 'update', 'fixedAsset', obj.code, obj.name + ' · ' + U.money(obj.cost));
      PW.save(); C.closeModal(); App.refresh();
      U.toast(maPC ? 'Đã ghi tăng tài sản và lập phiếu chi ' + maPC : 'Đã lưu tài sản');
    }, 'primary')],
  });
};

/* ---------- Thanh lý / nhượng bán ---------- */
M.fixedAssetDispose = function (a) {
  const homNay = U.today();
  const conLai = PW.assetBookValue(a, homNay);
  const dateI = C.input({ type: 'date', value: homNay });
  const tienI = C.money({ value: 0, style: 'text-align:right;font-weight:700' });
  const accI = C.select(M._capAccOpts('— Không thu tiền —'), (PW.data.cashAccounts[0] || {}).id || '');
  const lai = U.el('div', { class: 'section-sub' });
  function tinh() {
    const t = tienI.soTien(), ch = t - conLai;
    lai.innerHTML = 'Giá trị còn lại trên sổ: <b>' + U.money(conLai) + ' đ</b>. '
      + (t > 0 ? ('Bán ' + U.money(t) + ' đ → ' + (ch >= 0
          ? '<span class="text-green">lãi ' + U.money(ch) + ' đ</span>'
          : '<span class="text-red">lỗ ' + U.money(-ch) + ' đ</span>')) : 'Chưa nhập số tiền thu về.');
  }
  tienI.addEventListener('input', tinh); tinh();

  C.modal({
    title: '📦 Thanh lý ' + a.name, wide: true,
    body: U.el('div', null, [
      U.el('div', { class: 'form-grid' }, [
        C.field('Ngày thanh lý', dateI, { required: true }),
        C.field('Số tiền thu về (đ)', tienI),
        C.field('Thu vào quỹ (tạo phiếu thu)', accI, { full: true }),
      ]),
      lai,
      U.el('p', { class: 'section-sub mt8' },
        'Thanh lý xong thì tài sản ngừng trích khấu hao từ tháng này, và không còn nằm trong '
        + '"Giá trị còn lại" trên bảng cân đối.'),
    ]),
    footer: [C.btn('Hủy', C.closeModal), C.btn('Xác nhận thanh lý', () => {
      if (!dateI.value) return U.toast('Chọn ngày thanh lý', 'error');
      a.disposed = true; a.disposedDate = dateI.value; a.disposedAmount = tienI.soTien();
      // Tiền bán tài sản KHÔNG phải doanh thu bán hàng -> phiếu thu không có cờ isRevenue
      const t = tienI.soTien();
      if (t > 0 && accI.value) {
        PW.data.receipts.push({
          id: PW.uid(), code: PW.nextCode('PT'), date: dateI.value, accountId: accI.value,
          customerId: null, amount: t, reason: 'Thanh lý tài sản — ' + a.name,
          note: a.code || '', isAsset: true, assetRef: a.id,
        });
      }
      PW.logActivity('update', 'fixedAsset', a.code || a.name, 'thanh lý ' + U.money(t));
      PW.save(); C.closeModal(); App.refresh(); U.toast('Đã ghi thanh lý');
    }, 'primary')],
  });
};

/* ---------- Xuất Excel / In (dùng chung bộ xuất ở modules19) ---------- */
M._tsCols = function () {
  const homNay = U.today();
  return [
    { t: 'Mã', w: 12, center: true, get: a => a.code || '' },
    { t: 'Tên tài sản', w: 34, get: a => a.name + (a.note ? ' — ' + a.note : '') },
    { t: 'Ngày dùng', w: 12, center: true, get: a => U.date(a.date) },
    { t: 'Nguồn', w: 24, get: a => M.tsNguon(a.nguon) },
    { t: 'Nguyên giá (đ)', w: 17, money: true, get: a => Number(a.cost) || 0 },
    { t: 'Số năm', w: 9, center: true, get: a => U.num(a.years) },
    { t: 'KH/tháng (đ)', w: 15, money: true, get: a => Math.round(PW.assetDepMonthly(a)) },
    { t: 'Đã khấu hao (đ)', w: 16, money: true, get: a => PW.assetAccumDep(a, homNay) },
    { t: 'Còn lại (đ)', w: 16, money: true, get: a => a.disposed ? 0 : PW.assetBookValue(a, homNay) },
    { t: 'Trạng thái', w: 16, center: true, get: a => a.disposed ? 'Đã thanh lý ' + U.date(a.disposedDate) : 'Đang dùng' },
  ];
};
M.tsExcel = ds => M._capExcel({
  tieuDe: 'Bảng tài sản cố định và khấu hao', moTa: 'Tính đến ngày ' + U.date(U.today()),
  rows: ds, cols: M._tsCols(), tenFile: 'TaiSanCoDinh', sheet: 'Tai san co dinh',
  congNhan: 'CỘNG', tongCot: 8, tongNhan: 'TỔNG GIÁ TRỊ CÒN LẠI',
});
M.tsPrint = ds => M._capIn({
  tieuDe: 'Bảng tài sản cố định và khấu hao', moTa: 'Tính đến ngày ' + U.date(U.today()),
  rows: ds, cols: M._tsCols(), soCT: 'TSCD/' + U.today().slice(0, 4),
  congNhan: 'CỘNG', tongCot: 8, tongNhan: 'TỔNG GIÁ TRỊ CÒN LẠI',
});
