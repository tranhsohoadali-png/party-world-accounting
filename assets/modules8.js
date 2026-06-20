/* ============================================================
   modules8.js — Sổ giao dịch (đọc accounting_entries do Claude/MCP ghi)
   Tích hợp 1 sổ chung: Claude ghi qua MCP -> hiển thị ở đây.
   ============================================================ */

M.LEDGER_TYPES = {
  expense:       { label: 'Chi phí',  cls: 'red' },
  income:        { label: 'Thu nhập', cls: 'green' },
  receivable:    { label: 'Phải thu', cls: 'blue' },
  payable:       { label: 'Phải trả', cls: 'orange' },
  inventory_in:  { label: 'Nhập kho', cls: 'gray' },
  inventory_out: { label: 'Xuất kho', cls: 'gray' },
};

M.ledger = function (root) {
  // Sổ này lưu trên server (MySQL) -> chỉ chạy ở chế độ server
  if (PW.mode !== 'server') {
    root.appendChild(U.el('div', { class: 'card' }, [
      U.el('div', { class: 'card-title' }, '📒 Sổ giao dịch (Claude / hóa đơn)'),
      U.el('div', { class: 'empty' },
        'Sổ này lưu trên server và chỉ hoạt động khi mở phần mềm tại https://ketoan.tranhdali.vn (không chạy ở chế độ offline).'),
    ]));
    return;
  }

  let lastEntries = [];
  // Đã được chuyển sang sổ chính chưa? (tìm phiếu chi/thu có fromLedgerId trỏ về entry này)
  function convertedOf(id) {
    const sid = String(id);
    const p = (PW.data.payments || []).find(x => String(x.fromLedgerId) === sid);
    if (p) return p.code;
    const r = (PW.data.receipts || []).find(x => String(x.fromLedgerId) === sid);
    if (r) return r.code;
    // hoặc đã áp thẳng vào 1 đơn mua / hóa đơn (thanh toán từ sổ Claude)
    const pu = (PW.data.purchases || []).find(x => (x.settledFromLedger || []).map(String).indexOf(sid) >= 0);
    if (pu) return pu.code;
    const si = (PW.data.salesInvoices || []).find(x => (x.settledFromLedger || []).map(String).indexOf(sid) >= 0);
    if (si) return si.code;
    return null;
  }
  const period = U.period('month');
  const f = {
    type: C.select([{ value: '', label: 'Tất cả loại' }].concat(
      Object.keys(M.LEDGER_TYPES).map(k => ({ value: k, label: M.LEDGER_TYPES[k].label }))), ''),
    from: C.input({ type: 'date', value: period.from, style: 'width:150px' }),
    to: C.input({ type: 'date', value: U.today(), style: 'width:150px' }),
    q: U.el('input', { class: 'search', placeholder: 'Tìm mô tả / danh mục...' }),
  };

  const card = U.el('div', { class: 'card' });
  card.appendChild(U.el('div', { class: 'card-title' }, '📒 Sổ giao dịch — ghi từ Claude / hóa đơn'));
  card.appendChild(U.el('div', { class: 'section-sub' },
    'Mọi khoản chi/thu Claude ghi hiện ở đây. Bấm "→ Phiếu chi / → Phiếu thu" để đưa khoản vào SỔ CHÍNH — khi đó nó mới tính vào Báo cáo lãi/lỗ, Phân tích KD và Sổ quỹ.'));

  const sumRow = U.el('div', { class: 'grid c4' });
  card.appendChild(sumRow);

  const toolbar = U.el('div', { class: 'toolbar mt16' });
  toolbar.appendChild(U.el('div', { class: 'field', style: 'margin:0' }, [U.el('label', null, 'Loại'), f.type]));
  toolbar.appendChild(U.el('div', { class: 'field', style: 'margin:0' }, [U.el('label', null, 'Từ ngày'), f.from]));
  toolbar.appendChild(U.el('div', { class: 'field', style: 'margin:0' }, [U.el('label', null, 'Đến ngày'), f.to]));
  toolbar.appendChild(U.el('div', { class: 'field', style: 'margin:0;flex:1' }, [U.el('label', null, 'Tìm'), f.q]));
  toolbar.appendChild(U.el('div', { class: 'field', style: 'margin:0' }, [U.el('label', null, ' '), C.btn('Xem', load, 'primary')]));
  toolbar.appendChild(U.el('div', { class: 'field', style: 'margin:0' }, [U.el('label', null, ' '), C.btn('📊 Xuất Excel', exportLedger, 'sm')]));
  toolbar.appendChild(U.el('div', { class: 'field', style: 'margin:0' }, [U.el('label', null, ' '), C.btn('⇊ Đưa hết vào sổ', bulkConvert, 'sm')]));
  const onlyUnconv = U.el('input', { type: 'checkbox' });
  onlyUnconv.addEventListener('change', () => load());
  toolbar.appendChild(U.el('label', { class: 'radio', style: 'margin:0;white-space:nowrap;align-self:center' }, [onlyUnconv, ' Chỉ khoản chưa vào sổ']));
  card.appendChild(toolbar);

  const host = U.el('div', null, U.el('div', { class: 'empty' }, 'Đang tải...'));
  card.appendChild(host);
  root.appendChild(card);

  [f.type, f.from, f.to].forEach(x => x.addEventListener('change', load));
  let qTimer = null;
  f.q.addEventListener('input', () => { clearTimeout(qTimer); qTimer = setTimeout(load, 400); });

  async function load() {
    const qs = new URLSearchParams({ action: 'list', type: f.type.value, from: f.from.value, to: f.to.value, q: f.q.value.trim() });
    const r = await PW.api('ledger.php?' + qs.toString());
    if (r.status !== 200 || !r.data || !r.data.ok) {
      host.innerHTML = ''; host.appendChild(U.el('div', { class: 'empty text-red' }, (r.data && r.data.error) || 'Lỗi tải sổ giao dịch'));
      sumRow.innerHTML = ''; return;
    }
    if (r.data.installed === false) {
      host.innerHTML = ''; host.appendChild(U.el('div', { class: 'empty' }, r.data.note || 'Chưa cài Sổ giao dịch.'));
      sumRow.innerHTML = ''; return;
    }
    // Thẻ tổng hợp
    const s = r.data.summary || {};
    sumRow.innerHTML = '';
    [
      { l: 'Tổng thu', v: s.income || 0, c: 'var(--green)' },
      { l: 'Tổng chi', v: s.expense || 0, c: 'var(--red)' },
      { l: 'Chênh lệch (thu-chi)', v: (s.income || 0) - (s.expense || 0), c: 'var(--teal)' },
      { l: 'Số giao dịch', v: s.count || 0, c: 'var(--navy)', count: true },
    ].forEach(k => sumRow.appendChild(U.el('div', { class: 'kpi' }, [
      U.el('div', { class: 'value', style: 'color:' + k.c + ';font-size:20px' }, k.count ? U.num(k.v) : U.money(k.v)),
      U.el('div', { class: 'sub text-muted' }, k.l),
    ])));

    // Bảng entries
    const rows = r.data.entries || [];
    lastEntries = rows;
    const shown = onlyUnconv.checked ? rows.filter(e => !convertedOf(e.id)) : rows;
    host.innerHTML = '';
    host.appendChild(C.table(shown, [
      { label: 'Ngày', render: e => U.date(e.entry_date) },
      { label: 'Loại', center: true, render: e => {
          const t = M.LEDGER_TYPES[e.entry_type] || { label: e.entry_type, cls: 'gray' };
          return `<span class="tag ${t.cls}">${t.label}</span>`;
        } },
      { label: 'Mô tả', render: e => {
          let s = U.esc(e.description || '');
          let d = e.data; if (typeof d === 'string') { try { d = JSON.parse(d); } catch (_) { d = null; } }
          d = d || {};
          const extra = [d.due_date ? 'Hạn TT: ' + U.date(d.due_date) : '', d.notes ? U.esc(d.notes) : ''].filter(Boolean).join(' · ');
          return extra ? s + `<div class="text-muted" style="font-size:11px">${extra}</div>` : s;
        } },
      { label: 'Danh mục', render: e => U.esc(e.category || '') },
      { label: 'Đối tác / Hàng', render: e => U.esc(e.counterparty_name || e.item_name || '') },
      { label: 'SL', num: true, render: e => e.quantity != null ? U.num(e.quantity) : '' },
      { label: 'Số tiền', num: true, render: e => {
          const cls = e.entry_type === 'expense' || e.entry_type === 'payable' ? 'text-red'
            : (e.entry_type === 'income' || e.entry_type === 'receivable' ? 'text-green' : '');
          return `<span class="${cls}">${U.money(e.amount)}</span>`;
        } },
      { label: 'Nguồn', center: true, render: e => {
          const src = e.source === 'mcp' ? '🤖 Claude' : (e.source === 'import' ? '📥 Nhập' : (e.source || 'manual'));
          return `<span class="text-muted" style="font-size:12px">${U.esc(src)}</span>`;
        } },
      { label: 'Vào sổ chính', center: true, render: e => {
          const code = convertedOf(e.id);
          if (code) return `<span class="tag green" title="Đã đưa vào sổ chính">✓ ${U.esc(code)}</span>`;
          if (e.entry_type === 'expense') return `<button class="btn sm primary" data-conv="${e.id}" data-kind="chi">→ Phiếu chi</button>`;
          if (e.entry_type === 'income') return `<button class="btn sm primary" data-conv="${e.id}" data-kind="thu">→ Phiếu thu</button>`;
          return '<span class="text-muted" title="Phải thu/trả/tồn kho — đưa vào sổ qua hóa đơn/phiếu nhập">—</span>';
        } },
    ], { empty: 'Chưa có giao dịch nào trong kỳ. Hãy gửi hóa đơn cho Claude để ghi.' }));
    // Gắn handler cho các nút "→ Phiếu chi/thu" (C.table render bằng HTML string nên dùng delegation)
    host.querySelectorAll('[data-conv]').forEach(btn => btn.addEventListener('click', () => {
      const entry = lastEntries.find(e => String(e.id) === btn.getAttribute('data-conv'));
      if (entry) M.ledgerToVoucher(entry, btn.getAttribute('data-kind'), load);
    }));
  }

  function exportLedger() {
    if (!lastEntries.length) return U.toast('Chưa có giao dịch để xuất', 'error');
    const headers = ['Ngày', 'Loại', 'Mô tả', 'Danh mục', 'Đối tác / Hàng', 'SL', 'Số tiền', 'Ghi chú / Hạn TT', 'Nguồn'];
    const rows = lastEntries.map(e => {
      const t = M.LEDGER_TYPES[e.entry_type] || { label: e.entry_type };
      let d = e.data; if (typeof d === 'string') { try { d = JSON.parse(d); } catch (_) { d = null; } }
      d = d || {};
      const extra = [d.due_date ? 'Hạn TT: ' + U.date(d.due_date) : '', d.notes || ''].filter(Boolean).join(' · ');
      const src = e.source === 'mcp' ? 'Claude' : (e.source || 'manual');
      return [U.date(e.entry_date), t.label, e.description || '', e.category || '',
        e.counterparty_name || e.item_name || '', e.quantity != null ? Number(e.quantity) : '',
        Number(e.amount) || 0, extra, src];
    });
    U.exportExcel('SoGiaoDich', headers, rows, 'SỔ GIAO DỊCH (CLAUDE / MCP)');
  }

  function bulkConvert() {
    const todo = lastEntries.filter(e => (e.entry_type === 'expense' || e.entry_type === 'income') && !convertedOf(e.id));
    if (!todo.length) return U.toast('Không có khoản chi/thu nào CHƯA vào sổ trong danh sách.', 'error');
    M.ledgerBulkToVoucher(todo, load);
  }

  load();
};

