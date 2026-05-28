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
    // Busca cada empresa pelo CNPJ salvo localmente
    // (a API Nuvem Fiscal exige cpf_cnpj como filtro — não suporta listagem sem ele)
    $arquivo = __DIR__ . '/../data/empresas_locais.json';
    $cnpjs = [];
    if (file_exists($arquivo)) {
        $cnpjs = json_decode(file_get_contents($arquivo), true) ?? [];
    }

    $empresas = [];
    foreach ($cnpjs as $cnpj) {
        $cnpj = preg_replace('/\D/', '', $cnpj);
        if ($cnpj === '') continue;
        $r = nuvemFiscalRequest('GET', '/empresas/' . $cnpj);
        if ($r['status'] === 200 && !empty($r['body']['cpf_cnpj'])) {
            // Adicionar tipo de empresa
            $tipoArquivo = __DIR__ . '/../data/tipos_empresa.json';
            $tipos = file_exists($tipoArquivo) ? json_decode(file_get_contents($tipoArquivo), true) ?? [] : [];
            $r['body']['tipo_empresa'] = $tipos[$cnpj] ?? 'cliente';
            $empresas[] = $r['body'];
        }
    }

    echo json_encode(['data' => $empresas]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
