/* ============================================================
   ai-chat.js — Trợ lý AI (Claude) xuyên suốt phần mềm
   ------------------------------------------------------------
   Bong bóng chat nổi ở MỌI màn hình. Dùng chung anthropic_api_key
   (key nằm trong api/config.php — chỉ server thấy, gọi qua
   api/ai-chat.php với phiên đăng nhập). Chatbot TRA ĐƯỢC SỐ LIỆU
   THẬT của sổ qua tool-use: tool chạy ngay trên trình duyệt
   (PW.data) nên không lộ dữ liệu đi đâu ngoài câu trả lời.
   ============================================================ */

const AIC = {
  _open: false,
  _busy: false,
  _msgs: [],        // lịch sử gửi API (giữ nguyên block tool_use/tool_result)
  _maxLoop: 6,      // số vòng tool tối đa cho 1 câu hỏi
};

/* ---------- Bộ TOOL: khai báo cho Claude ---------- */
AIC.TOOLS = [
  {
    name: 'tong_quan_tai_chinh',
    description: 'Tổng quan tài chính trong một khoảng ngày: doanh thu, chi phí, giá vốn, lãi gộp, phí sàn, tiền mặt hiện có, phải thu/phải trả (kèm quá hạn). Không truyền ngày thì mặc định tháng hiện tại.',
    input_schema: { type: 'object', properties: {
      from: { type: 'string', description: 'Từ ngày yyyy-mm-dd' },
      to: { type: 'string', description: 'Đến ngày yyyy-mm-dd' },
    } },
  },
  {
    name: 'tim_hang_hoa',
    description: 'Tìm hàng hóa theo tên hoặc mã (vd "K452", "tranh 40x50"). Trả về mã, tên, đơn vị, giá bán, giá vốn, tồn kho hiện tại.',
    input_schema: { type: 'object', properties: {
      tu_khoa: { type: 'string', description: 'Từ khóa tên/mã hàng' },
    }, required: ['tu_khoa'] },
  },
  {
    name: 'tim_doi_tac',
    description: 'Tìm khách hàng / nhà cung cấp theo tên hoặc SĐT. Trả về tên, điện thoại, công nợ hiện tại.',
    input_schema: { type: 'object', properties: {
      tu_khoa: { type: 'string' },
      loai: { type: 'string', enum: ['khach', 'ncc', 'tatca'], description: 'khach = khách hàng, ncc = nhà cung cấp' },
    }, required: ['tu_khoa'] },
  },
  {
    name: 'tim_chung_tu',
    description: 'Liệt kê chứng từ trong khoảng ngày: hoadon (hóa đơn bán), donhang (đơn đặt hàng), phieuthu, phieuchi, nhapmua (phiếu nhập mua), baogia. Lọc thêm theo từ khóa (số chứng từ / tên đối tác) nếu có.',
    input_schema: { type: 'object', properties: {
      loai: { type: 'string', enum: ['hoadon', 'donhang', 'phieuthu', 'phieuchi', 'nhapmua', 'baogia'] },
      tu_khoa: { type: 'string' },
      from: { type: 'string' }, to: { type: 'string' },
      limit: { type: 'number', description: 'Số dòng tối đa (mặc định 15)' },
    }, required: ['loai'] },
  },
  {
    name: 'hang_sap_het',
    description: 'Danh sách hàng hóa đang dưới mức tồn kho tối thiểu (cần nhập thêm).',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'no_qua_han',
    description: 'Công nợ: tổng phải thu/phải trả kèm phần quá hạn, và danh sách khách hàng đang nợ nhiều nhất.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'top_ban_chay',
    description: 'Xếp hạng trong khoảng ngày: hang = mặt hàng bán chạy, khach = khách mua nhiều nhất, kenh = doanh thu theo kênh bán. Không truyền ngày thì mặc định tháng hiện tại.',
    input_schema: { type: 'object', properties: {
      loai: { type: 'string', enum: ['hang', 'khach', 'kenh'] },
      from: { type: 'string' }, to: { type: 'string' },
    }, required: ['loai'] },
  },
  {
    name: 'xem_chung_tu_chi_tiet',
    description: 'Xem chi tiết 1 chứng từ theo số (vd HD00003, PC00001): ngày, đối tác, từng dòng hàng, tổng tiền, đã thu/trả.',
    input_schema: { type: 'object', properties: {
      so_chung_tu: { type: 'string' },
    }, required: ['so_chung_tu'] },
  },
];

