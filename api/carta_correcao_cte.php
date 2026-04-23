<?php
ob_start();
require_once __DIR__ . '/../helpers/session_check.php';
ob_clean();
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-CSRF-Token');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

try {
    require_once __DIR__ . '/auth_nuvem.php';

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $id = trim(preg_replace('/[^a-zA-Z0-9_\-]/', '', $_GET['id'] ?? ''));
        if (empty($id)) { http_response_code(400); echo json_encode(['error' => 'ID é obrigatório.']); exit; }

        $response = nuvemFiscalRequest('GET', "/cte/{$id}/carta-correcao");
        http_response_code($response['status']);
        echo json_encode($response['body']);
        exit;
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $csrfHeader = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
        if (empty($csrfHeader) || $csrfHeader !== ($_SESSION['csrf_token'] ?? '')) {
            http_response_code(403); echo json_encode(['error' => 'CSRF token inválido.']); exit;
        }

        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $id   = trim(preg_replace('/[^a-zA-Z0-9_\-]/', '', $data['id'] ?? ''));
        if (empty($id)) { http_response_code(400); echo json_encode(['error' => 'ID é obrigatório.']); exit; }

        $descEvento = trim((string)($data['descEvento'] ?? ''));
        if (strlen($descEvento) < 15) {
            http_response_code(400);
            echo json_encode(['error' => 'Descrição da correção deve ter no mínimo 15 caracteres.']);
            exit;
        }
        if (strlen($descEvento) > 1000) {
            http_response_code(400);
            echo json_encode(['error' => 'Descrição não pode exceder 1000 caracteres.']);
            exit;
        }

        $nSeqEvento = max(1, (int)($data['nSeqEvento'] ?? 1));

        $payload = [
            'descEvento' => $descEvento,
            'nSeqEvento' => $nSeqEvento,
        ];

        $response = nuvemFiscalRequest('POST', "/cte/{$id}/carta-correcao", $payload);
        http_response_code($response['status']);
        echo json_encode($response['body']);
        exit;
    }

    http_response_code(405);
    echo json_encode(['error' => 'Método não permitido.']);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
