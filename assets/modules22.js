/* ============================================================
   modules22.js — THUẾ & GIÁ THÀNH

   1) M.taxReturn  — Tờ khai thuế GTGT 01/GTGT (phương pháp khấu trừ)
   2) M.costing    — Tính giá thành: phân bổ nguyên vật liệu + nhân công

   Hai màn hình này KHÔNG tự nộp thuế và KHÔNG tự sửa giá vốn. Mọi thay đổi
   ghi vào sổ đều phải bấm nút và xác nhận, vì cả hai đều đụng tới số liệu
   dùng để quyết toán với cơ quan thuế và để chia lãi cho các thành viên.
   ============================================================ */

/* ============================================================
   1. TỜ KHAI THUẾ GTGT
   ============================================================ */

M._tkNamHienTai = () => new Date().getFullYear();

M.taxReturn = function (root) {
  const card = U.el('div', { class: 'card' });
  root.appendChild(card);
  card.appendChild(U.el('div', { class: 'card-title' }, '🧾 Tờ khai thuế GTGT (mẫu 01/GTGT)'));
  card.appendChild(U.el('p', { class: 'section-sub' },
    'Số liệu lấy từ hóa đơn điện tử đã kéo về ở mục "Hóa đơn thuế (cổng)" — đúng thứ cơ quan thuế '
    + 'đối chiếu. Sổ bán hàng nội bộ chỉ dùng để soát chênh lệch, không dùng để kê khai.'));

  const nam = M._tkNamHienTai();
  const meta = (PW.data.meta || {});
  const kieuMacDinh = meta.taxPeriodType || 'quy';

  const kieuS = C.select([{ value: 'quy', label: 'Theo quý' }, { value: 'thang', label: 'Theo tháng' }], kieuMacDinh);
  const kyS = C.select([], 1);
  const namS = C.select([nam + 1, nam, nam - 1, nam - 2].map(n => ({ value: n, label: String(n) })), nam);

  function napKy() {
    const n = kieuS.value === 'thang' ? 12 : 4;
    const nhan = kieuS.value === 'thang' ? 'Tháng ' : 'Quý ';
    kyS.innerHTML = '';
    for (let i = 1; i <= n; i++) {
      const o = U.el('option', { value: i }, nhan + i);
      kyS.appendChild(o);
    }
    const d = new Date();
    kyS.value = kieuS.value === 'thang' ? (d.getMonth() + 1) : (Math.floor(d.getMonth() / 3) + 1);
  }
  napKy();

  const bar = U.el('div', { class: 'toolbar mt8' }, [
    U.el('div', { class: 'field', style: 'margin:0' }, [U.el('label', null, 'Loại kỳ'), kieuS]),
    U.el('div', { class: 'field', style: 'margin:0' }, [U.el('label', null, 'Kỳ tính thuế'), kyS]),
    U.el('div', { class: 'field', style: 'margin:0' }, [U.el('label', null, 'Năm'), namS]),
    U.el('span', { class: 'spacer' }),
    C.btn('↻ Tính lại', () => ve(), 'primary'),
  ]);
  card.appendChild(bar);
  kieuS.addEventListener('change', () => { napKy(); ve(); });
  kyS.addEventListener('change', () => ve());
  namS.addEventListener('change', () => ve());

  const host = U.el('div');
  card.appendChild(host);
  const duoi = U.el('div');
  root.appendChild(duoi);

  function ve() {
    const kieu = kieuS.value, ky = Number(kyS.value), namV = Number(namS.value);
    const daLuu = PW.taxReturnOf(PW.taxKy(kieu, ky, namV).ma);
    const tk = PW.taxTinhToKhai(kieu, ky, namV, daLuu ? { ct22: daLuu.ct22, ct25: daLuu.ct25 } : {});
    host.innerHTML = ''; duoi.innerHTML = '';

    if (!(PW.data.taxInvoices || []).length) {
      host.appendChild(U.el('div', { class: 'empty' },
        'Sổ hóa đơn thuế đang trống. Vào mục "Hóa đơn thuế (cổng)" kéo hóa đơn từ cổng Tổng cục Thuế về trước đã.'));
      return;
    }

    // ----- KPI -----
    const kpi = U.el('div', { class: 'grid c4 mt8' });
    [['Thuế đầu ra', tk.ct35, 'text-green', tk.soHdRa + ' hóa đơn'],
     ['Thuế đầu vào được khấu trừ', tk.ct25, 'text-red', tk.soHdVao + ' hóa đơn'],
     ['Khấu trừ kỳ trước chuyển sang', tk.ct22, '', 'chỉ tiêu [22]'],
     [tk.ct40a > 0 ? 'PHẢI NỘP' : 'Còn khấu trừ chuyển kỳ sau',
      tk.ct40a > 0 ? tk.ct40a : tk.ct43, tk.ct40a > 0 ? 'text-red' : 'text-green',
      tk.ct40a > 0 ? 'chỉ tiêu [40a]' : 'chỉ tiêu [43]']]
      .forEach(k => {
        const c = U.el('div', { class: 'kpi' });
        c.appendChild(U.el('div', { class: 'label' }, k[0]));
        c.appendChild(U.el('div', { class: 'value ' + k[2] }, U.money(k[1])));
        if (k[3]) c.appendChild(U.el('div', { class: 'sub' }, k[3]));
        kpi.appendChild(c);
      });
    host.appendChild(kpi);

    // ----- Bảng chỉ tiêu -----
    const ct = [
      ['22', 'Thuế GTGT còn được khấu trừ kỳ trước chuyển sang', tk.ct22, true],
      ['23', 'Giá trị hàng hóa, dịch vụ mua vào', tk.ct23, false],
      ['24', 'Thuế GTGT của hàng hóa, dịch vụ mua vào', tk.ct24, false],
      ['25', 'Tổng số thuế GTGT được khấu trừ kỳ này', tk.ct25, true],
      ['26', 'Hàng hóa, dịch vụ bán ra không chịu thuế GTGT', tk.ct26, false],
      ['27', 'Hàng hóa, dịch vụ bán ra chịu thuế GTGT', tk.ct27, false],
      ['28', 'Thuế GTGT của hàng hóa, dịch vụ bán ra', tk.ct28, false],
      ['34', 'Tổng doanh thu hàng hóa, dịch vụ bán ra', tk.ct34, false],
      ['35', 'Tổng số thuế GTGT của hàng hóa, dịch vụ bán ra', tk.ct35, false],
      ['36', 'Thuế GTGT phát sinh trong kỳ ([35] − [22] − [25])', tk.ct36, false],
      ['40a', 'Thuế GTGT còn phải nộp trong kỳ', tk.ct40a, false],
      ['43', 'Thuế GTGT còn được khấu trừ chuyển kỳ sau', tk.ct43, false],
    ];
    host.appendChild(U.el('div', { class: 'card-title mt16' }, 'Chỉ tiêu tờ khai — ' + tk.ten
      + ' (' + U.date(tk.from) + ' đến ' + U.date(tk.to) + ')'));
    host.appendChild(C.table(ct, [
      { label: 'Chỉ tiêu', center: true, width: '90px', render: r => '<b>[' + r[0] + ']</b>' },
      { label: 'Nội dung', render: r => U.esc(r[1]) + (r[3] ? ' <span class="text-muted">(sửa được)</span>' : '') },
      { label: 'Số tiền', num: true, render: r => U.money(r[2]) },
    ], { empty: '' }));

    // ----- Chi tiết theo thuế suất -----
    const suatRows = [];
    Object.keys(tk.theoSuatRa).forEach(s => suatRows.push(['Bán ra', s, tk.theoSuatRa[s]]));
    Object.keys(tk.theoSuatVao).forEach(s => suatRows.push(['Mua vào', s, tk.theoSuatVao[s]]));
    duoi.appendChild(U.el('div', { class: 'card' }, [
      U.el('div', { class: 'card-title' }, '📊 Chi tiết theo thuế suất'),
      C.table(suatRows, [
        { label: 'Chiều', center: true, render: r => r[0] === 'Bán ra'
          ? '<span class="tag green">Bán ra</span>' : '<span class="tag orange">Mua vào</span>' },
        { label: 'Thuế suất', center: true, render: r => U.esc(r[1]) },
        { label: 'Số hóa đơn', num: true, render: r => U.num(r[2].n) },
        { label: 'Tiền hàng', num: true, render: r => U.money(r[2].base) },
        { label: 'Tiền thuế', num: true, render: r => U.money(r[2].vat) },
      ], { empty: 'Không có hóa đơn nào trong kỳ' }),
    ]));

    // ----- Đối chiếu với sổ nội bộ -----
    const so = PW.vatTheoSo(tk.from, tk.to);
    const lechRa = so.raBase - tk.ct34, lechVao = so.vaoBase - tk.ct23;
    const nhan = v => Math.abs(v) < 1000 ? '<span class="tag green">khớp</span>'
      : '<span class="tag red">lệch ' + U.money(Math.abs(v)) + '</span>';
    duoi.appendChild(U.el('div', { class: 'card' }, [
      U.el('div', { class: 'card-title' }, '🔍 Đối chiếu tờ khai với sổ nội bộ'),
      U.el('p', { class: 'section-sub' },
        'Lệch là bình thường nếu sổ còn phiếu giao ký gửi hoặc chứng từ chưa xuất hóa đơn. '
        + 'Nhưng lệch lớn thì phải tìm ra nguyên nhân trước khi nộp tờ khai.'),
      C.table([
        ['Doanh thu bán ra', tk.ct34, so.raBase, lechRa],
        ['Giá trị mua vào', tk.ct23, so.vaoBase, lechVao],
      ], [
        { label: 'Khoản mục', render: r => U.esc(r[0]) },
        { label: 'Theo hóa đơn điện tử', num: true, render: r => U.money(r[1]) },
        { label: 'Theo sổ', num: true, render: r => U.money(r[2]) },
        { label: 'Chênh lệch', center: true, render: r => nhan(r[3]) },
      ], { empty: '' }),
    ]));

    // ----- Lưu / đánh dấu đã nộp -----
    const ttCard = U.el('div', { class: 'card' });
    ttCard.appendChild(U.el('div', { class: 'card-title' }, '📌 Trạng thái tờ khai'));
    if (daLuu) {
      const nop = daLuu.status === 'nop';
      ttCard.appendChild(U.el('p', null, [
        U.el('span', { class: 'tag ' + (nop ? 'green' : 'orange') }, nop ? 'Đã nộp' : 'Nháp'),
        U.el('span', null, '  Lưu lúc ' + U.date(daLuu.savedAt || '')
          + (nop ? ' · Nộp ngày ' + U.date(daLuu.paidDate || '') + ' · Đã nộp ' + U.money(daLuu.paidAmount || 0) + ' đ' : '')),
      ]));
    } else {
      ttCard.appendChild(U.el('p', { class: 'section-sub' }, 'Kỳ này chưa lưu tờ khai nào.'));
    }
    ttCard.appendChild(U.el('div', { class: 'toolbar' }, [
      C.btn('💾 Lưu tờ khai kỳ này', () => luu(tk, 'nhap'), 'primary'),
      C.btn('✅ Đánh dấu đã nộp', () => danhDauNop(tk)),
      C.btn('📊 Xuất bảng kê Excel', () => xuatExcel(tk)),
      C.btn('🖨️ In tờ khai', () => inToKhai(tk)),
      C.btn('✏️ Sửa [22] / [25]', () => suaChiTieu(tk)),
    ]));
    ttCard.appendChild(U.el('p', { class: 'section-sub' },
      'Phần mềm không nộp tờ khai thay bạn. Hãy xuất số liệu rồi nhập vào eTax (thuedientu.gdt.gov.vn), '
      + 'ký số và bấm nộp — chữ ký số là của người đại diện doanh nghiệp.'));
    duoi.appendChild(ttCard);
  }

  function luu(tk, status) {
    PW.data.taxReturns = PW.data.taxReturns || [];
    let t = PW.taxReturnOf(tk.ma);
    if (!t) { t = { id: PW.uid(), ma: tk.ma }; PW.data.taxReturns.push(t); }
    Object.assign(t, {
      kieu: tk.kieu, ky: tk.ky, nam: tk.nam, ten: tk.ten, from: tk.from, to: tk.to,
      ct22: tk.ct22, ct23: tk.ct23, ct24: tk.ct24, ct25: tk.ct25, ct26: tk.ct26,
      ct27: tk.ct27, ct28: tk.ct28, ct34: tk.ct34, ct35: tk.ct35, ct36: tk.ct36,
      ct40a: tk.ct40a, ct43: tk.ct43,
      status: status || t.status || 'nhap', savedAt: U.today(),
    });
    PW.logActivity('update', 'taxReturn', 'Tờ khai ' + tk.ten, 'phải nộp ' + U.money(tk.ct40a));
    PW.save();
    U.toast('Đã lưu tờ khai ' + tk.ten);
    ve();
  }

  function danhDauNop(tk) {
    const ngayI = C.input({ type: 'date', value: U.today() });
    const tienI = C.money({});
    tienI.datSoTien(tk.ct40a);
    const taoChi = C.input({ type: 'checkbox' });
    taoChi.checked = true;
    const quyS = C.select(PW.data.cashAccounts.map(a => ({ value: a.id, label: a.name })),
      (PW.data.cashAccounts[0] || {}).id);
    C.modal({
      title: 'Đánh dấu đã nộp tờ khai ' + tk.ten,
      body: U.el('div', { class: 'form-grid' }, [
        C.field('Ngày nộp', ngayI, { required: true }),
        C.field('Số tiền thuế đã nộp', tienI, { required: true }),
        C.field('Tạo phiếu chi tiền thuế', taoChi),
        C.field('Chi từ quỹ', quyS),
        U.el('div', { class: 'section-sub full' },
          'Chỉ ghi nhận vào sổ rằng bạn đã nộp. Việc ký số và nộp tờ khai vẫn làm trên eTax.'),
      ]),
      footer: [C.btn('Hủy', C.closeModal), C.btn('Xác nhận', () => {
        const tien = tienI.soTien();
        luu(tk, 'nop');
        const t = PW.taxReturnOf(tk.ma);
        t.status = 'nop'; t.paidDate = ngayI.value; t.paidAmount = tien;
        if (taoChi.checked && tien > 0) {
          PW.data.payments.push({
            id: PW.uid(), code: PW.nextCode('PC'), date: ngayI.value, supplierId: null,
            accountId: quyS.value || null, amount: tien, expenseItem: 'Thuế GTGT',
            note: 'Nộp thuế GTGT ' + tk.ten, isTax: true, taxReturnMa: tk.ma,
          });
          PW.logActivity('create', 'payment', 'Nộp thuế GTGT ' + tk.ten, U.money(tien));
        }
        PW.save(); C.closeModal(); U.toast('Đã ghi nhận nộp thuế ' + tk.ten); ve();
      }, 'primary')],
    });
  }

  function suaChiTieu(tk) {
    const i22 = C.money({}); i22.datSoTien(tk.ct22);
    const i25 = C.money({}); i25.datSoTien(tk.ct25);
    C.modal({
      title: 'Sửa chỉ tiêu [22] và [25]',
      body: U.el('div', { class: 'form-grid' }, [
        C.field('[22] Khấu trừ kỳ trước chuyển sang', i22),
        C.field('[25] Thuế GTGT được khấu trừ kỳ này', i25),
        U.el('div', { class: 'section-sub full' },
          '[22] mặc định lấy chỉ tiêu [43] của tờ khai kỳ trước đã lưu trong phần mềm. Nếu kỳ trước '
          + 'nộp ngoài phần mềm thì nhập tay. [25] mặc định bằng [24] — chỉ sửa khi có hóa đơn đầu vào '
          + 'không đủ điều kiện khấu trừ.'),
      ]),
      footer: [C.btn('Hủy', C.closeModal), C.btn('Lưu', () => {
        const tk2 = PW.taxTinhToKhai(tk.kieu, tk.ky, tk.nam, { ct22: i22.soTien(), ct25: i25.soTien() });
        luu(tk2, null); C.closeModal();
      }, 'primary')],
    });
  }

  function dsHoaDon(tk) {
    return (PW.data.taxInvoices || [])
      .filter(i => i.date >= tk.from && i.date <= tk.to && PW.taxConHieuLuc(i))
      .sort((a, b) => (a.direction + a.date) < (b.direction + b.date) ? -1 : 1);
  }

  function xuatExcel(tk) {
    const ds = dsHoaDon(tk);
    if (!ds.length) return U.toast('Kỳ này không có hóa đơn nào', 'error');
    U.exportExcel('BangKe_' + tk.ma,
      ['Chiều', 'Ký hiệu', 'Số hóa đơn', 'Ngày', 'Tên đối tác', 'MST', 'Tiền hàng', 'Thuế suất', 'Tiền thuế', 'Tổng'],
      ds.map(i => [i.direction === 'in' ? 'Mua vào' : 'Bán ra', i.khhdon, i.shdon, U.date(i.date),
        i.partnerName, i.partnerMst, Number(i.base) || 0, PW.taxSuat(i.vatRate), Number(i.vat) || 0, Number(i.total) || 0]),
      'Bảng kê hóa đơn ' + tk.ten + ' — ' + ((PW.data.meta || {}).companyName || ''));
  }

  function inToKhai(tk) {
    const co = M.company();
    const dong = (ma, ten, tien) => '<tr><td style="text-align:center"><b>[' + ma + ']</b></td><td>' + ten
      + '</td><td style="text-align:right">' + U.num(Math.round(tien)) + '</td></tr>';
    const html = ''
      + '<h1 class="doc-title">TỜ KHAI THUẾ GIÁ TRỊ GIA TĂNG</h1>'
      + '<div class="doc-sub">Mẫu số 01/GTGT — Khấu trừ · ' + U.esc(tk.ten) + '</div>'
      + '<div class="party"><b>Người nộp thuế:</b> ' + U.esc(co.name) + '<br>'
      + '<b>Mã số thuế:</b> ' + U.esc(co.mst || '') + '<br>'
      + '<b>Kỳ tính thuế:</b> ' + U.esc(tk.ten) + ' (' + U.date(tk.from) + ' – ' + U.date(tk.to) + ')</div>'
      + '<table class="tbl"><thead><tr><th style="width:80px">Chỉ tiêu</th><th>Nội dung</th>'
      + '<th style="width:150px">Số tiền (đồng)</th></tr></thead><tbody>'
      + dong('22', 'Thuế GTGT còn được khấu trừ kỳ trước chuyển sang', tk.ct22)
      + dong('23', 'Giá trị hàng hóa, dịch vụ mua vào', tk.ct23)
      + dong('24', 'Thuế GTGT của hàng hóa, dịch vụ mua vào', tk.ct24)
      + dong('25', 'Tổng số thuế GTGT được khấu trừ kỳ này', tk.ct25)
      + dong('26', 'Hàng hóa, dịch vụ bán ra không chịu thuế', tk.ct26)
      + dong('27', 'Hàng hóa, dịch vụ bán ra chịu thuế', tk.ct27)
      + dong('28', 'Thuế GTGT của hàng hóa, dịch vụ bán ra', tk.ct28)
      + dong('34', 'Tổng doanh thu hàng hóa, dịch vụ bán ra', tk.ct34)
      + dong('35', 'Tổng số thuế GTGT của hàng hóa, dịch vụ bán ra', tk.ct35)
      + dong('36', 'Thuế GTGT phát sinh trong kỳ', tk.ct36)
      + dong('40a', 'Thuế GTGT còn phải nộp trong kỳ', tk.ct40a)
      + dong('43', 'Thuế GTGT còn được khấu trừ chuyển kỳ sau', tk.ct43)
      + '</tbody></table>'
      + '<p style="margin-top:14px;font-size:12px;color:#555">Bản in này để đối chiếu nội bộ. '
      + 'Tờ khai chính thức phải lập, ký số và nộp trên hệ thống thuế điện tử.</p>';
    M.printHTML('To khai GTGT ' + tk.ma, html, co.printSize);
  }

  ve();
};