/* ---------- Chuyển 1 giao dịch Claude -> Phiếu chi/thu trong SỔ CHÍNH ----------
   Tạo bút toán thật trong PW.data (payments/receipts) để tính vào báo cáo.
   Gắn fromLedgerId để nhận biết "đã chuyển" + tránh tạo trùng. ---------- */
M.ledgerToVoucher = function (entry, kind, after) {
  if (!PW.data.cashAccounts || !PW.data.cashAccounts.length) {
    return U.toast('Chưa có tài khoản tiền. Vào Danh mục → tài khoản tiền để thêm.', 'error');
  }
  const sid = String(entry.id);
  // Chống tạo trùng (đã tạo phiếu HOẶC đã áp thẳng vào 1 đơn)
  const already = (PW.data.payments || []).concat(PW.data.receipts || []).find(x => String(x.fromLedgerId) === sid)
    || (PW.data.purchases || []).find(x => (x.settledFromLedger || []).map(String).indexOf(sid) >= 0)
    || (PW.data.salesInvoices || []).find(x => (x.settledFromLedger || []).map(String).indexOf(sid) >= 0);
  if (already) return U.toast('Giao dịch này đã được xử lý (' + already.code + ') rồi.', 'error');

  const isChi = kind === 'chi';
  const amount = Number(entry.amount) || 0;
  const accSel = C.select(PW.data.cashAccounts.map(a => ({ value: a.id, label: a.name })), PW.data.cashAccounts[0].id);
  // Loại: trả/thu nợ (gắn đối tác → trừ công nợ, KHÔNG vào lãi/lỗ) HOẶC chi phí/thu nhập (vào lãi/lỗ)
  const typeSel = C.select(isChi
    ? [{ value: 'debt', label: 'Trả nợ nhà cung cấp (trừ công nợ phải trả)' }, { value: 'pl', label: 'Chi phí hoạt động (tính vào lãi/lỗ)' }]
    : [{ value: 'debt', label: 'Thu nợ khách hàng (trừ công nợ phải thu)' }, { value: 'pl', label: 'Thu nhập khác (tính vào doanh thu)' }], 'debt');
  const partyList = isChi ? (PW.data.suppliers || []) : (PW.data.customers || []);
  const partySel = C.select([{ value: '', label: '-- Chọn ' + (isChi ? 'nhà cung cấp' : 'khách hàng') + ' --' }]
    .concat(partyList.map(p => ({ value: p.id, label: p.name }))), '');
  const docSel = C.select([{ value: '', label: '-- Không gắn đơn (trả/thu nợ chung) --' }], '');
  const catI = isChi ? C.input({ value: entry.category || '', list: 'dl-conv-expitems', placeholder: 'vd Phần mềm AI, NVL, Lương...' }) : null;

  function unpaidDocs(pid) {
    if (isChi) return (PW.data.purchases || []).filter(pu => pu.supplierId === pid && (PW.purchaseGrand(pu) - (Number(pu.paid) || 0)) > 0.5);
    return (PW.data.salesInvoices || []).filter(si => si.customerId === pid && (PW.invoiceGrand(si) - (Number(si.paid) || 0)) > 0.5);
  }
  function rebuildDocs() {
    const pid = partySel.value;
    const opts = [{ value: '', label: '-- Không gắn đơn (trả/thu nợ chung) --' }];
    if (pid) unpaidDocs(pid).forEach(d => {
      const rem = (isChi ? PW.purchaseGrand(d) : PW.invoiceGrand(d)) - (Number(d.paid) || 0);
      opts.push({ value: d.id, label: d.code + ' · còn ' + U.money(rem) + ' đ' });
    });
    M.rebuildSelect(docSel, opts, '');
  }
  partySel.addEventListener('change', rebuildDocs);

  const dyn = U.el('div', { class: 'form-grid' });
  function render() {
    dyn.innerHTML = '';
    if (typeSel.value === 'debt') {
      dyn.appendChild(C.field(isChi ? 'Nhà cung cấp' : 'Khách hàng', partySel, { required: true, full: true }));
      dyn.appendChild(C.field(isChi ? 'Gắn vào đơn mua chưa trả (tùy chọn — đơn sẽ hiện đã trả)' : 'Gắn vào hóa đơn chưa thu (tùy chọn — HĐ sẽ hiện đã thu)', docSel, { full: true }));
    } else if (isChi) {
      dyn.appendChild(C.field('Khoản mục chi phí (để nhóm báo cáo)', catI, { full: true }));
    } else {
      dyn.appendChild(U.el('div', { class: 'section-sub full' }, 'Sẽ tính vào DOANH THU (thu nhập khác).'));
    }
    dyn.appendChild(C.field(isChi ? 'Chi từ tài khoản' : 'Vào tài khoản', accSel, { full: true }));
  }
  typeSel.addEventListener('change', render);
  render();

  const body = U.el('div', null, [
    U.el('div', { class: 'section-sub' }, 'Đưa giao dịch Claude vào sổ chính cho KHỚP công nợ / lãi-lỗ — chống trùng tự động.'),
    U.el('div', { style: 'margin:10px 0;padding:10px;border:1px solid var(--line,#eee);border-radius:8px' }, [
      U.el('div', null, [U.el('b', null, U.date(entry.entry_date)), '  ·  ', U.el('b', { class: isChi ? 'text-red' : 'text-green' }, U.money(amount) + ' đ')]),
      U.el('div', { class: 'text-muted', style: 'margin-top:2px' }, U.esc(entry.description || '') + (entry.category ? ' · ' + U.esc(entry.category) : '')),
    ]),
    U.el('div', { class: 'form-grid' }, [C.field('Loại', typeSel, { full: true })]),
    dyn,
    isChi ? M.datalist('dl-conv-expitems', (PW.data.expenseItems || []).map(x => x.name)) : null,
  ]);

  C.modal({
    title: isChi ? '→ Đưa vào sổ (chi)' : '→ Đưa vào sổ (thu)', body,
    footer: [C.btn('Hủy', C.closeModal), C.btn('Xác nhận', () => {
      const isDebt = typeSel.value === 'debt';
      if (isDebt && !partySel.value) return U.toast('Hãy chọn ' + (isChi ? 'nhà cung cấp' : 'khách hàng'), 'error');

      // (A) Áp thẳng vào 1 đơn mua / hóa đơn → tăng "đã trả/đã thu", trừ công nợ, KHÔNG nhân đôi chi phí
      if (isDebt && docSel.value) {
        const doc = (isChi ? PW.data.purchases : PW.data.salesInvoices).find(d => d.id === docSel.value);
        if (!doc) return U.toast('Không tìm thấy đơn đã chọn', 'error');
        doc.paid = (Number(doc.paid) || 0) + amount;
        doc.paidAccountId = accSel.value;
        if (!doc.settledFromLedger) doc.settledFromLedger = [];
        doc.settledFromLedger.push(sid);
        PW.logActivity && PW.logActivity('update', isChi ? 'purchase' : 'salesInvoice', doc.code, (isChi ? 'Trả' : 'Thu') + ' ' + U.money(amount) + ' đ (từ sổ Claude)');
        PW.save(); C.closeModal();
        U.toast('Đã ghi ' + (isChi ? 'thanh toán' : 'thu tiền') + ' ' + U.money(amount) + ' đ vào ' + doc.code + ' — công nợ đã trừ');
        if (after) after();
        return;
      }

      // (B) Tạo phiếu chi/thu. Nếu gắn đối tác (debt) → trừ công nợ, không vào lãi/lỗ. Nếu pl → vào lãi/lỗ.
      const obj = {
        id: PW.uid(), code: PW.nextCode(isChi ? 'PC' : 'PT'),
        date: entry.entry_date, accountId: accSel.value, amount: amount,
        reason: entry.description || (isChi ? 'Chi (Claude)' : 'Thu (Claude)'),
        note: 'Từ sổ Claude' + (entry.category ? ' · ' + entry.category : ''), fromLedgerId: sid,
      };
      if (isChi) {
        if (isDebt) { obj.supplierId = partySel.value; }            // gắn NCC → trừ công nợ phải trả, KHÔNG tính lại chi phí
        else { obj.supplierId = null; obj.category = (catI.value || entry.category || '').trim(); }  // chi phí hoạt động → P&L
        PW.data.payments.push(obj);
      } else {
        if (isDebt) { obj.customerId = partySel.value; obj.isRevenue = false; }   // thu nợ → trừ công nợ phải thu, KHÔNG tính lại doanh thu
        else { obj.customerId = null; obj.isRevenue = true; }                     // thu nhập khác → doanh thu
        PW.data.receipts.push(obj);
      }
      PW.logActivity && PW.logActivity('create', isChi ? 'payment' : 'receipt', obj.code, U.money(amount) + ' đ — từ sổ Claude');
      PW.save(); C.closeModal();
      U.toast('Đã tạo ' + (isChi ? 'phiếu chi ' : 'phiếu thu ') + obj.code + (isDebt ? ' — công nợ đã trừ' : ''));
      if (after) after();
    }, 'primary')],
  });
};

