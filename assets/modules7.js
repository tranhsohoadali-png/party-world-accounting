/* ============================================================
   modules7.js — Tính lương nhân viên (theo bảng lương Google Sheet)
   ============================================================ */

/* ---------- Công thức tính lương 1 nhân viên trong 1 kỳ ---------- */
M.payrollCompute = function (emp, line, standardDays) {
  emp = emp || {};
  const sd = Number(standardDays) || 26;
  const base = Number(emp.salaryBase || 0);
  const totalDays = Number(line.totalDays || 0);   // tổng ngày công thực tế (gồm cả ngày lễ)
  const allowDays = Number(line.allowDays || 0);   // ngày công có phụ cấp (ngày đi làm thực tế)
  const dayRate = Number(emp.dayWage || 0);         // lương theo ngày công (đơn giá 1 ngày) — ưu tiên nếu > 0
  const dayWage = dayRate > 0 ? dayRate : (sd ? base / sd : 0);   // lương 1 ngày: đơn giá ngày công HOẶC lương tháng ÷ ngày công chuẩn
  const hourWage = dayWage / 8;                     // lương 1 giờ
  const luongChinh = dayWage * totalDays;
  const luongTN = (Number(emp.allowResp || 0) / sd) * allowDays;
  const pcXang = (Number(emp.allowTransport || 0) / sd) * allowDays;
  const pcAn = (Number(emp.allowLunch || 0) / sd) * allowDays;
  const pcTN = (Number(emp.allowSeniority || 0) / sd) * allowDays;
  const lamThem = hourWage * Number(line.otHours || 0);
  const thuong = Number(line.bonus || 0);
  const extra = Number(line.extra || 0);
  const congThem = thuong + lamThem + pcXang + pcAn + pcTN + extra;
  const phat = Number(line.lateFine || 0), bhxh = Number(line.bhxh || 0),
        ung = Number(line.advance || 0), dt = Number(line.phoneUse || 0);
  const tongTru = phat + bhxh + ung + dt;
  const thucLinh = luongChinh + luongTN + congThem - tongTru;
  return { dayWage, hourWage, luongChinh, luongTN, pcXang, pcAn, pcTN, lamThem, thuong, extra,
    congThem, phat, bhxh, ung, dt, tongTru, thucLinh };
};

function empById(id) { return PW.data.employees.find(e => e.id === id); }
M.payrollNetTotal = function (p) {
  return p.lines.reduce((s, ln) => s + M.payrollCompute(empById(ln.employeeId), ln, p.standardDays).thucLinh, 0);
};

/* ---------- Danh sách bảng lương theo tháng ---------- */
M.payrolls = function (root) {
  const card = U.el('div', { class: 'card' });
  const toolbar = U.el('div', { class: 'toolbar' });
  toolbar.appendChild(U.el('div', { class: 'card-title', style: 'margin:0' }, '💰 Bảng lương theo tháng'));
  toolbar.appendChild(U.el('div', { class: 'spacer' }));
  toolbar.appendChild(C.btn('+ Tạo bảng lương tháng', () => M.payrollCreate(), 'primary'));
  card.appendChild(toolbar);
  const host = U.el('div');
  card.appendChild(host);
  root.appendChild(card);

  function draw() {
    const rows = PW.data.payrolls.slice().sort((a, b) => (b.month).localeCompare(a.month));
    host.innerHTML = '';
    host.appendChild(C.table(rows, [
      { label: 'Kỳ lương', render: p => 'Tháng ' + p.month.slice(5) + '/' + p.month.slice(0, 4) },
      { label: 'Ngày công chuẩn', center: true, render: p => U.num(p.standardDays) },
      { label: 'Số nhân viên', center: true, render: p => p.lines.length },
      { label: 'Tổng thực lĩnh', num: true, render: p => U.money(M.payrollNetTotal(p)) },
      { label: '', render: p => C.actions([
          { label: 'Mở / Tính lương', cls: 'primary', onClick: () => M.payrollDetail(p.id) },
          { label: 'Xóa', cls: 'danger', onClick: () => {
              if (U.confirm('Xóa bảng lương tháng ' + p.month + '?')) {
                PW.logActivity('delete', 'payroll', 'Bảng lương ' + p.month, '');
                PW.data.payrolls = PW.data.payrolls.filter(x => x.id !== p.id);
                PW.save(); draw(); U.toast('Đã xóa');
              }
            } },
        ]) },
    ], { empty: 'Chưa có bảng lương. Bấm "Tạo bảng lương tháng".' }));
  }
  draw();
};

/* ---------- Tạo bảng lương tháng mới ---------- */
M.payrollCreate = function () {
  const monthI = C.input({ type: 'month', value: U.today().slice(0, 7) });
  const sdI = C.input({ type: 'number', value: 26, min: 1 });
  const body = U.el('div', { class: 'form-grid' }, [
    C.field('Kỳ lương (tháng)', monthI, { required: true }),
    C.field('Ngày công chuẩn trong tháng', sdI, { required: true }),
    U.el('div', { class: 'section-sub full' }, 'Hệ thống sẽ tạo dòng lương cho tất cả nhân viên. Bạn nhập ngày công & các khoản cộng/trừ ở bước sau.'),
  ]);
  C.modal({
    title: 'Tạo bảng lương tháng', body,
    footer: [C.btn('Hủy', C.closeModal), C.btn('Tạo', () => {
      const month = monthI.value;
      if (!month) return U.toast('Chọn tháng', 'error');
      if (PW.data.payrolls.some(p => p.month === month)) return U.toast('Đã có bảng lương tháng này', 'error');
      const sd = Number(sdI.value) || 26;
      const p = {
        id: PW.uid(), month, standardDays: sd, note: '',
        lines: PW.data.employees.map(e => ({
          employeeId: e.id, totalDays: sd, allowDays: sd, otHours: 0,
          bonus: 0, extra: 0, lateFine: 0, bhxh: 0, advance: 0, phoneUse: 0, note: '',
        })),
      };
      PW.data.payrolls.push(p);
      PW.logActivity('create', 'payroll', 'Bảng lương ' + month, p.lines.length + ' nhân viên');
      PW.save(); C.closeModal(); M.payrollDetail(p.id);
    }, 'primary')],
  });
};

