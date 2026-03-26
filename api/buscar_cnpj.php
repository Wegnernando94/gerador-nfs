<?php
/**
 * buscar_cnpj.php
 * Proxy: GET /cnpj/{cnpj}  +  optional check against GET /empresas/{cnpj}
 *
 * Query param: ?cnpj=XX.XXX.XXX/XXXX-XX  (formatting characters are stripped)
 *
 * If the empresa already exists in Nuvem Fiscal (GET /empresas/{cnpj} returns 200),
 * the field "empresa_cadastrada": true is injected into the response before returning.
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/auth_nuvem.php';

// Only accept GET requests
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Method Not Allowed. Use GET.']);
    exit;
}

// Read and sanitize the cnpj query parameter
$cnpjRaw = isset($_GET['cnpj']) ? $_GET['cnpj'] : '';
$cnpj    = preg_replace('/\D/', '', $cnpjRaw);

if ($cnpj === '') {
    http_response_code(400);
    echo json_encode(['error' => 'Query parameter "cnpj" is required.']);
    exit;
}

if (strlen($cnpj) !== 14) {
    http_response_code(400);
    echo json_encode(['error' => 'CNPJ must contain exactly 14 digits.']);
    exit;
}

// 1. Look up CNPJ data (public registry)
try {
    $cnpjResult = nuvemFiscalRequest('GET', '/cnpj/' . $cnpj);
} catch (RuntimeException $e) {
    http_response_code(502);
    echo json_encode(['error' => 'Gateway error during CNPJ lookup: ' . $e->getMessage()]);
    exit;
}

$cnpjStatus = $cnpjResult['status'];
$cnpjBody   = $cnpjResult['body'];

// If the CNPJ lookup itself failed, return the error as-is
if ($cnpjStatus < 200 || $cnpjStatus >= 300) {
    http_response_code($cnpjStatus);
    echo json_encode($cnpjBody);
    exit;
}

// 2. Check whether the empresa is already registered in Nuvem Fiscal
try {
    $empresaResult = nuvemFiscalRequest('GET', '/empresas/' . $cnpj);
    if ($empresaResult['status'] === 200) {
        $cnpjBody['empresa_cadastrada'] = true;
    }
} catch (RuntimeException $e) {
    // Non-fatal: if we cannot determine registration status, just omit the field
    // and continue returning the CNPJ data.
}

http_response_code($cnpjStatus);
echo json_encode($cnpjBody);
