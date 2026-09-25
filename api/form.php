<?php
/**
 * Приём заявок с форм сайта (JSON или multipart с вложениями) → письмо + Telegram + журнал.
 * Маршрутизация по типу формы / теме — в config.php. Защита: honeypot, минимальное время заполнения, лимит по IP.
 */
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
$cfg = require __DIR__ . '/config.php';
date_default_timezone_set($cfg['timezone'] ?? 'Europe/Moscow');

function out($ok, $extra = []) { echo json_encode(['ok' => $ok] + $extra, JSON_UNESCAPED_UNICODE); exit; }

if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); out(false, ['error' => 'method']); }
$ctype = $_SERVER['CONTENT_TYPE'] ?? '';
if (stripos($ctype, 'multipart/form-data') !== false) {
    $d = $_POST;
    if (isset($d['payload'])) { $j = json_decode($d['payload'], true); if (is_array($j)) $d = $j + $d; unset($d['payload']); }
} else {
    $d = json_decode(file_get_contents('php://input'), true);
    if (!is_array($d)) $d = $_POST;
}
if (!$d) { http_response_code(400); out(false, ['error' => 'empty']); }

// --- антиспам ---
if (!empty($d['website'])) out(true);
if (isset($d['elapsed']) && (int)$d['elapsed'] < 3) out(true);
$ip = $_SERVER['REMOTE_ADDR'] ?? '0';
$rateFile = sys_get_temp_dir() . '/tdzz-rate-' . md5($ip);
$hits = file_exists($rateFile) ? array_filter(explode("\n", file_get_contents($rateFile)), fn($t) => (int)$t > time() - 3600) : [];
if (count($hits) >= 10) { http_response_code(429); out(false, ['error' => 'rate']); }
$hits[] = time(); file_put_contents($rateFile, implode("\n", $hits));

// --- данные ---
$clean = [];
$labels = [
    'form_type' => 'Тип заявки', 'name' => 'Имя', 'company' => 'Компания', 'contact' => 'Телефон / e-mail', 'phone' => 'Телефон', 'email' => 'E-mail',
    'commodity' => 'Культура', 'crops' => 'Культуры', 'volume' => 'Объём', 'point' => 'Пункт приёмки / порт', 'region' => 'Район / регион',
    'selected_price' => 'Выбранная цена', 'comment' => 'Комментарий', 'message' => 'Сообщение', 'topic' => 'Тема',
    'destination' => 'Направление', 'basis' => 'Базис', 'country' => 'Страна', 'product' => 'Продукт', 'quantity' => 'Количество, т',
    'specification' => 'Спецификация', 'quality' => 'Качество', 'quality_details' => 'Показатели качества', 'when' => 'Отгрузка',
    'lang' => 'Язык', 'page' => 'Страница',
];
foreach ($d as $k => $v) {
    if (in_array($k, ['website', 'elapsed', 'privacy'], true)) continue;
    $k = preg_replace('/[^a-z0-9_]/i', '', (string)$k);
    if (is_array($v)) $v = implode(', ', array_map('strval', $v));
    $v = trim(strip_tags((string)$v));
    if ($k === '' || $v === '') continue;
    $clean[$k] = mb_substr($v, 0, 3000);
}
if (empty($clean['name']) && empty($clean['contact']) && empty($clean['phone']) && empty($clean['email'])) { http_response_code(422); out(false, ['error' => 'fields']); }

$type = $clean['form_type'] ?? 'contact';
$typeNames = ['supplier' => 'Продажа зерна', 'quiz' => 'Продажа зерна (квиз)', 'passport' => 'Продажа зерна (паспорт партии)', 'export_rfq' => 'Экспортный запрос (RFQ)', 'export' => 'Экспорт', 'contact' => 'Обращение с сайта', 'procurement' => 'Закупка', 'corporate' => 'Корпоративный запрос', 'partner' => 'Партнёрство'];
$subject = 'Заявка с сайта tdzz.ru: ' . ($typeNames[$type] ?? $type);
if (!empty($clean['crops'])) $subject .= ' — ' . $clean['crops'];

$recipients = $cfg['mail_routes'][$type] ?? null;
if (!$recipients && !empty($clean['topic'])) {
    foreach ($cfg['topic_routes'] ?? [] as $needle => $addr) {
        if (mb_stripos($clean['topic'], $needle) !== false) { $recipients = $addr; break; }
    }
}
if (!$recipients) $recipients = $cfg['mail_to'];

