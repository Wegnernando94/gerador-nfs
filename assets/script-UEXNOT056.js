// ── CSRF token helper (OWASP A01) ─────────────────────────
let _csrfToken = null;

async function getCsrfToken() {
    if (_csrfToken) return _csrfToken;
    try {
        const r = await fetch('api/listar_empresas.php', { method: 'GET' });
        _csrfToken = r.headers.get('X-CSRF-Token') || '';
    } catch { _csrfToken = ''; }
    return _csrfToken;
}

async function securePost(url, body) {
    const token = await getCsrfToken();
    return fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
        body: JSON.stringify(body)
    });
}

async function securePut(url, body) {
    const token = await getCsrfToken();
    return fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
        body: JSON.stringify(body)
    });
}

// ==========================================
// CONFIGURAÇÕES GERAIS E INICIALIZAÇÃO
// ==========================================
window.onload = () => {
    criarDatalistCFOP();
    atualizarCSTpadrao();
    carregarDropdownsEmpresas();
    addProduto();
    const dh = document.getElementById('dhEmi');
    if(dh) dh.value = new Date().toISOString().slice(0,16);
    inicializarCampoChave();
    iniciarValidacaoNNF();
};

function inicializarCampoChave() {
    const campo = document.getElementById('refNFe');
    if (!campo) return;

    function sanitizar(val) {
        return val.replace(/\D/g, '').slice(0, 44);
    }

    campo.addEventListener('input', () => {
        const pos = campo.selectionStart;
        const antes = campo.value.length;
        campo.value = sanitizar(campo.value);
        // Reposiciona cursor proporcionalmente
        const diff = antes - campo.value.length;
        campo.setSelectionRange(Math.max(0, pos - diff), Math.max(0, pos - diff));
        atualizarContadorChave(campo);
    });

    campo.addEventListener('paste', e => {
        e.preventDefault();
        const colado = e.clipboardData ? e.clipboardData.getData('text') : '';
        const atual = campo.value;
        const inicio = campo.selectionStart;
        const fim = campo.selectionEnd;
        const novo = sanitizar(atual.slice(0, inicio) + colado + atual.slice(fim));
        campo.value = novo;
        const cursor = Math.min(inicio + sanitizar(colado).length, 44);
        campo.setSelectionRange(cursor, cursor);
        atualizarContadorChave(campo);
    });

    campo.addEventListener('drop', e => {
        e.preventDefault();
        campo.value = sanitizar(e.dataTransfer.getData('text'));
        atualizarContadorChave(campo);
    });

    campo.addEventListener('keydown', e => {
        // Bloqueia letras e símbolos, permite: dígitos, backspace, delete, arrows, tab, ctrl+v/c/x/a
        const permitidos = ['Backspace','Delete','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Tab','Home','End'];
        if (permitidos.includes(e.key)) return;
        if (e.ctrlKey || e.metaKey) return;
        if (!/^\d$/.test(e.key)) e.preventDefault();
    });
}

function atualizarContadorChave(campo) {
    const len = campo.value.length;
    const cor = len === 44 ? '#4caf50' : len > 0 ? '#ff9800' : '#aaa';
    campo.style.borderColor = cor;
    campo.title = `${len}/44 dígitos`;
}

// Funções Utilitárias Blindadas
function getV(id) { 
    const el = document.getElementById(id);
    return el ? el.value : ""; 
}

function clean(v) { 
    return v ? v.toString().replace(/\D/g, '') : ""; 
}

function numAleatorio(min, max) { 
    return Math.floor(Math.random() * (max - min + 1) + min); 
}

// ==========================================
// LÓGICA DE INTERFACE (DEVOLUÇÃO)
// ==========================================
function toggleDevolucao() {
    const fin = getV('finNFe');
    const campo = document.getElementById('campoRef');
    if (campo) campo.style.display = (fin === "4") ? 'block' : 'none';
    if (fin !== "4") limparPainelRef();
    recalc();
}

function limparPainelRef() {
    document.getElementById('painelNotaRef').style.display = 'none';
    document.getElementById('erroRef').style.display = 'none';
    _notaRefData = null;
}

let _notaRefData = null;

function toggleCobranca() {
    const div = document.getElementById('cobrancaConteudo');
    const icon = document.getElementById('cobrancaToggleIcon');
    const open = div.style.display === '';
    div.style.display = open ? 'none' : '';
    icon.textContent = open ? '▼' : '▲';
}

let _duplicatas = [];

