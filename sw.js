/* ============================================================
   sw.js — Service worker cho PWA DALI Kế toán
   Chiến lược: NETWORK-FIRST cho asset cùng nguồn (tôn trọng ?v= chống cache),
   rớt mạng thì lấy bản đã cache → app vẫn mở được khi offline.
   KHÔNG đụng tới /api/ (luôn đi thẳng mạng — giữ nguyên CSRF/đăng nhập/lưu).
   ============================================================ */
const CACHE = 'dali-pwa-v20261010k';

self.addEventListener('install', () => {
  self.skipWaiting();   // kích hoạt SW mới ngay
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));   // dọn cache cũ
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;                         // chỉ xử lý GET
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;          // chỉ cùng nguồn
  if (url.pathname.includes('/api/')) return;               // KHÔNG can thiệp API (CSRF/đăng nhập/lưu)

  /* index.html KHÔNG mang ?v= (nó chính là chỗ khai ?v= cho mọi file khác), mà
     nginx chỉ gửi ETag/Last-Modified chứ không có Cache-Control. Trình duyệt khi
     đó được phép tự suy đoán thời hạn và dùng lại index.html cũ KHÔNG hỏi server
     -> deploy xong, người dùng F5 vẫn thấy giao diện cũ vì index.html cũ trỏ tới
     ?v= cũ. Với trang HTML thì ép đi mạng, bỏ qua cache HTTP; các file khác đã có
     ?v= nên cứ để trình duyệt cache thoải mái. */
  const laTrang = req.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('.html');

  e.respondWith((async () => {
    try {
      const fresh = laTrang
        ? await fetch(req.url, { cache: 'reload', credentials: 'same-origin' })
        : await fetch(req);                                 // network-first
      if (fresh && fresh.status === 200 && fresh.type === 'basic') {
        const cache = await caches.open(CACHE);
        cache.put(req, fresh.clone());
      }
      return fresh;
    } catch (err) {
      const cached = await caches.match(req);
      if (cached) return cached;
      if (req.mode === 'navigate') {
        const idx = (await caches.match('index.html')) || (await caches.match('./'));
        if (idx) return idx;
      }
      throw err;
    }
  })());
});
