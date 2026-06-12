/* ============================================================
   icons.js — Bộ icon SVG thống nhất cho DALI
   Phong cách: line-icon bo tròn (24x24, stroke=currentColor) nên icon
   tự ăn theo màu chữ: xám ở menu, xanh khi đang chọn, trắng trên badge.

   Dùng trực tiếp:  U.icon('home')  -> chuỗi <svg>...</svg>
   Tự động thay emoji ở tiêu đề thẻ / nút / KPI: U.iconifyTitles(root)
   (App.boot gọi U.autoIconify() để theo dõi #content và thay tự động.)
   ============================================================ */
(function () {
  // ----- Nội dung bên trong <svg> cho từng icon (lưới 24x24) -----
  U.ICONS = {
    /* Tổng quan / biểu đồ */
    'home': '<path d="M4 11 12 4l8 7"/><path d="M6 9.7V20h12V9.7"/><path d="M10 20v-5h4v5"/>',
    'chart-pie': '<path d="M21.2 15.9A10 10 0 1 1 8 2.8"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>',
    'bar-chart': '<path d="M4 4v16h16"/><path d="M8.5 17v-3.5"/><path d="M13 17V10"/><path d="M17.5 17V6.5"/>',
    'trending-up': '<path d="M3 17 9 11l4 4 8-8"/><path d="M16 7h5v5"/>',

    /* Sổ Claude (MCP) */
    'book': '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><path d="M9 7h7"/>',
    'warehouse': '<path d="M3 21V9l9-5 9 5v12"/><path d="M3 21h18"/><rect x="8" y="13" width="8" height="8" rx="1"/><path d="M8 17h8"/>',
    'handshake': '<path d="M2 12h4"/><path d="M18 12h4"/><path d="M6 12a3 3 0 0 1 3-3h1.5a3 3 0 0 1 3 3 3 3 0 0 1-3 3H9"/><path d="M18 12a3 3 0 0 0-3-3h-1.5a3 3 0 0 0-3 3 3 3 0 0 0 3 3H15"/>',

    /* Bán hàng */
    'route': '<circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/>',
    'file-quote': '<path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z"/><path d="M9 13h6"/><path d="M9 17h4"/>',
    'clipboard-list': '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 12h6"/><path d="M9 16h6"/>',
    'receipt': '<path d="M5 21V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v17l-2.5-1.5L14 21l-2.5-1.5L9 21l-2.5-1.5L5 21z"/><path d="M8 8h8"/><path d="M8 12h8"/><path d="M8 16h5"/>',
    'cart': '<circle cx="9" cy="20" r="1.5"/><circle cx="17" cy="20" r="1.5"/><path d="M3 4h2l2.3 12.2a1 1 0 0 0 1 .8h8.1a1 1 0 0 0 1-.8L20 8H6"/>',
    'rotate-left': '<path d="M3 12a9 9 0 1 0 9-9 9.8 9.8 0 0 0-6.7 2.7L3 8"/><path d="M3 3v5h5"/>',
    'tag': '<path d="M3.6 11.6 11 4.2a2 2 0 0 1 1.4-.6H19a1.5 1.5 0 0 1 1.5 1.5v6.6a2 2 0 0 1-.6 1.4l-7.4 7.4a2 2 0 0 1-2.8 0l-5.5-5.5a2 2 0 0 1 0-2.8z"/><circle cx="15.5" cy="8.5" r="1.3"/>',
    'scale': '<path d="M12 3v18"/><path d="M7 21h10"/><path d="M5 7h14"/><path d="M5 7 2.5 14a3.2 3.2 0 0 0 5 0z"/><path d="M19 7l2.5 7a3.2 3.2 0 0 1-5 0z"/>',
    'crown': '<path d="M4 18h16"/><path d="M4 18 3 7l5 4 4-6 4 6 5-4-1 11z"/>',

    /* Vận hành kho */
    'scan': '<path d="M4 7V5.5A1.5 1.5 0 0 1 5.5 4H7"/><path d="M17 4h1.5A1.5 1.5 0 0 1 20 5.5V7"/><path d="M20 17v1.5a1.5 1.5 0 0 1-1.5 1.5H17"/><path d="M7 20H5.5A1.5 1.5 0 0 1 4 18.5V17"/><path d="M4 12h16"/>',

    /* Mua hàng */
    'file-edit': '<path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M19 12V8l-5-5H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4"/><path d="M21.4 15.6a1.4 1.4 0 0 0-2 0L15 20v2.4h2.4l4.4-4.4a1.4 1.4 0 0 0 0-2z"/>',
    'package': '<path d="M21 8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/><path d="m7.5 4.3 9 5.2"/>',
    'rotate-right': '<path d="M21 12a9 9 0 1 1-9-9 9.8 9.8 0 0 1 6.7 2.7L21 8"/><path d="M21 3v5h-5"/>',
    'clipboard-check': '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>',

    /* Tiền */
    'wallet': '<path d="M3 6a2 2 0 0 1 2-2h12a1 1 0 0 1 1 1v2"/><path d="M3 6v12a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-3"/><path d="M3 9h17a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-3a2 2 0 0 1 0-4"/>',
    'bank': '<path d="M4 10.5 12 4l8 6.5"/><path d="M4 10.5h16"/><path d="M6 10.5V18"/><path d="M10 10.5V18"/><path d="M14 10.5V18"/><path d="M18 10.5V18"/><path d="M3 21h18"/>',

    /* Sản xuất */
    'factory': '<path d="M3 21V10l6 4V10l6 4V10l6 4v7z"/><path d="M3 21h18"/><path d="M3 10 4 3h3l1 7"/><path d="M9 21v-4h3v4"/>',

    /* Nhân sự */
    'coins': '<circle cx="8" cy="8" r="6"/><path d="M18.1 10.4A6 6 0 1 1 10.3 18.1"/><path d="M7 6h1.5v4"/><path d="m16.7 13.9.7.7-2.8 2.8"/>',

    /* Danh mục */
    'grid': '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    'box': '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="M3 8l9 4.6L21 8"/><path d="M12 12.6V21"/>',
    'users': '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9"/><path d="M16 3.1a4 4 0 0 1 0 7.8"/>',
    'truck': '<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H14a1 1 0 0 1 1 1v9H4.5A1.5 1.5 0 0 1 3 13.5z"/><path d="M15 8h3.6a1 1 0 0 1 .8.4l2.2 3a1 1 0 0 1 .2.6V15h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
    'id-card': '<rect x="3" y="4.5" width="18" height="15" rx="2.5"/><circle cx="9" cy="11" r="2.3"/><path d="M5.5 16.5a3.5 3.5 0 0 1 7 0"/><path d="M15 10h3.5"/><path d="M15 14h3.5"/>',
    'measurement': '<path d="M16.5 2.5 21.5 7.5 7.5 21.5 2.5 16.5z"/><path d="m7.5 13.5 2 2"/><path d="m10.5 10.5 2 2"/><path d="m13.5 7.5 2 2"/>',
    'card': '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 9.5h19"/><path d="M6 14.5h4"/>',
    'calendar': '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18"/><path d="M8 3v4"/><path d="M16 3v4"/>',
    'folder': '<path d="M3 7a2 2 0 0 1 2-2h3.5l2 2.5H19a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',

    /* Báo cáo / hệ thống */
    'report': '<path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z"/><path d="M9 17v-2"/><path d="M12 17v-5"/><path d="M15 17v-3"/>',
    'database': '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
    'settings': '<circle cx="12" cy="12" r="3"/><path d="M19.4 13.5a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.2a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.2a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.2a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.2a1.6 1.6 0 0 0-1.5 1z"/>',
    'user': '<circle cx="12" cy="8" r="4"/><path d="M5 21v-1a7 7 0 0 1 14 0v1"/>',
    'key': '<circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.5 12.5 8-8"/><path d="m15.5 7.5 2 2"/><path d="m18.5 4.5 2 2"/>',

    /* KPI / dashboard */
    'inflow': '<path d="M12 4v10"/><path d="m7.5 10 4.5 4.5 4.5-4.5"/><path d="M5 19h14"/>',
    'outflow': '<path d="M12 19V9"/><path d="m7.5 13 4.5-4.5 4.5 4.5"/><path d="M5 4h14"/>',
    'alert': '<path d="M10.3 4.3 2.6 17.6a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0z"/><path d="M12 9.5v4"/><path d="M12 17.2h.01"/>',
    'flame': '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1-2.1-.2-4 2-6 .5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
    'puzzle': '<path d="M9 4.5a1.5 1.5 0 0 1 3 0V6h2.5a1 1 0 0 1 1 1v2.5h1.5a1.5 1.5 0 0 1 0 3H15V16a1 1 0 0 1-1 1h-2.5v-1.5a1.5 1.5 0 0 0-3 0V17H6a1 1 0 0 1-1-1v-3h1.5a1.5 1.5 0 0 0 0-3H5V7a1 1 0 0 1 1-1h3z"/>',

    /* Tiện ích chung */
    'search': '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    'plus': '<path d="M12 5v14"/><path d="M5 12h14"/>',
    'download': '<path d="M12 3v12"/><path d="m7 11 5 5 5-5"/><path d="M5 21h14"/>',
    'upload': '<path d="M12 21V9"/><path d="m7 13 5-5 5 5"/><path d="M5 3h14"/>',
    'trash': '<path d="M4 7h16"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/><path d="M6 7v13a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7"/><path d="M10 11v6"/><path d="M14 11v6"/>',
    'eraser': '<path d="M19 20H8.5l-5-5a2 2 0 0 1 0-2.8l8-8a2 2 0 0 1 2.8 0l5 5a2 2 0 0 1 0 2.8L13 20"/><path d="M19 20H9"/>',
    'check': '<path d="m5 12.5 5 5L19 6"/>',
    'check-circle': '<circle cx="12" cy="12" r="9"/><path d="m8.5 12.5 2.5 2.5 4.5-5"/>',
    'x': '<path d="M6 6l12 12"/><path d="M18 6 6 18"/>',
    'x-circle': '<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6"/><path d="m15 9-6 6"/>',
    'edit': '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    'eye': '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
    'filter': '<path d="M3 5h18l-7 8v6l-4 2v-8z"/>',
    'bot': '<rect x="4" y="8" width="16" height="11" rx="3"/><path d="M12 8V4.5"/><circle cx="12" cy="3" r="1"/><path d="M9 13h.01"/><path d="M15 13h.01"/><path d="M9.5 16a3 3 0 0 0 5 0"/>',
    'wand': '<path d="M15 4V2"/><path d="M15 10V8"/><path d="M12.5 6h-2"/><path d="M19.5 6h-2"/><path d="m4 20 9-9"/><path d="m13 7 4 4"/><path d="M19 15l2 2"/><path d="M21 15l-2 2"/>',
    'doc': '<path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z"/>',
    'sun': '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.9 4.9 1.4 1.4"/><path d="m17.7 17.7 1.4 1.4"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.3 17.7-1.4 1.4"/><path d="m19.1 4.9-1.4 1.4"/>',
    'moon': '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
    'leaf': '<path d="M4 20C4 11 11 4 20 4c0 9-7 16-16 16z"/><path d="M9 15C13 11 16 8 19 5"/>'
  };

  // ----- Trả về chuỗi <svg>. Không có tên -> trả lại nguyên chuỗi (emoji vẫn hiện). -----
  U.icon = function (name, opts) {
    opts = opts || {};
    const inner = U.ICONS[name];
    if (!inner) return name == null ? '' : String(name);
    const cls = 'icon' + (opts.class ? ' ' + opts.class : '');
    const sw = opts.stroke || 1.85;
    const sz = opts.size ? ` style="width:${opts.size}px;height:${opts.size}px"` : '';
    return `<svg class="${cls}"${sz} viewBox="0 0 24 24" fill="none" stroke="currentColor" `
      + `stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
  };

  // ----- Bản đồ emoji -> tên icon (để thay tự động trong tiêu đề/nút/KPI) -----
  U.EMOJI_ICON = {
    '🏠': 'home', '📊': 'bar-chart', '📈': 'trending-up', '📉': 'trending-up',
    '📒': 'book', '📔': 'book', '📓': 'book', '🏬': 'warehouse', '🏪': 'warehouse',
    '🤝': 'handshake', '🧭': 'route', '🧾': 'file-quote',
    '📋': 'clipboard-list', '🛒': 'cart', '🛍️': 'cart', '🛍': 'cart',
    '↩️': 'rotate-left', '↩': 'rotate-left', '🏷️': 'tag', '🏷': 'tag',
    '💸': 'scale', '⚖️': 'scale', '⚖': 'scale', '👑': 'crown',
    '📷': 'scan', '📸': 'scan', '📝': 'file-edit', '✏️': 'edit', '✏': 'edit',
    '📦': 'package', '↪️': 'rotate-right', '↪': 'rotate-right',
    '💵': 'wallet', '💴': 'wallet', '💶': 'wallet', '🏦': 'bank',
    '🏭': 'factory', '💰': 'coins', '🪙': 'coins',
    '📚': 'grid', '🗃️': 'grid', '🗃': 'grid', '👥': 'users', '🧑‍💼': 'id-card', '👔': 'id-card',
    '⚙️': 'settings', '⚙': 'settings', '👤': 'user', '🔑': 'key',
    '⬇️': 'download', '⬇': 'download', '⬆️': 'upload', '⬆': 'upload',
    '🗑️': 'trash', '🗑': 'trash', '🧹': 'eraser',
    '⚠️': 'alert', '⚠': 'alert', '📥': 'inflow', '📤': 'outflow',
    '🥧': 'chart-pie', '🔥': 'flame', '🧩': 'puzzle', '🔍': 'search', '🔎': 'search',
    '🤖': 'bot', '✅': 'check-circle', '☑️': 'check-circle', '✔️': 'check',
    '❌': 'x-circle', '✖️': 'x', '📏': 'measurement', '📐': 'measurement',
    '💳': 'card', '📆': 'calendar', '📅': 'calendar', '🗂️': 'folder', '🗂': 'folder', '📁': 'folder',
    '🌿': 'leaf', '🍃': 'leaf'
  };
  // Khóa dài (nhiều ký tự) ưu tiên khớp trước
  U._emojiKeys = Object.keys(U.EMOJI_ICON).sort((a, b) => b.length - a.length);

  // Tìm emoji ở đầu chuỗi -> trả {key, name} hoặc null
  function leadEmoji(str) {
    const s = (str || '').replace(/^\s+/, '');
    for (let i = 0; i < U._emojiKeys.length; i++) {
      if (s.indexOf(U._emojiKeys[i]) === 0) return { key: U._emojiKeys[i], name: U.EMOJI_ICON[U._emojiKeys[i]] };
    }
    return null;
  }

  // Thay emoji đứng đầu của 1 phần tử (tiêu đề/nút) bằng icon SVG, giữ phần text còn lại.
  U.iconifyEl = function (el) {
    let node = el.firstChild;
    while (node && node.nodeType === 3 && !node.nodeValue.trim()) node = node.nextSibling;
    if (!node || node.nodeType !== 3) return false;     // đầu không phải text -> đã có icon hoặc không cần
    const hit = leadEmoji(node.nodeValue);
    if (!hit) return false;
    const rest = node.nodeValue.replace(/^\s+/, '').slice(hit.key.length).replace(/^\s+/, '');
    node.nodeValue = rest;
    const span = U.el('span', { class: 'ic-inline', html: U.icon(hit.name) });
    el.insertBefore(span, node);
    el.classList.add('has-ic');
    return true;
  };

  // Badge/ô chỉ chứa 1 emoji -> thay hẳn bằng icon (KPI, cảnh báo).
  U.iconBadge = function (el) {
    if (el.querySelector && el.querySelector('svg')) return false;   // đã có icon
    const hit = leadEmoji(el.textContent || '');
    if (!hit) return false;
    el.innerHTML = U.icon(hit.name);
    el.classList.add('has-ic');
    return true;
  };

  // Quét 1 vùng DOM và thay toàn bộ emoji ở tiêu đề/nút/KPI.
  U.iconifyTitles = function (root) {
    if (!root || !root.querySelectorAll) return;
    U._iconifying = true;
    try {
      root.querySelectorAll('.card-title').forEach(U.iconifyEl);
      root.querySelectorAll('.btn').forEach(U.iconifyEl);
      root.querySelectorAll('.ic-badge').forEach(U.iconBadge);
      root.querySelectorAll('.a-ic').forEach(U.iconBadge);
      root.querySelectorAll('.kf-ic').forEach(U.iconBadge);    // icon thẻ KPI gradient
      root.querySelectorAll('.flow-ic').forEach(U.iconBadge);  // icon node sơ đồ quy trình
    } catch (e) { /* an toàn: bỏ qua lỗi để không chặn render */ }
    U._iconifying = false;
  };

  // Theo dõi #content và tự thay emoji mỗi khi nội dung đổi (kể cả render bất đồng bộ).
  U.autoIconify = function () {
    const root = document.getElementById('content');
    if (!root) return;
    U.iconifyTitles(root);
    if (U._iconObs || typeof MutationObserver === 'undefined') return;
    U._iconObs = new MutationObserver(() => {
      if (U._iconifying) return;          // bỏ qua chính thay đổi của mình
      U.iconifyTitles(root);              // idempotent: lần 2 không tạo thay đổi -> không lặp
    });
    U._iconObs.observe(root, { childList: true, subtree: true });
  };
})();
