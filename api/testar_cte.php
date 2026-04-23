<?php
/**
 * API para testar CT-e sem enviar para a SEFAZ
 * Gera o payload completo e retorna para visualização
 */
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

$jsonBody = file_get_contents('php://input');
$data = json_decode($jsonBody, true);

if (json_last_error() !== JSON_ERROR_NONE) {
    http_response_code(400);
    echo json_encode(['error' => 'Formato inválido. JSON esperado.']);
    exit;
}

// Validar payload básico
$errors = [];

if (empty($data['infCte']['ide']['mod'])) {
    $errors[] = 'Modelo do CT-e não informado';
}
if (empty($data['infCte']['ide']['serie'])) {
    $errors[] = 'Série não informada';
}
if (empty($data['infCte']['ide']['nCT'])) {
    $errors[] = 'Número do CT-e não informado';
}
if (empty($data['infCte']['emit']['CNPJ'])) {
    $errors[] = 'CNPJ do emitente não informado';
}
if (empty($data['infCte']['rem']['xNome'])) {
    $errors[] = 'Nome do remetente não informado';
}
if (empty($data['infCte']['dest']['xNome'])) {
    $errors[] = 'Nome do destinatário não informado';
}

if (!empty($errors)) {
    http_response_code(400);
    echo json_encode([
        'error' => 'Payload inválido',
        'mensagens' => array_map(function($e) { return ['descricao' => $e]; }, $errors)
    ]);
    exit;
}

// Simular resposta de sucesso (sem enviar para SEFAZ)
$modelo = $data['infCte']['ide']['mod'];
$serie = $data['infCte']['ide']['serie'];
$nCT = $data['infCte']['ide']['nCT'];
$valor = $data['infCte']['vPrest']['vTPrest'] ?? 0;

// Gerar chave de acesso simulada
$uf = $data['infCte']['ide']['cUF'] ?? '35';
$ano = date('y');
$mes = date('m');
$cpf = substr($data['infCte']['emit']['CNPJ'], 0, 8);
$modeloStr = str_pad($modelo, 2, '0', STR_PAD_LEFT);
$serieStr = str_pad($serie, 3, '0', STR_PAD_LEFT);
$nCTStr = str_pad($nCT, 9, '0', STR_PAD_LEFT);
$codigo = rand(100000, 999999);
$chaveAcesso = $uf . $ano . $mes . $cpf . $modeloStr . $serieStr . $nCTStr . '1' . $codigo;

// Retornar resposta simulada
http_response_code(200);
echo json_encode([
    'id' => 'teste_' . time() . '_' . rand(1000, 9999),
    'status' => 'simulado',
    'mensagem' => 'CT-e de teste gerado com sucesso (não enviado para SEFAZ)',
    'ambiente' => $data['ambiente'] ?? 'homologacao',
    'chave_de_acesso' => $chaveAcesso,
    'numero' => $nCT,
    'serie' => $serie,
    'modelo' => $modelo,
    'valor_total' => $valor,
    'data_emissao' => date('c'),
    'payload_recebido' => $data,
    'info' => 'Este é um CT-e de TESTE. Não foi enviado para a SEFAZ. Use para validar o payload.'
], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);