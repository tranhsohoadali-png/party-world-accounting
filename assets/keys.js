/* ============================================================
   keys.js — Phím tắt toàn cục (B4)
   Một listener keydown duy nhất ở document (capture-phase).
   Chỉ thao tác DOM (modal/toolbar) nên hoạt động y hệt ở cả 2 chế độ.
   ============================================================ */
const K = {};

// Modal đang mở trên cùng (ưu tiên lớp 2 #pw-modal2)
K.topModalBack = function () {
  return document.getElementById('pw-modal2') || document.getElementById('pw-modal');
};
K.topModal = function () {
  const b = K.topModalBack();
  return b ? b.querySelector('.modal') : null;
};
K.closeTopModal = function () {
  if (document.getElementById('pw-modal2')) { C.closeMini(); return true; }
  if (document.getElementById('pw-modal')) { C.closeModal(); return true; }
  return false;
};
K.isTyping = function (e) {
  const t = e.target;
  if (!t) return false;
  const tag = (t.tagName || '').toUpperCase();
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable;
};
K.clickPrimaryFoot = function (modal) {
  const btn = modal && modal.querySelector('.m-foot .btn.primary');
  if (btn) { btn.click(); return true; }
  return false;
};
// docForm (& các form nhiều dòng): bấm "+ Thêm dòng" rồi focus ô SL dòng cuối
K.addItemRow = function (modal) {
  if (!modal || !modal.querySelector('.items-tbl')) return false;
  const btns = modal.querySelectorAll('.m-body button');
  for (const b of btns) {
    if (b.textContent.trim() === '+ Thêm dòng') {
      b.click();
      setTimeout(() => {
        const rows = modal.querySelectorAll('.items-tbl tbody tr');
        const last = rows[rows.length - 1];
        const inp = last && last.querySelector('input[type=number]');
        if (inp) { inp.focus(); inp.select(); }
      }, 0);
      return true;
    }
  }
  return false;
};

K.handle = function (e) {
  const mod = e.ctrlKey || e.metaKey;

  // Ctrl/Cmd + S — luôn chặn lưu trang; bấm nút chính của modal nếu có
  if (mod && !e.shiftKey && !e.altKey && (e.key === 's' || e.key === 'S')) {
    e.preventDefault();
    const m = K.topModal();
    if (m) K.clickPrimaryFoot(m);
    return;
  }
  // Ctrl/Cmd + Enter — thêm dòng trong docForm
  if (mod && e.key === 'Enter') {
    const m = K.topModal();
    if (m && K.addItemRow(m)) e.preventDefault();
    return;
  }
  // Esc — đóng overlay trợ giúp -> đóng modal (để productPicker tự xử lý Esc của nó)
  if (e.key === 'Escape') {
    if (e.target && e.target.closest && e.target.closest('.pp-panel')) return; // panel chọn hàng tự xử lý
    if (document.getElementById('kbd-help')) { K.hideHelp(); e.preventDefault(); return; }
    if (K.closeTopModal()) e.preventDefault();
    return;
  }

  if (K.isTyping(e)) return; // từ đây trở xuống: không nuốt phím khi đang gõ

  // '/' — nhảy tới ô tìm kiếm của trang hiện tại
  if (e.key === '/' && !e.shiftKey && !mod && !e.altKey) {
    const s = document.querySelector('#content input.search') || document.querySelector('#content .toolbar input');
    if (s) { e.preventDefault(); s.focus(); if (s.select) s.select(); }
    return;
  }
  // Shift + / = '?' — bảng phím tắt
  if (e.key === '?' || (e.shiftKey && e.key === '/')) {
    if (!K.topModal()) { e.preventDefault(); K.toggleHelp(); }
    return;
  }
  // Alt + N — tạo mới trên trang hiện tại
  if (e.altKey && (e.key === 'n' || e.key === 'N')) {
    if (K.topModal()) return;
    const b = document.querySelector('#content .toolbar .btn.primary');
    if (b) { e.preventDefault(); b.click(); }
    return;
  }
};

K.SHORTCUTS = [
  ['Ctrl + S', 'Lưu chứng từ đang mở'],
  ['Esc', 'Đóng cửa sổ'],
  ['Ctrl + Enter', 'Thêm dòng hàng (trong phiếu bán/mua)'],
  ['/', 'Nhảy tới ô tìm kiếm'],
  ['Alt + N', 'Tạo mới trên trang hiện tại'],
  ['Shift + /', 'Hiện bảng phím tắt này'],
];
K.toggleHelp = function () { document.getElementById('kbd-help') ? K.hideHelp() : K.showHelp(); };
K.hideHelp = function () { const m = document.getElementById('kbd-help'); if (m) m.remove(); };
K.showHelp = function () {
  K.hideHelp();
  const rows = K.SHORTCUTS.map(s => U.el('div', { class: 'kbd-row' },
    [U.el('kbd', null, s[0]), U.el('span', null, s[1])]));
  const box = U.el('div', { class: 'kbd-help' }, [
    U.el('div', { class: 'kbd-help-head' }, [
      U.el('b', null, 'Phím tắt'),
      U.el('button', { class: 'x', onclick: K.hideHelp }, '×'),
    ]),
    U.el('div', { class: 'kbd-help-body' }, rows),
  ]);
  const back = U.el('div', { class: 'kbd-help-back', id: 'kbd-help' }, box);
  back.addEventListener('mousedown', e => { if (e.target === back) K.hideHelp(); });
  document.body.appendChild(back);
};

K.init = function () {
  if (K._ready) return;
  K._ready = true;
  document.addEventListener('keydown', K.handle, true);
};
window.addEventListener('DOMContentLoaded', K.init);
