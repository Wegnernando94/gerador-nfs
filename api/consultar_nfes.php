<?php
ob_start();
require_once __DIR__ . '/../helpers/session_check.php';
ob_clean();
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$config       = require __DIR__ . '/../config/config.php';
$clientId     = $config['client_id'];
$clientSecret = $config['client_secret'];

$top     = isset($_GET['top'])     ? (int)$_GET['top']                            : 50;
$skip    = isset($_GET['skip'])    ? (int)$_GET['skip']                           : 0;
$top  = max(1, min(100, $top));   // clamp: 1–100
$skip = max(0, min(10000, $skip)); // clamp: 0–10000
$status  = isset($_GET['status'])  ? $_GET['status']                               : '';
$orderby = isset($_GET['$orderby']) ? $_GET['$orderby']                            : '';
$cpfCnpj = isset($_GET['cpf_cnpj']) ? preg_replace('/\D/', '', $_GET['cpf_cnpj']) : '';

if (!$cpfCnpj) {
    http_response_code(400);
    echo json_encode(['error' => 'cpf_cnpj é obrigatório']);
    exit;
}

try {
    // 1. Autenticação
    $chAuth = curl_init("https://auth.nuvemfiscal.com.br/oauth/token");
    curl_setopt_array($chAuth, [
        CURLOPT_POST           => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
        CURLOPT_POSTFIELDS     => http_build_query(['grant_type' => 'client_credentials', 'scope' => 'nfe']),
        CURLOPT_HTTPHEADER     => [
            "Authorization: Basic " . base64_encode(trim($clientId) . ":" . trim($clientSecret)),
            "Content-Type: application/x-www-form-urlencoded"
        ]
    ]);
    // SSL certificate fallback
    $cafile = __DIR__ . '/../certs/cacert.pem';
    if (file_exists($cafile)) {
        curl_setopt($chAuth, CURLOPT_CAINFO, $cafile);
    } else {
        curl_setopt($chAuth, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($chAuth, CURLOPT_SSL_VERIFYHOST, 0);
    }
    $authData = json_decode(curl_exec($chAuth));
    curl_close($chAuth);

    if (!isset($authData->access_token)) {
        http_response_code(401);
        echo json_encode(['error' => 'Falha na autenticação']);
        exit;
    }

    // 2. Monta query — ambiente e cpf_cnpj são obrigatórios pela API
    $params = [
        '$top'      => $top,
        '$skip'     => $skip,
        'ambiente'  => 'homologacao',
        'cpf_cnpj'  => $cpfCnpj,
    ];
    // Nota: a API não suporta filtro por situação — o filtro é feito no lado cliente
    if ($orderby) $params['$orderby'] = $orderby;

    $url = "https://api.sandbox.nuvemfiscal.com.br/nfe?" . http_build_query($params);

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
        CURLOPT_HTTPHEADER     => ["Authorization: Bearer " . $authData->access_token]
    ]);
    // SSL certificate fallback
    $cafile = __DIR__ . '/../certs/cacert.pem';
    if (file_exists($cafile)) {
        curl_setopt($ch, CURLOPT_CAINFO, $cafile);
    } else {
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 0);
    }
    $resposta = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    http_response_code($httpCode);
    echo $resposta;

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
