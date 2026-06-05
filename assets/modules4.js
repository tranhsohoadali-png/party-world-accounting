/* ============================================================
   modules4.js — Biểu đồ phân tích
   ============================================================ */

/* ---------- Helper: biểu đồ cột (1 hoặc 2 chuỗi) ---------- */
M.columnChart = function (categories, series, opts) {
  // series: [{name, color, values:[]}]
  opts = opts || {};
  const maxV = Math.max(1, ...series.flatMap(s => s.values));
  const wrap = U.el('div');
  const chart = U.el('div', { class: 'col-chart' });
  categories.forEach((cat, i) => {
    const group = U.el('div', { class: 'col-group' });
    const barsBox = U.el('div', { class: 'col-bars' });
    series.forEach(s => {
      const h = (s.values[i] / maxV) * 100;
      const bar = U.el('div', { class: 'col-bar', style: `height:${h}%;background:${s.color}` , title: s.name + ': ' + U.money(s.values[i]) });
      barsBox.appendChild(bar);
    });
    group.appendChild(barsBox);
    group.appendChild(U.el('div', { class: 'col-lbl' }, cat));
    chart.appendChild(group);
  });
  wrap.appendChild(chart);
  // chú thích
  const legend = U.el('div', { class: 'legend' });
  series.forEach(s => legend.appendChild(U.el('div', { class: 'legend-item' }, [
    U.el('span', { class: 'legend-dot', style: 'background:' + s.color }), s.name,
  ])));
  wrap.appendChild(legend);
  return wrap;
};

/* ---------- Helper: thanh ngang xếp hạng ---------- */
M.rankBars = function (rows, opts) {
  // rows: [{label, value}]
  opts = opts || {};
  const maxV = Math.max(1, ...rows.map(r => r.value));
  const wrap = U.el('div', { class: 'rank' });
  if (!rows.length) return U.el('div', { class: 'empty' }, 'Chưa có dữ liệu');
  rows.forEach(r => {
    wrap.appendChild(U.el('div', { class: 'rank-row' }, [
      U.el('div', { class: 'rank-label', title: r.label }, r.label),
      U.el('div', { class: 'rank-track' }, U.el('div', { class: 'rank-fill', style: `width:${r.value / maxV * 100}%;background:${opts.color || 'var(--teal)'}` })),
      U.el('div', { class: 'rank-val' }, U.money(r.value)),
    ]));
  });
  return wrap;
};

/* ---------- Helper: biểu đồ tròn (donut) ---------- */
M.donut = function (segments) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const R = 60, C0 = 2 * Math.PI * R;
  let offset = 0;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 160 160');
  svg.setAttribute('width', '170'); svg.setAttribute('height', '170');
  const bg = document.createElementNS(ns, 'circle');
  bg.setAttribute('cx', 80); bg.setAttribute('cy', 80); bg.setAttribute('r', R);
  bg.setAttribute('fill', 'none'); bg.setAttribute('stroke', '#eef1f4'); bg.setAttribute('stroke-width', 22);
  svg.appendChild(bg);
  segments.forEach(seg => {
    const frac = seg.value / total;
    const circle = document.createElementNS(ns, 'circle');
    circle.setAttribute('cx', 80); circle.setAttribute('cy', 80); circle.setAttribute('r', R);
    circle.setAttribute('fill', 'none'); circle.setAttribute('stroke', seg.color); circle.setAttribute('stroke-width', 22);
    circle.setAttribute('stroke-dasharray', `${frac * C0} ${C0}`);
    circle.setAttribute('stroke-dashoffset', -offset * C0);
    circle.setAttribute('transform', 'rotate(-90 80 80)');
    svg.appendChild(circle);
    offset += frac;
  });
  const box = U.el('div', { style: 'display:flex;align-items:center;gap:18px;flex-wrap:wrap' });
  box.appendChild(svg);
  const legend = U.el('div');
  segments.forEach(seg => {
    const pct = (seg.value / total * 100).toFixed(1);
    legend.appendChild(U.el('div', { class: 'legend-item', style: 'margin:6px 0' }, [
      U.el('span', { class: 'legend-dot', style: 'background:' + seg.color }),
      U.el('span', null, seg.label + ': '),
      U.el('b', { style: 'margin-left:4px' }, U.money(seg.value) + ' (' + pct + '%)'),
    ]));
  });
  box.appendChild(legend);
  return box;
};

