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
        const resp = await fetch(`buscar_nfe.php?chave=${chave}`);
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
                transp: { modFrete: 9 },
                pag: { detPag: [{ tPag: '90', vPag: 0 }] }
            }
        };

        const resp = await fetch('transmitir.php', {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: { 'Content-Type': 'application/json' }
        });
        const res = await resp.json();

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
    if (document.getElementById('cfop-datalist')) return;
    const dl = document.createElement('datalist');
    dl.id = 'cfop-datalist';
    dl.innerHTML = CFOP_LIST.map(([cod, desc]) => `<option value="${cod.replace('.','')}">${cod} - ${desc}</option>`).join('');
    document.body.appendChild(dl);
}

// ==========================================
// GESTÃO DE PRODUTOS E TRIBUTAÇÃO
// ==========================================
function addProduto() {
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
    let totalNota = 0;
    document.querySelectorAll(".produto-item").forEach(item => {
        const q = parseFloat(item.querySelector(".qtd").value) || 0;
        const v = parseFloat(item.querySelector(".vUn").value) || 0;
        totalNota += (q * v);
    });
    const res = document.getElementById('resTotalNota');
    if(res) res.innerText = totalNota.toFixed(2);
    return totalNota;
}

// ==========================================
// GERAÇÃO DE XML PARA CONFERÊNCIA
// ==========================================
function gerarXMLCompleto() {
    const nNF = getV('nNF');
    const fin = getV('finNFe');
    const ref = getV('refNFe');
    let itensXml = "";
    let vProdTotal = 0;
    let vIcmsTotal = 0;

    document.querySelectorAll(".produto-item").forEach((item, i) => {
        const q = parseFloat(item.querySelector(".qtd").value) || 0;
        const v = parseFloat(item.querySelector(".vUn").value) || 0;
        const pIcms = parseFloat(item.querySelector(".pICMS").value) || 0;
        const vProd = q * v;
        const vIcms = vProd * (pIcms / 100);
        
        vProdTotal += vProd;
        vIcmsTotal += vIcms;

        itensXml += `
        <det nItem="${i+1}">
            <prod>
                <cProd>${i+1}</cProd>
                <xProd>${item.querySelector(".xProd").value}</xProd>
                <NCM>21069090</NCM>
                <CFOP>${item.querySelector(".cfop").value}</CFOP>
                <uCom>UN</uCom><qCom>${q.toFixed(4)}</qCom>
                <vUnCom>${v.toFixed(2)}</vUnCom><vProd>${vProd.toFixed(2)}</vProd><indTot>1</indTot>
            </prod>
            <imposto>
                <ICMS><ICMS00><orig>0</orig><CST>${item.querySelector(".cst").value}</CST><vBC>${vProd.toFixed(2)}</vBC><pICMS>${pIcms.toFixed(2)}</pICMS><vICMS>${vIcms.toFixed(2)}</vICMS></ICMS00></ICMS>
            </imposto>
        </det>`;
    });

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
                <vBC>${vProdTotal.toFixed(2)}</vBC><vICMS>${vIcmsTotal.toFixed(2)}</vICMS>
                <vProd>${vProdTotal.toFixed(2)}</vProd><vNF>${vProdTotal.toFixed(2)}</vNF>
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
                transp: { modFrete: 9 },
                pag: { detPag: [{ tPag: "01", vPag: 0 }] }
            }
        };

        if (fin === "4") payload.infNFe.ide.NFref = [{ refNFe: clean(ref) }];

        let vTot = 0, vBCTot = 0, vIcmsTot = 0, vPisTot = 0, vCofinsTot = 0;
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

            vTot += vP;
            if (!semValor) vBCTot += vP;  // BC só acumula quando o CST tributa
            vIcmsTot += vI; vPisTot += vPIS; vCofinsTot += vCOFINS;

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

            payload.infNFe.det.push({
                nItem: i + 1,
                prod: { cProd: (i+1).toString(), cEAN: "SEM GTIN", xProd: item.querySelector(".xProd").value, NCM: "21069090", CFOP: cfop, uCom: "UN", qCom: q, vUnCom: v, vProd: vP, cEANTrib: "SEM GTIN", uTrib: "UN", qTrib: q, vUnTrib: v, indTot: 1 },
                imposto: {
                    ICMS: icmsNode,
                    PIS:  { PISAliq:    { CST: "01", vBC: vP, pPIS: pPIS,       vPIS: vPIS } },
                    COFINS: { COFINSAliq: { CST: "01", vBC: vP, pCOFINS: pCOFINS, vCOFINS: vCOFINS } }
                }
            });
        });

        payload.infNFe.total.ICMSTot.vBC = vBCTot;
        payload.infNFe.total.ICMSTot.vProd = vTot;
        payload.infNFe.total.ICMSTot.vNF = vTot;
        payload.infNFe.total.ICMSTot.vICMS = vIcmsTot;
        payload.infNFe.total.ICMSTot.vPIS = vPisTot;
        payload.infNFe.total.ICMSTot.vCOFINS = vCofinsTot;
        payload.infNFe.pag.detPag[0].vPag = vTot;

        const resp = await fetch('transmitir.php', { method: 'POST', body: JSON.stringify(payload), headers: { 'Content-Type': 'application/json' } });
        const res = await resp.json();
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
    document.getElementById('modalConsulta').style.display = 'block';
    document.body.style.overflow = 'hidden';
    await popularEmpresasConsulta();
    buscarNotas(0);
}