function addDuplicata() {
    const container = document.getElementById('listaDuplicatas');
    const index = _duplicatas.length;
    
    const div = document.createElement('div');
    div.className = 'duplicata-item';
    div.style.cssText = 'border: 1px solid var(--border); border-radius: 4px; padding: 12px; margin-bottom: 8px; background: var(--bg1);';
    
    div.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
            <span style="font-weight: 600; color: var(--text1);">Parcela ${index + 1}</span>
            <button class="btn btn-danger" onclick="removerDuplicata(${index})" style="font-size: 11px; padding: 3px 8px;">Remover</button>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px;">
            <div class="field">
                <label>Número da Duplicata</label>
                <input type="text" id="nDup_${index}" placeholder="001" style="width: 100%;">
            </div>
            <div class="field">
                <label>Data de Vencimento</label>
                <input type="date" id="dVenc_${index}" style="width: 100%;">
            </div>
            <div class="field">
                <label>Valor (R$)</label>
                <input type="number" id="vDup_${index}" step="0.01" placeholder="0,00" style="width: 100%;" oninput="atualizarValorLiquido()">
            </div>
        </div>
    `;
    
    container.appendChild(div);
    _duplicatas.push({
        nDup: '',
        dVenc: '',
        vDup: 0
    });
}

function removerDuplicata(index) {
    _duplicatas.splice(index, 1);
    atualizarListaDuplicatas();
    atualizarValorLiquido();
}

function atualizarListaDuplicatas() {
    const container = document.getElementById('listaDuplicatas');
    container.innerHTML = '';
    _duplicatas.forEach((dup, index) => {
        addDuplicata();
        // Restaurar valores
        setTimeout(() => {
            document.getElementById(`nDup_${index}`).value = dup.nDup;
            document.getElementById(`dVenc_${index}`).value = dup.dVenc;
            document.getElementById(`vDup_${index}`).value = dup.vDup;
        }, 10);
    });
}

function atualizarValorLiquido() {
    const vOrig = parseFloat(document.getElementById('vOrig').value) || 0;
    const vDesc = parseFloat(document.getElementById('vDesc').value) || 0;
    const vLiq = vOrig - vDesc;
    document.getElementById('vLiq').value = vLiq.toFixed(2);
}

async function consultarNotaRef() {
    const chave = getV('refNFe').replace(/\D/g, '');
    const erro  = document.getElementById('erroRef');
    const load  = document.getElementById('loadingRef');
    const painel = document.getElementById('painelNotaRef');

    erro.style.display = 'none';
    painel.style.display = 'none';
    _notaRefData = null;

    if (chave.length !== 44) {
        erro.textContent = 'A chave deve ter exatamente 44 dígitos.';
        erro.style.display = '';
        return;
    }

    load.style.display = '';
    try {
        const resp = await fetch(`api/buscar_nfe.php?chave=${chave}`);
        const res  = await resp.json();
        load.style.display = 'none';

        if (res.error) {
            erro.textContent = res.error;
            erro.style.display = '';
            return;
        }

        _notaRefData = res;

        // Extrai dados para exibição
        const inf     = res.infNFe || res.body?.NFe?.infNFe || res.body?.infNFe || {};
        const emitNome = inf.emit?.xNome || res.emitente?.nome || '-';
        const destNome = inf.dest?.xNome || res.destinatario?.nome || '-';
        const itens    = Array.isArray(inf.det) ? inf.det : (inf.det ? [inf.det] : []);
        const resumoItens = itens.map(d => `${d.prod?.xProd || 'Item'} (${d.prod?.qCom || 1} x R$ ${parseFloat(d.prod?.vUnCom || 0).toFixed(2)})`).join('; ') || '-';
        const st = res.status || '-';
        const cor = { autorizado:'#4caf50', rejeitado:'#f44336', cancelado:'#607d8b' }[st] || '#ff9800';

        document.getElementById('refStatus').textContent  = st.toUpperCase();
        document.getElementById('refStatus').style.color  = cor;
        document.getElementById('refDataEmissao').textContent = res.data_emissao ? new Date(res.data_emissao).toLocaleString('pt-BR') : '-';
        document.getElementById('refEmitente').textContent    = emitNome;
        document.getElementById('refDestinatario').textContent = destNome;
        document.getElementById('refValor').textContent       = 'R$ ' + parseFloat(res.valor_total || 0).toFixed(2);
        document.getElementById('refItens').textContent       = resumoItens;

        const btnDev = document.getElementById('btnRealizarDevolucao');
        btnDev.disabled = st !== 'autorizado';
        btnDev.title    = st !== 'autorizado' ? 'Só é possível devolver notas autorizadas' : '';

        painel.style.display = '';

    } catch(e) {
        load.style.display = 'none';
        erro.textContent = 'Erro ao consultar: ' + e.message;
        erro.style.display = '';
    }
}

async function confirmarDevolucao() {
    if (!_notaRefData) return;
    const confirma = confirm('Deseja realizar a devolução desta nota?\n\nEsta ação irá gerar e transmitir uma NF-e de devolução para a SEFAZ.');
    if (!confirma) return;
    await transmitirDevolucao(_notaRefData);
}

async function transmitirDevolucao(notaOriginal) {
    const btn = document.getElementById('btnRealizarDevolucao');

    const nNFDev   = parseInt(document.getElementById('nNF')?.value) + 1 || '?';
    const serieDev = parseInt(document.getElementById('serie')?.value) || 1;
    const confirmado = confirm(
        `Confirma a transmissão da NF-e de devolução?\n\n` +
        `Série: ${serieDev}\n` +
        `Número: ${nNFDev}\n\n` +
        `Verifique se estes dados estão corretos antes de continuar.`
    );
    if (!confirmado) return;

    btn.innerText = 'Transmitindo...';
    btn.disabled  = true;

    try {
        const inf   = notaOriginal.infNFe || notaOriginal.body?.NFe?.infNFe || notaOriginal.body?.infNFe || {};
        const ide   = inf.ide || {};
        const emit  = inf.emit || {};
        const dest  = inf.dest || {};
        const itens = Array.isArray(inf.det) ? inf.det : (inf.det ? [inf.det] : []);
        const chave = notaOriginal.chave || '';

        // Mapeamento CFOP de devolução (5xxx→5201/5202, 6xxx→6201/6202, etc.)
        function cfopDevolucao(cfopOrig) {
            const c = String(cfopOrig).replace('.','');
            const mapa = {
                '5101':'5201','5102':'5202','5103':'5201','5104':'5202',
                '5111':'5201','5112':'5202','5116':'5201','5117':'5202',
                '6101':'6201','6102':'6202','6103':'6201','6104':'6202',
                '6111':'6201','6112':'6202','6116':'6201','6117':'6202',
            };
            return mapa[c] || c;
        }

        let vTot = 0, vBCTot = 0, vIcmsTot = 0, vPisTot = 0, vCofinsTot = 0;

        const det = itens.map((d, i) => {
            const prod  = d.prod  || {};
            const impo  = d.imposto || {};
            const icms  = impo.ICMS || {};
            const icmsObj = icms.ICMS00 || icms.ICMS40 || icms.ICMS20 || icms.ICMSSN400 || icms.ICMSSN102 || {};
            const pisObj  = (impo.PIS?.PISAliq || impo.PIS?.PISNT || {});
            const cofObj  = (impo.COFINS?.COFINSAliq || impo.COFINS?.COFINSNT || {});

            const vP    = parseFloat(prod.vProd || 0);
            const pICMS = parseFloat(icmsObj.pICMS || 0);
            const vICMS = parseFloat(icmsObj.vICMS || 0);
            const pPIS  = parseFloat(pisObj.pPIS   || 0);
            const vPIS  = parseFloat(pisObj.vPIS   || 0);
            const pCOF  = parseFloat(cofObj.pCOFINS || 0);
            const vCOF  = parseFloat(cofObj.vCOFINS || 0);
            const cst   = icmsObj.CST || icmsObj.CSOSN || '00';
            const semBC = ['40','41','50','51','60','300','400','500'].includes(cst);

            vTot     += vP;
            if (!semBC) vBCTot += vP;
            vIcmsTot += vICMS;
            vPisTot  += vPIS;
            vCofinsTot += vCOF;

            const orig = parseInt(icmsObj.orig) || 0;
            const icmsNode = semBC
                ? { [`ICMS${cst}`]: { orig, CST: cst } }
                : { ICMS00: { orig, CST: cst, modBC: 3, vBC: vP, pICMS, vICMS } };

            return {
                nItem: i + 1,
                prod: {
                    cProd: prod.cProd || String(i+1), cEAN: 'SEM GTIN',
                    xProd: prod.xProd || 'Item devolvido',
                    NCM: prod.NCM || '21069090',
                    CFOP: cfopDevolucao(prod.CFOP),
                    uCom: prod.uCom || 'UN', qCom: parseFloat(prod.qCom) || 1,
                    vUnCom: parseFloat(prod.vUnCom) || 0, vProd: vP,
                    cEANTrib: 'SEM GTIN', uTrib: prod.uTrib || 'UN',
                    qTrib: parseFloat(prod.qTrib || prod.qCom) || 1,
                    vUnTrib: parseFloat(prod.vUnTrib || prod.vUnCom) || 0, indTot: 1
                },
                imposto: {
                    ICMS: icmsNode,
                    PIS:    pPIS > 0 ? { PISAliq:    { CST: '01', vBC: vP, pPIS: pPIS,  vPIS: vPIS } }
                                     : { PISNT:      { CST: '07' } },
                    COFINS: pCOF > 0 ? { COFINSAliq: { CST: '01', vBC: vP, pCOFINS: pCOF, vCOFINS: vCOF } }
                                     : { COFINSNT:   { CST: '07' } }
                }
            };
        });

        if (det.length === 0) {
            alert('A nota original não possui itens (det). Não é possível gerar a devolução.');
            btn.disabled = false;
            return;
        }

        // Garantir que enderDest tenha os campos obrigatórios
        const enderDestOrig = dest.enderDest || {};
        const enderDest = {
            xLgr:   enderDestOrig.xLgr   || dest.xLgr   || 'NAO INFORMADO',
            nro:    enderDestOrig.nro     || dest.nro     || 'SN',
            xBairro:enderDestOrig.xBairro || dest.xBairro || 'NAO INFORMADO',
            cMun:   parseInt(enderDestOrig.cMun || dest.cMun) || 0,
            xMun:   enderDestOrig.xMun    || dest.xMun    || 'NAO INFORMADO',
            UF:     enderDestOrig.UF      || dest.UF      || '',
            CEP:    enderDestOrig.CEP     || dest.CEP     || ''
        };

        if (!enderDest.UF) {
            alert('UF do destinatário não encontrada na nota original. Verifique os dados.');
            btn.disabled = false;
            return;
        }

        const ufEmit = emit.enderEmit?.UF || '';
        const cstPref = String(det[0]?.prod?.CFOP || '5').charAt(0);
        const idDest  = cstPref === '6' ? 2 : cstPref === '7' ? 3 : 1;
        const indFinal = idDest === 2 && (dest.indIEDest === 9 || dest.indIEDest === '9') ? 1 : 0;
        const dhEmi = (() => { const d = new Date(Date.now() - 3 * 3600000); return d.toISOString().split('.')[0] + '-03:00'; })();

        const payload = {
            ambiente: 'homologacao',
            referencia: 'DEV-' + Date.now(),
            infNFe: {
                versao: '4.00',
                ide: {
                    cUF: parseInt(ide.cUF) || (UF_PARA_CUF[ufEmit] || 35),
                    natOp: 'DEVOLUCAO DE MERCADORIA', mod: 55,
                    serie: parseInt(ide.serie) || 1,
                    nNF: parseInt(getV('nNF')) + 1 || 101,
                    dhEmi,
                    tpNF: 1, idDest, cMunFG: parseInt(emit.enderEmit?.cMun) || 3550308,
                    tpImp: 1, tpEmis: 1, tpAmb: 2, finNFe: 4,
                    indFinal, indPres: 1, procEmi: 0, verProc: 'Matrix_v60',
                    NFref: [{ refNFe: chave }]
                },
                emit: {
                    CNPJ: emit.CNPJ, xNome: emit.xNome,
                    enderEmit: { ...emit.enderEmit, cMun: parseInt(emit.enderEmit?.cMun) || 0 }
                },
                dest: {
                    CNPJ: dest.CNPJ, xNome: dest.xNome,
                    indIEDest: parseInt(dest.indIEDest) || 9,
                    enderDest
                },
                det,
                total: {
                    ICMSTot: {
                        vBC: vBCTot, vICMS: vIcmsTot, vICMSDeson: 0, vFCP: 0,
                        vBCST: 0, vST: 0, vFCPST: 0, vFCPSTRet: 0,
                        vProd: vTot, vFrete: 0, vSeg: 0, vDesc: 0,
                        vII: 0, vIPI: 0, vIPIDevol: 0,
                        vPIS: vPisTot, vCOFINS: vCofinsTot, vOutro: 0, vNF: vTot
                    }
                },
                transp: (typeof getTranspNFe === 'function') ? getTranspNFe() : { modFrete: 9 },
                pag: { detPag: [{ tPag: '90', vPag: 0 }] }
            }
        };

        const resp = await fetch('api/transmitir.php', {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': await getCsrfToken() }
        });
        const res = await resp.json();

        // Salva payload original no localStorage para reenvio futuro
        if (res.id) {
            try { localStorage.setItem('nfe_payload_' + res.id, JSON.stringify(payload)); } catch(_){}
        }

        exibirResultado(res);

        // Se aprovado, abre o DANFE automaticamente
        if (res.status === 'autorizado' && res.id) {
            setTimeout(() => abrirDanfe(), 800);
        }

    } catch(e) {
        console.error(e);
        alert('Erro ao transmitir devolução: ' + e.message);
    } finally {
        btn.innerText = 'Realizar Nota de Devolução';
        btn.disabled  = false;
    }
}

// ==========================================
// LISTA COMPLETA DE CFOPs
// ==========================================
const CFOP_LIST = [
    // SAÍDAS INTERNAS (5xxx)
    ["5.101","Venda de produção do estabelecimento"],
    ["5.102","Venda de mercadoria adquirida ou recebida de terceiros"],
    ["5.103","Venda de produção fora do estabelecimento"],
    ["5.104","Venda de mercadoria de terceiros fora do estabelecimento"],
    ["5.109","Venda de produção para Zona Franca de Manaus"],
    ["5.110","Venda de mercadoria de terceiros para Zona Franca de Manaus"],
    ["5.111","Venda de produção em consignação industrial"],
    ["5.112","Venda de mercadoria em consignação mercantil"],
    ["5.113","Venda de produção em consignação mercantil"],
    ["5.116","Venda de produção originada de encomenda para entrega futura"],
    ["5.117","Venda de mercadoria originada de encomenda para entrega futura"],
    ["5.118","Venda de produção entregue ao destinatário por conta e ordem do adquirente"],
    ["5.119","Venda de mercadoria entregue ao destinatário por conta e ordem do adquirente"],
    ["5.122","Venda de produção remetida para industrialização por conta do adquirente"],
    ["5.123","Venda de mercadoria remetida para industrialização por conta do adquirente"],
    ["5.124","Industrialização efetuada para outra empresa"],
    ["5.151","Transferência de produção do estabelecimento"],
    ["5.152","Transferência de mercadoria adquirida ou recebida de terceiros"],
    ["5.153","Transferência de energia elétrica"],
    ["5.155","Transferência de bem do ativo imobilizado"],
    ["5.156","Transferência de material de uso e consumo"],
    ["5.201","Devolução de compra para industrialização"],
    ["5.202","Devolução de compra para comercialização"],
    ["5.208","Devolução de mercadoria recebida em transferência para industrialização"],
    ["5.209","Devolução de mercadoria recebida em transferência para comercialização"],
    ["5.210","Devolução de compra para utilização na prestação de serviço"],
    ["5.251","Venda de energia elétrica para distribuição ou comercialização"],
    ["5.252","Venda de energia elétrica para estabelecimento industrial"],
    ["5.253","Venda de energia elétrica para estabelecimento comercial"],
    ["5.257","Venda de energia elétrica para consumidor final"],
    ["5.301","Prestação de serviço de comunicação para execução de serviço da mesma natureza"],
    ["5.302","Prestação de serviço de comunicação a estabelecimento industrial"],
    ["5.303","Prestação de serviço de comunicação a estabelecimento comercial"],
    ["5.351","Prestação de serviço de transporte para execução de serviço da mesma natureza"],
    ["5.352","Prestação de serviço de transporte a estabelecimento industrial"],
    ["5.353","Prestação de serviço de transporte a estabelecimento comercial"],
    ["5.354","Prestação de serviço de transporte a prestador de serviços"],
    ["5.357","Prestação de serviço de transporte a não contribuinte"],
    ["5.401","Venda de produção com substituição tributária - contribuinte substituto"],
    ["5.402","Venda de produção com ST entre contribuintes substitutos"],
    ["5.403","Venda de mercadoria com ST - contribuinte substituto"],
    ["5.405","Venda de mercadoria com ST - contribuinte substituído"],
    ["5.501","Remessa de produção com fim específico de exportação"],
    ["5.502","Remessa de mercadoria com fim específico de exportação"],
    ["5.503","Devolução de mercadoria recebida com fim específico de exportação"],
    ["5.551","Venda de bem do ativo imobilizado"],
    ["5.552","Transferência de bem do ativo imobilizado"],
    ["5.553","Devolução de compra de bem do ativo imobilizado"],
    ["5.556","Devolução de compra de material de uso e consumo"],
    ["5.557","Transferência de material de uso e consumo"],
    ["5.651","Venda de combustível/lubrificante de produção - industrialização"],
    ["5.652","Venda de combustível/lubrificante de produção - comercialização"],
    ["5.653","Venda de combustível/lubrificante de produção - consumidor final"],
    ["5.655","Venda de combustível/lubrificante de terceiros - comercialização"],
    ["5.656","Venda de combustível/lubrificante de terceiros - consumidor final"],
    ["5.667","Venda de combustível/lubrificante a consumidor de outra UF"],
    ["5.901","Remessa para industrialização por encomenda"],
    ["5.902","Retorno de mercadoria utilizada na industrialização por encomenda"],
    ["5.904","Remessa para venda fora do estabelecimento"],
    ["5.905","Remessa para depósito fechado ou armazém geral"],
    ["5.906","Retorno de mercadoria depositada em depósito fechado ou armazém geral"],
    ["5.910","Remessa em bonificação, doação ou brinde"],
    ["5.911","Remessa de amostra grátis"],
    ["5.912","Remessa de mercadoria para demonstração"],
    ["5.913","Retorno de mercadoria recebida para demonstração"],
    ["5.915","Remessa de mercadoria para conserto ou reparo"],
    ["5.916","Retorno de mercadoria recebida para conserto ou reparo"],
    ["5.917","Remessa de mercadoria em consignação mercantil ou industrial"],
    ["5.918","Devolução de mercadoria recebida em consignação"],
    ["5.922","Simples faturamento - venda para entrega futura"],
    ["5.923","Remessa de mercadoria por conta e ordem de terceiros"],
    ["5.927","Baixa de estoque por perda, roubo ou deterioração"],
    ["5.929","Emissão de documento fiscal relativo a operação registrada em ECF"],
    ["5.933","Prestação de serviço tributada pelo ISSQN"],
    // SAÍDAS INTERESTADUAIS (6xxx)
    ["6.101","Venda de produção do estabelecimento"],
    ["6.102","Venda de mercadoria adquirida ou recebida de terceiros"],
    ["6.103","Venda de produção fora do estabelecimento"],
    ["6.104","Venda de mercadoria de terceiros fora do estabelecimento"],
    ["6.107","Venda de produção do estabelecimento destinada à exportação"],
    ["6.108","Venda de mercadoria de terceiros destinada à exportação"],
    ["6.109","Venda de produção para Zona Franca de Manaus"],
    ["6.110","Venda de mercadoria de terceiros para Zona Franca de Manaus"],
    ["6.111","Venda de produção em consignação industrial"],
    ["6.112","Venda de mercadoria em consignação mercantil"],
    ["6.116","Venda de produção originada de encomenda para entrega futura"],
    ["6.117","Venda de mercadoria originada de encomenda para entrega futura"],
    ["6.118","Venda de produção entregue ao destinatário por conta e ordem do adquirente"],
    ["6.119","Venda de mercadoria entregue ao destinatário por conta e ordem do adquirente"],
    ["6.122","Venda de produção remetida para industrialização por conta do adquirente"],
    ["6.123","Venda de mercadoria remetida para industrialização por conta do adquirente"],
    ["6.124","Industrialização efetuada para outra empresa"],
    ["6.151","Transferência de produção do estabelecimento"],
    ["6.152","Transferência de mercadoria adquirida ou recebida de terceiros"],
    ["6.153","Transferência de energia elétrica"],
    ["6.155","Transferência de bem do ativo imobilizado"],
    ["6.156","Transferência de material de uso e consumo"],
    ["6.201","Devolução de compra para industrialização"],
    ["6.202","Devolução de compra para comercialização"],
    ["6.208","Devolução de mercadoria recebida em transferência para industrialização"],
    ["6.209","Devolução de mercadoria recebida em transferência para comercialização"],
    ["6.210","Devolução de compra para utilização na prestação de serviço"],
    ["6.251","Venda de energia elétrica para distribuição ou comercialização"],
    ["6.252","Venda de energia elétrica para estabelecimento industrial"],
    ["6.253","Venda de energia elétrica para estabelecimento comercial"],
    ["6.257","Venda de energia elétrica para consumidor final"],
    ["6.301","Prestação de serviço de comunicação para execução de serviço da mesma natureza"],
    ["6.351","Prestação de serviço de transporte para execução de serviço da mesma natureza"],
    ["6.352","Prestação de serviço de transporte a estabelecimento industrial"],
    ["6.353","Prestação de serviço de transporte a estabelecimento comercial"],
    ["6.357","Prestação de serviço de transporte a não contribuinte"],
    ["6.401","Venda de produção com substituição tributária - contribuinte substituto"],
    ["6.403","Venda de mercadoria com ST - contribuinte substituto"],
    ["6.404","Venda de mercadoria com ST - contribuinte substituído"],
    ["6.501","Remessa de produção com fim específico de exportação"],
    ["6.502","Remessa de mercadoria com fim específico de exportação"],
    ["6.551","Venda de bem do ativo imobilizado"],
    ["6.552","Transferência de bem do ativo imobilizado"],
    ["6.556","Devolução de compra de material de uso e consumo"],
    ["6.651","Venda de combustível/lubrificante de produção - industrialização"],
    ["6.652","Venda de combustível/lubrificante de produção - comercialização"],
    ["6.653","Venda de combustível/lubrificante de produção - consumidor final"],
    ["6.655","Venda de combustível/lubrificante de terceiros - comercialização"],
    ["6.656","Venda de combustível/lubrificante de terceiros - consumidor final"],
    ["6.901","Remessa para industrialização por encomenda"],
    ["6.902","Retorno de mercadoria utilizada na industrialização por encomenda"],
    ["6.904","Remessa para venda fora do estabelecimento"],
    ["6.905","Remessa para depósito fechado ou armazém geral"],
    ["6.906","Retorno de mercadoria depositada em depósito fechado ou armazém geral"],
    ["6.910","Remessa em bonificação, doação ou brinde"],
    ["6.911","Remessa de amostra grátis"],
    ["6.912","Remessa de mercadoria para demonstração"],
    ["6.915","Remessa de mercadoria para conserto ou reparo"],
    ["6.916","Retorno de mercadoria recebida para conserto ou reparo"],
    ["6.917","Remessa de mercadoria em consignação mercantil ou industrial"],
    ["6.918","Devolução de mercadoria recebida em consignação"],
    ["6.922","Simples faturamento - venda para entrega futura"],
    ["6.923","Remessa de mercadoria por conta e ordem de terceiros"],
    ["6.929","Emissão de documento fiscal relativo a operação registrada em ECF"],
    // EXPORTAÇÕES (7xxx)
    ["7.101","Venda de produção do estabelecimento"],
    ["7.102","Venda de mercadoria adquirida ou recebida de terceiros"],
    ["7.105","Venda de produção do estabelecimento que não deva por ele transitar"],
    ["7.106","Venda de mercadoria de terceiros que não deva por ele transitar"],
    ["7.127","Venda de produção do estabelecimento sob regime aduaneiro especial"],
    ["7.129","Venda de produção local com regime especial de drawback"],
    ["7.201","Devolução de compra para industrialização"],
    ["7.202","Devolução de compra para comercialização"],
    ["7.210","Devolução de compra para utilização na prestação de serviço"],
    ["7.211","Devolução de compras para industrialização sob regime de drawback"],
    ["7.251","Venda de energia elétrica para o exterior"],
    ["7.301","Prestação de serviço de comunicação para execução no exterior"],
    ["7.358","Prestação de serviço de transporte"],
    ["7.501","Exportação de mercadorias recebidas com fim específico de exportação"],
    ["7.551","Venda de bem do ativo imobilizado"],
    ["7.930","Lançamento efetuado em decorrência de encerramento de atividade em local de prestação de serviço"],
    // ENTRADAS INTERNAS (1xxx)
    ["1.101","Compra para industrialização ou produção rural"],
    ["1.102","Compra para comercialização"],
    ["1.111","Compra para industrialização sob o regime de drawback"],
    ["1.116","Compra para industrialização originada de encomenda para entrega futura"],
    ["1.117","Compra para comercialização originada de encomenda para entrega futura"],
    ["1.118","Compra de mercadoria para comercialização pelo adquirente originário"],
    ["1.120","Compra para industrialização, fornecida pelo vendedor remetente"],
    ["1.122","Compra para industrialização em que a mercadoria não transita pelo adquirente"],
    ["1.124","Industrialização efetuada por outra empresa"],
    ["1.151","Transferência para industrialização ou produção rural"],
    ["1.152","Transferência para comercialização"],
    ["1.153","Transferência de energia elétrica para distribuição"],
    ["1.201","Devolução de venda de produção do estabelecimento"],
    ["1.202","Devolução de venda de mercadoria adquirida ou recebida de terceiros"],
    ["1.203","Devolução de venda de produção do estabelecimento, destinada à ZFM"],
    ["1.204","Devolução de venda de mercadoria destinada à ZFM"],
    ["1.251","Compra de energia elétrica para distribuição ou comercialização"],
    ["1.252","Compra de energia elétrica por estabelecimento industrial"],
    ["1.253","Compra de energia elétrica por estabelecimento comercial"],
    ["1.257","Compra de energia elétrica para consumidor final"],
    ["1.301","Aquisição de serviço de comunicação para execução de serviço da mesma natureza"],
    ["1.302","Aquisição de serviço de comunicação por estabelecimento industrial"],
    ["1.303","Aquisição de serviço de comunicação por estabelecimento comercial"],
    ["1.351","Aquisição de serviço de transporte para execução de serviço da mesma natureza"],
    ["1.352","Aquisição de serviço de transporte por estabelecimento industrial"],
    ["1.353","Aquisição de serviço de transporte por estabelecimento comercial"],
    ["1.354","Aquisição de serviço de transporte por prestador de serviços"],
    ["1.401","Compra para industrialização ou produção - recebida com ST"],
    ["1.403","Compra para comercialização em operação com ST"],
    ["1.406","Compra de bem para o ativo imobilizado cuja mercadoria está sujeita ao regime de ST"],
    ["1.501","Entrada de mercadoria recebida com fim específico de exportação"],
    ["1.502","Entrada de mercadoria recebida com fim específico de exportação de terceiros"],
    ["1.551","Compra de bem para o ativo imobilizado"],
    ["1.552","Transferência de bem do ativo imobilizado"],
    ["1.553","Devolução de venda de bem do ativo imobilizado"],
    ["1.554","Retorno de bem do ativo imobilizado remetido para uso fora do estabelecimento"],
    ["1.555","Entrada de bem do ativo imobilizado de terceiro, remetido para uso no estabelecimento"],
    ["1.556","Compra de material para uso ou consumo"],
    ["1.557","Transferência de material de uso e consumo"],
    ["1.651","Compra de combustível ou lubrificante para industrialização subsequente"],
    ["1.652","Compra de combustível ou lubrificante para comercialização"],
    ["1.653","Compra de combustível ou lubrificante por consumidor ou usuário final"],
    ["1.901","Remessa para industrialização por encomenda"],
    ["1.902","Retorno de mercadoria utilizada na industrialização por encomenda"],
    ["1.903","Retorno de mercadoria recebida para industrialização e não aplicada"],
    ["1.904","Retorno de remessa para venda fora do estabelecimento"],
    ["1.905","Entrada de mercadoria recebida para depósito em depósito fechado ou armazém geral"],
    ["1.906","Retorno de mercadoria remetida para depósito fechado ou armazém geral"],
    ["1.910","Entrada de bonificação, doação ou brinde"],
    ["1.911","Entrada de amostra grátis"],
    ["1.912","Entrada de mercadoria ou bem recebido para demonstração"],
    ["1.913","Retorno de mercadoria ou bem remetido para demonstração"],
    ["1.915","Entrada de mercadoria ou bem recebido para conserto ou reparo"],
    ["1.916","Retorno de mercadoria ou bem remetido para conserto ou reparo"],
    ["1.917","Entrada de mercadoria recebida em consignação mercantil ou industrial"],
    ["1.918","Devolução de mercadoria remetida em consignação mercantil ou industrial"],
    ["1.922","Lançamento efetuado a título de simples faturamento decorrente de compra para recebimento futuro"],
    ["1.923","Entrada de mercadoria por conta e ordem de terceiros em venda à ordem"],
    // ENTRADAS INTERESTADUAIS (2xxx)
    ["2.101","Compra para industrialização ou produção rural"],
    ["2.102","Compra para comercialização"],
    ["2.111","Compra para industrialização sob o regime de drawback"],
    ["2.116","Compra para industrialização originada de encomenda para entrega futura"],
    ["2.117","Compra para comercialização originada de encomenda para entrega futura"],
    ["2.118","Compra de mercadoria para comercialização pelo adquirente originário"],
    ["2.120","Compra para industrialização, fornecida pelo vendedor remetente"],
    ["2.122","Compra para industrialização em que a mercadoria não transita pelo adquirente"],
    ["2.124","Industrialização efetuada por outra empresa"],
    ["2.151","Transferência para industrialização ou produção rural"],
    ["2.152","Transferência para comercialização"],
    ["2.153","Transferência de energia elétrica para distribuição"],
    ["2.201","Devolução de venda de produção do estabelecimento"],
    ["2.202","Devolução de venda de mercadoria adquirida ou recebida de terceiros"],
    ["2.251","Compra de energia elétrica para distribuição ou comercialização"],
    ["2.252","Compra de energia elétrica por estabelecimento industrial"],
    ["2.253","Compra de energia elétrica por estabelecimento comercial"],
    ["2.257","Compra de energia elétrica para consumidor final"],
    ["2.301","Aquisição de serviço de comunicação"],
    ["2.302","Aquisição de serviço de comunicação por estabelecimento industrial"],
    ["2.351","Aquisição de serviço de transporte por estabelecimento industrial"],
    ["2.352","Aquisição de serviço de transporte por estabelecimento comercial"],
    ["2.353","Aquisição de serviço de transporte por estabelecimento comercial"],
    ["2.401","Compra para industrialização em operação com ST"],
    ["2.403","Compra para comercialização em operação com ST"],
    ["2.501","Entrada de mercadoria recebida com fim específico de exportação"],
    ["2.551","Compra de bem para o ativo imobilizado"],
    ["2.552","Transferência de bem do ativo imobilizado"],
    ["2.553","Devolução de venda de bem do ativo imobilizado"],
    ["2.556","Compra de material para uso ou consumo"],
    ["2.651","Compra de combustível ou lubrificante para industrialização"],
    ["2.652","Compra de combustível ou lubrificante para comercialização"],
    ["2.653","Compra de combustível ou lubrificante por consumidor final"],
    ["2.901","Remessa para industrialização por encomenda"],
    ["2.902","Retorno de mercadoria utilizada na industrialização por encomenda"],
    ["2.904","Retorno de remessa para venda fora do estabelecimento"],
    ["2.905","Entrada de mercadoria recebida para depósito em depósito fechado ou armazém geral"],
    ["2.906","Retorno de mercadoria remetida para depósito fechado ou armazém geral"],
    ["2.910","Entrada de bonificação, doação ou brinde"],
    ["2.911","Entrada de amostra grátis"],
    ["2.912","Entrada de mercadoria ou bem recebido para demonstração"],
    ["2.915","Entrada de mercadoria ou bem recebido para conserto ou reparo"],
    ["2.916","Retorno de mercadoria ou bem remetido para conserto ou reparo"],
    ["2.917","Entrada de mercadoria recebida em consignação mercantil ou industrial"],
    ["2.922","Lançamento de simples faturamento decorrente de compra para recebimento futuro"],
    ["2.923","Entrada de mercadoria por conta e ordem de terceiros em venda à ordem"],
    // ENTRADAS DO EXTERIOR (3xxx)
    ["3.101","Compra para industrialização ou produção rural"],
    ["3.102","Compra para comercialização"],
    ["3.126","Compra para utilização na prestação de serviço"],
    ["3.127","Compra para industrialização sob o regime aduaneiro especial"],
    ["3.201","Devolução de venda de produção do estabelecimento"],
    ["3.202","Devolução de venda de mercadoria adquirida ou recebida de terceiros"],
    ["3.211","Devolução de venda de produção do estabelecimento sob drawback"],
    ["3.251","Compra de energia elétrica para distribuição"],
    ["3.301","Aquisição de serviço de comunicação"],
    ["3.351","Aquisição de serviço de transporte"],
    ["3.503","Importação de mercadoria com provisão para exportação"],
    ["3.551","Compra de bem para o ativo imobilizado"],
    ["3.553","Devolução de venda de bem do ativo imobilizado"],
    ["3.556","Compra de material para uso ou consumo"],
    ["3.651","Compra de combustível ou lubrificante para industrialização"],
    ["3.652","Compra de combustível ou lubrificante para comercialização"],
    ["3.653","Compra de combustível ou lubrificante por consumidor final"],
];

function criarDatalistCFOP() {
    let dl = document.getElementById('cfop-datalist');
    if (!dl) {
        dl = document.createElement('datalist');
        dl.id = 'cfop-datalist';
        document.body.appendChild(dl);
    }
    if (dl.options.length === 0) {
        dl.innerHTML = CFOP_LIST.map(([cod, desc]) =>
            `<option value="${cod.replace('.', '')}">${cod} – ${desc}</option>`
        ).join('');
    }
}

// ==========================================
// GESTÃO DE PRODUTOS E TRIBUTAÇÃO
// ==========================================
function addProduto() {
    criarDatalistCFOP();
    const container = document.getElementById('listaProdutos');
    const id = Date.now();
    const nItens = document.querySelectorAll('.produto-item').length + 1;
    const div = document.createElement('div');
    div.className = 'produto-item';
    div.id = `prod-${id}`;
    div.innerHTML = `
        <div class="produto-header">
            <span class="produto-num">Item ${nItens}</span>
            <button class="btn btn-danger btn-icon" title="Remover item" onclick="document.getElementById('prod-${id}').remove(); recalc()">✕</button>
        </div>
        <div style="display:grid; grid-template-columns: 2fr 1fr 1fr 1.2fr; gap:10px; align-items:end;">
            <div class="field" style="margin:0;">
                <label>Descrição</label>
                <input type="text" class="xProd" placeholder="Nome do produto ou serviço" value="PRODUTO TESTE QA">
            </div>
            <div class="field" style="margin:0;">
                <label>Quantidade</label>
                <input type="number" class="qtd" value="1" oninput="recalc()" placeholder="0">
            </div>
            <div class="field" style="margin:0;">
                <label>Valor Unitário (R$)</label>
                <input type="number" class="vUn" value="100.00" oninput="recalc()" placeholder="0,00">
            </div>
            <div class="field" style="margin:0;">
                <label>CFOP</label>
                <input type="text" class="cfop" value="5102" list="cfop-datalist" placeholder="Ex: 5102">
            </div>
        </div>
    `;
    container.appendChild(div);
    recalc();
}

const CST_NORMAL_OPTIONS = [
    ['00','00 - Tributado integral'],['10','10 - Tributado c/ ST'],['20','20 - Tributado c/ redução'],
    ['30','30 - Isento c/ ST'],['40','40 - Isenta'],['41','41 - Não tributada'],
    ['50','50 - Suspensão'],['51','51 - Diferimento'],['60','60 - Cobrado por ST'],
    ['70','70 - Tributado c/ redução e ST'],['90','90 - Outros']
];
const CSOSN_SIMPLES_OPTIONS = [
    ['101','101 - Tributado com crédito'],['102','102 - Tributado sem crédito'],
    ['103','103 - Isenção por faixa de receita'],['201','201 - ST com crédito'],
    ['202','202 - ST sem crédito'],['203','203 - Isenção p/ faixa c/ ST'],
    ['300','300 - Imune'],['400','400 - Não tributado pelo SN'],
    ['500','500 - ICMS cobrado por ST/antecipação'],['900','900 - Outros']
];

// CSTs/CSOSNs que NÃO precisam de alíquota/valor ICMS
const CST_SEM_VALOR = ['40','41','50','51','60','102','103','202','203','300','400','500'];

function atualizarCSTpadrao() {
    const isSimples = getV('regimeTrib') === 'simples';
    const opts = isSimples ? CSOSN_SIMPLES_OPTIONS : CST_NORMAL_OPTIONS;
    const defCod = isSimples ? '400' : '00';
    const sel = document.getElementById('cstGlobal');
    const label = document.getElementById('labelCodTrib');
    if (!sel || !label) return;
    label.textContent = isSimples ? 'CSOSN' : 'CST ICMS';
    sel.innerHTML = opts.map(([v,l]) => `<option value="${v}"${v===defCod?' selected':''}>${l}</option>`).join('');
    toggleAliqICMSGlobal();
}

function toggleAliqICMSGlobal() {
    const cst = getV('cstGlobal');
    const campo = document.getElementById('campoAliqICMS');
    if (campo) campo.style.display = CST_SEM_VALOR.includes(cst) ? 'none' : '';
}

function recalc() {
    // ---- Grupo de produtos (vProd) ----
    let vProd = 0;
    document.querySelectorAll(".produto-item").forEach(item => {
        const q = parseFloat(item.querySelector(".qtd").value) || 0;
        const v = parseFloat(item.querySelector(".vUn").value) || 0;
        vProd += (q * v);
    });

    // ---- Grupo C — Descontos ----
    const vDesc  = Math.max(0, parseFloat(getV('vDescGlobal')) || 0);

    // ---- Grupo B — Adicionais ----
    const vFrete = Math.max(0, parseFloat(getV('vFrete'))  || 0);
    const vSeg   = Math.max(0, parseFloat(getV('vSeg'))    || 0);
    const vOutro = Math.max(0, parseFloat(getV('vOutro'))  || 0);
    const vFCP   = Math.max(0, parseFloat(getV('vFCP'))    || 0);
    const pIPI   = Math.max(0, parseFloat(getV('pIPIGlobal')) || 0);
    const pST    = Math.max(0, parseFloat(getV('pSTGlobal'))  || 0);

    // ---- Grupo A — Embutidos (não somam ao vNF) ----
    const pICMS   = Math.max(0, parseFloat(getV('pICMSGlobal'))   || 0);
    const pPIS    = Math.max(0, parseFloat(getV('pPISGlobal'))    || 0);
    const pCOFINS = Math.max(0, parseFloat(getV('pCOFINSGlobal')) || 0);

    // ---- Cálculos intermediários ----
    const vSubLiq = Math.max(0, vProd - vDesc);               // subtotal líquido
    const cst      = getV('cstGlobal');
    const semValor = CST_SEM_VALOR.includes(cst);

    const vBC     = semValor ? 0 : vSubLiq;                   // base ICMS
    const vICMS   = parseFloat((vBC * (pICMS   / 100)).toFixed(2));
    const vIPI    = parseFloat((vSubLiq * (pIPI   / 100)).toFixed(2));
    const vST     = parseFloat((vSubLiq * (pST    / 100)).toFixed(2));
    const vPIS    = parseFloat((vSubLiq * (pPIS   / 100)).toFixed(2));
    const vCOFINS = parseFloat((vSubLiq * (pCOFINS / 100)).toFixed(2));

    // V. Tot. Trib. — Lei da Transparência (aprox.)
    const vTotTrib = parseFloat((vICMS + vPIS + vCOFINS + vIPI + vST).toFixed(2));

    // ---- Fechamento da nota ----
    // vNF = SubLiq + Grupo B (IPI + ST + Frete + Seg + Outro + FCP)
    const vAcrescimos = parseFloat((vIPI + vST + vFrete + vSeg + vOutro + vFCP).toFixed(2));
    const vNF         = parseFloat((vSubLiq + vAcrescimos).toFixed(2));

    // ---- Atualiza action bar (breakdown) ----
    const fmt = v => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

    setText('resTotalNota',  fmt(vNF));
    setText('resSubtotal',   fmt(vProd));
    setText('resDesconto',   fmt(vDesc));
    setText('resAcrescimos', fmt(vAcrescimos));

    // ---- Atualiza painel de tributos calculados ----
    setText('dispBCICMS',   fmt(vBC));
    setText('dispVICMS',    fmt(vICMS));
    setText('dispBCST',     fmt(vSubLiq));   // BC ST = subtotal líquido (base para ST)
    setText('dispVST',      fmt(vST));
    setText('dispVIPI',     fmt(vIPI));
    setText('dispVPIS',     fmt(vPIS));
    setText('dispVCOFINS',  fmt(vCOFINS));
    setText('dispVTotTrib', fmt(vTotTrib));

    return vNF;
}

// ==========================================
// GERAÇÃO DE XML PARA CONFERÊNCIA
// ==========================================
function gerarXMLCompleto() {
    const nNF = getV('nNF');
    const fin = getV('finNFe');
    const ref = getV('refNFe');
    let itensXml = "";

    // Lê campos globais
    const cstXml    = getV('cstGlobal');
    const semValXml = CST_SEM_VALOR.includes(cstXml);
    const pIcmsXml  = parseFloat(getV('pICMSGlobal'))   || 0;
    const pPisXml   = parseFloat(getV('pPISGlobal'))     || 0;
    const pCofXml   = parseFloat(getV('pCOFINSGlobal'))  || 0;
    const pIpiXml   = parseFloat(getV('pIPIGlobal'))     || 0;
    const vDescXml  = Math.max(0, parseFloat(getV('vDescGlobal')) || 0);
    const vFreteXml = Math.max(0, parseFloat(getV('vFrete'))      || 0);
    const vSegXml   = Math.max(0, parseFloat(getV('vSeg'))        || 0);
    const vOutroXml = Math.max(0, parseFloat(getV('vOutro'))      || 0);
    const vFCPXml   = Math.max(0, parseFloat(getV('vFCP'))        || 0);
    const pSTXml    = parseFloat(getV('pSTGlobal'))      || 0;

    let vProdTotal = 0, vIcmsTotal = 0, vPisTotal = 0, vCofTotal = 0, vIpiTotal = 0;

    document.querySelectorAll(".produto-item").forEach((item, i) => {
        const q     = parseFloat(item.querySelector(".qtd").value) || 0;
        const v     = parseFloat(item.querySelector(".vUn").value) || 0;
        const cfop  = item.querySelector(".cfop").value;
        const vProd = q * v;
        const vBC   = semValXml ? 0 : vProd;
        const vIcms = parseFloat((vBC    * (pIcmsXml / 100)).toFixed(2));
        const vPis  = parseFloat((vProd  * (pPisXml  / 100)).toFixed(2));
        const vCof  = parseFloat((vProd  * (pCofXml  / 100)).toFixed(2));
        const vIpi  = parseFloat((vProd  * (pIpiXml  / 100)).toFixed(2));

        vProdTotal += vProd; vIcmsTotal += vIcms;
        vPisTotal  += vPis;  vCofTotal  += vCof; vIpiTotal += vIpi;

        const icmsTag = semValXml
            ? `<ICMS${cstXml}><orig>0</orig><CST>${cstXml}</CST></ICMS${cstXml}>`
            : `<ICMS00><orig>0</orig><CST>${cstXml}</CST><vBC>${vBC.toFixed(2)}</vBC><pICMS>${pIcmsXml.toFixed(2)}</pICMS><vICMS>${vIcms.toFixed(2)}</vICMS></ICMS00>`;
        const ipiTag = pIpiXml > 0
            ? `<IPI><cEnq>999</cEnq><IPITrib><CST>${fin==='4'?'53':'50'}</CST><vBC>${vProd.toFixed(2)}</vBC><pIPI>${pIpiXml.toFixed(2)}</pIPI><vIPI>${vIpi.toFixed(2)}</vIPI></IPITrib></IPI>`
            : '';

        itensXml += `
        <det nItem="${i+1}">
            <prod>
                <cProd>${i+1}</cProd>
                <xProd>${item.querySelector(".xProd").value}</xProd>
                <NCM>21069090</NCM>
                <CFOP>${cfop}</CFOP>
                <uCom>UN</uCom><qCom>${q.toFixed(4)}</qCom>
                <vUnCom>${v.toFixed(2)}</vUnCom><vProd>${vProd.toFixed(2)}</vProd><indTot>1</indTot>
            </prod>
            <imposto>
                <ICMS>${icmsTag}</ICMS>
                ${ipiTag}
                <PIS><PISAliq><CST>01</CST><vBC>${vProd.toFixed(2)}</vBC><pPIS>${pPisXml.toFixed(2)}</pPIS><vPIS>${vPis.toFixed(2)}</vPIS></PISAliq></PIS>
                <COFINS><COFINSAliq><CST>01</CST><vBC>${vProd.toFixed(2)}</vBC><pCOFINS>${pCofXml.toFixed(2)}</pCOFINS><vCOFINS>${vCof.toFixed(2)}</vCOFINS></COFINSAliq></COFINS>
            </imposto>
        </det>`;
    });

    // Fechamento
    const vSubLiqXml = Math.max(0, vProdTotal - vDescXml);
    const vSTXml     = parseFloat((vSubLiqXml * (pSTXml / 100)).toFixed(2));
    const vNFXml     = parseFloat((vSubLiqXml + vIpiTotal + vSTXml + vFreteXml + vSegXml + vOutroXml + vFCPXml).toFixed(2));
    const isDev      = fin === '4';

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<NFe xmlns="http://www.portalfiscal.inf.br/nfe">
    <infNFe Id="NFe-QA-STUDIO" versao="4.00">
        <ide>
            <cUF>42</cUF><natOp>${fin === "4" ? "DEVOLUCAO" : "VENDA"}</natOp><mod>55</mod>
            <serie>${getV('serie')}</serie><nNF>${nNF}</nNF>
            <dhEmi>${new Date().toISOString()}</dhEmi><tpNF>1</tpNF>
            <tpAmb>${getV('tpAmb')}</tpAmb><finNFe>${fin}</finNFe>
            ${fin === "4" ? `<NFref><refNFe>${clean(ref)}</refNFe></NFref>` : ""}
        </ide>
        <emit><CNPJ>${clean(getV('cnpjEmit'))}</CNPJ><xNome>${getV('xNomeEmit')}</xNome></emit>
        <dest><CNPJ>${clean(getV('cnpjDest'))}</CNPJ><xNome>${getV('xNomeDest')}</xNome></dest>
        ${itensXml}
        <total>
            <ICMSTot>
                <vBC>${(semValXml?0:vSubLiqXml).toFixed(2)}</vBC>
                <vICMS>${vIcmsTotal.toFixed(2)}</vICMS>
                <vICMSDeson>0.00</vICMSDeson><vFCP>0.00</vFCP>
                <vBCST>${vSTXml>0?vSubLiqXml.toFixed(2):'0.00'}</vBCST>
                <vST>${vSTXml.toFixed(2)}</vST>
                <vFCPST>${vFCPXml.toFixed(2)}</vFCPST><vFCPSTRet>0.00</vFCPSTRet>
                <vProd>${vProdTotal.toFixed(2)}</vProd>
                <vFrete>${vFreteXml.toFixed(2)}</vFrete>
                <vSeg>${vSegXml.toFixed(2)}</vSeg>
                <vDesc>${vDescXml.toFixed(2)}</vDesc>
                <vII>0.00</vII>
                <vIPI>${isDev?'0.00':vIpiTotal.toFixed(2)}</vIPI>
                <vIPIDevol>${isDev?vIpiTotal.toFixed(2):'0.00'}</vIPIDevol>
                <vPIS>${vPisTotal.toFixed(2)}</vPIS>
                <vCOFINS>${vCofTotal.toFixed(2)}</vCOFINS>
                <vOutro>${vOutroXml.toFixed(2)}</vOutro>
                <vNF>${vNFXml.toFixed(2)}</vNF>
            </ICMSTot>
        </total>
    </infNFe>
</NFe>`;
    
    const output = document.getElementById('xml-output');
    if(output) {
        output.value = xml;
        output.scrollIntoView({ behavior: 'smooth' });
    }
}

