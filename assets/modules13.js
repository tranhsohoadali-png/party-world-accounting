/* ============================================================
   modules13.js — Năng suất theo nhân viên
   2 CHẾ ĐỘ:
   • SERVER (ketoan.tranhdali.vn): đọc dữ liệu do mau.tranhdali.vn ĐẨY
     sang (api/productivity.php) — mau là nơi nhập, đây là nơi trình bày.
   • OFFLINE (mở trực tiếp): nhập tay tại chỗ (PW.data.productivityEntries).
   Tổng việc = Mẻ pha + Tranh rót + Tranh SX (Màu rót là chi tiết).
   ============================================================ */

M.PROD_FIELDS = [
  { k: 'pha', label: 'Mẻ pha', inTotal: true },
  { k: 'tranhRot', label: 'Tranh rót', inTotal: true },
  { k: 'mauRot', label: 'Màu rót', inTotal: false },
  { k: 'sx', label: 'Tranh SX', inTotal: true },
];

M._prodStartOfWeek = function (ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const wd = (dt.getDay() + 6) % 7;
  dt.setDate(dt.getDate() - wd);
  const p = x => String(x).padStart(2, '0');
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
};

M.productivity = function (root) {
  const isServer = PW.mode === 'server';
  const period = App._prodPeriod || 'month';
  const month = App._prodMonth || U.today().slice(0, 7);

  // ----- Khoảng thời gian -----
  let from, to, label;
  const today = U.today();
  if (period === 'today') { from = to = today; label = 'Hôm nay ' + U.date(today); }
  else if (period === 'week') { from = M._prodStartOfWeek(today); to = today; label = 'Tuần này (' + U.date(from) + ' → ' + U.date(to) + ')'; }
  else if (period === 'all') { from = ''; to = '￿'; label = 'Tất cả'; }
  else { from = month + '-01'; to = month + '-31'; label = 'Tháng ' + month.slice(5) + '/' + month.slice(0, 4); }
  const inRange = dd => (!from || dd >= from) && dd <= to;

  // ----- Chuẩn hóa 1 dòng về {date, key, name, pha, tranhRot, mauRot, sx, note, source, _raw} -----
  function normLocal(e) {
    const emp = PW.data.employees.find(x => x.id === e.employeeId);
    return { date: e.date, key: e.employeeId || '_none', name: emp ? emp.name : '(không tên)', pha: +e.pha || 0, tranhRot: +e.tranhRot || 0, mauRot: +e.mauRot || 0, sx: +e.sx || 0, note: e.note || '', source: 'local', _raw: e };
  }
  function normPushed(r) {
    const emp = PW.data.employees.find(x => (r.employee_code && (x.code === r.employee_code || x.tkCode === r.employee_code)) || (r.employee_name && x.name === r.employee_name));
    return { date: r.entry_date, key: emp ? emp.id : ('ext:' + (r.employee_code || r.employee_name || '?')), name: emp ? emp.name : (r.employee_name || r.employee_code || '(không tên)'), pha: +r.pha || 0, tranhRot: +r.tranh_rot || 0, mauRot: +r.mau_rot || 0, sx: +r.sx || 0, note: r.note || '', source: r.source || 'mau' };
  }

  // ----- Ghi chú đầu trang -----
  root.appendChild(U.el('div', { class: 'card', style: 'background:var(--brand-tint, #eef6f5)' },
    U.el('div', { class: 'section-sub', style: 'margin:0' }, isServer
      ? 'ℹ️ Dữ liệu sản lượng được ĐỒNG BỘ TỰ ĐỘNG từ mau.tranhdali.vn (nơi nhân viên nhập). Lương tính theo ngày công ở "Tính lương".'
      : 'ℹ️ Bảng thống kê SẢN LƯỢNG từng nhân viên để quản lý lãi/lỗ. Lương tính theo ngày công ở "Tính lương" — KHÔNG tính ở đây.')));

  const card = U.el('div', { class: 'card' });
  const toolbar = U.el('div', { class: 'toolbar' });
  const seg = U.el('div', { class: 'seg' });
  [['today', 'Hôm nay'], ['week', 'Tuần này'], ['month', 'Theo tháng'], ['all', 'Tất cả']].forEach(([val, lab]) => {
    const b = U.el('button', { class: 'btn sm' + (period === val ? ' primary' : '') }, lab);
    b.onclick = () => { App._prodPeriod = val; App.refresh(); };
    seg.appendChild(b);
  });
  toolbar.appendChild(seg);
  const monthSel = C.select([month].concat([]).map(m => ({ value: m, label: m.slice(5) + '/' + m.slice(0, 4) })), month);
  monthSel.style.display = period === 'month' ? '' : 'none';
  monthSel.addEventListener('change', () => { App._prodMonth = monthSel.value; App._prodPeriod = 'month'; App.refresh(); });
  toolbar.appendChild(monthSel);
  toolbar.appendChild(C.btn('📊 Xuất Excel', exportXls, 'sm'));
  toolbar.appendChild(U.el('div', { class: 'spacer' }));
  toolbar.appendChild(U.el('div', { style: 'font-weight:600' }, label));
  if (isServer) toolbar.appendChild(C.btn('🔄 Tải lại', () => App.refresh(), 'sm'));
  else toolbar.appendChild(C.btn('+ Nhập sản lượng', () => M.productivityForm(), 'primary'));
  card.appendChild(toolbar);

  const bodyBox = U.el('div');
  card.appendChild(bodyBox);
  root.appendChild(card);

  let lastRows = [], lastT = { pha: 0, tranhRot: 0, mauRot: 0, sx: 0, tong: 0 };

  function paint(norm, readonly) {
    bodyBox.innerHTML = '';
    // gộp theo nhân viên
    const agg = {};
    norm.forEach(e => {
      if (!agg[e.key]) agg[e.key] = { name: e.name, pha: 0, tranhRot: 0, mauRot: 0, sx: 0 };
      M.PROD_FIELDS.forEach(f => { agg[e.key][f.k] += e[f.k]; });
    });
    const tongOf = a => M.PROD_FIELDS.filter(f => f.inTotal).reduce((s, f) => s + a[f.k], 0);
    const rows = Object.keys(agg).map(k => Object.assign({ key: k }, agg[k], { tong: tongOf(agg[k]) })).sort((a, b) => b.tong - a.tong);
    const T = rows.reduce((t, r) => { M.PROD_FIELDS.forEach(f => t[f.k] += r[f.k]); t.tong += r.tong; return t; }, { pha: 0, tranhRot: 0, mauRot: 0, sx: 0, tong: 0 });
    lastRows = rows; lastT = T;

    const kpi = U.el('div', { class: 'grid c2', style: 'margin-top:8px' });
    [['Tổng đầu việc', U.num(T.tong) + '  (pha + rót + SX)', 'var(--teal)'],
     ['Số nhân viên', U.num(rows.length), 'var(--navy)']]
      .forEach(a => kpi.appendChild(U.el('div', { class: 'kpi' }, [
        U.el('div', { class: 'value', style: 'color:' + a[2] }, a[1]),
        U.el('div', { class: 'sub text-muted' }, a[0]),
      ])));
    bodyBox.appendChild(kpi);

    const grid = U.el('div', { class: 'grid', style: 'grid-template-columns:3fr 2fr;margin-top:10px' });
    const tblBox = U.el('div');
    tblBox.appendChild(C.table(rows, [
      { label: 'Nhân viên', render: r => U.esc(r.name) },
      { label: 'Mẻ pha', num: true, render: r => U.num(r.pha) },
      { label: 'Tranh rót', num: true, render: r => U.num(r.tranhRot) },
      { label: 'Màu rót', num: true, render: r => U.num(r.mauRot) },
      { label: 'Tranh SX', num: true, render: r => U.num(r.sx) },
      { label: 'Tổng việc', num: true, render: r => `<b class="text-green">${U.num(r.tong)}</b>` },
    ], {
      empty: readonly ? 'Chưa có dữ liệu đồng bộ từ mau trong kỳ.' : 'Chưa có dữ liệu. Bấm "+ Nhập sản lượng".',
      footer: [{ html: 'TỔNG' }, { html: U.num(T.pha), num: true }, { html: U.num(T.tranhRot), num: true },
        { html: U.num(T.mauRot), num: true }, { html: U.num(T.sx), num: true }, { html: '<b>' + U.num(T.tong) + '</b>', num: true }],
    }));
    grid.appendChild(tblBox);
    const chartBox = U.el('div', { class: 'card', style: 'margin:0' });
    chartBox.appendChild(U.el('div', { class: 'card-title' }, 'Sản lượng (pha+rót+SX) theo nhân viên'));
    chartBox.appendChild(rows.length ? M.rankBars(rows.map(r => ({ label: r.name, value: r.tong })), { color: 'var(--teal)' }) : U.el('div', { class: 'empty' }, 'Chưa có dữ liệu'));
    grid.appendChild(chartBox);
    bodyBox.appendChild(grid);

    // Chi tiết phiếu
    const cols = [
      { label: 'Ngày', render: e => U.date(e.date) },
      { label: 'Nhân viên', render: e => U.esc(e.name) },
      { label: 'Mẻ pha', num: true, render: e => U.num(e.pha) },
      { label: 'Tranh rót', num: true, render: e => U.num(e.tranhRot) },
      { label: 'Màu rót', num: true, render: e => U.num(e.mauRot) },
      { label: 'Tranh SX', num: true, render: e => U.num(e.sx) },
      { label: 'Ghi chú', render: e => U.esc(e.note || '') },
    ];
    if (readonly) cols.push({ label: 'Nguồn', center: true, render: e => `<span class="text-muted" style="font-size:12px">${e.source === 'mau' ? '↪ mau' : U.esc(e.source)}</span>` });
    else cols.push({ label: '', render: e => C.actions([
        { label: 'Sửa', onClick: () => M.productivityForm(e._raw) },
        { label: 'Xóa', cls: 'danger', onClick: () => { if (U.confirm('Xóa phiếu sản lượng ngày ' + U.date(e.date) + '?')) { PW.data.productivityEntries = PW.data.productivityEntries.filter(x => x.id !== e._raw.id); PW.save(); App.refresh(); U.toast('Đã xóa'); } } },
      ]) });
    const detail = U.el('div', { class: 'card' });
    detail.appendChild(U.el('div', { class: 'card-title' }, '📝 Chi tiết sản lượng trong kỳ (' + norm.length + ')'));
    detail.appendChild(C.table(norm.slice().sort((a, b) => (b.date).localeCompare(a.date)), cols, { empty: 'Chưa có phiếu nào trong kỳ.' }));
    bodyBox.appendChild(detail);
  }

  function exportXls() {
    if (!lastRows.length) return U.toast('Chưa có dữ liệu để xuất', 'error');
    const headers = ['Nhân viên', 'Mẻ pha', 'Tranh rót', 'Màu rót', 'Tranh SX', 'Tổng việc'];
    const data = lastRows.map(r => [r.name, r.pha, r.tranhRot, r.mauRot, r.sx, r.tong]);
    data.push(['TỔNG', lastT.pha, lastT.tranhRot, lastT.mauRot, lastT.sx, lastT.tong]);
    U.exportExcel('NangSuat_' + (period === 'month' ? month : period), headers, data, 'SẢN LƯỢNG THEO NHÂN VIÊN — ' + label);
  }

  // ----- Nạp dữ liệu theo chế độ -----
  if (isServer) {
    bodyBox.appendChild(U.el('div', { class: 'empty' }, 'Đang đồng bộ từ mau.tranhdali.vn...'));
    (async function () {
      // 1) KÉO mới từ mau (best-effort: lỗi vẫn hiển thị dữ liệu đã lưu)
      const pullQs = (from && to !== '￿') ? ('from=' + from + '&to=' + to) : 'days=92';
      let syncMsg = '';
      try {
        const pr = await PW.api('productivity.php?action=pull&' + pullQs);
        if (pr.status === 200 && pr.data && pr.data.ok) syncMsg = '✅ Đã đồng bộ ' + (pr.data.synced || 0) + ' dòng từ mau.tranhdali.vn';
        else syncMsg = '⚠ Chưa đồng bộ được từ mau (' + ((pr.data && pr.data.error) || ('HTTP ' + pr.status)) + ') — đang hiển thị dữ liệu đã lưu.';
      } catch (e) { syncMsg = '⚠ Lỗi gọi đồng bộ — đang hiển thị dữ liệu đã lưu.'; }
      // 2) ĐỌC để hiển thị
      const qs = new URLSearchParams({ action: 'list', from: from || '', to: (to === '￿' ? '' : to) });
      const r = await PW.api('productivity.php?' + qs.toString());
      if (r.status !== 200 || !r.data || !r.data.ok) {
        bodyBox.innerHTML = '';
        bodyBox.appendChild(U.el('div', { class: 'empty text-red' }, (r.data && r.data.error) || 'Lỗi đọc dữ liệu năng suất.'));
        return;
      }
      paint((r.data.entries || []).map(normPushed).filter(e => inRange(e.date)), true);
      if (syncMsg) bodyBox.insertBefore(U.el('div', { class: 'section-sub', style: 'margin:0 0 6px;font-weight:600' }, syncMsg), bodyBox.firstChild);
    })();
  } else {
    paint((PW.data.productivityEntries || []).filter(e => inRange(e.date)).map(normLocal), false);
  }
};

