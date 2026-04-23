<?php
ob_start();
require_once __DIR__ . '/../helpers/session_check.php';
ob_clean();
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

$cpfCnpj = isset($_GET['cpf_cnpj']) ? preg_replace('/\D/', '', $_GET['cpf_cnpj']) : '';
if (!$cpfCnpj) { http_response_code(400); echo json_encode(['error' => 'cpf_cnpj é obrigatório']); exit; }

try {
    require_once __DIR__ . '/auth_nuvem.php';
    $response = nuvemFiscalRequest('GET', '/cte/sefaz/status?' . http_build_query([
        'cpf_cnpj' => $cpfCnpj,
        'ambiente' => 'homologacao',
    ]));
    http_response_code($response['status']);
    echo json_encode($response['body']);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
