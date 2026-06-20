/* ============================================================
   sw.js — Service worker cho PWA DALI Kế toán
   Chiến lược: NETWORK-FIRST cho asset cùng nguồn (tôn trọng ?v= chống cache),
   rớt mạng thì lấy bản đã cache → app vẫn mở được khi offline.
   KHÔNG đụng tới /api/ (luôn đi thẳng mạng — giữ nguyên CSRF/đăng nhập/lưu).
   ============================================================ */
const CACHE = 'dali-pwa-v20260614u';

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

  e.respondWith((async () => {
    try {
      const fresh = await fetch(req);                       // network-first
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
