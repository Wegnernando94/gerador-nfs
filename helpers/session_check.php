<?php
/**
 * session_check.php — OWASP A01/A02/A07/A09
 * Included at the top of every API endpoint.
 */

// ── Error suppression (A05) ──────────────────────────────
ini_set('display_errors', '0');
ini_set('display_startup_errors', '0');
error_reporting(E_ALL);
ini_set('log_errors', '1');

ob_start();

// ── Secure session configuration (A07) ──────────────────
if (session_status() === PHP_SESSION_NONE) {
    ini_set('session.cookie_httponly', '1');
    ini_set('session.cookie_samesite', 'Strict');
    ini_set('session.use_strict_mode', '1');
    ini_set('session.gc_maxlifetime', '1800');
    // Uncomment in production with HTTPS:
    // ini_set('session.cookie_secure', '1');
    session_start();
}

// Regenerate session ID periodically to prevent fixation (A07)
if (empty($_SESSION['_last_regen']) || (time() - $_SESSION['_last_regen']) > 300) {
    session_regenerate_id(true);
    $_SESSION['_last_regen'] = time();
}

// ── Security headers (A05) ───────────────────────────────
if (!headers_sent()) {
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    header('X-XSS-Protection: 1; mode=block');
    header('Referrer-Policy: strict-origin-when-cross-origin');
    header_remove('X-Powered-By');
}

// ── Rate limiting — session-based (A04) ─────────────────
$_now    = time();
$_window = 60;
$_limit  = 60;

if (empty($_SESSION['rl_window_start'])) {
    $_SESSION['rl_count']        = 0;
    $_SESSION['rl_window_start'] = $_now;
}

if ($_now - $_SESSION['rl_window_start'] > $_window) {
    $_SESSION['rl_count']        = 0;
    $_SESSION['rl_window_start'] = $_now;
}

$_SESSION['rl_count']++;

if ($_SESSION['rl_count'] > $_limit) {
    http_response_code(429);
    header('Content-Type: application/json');
    header('Retry-After: ' . ($_window - ($_now - $_SESSION['rl_window_start'])));
    echo json_encode(['error' => 'Muitas requisições. Aguarde um momento.']);
    exit;
}

// ── CSRF protection (A01) ────────────────────────────────
// Generate token on first request
if (empty($_SESSION['csrf_token'])) {
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
}

// Expose token to GET requests (used by frontend to embed in POST headers)
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    header('X-CSRF-Token: ' . $_SESSION['csrf_token']);
}

// Validate token on state-changing requests
if (in_array($_SERVER['REQUEST_METHOD'], ['POST', 'PUT', 'PATCH', 'DELETE'], true)) {
    $receivedToken = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (!hash_equals($_SESSION['csrf_token'], $receivedToken)) {
        http_response_code(403);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'CSRF token inválido ou ausente.']);
        exit;
    }
}

unset($_now, $_window, $_limit);