/* ---------- Thực thi tool trên PW.data (chỉ ĐỌC) ---------- */
AIC._range = function (inp) {
  const p = U.period('month');
  return { from: (inp && inp.from) || p.from, to: (inp && inp.to) || p.to };
};
AIC._inRange = (d, r) => d >= r.from && d <= r.to;
AIC._cusName = id => { const c = PW.data.customers.find(x => x.id === id); return c ? c.name : (id || 'Khách lẻ'); };
AIC._supName = id => { const s = PW.data.suppliers.find(x => x.id === id); return s ? s.name : (id || '—'); };
AIC._norm = s => (M._ciNorm ? M._ciNorm(s) : String(s || '').toLowerCase());

AIC.run = {
  tong_quan_tai_chinh: function (inp) {
    const r = AIC._range(inp);
    const rev = PW.revenue(r.from, r.to), exp = PW.expenses(r.from, r.to), cogs = PW.cogs(r.from, r.to);
    const fees = PW.sellingFees(r.from, r.to);
    const ar = PW.agingReceivable(U.today()), ap = PW.agingPayable(U.today());
    return {
      ky: r, doanh_thu: rev, gia_von: cogs, chi_phi: exp, phi_san: fees,
      lai_gop: rev - cogs - fees, loi_nhuan_tam_tinh: rev - cogs - fees - exp,
      tien_hien_co: PW.totalCash(),
      phai_thu: { tong: ar.total, qua_han: ar.overdue },
      phai_tra: { tong: ap.total, qua_han: ap.overdue },
      thu_trong_ky: PW.cashIn(r.from, r.to), chi_trong_ky: PW.cashOut(r.from, r.to),
    };
  },
  tim_hang_hoa: function (inp) {
    const q = AIC._norm(inp.tu_khoa);
    const hits = PW.data.products.filter(p => AIC._norm(p.code + ' ' + p.name).indexOf(q) >= 0).slice(0, 10);
    return hits.map(p => ({ ma: p.code, ten: p.name, dvt: p.unit, gia_ban: p.price, gia_von: p.cost,
      ton_kho: PW.stockOf(p.id), ton_toi_thieu: p.minStock || 0 }));
  },
  tim_doi_tac: function (inp) {
    const q = AIC._norm(inp.tu_khoa);
    const out = {};
    if (inp.loai !== 'ncc') {
      out.khach_hang = PW.data.customers
        .filter(c => AIC._norm(c.name + ' ' + (c.phone || '')).indexOf(q) >= 0).slice(0, 10)
        .map(c => ({ ten: c.name, dien_thoai: c.phone || '', cong_no_phai_thu: PW.customerDebt(c.id) }));
    }
    if (inp.loai !== 'khach') {
      out.nha_cung_cap = PW.data.suppliers
        .filter(s => AIC._norm(s.name + ' ' + (s.phone || '')).indexOf(q) >= 0).slice(0, 10)
        .map(s => ({ ten: s.name, dien_thoai: s.phone || '', cong_no_phai_tra: PW.supplierDebt(s.id) }));
    }
    return out;
  },
  tim_chung_tu: function (inp) {
    const r = AIC._range(inp);
    const lim = Math.min(Number(inp.limit) || 15, 30);
    const q = inp.tu_khoa ? AIC._norm(inp.tu_khoa) : '';
    function pick(list, map) {
      return list.filter(d => AIC._inRange(d.date, r))
        .map(map)
        .filter(x => !q || AIC._norm(JSON.stringify(x)).indexOf(q) >= 0)
        .slice(-lim).reverse();
    }
    switch (inp.loai) {
      case 'hoadon': return pick(PW.data.salesInvoices, si => ({ so: si.code, ngay: si.date, khach: AIC._cusName(si.customerId), tong: PW.invoiceTotal(si), da_thu: si.paid || 0 }));
      case 'donhang': return pick(PW.data.salesOrders, o => ({ so: o.code, ngay: o.date, khach: AIC._cusName(o.customerId), tong: (o.items || []).reduce((s, i) => s + i.qty * i.price, 0), trang_thai: o.status }));
      case 'phieuthu': return pick(PW.data.receipts, x => ({ so: x.code, ngay: x.date, so_tien: x.amount, ly_do: x.reason || '', khach: x.customerId ? AIC._cusName(x.customerId) : '' }));
      case 'phieuchi': return pick(PW.data.payments, x => ({ so: x.code, ngay: x.date, so_tien: x.amount, ly_do: x.reason || '', khoan_muc: x.category || '', ncc: x.supplierId ? AIC._supName(x.supplierId) : '' }));
      case 'nhapmua': return pick(PW.data.purchases, pu => ({ so: pu.code, ngay: pu.date, ncc: AIC._supName(pu.supplierId), tong: (pu.items || []).reduce((s, i) => s + i.qty * i.price, 0) }));
      case 'baogia': return pick(PW.data.quotations, qo => ({ so: qo.code, ngay: qo.date, khach: AIC._cusName(qo.customerId), trang_thai: qo.status }));
    }
    return { loi: 'Loại chứng từ không hợp lệ' };
  },
  hang_sap_het: function () {
    return PW.stockBelowMin().map(x => ({ ma: x.p ? x.p.code : x.code, ten: x.p ? x.p.name : x.name,
      ton: x.stock != null ? x.stock : x.ton, toi_thieu: x.p ? x.p.minStock : x.minStock }));
  },
  no_qua_han: function () {
    const ar = PW.agingReceivable(U.today()), ap = PW.agingPayable(U.today());
    const topNo = PW.data.customers
      .map(c => ({ ten: c.name, no: PW.customerDebt(c.id) }))
      .filter(x => x.no > 0).sort((a, b) => b.no - a.no).slice(0, 15);
    return { phai_thu: { tong: ar.total, qua_han: ar.overdue }, phai_tra: { tong: ap.total, qua_han: ap.overdue },
      khach_no_nhieu_nhat: topNo };
  },
  top_ban_chay: function (inp) {
    const r = AIC._range(inp);
    const agg = {};
    PW.data.salesInvoices.filter(si => AIC._inRange(si.date, r)).forEach(si => {
      if (inp.loai === 'khach') {
        const k = AIC._cusName(si.customerId);
        agg[k] = (agg[k] || 0) + PW.invoiceTotal(si);
      } else if (inp.loai === 'kenh') {
        const ch = (PW.data.channels || []).find(c => c.id === si.channelId);
        const k = ch ? ch.name : 'Không kênh';
        agg[k] = (agg[k] || 0) + PW.invoiceTotal(si);
      } else {
        (si.items || []).forEach(it => {
          const p = PW.data.products.find(x => x.id === it.productId);
          const k = p ? (p.code + ' - ' + p.name) : it.productId;
          agg[k] = (agg[k] || 0) + Number(it.qty) * Number(it.price);
        });
      }
    });
    return { ky: r, xep_hang: Object.keys(agg).map(k => ({ ten: k, doanh_so: agg[k] }))
      .sort((a, b) => b.doanh_so - a.doanh_so).slice(0, 10) };
  },
  xem_chung_tu_chi_tiet: function (inp) {
    const code = String(inp.so_chung_tu || '').trim().toUpperCase();
    const pools = [
      ['hóa đơn bán', PW.data.salesInvoices, 'customerId', AIC._cusName],
      ['đơn đặt hàng', PW.data.salesOrders, 'customerId', AIC._cusName],
      ['phiếu nhập mua', PW.data.purchases, 'supplierId', AIC._supName],
      ['báo giá', PW.data.quotations, 'customerId', AIC._cusName],
      ['phiếu thu', PW.data.receipts, 'customerId', AIC._cusName],
      ['phiếu chi', PW.data.payments, 'supplierId', AIC._supName],
    ];
    for (const [loai, list, fk, nameFn] of pools) {
      const d = list.find(x => (x.code || '').toUpperCase() === code);
      if (!d) continue;
      const out = { loai: loai, so: d.code, ngay: d.date, doi_tac: nameFn(d[fk]), ghi_chu: d.note || d.reason || '' };
      if (d.items) {
        out.dong_hang = d.items.map(it => {
          const p = PW.data.products.find(x => x.id === it.productId);
          return { hang: p ? p.code + ' - ' + p.name : it.productId, sl: it.qty, don_gia: it.price, thanh_tien: it.qty * it.price };
        });
        out.tong = d.items.reduce((s, i) => s + i.qty * i.price, 0);
        if (d.paid != null) out.da_thu_tra = d.paid;
      }
      if (d.amount != null) out.so_tien = d.amount;
      return out;
    }
    return { loi: 'Không tìm thấy chứng từ số ' + code };
  },
};