// ==========================================
// TRANSMISSÃO OFICIAL (JSON)
// ==========================================
async function transmitirParaSefaz() {
    const btn = document.getElementById('btnTransmitir');

    // Validação pré-voo
    const erros = [];
    if (clean(getV('cnpjEmit')).length !== 14) erros.push('CNPJ do emitente inválido ou não selecionado');
    if (clean(getV('cnpjDest')).length !== 14) erros.push('CNPJ do destinatário inválido ou não selecionado');
    if (!getV('ufEmit')) erros.push('UF do emitente vazia — re-selecione a empresa emitente');
    if (!getV('ufDest')) erros.push('UF do destinatário vazia — re-selecione a empresa destinatária');
    if (!getV('xLgrEmit')) erros.push('Endereço do emitente vazio — re-selecione a empresa emitente');
    if (erros.length > 0) { alert('⚠️ Erros antes de transmitir:\n\n' + erros.join('\n')); return; }

    // Valida se o número já foi emitido
    btn.innerText = "⏳ Verificando número...";
    btn.disabled = true;
    const cnpjEmit = clean(getV('cnpjEmit'));
    const nNFNum   = parseInt(getV('nNF'));
    const serieNum = parseInt(getV('serie'));
    const notaDup  = await validarNNFDisponivel(cnpjEmit, nNFNum, serieNum);
    if (notaDup) {
        alert(`⚠️ O número ${serieNum}/${nNFNum} já foi emitido (status: ${notaDup.status}).\nUse um número diferente.`);
        btn.innerText = "TRANSMITIR PARA SEFAZ";
        btn.disabled = false;
        return;
    }

    const confirmado = confirm(
        `Confirma a transmissão da NF-e?\n\n` +
        `Série: ${serieNum}\n` +
        `Número: ${nNFNum}\n\n` +
        `Verifique se estes dados estão corretos antes de continuar.`
    );
    if (!confirmado) {
        btn.innerText = "TRANSMITIR PARA SEFAZ";
        btn.disabled = false;
        return;
    }

    btn.innerText = "⏳ TRANSMITINDO...";
    btn.disabled = true;

    try {
        const fin = getV('finNFe');
        const ref = getV('refNFe');
        const nNF = getV('nNF');

        const ufEmit = getV('ufEmit');
        const ufDest = getV('ufDest');
        const cUF = UF_PARA_CUF[ufEmit] || 35;
        const cMunFG = getV('cMunEmit') || "3550308";

        // idDest derivado do prefixo do CFOP do primeiro item
        const primeiroCFOP = (document.querySelector('.produto-item .cfop')?.value || '5102').trim();
        const cfopPrefixo = primeiroCFOP.charAt(0);
        const idDest = cfopPrefixo === '6' ? 2 : cfopPrefixo === '7' ? 3 : 1;
        const indIEDest = 9;
        const indFinal = idDest === 2 && indIEDest === 9 ? 1 : 0;

        const payload = {
            ambiente: "homologacao",
            referencia: "QA-" + Date.now(),
            infNFe: {
                versao: "4.00",
                ide: {
                    cUF: cUF, natOp: (fin === "4" ? "DEVOLUCAO" : "VENDA"), mod: 55,
                    serie: parseInt(getV('serie')), nNF: parseInt(nNF),
                    dhEmi: (() => { const d = new Date(Date.now() - 3 * 3600000); return d.toISOString().split('.')[0] + "-03:00"; })(),
                    tpNF: 1, idDest: idDest, cMunFG: parseInt(cMunFG), tpImp: 1, tpEmis: 1,
                    tpAmb: 2, finNFe: parseInt(fin),
                    indFinal: indFinal, indPres: 1, procEmi: 0, verProc: "Matrix_v60"
                },
                emit: { CNPJ: clean(getV('cnpjEmit')), xNome: getV('xNomeEmit'), enderEmit: { xLgr: getV('xLgrEmit'), nro: getV('nroEmit'), xBairro: getV('xBairroEmit'), cMun: getV('cMunEmit'), xMun: getV('xMunEmit'), UF: ufEmit, CEP: getV('cepEmit') } },
                dest: { CNPJ: clean(getV('cnpjDest')), xNome: getV('xNomeDest'), indIEDest: indIEDest, enderDest: { xLgr: getV('xLgrDest'), nro: getV('nroDest'), xBairro: getV('xBairroDest'), cMun: getV('cMunDest'), xMun: getV('xMunDest'), UF: getV('ufDest'), CEP: getV('cepDest') } },
                det: [],
                total: { ICMSTot: { vBC: 0, vICMS: 0, vICMSDeson: 0, vFCP: 0, vBCST: 0, vST: 0, vFCPST: 0, vFCPSTRet: 0, vProd: 0, vFrete: 0, vSeg: 0, vDesc: 0, vII: 0, vIPI: 0, vIPIDevol: 0, vPIS: 0, vCOFINS: 0, vOutro: 0, vNF: 0 } },
                transp: (typeof getTranspNFe === 'function') ? getTranspNFe() : { modFrete: 9 },
                pag: { detPag: [{ tPag: "01", vPag: 0 }] }
            }
        };

        if (fin === "4") payload.infNFe.ide.NFref = [{ refNFe: clean(ref) }];

        // ---- Lê campos de despesas/descontos/IPI/ST ----
        const vDescN   = Math.max(0, parseFloat(getV('vDescGlobal')) || 0);
        const vFreteN  = Math.max(0, parseFloat(getV('vFrete'))      || 0);
        const vSegN    = Math.max(0, parseFloat(getV('vSeg'))        || 0);
        const vOutroN  = Math.max(0, parseFloat(getV('vOutro'))      || 0);
        const vFCPN    = Math.max(0, parseFloat(getV('vFCP'))        || 0);
        const pIPIN    = Math.max(0, parseFloat(getV('pIPIGlobal'))  || 0);
        const pSTN     = Math.max(0, parseFloat(getV('pSTGlobal'))   || 0);

        let vTot = 0, vBCTot = 0, vIcmsTot = 0, vPisTot = 0, vCofinsTot = 0, vIPITot = 0;
        const regime    = getV('regimeTrib');
        const isSimples = regime === 'simples';
        const cstGlobal = getV('cstGlobal');
        const pIForm    = parseFloat(getV('pICMSGlobal')) || 0;
        const pPISGlobal    = parseFloat(getV('pPISGlobal')) || 0;
        const pCOFINSGlobal = parseFloat(getV('pCOFINSGlobal')) || 0;
        const semValor  = CST_SEM_VALOR.includes(cstGlobal);

        document.querySelectorAll(".produto-item").forEach((item, i) => {
            const q       = parseFloat(item.querySelector(".qtd").value);
            const v       = parseFloat(item.querySelector(".vUn").value);
            const cfop    = (item.querySelector(".cfop").value || '').trim();
            const pref    = cfop.charAt(0);
            const pPIS    = pPISGlobal;
            const pCOFINS = pCOFINSGlobal;
            const cstVal  = cstGlobal;

            // Alíquota ICMS por CFOP (só aplica se o CST/CSOSN tributa)
            let pI = 0;
            if (!semValor) {
                if (pref === '7')      pI = 0;
                else if (pref === '6') pI = getAliqInterestadual(ufEmit, ufDest);
                else                   pI = pIForm;
            }

            const vP      = q * v;
            const vI      = parseFloat((vP * (pI / 100)).toFixed(2));
            const vPIS    = parseFloat((vP * (pPIS / 100)).toFixed(2));
            const vCOFINS = parseFloat((vP * (pCOFINS / 100)).toFixed(2));
            const vItemIPI = parseFloat((vP * (pIPIN / 100)).toFixed(2));

            vTot += vP;
            if (!semValor) vBCTot += vP;  // BC só acumula quando o CST tributa
            vIcmsTot += vI; vPisTot += vPIS; vCofinsTot += vCOFINS; vIPITot += vItemIPI;

            // Monta nó ICMS conforme regime e CST
            let icmsNode;
            if (isSimples) {
                // Simples Nacional: CSOSN
                if (semValor) {
                    icmsNode = { [`ICMSSN${cstVal}`]: { orig: 0, CSOSN: cstVal } };
                } else {
                    // CSOSN 101 ou 900: tem alíquota
                    icmsNode = { [`ICMSSN${cstVal}`]: { orig: 0, CSOSN: cstVal, modBC: 3, vBC: vP, pCredSN: pI, vCredICMSSN: vI } };
                }
            } else {
                // Regime Normal: CST
                if (semValor) {
                    icmsNode = { [`ICMS${cstVal}`]: { orig: 0, CST: cstVal } };
                } else {
                    icmsNode = { ICMS00: { orig: 0, CST: cstVal, modBC: 3, vBC: vP, pICMS: pI, vICMS: vI } };
                }
            }

            const impostoItem = {
                ICMS: icmsNode,
                PIS:  { PISAliq:    { CST: "01", vBC: vP, pPIS: pPIS,       vPIS: vPIS } },
                COFINS: { COFINSAliq: { CST: "01", vBC: vP, pCOFINS: pCOFINS, vCOFINS: vCOFINS } }
            };
            // IPI por item (Grupo B — soma ao total da nota)
            if (pIPIN > 0) {
                const ipiCST = fin === '4' ? '53' : '50'; // 53 = saída isenta devolução, 50 = saída tributada
                impostoItem.IPI = { cEnq: '999', IPITrib: { CST: ipiCST, vBC: vP, pIPI: pIPIN, vIPI: vItemIPI } };
            }

            payload.infNFe.det.push({
                nItem: i + 1,
                prod: { cProd: (i+1).toString(), cEAN: "SEM GTIN", xProd: item.querySelector(".xProd").value, NCM: "21069090", CFOP: cfop, uCom: "UN", qCom: q, vUnCom: v, vProd: vP, cEANTrib: "SEM GTIN", uTrib: "UN", qTrib: q, vUnTrib: v, indTot: 1 },
                imposto: impostoItem
            });
        });

        // ---- Fechamento do total da nota ----
        const vSubLiqN = Math.max(0, vTot - vDescN);
        const vSTTot   = parseFloat((vSubLiqN * (pSTN / 100)).toFixed(2));
        const vNFN     = parseFloat((vSubLiqN + vIPITot + vSTTot + vFreteN + vSegN + vOutroN + vFCPN).toFixed(2));
        const isDev    = fin === '4';

        payload.infNFe.total.ICMSTot.vBC       = vBCTot;
        payload.infNFe.total.ICMSTot.vICMS      = vIcmsTot;
        payload.infNFe.total.ICMSTot.vProd      = vTot;
        payload.infNFe.total.ICMSTot.vDesc      = vDescN;
        payload.infNFe.total.ICMSTot.vFrete     = vFreteN;
        payload.infNFe.total.ICMSTot.vSeg       = vSegN;
        payload.infNFe.total.ICMSTot.vOutro     = vOutroN;
        payload.infNFe.total.ICMSTot.vIPI       = isDev ? 0 : vIPITot;
        payload.infNFe.total.ICMSTot.vIPIDevol  = isDev ? vIPITot : 0;
        payload.infNFe.total.ICMSTot.vBCST      = vSTTot > 0 ? vSubLiqN : 0;
        payload.infNFe.total.ICMSTot.vST        = vSTTot;
        payload.infNFe.total.ICMSTot.vFCPST     = vFCPN;
        payload.infNFe.total.ICMSTot.vPIS       = vPisTot;
        payload.infNFe.total.ICMSTot.vCOFINS    = vCofinsTot;
        payload.infNFe.total.ICMSTot.vNF        = vNFN;
        payload.infNFe.pag.detPag[0].vPag       = vNFN;

        // Adicionar cobrança/duplicatas se informadas
        const cobranca = getCobrancaNFe();
        if (cobranca) {
            payload.infNFe.cobr = cobranca;
        }

        const resp = await fetch('api/transmitir.php', { method: 'POST', body: JSON.stringify(payload), headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': await getCsrfToken() } });
        const res = await resp.json();

        // Salva payload original no localStorage para reenvio futuro
        if (res.id) {
            try { localStorage.setItem('nfe_payload_' + res.id, JSON.stringify(payload)); } catch(_){}
        }

        exibirResultado(res);

        // Auto-incrementa o número para a próxima emissão
        if (res.status === 'autorizado') {
            const nNFField = document.getElementById('nNF');
            if (nNFField) {
                const proximo = parseInt(nNFField.value) + 1;
                nNFField.value = proximo;
                nNFField.title = `Último número emitido: ${parseInt(nNFField.value) - 1}. Próximo: ${proximo}`;
            }
        }

    } catch (e) {
        console.error(e);
        alert("Erro na transmissão. Verifique o console.");
    } finally {
        btn.innerText = "🚀 TRANSMITIR SEFAZ";
        btn.disabled = false;
    }
}

// ALÍQUOTA INTERESTADUAL ICMS (Resolução SF 22/89 + Res. 13/2012)
function getAliqInterestadual(ufEmit, ufDest) {
    // 4% para mercadoria com conteúdo de importação > 40% (simplificado: não aplicamos aqui)
    // Sul/Sudeste (exceto ES) → outros estados = 7%
    const sulSudeste = ['SP','RJ','MG','PR','RS','SC'];
    if (sulSudeste.includes(ufEmit) && !sulSudeste.includes(ufDest)) return 7;
    // Sul/Sudeste ↔ Sul/Sudeste = 12%
    return 12;
}

// ==========================================
// ==========================================
// CONSULTA DE NOTAS — MODAL
// ==========================================
let _skipAtual = 0;

async function abrirConsulta() {
    console.log('abrirConsulta() chamada');
    document.getElementById('modalConsulta').style.display = 'block';
    document.body.style.overflow = 'hidden';
    initTableResizer('tabelaNfes');
    await popularEmpresasConsulta();
    buscarNotas(0);
}

async function popularEmpresasConsulta() {
    const sel = document.getElementById('filtroEmpresa');
    if (!sel) {
        console.log('filtroEmpresa não encontrado');
        return;
    }
    // Reutiliza dados já carregados no dropdown principal se disponíveis
    const dropEmit = document.getElementById('dropEmit');
    if (dropEmit && dropEmit.options.length > 1) {
        console.log('Reutilizando empresas do dropdown principal');
        sel.innerHTML = Array.from(dropEmit.options).map(o =>
            `<option value="${o.value}" data-nome="${o.dataset.nome || o.text}">${o.text}</option>`
        ).join('');
        initCombobox('cbFiltroEmpresa', 'filtroEmpresa');
        return;
    }
    // Caso contrário carrega da API
    try {
        console.log('Carregando empresas da API...');
        const resp = await fetch('api/listar_empresas.php');
        console.log('Resposta da API:', resp.status, resp.statusText);
        if (!resp.ok) {
            throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
        }
        const res  = await resp.json();
        console.log('Dados recebidos:', res);
        if (res.error) {
            sel.innerHTML = `<option value="">Erro: ${res.error}</option>`;
        } else if (res.data && res.data.length > 0) {
            sel.innerHTML = '<option value="">Selecione a empresa...</option>' + res.data.map(e =>
                `<option value="${e.cpf_cnpj}" data-nome="${e.nome_razao_social}">${e.nome_razao_social}</option>`
            ).join('');
        } else {
            sel.innerHTML = '<option value="">Nenhuma empresa encontrada</option>';
        }
    } catch (e) {
        console.error('Erro ao carregar empresas:', e.message);
        sel.innerHTML = `<option value="">Erro ao carregar empresas: ${e.message}</option>`;
    }
    initCombobox('cbFiltroEmpresa', 'filtroEmpresa');
}

function fecharConsulta() {
    document.getElementById('modalConsulta').style.display = 'none';
    document.body.style.overflow = '';
    fecharDanfeViewer();
}

async function buscarNotas(skip) {
    _skipAtual = skip;
    const top    = parseInt(document.getElementById('filtroTop').value) || 20;
    const status = document.getElementById('filtroStatus').value;
    const cnpj   = (document.getElementById('filtroEmpresa').value || '').replace(/\D/g, '');
    console.log('buscarNotas() chamada:', { top, status, cnpj, skip });
    // Limpa filtro de busca ao recarregar
    const filtroNumInput = document.getElementById('filtroNumero');
    if (filtroNumInput) filtroNumInput.value = '';

    if (!cnpj) {
        console.log('CNPJ vazio, retornando');
        document.getElementById('corpoTabela').innerHTML =
            '<tr><td colspan="8" style="text-align:center;color:#aaa;padding:20px;">Selecione uma empresa para buscar as notas.</td></tr>';
        document.getElementById('loadingNotas').style.display = 'none';
        return;
    }

    document.getElementById('loadingNotas').style.display = '';
    document.getElementById('corpoTabela').innerHTML = '';
    fecharDanfeViewer();

    const params = new URLSearchParams({ top, skip, cpf_cnpj: cnpj });

    try {
        let notas = [];

        if (status) {
            console.log('Buscando com filtro de status:', status);
            // API não suporta filtro — pagina até encontrar `top` registros com o status desejado
            let s = 0, tentativas = 0;
            while (notas.length < top && tentativas < 6) {
                const p = new URLSearchParams({ top: 50, skip: s, cpf_cnpj: cnpj });
                const r = await fetch('api/consultar_nfes.php?' + p);
                console.log('Resposta da API:', r.status);
                const d = await r.json();
                console.log('Dados recebidos:', d);
                if (d.error || !d.data || d.data.length === 0) break;
                notas.push(...d.data.filter(n => n.status === status));
                if (d.data.length < 50) break; // última página
                s += 50;
                tentativas++;
            }
            notas = notas.slice(0, top);
        } else {
            console.log('Buscando sem filtro de status, params:', params.toString());
            const resp = await fetch('api/consultar_nfes.php?' + params);
            console.log('Resposta da API:', resp.status);
            const res  = await resp.json();
            console.log('Dados recebidos:', res);
            if (res.error || !res.data) {
                console.error('Erro na resposta:', res.error);
                document.getElementById('loadingNotas').style.display = 'none';
                document.getElementById('corpoTabela').innerHTML =
                    `<tr><td colspan="8" style="text-align:center;color:#f44336;padding:16px;">${res.error || 'Sem dados'}</td></tr>`;
                return;
            }
            notas = res.data;
        }

        document.getElementById('loadingNotas').style.display = 'none';
        if (notas.length === 0) {
            document.getElementById('corpoTabela').innerHTML =
                '<tr><td colspan="8" style="text-align:center;color:#aaa;padding:20px;">Nenhuma nota encontrada.</td></tr>';
        } else {
            document.getElementById('corpoTabela').innerHTML = notas.map(n => {
                const data    = n.data_emissao ? new Date(n.data_emissao).toLocaleString('pt-BR') : '-';
                // A API de listagem não retorna emitente/destinatário — extraímos o CNPJ emitente da chave
                const cnpjEmit = n.chave ? n.chave.substring(6, 20) : '-';
                const emitente = cnpjEmit !== '-' ? cnpjEmit.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5') : '-';
                const dest    = n.destinatario?.nome || n.destinatario?.razao_social || '-';
                const valor   = n.valor_total != null ? 'R$ ' + parseFloat(n.valor_total).toFixed(2) : '-';
                const st      = n.status || 'outro';
                const badgeCls = { autorizado:'badge-autorizado', rejeitado:'badge-rejeitado', pendente:'badge-pendente', cancelado:'badge-cancelado' }[st] || 'badge-outro';
                const chave   = n.chave || '-';
                const podeImprimir = st === 'autorizado';
                return `<tr data-numero="${n.numero || ''}" data-cnpj="${cnpjEmit}" data-dest="${dest.toLowerCase()}">
                    <td>${data}</td>
                    <td>${n.serie || '-'} / ${n.numero || '-'}</td>
                    <td title="${emitente}">${emitente}</td>
                    <td title="${dest}">${dest}</td>
                    <td>${valor}</td>
                    <td><span class="badge ${badgeCls}">${st}</span></td>
                    <td style="font-family:monospace; font-size:0.75em;" title="${chave}">${chave}</td>
                    <td style="white-space:nowrap;">
                        ${podeImprimir ? `
                        <button class="btn btn-primary" style="padding:4px 10px;font-size:0.8em;" onclick="verDanfeConsulta('${n.id}','${n.serie}/${n.numero}')">Ver PDF</button>
                        <button class="btn btn-success" style="padding:4px 10px;font-size:0.8em;" onclick="baixarDanfeConsulta('${n.id}','${n.serie}/${n.numero}')">Baixar PDF</button>
                        <button class="btn btn-warning" style="padding:4px 10px;font-size:0.8em;" onclick="baixarXmlConsulta('${n.id}','${n.serie}/${n.numero}')">XML</button>
                        <button class="btn btn-danger" style="padding:4px 10px;font-size:0.8em;" onclick="abrirModalCancelamento('${n.id}','${n.serie}/${n.numero}')">🗑️ Cancelar</button>
                        ` : ''}
                        ${st === 'rejeitado' ? `<button class="btn-reenviar" onclick="abrirReenvioNFe('${n.id}','${n.chave || ''}')">↩️ Reenviar</button>` : ''}
                        ${st === 'cancelado' ? `<a class="btn btn-warning" style="padding:4px 10px;font-size:0.8em;text-decoration:none;" href="api/download_xml_cancelamento.php?id=${n.id}" download>📄 XML Cancelamento</a>` : ''}
                        ${!podeImprimir && st !== 'rejeitado' && st !== 'cancelado' ? '<span style="color:#666;font-size:0.8em;">-</span>' : ''}
                    </td>
                </tr>`;
            }).join('');
        }

        // Paginação
        const total = notas.length;
        document.getElementById('infoPaginacao').textContent =
            `Exibindo ${skip + 1}–${Math.min(skip + notas.length, total)} ${total > notas.length ? 'de ' + total : ''}`;
        document.getElementById('btnAnterior').disabled = skip === 0;
        document.getElementById('btnProximo').disabled  = notas.length < top;

    } catch(e) {
        document.getElementById('loadingNotas').style.display = 'none';
        document.getElementById('corpoTabela').innerHTML =
            `<tr><td colspan="8" style="text-align:center;color:#f44336;padding:16px;">Erro: ${e.message}</td></tr>`;
    }
}

function paginarNotas(dir) {
    const top = parseInt(document.getElementById('filtroTop').value) || 20;
    buscarNotas(Math.max(0, _skipAtual + dir * top));
}

function filtrarTabelaNotas() {
    const termo = (document.getElementById('cbFiltroEmpresa')?.value || '').trim().toLowerCase();
    const rows = document.querySelectorAll('#corpoTabela tr[data-numero]');
    rows.forEach(row => {
        if (!termo) { row.style.display = ''; return; }
        const num  = String(row.dataset.numero || '');
        const cnpj = String(row.dataset.cnpj || '');
        const dest = String(row.dataset.dest || '');
        const match = num.includes(termo) || cnpj.includes(termo.replace(/\D/g, '')) || dest.includes(termo);
        row.style.display = match ? '' : 'none';
    });
}

let _idDanfeViewer = null;

function verDanfeConsulta(id, label) {
    _idDanfeViewer = id;
    const viewer = document.getElementById('danfeViewer');
    document.getElementById('danfeTitulo').textContent = `DANFE — Nota ${label}`;
    document.getElementById('iframeConsulta').src = `api/danfe.php?id=${id}`;
    viewer.style.display = '';
    viewer.scrollIntoView({ behavior: 'smooth' });
}

function baixarXmlViewer() {
    if (!_idDanfeViewer) return;
    const a = document.createElement('a');
    a.href = `api/download_xml.php?id=${_idDanfeViewer}`;
    a.download = `NFe_${_idDanfeViewer}.xml`;
    a.click();
}

function baixarDanfeConsulta(id, label) {
    const a = document.createElement('a');
    a.href  = `api/danfe.php?id=${id}`;
    a.download = `DANFE_${label.replace('/','-')}.pdf`;
    a.click();
}

function baixarXmlConsulta(id, label) {
    const a = document.createElement('a');
    a.href  = `api/download_xml.php?id=${id}`;
    a.download = `NFe_${label.replace('/','-')}.xml`;
    a.click();
}

function fecharDanfeViewer() {
    const viewer = document.getElementById('danfeViewer');
    if (!viewer) return;
    document.getElementById('iframeConsulta').src = '';
    viewer.style.display = 'none';
}

// Fecha a modal clicando fora do box
document.addEventListener('click', e => {
    const modal = document.getElementById('modalConsulta');
    if (e.target === modal) fecharConsulta();
});

// ==========================================
// PAINEL DE RESULTADO + DANFE
// ==========================================
let _ultimoIdNfe = null;

function exibirResultado(res) {
    _ultimoIdNfe = res.id || null;
    const painel  = document.getElementById('painelResultado');
    const status  = res.status || (res.error ? 'erro' : '?');
    const autorz  = res.autorizacao || {};
    const motivo  = autorz.motivo_status || res.error?.message || '';
    const isOk    = status === 'autorizado';

    // Visual do painel
    painel.className = 'result-panel ' + (isOk ? 'success' : 'error');

    document.getElementById('resIcone').textContent  = isOk ? '✅' : '❌';
    document.getElementById('resIcone').className    = 'result-icon ' + (isOk ? 'success' : 'error');
    document.getElementById('resStatus').textContent  = isOk ? 'Autorizado' : status.charAt(0).toUpperCase() + status.slice(1);
    document.getElementById('resSubtitle').textContent = isOk
        ? `Protocolo: ${autorz.numero_protocolo || '-'}`
        : 'A nota não foi aceita pela SEFAZ';
    document.getElementById('resId').textContent      = res.id || '-';
    document.getElementById('resSerieNum').textContent = res.serie && res.numero ? `${res.serie} / ${res.numero}` : '-';
    document.getElementById('resChave').textContent   = res.chave || autorz.chave_acesso || '-';
    document.getElementById('resMotivo').textContent  = motivo;

    const btnView = document.getElementById('btnDanfe');
    const btnDown = document.getElementById('btnDanfeDown');
    const btnXml  = document.getElementById('btnXmlDown');
    if (isOk && res.id) {
        btnView.style.display = '';
        btnDown.style.display = '';
        if (btnXml) btnXml.style.display = '';
    } else {
        btnView.style.display = 'none';
        btnDown.style.display = 'none';
        if (btnXml) btnXml.style.display = 'none';
        document.getElementById('iframeDanfe').style.display = 'none';
    }

    painel.style.display = 'block';
    painel.scrollIntoView({ behavior: 'smooth', block: 'start' });

    showToast(
        isOk ? `NF-e ${res.serie}/${res.numero} autorizada com sucesso!` : `Nota ${status}: ${motivo.substring(0, 60)}...`,
        isOk ? 'success' : 'error'
    );
}

function showToast(msg, type = 'info', duration = 5000) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    const icon = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' }[type] || 'ℹ️';
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${icon}</span><span>${msg}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('fadeout');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

const mostrarToast = showToast;

function abrirDanfe() {
    if (!_ultimoIdNfe) return;
    const div   = document.getElementById('iframeDanfe');
    const frame = document.getElementById('frameNota');
    frame.src   = `api/danfe.php?id=${_ultimoIdNfe}`;
    div.style.display = '';
    div.scrollIntoView({ behavior: 'smooth' });
}

function baixarDanfe() {
    if (!_ultimoIdNfe) return;
    const a  = document.createElement('a');
    a.href   = `api/danfe.php?id=${_ultimoIdNfe}`;
    a.download = `DANFE_${_ultimoIdNfe}.pdf`;
    a.click();
}

function baixarXml() {
    if (!_ultimoIdNfe) return;
    const a  = document.createElement('a');
    a.href   = `api/download_xml.php?id=${_ultimoIdNfe}`;
    a.download = `NFe_${_ultimoIdNfe}.xml`;
    a.click();
}

// MAPEAMENTO UF → cUF (IBGE)
const UF_PARA_CUF = {
    AC:12, AL:27, AP:16, AM:13, BA:29, CE:23, DF:53, ES:32, GO:52,
    MA:21, MT:51, MS:50, MG:31, PA:15, PB:25, PR:41, PE:26, PI:22,
    RJ:33, RN:24, RS:43, RO:11, RR:14, SC:42, SP:35, SE:28, TO:17
};

// Alíquota interna de ICMS por UF — para cálculo do DIFAL (EC 87/2015)
const ALIQ_INTERNA_ICMS = {
    AC:17, AL:17, AP:18, AM:20, BA:19, CE:18, DF:18, ES:17, GO:17,
    MA:18, MT:17, MS:17, MG:18, PA:17, PB:18, PR:19, PE:18, PI:18,
    RJ:20, RN:18, RS:17, RO:17, RR:20, SC:17, SP:18, SE:19, TO:18
};


// DROPDOWNS
async function carregarDropdownsEmpresas() {
    try {
        const resp = await fetch('api/listar_empresas.php');
        if (!resp.ok) {
            const txt = await resp.text();
            console.error('listar_empresas.php retornou HTTP', resp.status, txt);
            return;
        }
        const res = await resp.json();
        console.log('Resposta da API de empresas:', res);
        if (res.error || !res.data || res.data.length === 0) {
            console.error('Erro da API de empresas ou sem dados:', res.error || res);
            return;
        }
        let opt = res.data.map(e => {
            const end = e.endereco || {};
            const tipo = e.tipo_empresa || 'cliente';
            return `<option value="${e.cpf_cnpj}"
                data-nome="${e.nome_razao_social}"
                data-tipo="${tipo}"
                data-uf="${end.uf || ''}"
                data-cmun="${end.codigo_municipio || ''}"
                data-xmun="${end.cidade || ''}"
                data-xlgr="${end.logradouro || ''}"
                data-nro="${end.numero || 'SN'}"
                data-xbairro="${end.bairro || ''}"
                data-cep="${(end.cep || '').replace(/\D/g,'')}"
                data-ie="${e.inscricao_estadual || ''}"
            >${e.nome_razao_social}</option>`;
        }).join('');
        console.log('Opções criadas:', opt);
        
        // Filtrar transportadoras para dropdown de transporte
        const transportadoras = res.data.filter(e => (e.tipo_empresa || 'cliente') === 'transportadora');
        let optTransp = transportadoras.map(e => {
            const end = e.endereco || {};
            return `<option value="${e.cpf_cnpj}"
                data-nome="${e.nome_razao_social}"
                data-tipo="transportadora"
                data-uf="${end.uf || ''}"
                data-cmun="${end.codigo_municipio || ''}"
                data-xmun="${end.cidade || ''}"
                data-xlgr="${end.logradouro || ''}"
                data-nro="${end.numero || 'SN'}"
                data-xbairro="${end.bairro || ''}"
                data-cep="${(end.cep || '').replace(/\D/g,'')}"
                data-ie="${e.inscricao_estadual || ''}"
            >${e.nome_razao_social}</option>`;
        }).join('');
        
        document.getElementById('dropEmit').innerHTML = '<option value="">Selecione...</option>' + opt;
        document.getElementById('dropDest').innerHTML = '<option value="">Selecione...</option>' + opt;
        document.getElementById('dropTransp').innerHTML = '<option value="">Selecione transportadora...</option>' + optTransp;
        
        // Popular também os dropdowns do CT-e se existirem
        const dropCteEmit = document.getElementById('dropCteEmit');
        if (dropCteEmit) dropCteEmit.innerHTML = '<option value="">Selecione transportadora...</option>' + optTransp;

        const dropCteRem = document.getElementById('dropCteRem');
        if (dropCteRem) dropCteRem.innerHTML = '<option value="">Selecione remetente...</option>' + opt;

        const dropCteDest = document.getElementById('dropCteDest');
        if (dropCteDest) dropCteDest.innerHTML = '<option value="">Selecione destinatário...</option>' + opt;
        
        const filtroEmpresaCte = document.getElementById('filtroEmpresaCte');
        if (filtroEmpresaCte) filtroEmpresaCte.innerHTML = '<option value="">Selecione transportadora...</option>' + optTransp;

        initCombobox('cbEmit', 'dropEmit');
        initCombobox('cbDest', 'dropDest');
        initCombobox('cbTransp', 'dropTransp');
        initCombobox('cbCteEmit', 'dropCteEmit');
        initCombobox('cbCteRem', 'dropCteRem');
        initCombobox('cbCteDest', 'dropCteDest');
        initCombobox('cbFiltroCte', 'filtroEmpresaCte');
    } catch(e) { console.error("Erro ao carregar empresas", e); }
}

function initCombobox(inputId, selectId) {
    const input  = document.getElementById(inputId);
    const select = document.getElementById(selectId);
    const list   = document.getElementById(inputId + 'List');
    if (!input || !select || !list) return;

    // Prevent double-init
    if (input._cbInited) return;
    input._cbInited = true;

    function getOpts() {
        return Array.from(select.options).filter(o => o.value);
    }

    function renderOpts(filtered) {
        if (!filtered.length) return false;
        list.innerHTML = filtered.map(o =>
            `<div class="combobox-option" data-value="${o.value}" data-nome="${o.dataset.nome || o.text}">${o.dataset.nome || o.text}</div>`
        ).join('');
        list.classList.add('open');
        return true;
    }

    function addEmpresaOption(e) {
        const end = e.endereco || {};
        const opt = document.createElement('option');
        opt.value = e.cpf_cnpj;
        opt.text  = e.nome_razao_social;
        opt.dataset.nome    = e.nome_razao_social;
        opt.dataset.uf      = end.uf || '';
        opt.dataset.cmun    = end.codigo_municipio || '';
        opt.dataset.xmun    = end.cidade || '';
        opt.dataset.xlgr    = end.logradouro || '';
        opt.dataset.nro     = end.numero || 'SN';
        opt.dataset.xbairro = end.bairro || '';
        opt.dataset.cep     = (end.cep || '').replace(/\D/g, '');
        opt.dataset.ie      = e.inscricao_estadual || '';
        // Adiciona nos dois dropdowns para manter sincronizado
        ['dropEmit','dropDest'].forEach(id => {
            const sel = document.getElementById(id);
            if (sel && !sel.querySelector(`option[value="${e.cpf_cnpj}"]`)) {
                sel.appendChild(opt.cloneNode(true));
            }
        });
    }

    function render(termo) {
        const t = (termo || '').trim().toLowerCase().replace(/[.\-\/]/g, '');
        const filtered = !t ? getOpts() : getOpts().filter(o => {
            const nome = (o.dataset.nome || o.text || '').toLowerCase();
            const cnpj = (o.value || '').replace(/\D/g, '');
            return nome.includes(t) || cnpj.includes(t);
        });
        if (renderOpts(filtered)) return;

        // Sem resultado local — tenta busca live se parecer CNPJ
        const cnpjDigits = t.replace(/\D/g, '');
        if (cnpjDigits.length >= 8) {
            list.innerHTML = '<div class="combobox-empty">Buscando...</div>';
            list.classList.add('open');
            fetch('api/cadastrar_empresa.php?cpf_cnpj=' + cnpjDigits)
                .then(r => r.json())
                .then(data => {
                    if (data && data.cpf_cnpj) {
                        addEmpresaOption(data);
                        // Re-renderiza com o novo resultado
                        const novo = getOpts().filter(o => o.value.replace(/\D/g,'').includes(cnpjDigits));
                        if (!renderOpts(novo)) {
                            list.innerHTML = '<div class="combobox-empty">Empresa não encontrada na Nuvem Fiscal</div>';
                        }
                    } else {
                        list.innerHTML = '<div class="combobox-empty">Empresa não encontrada na Nuvem Fiscal</div>';
                    }
                })
                .catch(() => {
                    list.innerHTML = '<div class="combobox-empty">Erro ao buscar empresa</div>';
                });
        } else {
            list.innerHTML = '<div class="combobox-empty">Nenhum resultado</div>';
            list.classList.add('open');
        }
    }

    function close() { list.classList.remove('open'); }

    input.addEventListener('input',  () => render(input.value));
    input.addEventListener('focus',  () => render(input.value));
    input.addEventListener('keydown', e => {
        if (!list.classList.contains('open')) return;
        const items = list.querySelectorAll('.combobox-option');
        const focused = list.querySelector('.cb-focus');
        let idx = Array.from(items).indexOf(focused);
        if (e.key === 'ArrowDown') { e.preventDefault(); idx = Math.min(idx + 1, items.length - 1); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); idx = Math.max(idx - 1, 0); }
        else if (e.key === 'Enter' && focused) { e.preventDefault(); focused.dispatchEvent(new MouseEvent('mousedown', {bubbles:true})); return; }
        else if (e.key === 'Escape') { close(); return; }
        else return;
        items.forEach(i => i.classList.remove('cb-focus'));
        if (items[idx]) { items[idx].classList.add('cb-focus'); items[idx].scrollIntoView({block:'nearest'}); }
    });

    list.addEventListener('mousedown', e => {
        const opt = e.target.closest('.combobox-option');
        if (!opt || !opt.dataset.value) return;
        e.preventDefault();
        select.value = opt.dataset.value;
        input.value  = opt.dataset.nome || opt.dataset.value;
        close();
        select.dispatchEvent(new Event('change'));
    });

    document.addEventListener('click', e => {
        if (!input.contains(e.target) && !list.contains(e.target)) close();
    }, true);
}

function filtrarDropdown(selectId, termo) {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    const t = termo.trim().toLowerCase().replace(/[.\-\/]/g, '');
    Array.from(sel.options).forEach(opt => {
        if (!opt.value) return; // keep placeholder visible
        const nome = (opt.dataset.nome || opt.text || '').toLowerCase();
        const cnpj = (opt.value || '').replace(/\D/g, '');
        const match = !t || nome.includes(t) || cnpj.includes(t);
        opt.hidden = !match;
    });
}

function selecionarEmpresa(sel, tipo) {
    const t = tipo === 'emit' ? 'Emit' : 'Dest';
    const d = sel.options[sel.selectedIndex].dataset;
    document.getElementById('cnpj' + t).value = sel.value;
    document.getElementById('xNome' + t).value = d.nome || "";
    document.getElementById('uf' + t).value = d.uf || "";
    document.getElementById('cMun' + t).value = d.cmun || "";
    document.getElementById('xMun' + t).value = d.xmun || "";
    document.getElementById('xLgr' + t).value = d.xlgr || "";
    document.getElementById('nro' + t).value = d.nro || "SN";
    document.getElementById('xBairro' + t).value = d.xbairro || "";
    document.getElementById('cep' + t).value = d.cep || "";

    if (tipo === 'emit' && sel.value) {
        buscarProximoNNF(sel.value.replace(/\D/g, ''));
    }
}

async function buscarProximoNNF(cnpj) {
    const nNFField = document.getElementById('nNF');
    if (!nNFField || !cnpj) return;
    nNFField.title = 'Buscando próximo número...';
    try {
        const params = new URLSearchParams({ top: 1, skip: 0, cpf_cnpj: cnpj, '$orderby': 'numero desc' });
        const resp = await fetch('api/consultar_nfes.php?' + params);
        const res  = await resp.json();
        const notas = res.data || [];
        const maior = notas.length > 0 ? (parseInt(notas[0].numero) || 0) : 0;
        nNFField.value = maior + 1;
        nNFField.title = `Último número emitido: ${maior}. Próximo: ${maior + 1}`;
    } catch(e) {
        nNFField.title = 'Não foi possível buscar o último número';
    }
}

async function validarNNFDisponivel(cnpj, nNF, serie) {
    try {
        const params = new URLSearchParams({ top: 1, skip: 0, cpf_cnpj: cnpj, numero: nNF, serie: serie });
        const resp = await fetch('api/consultar_nfes.php?' + params);
        const res  = await resp.json();
        const notas = res.data || [];
        return notas.length > 0 ? notas[0] : null;
    } catch(e) {
        return null;
    }
}

// Validação em tempo real dos campos nNF e serie
let _nnfDebounce = null;
function iniciarValidacaoNNF() {
    const nNFField   = document.getElementById('nNF');
    const serieField = document.getElementById('serie');
    if (!nNFField || !serieField) return;

    let aviso = document.getElementById('nnfAviso');
    if (!aviso) {
        aviso = document.createElement('div');
        aviso.id = 'nnfAviso';
        aviso.style.cssText = 'font-size:12px;margin-top:4px;padding:4px 8px;border-radius:4px;display:none;';
        nNFField.parentElement.appendChild(aviso);
    }

    async function checar() {
        const cnpj  = document.getElementById('cnpjEmit')?.value.replace(/\D/g, '');
        const nNF   = parseInt(nNFField.value);
        const serie = parseInt(serieField.value);
        if (!cnpj || cnpj.length !== 14 || !nNF || !serie) {
            aviso.style.display = 'none';
            return;
        }
        aviso.style.cssText += ';display:block;background:#fffbe6;color:#856404;border:1px solid #ffc107;';
        aviso.textContent = `Verificando série ${serie} / nº ${nNF}...`;
        const dup = await validarNNFDisponivel(cnpj, nNF, serie);
        if (dup) {
            aviso.style.cssText = 'font-size:12px;margin-top:4px;padding:4px 8px;border-radius:4px;display:block;background:#f8d7da;color:#842029;border:1px solid #f5c2c7;';
            aviso.textContent = `⚠️ Série ${serie} / nº ${nNF} já foi emitido (status: ${dup.status}). Escolha outro número.`;
            nNFField.style.borderColor = '#dc3545';
        } else {
            aviso.style.cssText = 'font-size:12px;margin-top:4px;padding:4px 8px;border-radius:4px;display:block;background:#d1e7dd;color:#0a3622;border:1px solid #a3cfbb;';
            aviso.textContent = `✓ Série ${serie} / nº ${nNF} disponível.`;
            nNFField.style.borderColor = '';
        }
    }

    function agendarChecagem() {
        clearTimeout(_nnfDebounce);
        _nnfDebounce = setTimeout(checar, 600);
    }

    nNFField.addEventListener('change', agendarChecagem);
    nNFField.addEventListener('input',  agendarChecagem);
    serieField.addEventListener('change', agendarChecagem);
}

// ==========================================
// CADASTRO DE EMPRESA — MODAL
// ==========================================

let _empCpfCnpjAtual = '';   // CNPJ/CPF da empresa salva (habilita aba cert)

// --- Abertura / fechamento ---
function abrirCadastroEmpresa() {
    document.getElementById('modalEmpresa').style.display = 'block';
    document.body.style.overflow = 'hidden';
    empResetarModal();
}

function fecharCadastroEmpresa() {
    document.getElementById('modalEmpresa').style.display = 'none';
    document.body.style.overflow = '';
}

function empResetarModal() {
    // Limpa campos
    ['empCpfCnpj','empRazaoSocial','empNomeFantasia','empEmail','empFone',
     'empIE','empIM','empCep','empLogradouro','empNumero',
     'empComplemento','empBairro','empCidade','empUF','empCodigoIBGE']
        .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });

    document.getElementById('empTipoJuridica').checked = true;
    empAlternarTipo();

    // Volta para aba 1 e desabilita aba 2
    trocarAbaEmpresa('dados');
    document.getElementById('empTabBtnCert').disabled = true;

    empOcultarAlert();
    _empCpfCnpjAtual = '';
}

