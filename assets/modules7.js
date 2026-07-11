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
  toolbar.appendChild(C.btn('📥 Lấy chấm công', () => M.payrollImportServer(p), 'sm'));
  toolbar.appendChild(C.btn('📋 Dán chấm công', () => M.payrollPasteTK(p), 'sm'));
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
  const row = (no, name, val, note) => `<tr><td style="text-align:center">${no}</td><td>${name}</td><td style="text-align:right">${val === '' ? '' : U.money(val)}</td><td>${note || ''}</td></tr>`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Phiếu lương ${U.esc(e.name || '')}</title>
    <style>body{font-family:'Segoe UI',Arial;padding:30px;color:#222}
    .company{text-align:center;color:#1a3a6b;font-weight:700;font-size:18px}
    h2{text-align:center;margin:6px 0} table{width:100%;border-collapse:collapse;margin-top:12px}
    th,td{border:1px solid #999;padding:6px 9px;font-size:13px} th{background:#eaf2fc}
    .sec{background:#f0f0f0;font-weight:700} .meta{margin-top:8px;font-size:14px;line-height:1.6}
    .big{text-align:right;margin-top:10px;font-size:16px;font-weight:700;color:#1a3a6b}</style></head><body>
    <div class="company">DALI — Tô điểm cuộc sống</div>
    <h2>PHIẾU LƯƠNG THÁNG ${p.month.slice(5)}/${p.month.slice(0, 4)}</h2>
    <div class="meta"><b>Họ và tên:</b> ${U.esc(e.name || '')} &nbsp;|&nbsp; <b>Mã NV:</b> ${U.esc(e.code || '')} &nbsp;|&nbsp; <b>Chức vụ:</b> ${U.esc(e.position || '')}</div>
    <table>
      <tr><th style="width:36px">STT</th><th>Nội dung</th><th style="width:130px">Số tiền</th><th style="width:160px">Ghi chú</th></tr>
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
    <div class="big">THỰC LĨNH: ${U.money(r.thucLinh)} đ</div>
    <div style="display:flex;justify-content:space-around;margin-top:50px;text-align:center">
      <div>Người nhận<br/><i>(Ký, ghi rõ họ tên)</i></div><div>Người lập<br/><i>(Ký, ghi rõ họ tên)</i></div></div>
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
  };
};

function _norm(s) { return String(s == null ? '' : s).trim().toLowerCase().replace(/\s+/g, ' '); }

// Ghép dữ liệu chấm công vào các dòng lương + báo cáo
// silent=true: không hiện thông báo (dùng cho tự động làm mới)
M.tkApplyAndReport = function (p, rawList, silent) {
  const recs = (rawList || []).map(M.tkNormalize);
  if (!recs.length) { if (!silent) U.toast('Không đọc được dữ liệu nhân viên từ nguồn chấm công', 'error'); return; }
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
      matched++;
    } else {
      unmatched.push(rec.name || rec.code || '(không rõ)');
    }
  });
  PW.save();
  M.payrollDetail(p.id); // dựng lại bảng để hiện số mới
  if (silent) return;
  let msg = 'Đã cập nhật chấm công cho ' + matched + '/' + recs.length + ' nhân viên.';
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
  M.tkApplyAndReport(p, M.tkExtractList(r.data.data));
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

/* ---------- Ghi nhận chi lương (tạo phiếu chi) ---------- */
M.payrollPay = function (p) {
  if (p.paidDate) {
    if (!U.confirm('Bảng lương tháng ' + p.month + ' ĐÃ ghi chi lương ngày ' + U.date(p.paidDate) + '.\nTạo THÊM phiếu chi nữa? (dễ bị trùng)')) return;
  }
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
