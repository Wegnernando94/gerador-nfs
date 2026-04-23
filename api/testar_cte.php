<?php
/**
 * API para testar CT-e Localmente (Simulação Fiel ao Caso Real)
 * Gera um XML completo baseado no esquema SEFAZ 4.00 com todas as tags do exemplo
 */
ob_start();
require_once __DIR__ . '/../helpers/session_check.php';
ob_clean();
header('Content-Type: application/json; charset=utf-8');

$jsonBody = file_get_contents('php://input');
$data = json_decode($jsonBody, true);

if (!$data) {
    http_response_code(400);
    echo json_encode(['error' => 'Payload JSON é obrigatório.']);
    exit;
}

// Normalizar dados
$inf = $data['infCte'] ?? $data;
$ide = $inf['ide'] ?? [];
$emit = $inf['emit'] ?? [];
$rem = $inf['rem'] ?? [];
$dest = $inf['dest'] ?? [];
$vPrest = $inf['vPrest'] ?? [];
$imp = $inf['imp'] ?? [];
$norm = $inf['infCTeNorm'] ?? [];
$carga = $norm['infCarga'] ?? [];
$doc = $norm['infDoc'] ?? [];
$modal = $norm['infModal'] ?? [];

// 1. Gerar Chave de Acesso Simulado
$uf = $ide['cUF'] ?? '35';
$ano = date('y');
$mes = date('m');
$cnpjEmit = preg_replace('/\D/', '', $emit['CNPJ'] ?? '00000000000000');
$mod = str_pad($ide['mod'] ?? '57', 2, '0', STR_PAD_LEFT);
$serie = str_pad($ide['serie'] ?? '1', 3, '0', STR_PAD_LEFT);
$nCT = str_pad($ide['nCT'] ?? '1', 9, '0', STR_PAD_LEFT);
$codigo = str_pad($ide['cCT'] ?? rand(10000000, 99999999), 8, '0', STR_PAD_LEFT);
$tpEmis = $ide['tpEmis'] ?? '1';
$cDV = rand(0, 9);
$chave = $uf . $ano . $mes . str_pad($cnpjEmit, 14, '0', STR_PAD_LEFT) . $mod . $serie . $nCT . $tpEmis . $codigo . $cDV;