// --- Troca de aba ---
function trocarAbaEmpresa(aba) {
    document.getElementById('empAbaDados').classList.toggle('active', aba === 'dados');
    document.getElementById('empAbaCert').classList.toggle('active', aba === 'cert');
    document.getElementById('empTabBtnDados').classList.toggle('active', aba === 'dados');
    document.getElementById('empTabBtnCert').classList.toggle('active', aba === 'cert');

    if (aba === 'cert' && _empCpfCnpjAtual) {
        empVerificarCertificado(_empCpfCnpjAtual);
    }
}

// --- Alert helper ---
function empMostrarAlert(msg, tipo = 'info') {
    const icons = { info: 'ℹ️', success: '✅', error: '❌', warning: '⚠️' };
    const el    = document.getElementById('empAlert');
    document.getElementById('empAlertIcon').textContent = icons[tipo] || 'ℹ️';
    document.getElementById('empAlertMsg').textContent  = msg;
    el.className = `emp-alert ${tipo} show`;
}

function empOcultarAlert() {
    const el = document.getElementById('empAlert');
    el.className = 'emp-alert info';
}

// --- Tipo Jurídica / Física ---
function empAlternarTipo() {
    const isPF = document.getElementById('empTipoPF').checked;
    document.getElementById('empLabelDoc').firstChild.textContent = isPF ? 'CPF ' : 'CNPJ ';
    document.getElementById('empCpfCnpj').placeholder = isPF ? '000.000.000-00' : '00.000.000/0000-00';
    document.getElementById('empCpfCnpj').maxLength    = isPF ? 14 : 18;
    document.getElementById('empBtnBuscar').style.display = isPF ? 'none' : '';
}