/* ---------- Bảng màu dùng chung ---------- */
M.PALETTE = ['#1ea7a0', '#f5a623', '#2d8cf0', '#9b59b6', '#e74c3c', '#27ae60', '#e67e22', '#16a085', '#8e44ad', '#c0392b'];

/* ---------- Helper: biểu đồ đường (nhiều chuỗi) ---------- */
M.lineChart = function (categories, series, opts) {
  opts = opts || {};
  const W = 640, H = 240, padL = 46, padR = 14, padT = 18, padB = 26;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const allVals = series.flatMap(s => s.values);
  const maxV = Math.max(1, ...allVals);
  const minV = Math.min(0, ...allVals);
  const range = maxV - minV || 1;
  const n = categories.length;
  const x = i => padL + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = v => padT + plotH - ((v - minV) / range) * plotH;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('width', '100%'); svg.setAttribute('height', H);
  // lưới ngang + nhãn trục y
  for (let g = 0; g <= 4; g++) {
    const val = minV + (range * g / 4);
    const yy = y(val);
    const ln = document.createElementNS(ns, 'line');
    ln.setAttribute('x1', padL); ln.setAttribute('x2', W - padR);
    ln.setAttribute('y1', yy); ln.setAttribute('y2', yy);
    ln.setAttribute('stroke', '#eef1f4'); ln.setAttribute('stroke-width', 1);
    svg.appendChild(ln);
    const tx = document.createElementNS(ns, 'text');
    tx.setAttribute('x', padL - 6); tx.setAttribute('y', yy + 4);
    tx.setAttribute('text-anchor', 'end'); tx.setAttribute('font-size', '10'); tx.setAttribute('fill', '#7b8794');
    tx.textContent = U.money(Math.round(val));
    svg.appendChild(tx);
  }
  // nhãn trục x
  categories.forEach((c, i) => {
    const tx = document.createElementNS(ns, 'text');
    tx.setAttribute('x', x(i)); tx.setAttribute('y', H - 8);
    tx.setAttribute('text-anchor', 'middle'); tx.setAttribute('font-size', '10'); tx.setAttribute('fill', '#7b8794');
    tx.textContent = c;
    svg.appendChild(tx);
  });
  // đường + điểm
  series.forEach(s => {
    const pts = s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ');
    const poly = document.createElementNS(ns, 'polyline');
    poly.setAttribute('points', pts);
    poly.setAttribute('fill', 'none'); poly.setAttribute('stroke', s.color); poly.setAttribute('stroke-width', 2.5);
    poly.setAttribute('stroke-linejoin', 'round'); poly.setAttribute('stroke-linecap', 'round');
    svg.appendChild(poly);
    s.values.forEach((v, i) => {
      const ci = document.createElementNS(ns, 'circle');
      ci.setAttribute('cx', x(i)); ci.setAttribute('cy', y(v)); ci.setAttribute('r', 3);
      ci.setAttribute('fill', '#fff'); ci.setAttribute('stroke', s.color); ci.setAttribute('stroke-width', 2);
      const t = document.createElementNS(ns, 'title');
      t.textContent = s.name + ' ' + categories[i] + ': ' + U.money(v);
      ci.appendChild(t);
      svg.appendChild(ci);
    });
  });
  const wrap = U.el('div');
  wrap.appendChild(svg);
  const legend = U.el('div', { class: 'legend' });
  series.forEach(s => legend.appendChild(U.el('div', { class: 'legend-item' }, [
    U.el('span', { class: 'legend-dot', style: 'background:' + s.color }), s.name,
  ])));
  wrap.appendChild(legend);
  return wrap;
};