/* ---------- System prompt (kèm ngữ cảnh sống) ---------- */
AIC.systemPrompt = function () {
  const u = PW.user || {};
  const item = (typeof App !== 'undefined' && App.findItem) ? App.findItem(App.current) : null;
  return 'Bạn là Trợ lý kế toán AI bên trong phần mềm kế toán DALI của công ty Tranh số hóa DALI (tranhdali.vn — sản xuất & bán tranh số hóa, có kênh Shopee và ký gửi nhà sách).\n'
    + 'Người đang chat: ' + (u.fullname || u.username || 'nhân viên') + (u.role ? ' (vai trò: ' + u.role + ')' : '') + '. '
    + 'Hôm nay: ' + U.today() + '. Màn hình đang mở: ' + (item ? item.title : 'Tổng quan') + '.\n'
    + 'NGUYÊN TẮC:\n'
    + '- Số liệu sổ sách: LUÔN tra bằng tool, KHÔNG ĐƯỢC bịa hay đoán số. Tool không có dữ liệu thì nói thẳng.\n'
    + '- Tiền hiển thị dạng 1.234.567 đ. Ngày dạng dd/mm/yyyy khi nói với người dùng.\n'
    + '- Trả lời NGẮN GỌN, tiếng Việt thân thiện, đúng trọng tâm; dùng gạch đầu dòng khi liệt kê.\n'
    + '- Hàng hóa là tranh: mã kiểu K452, kích thước kiểu 20x25.\n'
    + '- Bạn chỉ ĐỌC được dữ liệu. Muốn ghi sổ, hướng dẫn người dùng thao tác trên phần mềm (menu nào, nút nào).\n'
    + '- Câu hỏi nghiệp vụ kế toán: giải thích dễ hiểu cho người không chuyên.';
};