function empGetTipoEmpresa() {
    return document.getElementById('empTipoEmpresaTransportadora').checked ? 'transportadora' : 'cliente';
}

// --- Máscaras ---
function empMascaraDoc(el) {
    const isPF  = document.getElementById('empTipoPF').checked;
    let d = el.value.replace(/\D/g, '');
    if (isPF) {
        d = d.slice(0, 11);
        el.value = d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    } else {
        d = d.slice(0, 14);
        el.value = d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }
}

function empMascaraCep(el) {
    let d = el.value.replace(/\D/g, '').slice(0, 8);
    el.value = d.length > 5 ? d.replace(/(\d{5})(\d{1,3})/, '$1-$2') : d;
}

// --- Busca CNPJ na Receita Federal ---
async function empBuscarCNPJ() {
    const cnpj = document.getElementById('empCpfCnpj').value.replace(/\D/g, '');
    if (cnpj.length !== 14) { empMostrarAlert('Informe um CNPJ completo (14 dígitos) antes de buscar.', 'warning'); return; }

    // Reseta modo de edição ao buscar novo CNPJ
    _empCpfCnpjAtual = null;
    empAtualizarBotaoSalvar();

    const loading = document.getElementById('empLoadingDoc');
    loading.style.display = 'flex';
    empOcultarAlert();

    try {
        const resp = await fetch(`api/buscar_cnpj.php?cnpj=${cnpj}`);
        const res  = await resp.json();
        loading.style.display = 'none';

        if (res.error) { empMostrarAlert('Erro ao consultar CNPJ: ' + res.error, 'error'); return; }

        // Preenche campos com dados da Receita Federal
        const end = res.estabelecimento?.endereco || res.endereco || {};
        document.getElementById('empRazaoSocial').value   = res.razao_social  || res.nome || '';
        document.getElementById('empNomeFantasia').value  = res.nome_fantasia || res.estabelecimento?.nome_fantasia || '';
        document.getElementById('empEmail').value         = res.email || '';
        document.getElementById('empFone').value          = res.telefones?.[0]
            ? `(${res.telefones[0].ddd}) ${res.telefones[0].numero}` : '';
        document.getElementById('empCep').value           = (end.cep || '').replace(/(\d{5})(\d{3})/, '$1-$2');
        document.getElementById('empLogradouro').value    = end.logradouro || '';
        document.getElementById('empNumero').value        = end.numero     || 'SN';
        document.getElementById('empComplemento').value   = end.complemento || '';
        document.getElementById('empBairro').value        = end.bairro      || '';
        document.getElementById('empCidade').value        = end.municipio?.descricao || end.cidade || '';
        document.getElementById('empUF').value            = end.estado?.sigla || end.uf || '';
        document.getElementById('empCodigoIBGE').value    = end.municipio?.codigo_ibge || end.codigo_municipio || '';

        if (res.empresa_cadastrada) {
            _empCpfCnpjAtual = cnpj;
            empHabilitarAbaCert();
            empAtualizarBotaoSalvar();
            empMostrarAlert('Empresa já cadastrada na Nuvem Fiscal. Dados carregados para conferência. Você pode atualizar os dados ou ir direto para o Certificado Digital.', 'info');
        } else {
            empAtualizarBotaoSalvar();
            empMostrarAlert('Dados da Receita Federal carregados. Confira as informações e clique em "Salvar Empresa".', 'success');
        }

    } catch(e) {
        loading.style.display = 'none';
        empMostrarAlert('Falha na conexão ao buscar o CNPJ. Tente novamente.', 'error');
    }
}

