/* ============================================================
   app.js — Khung ứng dụng, điều hướng, khởi động
   ============================================================ */
const App = { current: 'dashboard' };

// icon = tên icon SVG trong U.ICONS (xem assets/icons.js)
App.menu = [
  { group: 'TỔNG QUAN', items: [
    { id: 'dashboard', label: 'Tổng quan', icon: 'home', title: 'Tổng quan' },
    { id: 'todo', label: 'Việc cần làm', icon: 'bell', title: 'Việc cần làm hôm nay' },
    { id: 'analytics', label: 'Phân tích KD', icon: 'chart-pie', title: 'Phân tích kinh doanh', roles: ['admin', 'ketoan'] },
    { id: 'charts', label: 'Biểu đồ', icon: 'bar-chart', title: 'Biểu đồ phân tích', roles: ['admin', 'ketoan'] },
  ]},
  { group: 'SỔ CLAUDE (MCP)', items: [
    { id: 'ledger', label: 'Sổ giao dịch', icon: 'book', title: 'Sổ giao dịch (Claude / hóa đơn)', roles: ['admin', 'ketoan'] },
    { id: 'mcp-inventory', label: 'Tồn kho (MCP)', icon: 'warehouse', title: 'Tồn kho (sổ Claude)', roles: ['admin', 'ketoan'] },
    { id: 'mcp-parties', label: 'Đối tác (MCP)', icon: 'handshake', title: 'Đối tác (sổ Claude)', roles: ['admin', 'ketoan'] },
  ]},
  { group: 'BÁN HÀNG', items: [
    { id: 'sales-flow', label: 'Quy trình', icon: 'route', title: 'Quy trình bán hàng' },
    { id: 'quotes', label: 'Báo giá', icon: 'file-quote', title: 'Báo giá' },
    { id: 'orders', label: 'Đơn đặt hàng', icon: 'clipboard-list', title: 'Đơn đặt hàng' },
    { id: 'sales', label: 'Hóa đơn bán', icon: 'receipt', title: 'Bán hàng & Công nợ phải thu' },
    { id: 'returns', label: 'Trả lại hàng bán', icon: 'rotate-left', title: 'Trả lại hàng bán' },
    { id: 'discounts', label: 'Giảm giá hàng bán', icon: 'tag', title: 'Giảm giá hàng bán' },
    { id: 'reconcile', label: 'Đối soát sàn', icon: 'scale', title: 'Đối soát sàn TMĐT', roles: ['admin', 'ketoan'] },
    { id: 'consign-import', label: 'Làm việc với AI', icon: 'wand', title: 'Làm việc với AI — Gom đơn ký gửi, tự khớp mã hàng' },
    { id: 'crm', label: 'CRM khách hàng', icon: 'crown', title: 'CRM — Chân dung khách hàng', roles: ['admin', 'ketoan'] },
  ]},
  { group: 'VẬN HÀNH KHO', items: [
    { id: 'scan', label: 'Quét đơn (đóng gói / đổi trả)', icon: 'scan', title: 'Trạm quét — Đóng gói & Đổi trả' },
  ]},
  { group: 'MUA HÀNG', roles: ['admin', 'ketoan'], items: [
    { id: 'purchase-flow', label: 'Quy trình', icon: 'route', title: 'Quy trình mua hàng', roles: ['admin', 'ketoan'] },
    { id: 'purchase-orders', label: 'Đơn mua hàng', icon: 'file-edit', title: 'Đơn mua hàng', roles: ['admin', 'ketoan'] },
    { id: 'purchases', label: 'Phiếu nhập mua', icon: 'package', title: 'Mua hàng & Công nợ phải trả', roles: ['admin', 'ketoan'] },
    { id: 'purchase-scan', label: 'Quét hóa đơn mua (AI)', icon: 'scan', title: 'Quét hóa đơn mua bằng camera + AI', roles: ['admin', 'ketoan'] },
    { id: 'purchase-returns', label: 'Trả lại hàng mua', icon: 'rotate-right', title: 'Trả lại hàng mua', roles: ['admin', 'ketoan'] },
    { id: 'purchase-discounts', label: 'Giảm giá hàng mua', icon: 'tag', title: 'Giảm giá hàng mua', roles: ['admin', 'ketoan'] },
    { id: 'stockcount', label: 'Kiểm kê kho', icon: 'clipboard-check', title: 'Kiểm kê kho', roles: ['admin', 'ketoan'] },
  ]},
  { group: 'TIỀN', items: [
    { id: 'cash', label: 'Tiền (Thu / Chi)', icon: 'wallet', title: 'Quỹ tiền — Thu / Chi', roles: ['admin', 'ketoan'] },
  ]},
  { group: 'SẢN XUẤT', items: [
    { id: 'production', label: 'Lệnh sản xuất', icon: 'factory', title: 'Sản xuất & Giá thành', roles: ['admin', 'ketoan'] },
    { id: 'productivity', label: 'Năng suất', icon: 'trending-up', title: 'Năng suất theo nhân viên' },
  ]},
  { group: 'NHÂN SỰ', items: [
    { id: 'payroll', label: 'Tính lương', icon: 'coins', title: 'Tính lương nhân viên', roles: ['admin', 'ketoan'] },
  ]},
  { group: 'DANH MỤC', items: [
    { id: 'catalog', label: 'Tất cả danh mục', icon: 'grid', title: 'Danh mục', roles: ['admin', 'ketoan'] },
    { id: 'products', label: 'Hàng hóa', icon: 'box', title: 'Danh mục hàng hóa' },
    { id: 'customers', label: 'Khách hàng', icon: 'users', title: 'Danh mục khách hàng' },
    { id: 'suppliers', label: 'Nhà cung cấp', icon: 'truck', title: 'Danh mục nhà cung cấp', roles: ['admin', 'ketoan'] },
    { id: 'cat-employees', label: 'Nhân viên', icon: 'id-card', title: 'Danh mục nhân viên', roles: ['admin', 'ketoan'] },
  ]},
  { group: 'THUẾ', roles: ['admin', 'ketoan'], items: [
    { id: 'tax-sync', label: 'Hóa đơn thuế (cổng)', icon: 'doc', title: 'Đồng bộ hóa đơn từ cổng thuế', roles: ['admin', 'ketoan'] },
  ]},
  { group: 'BÁO CÁO', roles: ['admin', 'ketoan'], items: [
    { id: 'reports', label: 'Báo cáo', icon: 'report', title: 'Báo cáo', roles: ['admin', 'ketoan'] },
  ]},
  { group: 'HỆ THỐNG', items: [
    { id: 'activity-log', label: 'Nhật ký hoạt động', icon: 'book', title: 'Nhật ký hoạt động — Ai sửa gì, khi nào', roles: ['admin', 'ketoan'] },
    { id: 'settings', label: 'Dữ liệu & Sao lưu', icon: 'settings', title: 'Cài đặt — Sao lưu dữ liệu', roles: ['admin', 'ketoan'] },
    { id: 'users', label: 'Người dùng', icon: 'user', title: 'Quản lý người dùng', roles: ['admin'] },
  ]},
];