/* ---------- Vòng chat + tool loop ---------- */
AIC.apiMessages = function () {
  // Cắt lịch sử: giữ tối đa ~24 message, KHÔNG cắt giữa cặp tool_use/tool_result
  let msgs = AIC._msgs.slice();
  while (msgs.length > 24) {
    msgs.shift();
    while (msgs.length && !(msgs[0].role === 'user' && typeof msgs[0].content === 'string')) msgs.shift();
  }
  return msgs;
};

AIC.send = async function (text) {
  if (AIC._busy) return;
  AIC._busy = true;
  AIC._renderMsg('user', text);
  AIC._msgs.push({ role: 'user', content: text });
  const thinking = AIC._renderThinking();
  try {
    for (let loop = 0; loop < AIC._maxLoop; loop++) {
      const r = await PW.api('ai-chat.php', { method: 'POST', body: JSON.stringify({
        system: AIC.systemPrompt(), messages: AIC.apiMessages(), tools: AIC.TOOLS,
      }) });
      if (!(r.status === 200 && r.data && r.data.ok)) {
        AIC._renderMsg('ai', '⚠ ' + ((r.data && r.data.error) || ('Lỗi máy chủ HTTP ' + r.status)));
        break;
      }
      const resp = r.data.resp;
      const blocks = resp.content || [];
      AIC._msgs.push({ role: 'assistant', content: blocks });
      // Hiện phần text (nếu có) ngay cả khi còn gọi tool
      const txt = blocks.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
      if (txt) AIC._renderMsg('ai', txt);
      if (resp.stop_reason !== 'tool_use') break;
      // Thực thi từng tool_use → tool_result
      const results = [];
      for (const b of blocks) {
        if (b.type !== 'tool_use') continue;
        let out;
        try {
          const fn = AIC.run[b.name];
          out = fn ? fn(b.input || {}) : { loi: 'Tool không tồn tại' };
        } catch (e) { out = { loi: 'Lỗi chạy tool: ' + e.message }; }
        let s = JSON.stringify(out);
        if (s.length > 12000) s = s.slice(0, 12000) + '...(cắt bớt)';
        results.push({ type: 'tool_result', tool_use_id: b.id, content: s });
        AIC._renderToolNote(b.name);
      }
      AIC._msgs.push({ role: 'user', content: results });
    }
  } catch (e) {
    AIC._renderMsg('ai', '⚠ Không gọi được AI: ' + e.message);
  }
  thinking.remove();
  AIC._busy = false;
  AIC._saveTranscript();
};

/* ---------- Giao diện ---------- */
AIC.QUICK = [
  'Doanh thu tháng này thế nào?',
  'Khách nào đang nợ quá hạn?',
  'Hàng nào sắp hết tồn kho?',
];