// --- Busca CEP via ViaCEP ---
async function empBuscarCEP() {
    const cep = document.getElementById('empCep').value.replace(/\D/g, '');
    if (cep.length !== 8) { empMostrarAlert('Informe um CEP válido (8 dígitos).', 'warning'); return; }

    try {
        const resp = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const res  = await resp.json();
        if (res.erro) { empMostrarAlert('CEP não encontrado.', 'warning'); return; }

        document.getElementById('empLogradouro').value  = res.logradouro || '';
        document.getElementById('empBairro').value      = res.bairro     || '';
        document.getElementById('empCidade').value      = res.localidade || '';
        document.getElementById('empUF').value          = res.uf         || '';
        document.getElementById('empCodigoIBGE').value  = res.ibge       || '';
        document.getElementById('empNumero').focus();
    } catch(e) {
        empMostrarAlert('Falha ao buscar o CEP. Verifique sua conexão.', 'error');
    }
}

// --- Salvar / Atualizar empresa (POST ou PUT /empresas) ---
async function empSalvar() {
    const cnpj = document.getElementById('empCpfCnpj').value.replace(/\D/g, '');
    if (!cnpj) { empMostrarAlert('Informe o CNPJ/CPF antes de salvar.', 'warning'); return; }
    if (!document.getElementById('empRazaoSocial').value.trim()) {
        empMostrarAlert('O campo Razão Social é obrigatório.', 'warning'); return;
    }

    const modoAtualizar = !!_empCpfCnpjAtual;
    const btn = document.getElementById('empBtnSalvar');
    btn.disabled  = true;
    btn.innerText = '⏳ ' + (modoAtualizar ? 'Atualizando...' : 'Salvando...');
    empOcultarAlert();

    const payload = {
        cpf_cnpj:           cnpj,
        nome_razao_social:  document.getElementById('empRazaoSocial').value.trim(),
        nome_fantasia:      document.getElementById('empNomeFantasia').value.trim(),
        email:              document.getElementById('empEmail').value.trim(),
        fone:               document.getElementById('empFone').value.replace(/\D/g, ''),
        tipo_empresa:       empGetTipoEmpresa(),
        inscricao_estadual: document.getElementById('empIE').value.trim(),
        inscricao_municipal:document.getElementById('empIM').value.trim(),
        endereco: {
            logradouro:       document.getElementById('empLogradouro').value.trim(),
            numero:           document.getElementById('empNumero').value.trim() || 'SN',
            complemento:      document.getElementById('empComplemento').value.trim(),
            bairro:           document.getElementById('empBairro').value.trim(),
            cidade:           document.getElementById('empCidade').value.trim(),
            uf:               document.getElementById('empUF').value.trim().toUpperCase(),
            cep:              document.getElementById('empCep').value.replace(/\D/g, ''),
            codigo_municipio: document.getElementById('empCodigoIBGE').value.trim(),
            codigo_pais:      '1058',
            pais:             'Brasil'
        }
    };

    try {
        const resp = await fetch('api/cadastrar_empresa.php', {
            method: modoAtualizar ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': await getCsrfToken() },
            body: JSON.stringify(payload)
        });
        const res = await resp.json();

        if (res.already_exists || resp.status === 409) {
            _empCpfCnpjAtual = cnpj;
            empHabilitarAbaCert();
            empMostrarAlert(res.message || 'Empresa já cadastrada. Prossiga para o Certificado Digital.', 'info');
        } else if (resp.ok && (res.id || res.cpf_cnpj)) {
            _empCpfCnpjAtual = cnpj;
            empHabilitarAbaCert();
            const msg = modoAtualizar
                ? 'Dados atualizados com sucesso!'
                : 'Empresa cadastrada com sucesso! Prossiga para o envio do Certificado Digital.';
            empMostrarAlert(msg, 'success');
            showToast(msg, 'success');
            carregarDropdownsEmpresas();
        } else {
            const msg = res.message || res.error || JSON.stringify(res).substring(0, 200);
            empMostrarAlert('Erro: ' + msg, 'error');
        }
    } catch(e) {
        empMostrarAlert('Falha na conexão. Verifique o servidor PHP e tente novamente.', 'error');
    } finally {
        btn.disabled  = false;
        empAtualizarBotaoSalvar();
    }
}

function empHabilitarAbaCert() {
    document.getElementById('empTabBtnCert').disabled = false;
}

function empAtualizarBotaoSalvar() {
    const btn = document.getElementById('empBtnSalvar');
    btn.innerText = _empCpfCnpjAtual ? '💾 Atualizar Empresa' : '💾 Salvar Empresa';
}

// --- Verificar status do certificado ---
async function empVerificarCertificado(cpfCnpj) {
    document.getElementById('certStatusValue').textContent = 'Verificando...';
    document.getElementById('certVencimento').textContent  = '—';
    document.getElementById('certTitular').textContent     = '—';
    document.getElementById('certStatusDot').className     = 'cert-status-dot inativo';

    try {
        const resp = await fetch(`api/upload_certificado.php?cpf_cnpj=${cpfCnpj.replace(/\D/g,'')}`);
        const res  = await resp.json();

        if (resp.ok && res.data_validade) {
            const venc    = new Date(res.data_validade);
            const hoje    = new Date();
            const diasRest = Math.ceil((venc - hoje) / 86400000);
            const expirado = diasRest < 0;
            const expirando = diasRest >= 0 && diasRest <= 30;

            document.getElementById('certStatusValue').textContent  = expirado ? 'Expirado' : 'Ativo';
            document.getElementById('certVencimento').textContent   = venc.toLocaleDateString('pt-BR');
            document.getElementById('certTitular').textContent      = res.nome_razao_social || '—';

            const dot = document.getElementById('certStatusDot');
            dot.className = 'cert-status-dot ' + (expirado ? 'inativo' : expirando ? 'expirando' : 'ativo');

            if (expirando && !expirado) {
                empMostrarAlert(`Certificado expira em ${diasRest} dia(s). Faça o upload do novo certificado abaixo.`, 'warning');
            }
        } else {
            document.getElementById('certStatusValue').textContent = 'Nenhum certificado ativo';
            empMostrarAlert('Nenhum certificado encontrado. Faça o upload do arquivo .pfx ou .p12 abaixo.', 'info');
        }
    } catch(e) {
        document.getElementById('certStatusValue').textContent = 'Erro ao verificar';
    }
}

// --- Seleção de arquivo ---
function empArquivoSelecionado(input) {
    const nomEl = document.getElementById('certArquivoNome');
    if (input.files && input.files[0]) {
        nomEl.textContent    = '📎 ' + input.files[0].name;
        nomEl.style.display  = 'block';
        document.querySelector('.upload-area-text').textContent = 'Arquivo selecionado';
    } else {
        nomEl.style.display = 'none';
        document.querySelector('.upload-area-text').textContent = 'Clique ou arraste o arquivo aqui';
    }
}

// --- Upload do certificado (PUT /empresas/{cpf_cnpj}/certificado) ---
async function empUploadCertificado() {
    const fileInput = document.getElementById('certArquivo');
    const arquivo   = fileInput._droppedFile || (fileInput.files && fileInput.files[0]);
    const senha     = document.getElementById('certSenha').value;

    if (!arquivo) {
        empMostrarAlert('Selecione o arquivo do certificado (.pfx ou .p12) antes de enviar.', 'warning'); return;
    }
    if (!senha) {
        empMostrarAlert('Informe a senha do certificado.', 'warning'); return;
    }
    if (!_empCpfCnpjAtual) {
        empMostrarAlert('CNPJ/CPF não identificado. Volte à aba de Dados Cadastrais.', 'error'); return;
    }

    const btn = document.getElementById('empBtnCert');
    btn.disabled  = true;
    btn.innerText = '⏳ Enviando...';
    empOcultarAlert();

    const form = new FormData();
    form.append('cpf_cnpj', _empCpfCnpjAtual.replace(/\D/g, ''));
    form.append('senha', senha);
    form.append('certificado', arquivo);

    try {
        const resp = await fetch('api/upload_certificado.php', { method: 'POST', body: form, headers: { 'X-CSRF-Token': await getCsrfToken() } });
        const res  = await resp.json();

        if (resp.ok && !res.error) {
            empMostrarAlert('Certificado enviado com sucesso! A empresa está pronta para emissão de NF-e.', 'success');
            showToast('Certificado digital enviado com sucesso!', 'success');
            document.getElementById('certSenha').value = '';
            fileInput.value = '';
            fileInput._droppedFile = null;
            document.getElementById('certArquivoNome').style.display = 'none';
            document.querySelector('.upload-area-text').textContent = 'Clique ou arraste o arquivo aqui';
            empVerificarCertificado(_empCpfCnpjAtual);
        } else {
            const errObj = res.error || {};
            const errMsg = typeof errObj === 'object'
                ? (errObj.message || JSON.stringify(errObj))
                : String(errObj);
            const errCode = typeof errObj === 'object' ? errObj.code : '';
            const msgFinal = errCode === 'InvalidCertificateOrPassword'
                ? 'Certificado ou senha inválidos. Verifique se o arquivo .pfx/.p12 e a senha estão corretos.'
                : ('Erro ao enviar certificado: ' + (res.message || errMsg || 'Tente novamente.'));
            empMostrarAlert(msgFinal, 'error');
        }
    } catch(e) {
        empMostrarAlert('Falha na conexão ao enviar o certificado. Verifique o servidor e tente novamente.', 'error');
    } finally {
        btn.disabled  = false;
        btn.innerText = '🔐 Enviar Certificado';
    }
}

// Fechar modal clicando no overlay
document.getElementById('modalEmpresa').addEventListener('click', function(e) {
    if (e.target === this) fecharCadastroEmpresa();
});

// ==========================================
// REENVIO DE NF-e — MODAL
// ==========================================

let _rnvNota   = null;   // full NF-e object from API
let _rnvId     = '';     // NF-e ID
let _rnvEmit   = null;   // dados cadastrais do emitente (da empresa cadastrada)

// Mapa de rejeições SEFAZ: código → {titulo, descricao, solucao}
const REJEICAO_DICT = {
    '100': { titulo: 'Autorizado', descricao: 'Nota autorizada com sucesso.', solucao: null, tipo: 'autorizacao' },
    '101': { titulo: 'Cancelamento homologado', descricao: 'Nota cancelada com sucesso.', solucao: null, tipo: 'cancelamento' },
    '110': { titulo: 'Denegada', descricao: 'Nota denegada pela SEFAZ.', solucao: 'Verifique a situação cadastral do emitente ou destinatário.', tipo: 'rejeicao' },
    '204': { titulo: 'Duplicidade de NF-e', descricao: 'A chave de acesso já existe na SEFAZ.', solucao: 'Altere o número ou a série da nota.', tipo: 'rejeicao' },
    '215': { titulo: 'Falha no Schema XML', descricao: 'A estrutura do XML está inválida.', solucao: 'Verifique os campos obrigatórios e os formatos dos valores.', tipo: 'rejeicao' },
    '228': { titulo: 'Data de emissão inválida', descricao: 'A data de emissão está fora do prazo permitido (máx. 3 dias).', solucao: 'A nova emissão usará a data atual automaticamente.', tipo: 'rejeicao' },
    '241': { titulo: 'Número já utilizado e ativo', descricao: 'O número já foi emitido com esse CNPJ/Série.', solucao: 'Use um número de NF-e diferente.', tipo: 'rejeicao' },
    '360': { titulo: 'IE do emitente não cadastrada', descricao: 'A Inscrição Estadual do emitente não foi encontrada.', solucao: 'Atualize o cadastro da empresa na Nuvem Fiscal com a IE correta.', tipo: 'rejeicao' },
    '539': { titulo: 'Soma dos itens ≠ Total da nota', descricao: 'A soma dos valores dos itens não bate com o campo vNF.', solucao: 'Revise os valores dos itens, IPI, ST, Frete e Desconto. O sistema recalcula automaticamente.', tipo: 'rejeicao' },
    '545': { titulo: 'Município de FG inválido', descricao: 'O código do município de fato gerador não corresponde à UF.', solucao: 'Corrija o código IBGE do município emitente.', tipo: 'rejeicao' },
    '591': { titulo: 'ICMS Simples Nacional incompleto', descricao: 'Campos do CSOSN estão ausentes ou inválidos.', solucao: 'Verifique o CSOSN e os dados de tributação do Simples Nacional.', tipo: 'rejeicao' },
    '610': { titulo: 'Código de município inválido', descricao: 'O código de município informado não existe ou não pertence à UF.', solucao: 'Corrija o código IBGE conforme a tabela oficial do IBGE.', tipo: 'rejeicao' },
    '656': { titulo: 'CNPJ do emitente inválido', descricao: 'O CNPJ do emitente não está ativo na Receita Federal.', solucao: 'Verifique o cadastro da empresa emitente na Nuvem Fiscal.', tipo: 'rejeicao' },
    '694': { titulo: 'ICMS para UF de destino não informado', descricao: 'O grupo ICMSUFDest é obrigatório para operações interestaduais com consumidor final.', solucao: 'Verifique se o CFOP indica operação interestadual (prefixo 6) e se o DIFAL está sendo calculado.', tipo: 'rejeicao' },
};

async function abrirReenvioNFe(id, chave) {
    _rnvId   = id;
    _rnvNota = null;

    // Reset modal
    document.getElementById('modalReenvioNFe').style.display = 'block';
    document.body.style.overflow = 'hidden';
    document.getElementById('rnvInfoNota').textContent = 'Carregando dados da nota...';
    document.getElementById('rnvItens').innerHTML = '';
    document.getElementById('rnvCnpjDest').value = '';
    document.getElementById('rnvListaEventos').innerHTML = '<div style="text-align:center;color:var(--text2);padding:40px;">Carregando eventos...</div>';
    document.getElementById('rnvTabBtnDanfe').disabled = true;
    document.getElementById('rnvDanfeLock').style.display = '';
    document.getElementById('rnvDanfeContent').style.display = 'none';
    rnvTrocarAba('form');
    rnvOcultarAlert();

    // Popula select de destinatário com empresas cadastradas
    const dropEmit = document.getElementById('dropEmit');
    const destSel  = document.getElementById('rnvDestSelect');
    if (dropEmit && dropEmit.options.length > 1) {
        destSel.innerHTML = '<option value="">— ou selecione empresa cadastrada —</option>'
            + Array.from(dropEmit.options).filter(o => o.value).map(o =>
                `<option value="${o.value}">${o.text}</option>`
            ).join('');
    }

    // Load NF-e data and events in parallel
    const fetchUrl = chave && chave.length === 44
        ? `api/buscar_nfe.php?chave=${chave}&id=${encodeURIComponent(id)}`
        : `api/buscar_nfe.php?id=${encodeURIComponent(id)}`;
    const [notaData, eventosData] = await Promise.allSettled([
        fetch(fetchUrl).then(r => r.json()),
        fetch(`api/eventos_nfe.php?id=${id}`).then(r => r.json())
    ]);

    // Populate form
    if (notaData.status === 'fulfilled' && notaData.value && !notaData.value.error) {
        _rnvNota = notaData.value;

        // Se a API não trouxe itens (nota rejeitada), tenta recuperar payload original do localStorage
        const detFromApi = _rnvNota.infNFe?.det || [];
        if (detFromApi.length === 0) {
            try {
                const saved = localStorage.getItem('nfe_payload_' + id);
                if (saved) {
                    const original = JSON.parse(saved);
                    const origInf  = original.infNFe || {};
                    // Mescla dados do payload original que a API não retorna
                    if (origInf.det && origInf.det.length > 0) {
                        _rnvNota.infNFe = _rnvNota.infNFe || {};
                        _rnvNota.infNFe.det  = origInf.det;
                    }
                    if (origInf.dest && (origInf.dest.CNPJ || origInf.dest.CPF)) {
                        _rnvNota.infNFe.dest = origInf.dest;
                    }
                    if (origInf.emit && (origInf.emit.CNPJ || origInf.emit.CPF)) {
                        _rnvNota.infNFe.emit = origInf.emit;
                    }
                    if (origInf.total) {
                        _rnvNota.infNFe.total = origInf.total;
                    }
                    if (origInf.ide) {
                        _rnvNota.infNFe.ide = { ..._rnvNota.infNFe.ide, ...origInf.ide };
                    }
                    console.log('[Reenvio] Dados recuperados do localStorage');
                }
            } catch(e) { console.warn('[Reenvio] Falha ao ler localStorage:', e); }
        }

        rnvPopularForm(_rnvNota);
    } else {
        // Tenta carregar inteiramente do localStorage
        try {
            const saved = localStorage.getItem('nfe_payload_' + id);
            if (saved) {
                const original = JSON.parse(saved);
                _rnvNota = { id, status: 'rejeitado', ...original, infNFe: original.infNFe };
                rnvPopularForm(_rnvNota);
                rnvMostrarAlert('Dados carregados do envio original salvo localmente.', 'warning');
            } else {
                rnvMostrarAlert('Não foi possível carregar os dados da nota. Preencha manualmente.', 'warning');
            }
        } catch(e) {
            rnvMostrarAlert('Não foi possível carregar os dados da nota. Preencha manualmente.', 'warning');
        }
    }

    // Populate events
    if (eventosData.status === 'fulfilled' && eventosData.value) {
        rnvRenderizarEventos(eventosData.value);
    }

    rnvRecalc();
}