// Có được xem mục này không (theo vai trò). Chế độ offline (không đăng nhập) thấy tất cả.
App.canSee = function (item) {
  if (PW.mode !== 'server' || !PW.user) return true;
  if (!item.roles) return true;
  return item.roles.includes(PW.user.role);
};

App.render = function () {
  const nav = document.getElementById('nav');
  nav.innerHTML = '';
  App.menu.forEach(g => {
    const items = g.items.filter(App.canSee);
    if (!items.length) return; // ẩn cả nhóm nếu không có mục nào được phép
    nav.appendChild(U.el('div', { class: 'group-label' }, g.group));
    items.forEach(it => {
      const a = U.el('a', {
        class: 'item' + (App.current === it.id ? ' active' : ''),
        href: '#' + it.id,
        onclick: (e) => { e.preventDefault(); App.go(it.id); },
      }, [U.el('span', { class: 'ic', html: U.icon(it.icon) }), U.el('span', null, it.label)]);
      nav.appendChild(a);
    });
  });
  App.renderUserbar();
};

App.findItem = function (id) {
  for (const g of App.menu) for (const it of g.items) if (it.id === id) return it;
  if (id === 'catalog') return { id: 'catalog', title: 'Danh mục' };
  if (M.CATALOGS && M.CATALOGS[id]) return { id: id, title: 'Danh mục ' + M.CATALOGS[id].title };
  return App.menu[0].items[0];
};

