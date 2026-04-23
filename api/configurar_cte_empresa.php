<?php
/**
 * API para configurar/habilitar CT-e para uma empresa na Nuvem Fiscal
 */
ob_start();
require_once __DIR__ . '/../helpers/session_check.php';
ob_clean();
header('Content-Type: application/json; charset=utf-8');

$config       = require __DIR__ . '/../config/config.php';
$clientId     = $config['client_id'];
$clientSecret = $config['client_secret'];

$cnpj = $_GET['cnpj'] ?? '';
$cnpj = preg_replace('/\D/', '', $cnpj);

if (strlen($cnpj) !== 14 && strlen($cnpj) !== 11) {
    http_response_code(400);
    echo json_encode(['error' => 'CNPJ/CPF inválido.']);
    exit;
}

try {
    // 1. Autenticação
    $chAuth = curl_init("https://auth.nuvemfiscal.com.br/oauth/token");
    curl_setopt_array($chAuth, [
        CURLOPT_POST           => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POSTFIELDS     => http_build_query(['grant_type' => 'client_credentials', 'scope' => 'empresa']),
        CURLOPT_HTTPHEADER     => [
            "Authorization: Basic " . base64_encode(trim($clientId) . ":" . trim($clientSecret)),
            "Content-Type: application/x-www-form-urlencoded"
        ]
    ]);
    
    $cafile = __DIR__ . '/../certs/cacert.pem';
    if (file_exists($cafile)) curl_setopt($chAuth, CURLOPT_CAINFO, $cafile);
    else { curl_setopt($chAuth, CURLOPT_SSL_VERIFYPEER, false); curl_setopt($chAuth, CURLOPT_SSL_VERIFYHOST, 0); }
    
    $authData = json_decode(curl_exec($chAuth));
    curl_close($chAuth);

    if (!isset($authData->access_token)) {
        throw new Exception('Falha na autenticação com a Nuvem Fiscal');
    }

    // 2. Configurar CT-e via PUT
    // Estamos configurando para ambiente de HOMOLOGAÇÃO por padrão para testes
    $payload = [
        'ambiente' => 'homologacao'
    ];

    $ch = curl_init("https://api.sandbox.nuvemfiscal.com.br/empresas/{$cnpj}/cte");
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST  => 'PUT',
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POSTFIELDS     => json_encode($payload),
        CURLOPT_HTTPHEADER     => [
            "Authorization: Bearer " . $authData->access_token,
            "Content-Type: application/json"
        ]
    ]);
    
    if (file_exists($cafile)) curl_setopt($ch, CURLOPT_CAINFO, $cafile);
    else { curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false); curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 0); }
    
    $resp = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode >= 400) {
        echo $resp;
        exit;
    }

    echo json_encode(['success' => true, 'message' => 'Configuração de CT-e ativada com sucesso para ' . $cnpj]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
