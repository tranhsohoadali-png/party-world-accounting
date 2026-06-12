<?php
// ============================================================
// ai-chat.php — Trợ lý AI trong phần mềm (Claude Messages API)
// POST JSON: { system: "...", messages: [...], tools: [...] }
// Trả về:    { ok: true, resp: <nguyên văn JSON Anthropic> }
// Dùng CHUNG 'anthropic_api_key' với ai-ocr.php (api/config.php).
// Tool chạy phía trình duyệt (PW.data) — PHP chỉ làm proxy giữ key.
// ============================================================
require __DIR__ . '/lib.php';

require_login();

$cfg = require __DIR__ . '/config.php';
$apiKey = $cfg['anthropic_api_key'] ?? '';
// Model chat riêng (mặc định Haiku cho rẻ; đổi 'claude-sonnet-4-6' nếu muốn thông minh hơn)
$model = $cfg['anthropic_chat_model'] ?? ($cfg['anthropic_model'] ?? 'claude-haiku-4-5-20251001');
if ($apiKey === '') {
  json_out(['error' => 'Chưa cấu hình anthropic_api_key trong api/config.php'], 500);
}

$raw = file_get_contents('php://input');
if (strlen($raw) > 400 * 1024) json_out(['error' => 'Hội thoại quá dài — bấm nút xóa hội thoại rồi hỏi lại'], 400);
$b = json_decode($raw, true);
if (!is_array($b)) json_out(['error' => 'Body không hợp lệ'], 400);

$messages = $b['messages'] ?? [];
$system   = (string)($b['system'] ?? '');
$tools    = $b['tools'] ?? [];
if (!is_array($messages) || count($messages) === 0) json_out(['error' => 'Thiếu messages'], 400);
if (count($messages) > 60) json_out(['error' => 'Hội thoại quá dài'], 400);
if (!is_array($tools) || count($tools) > 16) json_out(['error' => 'Tools không hợp lệ'], 400);
if (strlen($system) > 12000) $system = substr($system, 0, 12000);

$payload = ['model' => $model, 'max_tokens' => 2500, 'messages' => $messages];
if ($system !== '') $payload['system'] = $system;
if (count($tools)) $payload['tools'] = $tools;

$ch = curl_init('https://api.anthropic.com/v1/messages');
curl_setopt_array($ch, [
  CURLOPT_POST => true,
  CURLOPT_POSTFIELDS => json_encode($payload),
  CURLOPT_HTTPHEADER => [
    'Content-Type: application/json',
    'x-api-key: ' . $apiKey,
    'anthropic-version: 2023-06-01',
  ],
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_TIMEOUT => 120,
  CURLOPT_CONNECTTIMEOUT => 15,
]);
$resp = curl_exec($ch);
$err  = curl_error($ch);
$http = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($resp === false) json_out(['error' => 'Không gọi được API Anthropic: ' . $err], 502);
$j = json_decode($resp, true);
if ($http !== 200) {
  $msg = $j['error']['message'] ?? ('HTTP ' . $http);
  json_out(['error' => 'Anthropic API lỗi: ' . $msg], 502);
}
json_out(['ok' => true, 'resp' => $j, 'model' => $model]);