App.go = function (id) {
  App.current = id;
  App.render();
  App.refresh();
  if (App._closeMenu) App._closeMenu(); // đóng menu trên điện thoại sau khi chọn
  if (window.location.hash !== '#' + id) window.location.hash = '#' + id;
};

/* ---------- Giao diện: sáng/tối + menu điện thoại ---------- */
App.initUI = function () {
  if (App._uiReady) return;
  App._uiReady = true;
  const themeBtn = document.getElementById('theme-toggle');
  const applyTheme = dark => {
    document.body.classList.toggle('dark', dark);
    if (themeBtn) {
      themeBtn.innerHTML = (U.icon ? U.icon(dark ? 'sun' : 'moon') : (dark ? '☀️' : '🌙'));
      themeBtn.title = dark ? 'Chuyển nền sáng' : 'Chuyển nền tối';
    }
  };
  applyTheme(localStorage.getItem('PW_THEME') === 'dark');
  if (themeBtn) themeBtn.onclick = () => {
    const dark = !document.body.classList.contains('dark');
    localStorage.setItem('PW_THEME', dark ? 'dark' : 'light');
    applyTheme(dark);
  };
  const sidebar = document.querySelector('.sidebar');
  const backdrop = document.getElementById('menu-backdrop');
  const mt = document.getElementById('menu-toggle');
  App._closeMenu = () => { if (sidebar) sidebar.classList.remove('open'); if (backdrop) backdrop.classList.remove('show'); };
  if (mt) mt.onclick = () => { sidebar.classList.toggle('open'); backdrop.classList.toggle('show'); };
  if (backdrop) backdrop.onclick = App._closeMenu;
};