/* ---------- Form nhập sản lượng (chế độ offline) ---------- */
M.productivityForm = function (e) {
  const isNew = !e;
  e = e ? JSON.parse(JSON.stringify(e)) : { date: U.today(), employeeId: (PW.data.employees[0] || {}).id || '', pha: 0, tranhRot: 0, mauRot: 0, sx: 0, note: '' };
  if (!PW.data.employees.length) return U.toast('Chưa có nhân viên. Vào Danh mục → Nhân viên để thêm.', 'error');

  const dateI = C.input({ type: 'date', value: e.date });
  const empSel = C.select(PW.data.employees.map(x => ({ value: x.id, label: x.name })), e.employeeId);
  const fieldInputs = {};
  M.PROD_FIELDS.forEach(f => { fieldInputs[f.k] = C.input({ type: 'number', value: e[f.k] || 0, min: 0, style: 'text-align:right' }); });
  const noteI = C.input({ value: e.note || '' });

  const body = U.el('div', { class: 'form-grid' }, [
    C.field('Ngày', dateI, { required: true }),
    C.field('Nhân viên', empSel, { required: true }),
    C.field('Mẻ pha', fieldInputs.pha),
    C.field('Tranh rót', fieldInputs.tranhRot),
    C.field('Màu rót', fieldInputs.mauRot),
    C.field('Tranh SX', fieldInputs.sx),
    C.field('Ghi chú', noteI, { full: true }),
    U.el('div', { class: 'section-sub full' }, 'Tổng việc = Mẻ pha + Tranh rót + Tranh SX (Màu rót là chi tiết, không cộng vào tổng).'),
  ]);

  C.modal({
    title: isNew ? 'Nhập sản lượng' : 'Sửa phiếu sản lượng', body,
    footer: [C.btn('Hủy', C.closeModal), C.btn('Lưu', () => {
      if (!empSel.value) return U.toast('Chọn nhân viên', 'error');
      if (!dateI.value) return U.toast('Chọn ngày', 'error');
      const obj = { id: e.id || PW.uid(), date: dateI.value, employeeId: empSel.value, note: noteI.value };
      M.PROD_FIELDS.forEach(f => { obj[f.k] = Number(fieldInputs[f.k].value) || 0; });
      if (isNew) PW.data.productivityEntries.push(obj);
      else { const i = PW.data.productivityEntries.findIndex(x => x.id === obj.id); PW.data.productivityEntries[i] = obj; }
      PW.save(); C.closeModal(); App.refresh(); U.toast('Đã lưu sản lượng');
    }, 'primary')],
  });
};