/* ---------- Chuyển HÀNG LOẠT giao dịch Claude -> phiếu chi/thu ---------- */
M.ledgerBulkToVoucher = function (entries, after) {
  if (!PW.data.cashAccounts || !PW.data.cashAccounts.length) {
    return U.toast('Chưa có tài khoản tiền. Vào Danh mục để thêm.', 'error');
  }
  const chi = entries.filter(e => e.entry_type === 'expense');
  const thu = entries.filter(e => e.entry_type === 'income');
  const sumChi = chi.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const sumThu = thu.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const accSel = C.select(PW.data.cashAccounts.map(a => ({ value: a.id, label: a.name })), PW.data.cashAccounts[0].id);

  const body = U.el('div', null, [
    U.el('div', { class: 'section-sub' }, 'Đưa HÀNG LOẠT các khoản chưa vào sổ thành phiếu chi/thu trong sổ chính. Danh mục lấy theo từng giao dịch (sửa từng phiếu sau ở mục Tiền nếu cần).'),
    U.el('div', { style: 'margin:10px 0;padding:10px;border:1px solid var(--line,#eee);border-radius:8px' }, [
      U.el('div', null, [U.el('b', null, chi.length + ' phiếu chi'), ' · tổng ', U.el('b', { class: 'text-red' }, U.money(sumChi) + ' đ')]),
      U.el('div', { style: 'margin-top:2px' }, [U.el('b', null, thu.length + ' phiếu thu'), ' · tổng ', U.el('b', { class: 'text-green' }, U.money(sumThu) + ' đ')]),
    ]),
    U.el('div', { class: 'form-grid' }, [C.field('Tài khoản tiền (áp dụng cho tất cả)', accSel, { full: true })]),
  ]);

  C.modal({
    title: '⇊ Đưa hàng loạt vào sổ chính', body,
    footer: [C.btn('Hủy', C.closeModal), C.btn('Tạo ' + entries.length + ' phiếu', () => {
      const existing = new Set((PW.data.payments || []).concat(PW.data.receipts || []).map(x => String(x.fromLedgerId)));
      let nc = 0, nt = 0;
      entries.forEach(e => {
        if (existing.has(String(e.id))) return;   // bỏ qua nếu đã có phiếu
        if (e.entry_type === 'expense') {
          PW.data.payments.push({ id: PW.uid(), code: PW.nextCode('PC'), date: e.entry_date, accountId: accSel.value, supplierId: null, amount: Number(e.amount) || 0, reason: e.description || 'Chi phí (Claude)', category: (e.category || '').trim(), note: 'Từ sổ Claude', fromLedgerId: String(e.id) }); nc++;
        } else if (e.entry_type === 'income') {
          PW.data.receipts.push({ id: PW.uid(), code: PW.nextCode('PT'), date: e.entry_date, accountId: accSel.value, customerId: null, amount: Number(e.amount) || 0, reason: e.description || 'Thu nhập (Claude)', note: 'Từ sổ Claude', isRevenue: true, fromLedgerId: String(e.id) }); nt++;
        }
      });
      PW.save(); C.closeModal();
      U.toast('Đã tạo ' + nc + ' phiếu chi + ' + nt + ' phiếu thu trong sổ chính');
      if (after) after();
    }, 'primary')],
  });
};