AIC.init = function () {
  if (document.getElementById('ai-fab')) return;
  // Nút nổi
  const fab = U.el('button', { id: 'ai-fab', title: 'Trợ lý AI', html: U.icon('bot') });
  fab.addEventListener('click', AIC.toggle);
  document.body.appendChild(fab);
  // Khung chat
  const panel = U.el('div', { id: 'ai-panel', class: 'hidden' });
  const head = U.el('div', { class: 'ai-head' }, [
    U.el('span', { class: 'ai-head-ic', html: U.icon('bot') }),
    U.el('b', null, 'Trợ lý AI'),
    U.el('span', { class: 'ai-head-sub' }, 'kế toán DALI'),
    U.el('span', { class: 'spacer' }),
    U.el('button', { class: 'ai-hbtn', title: 'Xóa hội thoại', html: U.icon('trash'), onclick: AIC.clear }),
    U.el('button', { class: 'ai-hbtn', title: 'Đóng', html: U.icon('x'), onclick: AIC.toggle }),
  ]);
  const body = U.el('div', { class: 'ai-body', id: 'ai-body' });
  const quick = U.el('div', { class: 'ai-quick', id: 'ai-quick' });
  AIC.QUICK.forEach(qt => {
    quick.appendChild(U.el('button', { class: 'ai-chip', onclick: () => { AIC.send(qt); } }, qt));
  });
  const inputRow = U.el('div', { class: 'ai-input-row' });
  const ta = U.el('textarea', { id: 'ai-input', rows: 1, placeholder: 'Hỏi về sổ sách, nghiệp vụ, số liệu...' });
  ta.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); AIC._submit(); }
  });
  const sendBtn = U.el('button', { class: 'ai-send', title: 'Gửi', html: U.icon('upload'), onclick: () => AIC._submit() });
  inputRow.appendChild(ta); inputRow.appendChild(sendBtn);
  panel.appendChild(head); panel.appendChild(body); panel.appendChild(quick); panel.appendChild(inputRow);
  document.body.appendChild(panel);
  AIC._loadTranscript();
};

AIC.toggle = function () {
  const p = document.getElementById('ai-panel');
  AIC._open = !AIC._open;
  p.classList.toggle('hidden', !AIC._open);
  if (AIC._open) {
    if (PW.mode !== 'server') {
      AIC._renderMsg('ai', 'Trợ lý AI cần chạy trên máy chủ (ketoan.tranhdali.vn) và đã cấu hình khóa anthropic_api_key. Bản offline không chat được.');
    }
    const ta = document.getElementById('ai-input');
    if (ta) ta.focus();
  }
};

AIC._submit = function () {
  const ta = document.getElementById('ai-input');
  const text = (ta.value || '').trim();
  if (!text || AIC._busy) return;
  ta.value = '';
  AIC.send(text);
};

AIC.clear = function () {
  AIC._msgs = [];
  const body = document.getElementById('ai-body');
  if (body) body.innerHTML = '';
  const quick = document.getElementById('ai-quick');
  if (quick) quick.classList.remove('hidden');
  localStorage.removeItem('PW_AI_CHAT');
};

/* ---- Render ---- */
AIC._mdLite = function (s) {
  let h = U.esc(s);
  h = h.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  h = h.replace(/`([^`]+)`/g, '<code>$1</code>');
  h = h.replace(/^### (.*)$/gm, '<b>$1</b>');
  h = h.replace(/^[-•] (.*)$/gm, '<span class="ai-li">• $1</span>');
  h = h.replace(/\n/g, '<br>');
  return h;
};
AIC._renderMsg = function (who, text) {
  const body = document.getElementById('ai-body');
  if (!body) return;
  const quick = document.getElementById('ai-quick');
  if (quick) quick.classList.add('hidden');
  body.appendChild(U.el('div', { class: 'ai-msg ' + (who === 'user' ? 'me' : 'bot'), html: AIC._mdLite(text) }));
  body.scrollTop = body.scrollHeight;
};
AIC._renderToolNote = function (name) {
  const body = document.getElementById('ai-body');
  if (!body) return;
  body.appendChild(U.el('div', { class: 'ai-tool-note' }, '🔍 Đang tra: ' + name.replace(/_/g, ' ')));
  body.scrollTop = body.scrollHeight;
};
AIC._renderThinking = function () {
  const body = document.getElementById('ai-body');
  const el = U.el('div', { class: 'ai-msg bot ai-thinking' }, 'Đang suy nghĩ...');
  if (body) { body.appendChild(el); body.scrollTop = body.scrollHeight; }
  return el;
};

/* ---- Lưu/khôi phục transcript hiển thị (chỉ phần chữ) ---- */
AIC._saveTranscript = function () {
  try {
    const items = [...document.querySelectorAll('#ai-body .ai-msg')].slice(-30)
      .map(el => ({ who: el.classList.contains('me') ? 'user' : 'ai', text: el.textContent }));
    localStorage.setItem('PW_AI_CHAT', JSON.stringify(items));
  } catch (e) {}
};
AIC._loadTranscript = function () {
  try {
    const items = JSON.parse(localStorage.getItem('PW_AI_CHAT') || '[]');
    items.forEach(it => AIC._renderMsg(it.who, it.text));
  } catch (e) {}
};
