/* ============================================================
   utils.js — Hàm tiện ích định dạng & DOM
   ============================================================ */

const U = {};

// Định dạng số tiền VND: 1500000 -> "1.500.000"
U.money = function (n) {
  n = Math.round(Number(n) || 0);
  const neg = n < 0;
  n = Math.abs(n);
  let s = n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (neg ? '-' : '') + s;
};

// Tiền + đ
U.vnd = n => U.money(n) + ' đ';

// Định dạng số lượng
U.num = function (n) {
  n = Number(n) || 0;
  if (Number.isInteger(n)) return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return n.toLocaleString('vi-VN');
};

// Ngày: "2026-06-03" -> "03/06/2026"
U.date = function (ymd) {
  if (!ymd) return '';
  const [y, m, d] = ymd.split('-');
  return `${d}/${m}/${y}`;
};

// Ngày hôm nay yyyy-mm-dd
U.today = function () {
  const d = new Date();
  const p = x => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

// Tháng của 1 ngày yyyy-mm
U.monthOf = ymd => ymd ? ymd.slice(0, 7) : '';

// Cộng số ngày vào 1 ngày yyyy-mm-dd
U.addDays = function (ymd, days) {
  if (!ymd) return '';
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + Number(days || 0));
  const p = x => String(x).padStart(2, '0');
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
};

// Khoảng thời gian theo kỳ: 'month' | 'quarter' | 'year'
U.period = function (kind) {
  const t = U.today();
  const Y = t.slice(0, 4), Mo = t.slice(5, 7);
  if (kind === 'month') return { from: `${Y}-${Mo}-01`, to: `${Y}-${Mo}-31`, label: 'Tháng này', year: Y };
  if (kind === 'quarter') {
    const q = Math.floor((Number(Mo) - 1) / 3);
    const sm = String(q * 3 + 1).padStart(2, '0');
    const em = String(q * 3 + 3).padStart(2, '0');
    return { from: `${Y}-${sm}-01`, to: `${Y}-${em}-31`, label: 'Quý này', year: Y };
  }
  return { from: `${Y}-01-01`, to: `${Y}-12-31`, label: 'Năm nay', year: Y };
};

// Tạo phần tử nhanh
U.el = function (tag, attrs, children) {
  const e = document.createElement(tag);
  if (attrs) {
    for (const k in attrs) {
      if (k === 'class') e.className = attrs[k];
      else if (k === 'html') e.innerHTML = attrs[k];
      else if (k.startsWith('on') && typeof attrs[k] === 'function') {
        e.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
      } else if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    }
  }
  if (children != null) {
    (Array.isArray(children) ? children : [children]).forEach(c => {
      if (c == null) return;
      e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
  }
  return e;
};

// Escape HTML
U.esc = function (s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
};

// Thông báo nhỏ (toast)
U.toast = function (msg, type) {
  let t = document.getElementById('pw-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'pw-toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.className = 'toast show ' + (type || 'success');
  clearTimeout(U._toastTimer);
  U._toastTimer = setTimeout(() => { t.className = 'toast'; }, 2500);
};

// Hộp xác nhận đơn giản
U.confirm = function (msg) {
  return window.confirm(msg);
};

// Xuất Excel (.xls) từ tiêu đề + các dòng (mảng các mảng). Số giữ nguyên để Excel tính được.
U.exportExcel = function (filename, headers, rows, title) {
  let html = '<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body>';
  html += '<table border="1">';
  if (title) html += `<tr><td colspan="${headers.length}" style="font-weight:bold;font-size:15px">${U.esc(title)}</td></tr>`;
  html += '<tr>' + headers.map(h => `<th style="background:#dce6f1;font-weight:bold">${U.esc(h)}</th>`).join('') + '</tr>';
  rows.forEach(r => {
    html += '<tr>' + r.map(c => {
      if (typeof c === 'number') return `<td style="mso-number-format:'#,##0'">${c}</td>`;
      return `<td style="mso-number-format:'\\@'">${U.esc(c == null ? '' : c)}</td>`;
    }).join('') + '</tr>';
  });
  html += '</table></body></html>';
  const blob = new Blob(['﻿' + html], { type: 'application/vnd.ms-excel' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = (filename || 'export') + '.xls';
  a.click(); URL.revokeObjectURL(url);
  U.toast('Đã xuất file Excel');
};

// Đọc số tiền VND thành chữ: 7039440 -> "Bảy triệu không trăm ba mươi chín nghìn bốn trăm bốn mươi đồng chẵn."
U.readMoneyVN = function (num) {
  num = Math.round(Math.abs(Number(num) || 0));
  if (num === 0) return 'Không đồng.';
  const ch = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
  // Đọc 1 nhóm 3 chữ số. full=true: luôn đọc "trăm" kể cả hàng trăm = 0 (nhóm không đứng đầu)
  function triple(n, full) {
    const tram = Math.floor(n / 100), chuc = Math.floor((n % 100) / 10), donvi = n % 10;
    let s = '';
    if (tram > 0 || full) s += ch[tram] + ' trăm';
    if (chuc === 0) {
      if (donvi > 0) { if (tram > 0 || full) s += ' lẻ'; s += ' ' + ch[donvi]; }
    } else if (chuc === 1) {
      s += ' mười';
      if (donvi === 5) s += ' lăm'; else if (donvi > 0) s += ' ' + ch[donvi];
    } else {
      s += ' ' + ch[chuc] + ' mươi';
      if (donvi === 1) s += ' mốt'; else if (donvi === 5) s += ' lăm'; else if (donvi > 0) s += ' ' + ch[donvi];
    }
    return s.trim();
  }
  const units = ['', ' nghìn', ' triệu', ' tỷ'];
  const groups = [];
  let n = num;
  while (n > 0) { groups.unshift(n % 1000); n = Math.floor(n / 1000); }
  const len = groups.length;
  const parts = [];
  for (let i = 0; i < len; i++) {
    if (groups[i] === 0) continue;
    parts.push(triple(groups[i], i > 0) + units[len - 1 - i]);
  }
  let r = parts.join(' ').replace(/\s+/g, ' ').trim();
  r = r.charAt(0).toUpperCase() + r.slice(1);
  return r + ' đồng chẵn.';
};
