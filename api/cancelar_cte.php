<?php
ob_start();
require_once __DIR__ . '/../helpers/session_check.php';
ob_clean();
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-CSRF-Token');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); echo json_encode(['error' => 'Método não permitido.']); exit; }

$csrfHeader = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
if (empty($csrfHeader) || $csrfHeader !== ($_SESSION['csrf_token'] ?? '')) {
    http_response_code(403);
    echo json_encode(['error' => 'CSRF token inválido ou ausente.']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true) ?? [];

$id = trim(preg_replace('/[^a-zA-Z0-9_\-]/', '', $data['id'] ?? ''));
if (empty($id)) { http_response_code(400); echo json_encode(['error' => 'ID do CT-e é obrigatório.']); exit; }

$justificativa = trim((string)($data['justificativa'] ?? ''));
if (strlen($justificativa) < 15) {
    http_response_code(400);
    echo json_encode(['error' => 'Justificativa deve ter no mínimo 15 caracteres.', 'current_length' => strlen($justificativa)]);
    exit;
}
if (strlen($justificativa) > 255) {
    http_response_code(400);
    echo json_encode(['error' => 'Justificativa não pode exceder 255 caracteres.']);
    exit;
}

try {
    require_once __DIR__ . '/auth_nuvem.php';
    $response = nuvemFiscalRequest('POST', "/cte/{$id}/cancelamento", ['justificativa' => $justificativa]);

    $httpCode = $response['status'];
    $body     = $response['body'];

    if ($httpCode === 200 || $httpCode === 201) {
        http_response_code(200);
        echo json_encode(['success' => true, 'message' => 'CT-e cancelado com sucesso.', 'data' => $body]);
    } else {
        http_response_code($httpCode ?: 500);
        echo json_encode(['error' => 'Erro ao cancelar CT-e (HTTP ' . $httpCode . ').', 'details' => $body]);
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
