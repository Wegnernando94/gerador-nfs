<?php
require_once 'session_check.php';
header('Content-Type: application/json');

$config = require 'config.php';
$clientId = $config['client_id'];
$clientSecret = $config['client_secret'];

try {
    // 1. Obter Token (Atenção ao scope 'empresa')
    $authUrl = "https://auth.nuvemfiscal.com.br/oauth/token";
    $chAuth = curl_init($authUrl);
    curl_setopt($chAuth, CURLOPT_POST, true);
    curl_setopt($chAuth, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($chAuth, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($chAuth, CURLOPT_POSTFIELDS, http_build_query([
        'grant_type' => 'client_credentials', 
        'scope' => 'empresa' // Escopo diferente para buscar empresas
    ]));
    curl_setopt($chAuth, CURLOPT_HTTPHEADER, [
        "Authorization: Basic " . base64_encode(trim($clientId) . ":" . trim($clientSecret)),
        "Content-Type: application/x-www-form-urlencoded"
    ]);

    $authResponse = curl_exec($chAuth);
    $authData = json_decode($authResponse);
    curl_close($chAuth);

    if (!isset($authData->access_token)) {
        http_response_code(401);
        echo json_encode(["error" => "Falha Auth", "detalhes" => $authData]);
        exit;
    }

    // 2. Buscar a lista de empresas no Sandbox
    $apiUrl = "https://api.sandbox.nuvemfiscal.com.br/empresas";
    $chEmp = curl_init($apiUrl);
    curl_setopt($chEmp, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($chEmp, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($chEmp, CURLOPT_HTTPHEADER, [
        "Authorization: Bearer " . $authData->access_token
    ]);
    
    $resposta = curl_exec($chEmp);
    $httpCode = curl_getinfo($chEmp, CURLINFO_HTTP_CODE);
    curl_close($chEmp);

    http_response_code($httpCode);
    echo $resposta;

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["error" => $e->getMessage()]);
}