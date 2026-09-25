<?php
/**
 * Редактор цен: GET — отдать текущий JSON, POST — сохранить (нужен пароль из config.php).
 * Перед каждой записью делается резервная копия в data/backups/.
 */
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
$cfg = require __DIR__ . '/config.php';
date_default_timezone_set($cfg['timezone'] ?? 'Europe/Moscow');
$file = $cfg['prices_file'];

function out($ok, $extra = []) { echo json_encode(['ok' => $ok] + $extra, JSON_UNESCAPED_UNICODE); exit; }

$pw = $_SERVER['HTTP_X_ADMIN_PASSWORD'] ?? ($_POST['password'] ?? '');
if ($pw === '' || $cfg['admin_password'] === 'change-me-please' || !hash_equals($cfg['admin_password'], $pw)) {
    http_response_code(401);
    out(false, ['error' => $cfg['admin_password'] === 'change-me-please' ? 'Сначала задайте пароль в api/config.php' : 'Неверный пароль']);
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    readfile($file); exit;
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); out(false, ['error' => 'method']); }

$raw = file_get_contents('php://input');
$data = json_decode($raw, true);
if (!is_array($data) || empty($data['crops']) || empty($data['elevators'])) { http_response_code(422); out(false, ['error' => 'Некорректные данные']); }

// нормализация
$data['updated'] = $data['updated'] ?? date('Y-m-d');
foreach ($data['crops'] as &$c) {
    foreach ($c['qualities'] as &$q) {
        foreach (($q['prices'] ?? []) as $k => $v) {
            $q['prices'][$k] = ($v === '' || $v === null) ? null : (int)round((float)$v);
        }
    }
}
unset($c, $q);
foreach ($data['featured'] as &$f) { $f['price'] = ($f['price'] === '' || $f['price'] === null) ? null : (int)round((float)$f['price']); }
unset($f);

// резервная копия
$bdir = dirname($file) . '/backups';
if (!is_dir($bdir)) @mkdir($bdir, 0750, true);
if (file_exists($file)) {
    @copy($file, $bdir . '/prices-' . date('Ymd-His') . '.json');
    $old = glob($bdir . '/prices-*.json'); sort($old);
    foreach (array_slice($old, 0, max(0, count($old) - (int)$cfg['prices_backups'])) as $o) @unlink($o);
}
$json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
if (file_put_contents($file, $json, LOCK_EX) === false) { http_response_code(500); out(false, ['error' => 'Не удалось записать файл. Проверьте права на папку data/']); }
out(true, ['updated' => $data['updated']]);
