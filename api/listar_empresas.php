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
    $arquivo = __DIR__ . '/../data/empresas_locais.json';
    $cnpjs = [];
    if (file_exists($arquivo)) {
        $cnpjs = json_decode(file_get_contents($arquivo), true) ?? [];
    }

    // Sanitiza todos os CNPJs
    $cnpjsSanitizados = [];
    foreach ($cnpjs as $c) {
        $c = preg_replace('/\D/', '', $c);
        if ($c !== '') $cnpjsSanitizados[] = $c;
    }

    $empresas = [];
    $erros    = [];

    foreach ($cnpjsSanitizados as $cnpj) {
        try {
            $r = nuvemFiscalRequest('GET', '/empresas/' . $cnpj);
            if ($r['status'] === 200 && !empty($r['body']['cpf_cnpj'])) {
                $empresas[] = $r['body'];
            } elseif ($r['status'] === 404) {
                // Empresa salva localmente mas não encontrada na Nuvem Fiscal
                $empresas[] = [
                    'cpf_cnpj'          => $cnpj,
                    'nome_razao_social'  => 'CNPJ ' . $cnpj . ' (não cadastrado)',
                    '_pendente'         => true,
                ];
            } else {
                $erros[] = ['cnpj' => $cnpj, 'status' => $r['status']];
                error_log('[listar_empresas] Falha CNPJ ' . $cnpj . ': HTTP ' . $r['status']);
            }
        } catch (Exception $eInner) {
            $erros[] = ['cnpj' => $cnpj, 'erro' => $eInner->getMessage()];
            error_log('[listar_empresas] Exceção CNPJ ' . $cnpj . ': ' . $eInner->getMessage());
        }
    }

    $resp = ['data' => $empresas];
    if (!empty($erros)) {
        $resp['avisos'] = $erros;
    }

    echo json_encode($resp);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