App.refresh = function () {
  // Dừng tự động làm mới chấm công khi rời bảng lương
  if (M._payrollTimer) { clearInterval(M._payrollTimer); M._payrollTimer = null; }
  // Tắt camera trạm quét khi rời trang (giải phóng webcam)
  if (M._scanStop) { try { M._scanStop(); } catch (e) {} M._scanStop = null; }
  const root = document.getElementById('content');
  root.innerHTML = '';
  // Chặn truy cập mục không đủ quyền (kể cả gõ thẳng #hash)
  const item = App.findItem(App.current);
  if (!App.canSee(item)) {
    document.getElementById('page-title').textContent = 'Không đủ quyền';
    root.appendChild(U.el('div', { class: 'card' }, U.el('div', { class: 'empty' }, 'Bạn không có quyền truy cập mục này.')));
    return;
  }
  // Tiêu đề trang
  let title;
  if (App.current === 'catalog') title = 'Danh mục';
  else if (M.CATALOGS && M.CATALOGS[App.current]) title = 'Danh mục ' + M.CATALOGS[App.current].title.toLowerCase();
  else title = item.title;
  document.getElementById('page-title').textContent = title;
  // Danh mục đơn giản (cat-*)
  if (M.CATALOGS && M.CATALOGS[App.current]) return M.simpleCatalog(root, App.current);
  switch (App.current) {
    case 'catalog': return M.catalogHub(root);
    case 'dashboard': return M.dashboard(root);
    case 'todo': return M.actionCenter(root);
    case 'charts': return M.charts(root);
    case 'analytics': return M.analytics(root);
    case 'crm': return M.crm(root);
    case 'scan': return M.scanStation(root);
    case 'productivity': return M.productivity(root);
    case 'stockcount': return M.stockCount(root);
    case 'ledger': return M.ledger(root);
    case 'mcp-inventory': return M.mcpInventory(root);
    case 'mcp-parties': return M.mcpCounterparties(root);
    case 'sales-flow': return M.salesWorkflow(root);
    case 'quotes': return M.quotations(root);
    case 'orders': return M.salesOrdersPage(root);
    case 'returns': return M.returns(root);
    case 'discounts': return M.discounts(root);
    case 'reconcile': return M.reconcile(root);
    case 'consign-import': return M.consignImport(root);
    case 'tax-sync': return M.taxSync(root);
    case 'cash': return M.cash(root);
    case 'sales': return M.sales(root);
    case 'purchases': return M.purchases(root);
    case 'purchase-scan': return M.purchaseScan(root);
    case 'purchase-flow': return M.purchaseWorkflow(root);
    case 'purchase-orders': return M.purchaseOrders(root);
    case 'purchase-returns': return M.purchaseReturns(root);
    case 'purchase-discounts': return M.purchaseDiscounts(root);
    case 'products': return M.products(root);
    case 'customers': return M.partners(root, 'customer');
    case 'suppliers': return M.partners(root, 'supplier');
    case 'reports': return M.reports(root);
    case 'activity-log': return M.activityLogScreen(root);
    case 'settings': return App.settings(root);
    case 'users': return M.usersAdmin(root);
    case 'payroll': return M.payrolls(root);
    case 'production': return M.production(root);
  }
};

