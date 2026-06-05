/* ============================================================
   app.js — Khung ứng dụng, điều hướng, khởi động
   ============================================================ */
const App = { current: 'dashboard' };

App.menu = [
  { group: 'TỔNG QUAN', items: [
    { id: 'dashboard', label: 'Tổng quan', icon: '🏠', title: 'Tổng quan' },
    { id: 'charts', label: 'Biểu đồ', icon: '📈', title: 'Biểu đồ phân tích' },
  ]},
  { group: 'BÁN HÀNG', items: [
    { id: 'sales-flow', label: 'Quy trình', icon: '🧭', title: 'Quy trình bán hàng' },
    { id: 'quotes', label: 'Báo giá', icon: '🧾', title: 'Báo giá' },
    { id: 'orders', label: 'Đơn đặt hàng', icon: '📋', title: 'Đơn đặt hàng' },
    { id: 'sales', label: 'Hóa đơn bán', icon: '🛒', title: 'Bán hàng & Công nợ phải thu' },
    { id: 'returns', label: 'Trả lại hàng bán', icon: '↩️', title: 'Trả lại hàng bán' },
    { id: 'discounts', label: 'Giảm giá hàng bán', icon: '🏷️', title: 'Giảm giá hàng bán' },
  ]},
  { group: 'MUA HÀNG', items: [
    { id: 'purchase-flow', label: 'Quy trình', icon: '🧭', title: 'Quy trình mua hàng' },
    { id: 'purchase-orders', label: 'Đơn mua hàng', icon: '📝', title: 'Đơn mua hàng' },
    { id: 'purchases', label: 'Phiếu nhập mua', icon: '📦', title: 'Mua hàng & Công nợ phải trả' },
    { id: 'purchase-returns', label: 'Trả lại hàng mua', icon: '↪️', title: 'Trả lại hàng mua' },
    { id: 'purchase-discounts', label: 'Giảm giá hàng mua', icon: '🏷️', title: 'Giảm giá hàng mua' },
  ]},
  { group: 'TIỀN', items: [
    { id: 'cash', label: 'Tiền (Thu / Chi)', icon: '💵', title: 'Quỹ tiền — Thu / Chi' },
  ]},
  { group: 'DANH MỤC', items: [
    { id: 'catalog', label: 'Tất cả danh mục', icon: '📚', title: 'Danh mục' },
    { id: 'products', label: 'Hàng hóa', icon: '📦', title: 'Danh mục hàng hóa' },
    { id: 'customers', label: 'Khách hàng', icon: '👥', title: 'Danh mục khách hàng' },
    { id: 'suppliers', label: 'Nhà cung cấp', icon: '🏭', title: 'Danh mục nhà cung cấp' },
    { id: 'cat-employees', label: 'Nhân viên', icon: '🧑‍💼', title: 'Danh mục nhân viên' },
  ]},
  { group: 'BÁO CÁO', items: [
    { id: 'reports', label: 'Báo cáo', icon: '📊', title: 'Báo cáo' },
    { id: 'settings', label: 'Dữ liệu & Sao lưu', icon: '⚙️', title: 'Cài đặt — Sao lưu dữ liệu' },
  ]},
];

App.render = function () {
  const nav = document.getElementById('nav');
  nav.innerHTML = '';
  App.menu.forEach(g => {
    nav.appendChild(U.el('div', { class: 'group-label' }, g.group));
    g.items.forEach(it => {
      const a = U.el('a', {
        class: 'item' + (App.current === it.id ? ' active' : ''),
        href: '#' + it.id,
        onclick: (e) => { e.preventDefault(); App.go(it.id); },
      }, [U.el('span', { class: 'ic' }, it.icon), U.el('span', null, it.label)]);
      nav.appendChild(a);
    });
  });
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
  if (window.location.hash !== '#' + id) window.location.hash = '#' + id;
};

App.refresh = function () {
  const root = document.getElementById('content');
  root.innerHTML = '';
  // Tiêu đề trang
  let title;
  if (App.current === 'catalog') title = 'Danh mục';
  else if (M.CATALOGS && M.CATALOGS[App.current]) title = 'Danh mục ' + M.CATALOGS[App.current].title.toLowerCase();
  else title = App.findItem(App.current).title;
  document.getElementById('page-title').textContent = title;
  // Danh mục đơn giản (cat-*)
  if (M.CATALOGS && M.CATALOGS[App.current]) return M.simpleCatalog(root, App.current);
  switch (App.current) {
    case 'catalog': return M.catalogHub(root);
    case 'dashboard': return M.dashboard(root);
    case 'charts': return M.charts(root);
    case 'sales-flow': return M.salesWorkflow(root);
    case 'quotes': return M.quotations(root);
    case 'orders': return M.salesOrdersPage(root);
    case 'returns': return M.returns(root);
    case 'discounts': return M.discounts(root);
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
    a.href = url; a.download = 'partyworld-backup-' + U.today() + '.json';
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
        meta: { companyName: 'PARTY WORLD', counters: {} },
        cashAccounts: [
          { id: 'acc_cash', name: 'Tiền mặt', type: 'cash', opening: 0 },
          { id: 'acc_bank', name: 'Tiền gửi ngân hàng', type: 'bank', opening: 0 },
        ],
        products: [], customers: [], suppliers: [],
        receipts: [], payments: [], salesInvoices: [], purchases: [],
        quotations: [], salesOrders: [], salesReturns: [], salesDiscounts: [],
        purchaseOrders: [], purchaseReturns: [], purchaseDiscounts: [],
        employees: [], productGroups: [], units: [], warehouses: [], expenseItems: [], paymentTerms: [], partnerGroups: [],
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

/* ---------- Khởi động ---------- */
window.addEventListener('DOMContentLoaded', () => {
  PW.load();
  App.render();
  const hash = (window.location.hash || '').replace('#', '');
  if (hash && App.findItem(hash).id === hash) App.current = hash;
  App.refresh();
});
window.addEventListener('hashchange', () => {
  const hash = (window.location.hash || '').replace('#', '');
  if (hash && App.findItem(hash).id === hash && hash !== App.current) {
    App.current = hash; App.render(); App.refresh();
  }
});
