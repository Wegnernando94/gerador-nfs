<?php
require_once 'session_check.php';
$config = require 'config.php';
$clientId     = $config['client_id'];
$clientSecret = $config['client_secret'];

$id = isset($_GET['id']) ? preg_replace('/[^a-zA-Z0-9_\-]/', '', $_GET['id']) : '';
if (!$id) { http_response_code(400); echo 'ID da NF-e não informado.'; exit; }

try {
    // 1. Autenticação
    $chAuth = curl_init("https://auth.nuvemfiscal.com.br/oauth/token");
    curl_setopt_array($chAuth, [
        CURLOPT_POST           => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_POSTFIELDS     => http_build_query(['grant_type' => 'client_credentials', 'scope' => 'nfe']),
        CURLOPT_HTTPHEADER     => [
            "Authorization: Basic " . base64_encode(trim($clientId) . ":" . trim($clientSecret)),
            "Content-Type: application/x-www-form-urlencoded"
        ]
    ]);
    $authData = json_decode(curl_exec($chAuth));
    curl_close($chAuth);

    if (!isset($authData->access_token)) {
        http_response_code(401); echo 'Falha na autenticação.'; exit;
    }

    // 2. Baixa o PDF do DANFE
    $chPdf = curl_init("https://api.sandbox.nuvemfiscal.com.br/nfe/{$id}/pdf");
    curl_setopt_array($chPdf, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_HTTPHEADER     => ["Authorization: Bearer " . $authData->access_token]
    ]);
    $pdf      = curl_exec($chPdf);
    $httpCode = curl_getinfo($chPdf, CURLINFO_HTTP_CODE);
    curl_close($chPdf);

    if ($httpCode !== 200) {
        http_response_code($httpCode); echo 'DANFE não disponível (status ' . $httpCode . ').'; exit;
    }

    header('Content-Type: application/pdf');
    header('Content-Disposition: inline; filename="DANFE_' . $id . '.pdf"');
    header('Content-Length: ' . strlen($pdf));
    echo $pdf;

} catch (Exception $e) {
    http_response_code(500); echo $e->getMessage();
}