/* ---------- Cài đặt / Sao lưu ---------- */
App.settings = function (root) {
  // ----- Thông tin doanh nghiệp (hiện trên hóa đơn / phiếu giao hàng khi in) -----
  const co = (PW.data.meta.company = PW.data.meta.company || {});
  const coCard = U.el('div', { class: 'card' });
  coCard.appendChild(U.el('div', { class: 'card-title' }, '🏢 Thông tin doanh nghiệp (in chứng từ)'));
  coCard.appendChild(U.el('p', { class: 'section-sub' },
    'Các thông tin này in lên đầu hóa đơn, phiếu giao hàng. Logo lấy từ assets/logo-dali.png.'));
  const coName = C.input({ value: co.name || PW.data.meta.companyName || 'DALI — Tô điểm cuộc sống', style: 'width:100%' });
  const coAddr = C.input({ value: co.address || '', placeholder: 'Số nhà, đường, phường/xã, quận, tỉnh', style: 'width:100%' });
  const coPhone = C.input({ value: co.phone || '', placeholder: 'VD: 0901 234 567', style: 'width:100%' });
  const coMst = C.input({ value: co.mst || '', placeholder: 'Mã số thuế', style: 'width:100%' });
  const coBank = C.input({ value: co.bank || '', placeholder: 'VD: Vietcombank — 0123456789 — CTY DALI', style: 'width:100%' });
  const coNote = C.input({ value: co.note || 'Cảm ơn quý khách! Hân hạnh được phục vụ.', placeholder: 'Dòng chân chứng từ', style: 'width:100%' });
  const coSize = C.select([
    { value: 'A4', label: 'A4 — giấy thường' },
    { value: 'A5', label: 'A5 — nửa trang' },
    { value: '80', label: '80mm — máy in nhiệt / bill' },
  ], co.printSize || 'A4');
  const cg = U.el('div', { class: 'form-grid' });
  cg.appendChild(C.field('Tên hiển thị', coName, { full: true }));
  cg.appendChild(C.field('Địa chỉ', coAddr, { full: true }));
  cg.appendChild(C.field('Điện thoại', coPhone));
  cg.appendChild(C.field('Mã số thuế', coMst));
  cg.appendChild(C.field('Tài khoản ngân hàng', coBank, { full: true }));
  cg.appendChild(C.field('Dòng chân chứng từ', coNote, { full: true }));
  cg.appendChild(C.field('Khổ giấy in mặc định', coSize));
  const coAccD = C.input({ value: co.accDebit || '131', placeholder: '131', style: 'width:100%' });
  const coAccC = C.input({ value: co.accCredit || '5111', placeholder: '5111', style: 'width:100%' });
  cg.appendChild(C.field('TK Nợ (phiếu xuất kho)', coAccD));
  cg.appendChild(C.field('TK Có (phiếu xuất kho)', coAccC));
  coCard.appendChild(cg);
  coCard.appendChild(U.el('div', { class: 'pill-row mt8' }, [
    C.btn('Lưu thông tin', () => {
      Object.assign(PW.data.meta.company, {
        name: coName.value.trim(), address: coAddr.value.trim(), phone: coPhone.value.trim(),
        mst: coMst.value.trim(), bank: coBank.value.trim(), note: coNote.value.trim(), printSize: coSize.value,
        accDebit: coAccD.value.trim() || '131', accCredit: coAccC.value.trim() || '5111',
      });
      PW.data.meta.companyName = coName.value.trim() || PW.data.meta.companyName;
      PW.save(); U.toast('Đã lưu thông tin doanh nghiệp');
    }, 'primary'),
    C.btn('🖨 In thử phiếu giao hàng', () => {
      const si = PW.data.salesInvoices[0];
      if (!si) { U.toast('Chưa có hóa đơn nào để in thử', 'error'); return; }
      M.deliveryNote(si, coSize.value);
    }),
  ]));
  root.appendChild(coCard);

  const card = U.el('div', { class: 'card' });
  card.appendChild(U.el('div', { class: 'card-title' }, '⚙️ Dữ liệu & Sao lưu'));
  card.appendChild(U.el('p', { class: 'section-sub' },
    'Toàn bộ dữ liệu được lưu trên trình duyệt của máy này. Hãy sao lưu định kỳ để tránh mất dữ liệu.'));

  const exportBtn = C.btn('⬇ Tải file sao lưu (.json)', () => {
    const blob = new Blob([PW.exportJSON()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'dali-backup-' + U.today() + '.json';
    a.click(); URL.revokeObjectURL(url);
    U.toast('Đã tải file sao lưu');
  }, 'primary');

  const importInput = U.el('input', { type: 'file', accept: '.json', style: 'display:none' });
  importInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        PW.importJSON(reader.result);
        U.toast('Đã phục hồi dữ liệu');
        App.refresh();
      } catch (err) { U.toast('File không hợp lệ', 'error'); }
    };
    reader.readAsText(file);
  });
  const importBtn = C.btn('⬆ Phục hồi từ file sao lưu', () => importInput.click());

  const resetBtn = C.btn('🗑 Xóa hết & nạp lại dữ liệu mẫu', () => {
    if (U.confirm('Xóa TOÀN BỘ dữ liệu hiện tại và nạp lại dữ liệu mẫu? Hành động này không thể hoàn tác.')) {
      PW.reset(); App.go('dashboard'); U.toast('Đã nạp lại dữ liệu mẫu');
    }
  }, 'danger');

  const clearBtn = C.btn('🧹 Xóa trắng (bắt đầu sổ sách mới)', () => {
    if (U.confirm('Xóa toàn bộ dữ liệu để bắt đầu sổ sách trống? Danh mục và chứng từ sẽ bị xóa hết.')) {
      PW.data = {
        meta: { companyName: 'DALI', counters: {} },
        cashAccounts: [
          { id: 'acc_cash', name: 'Tiền mặt', type: 'cash', opening: 0 },
          { id: 'acc_bank', name: 'Tiền gửi ngân hàng', type: 'bank', opening: 0 },
        ],
        products: [], customers: [], suppliers: [],
        receipts: [], payments: [], salesInvoices: [], purchases: [],
        quotations: [], salesOrders: [], salesReturns: [], salesDiscounts: [],
        purchaseOrders: [], purchaseReturns: [], purchaseDiscounts: [],
        employees: [], productGroups: [], units: [], warehouses: [], expenseItems: [], paymentTerms: [], partnerGroups: [],
        payrolls: [], productionOrders: [], channels: [], stockAdjustments: [], activityLog: [],
      };
      PW.save(); App.go('dashboard'); U.toast('Đã xóa trắng dữ liệu');
    }
  });

  card.appendChild(U.el('div', { class: 'pill-row mt8' }, [exportBtn, importBtn, importInput, resetBtn, clearBtn]));

  // Thống kê nhanh
  const stat = U.el('div', { class: 'card' });
  stat.appendChild(U.el('div', { class: 'card-title' }, '📈 Thống kê dữ liệu'));
  stat.appendChild(C.table([
    { k: 'Hàng hóa', v: PW.data.products.length },
    { k: 'Khách hàng', v: PW.data.customers.length },
    { k: 'Nhà cung cấp', v: PW.data.suppliers.length },
    { k: 'Hóa đơn bán', v: PW.data.salesInvoices.length },
    { k: 'Phiếu nhập mua', v: PW.data.purchases.length },
    { k: 'Phiếu thu', v: PW.data.receipts.length },
    { k: 'Phiếu chi', v: PW.data.payments.length },
  ], [
    { label: 'Mục', render: r => r.k },
    { label: 'Số lượng', num: true, render: r => U.num(r.v) },
  ]));

  root.appendChild(card);

  // ----- Cấu hình AI (Claude) — chỉ admin, chế độ server -----
  if (PW.mode === 'server' && PW.user && PW.user.role === 'admin') {
    const ai = U.el('div', { class: 'card' });
    ai.appendChild(U.el('div', { class: 'card-title' }, '🤖 Cấu hình AI (Claude)'));
    ai.appendChild(U.el('p', { class: 'section-sub' },
      'Một khóa dùng chung cho Trợ lý AI chat + đọc ảnh/PDF. Lấy khóa tại console.anthropic.com → API Keys ' +
      '(tài khoản API riêng, KHÔNG phải tài khoản claude.ai — cần nạp credit, tối thiểu 5$). Khóa lưu trên máy chủ, không hiện lại đầy đủ.'));
    const statusLine = U.el('div', { class: 'section-sub', html: 'Đang kiểm tra trạng thái...' });
    ai.appendChild(statusLine);
    const keyI = C.input({ type: 'password', placeholder: 'Dán khóa sk-ant-... vào đây', style: 'min-width:320px' });
    const chatSel = C.select([
      { value: 'claude-haiku-4-5-20251001', label: 'Chat: Haiku 4.5 (rẻ, nhanh)' },
      { value: 'claude-sonnet-4-6', label: 'Chat: Sonnet 4.6 (thông minh hơn)' },
    ], 'claude-haiku-4-5-20251001');
    const ocrSel = C.select([
      { value: 'claude-haiku-4-5-20251001', label: 'Đọc ảnh/PDF: Haiku 4.5 (rẻ)' },
      { value: 'claude-sonnet-4-6', label: 'Đọc ảnh/PDF: Sonnet 4.6 (chuẩn hơn)' },
    ], 'claude-haiku-4-5-20251001');
    const resultLine = U.el('div', { class: 'section-sub', style: 'min-height:18px' });
    async function loadStatus() {
      const r = await PW.api('ai-config.php?action=status');
      if (r.status === 200 && r.data && r.data.ok) {
        statusLine.innerHTML = r.data.configured
          ? 'Trạng thái: <b class="text-green">Đã có khóa</b> (' + U.esc(r.data.masked) + ' · nguồn: ' + U.esc(r.data.source) + ')'
          : 'Trạng thái: <b class="text-red">Chưa có khóa</b> — dán khóa rồi bấm Lưu.';
        chatSel.value = r.data.chat_model;
        ocrSel.value = r.data.ocr_model;
      } else statusLine.textContent = 'Không đọc được trạng thái (' + ((r.data && r.data.error) || r.status) + ')';
    }
    const saveBtn = C.btn('Lưu cấu hình', async () => {
      const bodyObj = { chat_model: chatSel.value, ocr_model: ocrSel.value };
      if (keyI.value.trim()) bodyObj.key = keyI.value.trim();
      const r = await PW.api('ai-config.php?action=save', { method: 'POST', body: JSON.stringify(bodyObj) });
      if (r.status === 200 && r.data && r.data.ok) { U.toast('Đã lưu cấu hình AI'); keyI.value = ''; loadStatus(); }
      else U.toast((r.data && r.data.error) || 'Lưu thất bại', 'error');
    }, 'primary');
    const testBtn = C.btn('Kiểm tra kết nối', async () => {
      resultLine.textContent = 'Đang gọi thử Anthropic...';
      const r = await PW.api('ai-config.php?action=test', { method: 'POST', body: '{}' });
      if (r.status === 200 && r.data && r.data.ok) {
        resultLine.innerHTML = '<b class="text-green">✓ Hoạt động!</b> Model ' + U.esc(r.data.model) + ' trả lời: “' + U.esc(r.data.reply) + '”';
      } else resultLine.innerHTML = '<b class="text-red">✗ Lỗi:</b> ' + U.esc((r.data && r.data.error) || ('HTTP ' + r.status));
    });
    ai.appendChild(U.el('div', { class: 'pill-row mt8' }, [keyI, chatSel, ocrSel]));
    ai.appendChild(U.el('div', { class: 'pill-row mt8' }, [saveBtn, testBtn]));
    ai.appendChild(resultLine);
    root.appendChild(ai);
    loadStatus();
  } else if (PW.mode !== 'server') {
    const ai = U.el('div', { class: 'card' });
    ai.appendChild(U.el('div', { class: 'card-title' }, '🤖 Cấu hình AI (Claude)'));
    ai.appendChild(U.el('p', { class: 'section-sub' }, 'Chỉ cấu hình được trên bản máy chủ (ketoan.tranhdali.vn), đăng nhập bằng tài khoản admin.'));
    root.appendChild(ai);
  }

  root.appendChild(stat);

  // Quản lý tài khoản tiền
  const accCard = U.el('div', { class: 'card' });
  accCard.appendChild(U.el('div', { class: 'card-title' }, '🏦 Tài khoản tiền (số dư đầu kỳ)'));
  const accHost = U.el('div');
  function drawAcc() {
    accHost.innerHTML = '';
    accHost.appendChild(C.table(PW.data.cashAccounts, [
      { label: 'Tên tài khoản', render: a => U.esc(a.name) },
      { label: 'Loại', center: true, render: a => a.type === 'cash' ? 'Tiền mặt' : 'Ngân hàng' },
      { label: 'Số dư đầu kỳ', num: true, render: a => U.money(a.opening) },
      { label: 'Số dư hiện tại', num: true, render: a => U.money(PW.accountBalance(a.id)) },
      { label: '', render: a => C.actions([{ label: 'Sửa số dư đầu kỳ', onClick: () => {
          const v = prompt('Số dư đầu kỳ của "' + a.name + '" (đ):', a.opening);
          if (v != null) { a.opening = Number(v) || 0; PW.save(); drawAcc(); U.toast('Đã cập nhật'); }
        } }]) },
    ]));
  }
  drawAcc();
  accCard.appendChild(accHost);
  root.appendChild(accCard);
};

