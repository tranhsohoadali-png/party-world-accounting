/* ============================================================
   components.js — Thành phần dùng chung (modal, form, bảng)
   ============================================================ */
const C = {};

/* ---------- Modal ---------- */
C.modal = function ({ title, body, footer, wide }) {
  C.closeModal();
  const back = U.el('div', { class: 'modal-back', id: 'pw-modal' });
  // KHÔNG đóng khi lỡ bấm ra nền — tránh mất chỉnh sửa. Đóng bằng nút × hoặc Hủy.
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
  if (U.iconifyTitles) U.iconifyTitles(modal);   // thay emoji -> icon trong modal
  return { back, modal, body: bodyEl };
};
C.closeModal = function () {
  const m = document.getElementById('pw-modal');
  if (m) m.remove();
};

/* Modal LỚP 2 — đè lên modal đang mở (để "thêm nhanh" trong form mà không đóng form) */
C.miniModal = function ({ title, body, footer, wide }) {
  C.closeMini();
  const back = U.el('div', { class: 'modal-back', id: 'pw-modal2', style: 'z-index:140' });
  // KHÔNG đóng khi lỡ bấm ra nền — tránh mất chỉnh sửa. Đóng bằng nút × hoặc Hủy.
  const modal = U.el('div', { class: 'modal' + (wide ? ' wide' : '') });
  const head = U.el('div', { class: 'm-head' }, [
    U.el('h3', null, title),
    U.el('button', { class: 'x', onclick: C.closeMini }, '×'),
  ]);
  const bodyEl = U.el('div', { class: 'm-body' });
  if (typeof body === 'string') bodyEl.innerHTML = body; else bodyEl.appendChild(body);
  modal.appendChild(head); modal.appendChild(bodyEl);
  if (footer) {
    const f = U.el('div', { class: 'm-foot' });
    (Array.isArray(footer) ? footer : [footer]).forEach(x => f.appendChild(x));
    modal.appendChild(f);
  }
  back.appendChild(modal); document.body.appendChild(back);
  if (U.iconifyTitles) U.iconifyTitles(modal);
  return { back, modal, body: bodyEl };
};
C.closeMini = function () { const m = document.getElementById('pw-modal2'); if (m) m.remove(); };

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

/* ---------- Ô nhập TIỀN có dấu chấm ngăn nghìn ----------
   "7313889" nhìn rất dễ đếm nhầm một số 0; "7.313.889" thì không.
   Phải dùng type="text" chứ KHÔNG dùng type="number": trình duyệt coi dấu chấm
   là ký tự không hợp lệ trong ô number nên không thể hiển thị nhóm nghìn.

   Vì .value giờ là chuỗi có dấu chấm, Number(inp.value) sẽ ra NaN.
   ĐỌC SỐ BẰNG inp.soTien(), ĐẶT SỐ BẰNG inp.datSoTien(n) — đừng đọc .value.
   Mỗi lần gõ phát sinh sự kiện 'input' như ô thường, cứ nghe bình thường. */
C.money = function (attrs) {
  const chiSo = s => String(s == null ? '' : s).replace(/\D/g, '');
  const cham = s => (s ? String(Number(s)).replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '');
  const inp = U.el('input', Object.assign(
    { class: 'inp', type: 'text', inputmode: 'numeric', autocomplete: 'off' },
    attrs || {}, { value: '' }));

  inp.soTien = () => Number(chiSo(inp.value)) || 0;
  inp.datSoTien = n => { inp.value = cham(chiSo(Math.round(Number(n) || 0))); };

  inp.addEventListener('input', () => {
    // Định dạng lại làm con trỏ nhảy về cuối nếu không xử lý: đếm số CHỮ SỐ bên
    // trái con trỏ, định dạng xong thì đặt con trỏ lại sau đúng bấy nhiêu chữ số.
    const caret = inp.selectionStart;
    const soChuSoTruoc = chiSo(inp.value.slice(0, caret)).length;
    inp.value = cham(chiSo(inp.value));
    let i = 0, dem = 0;
    while (i < inp.value.length && dem < soChuSoTruoc) { if (/\d/.test(inp.value[i])) dem++; i++; }
    try { inp.setSelectionRange(i, i); } catch (e) { /* ô đang ẩn */ }
  });

  inp.datSoTien((attrs && attrs.value) || 0);
  return inp;
};

/* Dòng "Bằng chữ: ..." đi kèm ô tiền — đọc thành chữ thì sai số chữ số là lộ ngay.
   Trả về phần tử để đặt ngay dưới ô nhập. */
C.moneyWords = function (inp) {
  const d = U.el('div', { class: 'text-muted', style: 'font-size:11.5px;font-style:italic;margin-top:4px;min-height:15px' });
  const ve = () => { const v = inp.soTien(); d.textContent = v > 0 ? 'Bằng chữ: ' + U.readMoneyVN(v) : ''; };
  inp.addEventListener('input', ve);
  ve();
  return d;
};

C.btn = function (label, onClick, cls) {
  return U.el('button', { class: 'btn ' + (cls || ''), onclick: onClick }, label);
};

/* ---------- Generic data table ---------- */
// columns: [{ key, label, num, center, render(row)->string|node, width }]
C.table = function (rows, columns, opts) {
  opts = opts || {};
  const wrap = U.el('div', { class: 'table-wrap' });
  const t = U.el('table', { class: 'tbl tbl-cards' });   // tbl-cards: trên điện thoại tự xếp thành thẻ
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
    rows.forEach((row, ri) => {
      const tr = U.el('tr');
      columns.forEach(c => {
        const td = U.el('td', { class: (c.num ? 'num' : '') + (c.center ? ' center' : ''), 'data-label': (typeof c.label === 'string' ? c.label : '') });
        const v = c.render ? c.render(row) : row[c.key];
        if (v == null) td.textContent = '';
        else if (typeof v === 'string' || typeof v === 'number') td.innerHTML = v;
        else td.appendChild(v);
        tr.appendChild(td);
      });
      if (opts.onRowClick) {
        tr.style.cursor = 'pointer';
        tr.addEventListener('click', e => {
          if (e.target.closest('button,a,input,select,label,textarea')) return;   // không chọn dòng khi bấm nút/link/ô
          [...tb.children].forEach(x => x.classList.remove('row-sel'));
          tr.classList.add('row-sel');
          opts.onRowClick(row, tr, ri);
        });
        if (opts.selectFirst && ri === 0) tr.classList.add('row-sel');
      }
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
