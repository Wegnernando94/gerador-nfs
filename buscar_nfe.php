<?php
ob_start();
require_once 'session_check.php';
ob_clean();
header('Content-Type: application/json');

$config       = require 'config.php';
$clientId     = $config['client_id'];
$clientSecret = $config['client_secret'];

$chave = isset($_GET['chave']) ? preg_replace('/\D/', '', $_GET['chave']) : '';

if (strlen($chave) !== 44) {
    http_response_code(400);
    echo json_encode(['error' => 'Chave de acesso deve ter exatamente 44 dígitos']);
    exit;
}

// Extrai CNPJ do emitente da própria chave (posições 6–19)
$cnpj = substr($chave, 6, 14);

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
        http_response_code(401);
        echo json_encode(['error' => 'Falha na autenticação']);
        exit;
    }

    // 2. Busca por chave de acesso
    $params = http_build_query([
        'cpf_cnpj'  => $cnpj,
        'ambiente'  => 'homologacao',
        'chave'     => $chave,
        '$top'      => 1,
    ]);

    $ch = curl_init("https://api.sandbox.nuvemfiscal.com.br/nfe?{$params}");
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_HTTPHEADER     => ["Authorization: Bearer " . $authData->access_token]
    ]);
    $resp     = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $body = json_decode($resp, true);

    if ($httpCode !== 200 || empty($body['data'])) {
        http_response_code(404);
        echo json_encode(['error' => 'Nota não encontrada para esta chave de acesso']);
        exit;
    }

    // Retorna a primeira nota encontrada + os itens do JSON original se disponível
    $nota = $body['data'][0];

    // 3. Busca o JSON completo da NF-e
    $id = $nota['id'];
    $chJson = curl_init("https://api.sandbox.nuvemfiscal.com.br/nfe/{$id}");
    curl_setopt_array($chJson, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_HTTPHEADER     => ["Authorization: Bearer " . $authData->access_token]
    ]);
    $jsonNota = json_decode(curl_exec($chJson), true);
    curl_close($chJson);

    // 4. Busca o body (XML parseado) para obter infNFe com det, dest, emit etc.
    $chBody = curl_init("https://api.sandbox.nuvemfiscal.com.br/nfe/{$id}/body");
    curl_setopt_array($chBody, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_HTTPHEADER     => ["Authorization: Bearer " . $authData->access_token]
    ]);
    $bodyResp = curl_exec($chBody);
    $bodyCode = curl_getinfo($chBody, CURLINFO_HTTP_CODE);
    curl_close($chBody);

    $result = $jsonNota ?: $nota;

    // Tenta /body (JSON parseado do XML)
    if ($bodyCode === 200) {
        $bodyData = json_decode($bodyResp, true);
        if ($bodyData) {
            // A API pode retornar como NFe.infNFe ou direto infNFe
            if (isset($bodyData['NFe']['infNFe'])) {
                $result['infNFe'] = $bodyData['NFe']['infNFe'];
            } elseif (isset($bodyData['infNFe'])) {
                $result['infNFe'] = $bodyData['infNFe'];
            } else {
                $result['_bodyDebug'] = $bodyData;
            }
        }
    }

    // Se /body não trouxe infNFe, tenta /xml e parseia
    if (!isset($result['infNFe'])) {
        $chXml = curl_init("https://api.sandbox.nuvemfiscal.com.br/nfe/{$id}/xml");
        curl_setopt_array($chXml, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_HTTPHEADER     => ["Authorization: Bearer " . $authData->access_token]
        ]);
        $xmlResp = curl_exec($chXml);
        $xmlCode = curl_getinfo($chXml, CURLINFO_HTTP_CODE);
        curl_close($chXml);

        if ($xmlCode === 200 && $xmlResp) {
            libxml_use_internal_errors(true);
            $xml = simplexml_load_string($xmlResp);
            if ($xml) {
                // Converte XML para array
                $jsonStr = json_encode($xml);
                $arr = json_decode($jsonStr, true);
                // Procura infNFe em diferentes níveis
                if (isset($arr['NFe']['infNFe'])) {
                    $result['infNFe'] = $arr['NFe']['infNFe'];
                } elseif (isset($arr['infNFe'])) {
                    $result['infNFe'] = $arr['infNFe'];
                } else {
                    $result['_xmlDebug'] = array_keys($arr);
                }
            }
        }
        $result['_bodyHttpCode'] = $bodyCode;
        $result['_xmlHttpCode'] = $xmlCode ?? null;
    }

    echo json_encode($result);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
