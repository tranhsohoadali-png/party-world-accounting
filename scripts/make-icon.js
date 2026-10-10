/* ============================================================
   make-icon.js — sinh icon PNG cho một bản cài PWA mới.

   Mỗi bản cài (ketoan / ktparty / kt3d…) cần icon riêng, nếu không cài
   nhiều bản lên một điện thoại sẽ ra mấy icon giống hệt nhau. Script này
   vẽ icon bằng tay rồi tự đóng gói PNG qua zlib có sẵn trong Node —
   không cần cài thư viện ảnh nào.

   Dùng:  node scripts/make-icon.js kt3d
   Ra:    assets/icon-kt3d-180.png, -192.png, -512.png
   ============================================================ */
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

/* ---------- Đóng gói PNG ---------- */
function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = c ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
// rgba: Uint8Array dài w*h*4
function encodePNG(w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;   // 8-bit RGBA
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;                                            // filter 0 (None)
    rgba.copy
      ? rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4)
      : Buffer.from(rgba.subarray(y * w * 4, (y + 1) * w * 4)).copy(raw, y * (w * 4 + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ---------- Khung vẽ tí hon (có khử răng cưa bằng siêu lấy mẫu) ---------- */
function canvas(size) {
  const px = Buffer.alloc(size * size * 4);
  const SS = 3;                                       // 3x3 mẫu / điểm ảnh -> viền mượt
  return {
    size, px,
    // shape(x, y) -> màu [r,g,b] hoặc null (không vẽ). Toạ độ 0..1.
    fill(shape) {
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        let r = 0, g = 0, b = 0, a = 0;
        for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
          const c = shape((x + (sx + 0.5) / SS) / size, (y + (sy + 0.5) / SS) / size);
          if (c) { r += c[0]; g += c[1]; b += c[2]; a++; }
        }
        if (!a) continue;
        const n = SS * SS, i = (y * size + x) * 4, cov = a / n;
        const nr = r / a, ng = g / a, nb = b / a;
        // trộn lên những gì đã vẽ (alpha compositing đơn giản)
        const oa = px[i + 3] / 255;
        const na = cov + oa * (1 - cov);
        px[i]     = Math.round((nr * cov + px[i]     * oa * (1 - cov)) / na);
        px[i + 1] = Math.round((ng * cov + px[i + 1] * oa * (1 - cov)) / na);
        px[i + 2] = Math.round((nb * cov + px[i + 2] * oa * (1 - cov)) / na);
        px[i + 3] = Math.round(na * 255);
      }
    },
    png() { return encodePNG(size, size, this.px); },
  };
}
const mix = (a, b, t) => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t),
];
// Trong đa giác? (ray casting)
function inPoly(x, y, pts) {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}

/* ---------- Các mẫu icon ---------- */
const MAU = {
  // Khối lập phương đẳng cự — biểu tượng quen thuộc của in 3D.
  kt3d: {
    nenTren: [0x37, 0x47, 0x4f], nenDuoi: [0x15, 0x1e, 0x22],
    ve(ctx) {
      const R = 0.22;                                        // bán kính góc bo (maskable: nền đầy khung)
      ctx.fill((x, y) => {
        const dx = Math.min(x, 1 - x), dy = Math.min(y, 1 - y);
        if (dx < R && dy < R && (R - dx) ** 2 + (R - dy) ** 2 > R * R) return null;
        return mix(this.nenTren, this.nenDuoi, (x + y) / 2);
      });
      // Khối lập phương: 3 mặt, mỗi mặt một độ sáng -> đọc ra ngay là hình 3D.
      const cx = 0.5, cy = 0.5, w = 0.26, h = 0.15, t = 0.21;   // nửa rộng, nửa cao hình thoi, chiều cao khối
      const dinh  = [[cx, cy - h - t / 2], [cx + w, cy - t / 2], [cx, cy + h - t / 2], [cx - w, cy - t / 2]];
      const phai  = [[cx + w, cy - t / 2], [cx + w, cy - t / 2 + t], [cx, cy + h - t / 2 + t], [cx, cy + h - t / 2]];
      const trai  = [[cx - w, cy - t / 2], [cx - w, cy - t / 2 + t], [cx, cy + h - t / 2 + t], [cx, cy + h - t / 2]];
      const SANG = [0xff, 0xff, 0xff], GIUA = [0xbb, 0xd4, 0xe0], TOI = [0x78, 0x9b, 0xad];
      ctx.fill((x, y) => inPoly(x, y, dinh) ? SANG : null);
      ctx.fill((x, y) => inPoly(x, y, phai) ? TOI : null);
      ctx.fill((x, y) => inPoly(x, y, trai) ? GIUA : null);
      // Bàn in: một vạch sáng dưới khối.
      ctx.fill((x, y) => (y > 0.745 && y < 0.775 && x > 0.2 && x < 0.8) ? [0xff, 0xa7, 0x26] : null);
    },
  },
};

/* ---------- Chạy ---------- */
const ten = process.argv[2];
if (!ten || !MAU[ten]) {
  console.error('Dùng: node scripts/make-icon.js <' + Object.keys(MAU).join('|') + '>');
  process.exit(1);
}
const outDir = path.join(__dirname, '..', 'assets');
[180, 192, 512].forEach(s => {
  const ctx = canvas(s);
  MAU[ten].ve(ctx);
  const f = path.join(outDir, 'icon-' + ten + '-' + s + '.png');
  fs.writeFileSync(f, ctx.png());
  console.log('đã ghi', path.relative(path.join(__dirname, '..'), f), fs.statSync(f).size, 'byte');
});
