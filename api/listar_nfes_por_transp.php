<?php
ob_start();
require_once __DIR__ . '/../helpers/session_check.php';
ob_clean();
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

$transpCnpj = isset($_GET['transp_cnpj']) ? preg_replace('/\D/', '', $_GET['transp_cnpj']) : '';

if (!$transpCnpj) {
    echo json_encode(['data' => []]);
    exit;
}

$historicoArq = __DIR__ . '/../data/historico_nfes.json';
$data = [];

if (file_exists($historicoArq)) {
    $historico = json_decode(file_get_contents($historicoArq), true) ?? [];
    foreach ($historico as $h) {
        if ($h['transp_cnpj'] === $transpCnpj) {
            $data[] = $h;
        }
    }
}

// Inverter para mostrar os mais recentes primeiro
$data = array_reverse($data);

echo json_encode(['data' => $data]);