/* ---------- Chi tiết / nhập liệu bảng lương ---------- */
M.payrollDetail = function (id) {
  App.current = 'payroll';
  const root = document.getElementById('content');
  root.innerHTML = '';
  document.getElementById('page-title').textContent = 'Bảng lương';
  const p = PW.data.payrolls.find(x => x.id === id);
  if (!p) { App.go('payroll'); return; }
  if (M._payrollTimer) { clearInterval(M._payrollTimer); M._payrollTimer = null; }
  const canAuto = PW.mode === 'server' && p.month === U.today().slice(0, 7);

  const card = U.el('div', { class: 'card' });
  const toolbar = U.el('div', { class: 'toolbar' });
  toolbar.appendChild(U.el('button', { class: 'btn ghost', onclick: () => App.go('payroll') }, '← Danh sách'));
  toolbar.appendChild(U.el('div', { class: 'card-title', style: 'margin:0' },
    '💰 Bảng lương tháng ' + p.month.slice(5) + '/' + p.month.slice(0, 4) + ' (ngày công chuẩn: ' + p.standardDays + ')'));
  toolbar.appendChild(U.el('div', { class: 'spacer' }));
  toolbar.appendChild(C.btn('📄 Nhập Excel bảng công', () => M.payrollImportExcel(p), 'sm'));
  toolbar.appendChild(C.btn('📥 Lấy chấm công', () => M.payrollImportServer(p), 'sm'));
  toolbar.appendChild(C.btn('🔍 Dữ liệu thô', () => M.payrollRawTk(p), 'sm'));
  toolbar.appendChild(C.btn('📋 Dán chấm công', () => M.payrollPasteTK(p), 'sm'));
  toolbar.appendChild(C.btn('🛡️ Hậu kiểm', () => M.payrollAuditModal(p), 'sm'));
  if (canAuto) {
    toolbar.appendChild(C.btn(App._payrollAuto ? '🔄 Tự động: BẬT' : '🔄 Tự động: TẮT',
      () => { App._payrollAuto = !App._payrollAuto; U.toast(App._payrollAuto ? 'Đã bật tự động cập nhật chấm công (mỗi 3 phút)' : 'Đã tắt tự động'); M.payrollDetail(id); },
      App._payrollAuto ? 'sm primary' : 'sm'));
  }
  toolbar.appendChild(C.btn('📊 Xuất Excel', () => exportXls(), 'sm'));
  toolbar.appendChild(C.btn('💸 Ghi nhận chi lương', () => M.payrollPay(p), 'sm'));
  toolbar.appendChild(C.btn('💾 Lưu', () => { PW.save(); U.toast('Đã lưu bảng lương'); }, 'primary'));
  card.appendChild(toolbar);

  const totalCell = U.el('span', { style: 'font-weight:700' });
  const wrap = U.el('div', { class: 'table-wrap' });
  const tbl = U.el('table', { class: 'tbl payroll-tbl tbl-cards' });
  const heads = ['NV', 'Lương CB', 'Tổng NC', 'NC có PC', 'Tăng ca (h)',
    'Lương chính', 'Trách nhiệm', 'Phụ cấp', 'Làm thêm', 'Thưởng',
    'Phạt', 'BHXH', 'Ứng', 'ĐT', 'Thực lĩnh', ''];
  const htr = U.el('tr');
  heads.forEach((h, i) => htr.appendChild(U.el('th', { class: i >= 1 && i <= 14 ? 'num' : '' }, h)));
  tbl.appendChild(U.el('thead', null, htr));
  const tb = U.el('tbody');
  tbl.appendChild(tb);
  wrap.appendChild(tbl);
  card.appendChild(wrap);
  card.appendChild(U.el('div', { class: 'mt16', style: 'text-align:right;font-size:16px' },
    [U.el('span', { class: 'text-muted' }, 'TỔNG THỰC LĨNH CẢ THÁNG: '), totalCell]));
  root.appendChild(card);

  function numInput(ln, key, width) {
    const i = U.el('input', { type: 'number', value: ln[key] != null ? ln[key] : 0, style: 'width:' + (width || 70) + 'px;text-align:right' });
    i.addEventListener('input', () => { ln[key] = Number(i.value) || 0; recalc(); });
    return i;
  }
  const netCells = [];
  function recalc() {
    let total = 0;
    netCells.forEach(nc => {
      const r = M.payrollCompute(empById(nc.ln.employeeId), nc.ln, p.standardDays);
      nc.luongChinh.textContent = U.money(r.luongChinh);
      nc.tn.textContent = U.money(r.luongTN);
      nc.pc.textContent = U.money(r.pcXang + r.pcAn + r.pcTN);
      nc.lamThem.textContent = U.money(r.lamThem);
      nc.net.textContent = U.money(r.thucLinh);
      total += r.thucLinh;
    });
    totalCell.textContent = U.money(total) + ' đ';
  }
  function draw() {
    tb.innerHTML = ''; netCells.length = 0;
    p.lines.forEach(ln => {
      const e = empById(ln.employeeId) || { name: '(đã xóa)', salaryBase: 0 };
      const luongChinh = U.el('span'), tn = U.el('span'), pc = U.el('span'), lamThem = U.el('span'), net = U.el('span', { style: 'font-weight:700' });
      const tr = U.el('tr', null, [
        U.el('td', { 'data-label': 'Nhân viên' }, U.esc(e.name)),
        U.el('td', { class: 'num', 'data-label': 'Lương CB' }, Number(e.dayWage || 0) > 0 ? U.money(e.dayWage) + '/ngày' : U.money(e.salaryBase || 0)),
        U.el('td', { class: 'num', 'data-label': 'Tổng ngày công' }, numInput(ln, 'totalDays', 60)),
        U.el('td', { class: 'num', 'data-label': 'NC có phụ cấp' }, numInput(ln, 'allowDays', 60)),
        U.el('td', { class: 'num', 'data-label': 'Tăng ca (giờ)' }, numInput(ln, 'otHours', 55)),
        U.el('td', { class: 'num', 'data-label': 'Lương chính' }, luongChinh),
        U.el('td', { class: 'num', 'data-label': 'Trách nhiệm' }, tn),
        U.el('td', { class: 'num', 'data-label': 'Phụ cấp' }, pc),
        U.el('td', { class: 'num', 'data-label': 'Làm thêm' }, lamThem),
        U.el('td', { class: 'num', 'data-label': 'Thưởng' }, numInput(ln, 'bonus', 85)),
        U.el('td', { class: 'num', 'data-label': 'Phạt' }, numInput(ln, 'lateFine', 75)),
        U.el('td', { class: 'num', 'data-label': 'BHXH' }, numInput(ln, 'bhxh', 75)),
        U.el('td', { class: 'num', 'data-label': 'Ứng' }, numInput(ln, 'advance', 80)),
        U.el('td', { class: 'num', 'data-label': 'Điện thoại' }, numInput(ln, 'phoneUse', 70)),
        U.el('td', { class: 'num', 'data-label': 'Thực lĩnh' }, net),
        U.el('td', { class: 'center', 'data-label': '' }, U.el('button', { class: 'btn sm', onclick: () => M.payslip(p, ln) }, 'Phiếu')),
      ]);
      tb.appendChild(tr);
      netCells.push({ ln, luongChinh, tn, pc, lamThem, net });
    });
    recalc();
  }
  draw();

  // Tự lấy chấm công khi mở (tháng hiện tại, chế độ server) + tự làm mới định kỳ nếu bật
  if (canAuto) {
    const nowMs = Date.now();
    if (!M._lastAutoFetch || M._lastAutoFetch.id !== id || (nowMs - M._lastAutoFetch.time) > 60000) {
      M._lastAutoFetch = { id: id, time: nowMs };
      M.payrollImportServerSilent(p);
    }
    if (App._payrollAuto) {
      M._payrollTimer = setInterval(() => {
        M._lastAutoFetch = { id: id, time: Date.now() };
        M.payrollImportServerSilent(p);
      }, 180000); // 3 phút
    }
  }

  function exportXls() {
    const headers = ['Nhân viên', 'Lương CB', 'Tổng NC', 'NC có PC', 'Tăng ca (h)', 'Lương chính', 'Trách nhiệm', 'Phụ cấp', 'Làm thêm', 'Thưởng', 'Phạt', 'BHXH', 'Ứng', 'ĐT', 'Thực lĩnh'];
    const rows = p.lines.map(ln => {
      const e = empById(ln.employeeId) || {};
      const r = M.payrollCompute(e, ln, p.standardDays);
      return [e.name || '', Number(e.dayWage || 0) > 0 ? e.dayWage : (e.salaryBase || 0), ln.totalDays, ln.allowDays, ln.otHours,
        Math.round(r.luongChinh), Math.round(r.luongTN), Math.round(r.pcXang + r.pcAn + r.pcTN),
        Math.round(r.lamThem), ln.bonus, ln.lateFine, ln.bhxh, ln.advance, ln.phoneUse, Math.round(r.thucLinh)];
    });
    U.exportExcel('BangLuong_' + p.month, headers, rows, 'BẢNG LƯƠNG THÁNG ' + p.month);
  }
};

