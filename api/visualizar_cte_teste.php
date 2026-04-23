<?php
/**
 * API para gerar visualização de CT-e (XML e PDF) a partir de um payload
 * sem necessariamente ter enviado para a SEFAZ (ou simulando envio)
 */
ob_start();
require_once __DIR__ . '/../helpers/session_check.php';
ob_clean();
header('Content-Type: application/json; charset=utf-8');

$config       = require __DIR__ . '/../config/config.php';
$clientId     = $config['client_id'];
$clientSecret = $config['client_secret'];

$jsonBody = file_get_contents('php://input');
$data = json_decode($jsonBody, true);

if (!$data) {
    http_response_code(400);
    echo json_encode(['error' => 'Payload JSON é obrigatório.']);
    exit;
}

try {
    // 1. Autenticação
    $chAuth = curl_init("https://auth.nuvemfiscal.com.br/oauth/token");
    curl_setopt_array($chAuth, [
        CURLOPT_POST           => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POSTFIELDS     => http_build_query(['grant_type' => 'client_credentials', 'scope' => 'cte']),
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

    // 2. Chamar endpoint de visualização do CT-e
    // A API Nuvem Fiscal possui endpoint para gerar visualização (PDF/XML) a partir do payload
    $ch = curl_init("https://api.sandbox.nuvemfiscal.com.br/cte/visualizacao");
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POSTFIELDS     => json_encode($data),
        CURLOPT_HTTPHEADER     => [
            "Authorization: Bearer " . $authData->access_token,
            "Content-Type: application/json"
        ]
    ]);
    
    if (file_exists($cafile)) curl_setopt($ch, CURLOPT_CAINFO, $cafile);
    else { curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false); curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 0); }
    
    $resp = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($resp === false) {
        throw new Exception('Erro cURL: ' . $curlError);
    }

    if ($httpCode >= 400) {
        $errorData = json_decode($resp, true);
        $errorMsg = $errorData['error']['message'] ?? $errorData['message'] ?? 'Erro desconhecido na API';
        http_response_code($httpCode);
        echo json_encode(['error' => $errorMsg, 'raw' => $resp]);
        exit;
    }

    if (empty($resp)) {
        throw new Exception('Resposta vazia da API Nuvem Fiscal');
    }

    // O endpoint de visualização retorna o XML gerado e links para o PDF
    echo $resp;

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
