/* ============================================================
   auth-ui.js — Màn hình đăng nhập, đổi mật khẩu, quản lý người dùng
   (chỉ dùng khi chạy chế độ server)
   ============================================================ */

M.ROLE_LABEL = { admin: 'Giám đốc (Quản trị)', ketoan: 'Kế toán', nhanvien: 'Nhân viên bán hàng' };

/* ---------- Màn hình đăng nhập ---------- */
M.loginScreen = function () {
  const old = document.getElementById('login-overlay');
  if (old) old.remove();
  const overlay = U.el('div', { id: 'login-overlay', class: 'login-overlay' });
  const card = U.el('div', { class: 'login-card' });
  const user = C.input({ placeholder: 'Tên đăng nhập' });
  const pass = C.input({ type: 'password', placeholder: 'Mật khẩu' });
  const err = U.el('div', { class: 'login-err' });
  const btn = C.btn('Đăng nhập', submit, 'primary');
  btn.style.width = '100%'; btn.style.justifyContent = 'center'; btn.style.marginTop = '6px';

  async function submit() {
    err.textContent = '';
    if (!user.value.trim() || !pass.value) { err.textContent = 'Nhập tên đăng nhập và mật khẩu'; return; }
    btn.disabled = true; btn.textContent = 'Đang đăng nhập...';
    const r = await PW.api('auth.php?action=login', { method: 'POST', body: JSON.stringify({ username: user.value.trim(), password: pass.value }) });
    btn.disabled = false; btn.textContent = 'Đăng nhập';
    if (r.status === 200 && r.data && r.data.ok) {
      overlay.remove(); document.body.classList.remove('login-mode'); App.boot();
    } else {
      err.textContent = (r.data && r.data.error) || 'Đăng nhập thất bại';
    }
  }
  [user, pass].forEach(i => i.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); }));

  card.appendChild(U.el('img', { src: 'assets/logo-dali.png', class: 'login-logo' }));
  card.appendChild(U.el('div', { class: 'login-sub' }, 'Phần mềm kế toán'));
  card.appendChild(C.field('Tên đăng nhập', user));
  card.appendChild(C.field('Mật khẩu', pass));
  card.appendChild(err);
  card.appendChild(btn);
  overlay.appendChild(card);
  document.body.classList.add('login-mode');
  document.body.appendChild(overlay);
  setTimeout(() => user.focus(), 50);
};

/* ---------- Đổi mật khẩu ---------- */
M.changePwForm = function () {
  const oldI = C.input({ type: 'password' });
  const newI = C.input({ type: 'password' });
  const new2 = C.input({ type: 'password' });
  const body = U.el('div', { class: 'form-grid' }, [
    C.field('Mật khẩu hiện tại', oldI, { full: true }),
    C.field('Mật khẩu mới (≥ 6 ký tự)', newI, { full: true }),
    C.field('Nhập lại mật khẩu mới', new2, { full: true }),
  ]);
  C.modal({
    title: 'Đổi mật khẩu', body,
    footer: [C.btn('Hủy', C.closeModal), C.btn('Đổi mật khẩu', async () => {
      if (newI.value !== new2.value) return U.toast('Mật khẩu nhập lại không khớp', 'error');
      const r = await PW.api('auth.php?action=changepw', { method: 'POST', body: JSON.stringify({ old: oldI.value, new: newI.value }) });
      if (r.status === 200 && r.data && r.data.ok) { C.closeModal(); U.toast('Đã đổi mật khẩu'); }
      else U.toast((r.data && r.data.error) || 'Lỗi', 'error');
    }, 'primary')],
  });
};

