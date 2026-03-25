<?php
// transmitir.php
require_once 'autoload_manual.php';

// Carrega as credenciais do arquivo externo
$config_api = require 'config.php';

$xml = file_get_contents('php://input');

if (!$xml) {
    http_response_code(400);
    die(json_encode(['error' => 'XML não recebido']));
}

try {
    // 1. Autenticação OAuth2 (Sandbox)
    $ch = curl_init("{$config_api['api_base']}/oauth/token");
    curl_setopt($ch, CURLOPT_POST, 1);
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query([
        'grant_type'    => 'client_credentials',
        'client_id'     => $config_api['client_id'],
        'client_secret' => $config_api['client_secret'],
        'scope'         => 'nfe'
    ]));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    $auth = json_decode(curl_exec($ch), true);
    curl_close($ch);

    if (!isset($auth['access_token'])) {
        throw new Exception("Falha na autenticação: Verifique o Client ID/Secret.");
    }

    // 2. Transmissão da NF-e
    $ch = curl_init("{$config_api['api_base']}/nfe");
    curl_setopt($ch, CURLOPT_POST, 1);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $xml);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        "Authorization: Bearer " . $auth['access_token'],
        "Content-Type: application/xml"
    ]);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    
    $resposta = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    http_response_code($http_code);
    header('Content-Type: application/json');
    echo $resposta;

} catch (Exception $e) {
    echo json_encode(['error' => ['message' => $e->getMessage()]]);
}