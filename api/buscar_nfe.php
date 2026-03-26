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

$chave = isset($_GET['chave']) ? preg_replace('/\D/', '', $_GET['chave']) : '';
$idParam = isset($_GET['id']) ? preg_replace('/[^a-zA-Z0-9_\-]/', '', $_GET['id']) : '';

if (strlen($chave) !== 44 && !$idParam) {
    http_response_code(400);
    echo json_encode(['error' => 'Parâmetro "chave" (44 dígitos) ou "id" é obrigatório.']);
    exit;
}

$cnpj = strlen($chave) === 44 ? substr($chave, 6, 14) : '';

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

    $id = $idParam;

    // Se temos chave mas não id, busca por chave primeiro
    if (!$id && strlen($chave) === 44) {
        $params = http_build_query([
            'cpf_cnpj'  => $cnpj,
            'ambiente'  => 'homologacao',
            'chave'     => $chave,
            '$top'      => 1,
        ]);

        $ch = curl_init("https://api.sandbox.nuvemfiscal.com.br/nfe?{$params}");
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
            CURLOPT_HTTPHEADER     => ["Authorization: Bearer " . $authData->access_token]
        ]);
        // SSL certificate fallback
        $cafile = '/var/www/html/certs/cacert.pem';
        if (file_exists($cafile)) {
            curl_setopt($ch, CURLOPT_CAINFO, $cafile);
        } else {
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
            curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 0);
        }
        $resp     = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        $body = json_decode($resp, true);

        if ($httpCode !== 200 || empty($body['data'])) {
            http_response_code(404);
            echo json_encode(['error' => 'Nota não encontrada para esta chave de acesso']);
            exit;
        }

        $nota = $body['data'][0];
        $id = $nota['id'];
    }

    if (!$id) {
        http_response_code(400);
        echo json_encode(['error' => 'Não foi possível determinar o ID da nota.']);
        exit;
    }
    $chJson = curl_init("https://api.sandbox.nuvemfiscal.com.br/nfe/{$id}");
    curl_setopt_array($chJson, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
        CURLOPT_HTTPHEADER     => ["Authorization: Bearer " . $authData->access_token]
    ]);
    // SSL certificate fallback
    $cafile = __DIR__ . '/../certs/cacert.pem';
    if (file_exists($cafile)) {
        curl_setopt($chJson, CURLOPT_CAINFO, $cafile);
    } else {
        curl_setopt($chJson, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($chJson, CURLOPT_SSL_VERIFYHOST, 0);
    }
    $jsonNota = json_decode(curl_exec($chJson), true);
    curl_close($chJson);

    // 4. Busca o body (XML parseado) para obter infNFe com det, dest, emit etc.
    $chBody = curl_init("https://api.sandbox.nuvemfiscal.com.br/nfe/{$id}/body");
    curl_setopt_array($chBody, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
        CURLOPT_HTTPHEADER     => ["Authorization: Bearer " . $authData->access_token]
    ]);
    // SSL certificate fallback
    $cafile = __DIR__ . '/../certs/cacert.pem';
    if (file_exists($cafile)) {
        curl_setopt($chBody, CURLOPT_CAINFO, $cafile);
    } else {
        curl_setopt($chBody, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($chBody, CURLOPT_SSL_VERIFYHOST, 0);
    }
    $bodyResp = curl_exec($chBody);
    $bodyCode = curl_getinfo($chBody, CURLINFO_HTTP_CODE);
    curl_close($chBody);

    $result = $jsonNota ?: $nota;

    // Verifica se o próprio /nfe/{id} já traz infNFe inline
    if (isset($result['infNFe'])) {
        // Já temos — nada a fazer
    } elseif (isset($result['body']['infNFe'])) {
        $result['infNFe'] = $result['body']['infNFe'];
    } elseif (isset($result['body']['NFe']['infNFe'])) {
        $result['infNFe'] = $result['body']['NFe']['infNFe'];
    } elseif (isset($result['documento']['infNFe'])) {
        $result['infNFe'] = $result['documento']['infNFe'];
    }

    // Tenta /body (XML parseado) para obter infNFe com det, dest, emit etc.
    if (!isset($result['infNFe']) && $bodyCode === 200) {
        $bodyData = json_decode($bodyResp, true);
        if ($bodyData) {
            if (isset($bodyData['NFe']['infNFe'])) {
                $result['infNFe'] = $bodyData['NFe']['infNFe'];
            } elseif (isset($bodyData['infNFe'])) {
                $result['infNFe'] = $bodyData['infNFe'];
            }
        }
    }

    // Se /body não trouxe infNFe, tenta /xml e parseia
    if (!isset($result['infNFe'])) {
        $chXml = curl_init("https://api.sandbox.nuvemfiscal.com.br/nfe/{$id}/xml");
        curl_setopt_array($chXml, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
            CURLOPT_HTTPHEADER     => ["Authorization: Bearer " . $authData->access_token]
        ]);
        // SSL certificate fallback
        $cafile = '/var/www/html/certs/cacert.pem';
        if (file_exists($cafile)) {
            curl_setopt($chXml, CURLOPT_CAINFO, $cafile);
        } else {
            curl_setopt($chXml, CURLOPT_SSL_VERIFYPEER, false);
            curl_setopt($chXml, CURLOPT_SSL_VERIFYHOST, 0);
        }
        $xmlResp = curl_exec($chXml);
        $xmlCode = curl_getinfo($chXml, CURLINFO_HTTP_CODE);
        curl_close($chXml);

        if ($xmlCode === 200 && $xmlResp) {
            libxml_use_internal_errors(true);
            $xml = simplexml_load_string($xmlResp);
            if ($xml) {
                $jsonStr = json_encode($xml);
                $arr = json_decode($jsonStr, true);
                if (isset($arr['NFe']['infNFe'])) {
                    $result['infNFe'] = $arr['NFe']['infNFe'];
                } elseif (isset($arr['infNFe'])) {
                    $result['infNFe'] = $arr['infNFe'];
                }
            }
        }
    }

    // Último recurso: reconstrói infNFe a partir dos campos planos da API
    if (!isset($result['infNFe'])) {
        $synth = ['ide' => [], 'emit' => [], 'dest' => [], 'det' => [], 'total' => []];

        // ide
        $synth['ide'] = [
            'serie'  => $result['serie'] ?? 1,
            'nNF'    => $result['numero'] ?? '',
            'finNFe' => '1',
        ];

        // emit — extrai CNPJ da chave
        if (!empty($chave) && strlen($chave) === 44) {
            $synth['emit']['CNPJ'] = substr($chave, 6, 14);
        }

        // dest — do campo "destinatario" da API
        $destApi = $result['destinatario'] ?? [];
        if ($destApi) {
            $cpfCnpjDest = preg_replace('/\D/', '', $destApi['cpf_cnpj'] ?? '');
            if (strlen($cpfCnpjDest) === 14) {
                $synth['dest']['CNPJ'] = $cpfCnpjDest;
            } elseif (strlen($cpfCnpjDest) === 11) {
                $synth['dest']['CPF'] = $cpfCnpjDest;
            }
            $synth['dest']['xNome'] = $destApi['nome'] ?? $destApi['razao_social'] ?? '';
            if (!empty($destApi['endereco'])) {
                $end = $destApi['endereco'];
                $synth['dest']['enderDest'] = [
                    'xLgr'   => $end['logradouro'] ?? '',
                    'nro'    => $end['numero'] ?? 'SN',
                    'xBairro'=> $end['bairro'] ?? '',
                    'cMun'   => $end['codigo_municipio'] ?? '',
                    'xMun'   => $end['municipio'] ?? '',
                    'UF'     => $end['uf'] ?? '',
                    'CEP'    => $end['cep'] ?? '',
                ];
            }
            $synth['dest']['indIEDest'] = $destApi['indicador_inscricao_estadual'] ?? 9;
        }

        // itens — do campo "itens" da API (se existir)
        $itensApi = $result['itens'] ?? $result['produtos'] ?? [];
        if (is_array($itensApi)) {
            foreach ($itensApi as $i => $item) {
                $synth['det'][] = [
                    'prod' => [
                        'xProd'  => $item['descricao'] ?? $item['xProd'] ?? 'Item ' . ($i+1),
                        'qCom'   => $item['quantidade'] ?? $item['qCom'] ?? 1,
                        'vUnCom' => $item['valor_unitario'] ?? $item['vUnCom'] ?? 0,
                        'CFOP'   => $item['cfop'] ?? $item['CFOP'] ?? '5102',
                    ]
                ];
            }
        }

        // total
        $synth['total']['ICMSTot'] = [
            'vProd' => $result['valor_total'] ?? 0,
            'vNF'   => $result['valor_total'] ?? 0,
        ];

        $result['infNFe'] = $synth;
        $result['_infNFeSynthetic'] = true;
    }

    echo json_encode($result);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
