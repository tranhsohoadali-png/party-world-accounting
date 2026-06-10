/* ============================================================
   modules10.js — Đối soát sàn TMĐT (Shopee / Fahasa / TikTok...)
   So sánh tiền sàn THỰC TRẢ với tổng "thực nhận sau phí" của các
   đơn trên kênh đó trong kỳ.
   ============================================================ */

M.reconcile = function (root) {
  const platforms = (PW.data.channels || []).filter(c => Number(c.feePercent) > 0 || c.isPlatform);
  if (!platforms.length) {
    root.appendChild(U.el('div', { class: 'card' }, U.el('div', { class: 'empty' },
      'Chưa có kênh sàn TMĐT. Vào Danh mục → Kênh bán hàng để thêm (vd Shopee, Fahasa) với % phí sàn.')));
    return;
  }
  const period = U.period('month');
  const chSel = C.select(platforms.map(c => ({ value: c.id, label: c.name })), platforms[0].id);
  const fromI = C.input({ type: 'date', value: period.from, style: 'width:150px' });
  const toI = C.input({ type: 'date', value: U.today(), style: 'width:150px' });
  const actualI = C.input({ type: 'number', value: 0, min: 0, style: 'width:180px;text-align:right' });

  const card = U.el('div', { class: 'card' });
  const toolbar = U.el('div', { class: 'toolbar' });
  toolbar.appendChild(U.el('div', { class: 'field', style: 'margin:0' }, [U.el('label', null, 'Kênh sàn'), chSel]));
  toolbar.appendChild(U.el('div', { class: 'field', style: 'margin:0' }, [U.el('label', null, 'Từ ngày'), fromI]));
  toolbar.appendChild(U.el('div', { class: 'field', style: 'margin:0' }, [U.el('label', null, 'Đến ngày'), toI]));
  toolbar.appendChild(U.el('div', { class: 'field', style: 'margin:0' }, [U.el('label', null, ' '), C.btn('Xem đối soát', draw, 'primary')]));
  card.appendChild(toolbar);
  const sumRow = U.el('div', { class: 'grid c4' });
  card.appendChild(sumRow);
  const host = U.el('div');
  card.appendChild(host);

  // Khu đối chiếu tiền sàn thực trả
  const cmp = U.el('div', { class: 'card', style: 'background:var(--brand-tint)' });
  cmp.appendChild(U.el('div', { class: 'card-title' }, '💸 Đối chiếu tiền sàn thực trả'));
  const diffCell = U.el('span', { style: 'font-weight:700;font-size:16px' });
  const netInfo = U.el('span', { class: 'text-muted' });
  cmp.appendChild(U.el('div', { style: 'display:flex;gap:18px;align-items:center;flex-wrap:wrap' }, [
    U.el('div', null, [U.el('div', { class: 'text-muted', style: 'font-size:13px' }, 'Tổng thực nhận theo sổ (sau phí)'), netInfo]),
    U.el('div', { class: 'field', style: 'margin:0' }, [U.el('label', null, 'Tiền sàn đã chuyển thực tế'), actualI]),
    U.el('div', null, [U.el('div', { class: 'text-muted', style: 'font-size:13px' }, 'Chênh lệch'), diffCell]),
  ]));
  actualI.addEventListener('input', updateDiff);

  root.appendChild(card);
  root.appendChild(cmp);

  let curNet = 0;
  function updateDiff() {
    const actual = Number(actualI.value) || 0;
    const diff = actual - curNet;
    diffCell.textContent = U.money(diff) + ' đ';
    diffCell.className = Math.abs(diff) < 1 ? 'text-green' : 'text-red';
  }

  function draw() {
    const ch = chSel.value, from = fromI.value, to = toI.value;
    const rows = PW.data.salesInvoices.filter(si => si.channelId === ch && si.date >= from && si.date <= to)
      .sort((a, b) => (a.date + a.code).localeCompare(b.date + b.code));
    const T = rows.reduce((t, si) => ({
      gross: t.gross + PW.invoiceTotal(si),
      fee: t.fee + Number(si.platformFee || 0),
      ship: t.ship + Number(si.shippingFee || 0),
      net: t.net + PW.invoiceNet(si),
    }), { gross: 0, fee: 0, ship: 0, net: 0 });
    curNet = T.net; updateDiff();

    sumRow.innerHTML = '';
    [['Doanh thu (gross)', T.gross, 'var(--navy)'], ['Phí sàn', T.fee, 'var(--red)'],
     ['Phí vận chuyển', T.ship, 'var(--red)'], ['Thực nhận (net)', T.net, 'var(--teal)']]
      .forEach(a => sumRow.appendChild(U.el('div', { class: 'kpi' }, [
        U.el('div', { class: 'value', style: 'font-size:20px;color:' + a[2] }, U.money(a[1])),
        U.el('div', { class: 'sub text-muted' }, a[0]),
      ])));

    host.innerHTML = '';
    host.appendChild(C.table(rows, [
      { label: 'Ngày', render: si => U.date(si.date) },
      { label: 'Số HĐ', render: si => U.esc(si.code) },
      { label: 'Khách', render: si => { const c = PW.customer(si.customerId); return c ? U.esc(c.name) : ''; } },
      { label: 'Doanh thu', num: true, render: si => U.money(PW.invoiceTotal(si)) },
      { label: 'Phí sàn', num: true, render: si => `<span class="text-red">${U.money(si.platformFee || 0)}</span>` },
      { label: 'Phí ship', num: true, render: si => U.money(si.shippingFee || 0) },
      { label: 'Thực nhận', num: true, render: si => `<b class="text-green">${U.money(PW.invoiceNet(si))}</b>` },
    ], { empty: 'Không có đơn nào trên kênh này trong kỳ', footer: [
      { html: 'TỔNG', colspan: 3 }, { html: U.money(T.gross), num: true }, { html: U.money(T.fee), num: true },
      { html: U.money(T.ship), num: true }, { html: U.money(T.net), num: true },
    ] }));
    netInfo.innerHTML = '<b style="font-size:18px;color:var(--teal-d)">' + U.money(T.net) + ' đ</b>';
  }
  chSel.addEventListener('change', draw);
  draw();
};
