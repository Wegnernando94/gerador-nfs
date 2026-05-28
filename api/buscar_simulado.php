<?php
/**
 * API para buscar detalhes de um CT-e simulado localmente
 */
ob_start();
require_once __DIR__ . '/../helpers/session_check.php';
ob_clean();
header('Content-Type: application/json; charset=utf-8');

$id = $_GET['id'] ?? '';

if (!$id) {
    http_response_code(400);
    echo json_encode(['error' => 'ID é obrigatório.']);
    exit;
}

$file = __DIR__ . '/../data/ctes_simulados.json';
if (!file_exists($file)) {
    http_response_code(404);
    echo json_encode(['error' => 'Nenhum simulado encontrado.']);
    exit;
}

$simulados = json_decode(file_get_contents($file), true) ?: [];
$encontrado = null;

foreach ($simulados as $s) {
    if ($s['id'] === $id) {
        $encontrado = $s;
        break;
    }
}

if (!$encontrado) {
    http_response_code(404);
    echo json_encode(['error' => 'CT-e simulado não encontrado.']);
    exit;
}

echo json_encode($encontrado);
