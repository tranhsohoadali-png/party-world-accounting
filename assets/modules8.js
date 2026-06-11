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
  const period = U.period('month');
  const f = {
    type: C.select([{ value: '', label: 'Tất cả loại' }].concat(
      Object.keys(M.LEDGER_TYPES).map(k => ({ value: k, label: M.LEDGER_TYPES[k].label }))), ''),
    from: C.input({ type: 'date', value: period.from, style: 'width:150px' }),
    to: C.input({ type: 'date', value: U.today(), style: 'width:150px' }),
    q: U.el('input', { class: 'search', placeholder: '🔍 Tìm mô tả / danh mục...' }),
  };

  const card = U.el('div', { class: 'card' });
  card.appendChild(U.el('div', { class: 'card-title' }, '📒 Sổ giao dịch — ghi từ Claude / hóa đơn'));
  card.appendChild(U.el('div', { class: 'section-sub' },
    'Mọi khoản chi/thu/công nợ/tồn kho do bạn gửi hóa đơn cho Claude ghi nhận sẽ hiện ở đây (cập nhật trực tiếp từ server).'));

  const sumRow = U.el('div', { class: 'grid c4' });
  card.appendChild(sumRow);

  const toolbar = U.el('div', { class: 'toolbar mt16' });
  toolbar.appendChild(U.el('div', { class: 'field', style: 'margin:0' }, [U.el('label', null, 'Loại'), f.type]));
  toolbar.appendChild(U.el('div', { class: 'field', style: 'margin:0' }, [U.el('label', null, 'Từ ngày'), f.from]));
  toolbar.appendChild(U.el('div', { class: 'field', style: 'margin:0' }, [U.el('label', null, 'Đến ngày'), f.to]));
  toolbar.appendChild(U.el('div', { class: 'field', style: 'margin:0;flex:1' }, [U.el('label', null, 'Tìm'), f.q]));
  toolbar.appendChild(U.el('div', { class: 'field', style: 'margin:0' }, [U.el('label', null, ' '), C.btn('Xem', load, 'primary')]));
  toolbar.appendChild(U.el('div', { class: 'field', style: 'margin:0' }, [U.el('label', null, ' '), C.btn('📊 Xuất Excel', exportLedger, 'sm')]));
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
    host.innerHTML = '';
    host.appendChild(C.table(rows, [
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
    ], { empty: 'Chưa có giao dịch nào trong kỳ. Hãy gửi hóa đơn cho Claude để ghi.' }));
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

  load();
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
