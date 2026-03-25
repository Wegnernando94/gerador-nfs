<?php
// Proteções de segurança sem autenticação
if (session_status() === PHP_SESSION_NONE) session_start();

// Rate limiting por sessão (máx 60 req/minuto)
$now    = time();
$window = 60;
$limit  = 60;

if (!isset($_SESSION['rl_count'], $_SESSION['rl_window_start'])) {
    $_SESSION['rl_count']        = 0;
    $_SESSION['rl_window_start'] = $now;
}

if ($now - $_SESSION['rl_window_start'] > $window) {
    $_SESSION['rl_count']        = 0;
    $_SESSION['rl_window_start'] = $now;
}

$_SESSION['rl_count']++;

if ($_SESSION['rl_count'] > $limit) {
    http_response_code(429);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Muitas requisições. Aguarde um momento.']);
    exit;
}
