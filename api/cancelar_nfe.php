<?php
/**
 * cancelar_nfe.php
 *
 * Endpoint para cancelamento de Notas Fiscais (NF-e/NFC-e) via API Nuvem Fiscal.
 *
 * Requisições: POST /api/cancelar_nfe.php
 * Parâmetros JSON:
 *   - id (string): ID da nota gerado pela Nuvem Fiscal
 *   - justificativa (string): Justificativa do cancelamento (mínimo 15 caracteres)
 *
 * Respostas:
 *   - 200/201: Sucesso
 *   - 400: Validação falhou (parâmetros inválidos)
 *   - 401: Autenticação falhou
 *   - 404: Nota não encontrada
 *   - 422: Erro de validação SEFAZ
 *   - 500: Erro interno do servidor
 */

ob_start();
require_once __DIR__ . '/../helpers/session_check.php';
ob_clean();

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-CSRF-Token');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Método não permitido. Use POST.']);
    exit;
}

// ============================================
// 1. VALIDAÇÃO CSRF TOKEN
// ============================================
$csrfHeader = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
if (empty($csrfHeader) || $csrfHeader !== ($_SESSION['csrf_token'] ?? '')) {
    http_response_code(403);
    echo json_encode(['error' => 'CSRF token inválido ou ausente.']);
    exit;
}

// ============================================
// 2. CARREGA CREDENCIAIS
// ============================================
$config = require __DIR__ . '/../config/config.php';

// ============================================
// 3. PARSE E VALIDAÇÃO DE ENTRADA
// ============================================
$jsonBody = file_get_contents('php://input');

if (json_decode($jsonBody) === null && json_last_error() !== JSON_ERROR_NONE) {
    http_response_code(400);
    echo json_encode(['error' => 'Formato de requisição inválido. JSON esperado.']);
    exit;
}

$data = json_decode($jsonBody, true) ?? [];

// Validar ID da nota
$id = $data['id'] ?? '';
$id = trim(preg_replace('/[^a-zA-Z0-9_\-]/', '', $id));

if (empty($id)) {
    http_response_code(400);
    echo json_encode(['error' => 'ID da nota é obrigatório e deve ser um valor válido.']);
    exit;
}

// Validar justificativa
$justificativa = $data['justificativa'] ?? '';
$justificativa = trim((string)$justificativa);

if (strlen($justificativa) < 15) {
    http_response_code(400);
    echo json_encode([
        'error' => 'Justificativa é obrigatória e deve ter no mínimo 15 caracteres.',
        'current_length' => strlen($justificativa)
    ]);
    exit;
}

// Máximo de caracteres (SEFAZ typically allows up to 255)
if (strlen($justificativa) > 255) {
    http_response_code(400);
    echo json_encode(['error' => 'Justificativa não pode exceder 255 caracteres.']);
    exit;
}

// ============================================
// 4. IMPORTA HELPER DE AUTENTICAÇÃO
// ============================================
try {
    require_once __DIR__ . '/auth_nuvem.php';
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Falha ao carregar módulo de autenticação.']);
    exit;
}

// ============================================
// 5. FAZ REQUISIÇÃO DE CANCELAMENTO
// ============================================
try {
    // Payload do cancelamento (compatível com NfePedidoCancelamento)
    $cancelamentoPayload = [
        'justificativa' => $justificativa
    ];

    // Faz a requisição POST ao endpoint de cancelamento
    $response = nuvemFiscalRequest('POST', "/nfe/{$id}/cancelamento", $cancelamentoPayload);

    $httpCode = $response['status'];
    $responseBody = $response['body'];

    // ============================================
    // 6. TRATA RESPOSTAS
    // ============================================

    // Sucesso (200/201)
    if ($httpCode === 200 || $httpCode === 201) {
        http_response_code(200);
        echo json_encode([
            'success' => true,
            'message' => 'Nota fiscal cancelada com sucesso.',
            'data' => $responseBody
        ]);
        exit;
    }

    // Nota não encontrada (404)
    if ($httpCode === 404) {
        http_response_code(404);
        echo json_encode([
            'error' => 'Nota fiscal não encontrada.',
            'id' => $id,
            'details' => $responseBody
        ]);
        exit;
    }

    // Erro de validação SEFAZ (422)
    if ($httpCode === 422) {
        http_response_code(422);
        echo json_encode([
            'error' => 'Erro de validação SEFAZ. Verifique os dados e tente novamente.',
            'details' => $responseBody
        ]);
        exit;
    }

    // Autenticação falhou (401)
    if ($httpCode === 401) {
        http_response_code(401);
        echo json_encode([
            'error' => 'Falha na autenticação. Verifique as credenciais.'
        ]);
        exit;
    }

    // Outros erros 4xx
    if ($httpCode >= 400 && $httpCode < 500) {
        http_response_code($httpCode);
        echo json_encode([
            'error' => 'Erro na requisição (HTTP ' . $httpCode . ').',
            'details' => $responseBody
        ]);
        exit;
    }

    // Outros erros 5xx
    if ($httpCode >= 500) {
        http_response_code(502);
        echo json_encode([
            'error' => 'Erro ao comunicar com a API Nuvem Fiscal.',
            'details' => $responseBody
        ]);
        exit;
    }

    // Status inesperado
    http_response_code(200);
    echo json_encode([
        'warning' => 'Resposta inesperada da API.',
        'status' => $httpCode,
        'data' => $responseBody
    ]);

} catch (RuntimeException $e) {
    error_log('[CancelarNfe] RuntimeException: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'error' => 'Erro ao processar cancelamento: ' . $e->getMessage()
    ]);
    exit;

} catch (Exception $e) {
    error_log('[CancelarNfe] Exception: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'error' => 'Erro interno do servidor.'
    ]);
    exit;
}
