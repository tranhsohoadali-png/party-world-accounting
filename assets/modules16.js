/* ============================================================
   modules16.js — "Việc cần làm" (Action Center)
   Gom mọi việc đến hạn / cần xử lý từ toàn bộ dữ liệu vào một màn:
   thu nợ, trả tiền, hàng sắp hết, đơn sàn chưa đối soát, báo giá/đơn
   chưa lên hóa đơn, hạn kê khai thuế — kèm nút đi thẳng tới chỗ xử lý.
   ============================================================ */

M.actionCenter = function (root) {
  const today = U.today();
  // Quyền xem số liệu tiền (ẩn công nợ với nhân viên thường ở chế độ máy chủ)
  const canMoney = PW.mode !== 'server' || !PW.user || ['admin', 'ketoan'].indexOf(PW.user.role) >= 0;
  const groups = [];

  /* ---- Thu tiền (phải thu) ---- */
  if (canMoney) {
    const rows = PW.data.customers.map(c => {
      const debt = PW.customerDebt(c.id);
      if (debt <= 0) return null;
      const overdue = PW.data.salesInvoices.some(si => si.customerId === c.id && si.dueDate
        && si.dueDate < today && (PW.invoiceTotal(si) - Number(si.paid || 0)) > 0);
      return { c, debt, overdue };
    }).filter(Boolean).sort((a, b) => (b.overdue - a.overdue) || (b.debt - a.debt));
    if (rows.length) groups.push({
      key: 'thu', icon: 'inflow', title: 'Cần thu tiền khách hàng', route: 'customers',
      count: rows.length, urgent: rows.filter(r => r.overdue).length,
      items: rows.map(r => ({
        text: r.c.name, sub: U.vnd(r.debt) + (r.overdue ? ' · quá hạn' : ''), urgent: r.overdue,
        actionLabel: 'Thu tiền', action: () => M.receiptForm(null, r.c.id),
      })),
    });
  }

  /* ---- Trả tiền (phải trả) ---- */
  if (canMoney) {
    const rows = PW.data.suppliers.map(s => {
      const debt = PW.supplierDebt(s.id);
      if (debt <= 0) return null;
      const overdue = PW.data.purchases.some(pu => pu.supplierId === s.id && pu.dueDate
        && pu.dueDate < today && (PW.purchaseTotal(pu) - Number(pu.paid || 0)) > 0);
      return { s, debt, overdue };
    }).filter(Boolean).sort((a, b) => (b.overdue - a.overdue) || (b.debt - a.debt));
    if (rows.length) groups.push({
      key: 'tra', icon: 'outflow', title: 'Cần trả tiền nhà cung cấp', route: 'suppliers',
      count: rows.length, urgent: rows.filter(r => r.overdue).length,
      items: rows.map(r => ({
        text: r.s.name, sub: U.vnd(r.debt) + (r.overdue ? ' · quá hạn' : ''), urgent: r.overdue,
        actionLabel: 'Trả tiền', action: () => M.paymentForm(null, r.s.id),
      })),
    });
  }

  /* ---- Đối soát sàn (đơn kênh sàn chưa đối soát) ---- */
  const platformInv = PW.data.salesInvoices.filter(si => {
    const c = PW.channel(si.channelId); return c && (c.isPlatform || Number(c.feePercent) > 0);
  });
  const unrec = platformInv.filter(si => !si.reconciled);
  if (unrec.length) groups.push({
    key: 'ds', icon: 'scale', title: 'Đơn sàn chưa đối soát', route: 'reconcile',
    count: unrec.length, urgent: 0,
    items: unrec.sort((a, b) => a.date < b.date ? 1 : -1).map(si => ({
      text: si.code + ' · ' + (PW.customer(si.customerId) ? PW.customer(si.customerId).name : ''),
      sub: U.date(si.date) + ' · ' + U.vnd(PW.invoiceTotal(si)),
    })),
  });

  /* ---- Hàng sắp hết ---- */
  const low = PW.stockBelowMin();
  if (low.length) groups.push({
    key: 'kho', icon: 'warehouse', title: 'Hàng dưới mức tồn tối thiểu', route: 'purchases',
    count: low.length, urgent: low.filter(x => x.stock <= 0).length,
    items: low.sort((a, b) => (a.stock - a.min) - (b.stock - b.min)).map(x => ({
      text: (x.p.code ? x.p.code + ' · ' : '') + x.p.name,
      sub: 'Tồn ' + U.num(x.stock) + ' / tối thiểu ' + U.num(x.min), urgent: x.stock <= 0,
    })),
  });

  /* ---- Báo giá chưa lên hóa đơn ---- */
  const quotes = PW.data.quotations.filter(q => q.status !== 'converted');
  if (quotes.length) groups.push({
    key: 'bg', icon: 'file-quote', title: 'Báo giá chưa lập hóa đơn', route: 'quotes',
    count: quotes.length, urgent: 0,
    items: quotes.sort((a, b) => a.date < b.date ? 1 : -1).map(q => ({
      text: q.code + ' · ' + (PW.customer(q.customerId) ? PW.customer(q.customerId).name : ''),
      sub: U.date(q.date),
    })),
  });

  /* ---- Đơn đặt hàng chưa lên hóa đơn ---- */
  const orders = PW.data.salesOrders.filter(o => o.status !== 'converted');
  if (orders.length) groups.push({
    key: 'dh', icon: 'clipboard-list', title: 'Đơn đặt hàng chưa lập hóa đơn', route: 'orders',
    count: orders.length, urgent: 0,
    items: orders.sort((a, b) => a.date < b.date ? 1 : -1).map(o => ({
      text: o.code + ' · ' + (PW.customer(o.customerId) ? PW.customer(o.customerId).name : ''),
      sub: U.date(o.date),
    })),
  });

  /* ---- Thuế: hạn kê khai GTGT (ngày 20 tháng sau) ---- */
  if (canMoney) {
    const y = Number(today.slice(0, 4)), mo = Number(today.slice(5, 7));
    let ny = y, nm = mo + 1; if (nm > 12) { nm = 1; ny++; }
    const deadline = ny + '-' + String(nm).padStart(2, '0') + '-20';
    const days = Math.round((new Date(deadline) - new Date(today)) / 86400000);
    if (days <= 12) groups.push({
      key: 'thue', icon: 'doc', title: 'Hạn kê khai thuế GTGT', route: 'reports',
      count: 1, urgent: days <= 5,
      items: [{
        text: 'Tờ khai thuế GTGT tháng ' + mo + '/' + y,
        sub: 'Hạn nộp ' + U.date(deadline) + ' · còn ' + days + ' ngày', urgent: days <= 5,
      }],
    });
  }

  /* ---------- Render ---------- */
  const totalTasks = groups.reduce((s, g) => s + g.count, 0);
  const totalUrgent = groups.reduce((s, g) => s + (g.urgent || 0), 0);

  const hero = U.el('div', { class: 'card', style: 'background:linear-gradient(135deg,#eef6e1,#dcefc0)' });
  hero.appendChild(U.el('div', { style: 'display:flex;align-items:center;gap:14px;flex-wrap:wrap' }, [
    U.el('span', { class: 'todo-hero-ic', html: U.icon('bell', { size: 30 }) }),
    U.el('div', null, [
      U.el('div', { style: 'font-size:20px;font-weight:800;color:var(--navy)' },
        totalTasks ? ('Bạn có ' + totalTasks + ' việc cần xử lý') : 'Tuyệt vời — không có việc nào tồn đọng!'),
      U.el('div', { class: 'section-sub', style: 'margin:2px 0 0' },
        totalUrgent ? ('Trong đó ' + totalUrgent + ' việc GẤP (quá hạn / sắp đến hạn)') : 'Cập nhật ' + U.date(today)),
    ]),
  ]));
  root.appendChild(hero);

  if (!groups.length) {
    root.appendChild(U.el('div', { class: 'card' }, U.el('div', { class: 'empty' },
      'Mọi thứ đang gọn gàng. Khi có hóa đơn đến hạn, hàng sắp hết hay đơn cần đối soát, chúng sẽ hiện ở đây.')));
    return;
  }

  // Sắp xếp nhóm: nhóm có việc gấp lên trước
  groups.sort((a, b) => (b.urgent > 0) - (a.urgent > 0));
  const grid = U.el('div', { class: 'grid c2' });
  groups.forEach(g => {
    const card = U.el('div', { class: 'card', style: 'margin:0' });
    const titleEl = U.el('div', { class: 'card-title', style: 'justify-content:space-between' }, [
      U.el('span', { style: 'display:inline-flex;align-items:center;gap:8px' }, [
        U.el('span', { class: 'todo-gic', html: U.icon(g.icon) }),
        U.el('span', null, g.title),
      ]),
      U.el('span', { class: 'tag ' + (g.urgent ? 'red' : 'green') }, String(g.count)),
    ]);
    card.appendChild(titleEl);
    const list = U.el('div', { class: 'todo-list' });
    g.items.slice(0, 5).forEach(it => {
      const row = U.el('div', { class: 'todo-row' });
      const main = U.el('div', { class: 'todo-main' }, [
        U.el('div', { class: 'todo-text' + (it.urgent ? ' urgent' : '') }, [
          it.urgent ? U.el('span', { class: 'todo-dot' }) : null,
          U.el('span', null, it.text),
        ]),
        U.el('div', { class: 'todo-sub' }, it.sub || ''),
      ]);
      row.appendChild(main);
      if (it.action) {
        row.appendChild(C.btn(it.actionLabel || 'Xử lý', () => { it.action(); }, 'sm primary'));
      }
      list.appendChild(row);
    });
    card.appendChild(list);
    if (g.count > 5) card.appendChild(U.el('div', { class: 'section-sub', style: 'margin:6px 0 0' }, '… và ' + (g.count - 5) + ' mục khác'));
    card.appendChild(U.el('div', { class: 'mt8' },
      C.btn('Mở ' + g.title.toLowerCase() + ' →', () => App.go(g.route))));
    grid.appendChild(card);
  });
  root.appendChild(grid);
};
