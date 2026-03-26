<?php
/**
 * cadastrar_empresa.php
 * Proxy: POST /empresas
 *
 * Accepts a JSON body from the frontend and forwards it to the Nuvem Fiscal API.
 * Handles HTTP 409 (conflict) by returning a friendly already_exists response.
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/auth_nuvem.php';

$method = strtoupper($_SERVER['REQUEST_METHOD']);

// GET — buscar dados cadastrais de uma empresa pelo CNPJ
if ($method === 'GET') {
    $cpfCnpj = preg_replace('/\D/', '', $_GET['cpf_cnpj'] ?? '');
    if ($cpfCnpj === '') {
        http_response_code(400);
        echo json_encode(['error' => 'Parâmetro cpf_cnpj é obrigatório.']);
        exit;
    }
    $result = nuvemFiscalRequest('GET', '/empresas/' . $cpfCnpj);
    http_response_code($result['status']);
    echo json_encode($result['body']);
    exit;
}

if (!in_array($method, ['POST', 'PUT'], true)) {
    http_response_code(405);
    echo json_encode(['error' => 'Method Not Allowed. Use POST (criar) ou PUT (atualizar).']);
    exit;
}

// Read and decode the JSON body sent by the frontend
$rawInput = file_get_contents('php://input');
if ($rawInput === false || trim($rawInput) === '') {
    http_response_code(400);
    echo json_encode(['error' => 'Request body is empty.']);
    exit;
}

$requestBody = json_decode($rawInput, true);
if ($requestBody === null) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON in request body.']);
    exit;
}

// PUT — atualizar empresa existente
if ($method === 'PUT') {
    $cpfCnpj = preg_replace('/\D/', '', $requestBody['cpf_cnpj'] ?? '');
    if ($cpfCnpj === '') {
        http_response_code(400);
        echo json_encode(['error' => 'Campo cpf_cnpj é obrigatório para atualização.']);
        exit;
    }
    // Remove cpf_cnpj do body (não vai no payload do PUT)
    unset($requestBody['cpf_cnpj']);
    try {
        $result = nuvemFiscalRequest('PUT', '/empresas/' . $cpfCnpj, $requestBody);
    } catch (RuntimeException $e) {
        http_response_code(502);
        echo json_encode(['error' => 'Gateway error: ' . $e->getMessage()]);
        exit;
    }
    http_response_code($result['status']);
    echo json_encode($result['body']);
    exit;
}

// POST — criar empresa
try {
    $result = nuvemFiscalRequest('POST', '/empresas', $requestBody);
} catch (RuntimeException $e) {
    http_response_code(502);
    echo json_encode(['error' => 'Gateway error: ' . $e->getMessage()]);
    exit;
}

$status = $result['status'];
$body   = $result['body'];

// Handle 409 Conflict — empresa already registered in Nuvem Fiscal
if ($status === 409) {
    http_response_code(409);
    echo json_encode([
        'already_exists' => true,
        'message'        => 'Empresa já cadastrada na Nuvem Fiscal. Prossiga para o certificado digital.',
    ]);
    exit;
}

// Forward the API response with its original HTTP status code
http_response_code($status);
echo json_encode($body);
