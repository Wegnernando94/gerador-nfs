<?php
ob_start();
require_once __DIR__ . '/../helpers/session_check.php';
ob_clean();
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, HEAD, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'HEAD') {
    if (!isset($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    header('X-CSRF-Token: ' . $_SESSION['csrf_token']);
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/auth_nuvem.php';

try {
    // Busca todas as empresas diretamente da Nuvem Fiscal, paginando até trazer tudo
    $empresas = [];
    $top      = 50;
    $skip     = 0;

    do {
        $r = nuvemFiscalRequest('GET', '/empresas?$top=' . $top . '&$skip=' . $skip);
        if ($r['status'] !== 200) {
            error_log('[listar_empresas] Falha ao listar: HTTP ' . $r['status']);
            break;
        }
        $items = $r['body']['data'] ?? [];
        $empresas = array_merge($empresas, $items);
        $skip += $top;
    } while (count($items) === $top);

    echo json_encode(['data' => $empresas]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
