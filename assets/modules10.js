/* ============================================================
   modules10.js — Đối soát sàn TMĐT (Shopee / Fahasa / TikTok...)
   VÒNG ĐỜI ĐƠN + đối soát 2 chiều:
   • HÀNG (kho): trạng thái đơn (Đã giao / Hủy / Hoàn / Thất lạc).
     - Hủy/Hoàn  -> cảnh báo "chưa nhập lại kho" + nút NHẬP LẠI KHO.
     - Thất lạc  -> nút GHI TỔN THẤT (hàng không về kho).
   • TIỀN: tiền sàn thực trả từng đơn vs thực nhận sổ + tick "Đã ĐS".
   Tái dùng salesReturns (gắn invoiceId, cờ noRestock) để đảo kho /
   doanh thu đúng — hiện đầy đủ trong mọi báo cáo. KHE CẮM cho API
   Shopee đổ đơn vào sau: chỉ cần set si.channelId + si.orderStatus.
   ============================================================ */

M.SHOPEE_STATUS = {
  delivered: { label: 'Đã giao' },
  cancelled: { label: 'Hủy' },
  returned: { label: 'Hoàn' },
  lost: { label: 'Thất lạc' },
};

M.reconcile = function (root) {
  const platforms = (PW.data.channels || []).filter(c => Number(c.feePercent) > 0 || c.isPlatform);
  if (!platforms.length) {
    root.appendChild(U.el('div', { class: 'card' }, U.el('div', { class: 'empty' },
      'Chưa có kênh sàn TMĐT. Vào Danh mục → Kênh bán hàng để thêm (vd Shopee, Fahasa) với % phí sàn.')));
    return;
  }

  // ----- Helpers -----
  const statusOf = si => si.orderStatus || 'delivered';
  const isRealized = si => statusOf(si) === 'delivered';          // chỉ đơn đã giao mới tính doanh thu / đối soát tiền
  const expectedNet = si => isRealized(si) ? PW.invoiceNet(si) : 0;
  const restockReturn = si => PW.data.salesReturns.find(sr => sr.invoiceId === si.id && !sr.noRestock);
  const lostReturn = si => PW.data.salesReturns.find(sr => sr.invoiceId === si.id && sr.noRestock);
  function goodsState(si) {
    const st = statusOf(si);
    if (st === 'delivered') return { label: 'Đã xuất kho', cls: 'text-green', done: true };
    if (st === 'lost') return lostReturn(si)
      ? { label: 'Đã ghi tổn thất', cls: 'text-muted', done: true }
      : { label: '⚠ Chưa ghi tổn thất', cls: 'text-red', action: 'lost', done: false };
    return restockReturn(si)                                       // cancelled | returned
      ? { label: 'Đã nhập lại kho ✓', cls: 'text-green', done: true }
      : { label: '⚠ Chưa nhập lại kho', cls: 'text-red', action: 'restock', done: false };
  }
  function needsAction(si) {
    if (!goodsState(si).done) return true;
    if (isRealized(si) && !si.reconciled) return true;
    return false;
  }
  function makeReturn(si, noRestock) {
    const obj = {
      id: PW.uid(), code: PW.nextCode('TL'), date: U.today(),
      customerId: si.customerId,
      items: (si.items || []).map(it => ({ productId: it.productId, qty: Number(it.qty), price: Number(it.price) })),
      note: (noRestock ? 'Hàng hoàn THẤT LẠC (không về kho) — đơn ' : 'Nhập lại kho từ đối soát sàn — đơn ') + si.code,
      invoiceId: si.id,
    };
    if (noRestock) obj.noRestock = true;
    PW.data.salesReturns.push(obj);
    PW.save();
  }

  const period = U.period('month');
  const chSel = C.select(platforms.map(c => ({ value: c.id, label: c.name })), platforms[0].id);
  const fromI = C.input({ type: 'date', value: period.from, style: 'width:150px' });
  const toI = C.input({ type: 'date', value: U.today(), style: 'width:150px' });
  const todoChk = U.el('input', { type: 'checkbox' });

  const field = (label, el) => U.el('div', { class: 'field', style: 'margin:0' }, [U.el('label', null, label), el]);
  const card = U.el('div', { class: 'card' });
  const toolbar = U.el('div', { class: 'toolbar' });
  toolbar.appendChild(field('Kênh sàn', chSel));
  toolbar.appendChild(field('Từ ngày', fromI));
  toolbar.appendChild(field('Đến ngày', toI));
  toolbar.appendChild(field(' ', C.btn('Xem đối soát', draw, 'primary')));
  toolbar.appendChild(U.el('div', { class: 'spacer' }));
  toolbar.appendChild(U.el('label', { class: 'radio', style: 'margin:0;white-space:nowrap' }, [todoChk, ' Chỉ đơn cần xử lý']));
  card.appendChild(toolbar);
  card.appendChild(U.el('div', { class: 'section-sub' },
    'Đặt trạng thái từng đơn: Hủy/Hoàn → bấm "Nhập lại kho"; hàng hoàn thất lạc → "Ghi tổn thất". Nhập "Tiền sàn thực trả" rồi tick "Đã ĐS". Mọi thay đổi lưu tự động.'));

  const sumRow = U.el('div', { class: 'grid c4' });
  card.appendChild(sumRow);
  const statusLine = U.el('div', { class: 'section-sub', style: 'margin-top:6px;font-weight:600' });
  card.appendChild(statusLine);
  const host = U.el('div', { class: 'table-wrap', style: 'margin-top:8px' });
  card.appendChild(host);
  root.appendChild(card);

  function draw() {
    const ch = chSel.value, from = fromI.value, to = toI.value;
    const all = PW.data.salesInvoices.filter(si => si.channelId === ch && si.date >= from && si.date <= to);
    const rows = (todoChk.checked ? all.filter(needsAction) : all.slice())
      .sort((a, b) => (a.date + a.code).localeCompare(b.date + b.code));

    // ----- Tổng hợp -----
    const T = all.reduce((t, si) => {
      t.cnt++;
      if (isRealized(si)) {
        const net = PW.invoiceNet(si);
        t.gross += PW.invoiceTotal(si); t.net += net; t.delivered++;
        if (si.reconciled) { t.settled += Number(si.settledAmount || 0); t.diff += Number(si.settledAmount || 0) - net; }
      } else { t.abnormal++; }
      if (!goodsState(si).done) t.goodsTodo++;
      if (isRealized(si) && !si.reconciled) t.moneyTodo++;
      return t;
    }, { cnt: 0, delivered: 0, abnormal: 0, gross: 0, net: 0, settled: 0, diff: 0, goodsTodo: 0, moneyTodo: 0 });

    sumRow.innerHTML = '';
    [['Đơn: đã giao / bất thường', T.delivered + ' / ' + T.abnormal, 'var(--navy)'],
     ['Thực nhận sổ (đã giao)', U.money(T.net), 'var(--teal)'],
     ['Sàn đã trả (đã ĐS)', U.money(T.settled), 'var(--green)'],
     ['Lệch tiền', U.money(T.diff), Math.abs(T.diff) < 1 ? 'var(--teal)' : 'var(--red)']]
      .forEach(a => sumRow.appendChild(U.el('div', { class: 'kpi' }, [
        U.el('div', { class: 'value', style: 'font-size:20px;color:' + a[2] }, a[1]),
        U.el('div', { class: 'sub text-muted' }, a[0]),
      ])));
    const todo = [];
    if (T.goodsTodo) todo.push('⚠ ' + T.goodsTodo + ' đơn cần xử lý kho');
    if (T.moneyTodo) todo.push(T.moneyTodo + ' đơn chưa đối soát tiền');
    statusLine.textContent = todo.length ? 'Việc cần làm: ' + todo.join(' · ') : (T.cnt ? 'Đã xử lý xong tất cả ✓' : '');
    statusLine.className = 'section-sub' + (todo.length ? ' text-red' : '');

    // ----- Bảng -----
    host.innerHTML = '';
    const tbl = U.el('table', { class: 'tbl' });
    const heads = ['Ngày', 'Số HĐ', 'Khách', 'Trạng thái', 'Doanh thu', 'Thực nhận sổ', 'Tiền sàn thực trả', 'Lệch', 'Đã ĐS', 'HÀNG (kho)'];
    tbl.appendChild(U.el('thead', null, U.el('tr', null,
      heads.map((h, i) => U.el('th', { class: (i >= 4 && i <= 7) ? 'num' : (i === 8 ? 'center' : '') }, h)))));
    const tb = U.el('tbody');

    rows.forEach(si => {
      const realized = isRealized(si);
      const expNet = expectedNet(si);
      const cust = PW.customer(si.customerId);

      const stSel = C.select(Object.keys(M.SHOPEE_STATUS).map(k => ({ value: k, label: M.SHOPEE_STATUS[k].label })), statusOf(si));
      stSel.addEventListener('change', () => { si.orderStatus = stSel.value; PW.save(); draw(); });

      const diffCell = U.el('span');
      const settledI = U.el('input', { type: 'number', value: (si.settledAmount != null ? si.settledAmount : expNet), style: 'width:115px;text-align:right' });
      const chk = U.el('input', { type: 'checkbox' }); if (si.reconciled) chk.checked = true;
      if (!realized) { settledI.disabled = true; chk.disabled = true; }
      function refreshDiff() {
        const d = (Number(settledI.value) || 0) - expNet;
        diffCell.textContent = U.money(d);
        diffCell.className = (!chk.checked || !realized) ? 'text-muted' : (Math.abs(d) < 1 ? 'text-green' : 'text-red');
      }
      settledI.addEventListener('input', refreshDiff);
      settledI.addEventListener('change', () => { si.settledAmount = Number(settledI.value) || 0; PW.save(); draw(); });
      chk.addEventListener('change', () => {
        si.reconciled = chk.checked; si.settledAmount = Number(settledI.value) || 0;
        if (chk.checked) si.reconciledDate = U.today(); else delete si.reconciledDate;
        PW.save(); draw();
      });
      refreshDiff();

      const gs = goodsState(si);
      const goodsKids = [U.el('span', { class: gs.cls }, gs.label)];
      if (gs.action === 'restock') goodsKids.push(U.el('div', { style: 'margin-top:4px' }, C.btn('Nhập lại kho', () => { makeReturn(si, false); draw(); }, 'sm primary')));
      else if (gs.action === 'lost') goodsKids.push(U.el('div', { style: 'margin-top:4px' }, C.btn('Ghi tổn thất', () => { if (U.confirm('Ghi nhận hàng đơn ' + si.code + ' bị THẤT LẠC (không về kho, ghi tổn thất)?')) { makeReturn(si, true); draw(); } }, 'sm danger')));

      tb.appendChild(U.el('tr', { style: !realized ? 'background:rgba(231,111,81,0.07)' : (si.reconciled ? 'background:rgba(124,179,66,0.10)' : '') }, [
        U.el('td', null, U.date(si.date)),
        U.el('td', null, U.esc(si.code)),
        U.el('td', null, cust ? U.esc(cust.name) : ''),
        U.el('td', null, stSel),
        U.el('td', { class: 'num' }, U.money(PW.invoiceTotal(si))),
        U.el('td', { class: 'num' }, realized ? U.el('b', null, U.money(expNet)) : U.el('span', { class: 'text-muted' }, '—')),
        U.el('td', { class: 'num' }, settledI),
        U.el('td', { class: 'num' }, diffCell),
        U.el('td', { class: 'center' }, chk),
        U.el('td', null, goodsKids),
      ]));
    });
    if (!rows.length) {
      tb.appendChild(U.el('tr', null, U.el('td', { colspan: 10 },
        U.el('div', { class: 'empty' }, todoChk.checked ? 'Không còn đơn nào cần xử lý' : 'Không có đơn nào trên kênh này trong kỳ'))));
    }
    tbl.appendChild(tb);
    host.appendChild(tbl);
  }

  chSel.addEventListener('change', draw);
  fromI.addEventListener('change', draw);
  toI.addEventListener('change', draw);
  todoChk.addEventListener('change', draw);
  draw();
};