/* ---------- Thanh người dùng (góc trên phải) — chỉ chế độ server ---------- */
App.renderUserbar = function () {
  const bar = document.getElementById('userbar');
  if (!bar) return;
  bar.innerHTML = '';
  if (PW.mode !== 'server' || !PW.user) { bar.classList.add('hidden'); return; }
  bar.classList.remove('hidden');
  bar.appendChild(U.el('span', { class: 'userbar-name' },
    [U.el('b', null, PW.user.fullname || PW.user.username),
     U.el('span', { class: 'userbar-role' }, ' · ' + (M.ROLE_LABEL[PW.user.role] || PW.user.role))]));
  bar.appendChild(U.el('button', { class: 'btn sm', onclick: () => M.changePwForm() }, '🔑 Đổi mật khẩu'));
  bar.appendChild(U.el('button', { class: 'btn sm danger', onclick: () => App.logout() }, 'Đăng xuất'));
};

App.logout = async function () {
  if (!U.confirm('Đăng xuất khỏi phần mềm?')) return;
  await PW.saveNow();
  await PW.api('auth.php?action=logout', { method: 'POST' });
  location.reload();
};

/* ---------- Khởi động ---------- */
App.boot = async function () {
  App.initUI();                                 // sáng/tối + menu điện thoại
  if (U.autoIconify) U.autoIconify();           // tự thay emoji -> icon SVG ở tiêu đề/nút/KPI
  const ses = await PW.detectSession();        // xác định offline hay server
  if (ses.server && !ses.user) { M.loginScreen(); return; } // server nhưng chưa đăng nhập
  await PW.load();
  PW.user = ses.user || PW.user;
  // Trang mặc định theo quyền
  const hash = (window.location.hash || '').replace('#', '');
  if (hash && App.findItem(hash).id === hash && App.canSee(App.findItem(hash))) App.current = hash;
  else App.current = 'dashboard';
  App.render();
  App.refresh();
  if (typeof AIC !== 'undefined') AIC.init();   // trợ lý AI nổi ở mọi màn hình
  App.registerPWA();                            // đăng ký service worker (cài app ra điện thoại)
};