/* ---------- Quản lý người dùng (admin) ---------- */
M.usersAdmin = function (root) {
  const card = U.el('div', { class: 'card' });
  const toolbar = U.el('div', { class: 'toolbar' });
  toolbar.appendChild(U.el('div', { class: 'card-title', style: 'margin:0' }, '👤 Quản lý người dùng'));
  toolbar.appendChild(U.el('div', { class: 'spacer' }));
  toolbar.appendChild(C.btn('+ Thêm người dùng', () => M.userForm(), 'primary'));
  card.appendChild(toolbar);
  const host = U.el('div', null, U.el('div', { class: 'empty' }, 'Đang tải...'));
  card.appendChild(host);
  root.appendChild(card);

  async function draw() {
    const r = await PW.api('users.php?action=list');
    if (r.status !== 200 || !r.data || !r.data.users) {
      host.innerHTML = ''; host.appendChild(U.el('div', { class: 'empty' }, 'Không tải được danh sách (cần quyền admin).')); return;
    }
    host.innerHTML = '';
    host.appendChild(C.table(r.data.users, [
      { label: 'Tên đăng nhập', render: u => U.esc(u.username) },
      { label: 'Họ tên', render: u => U.esc(u.fullname || '') },
      { label: 'Vai trò', render: u => M.ROLE_LABEL[u.role] || u.role },
      { label: 'Trạng thái', center: true, render: u => Number(u.active) ? '<span class="tag green">Hoạt động</span>' : '<span class="tag gray">Khóa</span>' },
      { label: '', render: u => C.actions([
          { label: 'Sửa', onClick: () => M.userForm(u) },
          { label: 'Đặt lại MK', onClick: () => M.resetPwForm(u) },
          { label: 'Xóa', cls: 'danger', onClick: async () => {
              if (!U.confirm('Xóa người dùng "' + u.username + '"?')) return;
              const x = await PW.api('users.php?action=delete', { method: 'POST', body: JSON.stringify({ id: u.id }) });
              if (x.status === 200 && x.data && x.data.ok) { draw(); U.toast('Đã xóa'); }
              else U.toast((x.data && x.data.error) || 'Lỗi', 'error');
            } },
        ]) },
    ]));
  }
  draw();
};

M.userForm = function (u) {
  const isNew = !u;
  const username = C.input({ value: u ? u.username : '' });
  if (!isNew) username.disabled = true;
  const fullname = C.input({ value: u ? (u.fullname || '') : '' });
  const role = C.select(Object.keys(M.ROLE_LABEL).map(k => ({ value: k, label: M.ROLE_LABEL[k] })), u ? u.role : 'nhanvien');
  const active = C.select([{ value: '1', label: 'Hoạt động' }, { value: '0', label: 'Khóa' }], u ? String(u.active) : '1');
  const pass = C.input({ type: 'password', placeholder: 'Tối thiểu 6 ký tự' });
  const rows = [
    C.field('Tên đăng nhập', username, { required: true }),
    C.field('Họ tên', fullname),
    C.field('Vai trò', role),
  ];
  if (!isNew) rows.push(C.field('Trạng thái', active));
  if (isNew) rows.push(C.field('Mật khẩu', pass, { required: true, full: true }));
  C.modal({
    title: isNew ? 'Thêm người dùng' : 'Sửa người dùng',
    body: U.el('div', { class: 'form-grid' }, rows),
    footer: [C.btn('Hủy', C.closeModal), C.btn('Lưu', async () => {
      let r;
      if (isNew) {
        r = await PW.api('users.php?action=create', { method: 'POST', body: JSON.stringify({ username: username.value.trim(), password: pass.value, fullname: fullname.value.trim(), role: role.value }) });
      } else {
        r = await PW.api('users.php?action=update', { method: 'POST', body: JSON.stringify({ id: u.id, fullname: fullname.value.trim(), role: role.value, active: Number(active.value) }) });
      }
      if (r.status === 200 && r.data && r.data.ok) { C.closeModal(); App.refresh(); U.toast('Đã lưu'); }
      else U.toast((r.data && r.data.error) || 'Lỗi', 'error');
    }, 'primary')],
  });
};

M.resetPwForm = function (u) {
  const pass = C.input({ type: 'password', placeholder: 'Mật khẩu mới (≥ 6 ký tự)' });
  C.modal({
    title: 'Đặt lại mật khẩu — ' + u.username,
    body: U.el('div', { class: 'form-grid' }, [C.field('Mật khẩu mới', pass, { required: true, full: true })]),
    footer: [C.btn('Hủy', C.closeModal), C.btn('Đặt lại', async () => {
      const r = await PW.api('users.php?action=resetpw', { method: 'POST', body: JSON.stringify({ id: u.id, password: pass.value }) });
      if (r.status === 200 && r.data && r.data.ok) { C.closeModal(); U.toast('Đã đặt lại mật khẩu'); }
      else U.toast((r.data && r.data.error) || 'Lỗi', 'error');
    }, 'primary')],
  });
};
