<?php
/** Публичная статистика для бейджа квиза: сколько заявок пришло сегодня (по журналу). */
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: public, max-age=300');
$cfg = require __DIR__ . '/config.php';
date_default_timezone_set($cfg['timezone'] ?? 'Europe/Moscow');
$f = __DIR__ . '/../data/leads/' . date('Y-m') . '.log';
$today = 0;
if (file_exists($f)) $today = preg_match_all('/^\[' . preg_quote(date('Y-m-d'), '/') . 'T/m', file_get_contents($f));
echo json_encode(['ok' => true, 'today' => $today]);