/* ---------- Phiếu lương cá nhân (in) ---------- */
M.payslip = function (p, ln) {
  const e = empById(ln.employeeId) || {};
  const r = M.payrollCompute(e, ln, p.standardDays);
  const mm = p.month.slice(5), yy = p.month.slice(0, 4);
  const logo = (typeof M._logoUrl === 'function') ? M._logoUrl() : '';
  const r2 = x => Math.round((Number(x) || 0) * 100) / 100;

  /* Mục D — chi tiết chấm công, chỉ in khi bảng lương đã nạp từ file Excel
     (lưu ở ln.tkDays). Không có dữ liệu thì bỏ hẳn mục, không in bảng rỗng. */
  const days = Array.isArray(ln.tkDays) ? ln.tkDays : [];
  let detail = '';
  if (days.length) {
    const sum = k => days.reduce((s, d) => s + (Number(d[k]) || 0), 0);
    const tGio = sum('soGio'), tNgay = sum('ngayCong'), tTang = sum('tangCa'),
          tMuon = sum('diMuon'), tPhat = sum('phat');
    // Máy chấm công xuất "Ngày công" (mỗi ngày = 1); file khác có thể xuất "Số giờ".
    // Hiện đúng cột mà dữ liệu thực sự có, không in cột rỗng.
    const dungNgay = tNgay > 0;
    const colLabel = dungNgay ? 'Ngày công' : 'Số giờ';
    const colVal = d => dungNgay ? (Number(d.ngayCong) || '') : (r2(d.soGio) || '');
    const colTong = dungNgay ? tNgay : r2(tGio);
    const lateUnit = ln.tkLateUnit || 'phút';
    const nCong = days.filter(d => Number(d.ngayCong) > 0 || Number(d.soGio) > 0).length;
    detail = `
    <div class="sec-h">D. CHI TIẾT CHẤM CÔNG THÁNG ${mm}/${yy}</div>
    <table class="tk">
      <thead><tr>
        <th style="width:76px">Ngày</th><th style="width:50px">Thứ</th>
        <th style="width:56px">Giờ vào</th><th style="width:56px">Giờ ra</th>
        <th class="r" style="width:66px">${colLabel}</th><th class="r" style="width:82px">Đi muộn (${lateUnit})</th>
        <th class="r" style="width:72px">Tăng ca (giờ)</th><th class="r" style="width:86px">Phạt (đ)</th>
      </tr></thead>
      <tbody>${days.map(d => `<tr>
        <td class="c">${U.esc(String(d.ngay || ''))}</td><td class="c">${U.esc(String(d.thu || ''))}</td>
        <td class="c">${U.esc(String(d.vao || ''))}</td><td class="c">${U.esc(String(d.ra || ''))}</td>
        <td class="r">${colVal(d)}</td><td class="r">${Number(d.diMuon) || ''}</td>
        <td class="r">${r2(d.tangCa) || ''}</td><td class="r">${Number(d.phat) ? U.money(d.phat) : ''}</td>
      </tr>`).join('')}</tbody>
      <tfoot><tr>
        <td colspan="4">Tổng ngày công: <b>${nCong}</b></td>
        <td class="r"><b>${colTong}</b></td><td class="r"><b>${tMuon || 0}</b></td>
        <td class="r"><b>${r2(tTang) || 0}</b></td><td class="r"><b>${U.money(tPhat)}</b></td>
      </tr></tfoot>
    </table>`;
  }

  const row = (no, name, val, note) => `<tr><td class="c">${no}</td><td>${name}</td><td class="r">${val === '' ? '' : U.money(val)}</td><td class="c">${note || ''}</td></tr>`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Phieu luong ${U.esc(e.name || '')} ${mm}-${yy}</title>
    <style>
    @page{size:A4 portrait;margin:12mm}
    *{box-sizing:border-box}
    body{font-family:'Segoe UI',Arial,sans-serif;color:#222;margin:0;padding:18px;background:#fff}
    .head{display:flex;align-items:center;gap:14px;border-bottom:2px solid #7cb342;padding-bottom:10px}
    .head img{height:46px;width:auto}
    .brand{font-weight:700;font-size:17px;color:#5a8e2e;line-height:1.25}
    .brand small{display:block;font-weight:400;font-size:11px;color:#666;letter-spacing:.5px}
    .head .right{margin-left:auto;text-align:right;font-size:11px;color:#666}
    h2{text-align:center;margin:14px 0 4px;font-size:19px;letter-spacing:.4px}
    .period{text-align:center;color:#666;font-size:12px;margin-bottom:12px}
    .info{border:1px solid #d8d8d8;border-radius:6px;padding:9px 12px;font-size:13px;
          display:flex;flex-wrap:wrap;gap:6px 26px;background:#fafcf7}
    table{width:100%;border-collapse:collapse;margin-top:12px}
    th,td{border:1px solid #d0d0d0;padding:5px 8px;font-size:12.5px;vertical-align:top}
    th{background:#eef5e4;font-weight:600;text-align:left}
    .c{text-align:center} .r{text-align:right;white-space:nowrap}
    .sec{background:#f4f4f4;font-weight:700;letter-spacing:.3px}
    .net{margin-top:12px;text-align:right;font-size:16px;font-weight:700;color:#5a8e2e;
         border:2px solid #7cb342;border-radius:6px;padding:9px 14px;background:#f5faee}
    .sec-h{margin-top:20px;font-weight:700;font-size:13.5px;color:#5a8e2e;
           border-left:4px solid #7cb342;padding-left:8px}
    .tk th{background:#f4f8ee;text-align:center}
    .tk tfoot td{background:#f4f4f4;font-weight:600}
    .sign{display:flex;justify-content:space-around;margin-top:34px;text-align:center;font-size:13px}
    .sign i{color:#666;font-size:11.5px}
    .foot{margin-top:22px;border-top:1px solid #e2e2e2;padding-top:6px;font-size:10.5px;color:#888;text-align:center}
    .btnbar{text-align:center;margin-bottom:14px}
    .btnbar button{padding:8px 18px;font-size:14px;border:0;border-radius:6px;background:#7cb342;color:#fff;cursor:pointer}
    tr{break-inside:avoid;page-break-inside:avoid}
    thead{display:table-header-group}
    .sec-h,.net{break-after:avoid;page-break-after:avoid}
    @media print{.btnbar{display:none}body{padding:0}}
    </style></head><body>
    <div class="btnbar"><button onclick="window.print()">🖨️ In / Lưu PDF</button></div>
    <div class="head">
      ${logo ? `<img src="${logo}" alt="DALI">` : ''}
      <div class="brand">DALI<small>TÔ ĐIỂM CUỘC SỐNG</small></div>
      <div class="right">Mã NV: <b>${U.esc(e.code || '')}</b><br>Kỳ lương: <b>${mm}/${yy}</b></div>
    </div>
    <h2>PHIẾU LƯƠNG THÁNG ${mm}/${yy}</h2>
    <div class="period">Kỳ tính lương: 01/${mm}/${yy} — hết tháng ${mm}/${yy}</div>
    <div class="info">
      <span><b>Họ và tên:</b> ${U.esc(e.name || '')}</span>
      <span><b>Mã NV:</b> ${U.esc(e.code || '')}</span>
      <span><b>Chức vụ:</b> ${U.esc(e.position || '')}</span>
    </div>
    <table>
      <thead><tr><th class="c" style="width:36px">STT</th><th>Nội dung</th><th class="r" style="width:120px">Số tiền</th><th class="c" style="width:120px">Ghi chú</th></tr></thead>
      <tr><td colspan="4" class="sec">A. THÔNG TIN CÔNG / MỨC LƯƠNG</td></tr>
      ${row(1, Number(e.dayWage || 0) > 0 ? 'Đơn giá ngày công' : 'Lương cơ bản', Number(e.dayWage || 0) > 0 ? e.dayWage : (e.salaryBase || 0), '')}
      ${row(2, 'Ngày công chuẩn trong tháng', '', String(p.standardDays))}
      ${row(3, 'Tổng ngày công thực tế', '', String(ln.totalDays))}
      ${row(4, 'Ngày công có phụ cấp', '', String(ln.allowDays))}
      ${row(5, 'Lương theo ngày', Math.round(r.dayWage), '')}
      ${row(6, 'Lương theo giờ', Math.round(r.hourWage), '')}
      <tr><td colspan="4" class="sec">B. CÁC KHOẢN THỰC NHẬN</td></tr>
      ${row(1, 'Lương chính', Math.round(r.luongChinh), '')}
      ${row(2, 'Lương trách nhiệm', Math.round(r.luongTN), '')}
      ${row(3, 'Thưởng doanh số', r.thuong, '')}
      ${row(4, 'Làm thêm giờ', Math.round(r.lamThem), ln.otHours ? ln.otHours + ' giờ' : '')}
      ${row(5, 'Phụ cấp xăng xe', Math.round(r.pcXang), '')}
      ${row(6, 'Phụ cấp ăn trưa', Math.round(r.pcAn), '')}
      ${row(7, 'Phụ cấp thâm niên', Math.round(r.pcTN), '')}
      <tr><td colspan="4" class="sec">C. CÁC KHOẢN GIẢM TRỪ</td></tr>
      ${row(1, 'Phạt đi muộn', r.phat, '')}
      ${row(2, 'BHXH', r.bhxh, '')}
      ${row(3, 'Ứng lương', r.ung, '')}
      ${row(4, 'Dùng ĐT trong giờ làm', r.dt, '')}
    </table>
    <div class="net">THỰC LĨNH: ${U.money(r.thucLinh)} đ</div>
    ${detail}
    <div class="sign">
      <div>Người nhận<br><i>(Ký, ghi rõ họ tên)</i></div>
      <div>Người lập<br><i>(Ký, ghi rõ họ tên)</i></div>
    </div>
    <div class="foot">Phiếu lương do phần mềm kế toán DALI lập ngày ${U.date(U.today())} · Vui lòng đối chiếu và phản hồi trong 03 ngày làm việc.</div>
    <script>window.onload=function(){window.print();}</script></body></html>`;
  const w = window.open('', '_blank');
  if (!w) return U.toast('Trình duyệt chặn cửa sổ in. Hãy cho phép pop-up.', 'error');
  w.document.write(html); w.document.close();
};

/* ============================================================
   KẾT NỐI DỮ LIỆU CHẤM CÔNG (mau.tranhdali.vn/api/luong)
   Bộ ánh xạ linh hoạt: tự nhận nhiều kiểu tên trường.
   ============================================================ */

// Chuyển giá trị về số (chấp nhận "25,75" kiểu VN, "1.000", số thật)
M._tkNum = function (v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return v;
  let s = String(v).trim();
  if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.'); // VN: . ngăn nghìn, , thập phân
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
};
function _pick(obj, keys) {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
    // thử không phân biệt hoa thường
    const found = Object.keys(obj).find(o => o.toLowerCase() === k.toLowerCase());
    if (found && obj[found] !== '' && obj[found] != null) return obj[found];
  }
  return undefined;
}

// Lấy mảng bản ghi từ nhiều dạng JSON khác nhau
M.tkExtractList = function (raw) {
  if (Array.isArray(raw)) return raw;
  if (!raw || typeof raw !== 'object') return [];
  const cands = ['data', 'employees', 'nhanvien', 'nhan_vien', 'result', 'results', 'items', 'rows', 'list', 'luong', 'salary', 'cham_cong', 'chamcong'];
  for (const k of cands) if (Array.isArray(raw[k])) return raw[k];
  if (raw.data && typeof raw.data === 'object') for (const k of cands) if (Array.isArray(raw.data[k])) return raw.data[k];
  const vals = Object.values(raw).filter(v => v && typeof v === 'object');
  if (vals.length && vals.every(v => !Array.isArray(v))) return vals;
  return [];
};

// Chuẩn hóa 1 bản ghi chấm công -> {code, name, totalDays, allowDays, otHours, lateFine}
// Hỗ trợ cả dạng lồng của mau.tranhdali.vn: { user, attendance:{work_days, ot_hours, late_fine}, piece:{...} }
M.tkNormalize = function (r) {
  r = r || {};
  const att = (r.attendance && typeof r.attendance === 'object') ? r.attendance : {};
  const pie = (r.piece && typeof r.piece === 'object') ? r.piece : {};
  const flat = Object.assign({}, pie, att, r); // gộp field lồng lên mức phẳng
  const code = _pick(flat, ['user', 'username', 'ma', 'maNV', 'ma_nv', 'maNhanVien', 'ma_nhan_vien', 'code', 'employeeCode', 'msnv', 'id', 'manv']);
  const name = _pick(flat, ['user', 'username', 'ten', 'tenNV', 'ten_nv', 'tenNhanVien', 'hoTen', 'ho_ten', 'hoVaTen', 'name', 'fullname', 'full_name', 'tennhanvien']);
  const wd = M._tkNum(_pick(flat, ['work_days', 'workDays', 'ngay_cong_thuc_te', 'di_lam', 'diLam', 'ngay_di_lam', 'days']));
  let total = M._tkNum(_pick(flat, ['tong_ngay_cong', 'tongNgayCong', 'tong_ngay_cong_thuc_te', 'tongNgayCongThucTe', 'tong_cong', 'totalDays']));
  let allow = M._tkNum(_pick(flat, ['ngay_cong_phu_cap', 'ngay_cong_co_phu_cap', 'ngayCongPhuCap', 'ngay_cong_thuc_te', 'allowDays', 'ngay_cong', 'ngayCong', 'cong']));
  if (total == null) total = wd;
  if (allow == null) allow = (wd != null ? wd : total);
  return {
    code: code, name: name, totalDays: total, allowDays: allow,
    otHours: M._tkNum(_pick(flat, ['ot_hours', 'otHours', 'tang_ca', 'tang_ca_gio', 'gio_tang_ca', 'gioTangCa', 'overtime', 'overtime_hours', 'tangCa', 'tangca'])),
    lateFine: M._tkNum(_pick(flat, ['late_fine', 'lateFine', 'phat_di_muon', 'phatDiMuon', 'phat'])),
    lateMinutes: M._tkNum(_pick(flat, ['late_minutes', 'lateMinutes', 'phut_di_muon'])),
    _raw: r,   // giữ bản ghi gốc để móc chi tiết từng ngày (tkExtractDays)
  };
};

/* Lấy CHI TIẾT TỪNG NGÀY từ 1 bản ghi nhân viên của API chấm công.
   Mỗi phần mềm chấm công đặt tên trường một kiểu nên dò theo nhiều bí danh,
   giống cách tkNormalize đang làm với số tổng.
   Trả { rows, lateUnit }; rows rỗng = API chưa trả chi tiết ngày. */
M.tkExtractDays = function (rec) {
  if (!rec || typeof rec !== 'object') return { rows: [], lateUnit: 'lần' };
  const cands = ['days', 'chi_tiet', 'chiTiet', 'details', 'detail', 'records', 'logs',
                 'attendances', 'attendance_days', 'by_day', 'danh_sach_ngay', 'ngay_cong_chi_tiet'];
  let arr = null;
  const pools = [rec, rec.attendance, rec.data].filter(x => x && typeof x === 'object');
  for (const pool of pools) { for (const k of cands) { if (Array.isArray(pool[k])) { arr = pool[k]; break; } } if (arr) break; }
  if (!arr || !arr.length) return { rows: [], lateUnit: 'lần' };

  // Đơn vị đi muộn: có trường phút thì là phút, ngược lại hiểu là số lần
  const probe = arr[0] || {};
  const lateUnit = (_pick(probe, ['late_minutes', 'phut_di_muon', 'so_phut_di_muon']) !== undefined) ? 'phút' : 'lần';

  const rows = arr.map(d => ({
    ngay: String(_pick(d, ['ngay', 'date', 'day', 'work_date', 'ngay_lam', 'checkin_date']) || ''),
    thu: String(_pick(d, ['thu', 'weekday', 'day_of_week', 'dow']) || ''),
    vao: String(_pick(d, ['vao', 'gio_vao', 'checkin', 'check_in', 'time_in', 'gioVao']) || ''),
    ra: String(_pick(d, ['ra', 'gio_ra', 'checkout', 'check_out', 'time_out', 'gioRa']) || ''),
    ngayCong: M._tkNum(_pick(d, ['ngay_cong', 'ngayCong', 'work_day', 'workday', 'cong', 'day_count'])) || 0,
    soGio: M._tkNum(_pick(d, ['so_gio', 'soGio', 'hours', 'work_hours', 'gio_lam'])) || 0,
    diMuon: M._tkNum(_pick(d, ['di_muon', 'diMuon', 'late', 'late_count', 'so_lan_muon', 'late_minutes', 'phut_di_muon'])) || 0,
    tangCa: M._tkNum(_pick(d, ['tang_ca', 'tangCa', 'ot', 'ot_hours', 'overtime', 'overtime_hours'])) || 0,
    phat: M._tkNum(_pick(d, ['phat', 'fine', 'late_fine', 'tien_phat'])) || 0,
  })).filter(d => d.ngay || d.vao || d.ngayCong || d.soGio);
  return { rows: rows, lateUnit: lateUnit };
};

function _norm(s) { return String(s == null ? '' : s).trim().toLowerCase().replace(/\s+/g, ' '); }

// Ghép dữ liệu chấm công vào các dòng lương + báo cáo
// silent=true: không hiện thông báo (dùng cho tự động làm mới)
M.tkApplyAndReport = function (p, rawList, silent, chiTiet) {
  const recs = (rawList || []).map(M.tkNormalize);
  if (!recs.length) { if (!silent) U.toast('Không đọc được dữ liệu nhân viên từ nguồn chấm công', 'error'); return; }
  // Đồng bộ: thêm dòng cho nhân viên hiện tại CHƯA có trong bảng lương (để nạp được chấm công của NV mới thêm)
  let added = 0;
  (PW.data.employees || []).forEach(e => {
    if (!p.lines.some(ln => ln.employeeId === e.id)) {
      p.lines.push({ employeeId: e.id, totalDays: 0, allowDays: 0, otHours: 0, bonus: 0, extra: 0, lateFine: 0, bhxh: 0, advance: 0, phoneUse: 0, note: '' });
      added++;
    }
  });
  let matched = 0; const unmatched = [];
  recs.forEach(rec => {
    let line = null;
    // 1) theo mã chấm công / mã NV
    if (rec.code != null) {
      line = p.lines.find(ln => { const e = empById(ln.employeeId); return e && (_norm(e.tkCode) === _norm(rec.code) || _norm(e.code) === _norm(rec.code)); });
    }
    // 2) theo tên
    if (!line && rec.name) {
      line = p.lines.find(ln => { const e = empById(ln.employeeId); return e && _norm(e.name) === _norm(rec.name); });
    }
    if (line) {
      if (rec.totalDays != null) line.totalDays = rec.totalDays;
      line.allowDays = (rec.allowDays != null) ? rec.allowDays : (rec.totalDays != null ? rec.totalDays : line.allowDays);
      if (rec.otHours != null) line.otHours = rec.otHours;
      if (rec.lateFine != null && rec.lateFine > 0) line.lateFine = rec.lateFine;
      // Lưu chi tiết ngày công (sheet "Chi tiết") vào chính dòng lương -> phiếu lương
      // in kèm được. Trước đây dữ liệu này chỉ sống trong wizard rồi mất.
      if (chiTiet) {                       // nguồn: file Excel (sheet Chi tiết)
        const ct = chiTiet[_norm(rec.code)] || chiTiet[_norm(rec.name)];
        if (ct && ct.rows && ct.rows.length) { line.tkDays = ct.rows; line.tkLateUnit = ct.lateUnit || 'phút'; }
      } else {                             // nguồn: API phần mềm chấm công
        const dd = M.tkExtractDays(rec._raw);
        if (dd.rows.length) { line.tkDays = dd.rows; line.tkLateUnit = dd.lateUnit; }
      }
      matched++;
    } else {
      unmatched.push(rec.name || rec.code || '(không rõ)');
    }
  });
  PW.save();
  M.payrollDetail(p.id); // dựng lại bảng để hiện số mới
  if (silent) return;
  let msg = 'Đã cập nhật chấm công cho ' + matched + '/' + recs.length + ' nhân viên.';
  if (added) msg += ' Đã thêm ' + added + ' nhân viên mới vào bảng lương.';
  if (unmatched.length) msg += ' Chưa khớp (' + unmatched.length + '): ' + unmatched.slice(0, 6).join(', ') + (unmatched.length > 6 ? '...' : '') + '. Hãy điền "Mã chấm công" cho NV này trong Danh mục.';
  U.toast(msg, unmatched.length ? 'error' : 'success');
};

// Lấy chấm công im lặng (dùng cho tự động làm mới)
M.payrollImportServerSilent = async function (p) {
  if (PW.mode !== 'server') return;
  const r = await PW.api('timekeeping.php?month=' + p.month);
  if (r.status !== 200 || !r.data || !r.data.ok || r.data.raw != null) return;
  M.tkApplyAndReport(p, M.tkExtractList(r.data.data), true);
};

// Lấy tự động từ server (proxy PHP)
M.payrollImportServer = async function (p) {
  if (PW.mode !== 'server') {
    return U.toast('Lấy tự động chỉ chạy khi phần mềm chạy trên server (ketoan.tranhdali.vn). Hãy dùng nút "Dán chấm công".', 'error');
  }
  U.toast('Đang lấy dữ liệu chấm công tháng ' + p.month + '...');
  const r = await PW.api('timekeeping.php?month=' + p.month);
  if (r.status !== 200 || !r.data || !r.data.ok) {
    return U.toast((r.data && r.data.error) || 'Lỗi gọi API chấm công', 'error');
  }
  if (r.data.raw != null) {
    return U.toast('Nguồn chấm công trả về không phải JSON. Hãy gửi tôi mẫu dữ liệu để chỉnh.', 'error');
  }
  const list = M.tkExtractList(r.data.data);
  const coChiTiet = list.some(x => M.tkExtractDays(x).rows.length);
  M.tkApplyAndReport(p, list);
  if (!coChiTiet) {
    U.toast('Đã lấy SỐ TỔNG. API chấm công chưa trả chi tiết từng ngày nên phiếu lương sẽ '
      + 'không có mục "Chi tiết chấm công" — bấm "🔍 Dữ liệu thô" để xem API đang trả gì.', 'error');
  }
};

/* Xem nguyên văn JSON mà API chấm công trả về — để biết cần map thêm trường nào
   khi phiếu lương thiếu chi tiết ngày. */
M.payrollRawTk = async function (p) {
  if (PW.mode !== 'server') return U.toast('Chỉ xem được khi chạy trên server.', 'error');
  const r = await PW.api('timekeeping.php?month=' + p.month);
  if (r.status !== 200 || !r.data) return U.toast('Không gọi được API chấm công', 'error');
  const txt = r.data.raw != null ? String(r.data.raw) : JSON.stringify(r.data.data, null, 2);
  const list = r.data.raw != null ? [] : M.tkExtractList(r.data.data);
  const ta = U.el('textarea', { style: 'width:100%;height:340px;font-family:monospace;font-size:12px' });
  ta.value = txt.length > 60000 ? txt.slice(0, 60000) + '\n... (đã cắt bớt)' : txt;
  const dd = list.length ? M.tkExtractDays(list[0]) : { rows: [], lateUnit: '' };
  const body = U.el('div', null, [
    U.el('div', { class: 'section-sub' }, 'Tháng ' + p.month + ' · ' + list.length + ' bản ghi nhân viên · '
      + (dd.rows.length ? '✓ CÓ chi tiết ngày (' + dd.rows.length + ' dòng ở NV đầu tiên, đi muộn tính theo ' + dd.lateUnit + ')'
                        : '✗ KHÔNG thấy chi tiết từng ngày — API chỉ trả số tổng')),
    ta,
  ]);
  C.modal({ title: '🔍 Dữ liệu thô từ API chấm công', wide: true, body,
    footer: [C.btn('Sao chép', () => { ta.select(); document.execCommand('copy'); U.toast('Đã sao chép'); }),
             C.btn('Đóng', C.closeModal, 'primary')] });
};

// Dán JSON chấm công thủ công (dùng được cả offline)
M.payrollPasteTK = function (p) {
  const ta = C.textarea({ rows: 10, placeholder: 'Dán nội dung JSON từ:\nhttps://mau.tranhdali.vn/api/luong?key=...&month=' + p.month });
  ta.style.fontFamily = 'monospace'; ta.style.fontSize = '12px';
  const body = U.el('div', null, [
    U.el('div', { class: 'section-sub' }, 'Mở link API chấm công (có khoá) trên trình duyệt, copy toàn bộ kết quả JSON rồi dán vào đây. Hệ thống sẽ tự điền ngày công, tăng ca cho nhân viên khớp.'),
    ta,
  ]);
  C.modal({
    title: '📋 Dán dữ liệu chấm công (JSON)', wide: true, body,
    footer: [C.btn('Hủy', C.closeModal), C.btn('Đọc & điền', () => {
      let data;
      try { data = JSON.parse(ta.value); }
      catch (e) { return U.toast('JSON không hợp lệ', 'error'); }
      C.closeModal();
      M.tkApplyAndReport(p, M.tkExtractList(data));
    }, 'primary')],
  });
};

/* ==================================================================
   NHẬP EXCEL BẢNG CÔNG + HẬU KIỂM (chống lỗi trước khi chốt lương)
   ================================================================== */
// Số ngày trong tháng 'YYYY-MM'
M._daysInMonth = function (ym) {
  const y = Number((ym || '').slice(0, 4)), mo = Number((ym || '').slice(5, 7));
  if (!y || !mo) return 31;
  return new Date(y, mo, 0).getDate();
};
// Khớp 1 mã chấm công (từ file) -> nhân viên: ưu tiên tkCode, rồi mã NV, rồi tên
M.payrollMatchEmp = function (code) {
  const c = _norm(code);
  if (!c) return null;
  return PW.data.employees.find(e => _norm(e.tkCode) === c || _norm(e.code) === c)
      || PW.data.employees.find(e => _norm(e.name) === c) || null;
};
// Đọc file .xlsx bảng công -> chọn sheet "Tổng hợp" (theo tên hoặc tiêu đề), trả { lines, sheetName }
M.payrollReadCongFile = async function (file) {
  const sheets = await M._ciXlsxAllSheets(file);
  if (!sheets.length) throw new Error('File Excel không có worksheet nào.');
  const looksSummary = lines => (lines || []).slice(0, 6).some(l => {
    const n = M._ciNorm(l);
    return /ngay cong/.test(n) && !/gio vao|gio ra/.test(n);
  });
  const looksDetail = lines => (lines || []).slice(0, 6).some(l => /gio vao|gio ra/.test(M._ciNorm(l)));
  // Ưu tiên theo NỘI DUNG (tiêu đề tổng hợp) — chắc chắn đúng dữ liệu; rồi mới theo tên
  const picked = sheets.find(s => looksSummary(s.lines) && /tong hop/.test(M._ciNorm(s.name)))
    || sheets.find(s => looksSummary(s.lines))
    || sheets.find(s => /tong hop/.test(M._ciNorm(s.name))) || sheets[0];
  const det = sheets.find(s => s !== picked && (looksDetail(s.lines) || /chi tiet/.test(M._ciNorm(s.name))));
  return { lines: picked.lines, sheetName: picked.name, detail: det ? { lines: det.lines, sheetName: det.name } : null };
};
// Parse sheet Chi tiết (từng ngày) -> { byEmp: { normCode: {name, days, tongGio, tangCa, phat, rows[]} }, headerFound }
M.payrollParseChiTiet = function (lines) {
  let hi = -1; const col = {};
  let lateUnit = 'phút';   // "Đi muộn Lần" đếm số LẦN, "Đi muộn (phút)" đếm phút — nhãn khác nhau
  for (let i = 0; i < Math.min((lines || []).length, 8); i++) {
    const cells = (M._ciSplitCells(lines[i]) || []).map(c => M._ciNorm(c));
    if (cells.some(c => /gio vao|so gio|ngay cong/.test(c)) && cells.some(c => /nhan vien|ho ten/.test(c))) {
      cells.forEach((c, idx) => {
        // "ngay cong" phải xét TRƯỚC /^ngay\b/, nếu không sẽ bị nhận nhầm thành cột Ngày
        if (/ngay cong/.test(c) && col.ngayCong == null) col.ngayCong = idx;
        else if (/^ngay\b/.test(c) && col.ngay == null) col.ngay = idx;
        else if (/^thu\b/.test(c) && col.thu == null) col.thu = idx;
        else if (/(nhan vien|ho ten)/.test(c) && col.nv == null) col.nv = idx;
        else if (/gio vao/.test(c) && col.vao == null) col.vao = idx;
        else if (/gio ra/.test(c) && col.ra == null) col.ra = idx;
        else if (/so gio/.test(c) && col.soGio == null) col.soGio = idx;
        else if (/di muon/.test(c) && col.diMuon == null) { col.diMuon = idx; if (/\blan\b/.test(c)) lateUnit = 'lần'; }
        else if (/tang ca/.test(c) && col.tangCa == null) col.tangCa = idx;
        else if (/phat/.test(c) && col.phat == null) col.phat = idx;
      });
      hi = i; break;
    }
  }
  // Máy chấm công xuất cột "Ngày công" (mỗi ngày = 1) chứ không phải "Số giờ" -> chấp nhận cả hai
  if (hi < 0 || col.nv == null || (col.soGio == null && col.ngayCong == null)) return { byEmp: {}, headerFound: false };
  const byEmp = {};
  const g = (cells, idx) => (idx != null ? (M._tkNum(cells[idx]) || 0) : 0);
  for (let i = hi + 1; i < lines.length; i++) {
    const cells = M._ciSplitCells(lines[i]) || [];
    const code = String(cells[col.nv] || '').trim();
    if (!code) continue;
    const k = _norm(code);
    // Bỏ các dòng tổng hợp cuối bảng (Tổng / Cộng / Nghỉ lễ / Tổng ngày công)
    if (/^(tong|cong|nghi le)\b/.test(k)) continue;
    const soGio = g(cells, col.soGio), ngayCong = g(cells, col.ngayCong),
          tangCa = g(cells, col.tangCa), phat = g(cells, col.phat);
    const e = byEmp[k] || (byEmp[k] = { name: code, days: 0, tongGio: 0, tongNgay: 0,
      tangCa: 0, phat: 0, lateUnit: lateUnit, rows: [] });
    if (soGio > 0 || ngayCong > 0) e.days++;
    e.tongGio += soGio; e.tongNgay += ngayCong; e.tangCa += tangCa; e.phat += phat;
    e.rows.push({ ngay: col.ngay != null ? cells[col.ngay] : '', thu: col.thu != null ? cells[col.thu] : '',
      vao: col.vao != null ? cells[col.vao] : '', ra: col.ra != null ? cells[col.ra] : '',
      soGio: soGio, ngayCong: ngayCong, diMuon: g(cells, col.diMuon), tangCa: tangCa, phat: phat });
  }
  return { byEmp: byEmp, headerFound: true };
};
// Modal chi tiết ngày công 1 nhân viên (từ sheet Chi tiết) — mở lớp 2, không đóng wizard
M.payrollDayDetail = function (title, ct) {
  const r2 = x => Math.round((x || 0) * 100) / 100, r1 = x => Math.round((x || 0) * 10) / 10;
  const body = U.el('div');
  // Cột đo công: máy chấm công cho "Ngày công", file khác cho "Số giờ" — hiện đúng cái đang có
  const dungNgay = (ct.tongNgay || 0) > 0;
  const donVi = ct.lateUnit || 'phút';
  body.appendChild(U.el('div', { class: 'section-sub' }, ct.days + ' ngày có công · '
    + (dungNgay ? 'tổng ' + r2(ct.tongNgay) + ' ngày công' : 'tổng ' + r1(ct.tongGio) + 'h')
    + ' · tăng ca ' + r1(ct.tangCa) + 'h · phạt ' + U.money(ct.phat) + 'đ'));
  body.appendChild(C.table(ct.rows, [
    { label: 'Ngày', render: r => U.esc(String(r.ngay || '')) },
    { label: 'Thứ', center: true, render: r => U.esc(String(r.thu || '')) },
    { label: 'Giờ vào', center: true, render: r => U.esc(String(r.vao || '')) },
    { label: 'Giờ ra', center: true, render: r => U.esc(String(r.ra || '')) },
    { label: dungNgay ? 'Ngày công' : 'Số giờ', num: true, render: r => dungNgay ? (Number(r.ngayCong) || 0) : r2(r.soGio) },
    { label: 'Đi muộn (' + donVi + ')', num: true, render: r => r.diMuon || 0 },
    { label: 'Tăng ca (giờ)', num: true, render: r => r2(r.tangCa) },
    { label: 'Phạt', num: true, render: r => U.money(r.phat || 0) },
  ], { empty: '—' }));
  C.miniModal({ title: '📅 Chi tiết ngày công — ' + title, wide: true, body, footer: [C.btn('Đóng', C.closeMini, 'primary')] });
};
// Parse sheet Tổng hợp -> { recs, month, headerFound }
M.payrollParseCong = function (lines, fileName) {
  let month = null;
  (lines || []).slice(0, 3).forEach(l => {
    const m = l.match(/th[aá]ng\s*(\d{1,2})\s*[\/\-.]\s*(\d{4})/i);
    if (m) month = m[2] + '-' + String(m[1]).padStart(2, '0');
  });
  if (!month && fileName) { const m = String(fileName).match(/(\d{4})[-_.](\d{1,2})/); if (m) month = m[1] + '-' + String(m[2]).padStart(2, '0'); }
  let hi = -1; const col = {};
  for (let i = 0; i < Math.min((lines || []).length, 8); i++) {
    const cells = (M._ciSplitCells(lines[i]) || []).map(c => M._ciNorm(c));
    if (cells.some(c => /ngay cong/.test(c))) {
      cells.forEach((c, idx) => {   // cột ĐẦU khớp thắng (== null) -> tránh cột 'Ngày công phép/thực tế' đè
        if (/ngay cong/.test(c) && col.ngay == null) col.ngay = idx;
        else if (/tong gio/.test(c) && col.tongGio == null) col.tongGio = idx;
        else if (/tien tang ca/.test(c) && col.tienTC == null) col.tienTC = idx;   // specific TRƯỚC 'tang ca'
        else if (/tang ca/.test(c) && col.tangCa == null) col.tangCa = idx;
        else if (/di muon/.test(c) && col.diMuon == null) col.diMuon = idx;
        else if (/phat/.test(c) && col.phat == null) col.phat = idx;
        else if (/(nhan vien|ho ten|^ten|^ma)/.test(c) && col.ma == null) col.ma = idx;
      });
      hi = i; break;
    }
  }
  if (hi < 0 || col.ngay == null) return { recs: [], month: month, headerFound: false };
  if (col.ma == null) col.ma = 0;   // cột A = mã chấm công
  const recs = [];
  for (let i = hi + 1; i < lines.length; i++) {
    const cells = M._ciSplitCells(lines[i]) || [];
    const code = String(cells[col.ma] || '').trim();
    if (!code) continue;
    if (/^(tong|cong|sum)\b|tong cong/.test(M._ciNorm(code))) continue;   // bỏ dòng tổng/cộng
    const num = idx => (idx != null ? M._tkNum(cells[idx]) : null);
    recs.push({
      code: code, name: code,   // name = giá trị cột định danh -> Áp dụng khớp được cả khi file dùng cột 'Họ tên'
      totalDays: num(col.ngay), allowDays: num(col.ngay),
      otHours: col.tangCa != null ? num(col.tangCa) : null,
      lateFine: col.phat != null ? num(col.phat) : null,
      tongGio: col.tongGio != null ? num(col.tongGio) : null,
      diMuonPhut: col.diMuon != null ? num(col.diMuon) : null,
      tienTC: col.tienTC != null ? num(col.tienTC) : null,
    });
  }
  return { recs: recs, month: month, headerFound: true };
};
// HẬU KIỂM: trả { red:[], orange:[], counts }. ctx (khi import) = { recs, monthFile }
M.payrollAudit = function (p, ctx) {
  ctx = ctx || {};
  const red = [], orange = [];
  const push = (arr, ma, msg, empId) => arr.push({ ma: ma, msg: msg, employeeId: empId || null });
  const sd = Number(p.standardDays) || 0;
  const dim = M._daysInMonth(p.month);

  if (ctx.recs) {
    if (ctx.monthFile && ctx.monthFile !== p.month)
      push(red, 'KY01', 'File là chấm công tháng ' + ctx.monthFile + ' nhưng bảng lương đang mở là tháng ' + p.month + ' — nạp nhầm kỳ sẽ sai toàn bộ.');
    const seen = {};
    ctx.recs.forEach(r => { const c = _norm(r.code); seen[c] = (seen[c] || 0) + 1; });
    Object.keys(seen).forEach(c => { if (seen[c] > 1) push(orange, 'KH04', 'Mã "' + c + '" xuất hiện ' + seen[c] + ' dòng trong file — chỉ dòng cuối được áp dụng.'); });
    ctx.recs.forEach(r => {
      const emp = M.payrollMatchEmp(r.code);
      if (!emp) { push(red, 'KH01', 'Dòng "' + r.code + '" trong file không khớp nhân viên nào (sai/thiếu "Mã chấm công").'); return; }
      const nm = emp.name, td = Number(r.totalDays || 0), ot = Number(r.otHours || 0);
      if (r.totalDays == null) push(orange, 'NC02', nm + ': không đọc được ngày công (ô trống/chứa chữ) — sẽ GIỮ số cũ khi áp dụng, không cập nhật.', emp.id);
      if (r.totalDays != null && r.totalDays < 0) push(red, 'NC01', nm + ': ngày công âm (' + r.totalDays + ').', emp.id);
      if (td > dim) push(red, 'NC03', nm + ': ' + td + ' ngày công > số ngày của tháng (' + dim + ') — chắc chắn sai.', emp.id);
      else if (sd && td > sd) push(orange, 'NC04', nm + ': ' + td + ' ngày công > ngày công chuẩn (' + sd + ') → lương chính vượt 100%.', emp.id);
      if (td === 0) push(orange, 'NC06', nm + ': 0 ngày công trong file — nghỉ cả tháng hay thiếu dữ liệu?', emp.id);
      if (r.tongGio != null && td > 0) {
        if (r.tongGio === 0) push(red, 'GC01', nm + ': ' + td + ' ngày công nhưng 0 giờ — mâu thuẫn (thiếu giờ vào/ra).', emp.id);
        else { const h = r.tongGio / td; if (h < 4 || h > 13) push(orange, 'GC02', nm + ': TB ' + (Math.round(h * 10) / 10) + ' giờ/ngày — ngoài khoảng thường (4–13h).', emp.id); }
      }
      if (ot > 0 && td === 0) push(red, 'TC02', nm + ': có tăng ca ' + ot + 'h nhưng 0 ngày công — mâu thuẫn.', emp.id);
      if (ot > 60 || (td > 0 && ot > td * 4)) push(orange, 'TC01', nm + ': tăng ca ' + ot + ' giờ — cao bất thường, xác nhận số liệu.', emp.id);
      if (r.tienTC != null && r.tienTC > 0 && ot > 0) push(orange, 'TC03', nm + ': file có "Tiền tăng ca" ' + U.money(r.tienTC) + 'đ nhưng phần mềm TỰ tính tiền OT theo số giờ — chỉ dùng 1 nguồn (đang dùng số giờ).', emp.id);
      if (r.lateFine != null && r.lateFine < 0) push(red, 'PH01', nm + ': tiền phạt âm.', emp.id);
      // Đối chiếu Tổng hợp ↔ Chi tiết (nếu file có sheet Chi tiết)
      const ct = ctx.chiTiet && ctx.chiTiet[_norm(r.code)];
      if (ct) {
        const r1 = x => Math.round(x * 10) / 10;
        if (r.totalDays != null && Math.abs(td - ct.days) >= 1) push(orange, 'RC01', nm + ': ngày công Tổng hợp (' + td + ') ≠ số ngày có chấm công ở Chi tiết (' + ct.days + ').', emp.id);
        if (r.tongGio != null && Math.abs(r.tongGio - ct.tongGio) > 0.5) push(orange, 'RC02', nm + ': tổng giờ Tổng hợp (' + r1(r.tongGio) + 'h) ≠ cộng từng ngày ở Chi tiết (' + r1(ct.tongGio) + 'h).', emp.id);
        if (r.otHours != null && Math.abs(ot - ct.tangCa) > 0.05) push(orange, 'RC03', nm + ': tăng ca Tổng hợp (' + r1(ot) + 'h) ≠ cộng Chi tiết (' + r1(ct.tangCa) + 'h).', emp.id);
        if (r.lateFine != null && Math.abs((r.lateFine || 0) - ct.phat) > 0) push(orange, 'RC03', nm + ': phạt Tổng hợp (' + U.money(r.lateFine || 0) + ') ≠ cộng Chi tiết (' + U.money(ct.phat) + ').', emp.id);
      }
    });
  }

  if (p.paidDate) push(red, 'IM05', 'Bảng lương tháng ' + p.month + ' ĐÃ ghi chi lương ngày ' + U.date(p.paidDate) + ' — sửa/nạp lúc này gây lệch số đã chi.');
  if (sd <= 0) push(red, 'CH03', 'Ngày công chuẩn = ' + p.standardDays + ' không hợp lệ → phụ cấp & lương tháng chia sai.');
  const tkMap = {};
  PW.data.employees.forEach(e => { const c = _norm(e.tkCode); if (c) (tkMap[c] = tkMap[c] || []).push(e.name); });
  Object.keys(tkMap).forEach(c => { if (tkMap[c].length > 1) push(red, 'KH03', 'Mã chấm công "' + c + '" bị TRÙNG ở: ' + tkMap[c].join(', ') + ' — dữ liệu sẽ ghi nhầm người.'); });
  (p.lines || []).forEach(ln => {
    const e = empById(ln.employeeId);
    if (!e) { push(red, 'KH07', 'Có dòng lương trỏ tới nhân viên đã bị xóa — gỡ dòng hoặc khôi phục NV.', ln.employeeId); return; }
    const td = Number(ln.totalDays || 0), ad = Number(ln.allowDays || 0);
    if (ad > td) push(red, 'NC05', e.name + ': ngày có phụ cấp (' + ad + ') > tổng ngày công (' + td + ') — vô lý.', e.id);
    if (td > 0 && !(Number(e.salaryBase) > 0) && !(Number(e.dayWage) > 0)) push(red, 'CH01', e.name + ': có ' + td + ' ngày công nhưng chưa khai "Lương cơ bản/tháng" lẫn "Lương theo ngày" → lương chính = 0đ.', e.id);
    else if (Number(e.salaryBase) > 0 && Number(e.dayWage) > 0) push(orange, 'CH02', e.name + ': khai cả Lương cơ bản/tháng lẫn Lương theo ngày — phần mềm chỉ dùng Lương theo ngày.', e.id);
    const r = M.payrollCompute(e, ln, p.standardDays);
    if (r.thucLinh < 0) push(red, 'TL01', e.name + ': THỰC LĨNH ÂM (' + U.money(r.thucLinh) + 'đ) — các khoản trừ vượt thu nhập.', e.id);
    else if (r.thucLinh === 0 && td > 0) push(orange, 'TL02', e.name + ': thực lĩnh 0đ dù có ' + td + ' ngày công.', e.id);
    if (ctx.recs && td === 0 && !ctx.recs.some(rc => M.payrollMatchEmp(rc.code) === e))
      push(orange, 'KH02', e.name + ': không có dữ liệu chấm công trong file (đang 0 ngày) — đã nghỉ việc hay bị bỏ sót?', e.id);
  });

  return { red: red, orange: orange, counts: { red: red.length, orange: orange.length } };
};
// Mở bảng hậu kiểm độc lập (kiểm bảng lương hiện tại trước khi chốt)
M.payrollAuditModal = function (p) {
  const audit = M.payrollAudit(p);
  const body = U.el('div');
  body.appendChild(U.el('div', { class: 'section-sub', html: 'Hậu kiểm bảng lương tháng ' + p.month.slice(5) + '/' + p.month.slice(0, 4) + ': '
    + (audit.counts.red ? '<span class="text-red">🔴 ' + audit.counts.red + ' lỗi chặn</span> · ' : '')
    + '<span style="color:#c77f0a">🟡 ' + audit.counts.orange + ' nhắc</span>'
    + (!audit.counts.red && !audit.counts.orange ? ' — <span class="text-green">✓ không phát hiện lỗi, có thể chốt lương</span>' : '') }));
  const list = U.el('div', { style: 'max-height:360px;overflow:auto;margin-top:8px' });
  audit.red.forEach(a => list.appendChild(U.el('div', { style: 'padding:4px 0', html: '<span class="tag red">' + a.ma + '</span> ' + U.esc(a.msg) })));
  audit.orange.forEach(a => list.appendChild(U.el('div', { style: 'padding:4px 0', html: '<span class="tag orange">' + a.ma + '</span> ' + U.esc(a.msg) })));
  if (!audit.red.length && !audit.orange.length) list.appendChild(U.el('div', { class: 'text-green', style: 'padding:8px 0' }, '✓ Tất cả hợp lệ.'));
  body.appendChild(list);
  C.modal({ title: '🛡️ Hậu kiểm bảng lương', wide: true, body, footer: [C.btn('Đóng', C.closeModal, 'primary')] });
};
// MÀN NHẬP EXCEL: chọn file -> xem trước (cũ→mới) + hậu kiểm -> Áp dụng (có bảo vệ)
M.payrollImportExcel = function (p) {
  if (p.paidDate && !U.confirm('Bảng lương này ĐÃ ghi chi lương. Vẫn nhập lại chấm công? (dễ lệch số đã chi)')) return;
  const fileIn = U.el('input', { type: 'file', accept: '.xlsx', style: 'display:none' });
  const drop = U.el('div', { class: 'section-sub', style: 'border:2px dashed var(--line);border-radius:8px;padding:18px;text-align:center;cursor:pointer' },
    '📄 Bấm để chọn file Excel bảng công (.xlsx) — hoặc kéo-thả vào đây');
  drop.onclick = () => fileIn.click();
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.style.background = '#eef6e6'; });
  drop.addEventListener('dragleave', () => { drop.style.background = ''; });
  drop.addEventListener('drop', e => { e.preventDefault(); drop.style.background = ''; if (e.dataTransfer.files[0]) handle(e.dataTransfer.files[0]); });
  fileIn.addEventListener('change', () => { if (fileIn.files[0]) handle(fileIn.files[0]); });
  const host = U.el('div', { class: 'mt16' });
  const body = U.el('div', null, [
    U.el('div', { class: 'section-sub' }, 'Nhập từ file Excel "Bảng công tháng" (sheet Tổng hợp). Hệ thống XEM TRƯỚC + HẬU KIỂM, chỉ ghi vào bảng lương khi bạn bấm "Áp dụng".'),
    drop, fileIn, host,
  ]);
  C.modal({ title: '📄 Nhập Excel bảng công — tháng ' + p.month.slice(5) + '/' + p.month.slice(0, 4), wide: true, body, footer: [C.btn('Đóng', C.closeModal)] });

  async function handle(file) {
    host.innerHTML = '<div class="section-sub">Đang đọc file...</div>';
    let read, parsed;
    try { read = await M.payrollReadCongFile(file); parsed = M.payrollParseCong(read.lines, file.name); }
    catch (e) { host.innerHTML = '<div class="text-red">Lỗi đọc file: ' + U.esc(e.message) + '</div>'; return; }
    if (!parsed.headerFound) { host.innerHTML = '<div class="text-red">Không nhận dạng được cột (thiếu "Ngày công"...). Kiểm tra đúng sheet Tổng hợp.</div>'; return; }
    if (!parsed.recs.length) { host.innerHTML = '<div class="text-red">Không đọc được dòng nhân viên nào trong sheet "' + U.esc(read.sheetName) + '".</div>'; return; }
    let chiTiet = null;   // đối chiếu với sheet Chi tiết (nếu có)
    if (read.detail) { const pc = M.payrollParseChiTiet(read.detail.lines); if (pc.headerFound && Object.keys(pc.byEmp).length) chiTiet = pc.byEmp; }
    render(file, read, parsed, chiTiet);
  }

  function render(file, read, parsed, chiTiet) {
    const recs = parsed.recs;
    const rows = recs.map(r => {
      const emp = M.payrollMatchEmp(r.code);
      const ln = emp ? (p.lines.find(l => l.employeeId === emp.id) || { totalDays: 0, otHours: 0, lateFine: 0 }) : null;
      let net = null;
      if (emp) {
        const sim = Object.assign({}, ln, {   // ô trống (null) -> GIỮ số cũ, khớp đúng hành vi tkApplyAndReport
          totalDays: r.totalDays != null ? r.totalDays : (ln.totalDays || 0),
          allowDays: r.allowDays != null ? r.allowDays : (ln.allowDays || 0),
          otHours: r.otHours != null ? r.otHours : (ln.otHours || 0),
          lateFine: (r.lateFine != null && r.lateFine > 0) ? r.lateFine : (ln.lateFine || 0) });
        net = M.payrollCompute(emp, sim, p.standardDays).thucLinh;
      }
      return { r: r, emp: emp, ln: ln, net: net };
    });
    const audit = M.payrollAudit(p, { recs: recs, monthFile: parsed.month, chiTiet: chiTiet });
    const matched = rows.filter(x => x.emp).length;
    host.innerHTML = '';
    if (parsed.month && parsed.month !== p.month)
      host.appendChild(U.el('div', { class: 'tag red', style: 'display:block;padding:8px;margin-bottom:8px' }, '⚠ File là tháng ' + parsed.month + ' ≠ bảng lương tháng ' + p.month + '. Kiểm tra lại!'));
    host.appendChild(U.el('div', { class: 'section-sub', html: 'File: <b>' + U.esc(file.name) + '</b> · sheet <b>' + U.esc(read.sheetName) + '</b>'
      + (chiTiet ? ' · <span class="text-green">✓ đối chiếu Chi tiết (' + U.esc((read.detail || {}).sheetName || '') + ')</span>' : '')
      + ' · khớp <b class="text-green">' + matched + '/' + recs.length + '</b> nhân viên. Cột "Tiền tăng ca" chỉ để đối chiếu (KHÔNG cộng vào lương).' }));
    host.appendChild(C.table(rows, [
      { label: 'Mã file', render: x => U.esc(x.r.code) },
      { label: 'Nhân viên', render: x => x.emp ? U.esc(x.emp.name) : '<span class="tag red">chưa khớp</span>' },
      { label: 'Ngày công', center: true, render: x => x.emp ? ((x.ln.totalDays || 0) + ' → <b>' + (x.r.totalDays != null ? x.r.totalDays : '?') + '</b>') : '' },
      { label: 'Tăng ca (h)', center: true, render: x => x.emp ? ((x.ln.otHours || 0) + ' → <b>' + (x.r.otHours != null ? x.r.otHours : (x.ln.otHours || 0)) + '</b>') : '' },
      { label: 'Phạt', num: true, render: x => x.emp ? (U.money(x.ln.lateFine || 0) + ' → <b>' + U.money((x.r.lateFine != null && x.r.lateFine > 0) ? x.r.lateFine : (x.ln.lateFine || 0)) + '</b>') : '' },
      { label: 'Thực lĩnh dự kiến', num: true, render: x => x.net != null ? U.money(x.net) : '' },
      { label: '', center: true, render: x => {
          const ct = chiTiet && chiTiet[_norm(x.r.code)];
          return ct ? C.btn('📅 ngày', () => M.payrollDayDetail(x.emp ? x.emp.name : x.r.code, ct), 'sm') : '';
        } },
    ], { empty: '—' }));
    const auditWrap = U.el('div', { class: 'mt16' });
    auditWrap.appendChild(U.el('div', { class: 'card-title', style: 'font-size:14px', html: '🛡️ Hậu kiểm: '
      + (audit.counts.red ? '<span class="text-red">🔴 ' + audit.counts.red + ' lỗi chặn</span> · ' : '')
      + '<span style="color:#c77f0a">🟡 ' + audit.counts.orange + ' nhắc</span>'
      + (!audit.counts.red && !audit.counts.orange ? ' <span class="text-green">✓ không có lỗi</span>' : '') }));
    const list = U.el('div', { style: 'max-height:260px;overflow:auto' });
    audit.red.forEach(a => list.appendChild(U.el('div', { style: 'padding:4px 0', html: '<span class="tag red">' + a.ma + '</span> ' + U.esc(a.msg) })));
    audit.orange.forEach(a => list.appendChild(U.el('div', { style: 'padding:4px 0', html: '<span class="tag orange">' + a.ma + '</span> ' + U.esc(a.msg) })));
    auditWrap.appendChild(list);
    host.appendChild(auditWrap);
    const ackChk = U.el('input', { type: 'checkbox' });
    const ackRow = (audit.counts.orange && !audit.counts.red)
      ? U.el('label', { class: 'radio', style: 'margin-right:10px' }, [ackChk, ' Tôi đã kiểm tra các cảnh báo vàng'])
      : null;
    const applyBtn = C.btn('✅ Áp dụng vào bảng lương', () => {
      if (audit.counts.red) return U.toast('Còn ' + audit.counts.red + ' lỗi chặn (🔴) — xử lý xong mới áp dụng.', 'error');
      if (ackRow && !ackChk.checked) return U.toast('Tích xác nhận đã kiểm tra cảnh báo vàng.', 'error');
      C.closeModal();
      p._congSource = { file: file.name, sheet: read.sheetName };
      M.tkApplyAndReport(p, recs, false, chiTiet);   // TÁI DÙNG: khớp + tự thêm NV + ghi 4 trường + chi tiết ngày; KHÔNG cộng đôi OT
    }, 'primary');
    if (audit.counts.red) { applyBtn.disabled = true; applyBtn.title = 'Còn ' + audit.counts.red + ' lỗi chặn — không thể áp dụng'; }
    host.appendChild(U.el('div', { class: 'mt16', style: 'text-align:right' }, [ackRow, applyBtn].filter(Boolean)));
  }
};

/* ---------- Ghi nhận chi lương (tạo phiếu chi) ---------- */
M.payrollPay = function (p) {
  if (p.paidDate) {
    if (!U.confirm('Bảng lương tháng ' + p.month + ' ĐÃ ghi chi lương ngày ' + U.date(p.paidDate) + '.\nTạo THÊM phiếu chi nữa? (dễ bị trùng)')) return;
  }
  // Hậu kiểm trước khi chốt: cảnh báo nếu còn lỗi nghiêm trọng
  const au = M.payrollAudit(p);
  if (au.counts.red && !U.confirm('🛡️ Hậu kiểm phát hiện ' + au.counts.red + ' lỗi nghiêm trọng:\n- '
      + au.red.slice(0, 6).map(a => a.msg).join('\n- ') + (au.red.length > 6 ? '\n...' : '')
      + '\n\nVẫn tiếp tục ghi chi lương?')) return;
  const total = M.payrollNetTotal(p);
  const accSel = C.select(PW.data.cashAccounts.map(a => ({ value: a.id, label: a.name })), PW.data.cashAccounts[0].id);
  const body = U.el('div', { class: 'form-grid' }, [
    U.el('div', { class: 'section-sub full' }, 'Tạo 1 phiếu chi cho tổng lương thực lĩnh tháng ' + p.month + '.'),
    U.el('div', { class: 'full', style: 'font-size:18px;font-weight:700' }, 'Tổng chi: ' + U.money(total) + ' đ'),
    C.field('Chi từ tài khoản', accSel, { full: true }),
  ]);
  C.modal({
    title: 'Ghi nhận chi lương', body,
    footer: [C.btn('Hủy', C.closeModal), C.btn('Tạo phiếu chi', () => {
      const pay = {
        id: PW.uid(), code: PW.nextCode('PC'), date: p.month + '-28',
        accountId: accSel.value, supplierId: null, amount: total,
        reason: 'Lương nhân viên tháng ' + p.month.slice(5) + '/' + p.month.slice(0, 4), note: '',
      };
      PW.data.payments.push(pay);
      p.paidDate = pay.date; p.paymentId = pay.id;   // đánh dấu đã chi -> chống tạo trùng
      PW.logActivity('create', 'payment', pay.code, 'Chi lương ' + p.month + ': ' + U.money(total) + ' đ');
      PW.save(); C.closeModal(); App.refresh(); U.toast('Đã tạo phiếu chi lương ' + U.money(total) + ' đ');
    }, 'primary')],
  });
};