// 2. Construção do XML "Idêntico" ao exemplo
$xml = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n";
$xml .= "<cteProc xmlns=\"http://www.portalfiscal.inf.br/cte\" versao=\"4.00\">\n";
$xml .= "  <CTe xmlns=\"http://www.portalfiscal.inf.br/cte\">\n";
$xml .= "    <infCte Id=\"CTe{$chave}\" versao=\"4.00\">\n";
    
    // Ide
    $xml .= "      <ide>\n";
    $xml .= "        <cUF>{$uf}</cUF><cCT>{$codigo}</cCT><CFOP>{$ide['CFOP']}</CFOP><natOp>{$ide['natOp']}</natOp>\n";
    $xml .= "        <mod>{$mod}</mod><serie>{$serie}</serie><nCT>{$nCT}</nCT>\n";
    $xml .= "        <dhEmi>{$ide['dhEmi']}</dhEmi><tpImp>2</tpImp><tpEmis>{$tpEmis}</tpEmis><cDV>{$cDV}</cDV>\n";
    $xml .= "        <tpAmb>2</tpAmb><tpCTe>{$ide['tpCTe']}</tpCTe><procEmi>0</procEmi><verProc>4.35b152</verProc>\n";
    $xml .= "        <cMunEnv>{$ide['cMunEnv']}</cMunEnv><xMunEnv>{$ide['xMunEnv']}</xMunEnv><UFEnv>{$ide['UFEnv']}</UFEnv>\n";
    $xml .= "        <modal>{$ide['modal']}</modal><tpServ>{$ide['tpServ']}</tpServ>\n";
    $xml .= "        <cMunIni>{$ide['cMunIni']}</cMunIni><xMunIni>{$ide['xMunIni']}</xMunIni><UFIni>{$ide['UFIni']}</UFIni>\n";
    $xml .= "        <cMunFim>{$ide['cMunFim']}</cMunFim><xMunFim>{$ide['xMunFim']}</xMunFim><UFFim>{$ide['UFFim']}</UFFim>\n";
    $xml .= "        <retira>{$ide['retira']}</retira><indIEToma>{$ide['indIEToma']}</indIEToma>\n";
    if (isset($ide['toma3'])) $xml .= "        <toma3><toma>{$ide['toma3']['toma']}</toma></toma3>\n";
    $xml .= "      </ide>\n";

    // Compl
    $xml .= "      <compl>\n";
    $xml .= "        <xObs>SIMULACAO DE TESTE - " . date('d/m/Y H:i') . "</xObs>\n";
    $xml .= "      </compl>\n";

    // Emit
    $xml .= "      <emit>\n";
    $xml .= "        <CNPJ>{$cnpjEmit}</CNPJ><IE>{$emit['IE']}</IE><xNome>{$emit['xNome']}</xNome><xFant>{$emit['xNome']}</xFant>\n";
    $xml .= "        <enderEmit>\n";
    $xml .= "          <xLgr>{$emit['enderEmit']['xLgr']}</xLgr><nro>{$emit['enderEmit']['nro']}</nro><xBairro>{$emit['enderEmit']['xBairro']}</xBairro>\n";
    $xml .= "          <cMun>{$emit['enderEmit']['cMun']}</cMun><xMun>{$emit['enderEmit']['xMun']}</xMun><CEP>{$emit['enderEmit']['CEP']}</CEP><UF>{$emit['enderEmit']['UF']}</UF>\n";
    $xml .= "          <fone>0000000000</fone>\n";
    $xml .= "        </enderEmit>\n";
    $xml .= "        <CRT>{$emit['CRT']}</CRT>\n";
    $xml .= "      </emit>\n";

    // Rem
    $xml .= "      <rem>\n";
    $idRem = isset($rem['CNPJ']) ? "<CNPJ>{$rem['CNPJ']}</CNPJ>" : "<CPF>{$rem['CPF']}</CPF>";
    $xml .= "        {$idRem}<IE>{$rem['IE']}</IE><xNome>{$rem['xNome']}</xNome><xFant>{$rem['xNome']}</xFant>\n";
    $xml .= "        <enderReme>\n";
    $xml .= "          <xLgr>{$rem['enderReme']['xLgr']}</xLgr><nro>{$rem['enderReme']['nro']}</nro><xBairro>{$rem['enderReme']['xBairro']}</xBairro>\n";
    $xml .= "          <cMun>{$rem['enderReme']['cMun']}</cMun><xMun>{$rem['enderReme']['xMun']}</xMun><CEP>{$rem['enderReme']['CEP']}</CEP><UF>{$rem['enderReme']['UF']}</UF>\n";
    $xml .= "          <cPais>1058</cPais><xPais>BRASIL</xPais>\n";
    $xml .= "        </enderReme>\n";
    $xml .= "      </rem>\n";

    // Dest
    $xml .= "      <dest>\n";
    $idDest = isset($dest['CNPJ']) ? "<CNPJ>{$dest['CNPJ']}</CNPJ>" : "<CPF>{$dest['CPF']}</CPF>";
    $xml .= "        {$idDest}<IE>{$dest['IE']}</IE><xNome>{$dest['xNome']}</xNome>\n";
    $xml .= "        <enderDest>\n";
    $xml .= "          <xLgr>{$dest['enderDest']['xLgr']}</xLgr><nro>{$dest['enderDest']['nro']}</nro><xBairro>{$dest['enderDest']['xBairro']}</xBairro>\n";
    $xml .= "          <cMun>{$dest['enderDest']['cMun']}</cMun><xMun>{$dest['enderDest']['xMun']}</xMun><CEP>{$dest['enderDest']['CEP']}</CEP><UF>{$dest['enderDest']['UF']}</UF>\n";
    $xml .= "          <cPais>1058</cPais><xPais>BRASIL</xPais>\n";
    $xml .= "        </enderDest>\n";
    $xml .= "      </dest>\n";

    // vPrest
    $xml .= "      <vPrest>\n";
    $xml .= "        <vTPrest>{$vPrest['vTPrest']}</vTPrest><vRec>{$vPrest['vRec']}</vRec>\n";
    foreach (($vPrest['Comp'] ?? []) as $c) {
        $xml .= "        <Comp><xNome>{$c['xNome']}</xNome><vComp>{$c['vComp']}</vComp></Comp>\n";
    }
    $xml .= "      </vPrest>\n";

    // imp
    $xml .= "      <imp>\n";
    if (isset($imp['ICMS'])) {
        $xml .= "        <ICMS>\n";
        foreach ($imp['ICMS'] as $tag => $val) {
            $xml .= "          <{$tag}>\n";
            foreach ($val as $k => $v) $xml .= "            <{$k}>{$v}</{$k}>\n";
            $xml .= "          </{$tag}>\n";
        }
        $xml .= "        </ICMS>\n";
    }
    $xml .= "      </imp>\n";

    // infCTeNorm
    $xml .= "      <infCTeNorm>\n";
    $xml .= "        <infCarga>\n";
    $xml .= "          <vCarga>{$carga['vCarga']}</vCarga><proPred>{$carga['proPred']}</proPred>\n";
    foreach (($carga['infQ'] ?? []) as $q) {
        $xml .= "          <infQ><cUnid>{$q['cUnid']}</cUnid><tpMed>{$q['tpMed']}</tpMed><qCarga>{$q['qCarga']}</qCarga></infQ>\n";
    }
    $xml .= "        </infCarga>\n";
    $xml .= "        <infDoc>\n";
    foreach (($doc['infNFe'] ?? []) as $n) $xml .= "          <infNFe><chave>{$n['chave']}</chave></infNFe>\n";
    foreach (($doc['infNF'] ?? []) as $n) $xml .= "          <infNF><serie>{$n['serie']}</serie><nNF>{$n['nNF']}</nNF></infNF>\n";
    $xml .= "        </infDoc>\n";
    if (isset($modal['rodo'])) {
        $xml .= "        <infModal versaoModal=\"4.00\"><rodo xmlns=\"http://www.portalfiscal.inf.br/cte\"><RNTRC>{$modal['rodo']['RNTRC']}</RNTRC></rodo></infModal>\n";
    }
    $xml .= "        <cobr><fat><nFat>{$nCT}</nFat><vOrig>{$vPrest['vTPrest']}</vOrig><vLiq>{$vPrest['vRec']}</vLiq></fat></cobr>\n";
    $xml .= "      </infCTeNorm>\n";

    // infRespTec
    $xml .= "      <infRespTec>\n";
    $xml .= "        <CNPJ>26314062000161</CNPJ><xContato>Gemini CLI</xContato><email>marketing@gemini.com.br</email><fone>3432390700</fone>\n";
    $xml .= "      </infRespTec>\n";

