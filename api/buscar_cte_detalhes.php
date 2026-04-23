<?php
/**
 * API para buscar detalhes completos de um CT-e na Nuvem Fiscal
 */
ob_start();
require_once __DIR__ . '/../helpers/session_check.php';
ob_clean();
header('Content-Type: application/json; charset=utf-8');

$config       = require __DIR__ . '/../config/config.php';
$clientId     = $config['client_id'];
$clientSecret = $config['client_secret'];

$id = $_GET['id'] ?? '';

if (!$id) {
    http_response_code(400);
    echo json_encode(['error' => 'ID do CT-e é obrigatório.']);
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

    // 2. Buscar CT-e
    // Tentamos buscar o corpo detalhado (XML parseado) para ter acesso a todos os campos
    $ch = curl_init("https://api.sandbox.nuvemfiscal.com.br/cte/{$id}");
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER     => ["Authorization: Bearer " . $authData->access_token]
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

    $cte = json_decode($resp, true);

    // 3. Tentar pegar os detalhes do documento (infCte)
    // Se não estiver no primeiro nível, buscamos no /body
    if (!isset($cte['infCte']) || empty($cte['infCte'])) {
        $chBody = curl_init("https://api.sandbox.nuvemfiscal.com.br/cte/{$id}/body");
        curl_setopt_array($chBody, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER     => ["Authorization: Bearer " . $authData->access_token]
        ]);
        if (file_exists($cafile)) curl_setopt($chBody, CURLOPT_CAINFO, $cafile);
        $bodyResp = curl_exec($chBody);
        curl_close($chBody);
        
        $bodyData = json_decode($bodyResp, true);
        if (isset($bodyData['infCte'])) $cte['infCte'] = $bodyData['infCte'];
        elseif (isset($bodyData['CTe']['infCte'])) $cte['infCte'] = $bodyData['CTe']['infCte'];
    }

    echo json_encode($cte);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
