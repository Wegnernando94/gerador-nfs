<?php
header('Content-Type: application/json');
echo json_encode([
    'php'     => PHP_VERSION,
    'sapi'    => PHP_SAPI,
    'server'  => $_SERVER['SERVER_SOFTWARE'] ?? 'unknown',
    'time'    => date('c'),
    'cafile'  => file_exists(__DIR__ . '/../certs/cacert.pem') ? 'ok' : 'missing',
    'config'  => file_exists(__DIR__ . '/../config/config.php') ? 'ok' : 'missing',
]);