function rnvPopularForm(nota) {
    // Inicializa dropdown CST/CSOSN da modal se ainda não foi preenchido
    if (!document.getElementById('rnvCSTGlobal')?.options.length) {
        rnvAtualizarCST();
    }

    const inf = nota.infNFe || {};
    const ide  = inf.ide || {};
    // emit/dest: tenta infNFe primeiro, depois nível raiz da nota
    const emit = inf.emit || {};
    const destApi = nota.destinatario || {};          // nível raiz: {cpf_cnpj, nome, ...}
    const dest = inf.dest || {};

    document.getElementById('rnvSerie').value = ide.serie || nota.serie || 1;
    document.getElementById('rnvNNF').value   = ide.nNF   || nota.numero || '';
    document.getElementById('rnvFin').value   = ide.finNFe || '1';

    // Emitente: infNFe.emit tem CNPJ, ou extrai da chave
    const cnpjEmit = emit.CNPJ || emit.CPF || (nota.chave?.length === 44 ? nota.chave.substring(6, 20) : '');
    // Destinatário: tenta infNFe.dest, depois nota.destinatario (nível raiz da API)
    const cnpjDest = dest.CNPJ || dest.CPF
        || (destApi.cpf_cnpj ? destApi.cpf_cnpj.replace(/\D/g, '') : '');
    const nomeEmit = emit.xNome || '';

    const fmtCnpj = c => c.length === 14
        ? c.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
        : c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');

    // Emitente também pode vir de nota.autorizacao.autor.cpf_cnpj
    const cnpjEmitFinal = cnpjEmit || (nota.autorizacao?.autor?.cpf_cnpj || '').replace(/\D/g, '');
    document.getElementById('rnvEmitDisplay').value = cnpjEmitFinal
        ? fmtCnpj(cnpjEmitFinal) + (nomeEmit ? ' — ' + nomeEmit : '')
        : (nomeEmit || 'Emitente não identificado');

    // Carrega dados cadastrais do emitente a partir do dropdown principal
    _rnvEmit = null;
    if (cnpjEmitFinal) {
        const dropEmit = document.getElementById('dropEmit');
        const opt = dropEmit
            ? Array.from(dropEmit.options).find(o => o.value.replace(/\D/g,'') === cnpjEmitFinal)
            : null;
        if (opt) {
            _rnvEmit = {
                uf:   opt.dataset.uf   || '',
                cMun: opt.dataset.cmun || '',
                xMun: opt.dataset.xmun || '',
                xLgr: opt.dataset.xlgr || '',
                nro:  opt.dataset.nro  || 'SN',
                xBairro: opt.dataset.xbairro || '',
                CEP: opt.dataset.cep  || '',
                IE:  opt.dataset.ie   || '',
                nome: opt.dataset.nome || opt.text || '',
                cnpj: cnpjEmitFinal,
            };
        }
    }

    // Destinatário: preenche campo editável de CNPJ
    if (cnpjDest) {
        document.getElementById('rnvCnpjDest').value = fmtCnpj(cnpjDest);
    }

    document.getElementById('rnvInfoNota').textContent =
        `ID: ${nota.id || _rnvId}  •  Chave: ${nota.chave ? nota.chave.slice(0,20) + '...' : 'N/D'}  •  Status: ${nota.status || 'rejeitado'}`;

    // Desabilita o botão de reenviar se a nota já estiver autorizada ou cancelada
    const btnReenviar = document.getElementById('rnvBtnReenviar');
    if (nota.status === 'autorizado' || nota.status === 'cancelado') {
        btnReenviar.disabled = true;
        rnvMostrarAlert(`Esta nota já está com status "${nota.status}". Não é possível reenviá-la.`, 'info');
    } else {
        btnReenviar.disabled = false;
    }

    // Items
    const det = Array.isArray(inf.det) ? inf.det : (inf.det ? [inf.det] : []);
    document.getElementById('rnvItens').innerHTML = '';
    if (det.length > 0) {
        det.forEach((d, i) => {
            const p = d.prod || d;
            rnvAddItem(
                p.xProd || `Item ${i+1}`,
                parseFloat(p.qCom || p.qTrib || 1),
                parseFloat(p.vUnCom || p.vUnTrib || 0),
                p.CFOP || '5102'
            );
        });
    } else if (nota._infNFeSynthetic && (nota.valor_total || 0) > 0) {
        // Nota rejeitada sem itens salvos — cria item placeholder com valor total
        rnvAddItem('(Preencha a descrição do produto)', 1, parseFloat(nota.valor_total) || 0, '5102');
        rnvMostrarAlert('⚠️ Os itens originais não estão disponíveis na API para notas rejeitadas. O valor total foi preservado. Ajuste a descrição, quantidade e CFOP antes de reenviar.', 'warning');
    } else {
        rnvAddItem();
    }

    // Regime tributário — herda da tela principal se disponível
    const regimeMain = document.getElementById('regimeTrib')?.value || 'normal';
    const rnvRegime  = document.getElementById('rnvRegimeTrib');
    if (rnvRegime) { rnvRegime.value = regimeMain; rnvAtualizarCST(); }

    // CST/CSOSN — herda da tela principal
    const cstMain = document.getElementById('cstGlobal')?.value || '00';
    const rnvCST  = document.getElementById('rnvCSTGlobal');
    if (rnvCST) {
        const opt = Array.from(rnvCST.options).find(o => o.value === cstMain);
        if (opt) { rnvCST.value = cstMain; rnvToggleAliqICMS(); }
    }

    // Tax rates from ICMSTot (reverse-engineer from totals) or inherit from main screen
    const tot = inf.total?.ICMSTot || inf.ICMSTot || {};
    const vProdTot = parseFloat(tot.vProd || 0) || 1;
    const getEl = id => document.getElementById(id);

    if (tot.vICMS && vProdTot) getEl('rnvPICMS').value    = ((parseFloat(tot.vICMS)    / vProdTot) * 100).toFixed(2);
    else getEl('rnvPICMS').value = document.getElementById('pICMSGlobal')?.value || '18';

    if (tot.vPIS && vProdTot)  getEl('rnvPPIS').value     = ((parseFloat(tot.vPIS)     / vProdTot) * 100).toFixed(2);
    else getEl('rnvPPIS').value = document.getElementById('pPISGlobal')?.value || '1.65';

    if (tot.vCOFINS && vProdTot) getEl('rnvPCOFINS').value = ((parseFloat(tot.vCOFINS) / vProdTot) * 100).toFixed(2);
    else getEl('rnvPCOFINS').value = document.getElementById('pCOFINSGlobal')?.value || '7.60';

    if (tot.vIPI && vProdTot)  getEl('rnvPIPI').value     = ((parseFloat(tot.vIPI)     / vProdTot) * 100).toFixed(2);
    else getEl('rnvPIPI').value = document.getElementById('pIPIGlobal')?.value || '0';

    if (tot.vST && vProdTot)   getEl('rnvPST').value      = ((parseFloat(tot.vST)      / vProdTot) * 100).toFixed(2);
    else getEl('rnvPST').value = document.getElementById('pSTGlobal')?.value || '0';

    getEl('rnvVDesc').value  = parseFloat(tot.vDesc  || 0).toFixed(2);
    getEl('rnvVFCP').value   = parseFloat(tot.vFCPST || tot.vFCP || 0).toFixed(2);
    getEl('rnvVFrete').value = parseFloat(tot.vFrete || 0).toFixed(2);
    getEl('rnvVSeg').value   = parseFloat(tot.vSeg   || 0).toFixed(2);
    getEl('rnvVOutro').value = parseFloat(tot.vOutro || 0).toFixed(2);
}

function rnvAddItem(xProd = '', qCom = 1, vUnCom = 0, cfop = '5102') {
    const container = document.getElementById('rnvItens');
    const row = document.createElement('div');
    row.className = 'rnv-item-row';
    row.innerHTML = `
        <input type="text"   class="rnv-xProd" value="${xProd.replace(/"/g, '&quot;')}" placeholder="Descrição do produto">
        <input type="number" class="rnv-qCom"  value="${qCom}"   min="0.001" step="any" oninput="rnvRecalc()">
        <input type="number" class="rnv-vUn"   value="${vUnCom}" min="0"     step="any" oninput="rnvRecalc()">
        <input type="text"   class="rnv-cfop"  value="${cfop}"   list="cfop-datalist" placeholder="5102">
        <button class="btn btn-danger btn-icon" style="padding:5px 7px; font-size:11px;" onclick="this.closest('.rnv-item-row').remove(); rnvRecalc()">✕</button>
    `;
    container.appendChild(row);
    rnvRecalc();
}

const RNV_CST_NORMAL = [
    '00 - Tributado integral','10 - Trib. c/ ST','20 - Redução BC','30 - Isento c/ ST',
    '40 - Isento','41 - Não tributado','50 - Suspensão','51 - Dif. Alíquota',
    '60 - ICMS cobrado por ST','70 - Redução BC c/ ST','90 - Outros'
];
const RNV_CST_SIMPLES = [
    '101 - Perm. aprop. créd.','102 - Imp. créd.','103 - Isen. ICMS p/ faixa rec.',
    '201 - Trib. c/ ST e créd.','202 - Trib. c/ ST s/ créd.','203 - Isen. ICMS c/ ST',
    '300 - Imune','400 - Não contribuinte','500 - ICMS cobrado p/ ST','900 - Outros'
];
const RNV_CST_SEM_VALOR = ['40','41','50','102','103','300','400','500'];

function rnvAtualizarCST() {
    const regime = document.getElementById('rnvRegimeTrib')?.value || 'normal';
    const sel    = document.getElementById('rnvCSTGlobal');
    const label  = document.getElementById('rnvLabelCST');
    if (!sel) return;
    const lista = regime === 'simples' ? RNV_CST_SIMPLES : RNV_CST_NORMAL;
    sel.innerHTML = lista.map(c => `<option value="${c.split(' ')[0]}">${c}</option>`).join('');
    if (label) label.textContent = regime === 'simples' ? 'CSOSN' : 'CST ICMS';
    rnvToggleAliqICMS();
    rnvRecalc();
}

function rnvToggleAliqICMS() {
    const cst = document.getElementById('rnvCSTGlobal')?.value || '00';
    const campo = document.getElementById('rnvCampoAliqICMS');
    if (campo) campo.style.display = RNV_CST_SEM_VALOR.includes(cst) ? 'none' : '';
}

function rnvRecalc() {
    let vProd = 0;
    document.querySelectorAll('#rnvItens .rnv-item-row').forEach(row => {
        const q = parseFloat(row.querySelector('.rnv-qCom')?.value) || 0;
        const v = parseFloat(row.querySelector('.rnv-vUn')?.value)  || 0;
        vProd += q * v;
    });

    const vDesc  = Math.max(0, parseFloat(document.getElementById('rnvVDesc')?.value)  || 0);
    const vFrete = Math.max(0, parseFloat(document.getElementById('rnvVFrete')?.value) || 0);
    const vSeg   = Math.max(0, parseFloat(document.getElementById('rnvVSeg')?.value)   || 0);
    const vOutro = Math.max(0, parseFloat(document.getElementById('rnvVOutro')?.value) || 0);
    const pIPI   = Math.max(0, parseFloat(document.getElementById('rnvPIPI')?.value)   || 0);
    const pST    = Math.max(0, parseFloat(document.getElementById('rnvPST')?.value)    || 0);
    const vFCP   = Math.max(0, parseFloat(document.getElementById('rnvVFCP')?.value)   || 0);

    const vSubLiq = Math.max(0, vProd - vDesc);
    const vIPI    = parseFloat((vSubLiq * (pIPI / 100)).toFixed(2));
    const vST     = parseFloat((vSubLiq * (pST  / 100)).toFixed(2));
    const vAcrescimos = vIPI + vST + vFCP + vFrete + vSeg + vOutro;
    const vNF     = parseFloat((vSubLiq + vAcrescimos).toFixed(2));

    const fmt = v => 'R$ ' + v.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');

    const el = id => document.getElementById(id);
    if (el('rnvSubtotal'))   el('rnvSubtotal').textContent   = fmt(vProd);
    if (el('rnvDesconto'))   el('rnvDesconto').textContent   = fmt(vDesc);
    if (el('rnvAcrescimos')) el('rnvAcrescimos').textContent = fmt(vAcrescimos);
    if (el('rnvTotal'))      el('rnvTotal').textContent      = fmt(vNF);
}

function rnvRenderizarEventos(data) {
    const lista = document.getElementById('rnvListaEventos');
    const eventos = data.data || data.eventos || (Array.isArray(data) ? data : []);

    if (!eventos.length) {
        lista.innerHTML = '<div style="text-align:center;color:var(--text2);padding:40px;">Nenhum evento registrado para esta nota.</div>';
        return;
    }

    lista.innerHTML = eventos.map(ev => {
        const sefaz  = ev.sefaz || ev;
        const codigo = String(sefaz.cStat || ev.codigo || '');
        const motivo = sefaz.xMotivo || ev.motivo || ev.descricao || 'Sem descrição';
        const data   = ev.data_evento || ev.data || '';
        const dict   = REJEICAO_DICT[codigo] || {};
        const tipo   = dict.tipo || (codigo === '100' ? 'autorizacao' : 'rejeicao');
        const isOk   = tipo === 'autorizacao' || tipo === 'cancelamento';

        return `
        <div class="rnv-evento-item ${tipo}">
            <div class="rnv-evento-header">
                <div style="display:flex; align-items:center; gap:12px;">
                    <span class="rnv-evento-codigo ${isOk ? 'ok' : ''}">${codigo || '—'}</span>
                    <div>
                        <div class="rnv-evento-titulo">${dict.titulo || motivo}</div>
                        <div class="rnv-evento-data">${data ? new Date(data).toLocaleString('pt-BR') : ''}</div>
                    </div>
                </div>
                <span class="badge ${isOk ? 'badge-autorizado' : 'badge-rejeitado'}">${tipo}</span>
            </div>
            <div class="rnv-evento-descricao">${dict.descricao || motivo}</div>
            ${dict.solucao ? `<div class="rnv-evento-solucao">${dict.solucao}</div>` : ''}
        </div>`;
    }).join('');
}

async function rnvReenviar() {
    const btn = document.getElementById('rnvBtnReenviar');
    let res;

    // Validate
    const itens = document.querySelectorAll('#rnvItens .rnv-item-row');
    if (!itens.length) { rnvMostrarAlert('Adicione pelo menos um item antes de reenviar.', 'warning'); return; }

    // Calculate totals
    let vProd = 0, vBCTot = 0, vIcmsTot = 0, vPisTot = 0, vCofinsTot = 0, vIPITot = 0, vSTTot = 0;

    const regime  = document.getElementById('rnvRegimeTrib')?.value || 'normal';
    const isSimples = regime === 'simples';
    const cstVal  = document.getElementById('rnvCSTGlobal')?.value || '00';
    const semValor = RNV_CST_SEM_VALOR.includes(cstVal);
    const pICMS   = semValor ? 0 : (parseFloat(document.getElementById('rnvPICMS').value)   || 0);
    const pPIS    = parseFloat(document.getElementById('rnvPPIS').value)    || 0;
    const pCOFINS = parseFloat(document.getElementById('rnvPCOFINS').value) || 0;
    const pIPI    = parseFloat(document.getElementById('rnvPIPI').value)    || 0;
    const pST     = parseFloat(document.getElementById('rnvPST').value)     || 0;
    const vDesc   = parseFloat(document.getElementById('rnvVDesc').value)   || 0;
    const vFCP    = parseFloat(document.getElementById('rnvVFCP').value)    || 0;
    const vFrete  = parseFloat(document.getElementById('rnvVFrete').value)  || 0;
    const vSeg    = parseFloat(document.getElementById('rnvVSeg').value)    || 0;
    const vOutro  = parseFloat(document.getElementById('rnvVOutro').value)  || 0;

    // Build payload context — needed inside the loop (DIFAL, idDest, etc.)
    const inf     = _rnvNota?.infNFe || {};
    const emit    = inf.emit || {};
    const dest    = inf.dest || {};
    const destApi = _rnvNota?.destinatario || {};
    const ide     = inf.ide  || {};

    const serie  = parseInt(document.getElementById('rnvSerie').value) || 1;
    const nNF    = parseInt(document.getElementById('rnvNNF').value)   || 1;
    const finNFe = parseInt(document.getElementById('rnvFin').value)   || 1;

    const ufEmit = _rnvEmit?.uf || emit.enderEmit?.UF || ide.UF || 'SP';
    const cUF    = UF_PARA_CUF[ufEmit] || 35;
    const cMunFG = _rnvEmit?.cMun || emit.enderEmit?.cMun || ide.cMunFG || '3550308';

    const cnpjDestRaw = document.getElementById('rnvCnpjDest').value.replace(/\D/g, '')
        || (dest.CNPJ || dest.CPF || destApi.cpf_cnpj || '').replace(/\D/g, '');

    if (!cnpjDestRaw || cnpjDestRaw.length < 11) {
        rnvMostrarAlert('Informe o CNPJ/CPF do destinatário antes de reenviar.', 'warning');
        btn.disabled  = false;
        btn.innerText = '↩️ Reenviar Nota';
        return;
    }

    const nomeDestFinal = dest.xNome || destApi.nome || destApi.razao_social || 'DESTINATARIO';
    const destPayload = (dest.CNPJ === cnpjDestRaw || dest.CPF === cnpjDestRaw)
        ? dest
        : {
            [cnpjDestRaw.length === 11 ? 'CPF' : 'CNPJ']: cnpjDestRaw,
            xNome: nomeDestFinal,
            indIEDest: 9,
            enderDest: dest.enderDest || {
                xLgr: 'NAO INFORMADO', nro: 'SN', xBairro: 'CENTRO',
                cMun: 3550308, xMun: 'SAO PAULO', UF: 'SP', CEP: '01001000'
            }
          };

    const primeiroCFOP = document.querySelector('#rnvItens .rnv-cfop')?.value || '5102';
    const cfopPrefixo  = primeiroCFOP.charAt(0);
    const idDest       = cfopPrefixo === '6' ? 2 : cfopPrefixo === '7' ? 3 : 1;
    const indFinalRnv  = idDest === 2 && (destPayload.indIEDest === 9 || destPayload.indIEDest === '9') ? 1 : 0;

    const det = [];
    itens.forEach((row, i) => {
        const xProd  = row.querySelector('.rnv-xProd').value.trim() || `Item ${i+1}`;
        const qCom   = parseFloat(row.querySelector('.rnv-qCom').value) || 1;
        const vUnCom = parseFloat(row.querySelector('.rnv-vUn').value)  || 0;
        const cfop   = (row.querySelector('.rnv-cfop').value || '5102').replace(/\D/g,'');
        const vP     = parseFloat((qCom * vUnCom).toFixed(2));
        const vI     = parseFloat((vP * pICMS   / 100).toFixed(2));
        const vPISi  = parseFloat((vP * pPIS    / 100).toFixed(2));
        const vCOFi  = parseFloat((vP * pCOFINS / 100).toFixed(2));
        const vIPIi  = parseFloat((vP * pIPI    / 100).toFixed(2));

        vProd    += vP;
        if (!semValor) vBCTot += vP;
        vIcmsTot += vI;
        vPisTot  += vPISi;
        vCofinsTot += vCOFi;
        vIPITot  += vIPIi;

        let icmsNode;
        if (isSimples) {
            if (semValor) {
                icmsNode = { [`ICMSSN${cstVal}`]: { orig: 0, CSOSN: cstVal } };
            } else {
                icmsNode = { [`ICMSSN${cstVal}`]: { orig: 0, CSOSN: cstVal, modBC: 3, vBC: vP, pCredSN: pICMS, vCredICMSSN: vI } };
            }
        } else {
            if (semValor) {
                icmsNode = { [`ICMS${cstVal}`]: { orig: 0, CST: cstVal } };
            } else {
                icmsNode = { ICMS00: { orig: 0, CST: cstVal, modBC: 3, vBC: vP, pICMS, vICMS: vI } };
            }
        }
        const vSTi = parseFloat((vP * pST / 100).toFixed(2));
        vSTTot += vSTi;
        const impostoItem = /** @type {any} */ ({
            ICMS: icmsNode,
            PIS:  { PISAliq: { CST: '01', vBC: vP, pPIS,    vPIS:    vPISi  } },
            COFINS: { COFINSAliq: { CST: '01', vBC: vP, pCOFINS, vCOFINS: vCOFi } },
            ...(pST  > 0 ? { ICMSST: { vBCST: vP, pICMSST: pST, vICMSST: vSTi } } : {}),
            ...(pIPI > 0 ? { IPI: { cEnq: '999', IPITrib: { CST: '50', vBC: vP, pIPI, vIPI: vIPIi } } } : {})
        });
        // DIFAL vai apenas em total.ICMSUFDest, NÃO no imposto do item
        det.push({
            nItem: i + 1,
            prod: {
                cProd: String(i + 1).padStart(3, '0'),
                cEAN: 'SEM GTIN', xProd,
                NCM: '21069090',
                CFOP: cfop,
                uCom: 'UN', qCom, vUnCom,
                vProd: vP,
                cEANTrib: 'SEM GTIN', uTrib: 'UN',
                qTrib: qCom, vUnTrib: vUnCom,
                indTot: 1
            },
            imposto: impostoItem
        });
    });

    const vSubLiq = Math.max(0, vProd - vDesc);
    const vNF     = parseFloat((vSubLiq + vIPITot + vSTTot + vFCP + vFrete + vSeg + vOutro).toFixed(2));

    // Validate vNF > 0
    if (vNF <= 0) { rnvMostrarAlert('O valor total da nota deve ser maior que zero.', 'warning'); return; }

    const payload = {
        cpf_cnpj: emit.CNPJ || emit.CPF || _rnvEmit?.cnpj || _rnvNota?.chave?.substring(6,20) || '',
        ambiente: "homologacao",
        referencia: "RNV-" + Date.now(),
        infNFe: {
            versao: "4.00",
            ide: {
                cUF, natOp: finNFe === 4 ? 'DEVOLUCAO' : 'VENDA',
                mod: 55, serie, nNF,
                dhEmi: (() => { const d = new Date(Date.now() - 3*3600000); return d.toISOString().split('.')[0]+'-03:00'; })(),
                tpNF: 1, idDest, cMunFG: parseInt(cMunFG),
                tpImp: 1, tpEmis: 1, tpAmb: 2, finNFe,
                indFinal: indFinalRnv, indPres: 1, procEmi: 0, verProc: 'Matrix_v60'
            },
            emit: emit.CNPJ || emit.CPF
                ? { ...emit, enderEmit: { ...(emit.enderEmit || {}), UF: ufEmit, cMun: parseInt(cMunFG), xMun: _rnvEmit?.xMun || emit.enderEmit?.xMun || '', xLgr: _rnvEmit?.xLgr || emit.enderEmit?.xLgr || 'NAO INFORMADO', nro: _rnvEmit?.nro || emit.enderEmit?.nro || 'SN', xBairro: _rnvEmit?.xBairro || emit.enderEmit?.xBairro || 'CENTRO', CEP: _rnvEmit?.CEP || emit.enderEmit?.CEP || '' } }
                : { CNPJ: (_rnvEmit?.cnpj || _rnvNota?.chave?.substring(6,20) || ''), xNome: _rnvEmit?.nome || 'EMITENTE', IE: _rnvEmit?.IE || '', enderEmit: { xLgr: _rnvEmit?.xLgr || 'NAO INFORMADO', nro: _rnvEmit?.nro || 'SN', xBairro: _rnvEmit?.xBairro || 'CENTRO', cMun: parseInt(cMunFG), xMun: _rnvEmit?.xMun || '', UF: ufEmit, CEP: _rnvEmit?.CEP || '' } },
            dest: destPayload,
            det,
            total: {
                ICMSTot: {
                    vBC: parseFloat(vBCTot.toFixed(2)),
                    vICMS: parseFloat(vIcmsTot.toFixed(2)),
                    vICMSDeson: 0, vFCP: parseFloat(vFCP.toFixed(2)),
                    vBCST: pST > 0 ? parseFloat(vProd.toFixed(2)) : 0,
                    vST: parseFloat(vSTTot.toFixed(2)), vFCPST: 0, vFCPSTRet: 0,
                    vProd: parseFloat(vProd.toFixed(2)),
                    vFrete: parseFloat(vFrete.toFixed(2)),
                    vSeg: parseFloat(vSeg.toFixed(2)),
                    vDesc: parseFloat(vDesc.toFixed(2)),
                    vII: 0,
                    vIPI: parseFloat(vIPITot.toFixed(2)),
                    vIPIDevol: 0,
                    vPIS: parseFloat(vPisTot.toFixed(2)),
                    vCOFINS: parseFloat(vCofinsTot.toFixed(2)),
                    vOutro: parseFloat(vOutro.toFixed(2)),
                    vNF
                }
            },
            transp: { modFrete: 9 },
            pag: { detPag: [{ tPag: '01', vPag: vNF }] }  // reenvio não usa dados de transporte do form
        }
    };

    btn.disabled  = true;
    btn.innerText = '⏳ Reenviando...';
    rnvOcultarAlert();

    try {
        // Cria nova NF-e com mesmo série/número (chave muda por dhEmi) e emite
        const resp = await fetch('api/reenviar_nfe.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': await getCsrfToken() },
            body: JSON.stringify({ id: _rnvId, payload })
        });
        res = await resp.json();

        // Salva payload no localStorage com o novo ID
        if (res.id) {
            try { localStorage.setItem('nfe_payload_' + res.id, JSON.stringify(payload)); } catch(_){}
        }

        // Atualiza _rnvId com o novo ID (nota antiga foi deletada, nova foi criada)
        if (res.id) _rnvId = res.id;
        const nfeId = _rnvId;
        if (res.status === 'autorizado') {
            rnvMostrarAlert('✅ Nota autorizada com sucesso!', 'success');
            showToast('NF-e autorizada!', 'success');
            // Unlock DANFE tab and disable resend button
            document.getElementById('rnvBtnReenviar').disabled = true;
            document.getElementById('rnvTabBtnDanfe').disabled = false;
            document.getElementById('rnvDanfeLock').style.display = 'none';
            document.getElementById('rnvDanfeContent').style.display = '';
            document.getElementById('rnvDanfeFrame').src = `api/danfe.php?id=${nfeId}`;
            document.getElementById('rnvBtnBaixarDanfe').href = `api/danfe.php?id=${nfeId}`;
            document.getElementById('rnvBtnBaixarXml').href  = `api/download_xml.php?id=${nfeId}`;
            rnvTrocarAba('danfe');
            // Refresh main table
            if (typeof buscarNotas === 'function') buscarNotas(_skipAtual);
        } else {
            // Show new rejection
            const errMsg = res.mensagem_sefaz || res.motivo || res.error?.message || res.message || JSON.stringify(res).substring(0, 200);
            const cStat  = String(res.status_sefaz || res.codigo_status || '');
            const dict   = REJEICAO_DICT[cStat] || {};
            rnvMostrarAlert(`❌ ${dict.titulo || 'Rejeição'}: ${dict.descricao || errMsg}${dict.solucao ? ' — ' + dict.solucao : ''}`, 'error');
            // Reload events
            const evResp = await fetch(`api/eventos_nfe.php?id=${_rnvId}`);
            const evData = await evResp.json();
            rnvRenderizarEventos(evData);
            rnvTrocarAba('eventos');
        }
    } catch(e) {
        rnvMostrarAlert('Falha na conexão ao reenviar. Verifique o servidor e tente novamente.', 'error');
    } finally {
        if (!res || res.status !== 'autorizado') {
            btn.disabled  = false;
            btn.innerText = '↩️ Reenviar Nota';
        }
    }
}

