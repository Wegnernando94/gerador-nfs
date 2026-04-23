<?php
/**
 * download_xml_cancelamento.php
 *
 * Baixa o XML do evento de cancelamento de uma NF-e via API Nuvem Fiscal.
 *
 * Requisição: GET /api/download_xml_cancelamento.php?id={id_da_nota}
 * Retorno: arquivo XML para download
 */

ob_start();
require_once __DIR__ . '/../helpers/session_check.php';
ob_clean();

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-CSRF-Token');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    header('Allow: GET');
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Método não permitido. Use GET.']);
    exit;
}

$id = isset($_GET['id']) ? trim(preg_replace('/[^a-zA-Z0-9_\-]/', '', $_GET['id'])) : '';
if (empty($id)) {
    http_response_code(400);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'ID da NF-e não informado.']);
    exit;
}

try {
    require_once __DIR__ . '/auth_nuvem.php';

    $token = nuvemFiscalToken();

    $url = NUVEM_API_BASE . "/nfe/{$id}/cancelamento/xml";

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER     => [
            'Authorization: Bearer ' . $token,
            'Accept: application/xml, text/xml, */*',
        ],
        CURLOPT_TIMEOUT        => 60,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
    ]);

    $cafile = NUVEM_CAINFO;
    if (file_exists($cafile)) {
        curl_setopt($ch, CURLOPT_CAINFO, $cafile);
    } else {
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 0);
    }

    $xml      = curl_exec($ch);
    $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($curlError) {
        error_log('[DownloadXmlCancelamento] cURL error: ' . $curlError);
        http_response_code(500);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'Erro de conexão com a API.']);
        exit;
    }

    if ($httpCode === 404) {
        http_response_code(404);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'XML de cancelamento não encontrado. A nota pode não ter sido cancelada ainda.']);
        exit;
    }

    if ($httpCode !== 200) {
        error_log("[DownloadXmlCancelamento] HTTP {$httpCode} para id={$id}");
        http_response_code($httpCode);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'XML não disponível (HTTP ' . $httpCode . ').']);
        exit;
    }

    header('Content-Type: application/xml; charset=utf-8');
    header('Content-Disposition: attachment; filename="Cancelamento_NFe_' . $id . '.xml"');
    header('Content-Length: ' . strlen($xml));
    echo $xml;

} catch (RuntimeException $e) {
    error_log('[DownloadXmlCancelamento] RuntimeException: ' . $e->getMessage());
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Erro ao processar download: ' . $e->getMessage()]);
    exit;
} catch (Exception $e) {
    error_log('[DownloadXmlCancelamento] Exception: ' . $e->getMessage());
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Erro interno do servidor.']);
    exit;
}
