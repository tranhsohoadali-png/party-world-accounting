/* ============================================================
   app.js — Khung ứng dụng, điều hướng, khởi động
   ============================================================ */
const App = { current: 'dashboard' };

App.menu = [
  { group: 'TỔNG QUAN', items: [
    { id: 'dashboard', label: 'Tổng quan', icon: '🏠', title: 'Tổng quan' },
    { id: 'analytics', label: 'Phân tích KD', icon: '📊', title: 'Phân tích kinh doanh', roles: ['admin', 'ketoan'] },
    { id: 'charts', label: 'Biểu đồ', icon: '📈', title: 'Biểu đồ phân tích', roles: ['admin', 'ketoan'] },
  ]},
  { group: 'SỔ CLAUDE (MCP)', items: [
    { id: 'ledger', label: 'Sổ giao dịch', icon: '📒', title: 'Sổ giao dịch (Claude / hóa đơn)', roles: ['admin', 'ketoan'] },
    { id: 'mcp-inventory', label: 'Tồn kho (MCP)', icon: '🏬', title: 'Tồn kho (sổ Claude)', roles: ['admin', 'ketoan'] },
    { id: 'mcp-parties', label: 'Đối tác (MCP)', icon: '🤝', title: 'Đối tác (sổ Claude)', roles: ['admin', 'ketoan'] },
  ]},
  { group: 'BÁN HÀNG', items: [
    { id: 'sales-flow', label: 'Quy trình', icon: '🧭', title: 'Quy trình bán hàng' },
    { id: 'quotes', label: 'Báo giá', icon: '🧾', title: 'Báo giá' },
    { id: 'orders', label: 'Đơn đặt hàng', icon: '📋', title: 'Đơn đặt hàng' },
    { id: 'sales', label: 'Hóa đơn bán', icon: '🛒', title: 'Bán hàng & Công nợ phải thu' },
    { id: 'returns', label: 'Trả lại hàng bán', icon: '↩️', title: 'Trả lại hàng bán' },
    { id: 'discounts', label: 'Giảm giá hàng bán', icon: '🏷️', title: 'Giảm giá hàng bán' },
    { id: 'reconcile', label: 'Đối soát sàn', icon: '💸', title: 'Đối soát sàn TMĐT', roles: ['admin', 'ketoan'] },
    { id: 'crm', label: 'CRM khách hàng', icon: '👑', title: 'CRM — Chân dung khách hàng', roles: ['admin', 'ketoan'] },
  ]},
  { group: 'VẬN HÀNH KHO', items: [
    { id: 'scan', label: 'Quét đơn (đóng gói / đổi trả)', icon: '📷', title: 'Trạm quét — Đóng gói & Đổi trả' },
  ]},
  { group: 'MUA HÀNG', roles: ['admin', 'ketoan'], items: [
    { id: 'purchase-flow', label: 'Quy trình', icon: '🧭', title: 'Quy trình mua hàng', roles: ['admin', 'ketoan'] },
    { id: 'purchase-orders', label: 'Đơn mua hàng', icon: '📝', title: 'Đơn mua hàng', roles: ['admin', 'ketoan'] },
    { id: 'purchases', label: 'Phiếu nhập mua', icon: '📦', title: 'Mua hàng & Công nợ phải trả', roles: ['admin', 'ketoan'] },
    { id: 'purchase-returns', label: 'Trả lại hàng mua', icon: '↪️', title: 'Trả lại hàng mua', roles: ['admin', 'ketoan'] },
    { id: 'purchase-discounts', label: 'Giảm giá hàng mua', icon: '🏷️', title: 'Giảm giá hàng mua', roles: ['admin', 'ketoan'] },
    { id: 'stockcount', label: 'Kiểm kê kho', icon: '📋', title: 'Kiểm kê kho', roles: ['admin', 'ketoan'] },
  ]},
  { group: 'TIỀN', items: [
    { id: 'cash', label: 'Tiền (Thu / Chi)', icon: '💵', title: 'Quỹ tiền — Thu / Chi', roles: ['admin', 'ketoan'] },
  ]},
  { group: 'SẢN XUẤT', items: [
    { id: 'production', label: 'Lệnh sản xuất', icon: '🏭', title: 'Sản xuất & Giá thành', roles: ['admin', 'ketoan'] },
    { id: 'productivity', label: 'Năng suất', icon: '📈', title: 'Năng suất theo nhân viên' },
  ]},
  { group: 'NHÂN SỰ', items: [
    { id: 'payroll', label: 'Tính lương', icon: '💰', title: 'Tính lương nhân viên', roles: ['admin', 'ketoan'] },
  ]},
  { group: 'DANH MỤC', items: [
    { id: 'catalog', label: 'Tất cả danh mục', icon: '📚', title: 'Danh mục', roles: ['admin', 'ketoan'] },
    { id: 'products', label: 'Hàng hóa', icon: '📦', title: 'Danh mục hàng hóa' },
    { id: 'customers', label: 'Khách hàng', icon: '👥', title: 'Danh mục khách hàng' },
    { id: 'suppliers', label: 'Nhà cung cấp', icon: '🏭', title: 'Danh mục nhà cung cấp', roles: ['admin', 'ketoan'] },
    { id: 'cat-employees', label: 'Nhân viên', icon: '🧑‍💼', title: 'Danh mục nhân viên', roles: ['admin', 'ketoan'] },
  ]},
  { group: 'BÁO CÁO', roles: ['admin', 'ketoan'], items: [
    { id: 'reports', label: 'Báo cáo', icon: '📊', title: 'Báo cáo', roles: ['admin', 'ketoan'] },
  ]},
  { group: 'HỆ THỐNG', items: [
    { id: 'settings', label: 'Dữ liệu & Sao lưu', icon: '⚙️', title: 'Cài đặt — Sao lưu dữ liệu', roles: ['admin', 'ketoan'] },
    { id: 'users', label: 'Người dùng', icon: '👤', title: 'Quản lý người dùng', roles: ['admin'] },
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
      }, [U.el('span', { class: 'ic' }, it.icon), U.el('span', null, it.label)]);
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
    if (themeBtn) themeBtn.textContent = dark ? '☀️' : '🌙';
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
    case 'cash': return M.cash(root);
    case 'sales': return M.sales(root);
    case 'purchases': return M.purchases(root);
    case 'purchase-flow': return M.purchaseWorkflow(root);
    case 'purchase-orders': return M.purchaseOrders(root);
    case 'purchase-returns': return M.purchaseReturns(root);
    case 'purchase-discounts': return M.purchaseDiscounts(root);
    case 'products': return M.products(root);
    case 'customers': return M.partners(root, 'customer');
    case 'suppliers': return M.partners(root, 'supplier');
    case 'reports': return M.reports(root);
    case 'settings': return App.settings(root);
    case 'users': return M.usersAdmin(root);
    case 'payroll': return M.payrolls(root);
    case 'production': return M.production(root);
  }
};

/* ---------- Cài đặt / Sao lưu ---------- */
App.settings = function (root) {
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
        payrolls: [], productionOrders: [], channels: [], stockAdjustments: [],
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