function rnvTrocarAba(aba) {
    ['form','eventos','danfe'].forEach(a => {
        document.getElementById(`rnvAba${a.charAt(0).toUpperCase()+a.slice(1)}`)?.classList.toggle('active', a === aba);
        document.getElementById(`rnvTabBtn${a.charAt(0).toUpperCase()+a.slice(1)}`)?.classList.toggle('active', a === aba);
    });
}

function rnvSelecionarDest(sel) {
    if (sel.value) {
        const cnpj = sel.value.replace(/\D/g, '');
        document.getElementById('rnvCnpjDest').value = cnpj.length === 14
            ? cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
            : cnpj.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
}

async function rnvVerDadosEmitente() {
    // Extrai CNPJ do campo de exibição ou do _rnvNota
    const cnpjRaw = (_rnvNota?.infNFe?.emit?.CNPJ
        || (_rnvNota?.chave?.length === 44 ? _rnvNota.chave.substring(6, 20) : ''))
        .replace(/\D/g, '');

    if (!cnpjRaw) {
        rnvMostrarAlert('Não foi possível identificar o CNPJ do emitente.', 'warning');
        return;
    }

    rnvMostrarAlert('Carregando dados cadastrais...', 'info');

    try {
        const resp = await fetch(`api/cadastrar_empresa.php?cpf_cnpj=${cnpjRaw}`);
        const emp  = await resp.json();

        if (emp.error || resp.status >= 400) {
            rnvMostrarAlert('Erro ao buscar empresa: ' + (emp.error?.message || emp.error || 'desconhecido'), 'error');
            return;
        }

        const ie   = emp.inscricoes_estaduais?.[0];
        const end  = emp.endereco || {};
        const linhas = [
            `Razão Social: ${emp.nome_razao_social || '-'}`,
            `CNPJ: ${cnpjRaw.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')}`,
            `IE: ${ie ? `${ie.inscricao_estadual} (${ie.uf}) — ${ie.ativa ? 'Ativa' : 'Inativa'}` : 'Não cadastrada'}`,
            `Regime: ${emp.regime_tributario || '-'}`,
            `Email: ${emp.email || '-'}`,
            `Endereço: ${end.logradouro || ''}, ${end.numero || ''} — ${end.municipio || ''} / ${end.uf || ''} — CEP ${end.cep || '-'}`,
        ];

        const al  = document.getElementById('rnvAlert');
        const icon = document.getElementById('rnvAlertIcon');
        const txt  = document.getElementById('rnvAlertMsg');
        al.className = 'emp-alert info';
        icon.textContent = '🏢';
        txt.innerHTML = linhas.map(l => l.replace(/&/g,'&amp;').replace(/</g,'&lt;')).join('<br>');
        al.style.display = '';
        return;
    } catch(e) {
        rnvMostrarAlert('Falha ao consultar dados do emitente: ' + e.message, 'error');
    }
}

function rnvFechar() {
    document.getElementById('modalReenvioNFe').style.display = 'none';
    document.body.style.overflow = '';
    _rnvNota = null;
    _rnvId   = '';
    _rnvEmit = null;
}

function rnvMostrarAlert(msg, tipo) {
    const al   = document.getElementById('rnvAlert');
    const icon = document.getElementById('rnvAlertIcon');
    const txt  = document.getElementById('rnvAlertMsg');
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    al.className = `emp-alert ${tipo}`;
    icon.textContent = icons[tipo] || 'ℹ️';
    txt.textContent  = msg;
    al.style.display = '';
    al.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function rnvOcultarAlert() {
    document.getElementById('rnvAlert').style.display = 'none';
}

// Close on overlay click
document.getElementById('modalReenvioNFe').addEventListener('click', function(e) {
    if (e.target === this) rnvFechar();
});

// Drag & Drop na upload area
(function() {
    const area = document.getElementById('certUploadArea');
    if (!area) return;
    area.addEventListener('dragover', e => { e.preventDefault(); area.classList.add('dragover'); });
    area.addEventListener('dragleave', () => area.classList.remove('dragover'));
    area.addEventListener('drop', e => {
        e.preventDefault();
        area.classList.remove('dragover');
        const dt = e.dataTransfer;
        if (dt && dt.files[0]) {
            const input = document.getElementById('certArquivo');
            // Não é possível atribuir DataTransfer diretamente, mas simulamos via FormData
            input._droppedFile = dt.files[0];
            document.getElementById('certArquivoNome').textContent = '📎 ' + dt.files[0].name;
            document.getElementById('certArquivoNome').style.display = 'block';
            document.querySelector('.upload-area-text').textContent = 'Arquivo selecionado';
        }
    });
})();

// ============================================
// CANCELAMENTO DE NF-e / NFC-e
// ============================================
let _nfParaCancelar = null;

function abrirModalCancelamento(idNota, serieNumero) {
    _nfParaCancelar = idNota;
    document.getElementById('modalCancelamento').style.display = 'flex';
    document.getElementById('cancelNfId').textContent = idNota;
    document.getElementById('cancelNfSerie').textContent = serieNumero;
    document.getElementById('cancelJustificativa').value = '';
    atualizarContadorCancelamento();
}

function fecharModalCancelamento() {
    document.getElementById('modalCancelamento').style.display = 'none';
    _nfParaCancelar = null;
}

function atualizarContadorCancelamento() {
    const textarea = document.getElementById('cancelJustificativa');
    const counter = document.getElementById('cancelContador');
    const len = textarea.value.length;
    counter.textContent = len + '/255';

    // Muda cor conforme comprimento
    if (len < 15) {
        counter.style.color = '#f44336'; // Vermelho
    } else if (len >= 15 && len <= 255) {
        counter.style.color = '#4caf50'; // Verde
    } else {
        counter.style.color = '#f44336'; // Vermelho se passar de 255
    }
}

async function executarCancelamento() {
    if (!_nfParaCancelar) return;

    const justificativa = document.getElementById('cancelJustificativa').value.trim();

    // Validações
    if (!justificativa) {
        alert('⚠️ Justificativa é obrigatória');
        return;
    }

    if (justificativa.length < 15) {
        alert('⚠️ Justificativa deve ter no mínimo 15 caracteres');
        return;
    }

    if (justificativa.length > 255) {
        alert('⚠️ Justificativa não pode exceder 255 caracteres');
        return;
    }

    // Confirmação final
    const confirma = confirm(
        `Tem certeza que deseja cancelar a nota?\n\nSérie/Número: ${document.getElementById('cancelNfSerie').textContent}\n\nEsta ação NÃO pode ser desfeita.`
    );

    if (!confirma) return;

    // Desabilita botão e mostra loading
    const btnConfirmar = document.getElementById('btnConfirmarCancelamento');
    const btnCancelar = document.getElementById('btnCancelarCancelamento');
    btnConfirmar.disabled = true;
    btnCancelar.disabled = true;
    btnConfirmar.textContent = '⏳ Processando...';

    try {
        const response = await securePost('api/cancelar_nfe.php', {
            id: _nfParaCancelar,
            justificativa: justificativa
        });

        const result = await response.json();

        if (response.ok) {
            // Sucesso!
            alert('✅ Nota fiscal cancelada com sucesso!');
            fecharModalCancelamento();
            // Recarregar a lista de notas
            buscarNotas(_skipAtual);
        } else {
            // Erro
            let mensagem = result.error || 'Erro desconhecido';

            if (response.status === 400) {
                mensagem = '⚠️ Validação falhou: ' + mensagem;
            } else if (response.status === 401) {
                mensagem = '🔒 Sessão expirada. Faça login novamente.';
            } else if (response.status === 404) {
                mensagem = '❌ Nota não encontrada.';
            } else if (response.status === 422) {
                mensagem = '❌ SEFAZ rejeitou o cancelamento: ' + mensagem;
            } else if (response.status === 500) {
                mensagem = '❌ Erro no servidor. Tente novamente.';
            }

            alert(mensagem);
        }
    } catch (error) {
        console.error('Erro ao cancelar nota:', error);
        alert('❌ Erro ao comunicar com o servidor: ' + error.message);
    } finally {
        // Reativa botões
        btnConfirmar.disabled = false;
        btnCancelar.disabled = false;
        btnConfirmar.textContent = 'Confirmar Cancelamento';
    }
}

// Event listener para contador de caracteres
document.addEventListener('DOMContentLoaded', () => {
    const textarea = document.getElementById('cancelJustificativa');
    if (textarea) {
        textarea.addEventListener('input', atualizarContadorCancelamento);
    }
});

// ==========================================
// FUNÇÕES DE SELEÇÃO DE CT-e
// ==========================================
function cteSelecionarEmitente(sel) {
    const d = sel.options[sel.selectedIndex].dataset;
    document.getElementById('cteEmitNome').value = d.nome || "";
    document.getElementById('cteEmitCNPJ').value = sel.value;
    document.getElementById('cteEmitIE').value = d.ie || "";
    document.getElementById('cteEmitUF').value = d.uf || "";
    document.getElementById('cteEmitcMun').value = d.cmun || "";
    document.getElementById('cteEmitxMun').value = d.xmun || "";
    document.getElementById('cteEmitxLgr').value = d.xlgr || "";
    document.getElementById('cteEmitnro').value = d.nro || "SN";
    document.getElementById('cteEmitxBairro').value = d.xbairro || "";
    document.getElementById('cteEmitCEP').value = d.cep || "";
}

function cteSelecionarRemetente(sel) {
    const d = sel.options[sel.selectedIndex].dataset;
    document.getElementById('cteRemCNPJ').value = sel.value;
    document.getElementById('cteRemNome').value = d.nome || "";
    document.getElementById('cteRemIE').value = d.ie || "";
    document.getElementById('cteRemUF').value = d.uf || "";
    document.getElementById('cteRemcMun').value = d.cmun || "";
    document.getElementById('cteRemxMun').value = d.xmun || "";
    document.getElementById('cteRemxLgr').value = d.xlgr || "";
    document.getElementById('cteRemnro').value = d.nro || "SN";
    document.getElementById('cteRemxBairro').value = d.xbairro || "";
    document.getElementById('cteRemCEP').value = d.cep || "";
}

function cteSelecionarDestinatario(sel) {
    const d = sel.options[sel.selectedIndex].dataset;
    document.getElementById('cteDestCNPJ').value = sel.value;
    document.getElementById('cteDestNome').value = d.nome || "";
    document.getElementById('cteDestIE').value = d.ie || "";
    document.getElementById('cteDestUF').value = d.uf || "";
    document.getElementById('cteDestcMun').value = d.cmun || "";
    document.getElementById('cteDestxMun').value = d.xmun || "";
    document.getElementById('cteDestxLgr').value = d.xlgr || "";
    document.getElementById('cteDestnro').value = d.nro || "SN";
    document.getElementById('cteDestxBairro').value = d.xbairro || "";
    document.getElementById('cteDestCEP').value = d.cep || "";
}

async function abrirEmissaoCte() {
    const modal = document.getElementById('modalEmissaoCte');
    if (!modal) return;
    modal.style.display = 'block';

    ['cbCteEmit','cbCteRem','cbCteDest','cbFiltroCte'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el._cbInited = false; el.value = ''; }
    });

    await carregarDropdownsEmpresas();
    cteAba('id');
}

function fecharEmissaoCte() {
    const modal = document.getElementById('modalEmissaoCte');
    if (modal) modal.style.display = 'none';
}

function cteAba(aba) {
    document.querySelectorAll('[id^="cteAba"]').forEach(el => {
        if (el.id !== 'cteAlerta') el.classList.remove('active');
    });
    document.querySelectorAll('[id^="cteTab"]').forEach(btn => {
        btn.classList.remove('active');
    });

    const abaEl = document.getElementById('cteAba' + aba.charAt(0).toUpperCase() + aba.slice(1));
    const btnEl = document.getElementById('cteTab' + aba.charAt(0).toUpperCase() + aba.slice(1));

    if (abaEl) abaEl.classList.add('active');
    if (btnEl) btnEl.classList.add('active');
}

async function buscarDadosNfePorChave(chave) {
    if (!chave || chave.length < 44) {
        console.warn('Chave de NF-e inválida');
        return null;
    }

    try {
        const params = new URLSearchParams({ chave: chave.replace(/\D/g, '') });
        const resp = await fetch('api/consultar_nfes.php?' + params);
        if (!resp.ok) return null;

        const data = await resp.json();
        if (!data || !data.data || data.data.length === 0) return null;

        const nfe = data.data[0];
        return {
            chave: chave,
            numero: nfe.numero,
            serie: nfe.serie,
            data_emissao: nfe.data_emissao,
            valor_total: nfe.valor_total,
            quantidade_itens: nfe.quantidade_itens || 0,
            descricao: nfe.descricao_produtos || '',
            cpf_cnpj_emitente: nfe.cpf_cnpj_emitente,
            nome_emitente: nfe.nome_emitente,
            cpf_cnpj_dest: nfe.cpf_cnpj_dest,
            nome_dest: nfe.nome_dest
        };
    } catch (e) {
        console.error('Erro ao buscar NF-e:', e);
        return null;
    }
}

function preencherNfeEmCtePelaChaave(chaveInput, targetPrefix) {
    const chave = chaveInput.value.replace(/\D/g, '');
    if (chave.length !== 44) {
        mostrarToast('Chave deve ter 44 dígitos', 'error');
        return;
    }

    buscarDadosNfePorChave(chave).then(nfe => {
        if (!nfe) {
            mostrarToast('NF-e não encontrada', 'error');
            return;
        }

        const idPrefix = targetPrefix === 'remetente' ? 'cteRem' : 'cteDest';
        document.getElementById(idPrefix + 'Chave').value = nfe.chave;
        document.getElementById(idPrefix + 'Numero').value = nfe.numero;
        document.getElementById(idPrefix + 'Serie').value = nfe.serie;
        document.getElementById(idPrefix + 'ValorTotal').value = nfe.valor_total;
        document.getElementById(idPrefix + 'QtdItens').value = nfe.quantidade_itens;

        mostrarToast('NF-e carregada com sucesso', 'success');
    });
}

/**
 * Inicializa o redimensionamento manual de colunas para uma tabela
 * @param {string} tableId ID da tabela
 */
function initTableResizer(tableId) {
    const table = document.getElementById(tableId);
    if (!table) return;
    
    // Evita inicialização múltipla
    if (table.dataset.resizerInited === 'true') return;
    table.dataset.resizerInited = 'true';
    
    const ths = table.querySelectorAll('thead th');
    
    ths.forEach(th => {
        // Cria o handle de redimensionamento
        const handle = document.createElement('div');
        handle.className = 'resizer-handle';
        th.appendChild(handle);
        
        let startX, startWidth;
        
        handle.addEventListener('mousedown', function(e) {
            startX = e.pageX;
            startWidth = th.offsetWidth;
            
            handle.classList.add('resizing');
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
            
            const onMouseMove = (e) => {
                const delta = e.pageX - startX;
                const newWidth = Math.max(40, startWidth + delta);
                th.style.width = newWidth + 'px';
                // Para table-layout: fixed, precisamos garantir que o width do TH seja respeitado
                th.style.minWidth = newWidth + 'px';
            };
            
            const onMouseUp = () => {
                handle.classList.remove('resizing');
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            };
            
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
    });
}