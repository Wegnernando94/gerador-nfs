<?php
ob_start();
require_once __DIR__ . '/../helpers/session_check.php';
ob_clean();
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

$config = require __DIR__ . '/../config/config.php';

$top     = isset($_GET['top'])      ? (int)$_GET['top']                              : 20;
$skip    = isset($_GET['skip'])     ? (int)$_GET['skip']                             : 0;
$top     = max(1, min(100, $top));
$skip    = max(0, min(10000, $skip));
$cpfCnpj = isset($_GET['cpf_cnpj']) ? preg_replace('/\D/', '', $_GET['cpf_cnpj'])   : '';
$serie   = isset($_GET['serie'])    ? (int)$_GET['serie']                            : 0;
$chave   = isset($_GET['chave'])    ? preg_replace('/\D/', '', $_GET['chave'])       : '';

if (!$cpfCnpj) {
    http_response_code(400);
    echo json_encode(['error' => 'cpf_cnpj é obrigatório']);
    exit;
}

try {
    require_once __DIR__ . '/auth_nuvem.php';
    $token = nuvemFiscalToken();

    $params = [
        '$top'     => $top,
        '$skip'    => $skip,
        'ambiente' => 'homologacao',
        'cpf_cnpj' => $cpfCnpj,
    ];
    if ($serie > 0) $params['serie'] = $serie;
    if ($chave)     $params['chave'] = $chave;

    $url = NUVEM_API_BASE . '/cte?' . http_build_query($params);

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
        CURLOPT_TIMEOUT        => 30,
        CURLOPT_HTTPHEADER     => ['Authorization: Bearer ' . $token, 'Accept: application/json'],
    ]);
    if (file_exists(NUVEM_CAINFO)) curl_setopt($ch, CURLOPT_CAINFO, NUVEM_CAINFO);
    else { curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false); curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 0); }

    $resposta = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    http_response_code($httpCode);
    echo $resposta;

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
