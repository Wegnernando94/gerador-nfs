<?php
ob_start();
require_once __DIR__ . '/../helpers/session_check.php';
ob_clean();
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/auth_nuvem.php';

$jsonBody = file_get_contents('php://input');
json_decode($jsonBody);
if (json_last_error() !== JSON_ERROR_NONE) {
    http_response_code(400);
    echo json_encode(['error' => 'Formato inválido. Esperava JSON.']);
    exit;
}

$data = json_decode($jsonBody, true);
$id   = preg_replace('/[^a-zA-Z0-9_\-]/', '', $data['id'] ?? '');

if (!$id) {
    http_response_code(400);
    echo json_encode(['error' => 'Campo "id" da NF-e é obrigatório.']);
    exit;
}

$payload = $data['payload'] ?? null;
if (!$payload) {
    http_response_code(400);
    echo json_encode(['error' => 'Campo "payload" com os dados da NF-e é obrigatório.']);
    exit;
}

try {
    // A API Nuvem Fiscal não suporta PUT/DELETE em NF-e rejeitada.
    // O fluxo correto é criar nova NF-e com os dados corrigidos (mesmo série/número).
    // POST /nfe já cria e emite a nota automaticamente
    $result = nuvemFiscalRequest('POST', '/nfe', $payload);

    http_response_code($result['status']);
    echo json_encode($result['body']);

} catch (RuntimeException $e) {
    http_response_code(502);
    echo json_encode(['error' => 'Gateway error: ' . $e->getMessage()]);
}
