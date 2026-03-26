<?php
/**
 * upload_certificado.php
 * Proxy: PUT /empresas/{cpf_cnpj}/certificado  (upload)
 *        GET /empresas/{cpf_cnpj}/certificado  (status check)
 *
 * POST (multipart/form-data):
 *   $_POST['cpf_cnpj']  — CPF or CNPJ (formatting chars stripped automatically)
 *   $_POST['senha']     — certificate password
 *   $_FILES['certificado'] — the .pfx / .p12 certificate file
 *
 * GET:
 *   ?cpf_cnpj=...       — returns certificate status from Nuvem Fiscal
 */

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/auth_nuvem.php';

$method = strtoupper($_SERVER['REQUEST_METHOD']);

// -------------------------------------------------------------------------
// GET — certificate status
// -------------------------------------------------------------------------
if ($method === 'GET') {
    $cpfCnpjRaw = isset($_GET['cpf_cnpj']) ? $_GET['cpf_cnpj'] : '';
    $cpfCnpj    = preg_replace('/\D/', '', $cpfCnpjRaw);

    if ($cpfCnpj === '') {
        http_response_code(400);
        echo json_encode(['error' => 'Query parameter "cpf_cnpj" is required.']);
        exit;
    }

    try {
        $result = nuvemFiscalRequest('GET', '/empresas/' . $cpfCnpj . '/certificado');
    } catch (RuntimeException $e) {
        http_response_code(502);
        echo json_encode(['error' => 'Gateway error: ' . $e->getMessage()]);
        exit;
    }

    http_response_code($result['status']);
    echo json_encode($result['body']);
    exit;
}

// -------------------------------------------------------------------------
// POST — certificate upload
// -------------------------------------------------------------------------
if ($method === 'POST') {
    // Validate required POST fields
    $cpfCnpjRaw = isset($_POST['cpf_cnpj']) ? $_POST['cpf_cnpj'] : '';
    $cpfCnpj    = preg_replace('/\D/', '', $cpfCnpjRaw);

    if ($cpfCnpj === '') {
        http_response_code(400);
        echo json_encode(['error' => 'Field "cpf_cnpj" is required.']);
        exit;
    }

    $senha = isset($_POST['senha']) ? $_POST['senha'] : '';
    if ($senha === '') {
        http_response_code(400);
        echo json_encode(['error' => 'Field "senha" is required.']);
        exit;
    }

    if (empty($_FILES['certificado']) || $_FILES['certificado']['error'] !== UPLOAD_ERR_OK) {
        $uploadError = isset($_FILES['certificado']['error'])
            ? uploadErrorMessage($_FILES['certificado']['error'])
            : 'No file uploaded.';
        http_response_code(400);
        echo json_encode(['error' => 'Certificate file error: ' . $uploadError]);
        exit;
    }

    $fileTmpPath = $_FILES['certificado']['tmp_name'];
    $fileName    = $_FILES['certificado']['name'];

    // Build the PUT multipart/form-data request manually with cURL
    // (nuvemFiscalRequest handles JSON bodies; for multipart we need a custom call)
    try {
        $token = nuvemFiscalToken();
    } catch (RuntimeException $e) {
        http_response_code(502);
        echo json_encode(['error' => 'Authentication error: ' . $e->getMessage()]);
        exit;
    }

    $url = NUVEM_API_BASE . '/empresas/' . $cpfCnpj . '/certificado';

    // Nuvem Fiscal expects JSON with the certificate base64-encoded
    $certBase64 = base64_encode(file_get_contents($fileTmpPath));
    $jsonBody   = json_encode([
        'certificado' => $certBase64,
        'password'    => $senha,
    ]);

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST  => 'PUT',
        CURLOPT_POSTFIELDS     => $jsonBody,
        CURLOPT_HTTPHEADER     => [
            'Authorization: Bearer ' . $token,
            'Accept: application/json',
            'Content-Type: application/json',
            'Content-Length: ' . strlen($jsonBody),
        ],
        CURLOPT_TIMEOUT        => 120,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
        CURLOPT_CAINFO         => NUVEM_CAINFO,
    ]);

    $response  = curl_exec($ch);
    $httpCode  = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($response === false || $curlError) {
        http_response_code(502);
        echo json_encode(['error' => 'Gateway error during certificate upload: ' . $curlError]);
        exit;
    }

    $decoded = json_decode($response, true);
    if ($decoded === null && $response !== '' && $response !== 'null') {
        $decoded = ['raw_response' => $response];
    }
    if ($decoded === null) {
        $decoded = [];
    }

    http_response_code($httpCode);
    echo json_encode($decoded);
    exit;
}

// -------------------------------------------------------------------------
// Any other method
// -------------------------------------------------------------------------
http_response_code(405);
echo json_encode(['error' => 'Method Not Allowed. Use POST (upload) or GET (status).']);

// -------------------------------------------------------------------------
// Helper
// -------------------------------------------------------------------------

/**
 * Returns a human-readable message for a PHP file upload error code.
 */
function uploadErrorMessage(int $code): string
{
    $messages = [
        UPLOAD_ERR_INI_SIZE   => 'File exceeds upload_max_filesize directive in php.ini.',
        UPLOAD_ERR_FORM_SIZE  => 'File exceeds MAX_FILE_SIZE directive in the HTML form.',
        UPLOAD_ERR_PARTIAL    => 'File was only partially uploaded.',
        UPLOAD_ERR_NO_FILE    => 'No file was uploaded.',
        UPLOAD_ERR_NO_TMP_DIR => 'Missing temporary folder.',
        UPLOAD_ERR_CANT_WRITE => 'Failed to write file to disk.',
        UPLOAD_ERR_EXTENSION  => 'A PHP extension stopped the file upload.',
    ];
    return $messages[$code] ?? 'Unknown upload error (code ' . $code . ').';
}