/* ============================================================
   2. TÍNH GIÁ THÀNH — phân bổ nguyên vật liệu và nhân công

   Giá thành một sản phẩm = nguyên vật liệu trực tiếp (biết chính xác từ lệnh
   sản xuất) + nhân công và chi phí chung (KHÔNG biết của riêng sản phẩm nào,
   phải phân bổ theo một tiêu thức).

   Tiêu thức phân bổ phải nói rõ ra chứ không giấu trong công thức, vì chọn
   tiêu thức khác là ra giá thành khác — mà giá thành là cơ sở tính lãi gộp,
   tính thuế TNDN và chia lãi cho thành viên góp vốn.
   ============================================================ */

M.costing = function (root) {
  const card = U.el('div', { class: 'card' });
  root.appendChild(card);
  card.appendChild(U.el('div', { class: 'card-title' }, '🏭 Tính giá thành sản phẩm'));
  card.appendChild(U.el('p', { class: 'section-sub' },
    'Gộp nguyên vật liệu từ lệnh sản xuất với chi phí nhân công và chi phí chung trong kỳ, '
    + 'rồi phân bổ ra từng sản phẩm để có giá vốn đơn vị.'));

  const host = U.el('div');
  const fb = M.filterBar({
    storageKey: 'costing',
    onChange: () => ve(),
    fields: [
      { type: 'period', key: 'period', label: 'Kỳ tính giá thành', default: 'thisMonth',
        presets: ['thisMonth', 'lastMonth', 'thisQuarter', 'ytd', 'thisYear', 'custom'] },
    ],
  });
  card.appendChild(fb.el);

  /* Tiêu thức phân bổ để riêng, KHÔNG nhét vào thanh lọc: thanh lọc tự chèn mục
     "Tất cả" cho mọi ô chọn, mà "phân bổ tất cả" thì vô nghĩa. */
  const pbS = C.select([
    { value: 'nvl', label: 'Theo tiền nguyên vật liệu' },
    { value: 'sl', label: 'Theo số lượng sản xuất' },
  ], 'nvl');
  pbS.addEventListener('change', () => ve());

  // Tỷ lệ lương tính vào sản xuất + chi phí chung nhập thêm
  const tlI = C.input({ type: 'number', value: 100, min: 0, max: 100, step: 1, style: 'width:110px;text-align:right' });
  const cpcI = C.money({ style: 'width:170px;text-align:right' });
  const khauHaoCb = C.input({ type: 'checkbox' });
  khauHaoCb.checked = true;
  [tlI, cpcI].forEach(i => i.addEventListener('input', () => ve()));
  khauHaoCb.addEventListener('change', () => ve());
  card.appendChild(U.el('div', { class: 'toolbar' }, [
    U.el('div', { class: 'field', style: 'margin:0' }, [U.el('label', null, 'Phân bổ nhân công & chi phí chung'), pbS]),
    U.el('div', { class: 'field', style: 'margin:0' }, [U.el('label', null, '% lương tính vào sản xuất'), tlI]),
    U.el('div', { class: 'field', style: 'margin:0' }, [U.el('label', null, 'Chi phí chung nhập thêm'), cpcI]),
    U.el('div', { class: 'field', style: 'margin:0' }, [U.el('label', null, 'Cộng khấu hao TSCĐ'), khauHaoCb]),
  ]));
  card.appendChild(host);

  function luongTrongKy(from, to) {
    // Bảng lương theo tháng 'YYYY-MM'; lấy bảng nào có tháng nằm trong khoảng kỳ.
    const ds = (PW.data.payrolls || []).filter(p => {
      if (!p.month) return false;
      const d1 = p.month + '-01';
      const [y, m] = p.month.split('-').map(Number);
      const d2 = p.month + '-' + String(new Date(y, m, 0).getDate()).padStart(2, '0');
      return (!to || d1 <= to) && (!from || d2 >= from);
    });
    return { ds: ds, tong: ds.reduce((s, p) => s + M.payrollNetTotal(p), 0) };
  }

  function ve() {
    const st = fb.getState();
    const from = st.from, to = st.to;
    const pb = pbS.value || 'nvl';
    host.innerHTML = '';

    // --- Lệnh sản xuất trong kỳ, gom theo sản phẩm ---
    const lenh = (PW.data.productionOrders || [])
      .filter(po => (!from || po.date >= from) && (!to || po.date <= to));
    const theoSp = {};
    lenh.forEach(po => {
      const k = po.productId;
      if (!theoSp[k]) theoSp[k] = { productId: k, qty: 0, nvl: 0, ncGhi: 0, khac: 0, soLenh: 0 };
      const o = theoSp[k];
      o.soLenh++;
      o.qty += Number(po.qty) || 0;
      o.nvl += PW.productionMaterialCost(po);
      o.ncGhi += Number(po.laborCost) || 0;
      o.khac += Number(po.otherCost) || 0;
    });
    const rows = Object.values(theoSp);

    const luong = luongTrongKy(from, to);
    const tyLe = Math.max(0, Math.min(100, Number(tlI.value) || 0)) / 100;
    const ncTongLuong = luong.tong * tyLe;
    const ncDaGhi = rows.reduce((s, r) => s + r.ncGhi, 0);
    // Nhân công cần phân bổ = lương kỳ này (phần tính cho sản xuất) − phần đã ghi thẳng vào lệnh
    const ncPhanBo = Math.max(0, ncTongLuong - ncDaGhi);
    const khauHao = khauHaoCb.checked ? PW.depreciation(from, to) : 0;
    const cpcThem = cpcI.soTien();
    const khacDaGhi = rows.reduce((s, r) => s + r.khac, 0);
    const cpcPhanBo = khauHao + cpcThem;

    const tongNvl = rows.reduce((s, r) => s + r.nvl, 0);
    const tongQty = rows.reduce((s, r) => s + r.qty, 0);
    const mauSo = pb === 'sl' ? tongQty : tongNvl;

    rows.forEach(r => {
      const tuSo = pb === 'sl' ? r.qty : r.nvl;
      const tyTrong = mauSo > 0 ? tuSo / mauSo : 0;
      r.tyTrong = tyTrong;
      r.nc = r.ncGhi + ncPhanBo * tyTrong;
      r.cpc = r.khac + cpcPhanBo * tyTrong;
      r.tong = r.nvl + r.nc + r.cpc;
      r.donVi = r.qty > 0 ? r.tong / r.qty : 0;
      const p = PW.product(r.productId);
      r.ten = p ? (p.code + ' — ' + p.name) : '(sản phẩm đã xóa)';
      r.cu = p ? (Number(p.cost) || 0) : 0;
      r.chenh = r.donVi - r.cu;
    });
    rows.sort((a, b) => b.tong - a.tong);

    // --- KPI ---
    const kpi = U.el('div', { class: 'grid c4 mt8' });
    [['Nguyên vật liệu', tongNvl, '', lenh.length + ' lệnh sản xuất'],
     ['Nhân công tính vào sản xuất', ncTongLuong, '',
      luong.ds.length + ' bảng lương' + (ncDaGhi ? ' · đã ghi thẳng ' + U.money(ncDaGhi) : '')],
     ['Chi phí chung', cpcPhanBo + khacDaGhi, '', khauHaoCb.checked ? 'gồm khấu hao ' + U.money(khauHao) : 'chưa gồm khấu hao'],
     ['Tổng giá thành', tongNvl + ncTongLuong + cpcPhanBo + khacDaGhi, 'text-green', U.num(tongQty) + ' sản phẩm']]
      .forEach(k => {
        const c = U.el('div', { class: 'kpi' });
        c.appendChild(U.el('div', { class: 'label' }, k[0]));
        c.appendChild(U.el('div', { class: 'value ' + k[2] }, U.money(k[1])));
        if (k[3]) c.appendChild(U.el('div', { class: 'sub' }, k[3]));
        kpi.appendChild(c);
      });
    host.appendChild(kpi);

    if (!rows.length) {
      host.appendChild(U.el('div', { class: 'empty mt16' },
        'Kỳ này không có lệnh sản xuất nào. Không có căn cứ để phân bổ nhân công vào sản phẩm.'));
      return;
    }
    if (!luong.ds.length) {
      host.appendChild(U.el('p', { class: 'section-sub mt8' },
        '⚠️ Kỳ này chưa có bảng lương nào, nên giá thành mới chỉ có nguyên vật liệu — '
        + 'thiếu nhân công thì giá vốn thấp giả, lãi gộp cao giả.'));
    }

    host.appendChild(U.el('div', { class: 'card-title mt16' },
      'Giá thành từng sản phẩm — phân bổ ' + (pb === 'sl' ? 'theo số lượng' : 'theo tiền nguyên vật liệu')));
    host.appendChild(C.table(rows, [
      { label: 'Sản phẩm', render: r => U.esc(r.ten) + '<div class="text-muted" style="font-size:11px">'
        + r.soLenh + ' lệnh · tỷ trọng ' + (r.tyTrong * 100).toFixed(1) + '%</div>' },
      { label: 'SL sản xuất', num: true, render: r => U.num(r.qty) },
      { label: 'Nguyên vật liệu', num: true, render: r => U.money(r.nvl) },
      { label: 'Nhân công', num: true, render: r => U.money(r.nc) },
      { label: 'Chi phí chung', num: true, render: r => U.money(r.cpc) },
      { label: 'Tổng giá thành', num: true, render: r => U.money(r.tong) },
      { label: 'Giá thành đơn vị', num: true, render: r => '<b>' + U.money(r.donVi) + '</b>' },
      { label: 'Giá vốn đang khai', num: true, render: r => U.money(r.cu) },
      { label: 'Chênh', num: true, render: r => (r.cu === 0 ? '<span class="tag orange">chưa có</span>'
        : '<span class="' + (r.chenh > 0 ? 'text-red' : 'text-green') + '">'
          + (r.chenh > 0 ? '+' : '') + U.money(r.chenh) + '</span>') },
    ], {
      empty: 'Không có sản phẩm nào',
      footer: [
        { html: 'TỔNG (' + rows.length + ' sản phẩm)' },
        { num: true, html: U.num(tongQty) },
        { num: true, html: U.money(tongNvl) },
        { num: true, html: U.money(rows.reduce((s, r) => s + r.nc, 0)) },
        { num: true, html: U.money(rows.reduce((s, r) => s + r.cpc, 0)) },
        { num: true, html: U.money(rows.reduce((s, r) => s + r.tong, 0)) },
        { num: true, html: '' }, { num: true, html: '' }, { num: true, html: '' },
      ],
    }));

    host.appendChild(U.el('div', { class: 'toolbar mt8' }, [
      C.btn('📊 Xuất Excel', () => {
        U.exportExcel('GiaThanh_' + (from || '') + '_' + (to || ''),
          ['Sản phẩm', 'SL sản xuất', 'Nguyên vật liệu', 'Nhân công', 'Chi phí chung', 'Tổng giá thành',
           'Giá thành đơn vị', 'Giá vốn đang khai', 'Chênh lệch'],
          rows.map(r => [r.ten, r.qty, Math.round(r.nvl), Math.round(r.nc), Math.round(r.cpc),
            Math.round(r.tong), Math.round(r.donVi), Math.round(r.cu), Math.round(r.chenh)]),
          'Bảng tính giá thành ' + (from || '') + ' – ' + (to || ''));
      }),
      C.btn('✔ Cập nhật giá vốn vào danh mục', () => capNhatGiaVon(rows), 'primary'),
    ]));
    host.appendChild(U.el('p', { class: 'section-sub' },
      'Cập nhật giá vốn sẽ ghi "Giá thành đơn vị" vào danh mục hàng hóa. Giá vốn ảnh hưởng tới lãi gộp, '
      + 'thuế TNDN và tỷ lệ chia lãi góp vốn — nên bảng này phải đúng trước khi bấm.'));
  }

  function capNhatGiaVon(rows) {
    const ds = rows.filter(r => r.qty > 0 && r.donVi > 0 && PW.product(r.productId));
    if (!ds.length) return U.toast('Không có sản phẩm nào đủ điều kiện cập nhật', 'error');
    const body = U.el('div');
    body.appendChild(U.el('p', null, 'Sẽ ghi đè giá vốn của ' + ds.length + ' sản phẩm:'));
    body.appendChild(C.table(ds, [
      { label: 'Sản phẩm', render: r => U.esc(r.ten) },
      { label: 'Giá vốn cũ', num: true, render: r => U.money(r.cu) },
      { label: 'Giá vốn mới', num: true, render: r => '<b>' + U.money(r.donVi) + '</b>' },
    ], { empty: '' }));
    C.modal({
      title: 'Xác nhận cập nhật giá vốn', wide: true, body: body,
      footer: [C.btn('Hủy', C.closeModal), C.btn('Ghi đè giá vốn', () => {
        let n = 0;
        ds.forEach(r => {
          const p = PW.product(r.productId);
          if (!p) return;
          p.cost = Math.round(r.donVi);
          n++;
        });
        PW.logActivity('update', 'product', 'Cập nhật giá vốn từ bảng giá thành', n + ' sản phẩm');
        PW.save(); C.closeModal();
        U.toast('Đã cập nhật giá vốn cho ' + n + ' sản phẩm');
        ve();
      }, 'primary')],
    });
  }

  ve();
};
