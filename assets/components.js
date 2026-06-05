/* ============================================================
   components.js — Thành phần dùng chung (modal, form, bảng)
   ============================================================ */
const C = {};

/* ---------- Modal ---------- */
C.modal = function ({ title, body, footer, wide }) {
  C.closeModal();
  const back = U.el('div', { class: 'modal-back', id: 'pw-modal' });
  back.addEventListener('mousedown', e => { if (e.target === back) C.closeModal(); });
  const modal = U.el('div', { class: 'modal' + (wide ? ' wide' : '') });
  const head = U.el('div', { class: 'm-head' }, [
    U.el('h3', null, title),
    U.el('button', { class: 'x', onclick: C.closeModal }, '×'),
  ]);
  const bodyEl = U.el('div', { class: 'm-body' });
  if (typeof body === 'string') bodyEl.innerHTML = body; else bodyEl.appendChild(body);
  modal.appendChild(head);
  modal.appendChild(bodyEl);
  if (footer) {
    const f = U.el('div', { class: 'm-foot' });
    (Array.isArray(footer) ? footer : [footer]).forEach(x => f.appendChild(x));
    modal.appendChild(f);
  }
  back.appendChild(modal);
  document.body.appendChild(back);
  return { back, modal, body: bodyEl };
};
C.closeModal = function () {
  const m = document.getElementById('pw-modal');
  if (m) m.remove();
};

/* ---------- Field helpers ---------- */
C.field = function (label, inputEl, opts) {
  opts = opts || {};
  const f = U.el('div', { class: 'field' + (opts.full ? ' full' : '') });
  const lab = U.el('label', null, [label]);
  if (opts.required) lab.appendChild(U.el('span', { class: 'req' }, ' *'));
  f.appendChild(lab);
  f.appendChild(inputEl);
  if (opts.full) f.classList.add('full');
  return f;
};
C.input = function (attrs) { return U.el('input', Object.assign({ class: 'inp' }, attrs)); };
C.select = function (options, value, attrs) {
  const s = U.el('select', Object.assign({ class: 'inp' }, attrs || {}));
  options.forEach(o => {
    const opt = U.el('option', { value: o.value }, o.label);
    if (String(o.value) === String(value)) opt.selected = true;
    s.appendChild(opt);
  });
  return s;
};
C.textarea = function (attrs) { return U.el('textarea', Object.assign({ class: 'inp', rows: 2 }, attrs)); };

C.btn = function (label, onClick, cls) {
  return U.el('button', { class: 'btn ' + (cls || ''), onclick: onClick }, label);
};

/* ---------- Generic data table ---------- */
// columns: [{ key, label, num, center, render(row)->string|node, width }]
C.table = function (rows, columns, opts) {
  opts = opts || {};
  const wrap = U.el('div', { class: 'table-wrap' });
  const t = U.el('table', { class: 'tbl' });
  const thead = U.el('thead');
  const htr = U.el('tr');
  columns.forEach(c => {
    const th = U.el('th', { class: (c.num ? 'num' : '') + (c.center ? ' center' : '') }, c.label);
    if (c.width) th.style.width = c.width;
    htr.appendChild(th);
  });
  thead.appendChild(htr);
  t.appendChild(thead);
  const tb = U.el('tbody');
  if (!rows.length) {
    const tr = U.el('tr');
    tr.appendChild(U.el('td', { colspan: columns.length }, U.el('div', { class: 'empty' }, opts.empty || 'Chưa có dữ liệu')));
    tb.appendChild(tr);
  } else {
    rows.forEach(row => {
      const tr = U.el('tr');
      columns.forEach(c => {
        const td = U.el('td', { class: (c.num ? 'num' : '') + (c.center ? ' center' : '') });
        const v = c.render ? c.render(row) : row[c.key];
        if (v == null) td.textContent = '';
        else if (typeof v === 'string' || typeof v === 'number') td.innerHTML = v;
        else td.appendChild(v);
        tr.appendChild(td);
      });
      tb.appendChild(tr);
    });
  }
  t.appendChild(tb);
  if (opts.footer) {
    const tf = U.el('tfoot');
    const ftr = U.el('tr');
    opts.footer.forEach(c => {
      const td = U.el('td', { class: (c.num ? 'num' : '') + (c.center ? ' center' : '') });
      td.style.fontWeight = '700';
      td.style.background = '#f7f9fb';
      if (c.colspan) td.colSpan = c.colspan;
      td.innerHTML = c.html != null ? c.html : '';
      ftr.appendChild(td);
    });
    tf.appendChild(ftr);
    t.appendChild(tf);
  }
  wrap.appendChild(t);
  return wrap;
};

/* ---------- Tabs ---------- */
// tabs: [{ label, content(node) }]
C.tabs = function (tabs) {
  const wrap = U.el('div', { class: 'tabs' });
  const nav = U.el('div', { class: 'tab-nav' });
  const body = U.el('div', { class: 'tab-body' });
  tabs.forEach((tb, i) => {
    const btn = U.el('button', { class: 'tab-btn' + (i === 0 ? ' active' : ''), type: 'button' }, tb.label);
    const panel = U.el('div', { class: 'tab-panel' + (i === 0 ? '' : ' hidden') }, tb.content);
    btn.addEventListener('click', () => {
      nav.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      body.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
      btn.classList.add('active'); panel.classList.remove('hidden');
    });
    nav.appendChild(btn); body.appendChild(panel);
  });
  wrap.appendChild(nav); wrap.appendChild(body);
  return wrap;
};

/* ---------- Action buttons cell ---------- */
C.actions = function (list) {
  const d = U.el('div', { class: 'pill-row' });
  list.forEach(a => d.appendChild(U.el('button', { class: 'btn sm ' + (a.cls || 'ghost'), onclick: a.onClick, title: a.title || '' }, a.label)));
  return d;
};