/* ---------- Trang Biểu đồ ---------- */
M.charts = function (root) {
  const year = U.today().slice(0, 4);

  // 1) Doanh thu & lợi nhuận theo tháng
  const cats = [], rev = [], profit = [];
  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, '0');
    const f = `${year}-${mm}-01`, t = `${year}-${mm}-31`;
    const r = PW.revenue(f, t);
    const c = PW.cogs(f, t);
    const e = PW.expenses(f, t);
    cats.push('T' + m); rev.push(r); profit.push(r - c - e);
  }
  const c1 = U.el('div', { class: 'card' });
  c1.appendChild(U.el('div', { class: 'card-title' }, '📈 Doanh thu & Lợi nhuận theo tháng (năm ' + year + ')'));
  c1.appendChild(M.columnChart(cats, [
    { name: 'Doanh thu', color: 'var(--teal)', values: rev },
    { name: 'Lợi nhuận', color: 'var(--orange)', values: profit },
  ]));
  root.appendChild(c1);

  const row = U.el('div', { class: 'grid c2' });

  // 2) Cơ cấu tài sản (donut)
  const c2 = U.el('div', { class: 'card' });
  c2.appendChild(U.el('div', { class: 'card-title' }, '🥧 Cơ cấu tài sản'));
  c2.appendChild(M.donut([
    { label: 'Tiền (mặt + gửi)', value: PW.totalCash(), color: '#1ea7a0' },
    { label: 'Phải thu khách hàng', value: PW.totalReceivable(), color: '#2d8cf0' },
    { label: 'Hàng tồn kho', value: PW.inventoryValue(), color: '#f5a623' },
  ]));
  row.appendChild(c2);

  // 3) Phải thu vs Phải trả (donut)
  const c3 = U.el('div', { class: 'card' });
  c3.appendChild(U.el('div', { class: 'card-title' }, '⚖️ Công nợ'));
  c3.appendChild(M.donut([
    { label: 'Phải thu khách hàng', value: PW.totalReceivable(), color: '#2d8cf0' },
    { label: 'Phải trả nhà cung cấp', value: PW.totalPayable(), color: '#e74c3c' },
  ]));
  row.appendChild(c3);
  root.appendChild(row);

  const row2 = U.el('div', { class: 'grid c2' });

  // 4) Top hàng bán chạy theo doanh thu
  const soldAgg = {};
  PW.data.salesInvoices.filter(si => si.date.startsWith(year)).forEach(si => si.items.forEach(it => {
    soldAgg[it.productId] = (soldAgg[it.productId] || 0) + Number(it.qty) * Number(it.price);
  }));
  const topProd = Object.keys(soldAgg).map(pid => ({ label: (PW.product(pid) || {}).name || '?', value: soldAgg[pid] }))
    .sort((a, b) => b.value - a.value).slice(0, 7);
  const c4 = U.el('div', { class: 'card' });
  c4.appendChild(U.el('div', { class: 'card-title' }, '🔥 Top hàng bán chạy (doanh thu)'));
  c4.appendChild(M.rankBars(topProd, { color: 'var(--teal)' }));
  row2.appendChild(c4);

  // 5) Top khách hàng theo doanh thu
  const custAgg = {};
  PW.data.salesInvoices.filter(si => si.date.startsWith(year)).forEach(si => {
    custAgg[si.customerId] = (custAgg[si.customerId] || 0) + PW.invoiceTotal(si);
  });
  const topCust = Object.keys(custAgg).map(cid => ({ label: (PW.customer(cid) || {}).name || '?', value: custAgg[cid] }))
    .sort((a, b) => b.value - a.value).slice(0, 7);
  const c5 = U.el('div', { class: 'card' });
  c5.appendChild(U.el('div', { class: 'card-title' }, '👑 Top khách hàng (doanh thu)'));
  c5.appendChild(M.rankBars(topCust, { color: 'var(--orange)' }));
  row2.appendChild(c5);
  root.appendChild(row2);
};
