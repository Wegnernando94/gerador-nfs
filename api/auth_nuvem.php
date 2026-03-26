<?php
/**
 * auth_nuvem.php
 * Shared helper for Nuvem Fiscal API authentication and requests.
 * Include this file in other proxy scripts.
 */

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Carrega credenciais do config.php (não versionado)
$_nuvemCfg = require __DIR__ . '/../config/config.php';

define('NUVEM_CLIENT_ID',     $_nuvemCfg['client_id']);
define('NUVEM_CLIENT_SECRET', $_nuvemCfg['client_secret']);
define('NUVEM_AUTH_URL',      'https://auth.nuvemfiscal.com.br/oauth/token');
define('NUVEM_API_BASE',      $_nuvemCfg['api_base']);
define('NUVEM_TOKEN_TTL',     3500); // seconds (expires_in is typically 3600)

// CA bundle local (cacert.pem baixado de https://curl.se/ca/cacert.pem)
// Resolve "SSL certificate problem: unable to get local issuer certificate"
// em ambientes Windows onde o php.ini não tem curl.cainfo configurado.
// Path relativo ao __DIR__ para funcionar em qualquer ambiente
define('NUVEM_CAINFO', __DIR__ . '/../certs/cacert.pem');

unset($_nuvemCfg);

/**
 * Returns a valid OAuth2 access token, using the session as a cache.
 *
 * @return string The access token.
 * @throws RuntimeException if the token request fails.
 */
function nuvemFiscalToken(): string
{
    // Return cached token if still valid
    if (
        !empty($_SESSION['nuvem_token']) &&
        !empty($_SESSION['nuvem_token_expires_at']) &&
        time() < $_SESSION['nuvem_token_expires_at']
    ) {
        return $_SESSION['nuvem_token'];
    }

    $ch = curl_init(NUVEM_AUTH_URL);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => http_build_query([
            'grant_type'    => 'client_credentials',
            'client_id'     => NUVEM_CLIENT_ID,
            'client_secret' => NUVEM_CLIENT_SECRET,
            'scope'         => 'empresa nfe cep cnpj',
        ]),
        CURLOPT_HTTPHEADER     => [
            'Content-Type: application/x-www-form-urlencoded',
            'Accept: application/json',
        ],
        CURLOPT_TIMEOUT        => 30,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
    ]);

    // SSL certificate fallback
    $cafile = NUVEM_CAINFO;
    if (file_exists($cafile)) {
        curl_setopt($ch, CURLOPT_CAINFO, $cafile);
    } else {
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 0);
    }

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($response === false || $curlError) {
        $errMsg = 'cURL error during token request: ' . $curlError;
        error_log('[NuvemFiscal] ' . $errMsg);
        throw new RuntimeException($errMsg);
    }

    $data = json_decode($response, true);

    if ($httpCode !== 200 || empty($data['access_token'])) {
        $detail = isset($data['error_description']) ? $data['error_description'] : $response;
        throw new RuntimeException('Failed to obtain access token (HTTP ' . $httpCode . '): ' . $detail);
    }

    $_SESSION['nuvem_token']            = $data['access_token'];
    $_SESSION['nuvem_token_expires_at'] = time() + NUVEM_TOKEN_TTL;

    return $data['access_token'];
}

/**
 * Makes an authenticated cURL request to the Nuvem Fiscal API.
 *
 * @param string      $method       HTTP method (GET, POST, PUT, DELETE, etc.)
 * @param string      $path         API path, e.g. '/empresas' or '/cnpj/12345678000195'
 * @param mixed       $body         Request body (will be JSON-encoded for POST/PUT)
 * @param array       $extraHeaders Additional HTTP headers
 *
 * @return array{status: int, body: array} Associative array with 'status' (int) and 'body' (array).
 * @throws RuntimeException on cURL failure or token retrieval failure.
 */
function nuvemFiscalRequest(string $method, string $path, $body = null, array $extraHeaders = []): array
{
    $token = nuvemFiscalToken();

    $url    = NUVEM_API_BASE . $path;
    $method = strtoupper($method);

    $headers = array_merge([
        'Authorization: Bearer ' . $token,
        'Accept: application/json',
    ], $extraHeaders);

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST  => $method,
        CURLOPT_TIMEOUT        => 60,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
    ]);

    // SSL certificate fallback
    $cafile = NUVEM_CAINFO;
    if (file_exists($cafile)) {
        curl_setopt($ch, CURLOPT_CAINFO, $cafile);
    } else {
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 0);
    }

    if (in_array($method, ['POST', 'PUT', 'PATCH'], true) && $body !== null) {
        // JSON_UNESCAPED_UNICODE evita \uXXXX e preserva chars UTF-8 corretamente
        // JSON_INVALID_UTF8_SUBSTITUTE substitui bytes inválidos em vez de retornar false
        $jsonBody = json_encode($body, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
        if ($jsonBody === false) {
            error_log('[NuvemFiscal] json_encode failed for ' . $method . ' ' . $path . ': ' . json_last_error_msg());
            throw new RuntimeException('Falha ao codificar o corpo da requisição: ' . json_last_error_msg());
        }
        error_log('[NuvemFiscal] ' . $method . ' ' . $path . ' body=' . $jsonBody);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $jsonBody);
        $headers[] = 'Content-Type: application/json';
        $headers[] = 'Content-Length: ' . strlen($jsonBody);
    }

    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

    $response  = curl_exec($ch);
    $httpCode  = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($response === false || $curlError) {
        $errMsg = 'cURL error during API request to ' . $path . ': ' . $curlError;
        error_log('[NuvemFiscal] ' . $errMsg);
        throw new RuntimeException($errMsg);
    }

    // Log non-2xx responses para diagnosticar problemas
    if ($httpCode < 200 || $httpCode >= 300) {
        error_log('[NuvemFiscal] Non-2xx response for ' . $method . ' ' . $path . ': HTTP ' . $httpCode);
    }

    $decoded = json_decode($response, true);
    if ($decoded === null && $response !== '' && $response !== 'null') {
        // Response is not valid JSON; wrap it
        $decoded = ['raw_response' => $response];
    }
    if ($decoded === null) {
        $decoded = [];
    }

    return [
        'status' => $httpCode,
        'body'   => $decoded,
    ];
}