$xml .= "    </infCte>\n";

// infCTeSupl (QR Code)
$xml .= "    <infCTeSupl>\n";
$xml .= "      <qrCodCTe><![CDATA[https://www.fazenda.pr.gov.br/cte/qrcode?chCTe={$chave}&tpAmb=2]]></qrCodCTe>\n";
$xml .= "    </infCTeSupl>\n";

// Signature
$xml .= "    <Signature xmlns=\"http://www.w3.org/2000/09/xmldsig#\">\n";
$xml .= "      <SignedInfo>\n";
$xml .= "        <CanonicalizationMethod Algorithm=\"http://www.w3.org/TR/2001/REC-xml-c14n-20010315\"/>\n";
$xml .= "        <SignatureMethod Algorithm=\"http://www.w3.org/2000/09/xmldsig#rsa-sha1\"/>\n";
$xml .= "        <Reference URI=\"#CTe{$chave}\">\n";
$xml .= "          <Transforms><Transform Algorithm=\"http://www.w3.org/2000/09/xmldsig#enveloped-signature\"/><Transform Algorithm=\"http://www.w3.org/TR/2001/REC-xml-c14n-20010315\"/></Transforms>\n";
$xml .= "          <DigestMethod Algorithm=\"http://www.w3.org/2000/09/xmldsig#sha1\"/><DigestValue>".base64_encode(sha1($xml, true))."</DigestValue>\n";
$xml .= "        </Reference>\n";
$xml .= "      </SignedInfo>\n";
$xml .= "      <SignatureValue>SIMULADO=".base64_encode(md5($chave))."</SignatureValue>\n";
$xml .= "      <KeyInfo><X509Data><X509Certificate>MII...</X509Certificate></X509Data></KeyInfo>\n";
$xml .= "    </Signature>\n";
$xml .= "  </CTe>\n";

// protCTe
$xml .= "  <protCTe versao=\"4.00\">\n";
$xml .= "    <infProt>\n";
$xml .= "      <tpAmb>2</tpAmb><verAplic>Simulado_CLI</verAplic><chCTe>{$chave}</chCTe>\n";
$xml .= "      <dhRecbto>".date('Y-m-d\TH:i:sP')."</dhRecbto><nProt>141250146679905</nProt>\n";
$xml .= "      <digVal>".base64_encode(sha1($chave, true))."</digVal><cStat>100</cStat><xMotivo>Autorizado o uso do CTe</xMotivo>\n";
$xml .= "    </infProt>\n";
$xml .= "  </protCTe>\n";
$xml .= "</cteProc>";

echo json_encode([
    'status' => 'sucesso',
    'simulado' => true,
    'chave' => $chave,
    'xml' => base64_encode($xml),
    'payload' => $data,
    'data_emissao' => date('d/m/Y H:i:s')
]);
