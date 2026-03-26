<?php
ob_start();
require_once __DIR__ . '/../helpers/session_check.php';
ob_clean();
header('Content-Type: application/json');

// 1. Carrega as chaves com segurança
$config = require __DIR__ . '/../config/config.php';
$clientId = $config['client_id'];
$clientSecret = $config['client_secret'];

// 2. Recebe o JSON blindado do Front-end
$jsonBody = file_get_contents('php://input');

// Trava de segurança: impede envio de XML acidental
json_decode($jsonBody);
if (json_last_error() !== JSON_ERROR_NONE) {
    http_response_code(400);
    echo json_encode(["error" => "Formato inválido. O PHP esperava um JSON."]);
    exit;
}

try {
    // 3. Autenticação na Nuvem Fiscal (Gera o Token)
    $authUrl = "https://auth.nuvemfiscal.com.br/oauth/token";
    $chAuth = curl_init($authUrl);
    curl_setopt($chAuth, CURLOPT_POST, true);
    curl_setopt($chAuth, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($chAuth, CURLOPT_SSL_VERIFYPEER, true);
    curl_setopt($chAuth, CURLOPT_SSL_VERIFYHOST, 2);
    curl_setopt($chAuth, CURLOPT_POSTFIELDS, http_build_query(['grant_type' => 'client_credentials', 'scope' => 'nfe']));
    curl_setopt($chAuth, CURLOPT_HTTPHEADER, [
        "Authorization: Basic " . base64_encode(trim($clientId) . ":" . trim($clientSecret)),
        "Content-Type: application/x-www-form-urlencoded"
    ]);
    // SSL certificate fallback
    $cafile = '/var/www/html/certs/cacert.pem';
    if (file_exists($cafile)) {
        curl_setopt($chAuth, CURLOPT_CAINFO, $cafile);
    } else {
        curl_setopt($chAuth, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($chAuth, CURLOPT_SSL_VERIFYHOST, 0);
    }

    $authResponse = curl_exec($chAuth);
    $authData = json_decode($authResponse);
    curl_close($chAuth);

    if (!isset($authData->access_token)) {
        http_response_code(401);
        echo json_encode(["error" => "Falha na Autenticação Nuvem Fiscal", "detalhes" => $authData]);
        exit;
    }

    // 4. Envia a NF-e para o ambiente de Sandbox
    $apiUrl = "https://api.sandbox.nuvemfiscal.com.br/nfe";
    $chNfe = curl_init($apiUrl);
    curl_setopt($chNfe, CURLOPT_POST, true);
    curl_setopt($chNfe, CURLOPT_POSTFIELDS, $jsonBody);
    curl_setopt($chNfe, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($chNfe, CURLOPT_SSL_VERIFYPEER, true);
    curl_setopt($chNfe, CURLOPT_SSL_VERIFYHOST, 2);
    curl_setopt($chNfe, CURLOPT_HTTPHEADER, [
        "Authorization: Bearer " . $authData->access_token,
        "Content-Type: application/json"
    ]);
    // SSL certificate fallback
    $cafile = '/var/www/html/certs/cacert.pem';
    if (file_exists($cafile)) {
        curl_setopt($chNfe, CURLOPT_CAINFO, $cafile);
    } else {
        curl_setopt($chNfe, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($chNfe, CURLOPT_SSL_VERIFYHOST, 0);
    }

    $resposta = curl_exec($chNfe);
    $httpCode = curl_getinfo($chNfe, CURLINFO_HTTP_CODE);
    curl_close($chNfe);

    // 5. Devolve a resposta exata da API para o seu JavaScript
    http_response_code($httpCode);
    echo $resposta;

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["error" => $e->getMessage()]);
}