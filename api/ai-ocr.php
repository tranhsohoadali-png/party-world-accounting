<?php
// ============================================================
// ai-ocr.php — AI đọc ảnh / PDF bảng kê, đơn hàng (Claude)
// POST JSON: { image: "data:image/jpeg;base64,..." }  (ảnh hoặc PDF data URI)
// Trả về:    { ok: true, lines: ["Tên hàng | SL | đơn giá", ...] }
// Cần khóa 'anthropic_api_key' trong api/config.php.
// ============================================================
require __DIR__ . '/lib.php';

require_login();
ai_rate_limit('ocr', 10, 60);   // tối đa 10 ảnh/PDF mỗi phút/phiên

$cfg = ai_cfg();
$apiKey = $cfg['anthropic_api_key'] ?? '';
$model  = $cfg['anthropic_model'] ?? 'claude-haiku-4-5-20251001';
if ($apiKey === '') {
  json_out(['error' => 'Chưa có khóa AI — admin vào Dữ liệu & Sao lưu → Cấu hình AI (Claude) để dán khóa'], 500);
}

$b = body();
$image = (string)($b['image'] ?? '');
$kind = (string)($b['kind'] ?? '');   // '' = bảng kê bán/ký gửi (mặc định) | 'purchase' = hóa đơn mua từ NCC
if ($image === '') json_out(['error' => 'Thiếu ảnh/PDF'], 400);
if (strlen($image) > 12 * 1024 * 1024) json_out(['error' => 'File quá lớn (tối đa ~8MB)'], 400);

// Tách data URI -> media type + base64
$mediaType = 'image/jpeg';
$base64 = $image;
if (strpos($image, 'data:') === 0) {
  $comma = strpos($image, ',');
  if ($comma === false) json_out(['error' => 'Ảnh không hợp lệ'], 400);
  $meta = substr($image, 0, $comma);
  $base64 = substr($image, $comma + 1);
  if (preg_match('#data:([^;]+)#', $meta, $m)) $mediaType = $m[1];
}
if (base64_decode($base64, true) === false) json_out(['error' => 'Ảnh không phải base64 hợp lệ'], 400);

if ($kind === 'purchase') {
  $prompt = 'Đây là HÓA ĐƠN MUA HÀNG / phiếu giao hàng / bảng kê từ NHÀ CUNG CẤP (mua vào), có thể in hoặc viết tay. '
    . 'Hãy trích xuất theo đúng định dạng sau, KHÔNG thêm lời giải thích, KHÔNG markdown, KHÔNG đánh số: '
    . 'DÒNG ĐẦU TIÊN (nếu đọc được nhà cung cấp): "NCC | TÊN NHÀ CUNG CẤP | MÃ SỐ THUẾ" (mã số thuế để trống nếu không có). '
    . 'CÁC DÒNG SAU: mỗi MẶT HÀNG một dòng theo định dạng: TÊN HÀNG NGUYÊN VĂN | SỐ LƯỢNG | ĐƠN GIÁ MUA (đơn giá 1 đơn vị, KHÔNG phải thành tiền; để trống nếu không có). '
    . 'Giữ nguyên mã hàng / quy cách nếu thấy (vd VT001, giấy A4 80gsm). Bỏ qua dòng tổng cộng / thuế / chiết khấu.';
} else {
  $prompt = 'Đây là đơn hàng / bảng kê bán hàng (tranh số hóa) từ nhà sách ký gửi, có thể viết tay hoặc in. '
    . 'Hãy trích xuất TẤT CẢ các dòng mặt hàng (mọi trang nếu nhiều trang). Trả về MỖI MẶT HÀNG MỘT DÒNG, định dạng đúng: '
    . 'TÊN HÀNG NGUYÊN VĂN | SỐ LƯỢNG | ĐƠN GIÁ (để trống nếu không có). '
    . 'Giữ nguyên mã hàng và kích thước nếu thấy (vd K452 20x25). '
    . 'KHÔNG thêm lời giải thích, KHÔNG markdown, KHÔNG đánh số dòng.';
}

// PDF -> khối "document"; ảnh -> khối "image" (Claude đọc được cả PDF scan)
$srcBlock = [
  'type' => ($mediaType === 'application/pdf') ? 'document' : 'image',
  'source' => ['type' => 'base64', 'media_type' => $mediaType, 'data' => $base64],
];

$payload = json_encode([
  'model' => $model,
  'max_tokens' => 4000,
  'messages' => [[
    'role' => 'user',
    'content' => [
      $srcBlock,
      ['type' => 'text', 'text' => $prompt],
    ],
  ]],
]);

$ch = curl_init('https://api.anthropic.com/v1/messages');
curl_setopt_array($ch, [
  CURLOPT_POST => true,
  CURLOPT_POSTFIELDS => $payload,
  CURLOPT_HTTPHEADER => [
    'Content-Type: application/json',
    'x-api-key: ' . $apiKey,
    'anthropic-version: 2023-06-01',
  ],
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_TIMEOUT => 90,
  CURLOPT_CONNECTTIMEOUT => 15,
]);
$resp = curl_exec($ch);
$err  = curl_error($ch);
$http = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($resp === false) {
  error_log('ai-ocr curl: ' . $err);
  json_out(['error' => 'Không nối được tới Anthropic — thử lại sau'], 502);
}
$j = json_decode($resp, true);
if ($http !== 200) {
  $msg = $j['error']['message'] ?? ('HTTP ' . $http);
  json_out(['error' => 'Anthropic API lỗi: ' . $msg], 502);
}

$text = '';
foreach (($j['content'] ?? []) as $block) {
  if (($block['type'] ?? '') === 'text') $text .= $block['text'];
}
$lines = [];
foreach (preg_split('/\r?\n/', $text) as $line) {
  $line = trim($line);
  if ($line === '') continue;
  $lines[] = $line;
}
json_out(['ok' => true, 'lines' => $lines, 'model' => $model]);