/* ---------- Tồn kho (từ sổ MCP) ---------- */
M.mcpInventory = function (root) {
  if (PW.mode !== 'server') {
    root.appendChild(U.el('div', { class: 'card' }, U.el('div', { class: 'empty' },
      'Tồn kho sổ Claude lưu trên server — chỉ hiển thị tại https://ketoan.tranhdali.vn.')));
    return;
  }
  let items = [];
  function exportInv() {
    if (!items.length) return U.toast('Chưa có dữ liệu tồn kho để xuất', 'error');
    const headers = ['Mã', 'Tên', 'ĐVT', 'Nhóm', 'Tồn hiện tại', 'Giá vốn', 'Giá trị tồn'];
    const rows = items.map(it => [it.code, it.name, it.unit || '', it.category || '',
      Number(it.current_qty) || 0, it.cost_per_unit != null ? Number(it.cost_per_unit) : '',
      Math.round(Number(it.current_qty || 0) * Number(it.cost_per_unit || 0))]);
    U.exportExcel('TonKho_MCP', headers, rows, 'TỒN KHO (SỔ CLAUDE / MCP)');
  }
  const card = U.el('div', { class: 'card' });
  const toolbar = U.el('div', { class: 'toolbar' });
  toolbar.appendChild(U.el('div', { class: 'card-title', style: 'margin:0' }, '🏬 Tồn kho (sổ Claude / MCP)'));
  toolbar.appendChild(U.el('div', { class: 'spacer' }));
  toolbar.appendChild(C.btn('📊 Xuất Excel', exportInv, 'sm'));
  card.appendChild(toolbar);
  const host = U.el('div', null, U.el('div', { class: 'empty' }, 'Đang tải...'));
  card.appendChild(host); root.appendChild(card);
  (async function () {
    const r = await PW.api('ledger.php?action=inventory');
    if (r.status !== 200 || !r.data || !r.data.ok) { host.innerHTML = ''; host.appendChild(U.el('div', { class: 'empty text-red' }, 'Lỗi tải tồn kho')); return; }
    if (r.data.installed === false) { host.innerHTML = ''; host.appendChild(U.el('div', { class: 'empty' }, 'Chưa cài sổ tồn kho (inventory_items).')); return; }
    items = r.data.items || [];
    const totVal = items.reduce((s, it) => s + Number(it.current_qty || 0) * Number(it.cost_per_unit || 0), 0);
    host.innerHTML = '';
    host.appendChild(C.table(items, [
      { label: 'Mã', render: it => U.esc(it.code) },
      { label: 'Tên', render: it => U.esc(it.name) },
      { label: 'ĐVT', center: true, render: it => U.esc(it.unit || '') },
      { label: 'Nhóm', render: it => U.esc(it.category || '') },
      { label: 'Tồn hiện tại', num: true, render: it => `<b class="${Number(it.current_qty) <= 0 ? 'text-red' : ''}">${U.num(it.current_qty)}</b>` },
      { label: 'Giá vốn', num: true, render: it => it.cost_per_unit != null ? U.money(it.cost_per_unit) : '' },
      { label: 'Giá trị tồn', num: true, render: it => U.money(Number(it.current_qty || 0) * Number(it.cost_per_unit || 0)) },
    ], { empty: 'Chưa có item tồn kho', footer: [{ html: 'TỔNG GIÁ TRỊ TỒN', colspan: 6 }, { html: U.money(totVal), num: true }] }));
  })();
};