// --- вложения (протокол анализа и т.п.) ---
$attachments = [];
$maxBytes = (int)($cfg['upload_max_mb'] ?? 10) * 1024 * 1024;
$allowed = ['pdf', 'jpg', 'jpeg', 'png', 'heic', 'webp', 'xls', 'xlsx', 'doc', 'docx'];
$upDir = __DIR__ . '/../data/uploads';
if (!empty($_FILES)) {
    if (!is_dir($upDir)) @mkdir($upDir, 0750, true);
    foreach ($_FILES as $field => $f) {
        $names = is_array($f['name']) ? $f['name'] : [$f['name']];
        $tmps = is_array($f['tmp_name']) ? $f['tmp_name'] : [$f['tmp_name']];
        $sizes = is_array($f['size']) ? $f['size'] : [$f['size']];
        $errs = is_array($f['error']) ? $f['error'] : [$f['error']];
        foreach ($names as $i => $name) {
            if ($errs[$i] !== UPLOAD_ERR_OK || !is_uploaded_file($tmps[$i])) continue;
            $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
            if (!in_array($ext, $allowed, true) || $sizes[$i] > $maxBytes || count($attachments) >= 5) continue;
            $safe = date('Ymd-His') . '-' . substr(md5($name . microtime()), 0, 8) . '.' . $ext;
            if (move_uploaded_file($tmps[$i], "$upDir/$safe")) $attachments[] = ['path' => "$upDir/$safe", 'name' => preg_replace('/[^\w.\-а-яА-ЯёЁ ]/u', '_', $name)];
        }
    }
}

$lines = [];
foreach ($clean as $k => $v) $lines[] = ($labels[$k] ?? $k) . ': ' . $v;
if ($attachments) $lines[] = 'Вложения: ' . implode(', ', array_column($attachments, 'name'));
$lines[] = 'Получатель: ' . $recipients;
$lines[] = 'IP: ' . $ip;
$lines[] = 'Время: ' . date('d.m.Y H:i');
$body = implode("\n", $lines);

// --- письмо (multipart, если есть вложения) ---
$sent = false;
$from = $cfg['mail_from'];
$replyTo = filter_var($clean['email'] ?? '', FILTER_VALIDATE_EMAIL) ?: (filter_var($clean['contact'] ?? '', FILTER_VALIDATE_EMAIL) ?: '');
$headers = "From: Сайт tdzz.ru <$from>\r\n" . ($replyTo ? "Reply-To: $replyTo\r\n" : '') . "MIME-Version: 1.0\r\n";
if ($attachments) {
    $b = 'tdzz-' . md5(uniqid('', true));
    $headers .= "Content-Type: multipart/mixed; boundary=\"$b\"\r\n";
    $mime = "--$b\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n$body\r\n";
    foreach ($attachments as $a) {
        $data = chunk_split(base64_encode(file_get_contents($a['path'])));
        $fn = '=?UTF-8?B?' . base64_encode($a['name']) . '?=';
        $mime .= "--$b\r\nContent-Type: application/octet-stream; name=\"$fn\"\r\nContent-Transfer-Encoding: base64\r\nContent-Disposition: attachment; filename=\"$fn\"\r\n\r\n$data\r\n";
    }
    $mime .= "--$b--";
    $mailBody = $mime;
} else {
    $headers .= "Content-Type: text/plain; charset=UTF-8\r\n";
    $mailBody = $body;
}
foreach (array_map('trim', explode(',', $recipients)) as $to) {
    if ($to && @mail($to, '=?UTF-8?B?' . base64_encode($subject) . '?=', $mailBody, $headers)) $sent = true;
}

// --- telegram ---
if (!empty($cfg['telegram_token']) && !empty($cfg['telegram_chat_id'])) {
    $ctx = stream_context_create(['http' => ['method' => 'POST', 'timeout' => 5,
        'header' => "Content-Type: application/x-www-form-urlencoded\r\n",
        'content' => http_build_query(['chat_id' => $cfg['telegram_chat_id'], 'text' => "📩 $subject\n\n$body"])]]);
    if (@file_get_contents('https://api.telegram.org/bot' . $cfg['telegram_token'] . '/sendMessage', false, $ctx) !== false) $sent = true;
    foreach ($attachments as $a) {
        if (!class_exists('CURLFile')) break;
        $ch = curl_init('https://api.telegram.org/bot' . $cfg['telegram_token'] . '/sendDocument');
        curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 15,
            CURLOPT_POSTFIELDS => ['chat_id' => $cfg['telegram_chat_id'], 'document' => new CURLFile($a['path'], 'application/octet-stream', $a['name'])]]);
        @curl_exec($ch); curl_close($ch);
    }
}

// --- журнал ---
$logDir = __DIR__ . '/../data/leads';
if (!is_dir($logDir)) @mkdir($logDir, 0750, true);
@file_put_contents($logDir . '/' . date('Y-m') . '.log', '[' . date('c') . "] $subject\n$body\n\n", FILE_APPEND | LOCK_EX);

out($sent || is_dir($logDir));
