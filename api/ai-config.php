<?php
// ============================================================
// ai-config.php — Cấu hình AI ngay trong phần mềm (CHỈ ADMIN)
// Cho phép dán anthropic_api_key + chọn model qua giao diện web,
// lưu vào api/ai-key.local.php (gitignore + chặn truy cập web),
// nên KHÔNG cần SSH/sửa config.php.
//   GET  ?action=status  -> { configured, masked, ocr_model, chat_model }
//   POST ?action=save    -> body { key?, ocr_model?, chat_model? }
//   POST ?action=test    -> gọi thử Anthropic (max_tokens nhỏ)
//   POST ?action=clear   -> xóa khóa đã lưu qua giao diện
// LƯU Ý: không bao giờ trả khóa đầy đủ về trình duyệt.
// ============================================================
require __DIR__ . '/lib.php';

require_role(['admin']);

$KEY_FILE = __DIR__ . '/ai-key.local.php';
$action = $_GET['action'] ?? 'status';

function ai_key_store(): array {
  global $KEY_FILE;
  if (!file_exists($KEY_FILE)) return [];
  $o = require $KEY_FILE;
  return is_array($o) ? $o : [];
}

function ai_key_write(array $store): void {
  global $KEY_FILE;
  $php = "<?php\n// File do man hinh 'Cau hinh AI' tao ra — KHONG dua len git, KHONG sua tay.\nreturn " . var_export($store, true) . ";\n";
  // Tên file tạm PHẢI kết thúc .php: lỡ sót lại thì web cũng chỉ THỰC THI (không in gì)
  // chứ không bao giờ bị phục vụ dạng văn bản thô lộ khóa.
  $tmp = $KEY_FILE . '.tmp.php';
  if (@touch($tmp) === false) {
    json_out(['error' => 'Không ghi được file cấu hình (kiểm tra quyền ghi thư mục api/)'], 500);
  }
  @chmod($tmp, 0600);  // siết quyền TRƯỚC khi ghi nội dung nhạy cảm
  if (file_put_contents($tmp, $php, LOCK_EX) === false) {
    @unlink($tmp);
    json_out(['error' => 'Không ghi được file cấu hình (kiểm tra quyền ghi thư mục api/)'], 500);
  }
  if (!rename($tmp, $KEY_FILE)) {
    if (file_exists($tmp) && !@unlink($tmp)) {
      error_log('ai-config: KHONG xoa duoc file tam ' . $tmp);
    }
    json_out(['error' => 'Không hoàn tất ghi file cấu hình'], 500);
  }
}

if ($action === 'status') {
  $cfg = ai_cfg();
  $key = (string)($cfg['anthropic_api_key'] ?? '');
  $store = ai_key_store();
  json_out([
    'ok' => true,
    'configured' => $key !== '',
    'masked' => $key !== '' ? (substr($key, 0, 10) . '••••' . substr($key, -4)) : '',
    'source' => !empty($store['anthropic_api_key']) ? 'giao diện' : ($key !== '' ? 'config.php' : ''),
    'ocr_model' => $cfg['anthropic_model'] ?? 'claude-haiku-4-5-20251001',
    'chat_model' => $cfg['anthropic_chat_model'] ?? ($cfg['anthropic_model'] ?? 'claude-haiku-4-5-20251001'),
  ]);
}

if ($action === 'save') {
  $b = body();
  $store = ai_key_store();
  // Khóa: chỉ ghi đè khi người dùng nhập (để trống = giữ khóa cũ)
  if (isset($b['key']) && $b['key'] !== '') {
    $key = trim((string)$b['key']);
    if (!preg_match('/^sk-ant-[A-Za-z0-9_\-]{20,250}$/', $key)) {
      json_out(['error' => 'Khóa không đúng định dạng (phải bắt đầu bằng sk-ant-...)'], 400);
    }
    $store['anthropic_api_key'] = $key;
  }
  foreach (['ocr_model' => 'anthropic_model', 'chat_model' => 'anthropic_chat_model'] as $in => $out) {
    if (isset($b[$in]) && $b[$in] !== '') {
      $m = trim((string)$b[$in]);
      if (!preg_match('/^[a-z0-9.\-]{5,80}$/', $m)) json_out(['error' => 'Tên model không hợp lệ'], 400);
      $store[$out] = $m;
    }
  }
  if (!$store) json_out(['error' => 'Không có gì để lưu'], 400);
  ai_key_write($store);
  json_out(['ok' => true]);
}

if ($action === 'test') {
  $cfg = ai_cfg();
  $key = (string)($cfg['anthropic_api_key'] ?? '');
  if ($key === '') json_out(['error' => 'Chưa có khóa — dán khóa rồi bấm Lưu trước'], 400);
  $model = $cfg['anthropic_chat_model'] ?? ($cfg['anthropic_model'] ?? 'claude-haiku-4-5-20251001');
  $ch = curl_init('https://api.anthropic.com/v1/messages');
  curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => json_encode([
      'model' => $model, 'max_tokens' => 24,
      'messages' => [['role' => 'user', 'content' => 'Chào! Trả lời đúng 1 câu ngắn xác nhận bạn đang hoạt động.']],
    ]),
    CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'x-api-key: ' . $key, 'anthropic-version: 2023-06-01'],
    CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 30, CURLOPT_CONNECTTIMEOUT => 10,
  ]);
  $resp = curl_exec($ch);
  $err = curl_error($ch);
  $http = curl_getinfo($ch, CURLINFO_HTTP_CODE);
  curl_close($ch);
  if ($resp === false) {
    error_log('ai-config test curl: ' . $err);
    json_out(['error' => 'Không nối được tới Anthropic (xem error_log của PHP để biết chi tiết)'], 502);
  }
  $j = json_decode($resp, true);
  if ($http !== 200) {
    json_out(['error' => 'Anthropic trả lỗi: ' . ($j['error']['message'] ?? ('HTTP ' . $http))], 502);
  }
  $txt = '';
  foreach (($j['content'] ?? []) as $blk) if (($blk['type'] ?? '') === 'text') $txt .= $blk['text'];
  $reply = function_exists('mb_substr') ? mb_substr($txt, 0, 200) : substr($txt, 0, 200);
  json_out(['ok' => true, 'model' => $model, 'reply' => $reply]);
}

if ($action === 'clear') {
  if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') json_out(['error' => 'Dùng POST'], 405);
  $b = body();
  if (($b['confirm'] ?? false) !== true) json_out(['error' => 'Thiếu xác nhận xóa khóa (confirm: true)'], 400);
  if (file_exists($KEY_FILE)) @unlink($KEY_FILE);
  error_log('ai-config: admin da xoa khoa AI qua giao dien');
  json_out(['ok' => true]);
}

json_out(['error' => 'Hành động không hợp lệ'], 400);