/* ---------- Đối tác NCC + KH (từ sổ MCP) ---------- */
M.mcpCounterparties = function (root) {
  if (PW.mode !== 'server') {
    root.appendChild(U.el('div', { class: 'card' }, U.el('div', { class: 'empty' },
      'Danh sách đối tác sổ Claude lưu trên server — chỉ hiển thị tại https://ketoan.tranhdali.vn.')));
    return;
  }
  let parties = [];
  const TYPE = { supplier: 'Nhà cung cấp', customer: 'Khách hàng', both: 'KH & NCC' };
  function exportCp() {
    if (!parties.length) return U.toast('Chưa có dữ liệu đối tác để xuất', 'error');
    const headers = ['Tên', 'Loại', 'MST', 'Điện thoại', 'Số dư công nợ'];
    const rows = parties.map(p => [p.name, TYPE[p.type] || p.type, p.tax_code || '', p.phone || '', Number(p.current_balance) || 0]);
    U.exportExcel('DoiTac_MCP', headers, rows, 'ĐỐI TÁC — NCC & KHÁCH HÀNG (SỔ CLAUDE)');
  }
  const card = U.el('div', { class: 'card' });
  const toolbar = U.el('div', { class: 'toolbar' });
  toolbar.appendChild(U.el('div', { class: 'card-title', style: 'margin:0' }, '🤝 Đối tác — NCC & Khách hàng (sổ Claude)'));
  toolbar.appendChild(U.el('div', { class: 'spacer' }));
  toolbar.appendChild(C.btn('📊 Xuất Excel', exportCp, 'sm'));
  card.appendChild(toolbar);
  const host = U.el('div', null, U.el('div', { class: 'empty' }, 'Đang tải...'));
  card.appendChild(host); root.appendChild(card);
  (async function () {
    const r = await PW.api('ledger.php?action=counterparties');
    if (r.status !== 200 || !r.data || !r.data.ok) { host.innerHTML = ''; host.appendChild(U.el('div', { class: 'empty text-red' }, 'Lỗi tải đối tác')); return; }
    if (r.data.installed === false) { host.innerHTML = ''; host.appendChild(U.el('div', { class: 'empty' }, 'Chưa cài sổ đối tác (counterparties).')); return; }
    parties = r.data.parties || [];
    host.innerHTML = '';
    host.appendChild(C.table(parties, [
      { label: 'Tên', render: p => U.esc(p.name) },
      { label: 'Loại', center: true, render: p => TYPE[p.type] || p.type },
      { label: 'MST', render: p => U.esc(p.tax_code || '') },
      { label: 'Điện thoại', render: p => U.esc(p.phone || '') },
      { label: 'Số dư công nợ', num: true, render: p => {
          const b = Number(p.current_balance || 0);
          if (b > 0) return `<span class="text-blue" title="Khách còn nợ">${U.money(b)}</span>`;
          if (b < 0) return `<span class="text-red" title="Mình nợ NCC">(${U.money(-b)})</span>`;
          return '<span class="text-muted">0</span>';
        } },
    ], { empty: 'Chưa có đối tác' }));
  })();
};