async function popularEmpresasConsulta() {
    const sel = document.getElementById('filtroEmpresa');
    if (!sel) return;
    // Reutiliza dados já carregados no dropdown principal se disponíveis
    const dropEmit = document.getElementById('dropEmit');
    if (dropEmit && dropEmit.options.length > 1) {
        sel.innerHTML = Array.from(dropEmit.options).map(o =>
            `<option value="${o.value}">${o.text}</option>`
        ).join('');
        return;
    }
    // Caso contrário carrega da API
    try {
        const resp = await fetch('listar_empresas.php');
        const res  = await resp.json();
        sel.innerHTML = res.data.map(e =>
            `<option value="${e.cpf_cnpj}">${e.nome_razao_social} — ${e.cpf_cnpj}</option>`
        ).join('');
    } catch { sel.innerHTML = '<option value="">Erro ao carregar empresas</option>'; }
}

function fecharConsulta() {
    document.getElementById('modalConsulta').style.display = 'none';
    document.body.style.overflow = '';
    fecharDanfeViewer();
}

async function buscarNotas(skip) {
    _skipAtual = skip;
    const top    = parseInt(document.getElementById('filtroTop').value) || 50;
    const status = document.getElementById('filtroStatus').value;
    const cnpj   = (document.getElementById('filtroEmpresa').value || '').replace(/\D/g, '');

    if (!cnpj) {
        document.getElementById('corpoTabela').innerHTML =
            '<tr><td colspan="8" style="text-align:center;color:#aaa;padding:20px;">Selecione uma empresa para buscar as notas.</td></tr>';
        document.getElementById('loadingNotas').style.display = 'none';
        return;
    }

    document.getElementById('loadingNotas').style.display = '';
    document.getElementById('corpoTabela').innerHTML = '';
    fecharDanfeViewer();

    const params = new URLSearchParams({ top: 50, skip, cpf_cnpj: cnpj });

    try {
        let notas = [];

        if (status) {
            // API não suporta filtro — pagina até encontrar `top` registros com o status desejado
            let s = 0, tentativas = 0;
            while (notas.length < top && tentativas < 6) {
                const p = new URLSearchParams({ top: 50, skip: s, cpf_cnpj: cnpj });
                const r = await fetch('consultar_nfes.php?' + p);
                const d = await r.json();
                if (d.error || !d.data || d.data.length === 0) break;
                notas.push(...d.data.filter(n => n.status === status));
                if (d.data.length < 50) break; // última página
                s += 50;
                tentativas++;
            }
            notas = notas.slice(0, top);
        } else {
            const resp = await fetch('consultar_nfes.php?' + params);
            const res  = await resp.json();
            if (res.error || !res.data) {
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
                const dest    = n.destinatario?.nome || n.destinatario?.razao_social || n.referencia || '-';
                const valor   = n.valor_total != null ? 'R$ ' + parseFloat(n.valor_total).toFixed(2) : '-';
                const st      = n.status || 'outro';
                const badgeCls = { autorizado:'badge-autorizado', rejeitado:'badge-rejeitado', pendente:'badge-pendente', cancelado:'badge-cancelado' }[st] || 'badge-outro';
                const chave   = n.chave || '-';
                const chaveShort = chave !== '-' ? chave.slice(0,10) + '...' : '-';
                const podeImprimir = st === 'autorizado';
                return `<tr>
                    <td>${data}</td>
                    <td>${n.serie || '-'} / ${n.numero || '-'}</td>
                    <td style="max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${emitente}">${emitente}</td>
                    <td style="max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${dest}">${dest}</td>
                    <td>${valor}</td>
                    <td><span class="badge ${badgeCls}">${st}</span></td>
                    <td style="font-family:monospace;font-size:0.75em;" title="${chave}">${chaveShort}</td>
                    <td style="white-space:nowrap;">
                        ${podeImprimir ? `
                        <button class="btn btn-primary" style="padding:4px 10px;font-size:0.8em;" onclick="verDanfeConsulta('${n.id}','${n.serie}/${n.numero}')">Ver PDF</button>
                        <button class="btn btn-success" style="padding:4px 10px;font-size:0.8em;" onclick="baixarDanfeConsulta('${n.id}','${n.serie}/${n.numero}')">Baixar PDF</button>
                        <button class="btn btn-warning" style="padding:4px 10px;font-size:0.8em;" onclick="baixarXmlConsulta('${n.id}','${n.serie}/${n.numero}')">XML</button>
                        ` : '<span style="color:#666;font-size:0.8em;">-</span>'}
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
    const top = parseInt(document.getElementById('filtroTop').value) || 50;
    buscarNotas(Math.max(0, _skipAtual + dir * top));
}

let _idDanfeViewer = null;

function verDanfeConsulta(id, label) {
    _idDanfeViewer = id;
    const viewer = document.getElementById('danfeViewer');
    document.getElementById('danfeTitulo').textContent = `DANFE — Nota ${label}`;
    document.getElementById('iframeConsulta').src = `danfe.php?id=${id}`;
    viewer.style.display = '';
    viewer.scrollIntoView({ behavior: 'smooth' });
}

function baixarXmlViewer() {
    if (!_idDanfeViewer) return;
    const a = document.createElement('a');
    a.href = `download_xml.php?id=${_idDanfeViewer}`;
    a.download = `NFe_${_idDanfeViewer}.xml`;
    a.click();
}

function baixarDanfeConsulta(id, label) {
    const a = document.createElement('a');
    a.href  = `danfe.php?id=${id}`;
    a.download = `DANFE_${label.replace('/','-')}.pdf`;
    a.click();
}

function baixarXmlConsulta(id, label) {
    const a = document.createElement('a');
    a.href  = `download_xml.php?id=${id}`;
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
    const icon = { success: '✅', error: '❌', info: 'ℹ️' }[type] || 'ℹ️';
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${icon}</span><span>${msg}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('fadeout');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

function abrirDanfe() {
    if (!_ultimoIdNfe) return;
    const div   = document.getElementById('iframeDanfe');
    const frame = document.getElementById('frameNota');
    frame.src   = `danfe.php?id=${_ultimoIdNfe}`;
    div.style.display = '';
    div.scrollIntoView({ behavior: 'smooth' });
}

function baixarDanfe() {
    if (!_ultimoIdNfe) return;
    const a  = document.createElement('a');
    a.href   = `danfe.php?id=${_ultimoIdNfe}`;
    a.download = `DANFE_${_ultimoIdNfe}.pdf`;
    a.click();
}

function baixarXml() {
    if (!_ultimoIdNfe) return;
    const a  = document.createElement('a');
    a.href   = `download_xml.php?id=${_ultimoIdNfe}`;
    a.download = `NFe_${_ultimoIdNfe}.xml`;
    a.click();
}

// MAPEAMENTO UF → cUF (IBGE)
const UF_PARA_CUF = {
    AC:12, AL:27, AP:16, AM:13, BA:29, CE:23, DF:53, ES:32, GO:52,
    MA:21, MT:51, MS:50, MG:31, PA:15, PB:25, PR:41, PE:26, PI:22,
    RJ:33, RN:24, RS:43, RO:11, RR:14, SC:42, SP:35, SE:28, TO:17
};

// DROPDOWNS
async function carregarDropdownsEmpresas() {
    try {
        const resp = await fetch('listar_empresas.php');
        if (!resp.ok) {
            const txt = await resp.text();
            console.error('listar_empresas.php retornou HTTP', resp.status, txt);
            return;
        }
        const res = await resp.json();
        if (res.error || !res.data) {
            console.error('Erro da API de empresas:', res.error || res);
            return;
        }
        let opt = res.data.map(e => {
            const end = e.endereco || {};
            return `<option value="${e.cpf_cnpj}"
                data-nome="${e.nome_razao_social}"
                data-uf="${end.uf || ''}"
                data-cmun="${end.codigo_municipio || ''}"
                data-xmun="${end.cidade || ''}"
                data-xlgr="${end.logradouro || ''}"
                data-nro="${end.numero || 'SN'}"
                data-xbairro="${end.bairro || ''}"
                data-cep="${(end.cep || '').replace(/\D/g,'')}"
            >${e.nome_razao_social}</option>`;
        }).join('');
        document.getElementById('dropEmit').innerHTML = '<option value="">Selecione...</option>' + opt;
        document.getElementById('dropDest').innerHTML = '<option value="">Selecione...</option>' + opt;
    } catch(e) { console.error("Erro ao carregar empresas", e); }
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
        const resp = await fetch('consultar_nfes.php?' + params);
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
        const params = new URLSearchParams({ top: 5, skip: 0, cpf_cnpj: cnpj });
        const resp = await fetch('consultar_nfes.php?' + params);
        const res  = await resp.json();
        const notas = res.data || [];
        const duplicada = notas.find(n => parseInt(n.numero) === nNF && parseInt(n.serie) === serie);
        return duplicada || null;
    } catch(e) {
        return null;
    }
}