/* ---------- PWA: đăng ký service worker (chỉ chạy trên http/https, bỏ qua file://) ---------- */
App.registerPWA = function () {
  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
    // Tự tải lại khi có bản mới (đỡ phải Ctrl+F5 sau khi deploy)
    let _refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (_refreshing) return; _refreshing = true;
      if (typeof U !== 'undefined') U.toast('Có bản cập nhật mới — đang tải lại...');
      setTimeout(function () { location.reload(); }, 400);
    });
    navigator.serviceWorker.register('sw.js').then(function (reg) {
      // Chủ động kiểm tra cập nhật mỗi lần mở app + định kỳ
      try { reg.update(); } catch (e) {}
      setInterval(function () { try { reg.update(); } catch (e) {} }, 60 * 60 * 1000);
    }).catch(function () { /* bỏ qua nếu lỗi, app vẫn chạy */ });
  }
};

window.addEventListener('DOMContentLoaded', () => { App.boot(); });
// Lưu nốt thay đổi trước khi đóng/tải lại trang (chế độ server)
window.addEventListener('beforeunload', () => {
  if (PW.mode === 'server' && PW._saveTimer) {
    try {
      navigator.sendBeacon('api/data.php?action=save',
        new Blob([JSON.stringify({ data: PW.data, version: PW._version })], { type: 'application/json' }));
    } catch (e) {}
  }
});
window.addEventListener('hashchange', () => {
  const hash = (window.location.hash || '').replace('#', '');
  if (hash && App.findItem(hash).id === hash && hash !== App.current) {
    App.current = hash; App.render(); App.refresh();
  }
});
