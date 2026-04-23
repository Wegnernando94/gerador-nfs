<?php
require_once __DIR__ . '/../helpers/session_check.php';
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'GET')     { http_response_code(405); exit; }

$id   = isset($_GET['id'])   ? preg_replace('/[^a-zA-Z0-9_\-]/', '', $_GET['id'])   : '';
$tipo = isset($_GET['tipo']) ? preg_replace('/[^a-z_]/', '', $_GET['tipo'])          : 'xml';

if (!$id) { http_response_code(400); echo 'ID do CT-e não informado.'; exit; }

$pathMap = [
    'xml'              => ["/cte/{$id}/xml",                   'application/xml',     "CTe_{$id}.xml"],
    'xml_conhecimento' => ["/cte/{$id}/xml/conhecimento",      'application/xml',     "CTe_conhecimento_{$id}.xml"],
    'xml_protocolo'    => ["/cte/{$id}/xml/protocolo",         'application/xml',     "CTe_protocolo_{$id}.xml"],
    'pdf'              => ["/cte/{$id}/pdf",                   'application/pdf',     "DACTE_{$id}.pdf"],
    'cancelamento_xml' => ["/cte/{$id}/cancelamento/xml",      'application/xml',     "CTe_cancelamento_{$id}.xml"],
    'cancelamento_pdf' => ["/cte/{$id}/cancelamento/pdf",      'application/pdf',     "CTe_cancelamento_{$id}.pdf"],
    'correcao_xml'     => ["/cte/{$id}/carta-correcao/xml",    'application/xml',     "CTe_correcao_{$id}.xml"],
    'correcao_pdf'     => ["/cte/{$id}/carta-correcao/pdf",    'application/pdf',     "CTe_correcao_{$id}.pdf"],
];

if (!isset($pathMap[$tipo])) { http_response_code(400); echo 'Tipo de download inválido.'; exit; }

[$apiPath, $contentType, $filename] = $pathMap[$tipo];

try {
    require_once __DIR__ . '/auth_nuvem.php';
    $token = nuvemFiscalToken();

    $ch = curl_init(NUVEM_API_BASE . $apiPath);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
        CURLOPT_TIMEOUT        => 60,
        CURLOPT_HTTPHEADER     => ['Authorization: Bearer ' . $token],
    ]);
    if (file_exists(NUVEM_CAINFO)) curl_setopt($ch, CURLOPT_CAINFO, NUVEM_CAINFO);
    else { curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false); curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 0); }

    $content  = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200) {
        http_response_code($httpCode);
        echo "Arquivo não disponível (HTTP {$httpCode}).";
        exit;
    }

    header('Content-Type: ' . $contentType);
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    header('Content-Length: ' . strlen($content));
    echo $content;

} catch (Exception $e) {
    http_response_code(500);
    echo $e->getMessage();
}
