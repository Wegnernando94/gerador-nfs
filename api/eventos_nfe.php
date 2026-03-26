<?php
/**
 * eventos_nfe.php
 * Retorna o histórico de eventos de uma NF-e pelo ID.
 * A rejeição fica em nota.autorizacao (campo retornado pelo GET /nfe/{id}).
 */
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/auth_nuvem.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Method Not Allowed']);
    exit;
}

$id = isset($_GET['id']) ? preg_replace('/[^a-zA-Z0-9_\-]/', '', $_GET['id']) : '';
if (!$id) {
    http_response_code(400);
    echo json_encode(['error' => 'Parâmetro "id" é obrigatório.']);
    exit;
}

try {
    // GET /nfe/{id} — contém nota.autorizacao com codigo_status e motivo_status
    $notaResult = nuvemFiscalRequest('GET', '/nfe/' . $id);
    $nota = $notaResult['body'] ?? [];

    $eventos = [];

    // Extrai evento de autorização/rejeição do campo "autorizacao"
    $aut = $nota['autorizacao'] ?? null;
    if ($aut) {
        $eventos[] = [
            'data_evento' => $aut['data_evento'] ?? $aut['data_recebimento'] ?? ($nota['data_emissao'] ?? null),
            'tipo'        => $aut['status'] ?? ($nota['status'] ?? 'desconhecido'),
            'sefaz'       => [
                'cStat'   => (string) ($aut['codigo_status'] ?? ''),
                'xMotivo' => $aut['motivo_status'] ?? '',
                'nProt'   => $aut['numero_protocolo'] ?? null,
            ],
        ];
    }

    // Tenta também listar eventos reais via /nfe/eventos (best-effort)
    $chave = $nota['chave'] ?? '';
    if (strlen($chave) === 44) {
        $cnpjEmit = substr($chave, 6, 14);
        try {
            $evResult = nuvemFiscalRequest('GET', '/nfe/eventos?cpf_cnpj=' . $cnpjEmit . '&top=50');
            if (($evResult['status'] === 200) && !empty($evResult['body']['data'])) {
                foreach ($evResult['body']['data'] as $ev) {
                    $evChave = $ev['chave_acesso'] ?? $ev['chave'] ?? '';
                    $evNfeId = $ev['nfe_id'] ?? $ev['id_nfe'] ?? null;
                    if ($evNfeId === $id || $evChave === $chave) {
                        $eventos[] = $ev;
                    }
                }
            }
        } catch (RuntimeException $e) {
            // Não-fatal: ignora falha ao listar eventos
        }
    }

    echo json_encode(['data' => $eventos]);

} catch (RuntimeException $e) {
    http_response_code(502);
    echo json_encode(['error' => 'Gateway error: ' . $e->getMessage()]);
}
