
// ============================================================
// NAVEGAÇÃO NF-e / CT-e
// ============================================================

function irParaNfe() {
    document.getElementById('navNfe').classList.add('active');
    document.getElementById('navCte').classList.remove('active');
    document.querySelector('.app-container').style.display = '';
    document.querySelector('.action-bar').style.display = '';
    document.getElementById('paginaCte').style.display = 'none';
    document.getElementById('btnConsultarNotas').style.display = '';
}

function irParaCte() {
    document.getElementById('navCte').classList.add('active');
    document.getElementById('navNfe').classList.remove('active');
    document.querySelector('.app-container').style.display = 'none';
    document.querySelector('.action-bar').style.display = 'none';
    document.getElementById('paginaCte').style.display = 'block';
    document.getElementById('btnConsultarNotas').style.display = 'none';
    
    // Inicializa resizer se disponível (função está no script.js global)
    if (typeof initTableResizer === 'function') {
        initTableResizer('tabelaCtes');
    }
    
    if (!_cteEmpresasCarregadas) cteCarregarEmpresas();
}

// ============================================================
// TRANSPORTE NA NF-e
// ============================================================

function toggleTransporte() {
    const div = document.getElementById('transpConteudo');
    const icon = document.getElementById('transpToggleIcon');
    const open = div.style.display === '';
    div.style.display = open ? 'none' : '';
    icon.textContent = open ? '▼' : '▲';
}

function toggleTransportadora() {
    const mod = document.getElementById('modFrete').value;
    const showCnpj = mod === '2';
    document.getElementById('campoTransportadoraCNPJ').style.display = showCnpj ? '' : 'none';
    document.getElementById('campoTransportadoraNome').style.display = showCnpj ? '' : 'none';
}

function cteToggleTomadorOutros() {
    const tomador = document.getElementById('cteToma') ? document.getElementById('cteToma').value : '3';
    const modelo = document.getElementById('cteModelo') ? document.getElementById('cteModelo').value : '57';
    const div = document.getElementById('cteTomadorOutrosSection');

    // Só mostrar para toma=4 E modelo=57 (CT-e Normal)
    if (div) div.style.display = (tomador === '4' && modelo === '57') ? '' : 'none';
}

function getTranspNFe() {
    const mod = parseInt(document.getElementById('modFrete') ? document.getElementById('modFrete').value : '9');
    const obj = { modFrete: mod };
    if (mod === 2) {
        const cnpj = (document.getElementById('dropTransp') ? document.getElementById('dropTransp').value : '').replace(/\D/g, '');
        if (cnpj) {
            // Buscar dados da transportadora selecionada
            const select = document.getElementById('dropTransp');
            const option = select.querySelector(`option[value="${select.value}"]`);
            if (option) {
                obj.transporta = {
                    CNPJ: cnpj,
                    xNome: option.dataset.nome || ''
                };
            }
        }
    }
    return obj;
}

function getCobrancaNFe() {
    const nFat = document.getElementById('nFat')?.value?.trim();
    const vOrig = parseFloat(document.getElementById('vOrig')?.value || 0);
    const vDesc = parseFloat(document.getElementById('vDesc')?.value || 0);
    const vLiq = parseFloat(document.getElementById('vLiq')?.value || 0);
    
    const cobr = {};
    
    // Fatura
    if (nFat || vOrig > 0 || vDesc > 0 || vLiq > 0) {
        cobr.fat = {};
        if (nFat) cobr.fat.nFat = nFat;
        if (vOrig > 0) cobr.fat.vOrig = vOrig;
        if (vDesc > 0) cobr.fat.vDesc = vDesc;
        if (vLiq > 0) cobr.fat.vLiq = vLiq;
    }
    
    // Duplicatas
    const duplicatas = [];
    _duplicatas.forEach((dup, index) => {
        const nDup = document.getElementById(`nDup_${index}`)?.value?.trim();
        const dVenc = document.getElementById(`dVenc_${index}`)?.value;
        const vDup = parseFloat(document.getElementById(`vDup_${index}`)?.value || 0);
        
        if (nDup || dVenc || vDup > 0) {
            const dupObj = {};
            if (nDup) dupObj.nDup = nDup;
            if (dVenc) dupObj.dVenc = dVenc;
            if (vDup > 0) dupObj.vDup = vDup;
            duplicatas.push(dupObj);
        }
    });
    
    if (duplicatas.length > 0) {
        cobr.dup = duplicatas;
    }
    
    return Object.keys(cobr).length > 0 ? cobr : null;
}

function getCobrancaCTE() {
    // Para CTE, usamos as duplicatas da NFE se existirem
    // Como o CTE pode ser emitido separadamente, verificamos se há duplicatas
    const duplicatas = [];
    
    // Verificar se há duplicatas da NFE (compartilhadas)
    if (typeof _duplicatas !== 'undefined' && _duplicatas.length > 0) {
        _duplicatas.forEach((dup) => {
            if (dup.nDup || dup.dVenc || dup.vDup > 0) {
                const dupObj = {};
                if (dup.nDup) dupObj.nDup = dup.nDup;
                if (dup.dVenc) dupObj.dVenc = dup.dVenc;
                if (dup.vDup > 0) dupObj.vDup = dup.vDup;
                duplicatas.push(dupObj);
            }
        });
    }
    
    if (duplicatas.length > 0) {
        return {
            fat: {
                nFat: "001",
                vOrig: cteGetN('cteVTPrest') || 0,
                vDesc: 0,
                vLiq: cteGetN('cteVTPrest') || 0
            },
            dup: duplicatas
        };
    }
    
    return null;
}

// ============================================================
// CT-e STATE
// ============================================================

let _cteEmpresasCarregadas = false;
let _cteEmpresas = [];
let _cteSkip = 0;
let _cteTop  = 20;
let _cteCnpjAtual = '';
let _cteTotal = 0;
let _cteCancelando = null;
let _cteCorrigindo = null;
let _cteViewerId = null;

const UF_IBGE = {
    AC:12,AL:27,AM:13,AP:16,BA:29,CE:23,DF:53,ES:32,GO:52,
    MA:21,MG:31,MS:50,MT:51,PA:15,PB:25,PE:26,PI:22,PR:41,
    RJ:33,RN:24,RO:11,RR:14,RS:43,SC:42,SE:28,SP:35,TO:17
};

// ============================================================
// CARREGAR EMPRESAS
// ============================================================

async function cteEditar(id) {
    try {
        mostrarToast('Carregando dados para reemissão...', 'info');
        const r = await fetch('api/buscar_cte_detalhes.php?id=' + id);
        const d = await r.json();
        
        if (!r.ok || d.error) {
            mostrarToast('Erro ao carregar CT-e: ' + (d.error || 'Não encontrado'), 'error');
            return;
        }

        // Abre a modal de emissão
        abrirEmissaoCte();
        
        // Aguarda um instante para a modal renderizar antes de preencher
        setTimeout(() => {
            preencherFormularioCteComDados(d, false); // false = modo reemissão/edição
            mostrarToast('Dados carregados! Você pode ajustar e transmitir novamente.', 'success');
        }, 500);

    } catch (e) {
        mostrarToast('Erro de comunicação: ' + e.message, 'error');
    }
}

async function cteClonar(id) {
    try {
        mostrarToast('Clonando dados do CT-e...', 'info');
        const r = await fetch('api/buscar_cte_detalhes.php?id=' + id);
        const d = await r.json();
        
        if (!r.ok || d.error) {
            mostrarToast('Erro ao clonar CT-e: ' + (d.error || 'Não encontrado'), 'error');
            return;
        }

        // Abre a modal de emissão
        abrirEmissaoCte();
        
        setTimeout(() => {
            preencherFormularioCteComDados(d, true); // true = modo clone
            mostrarToast('CT-e clonado! Série e Número reiniciados para novo lançamento.', 'success');
        }, 500);

    } catch (e) {
        mostrarToast('Erro de comunicação: ' + e.message, 'error');
    }
}

function preencherFormularioCteComDados(d, isClone = false) {
    const inf = d.infCte || {};
    const ide = inf.ide || {};
    const emit = inf.emit || {};
    const rem = inf.rem || {};
    const dest = inf.dest || {};
    const vPrest = inf.vPrest || {};
    const imp = inf.imp || {};
    const icms = (imp.ICMS ? (imp.ICMS.ICMS00 || imp.ICMS.ICMS20 || imp.ICMS.ICMS45 || imp.ICMS.ICMS60 || imp.ICMS.ICMS90) : {}) || {};

    // 1. Identificação
    document.getElementById('cteModelo').value = ide.mod || 57;
    document.getElementById('cteTpCTe').value = ide.tpCTe || 0;
    document.getElementById('cteCFOP').value = ide.CFOP || '';
    document.getElementById('cteNatOp').value = ide.natOp || '';
    
    // No clone, não trazemos série e número para obrigar novo lançamento
    if (isClone) {
        document.getElementById('cteSerie').value = 1;
        document.getElementById('cteNCT').value = '';
    } else {
        document.getElementById('cteSerie').value = ide.serie || 1;
        document.getElementById('cteNCT').value = ide.nCT || '';
    }

    document.getElementById('cteModal').value = ide.modal || '01';
    document.getElementById('cteTpServ').value = ide.tpServ || 0;

    // 2. Transportadora (Emitente)
    const cnpjEmit = emit.CNPJ || '';
    document.getElementById('cteEmitCNPJ').value = cnpjMask(cnpjEmit);
    document.getElementById('cteEmitNome').value = emit.xNome || '';
    document.getElementById('cteEmitIE').value = emit.IE || '';
    document.getElementById('cteEmitCRT').value = emit.CRT || 1;
    const endE = emit.enderEmit || {};
    document.getElementById('cteEmitxLgr').value = endE.xLgr || '';
    document.getElementById('cteEmitnro').value = endE.nro || '';
    document.getElementById('cteEmitxBairro').value = endE.xBairro || '';
    document.getElementById('cteEmitCEP').value = endE.CEP || '';
    document.getElementById('cteEmitxMun').value = endE.xMun || '';
    document.getElementById('cteEmitUF').value = endE.UF || '';
    document.getElementById('cteEmitcMun').value = endE.cMun || '';

    // 3. Remetente
    const cnpjRem = rem.CNPJ || rem.CPF || '';
    document.getElementById('cteRemCNPJ').value = cnpjRem;
    document.getElementById('cbCteRem').value = cnpjMask(cnpjRem);
    document.getElementById('cteRemNome').value = rem.xNome || '';
    document.getElementById('cteRemIE').value = rem.IE || '';
    const endR = rem.enderRem || {};
    document.getElementById('cteRemxLgr').value = endR.xLgr || '';
    document.getElementById('cteRemnro').value = endR.nro || '';
    document.getElementById('cteRemxBairro').value = endR.xBairro || '';
    document.getElementById('cteRemCEP').value = endR.CEP || '';
    document.getElementById('cteRemxMun').value = endR.xMun || '';
    document.getElementById('cteRemUF').value = endR.UF || '';
    document.getElementById('cteRemcMun').value = endR.cMun || '';

    // 4. Destinatário
    const cnpjDest = dest.CNPJ || dest.CPF || '';
    document.getElementById('cteDestCNPJ').value = cnpjDest;
    document.getElementById('cbCteDest').value = cnpjMask(cnpjDest);
    document.getElementById('cteDestNome').value = dest.xNome || '';
    document.getElementById('cteDestIE').value = dest.IE || '';
    const endD = dest.enderDest || {};
    document.getElementById('cteDestxLgr').value = endD.xLgr || '';
    document.getElementById('cteDestnro').value = endD.nro || '';
    document.getElementById('cteDestxBairro').value = endD.xBairro || '';
    document.getElementById('cteDestCEP').value = endD.CEP || '';
    document.getElementById('cteDestxMun').value = endD.xMun || '';
    document.getElementById('cteDestUF').value = endD.UF || '';
    document.getElementById('cteDestcMun').value = endD.cMun || '';

    // 5. Financeiro
    document.getElementById('cteVTPrest').value = vPrest.vTPrest || 0;
    document.getElementById('cteVRec').value = vPrest.vRec || vPrest.vTPrest || 0;
    document.getElementById('cteCSTICMS').value = icms.CST || '00';
    document.getElementById('ctePRedBC').value = icms.pRedBC || 0;
    document.getElementById('ctePICMS').value = icms.pICMS || icms.pICMSSTRet || 0;
    cteToggleICMSFields();

    // Componentes do Frete
    const compDiv = document.getElementById('cteComponentes');
    compDiv.innerHTML = '';
    const componentes = vPrest.Comp || [];
    componentes.forEach(c => {
        cteAddComponente();
        const row = compDiv.querySelector('.cte-row:last-child');
        const ins = row.querySelectorAll('input');
        ins[0].value = c.xNome || '';
        ins[1].value = c.vComp || 0;
    });

    // 6. Carga
    const infCTeNorm = inf.infCTeNorm || inf.inf_cte_norm || {};
    const infCarga = infCTeNorm.infCarga || {};
    document.getElementById('cteVCarga').value = infCarga.vCarga || 0;
    document.getElementById('cteProProd').value = infCarga.proPred || '';

    // Quantidades
    const qDiv = document.getElementById('cteQuantidades');
    qDiv.innerHTML = '';
    const qtds = infCarga.infQ || [];
    qtds.forEach(q => {
        cteAddQuantidade();
        const row = qDiv.querySelector('.cte-row-qtd:last-child');
        row.querySelector('select').value = q.cUnid || '00';
        const ins = row.querySelectorAll('input');
        ins[0].value = q.tpMed || '';
        ins[1].value = q.qCarga || 0;
    });

    // 7. Documentos Referenciados
    const dDiv = document.getElementById('cteDocumentos');
    dDiv.innerHTML = '';
    const infDoc = infCTeNorm.infDoc || {};
    
    // NFe
    (infDoc.infNFe || []).forEach(n => {
        cteAddNFe();
        const row = dDiv.querySelector('.cte-row-nfe:last-child');
        row.querySelector('input').value = n.chave || '';
    });
    
    // NF Papel
    (infDoc.infNF || []).forEach(n => {
        cteAddNF();
        const row = dDiv.querySelector('.cte-row-nf:last-child');
        const ins = row.querySelectorAll('input');
        ins[0].value = n.serie || '';
        ins[1].value = n.nNF || '';
    });

    // 8. Rodoviário
    const infModal = infCTeNorm.infModal || {};
    if (infModal.rodo) {
        document.getElementById('cteRNTRC').value = infModal.rodo.RNTRC || '';
    }

    cteAtualizarModelo();
}

async function cteCarregarEmpresas() {
    if (_cteEmpresasCarregadas) return;
    try {
        const r = await fetch('api/listar_empresas.php');
        const d = await r.json();
        _cteEmpresas = Array.isArray(d) ? d : (d.data || []);
        _cteEmpresasCarregadas = true;
        ctePopularFiltroEmpresas();
        cteInicializarComboboxEmit();
    } catch(e) { console.warn('CT-e: erro ao carregar empresas', e); }
}

async function cteHabilitarEmpresa() {
    const cnpj = document.getElementById('cteEmitCNPJ').value.replace(/\D/g, '');
    if (!cnpj) { mostrarToast('Selecione uma transportadora primeiro.', 'warning'); return; }

    try {
        mostrarToast('Ativando CT-e na Nuvem Fiscal...', 'info');
        const r = await fetch('api/configurar_cte_empresa.php?cnpj=' + cnpj);
        const d = await r.json();
        
        if (r.ok) {
            mostrarToast('CT-e ativado com sucesso para esta empresa!', 'success');
        } else {
            const msg = d.error || d.message || 'Erro ao ativar CT-e';
            mostrarToast(msg, 'error');
        }
    } catch(e) {
        mostrarToast('Erro de comunicação: ' + e.message, 'error');
    }
}

function cnpjMask(v) {
    v = v.replace(/\D/g, '');
    if (v.length <= 11) {
        return v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    }
    return v.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
}

function ctePopularFiltroEmpresas() {
    const sel = document.getElementById('filtroEmpresaCte');
    if (!sel) return;
    
    // Agora traz todas as empresas (Global)
    const empresas = _cteEmpresas;
    
    sel.innerHTML = '<option value="">Selecione a transportadora...</option>';
    empresas.forEach(e => {
        const opt = document.createElement('option');
        const cnpj = e.cpf_cnpj || e.cnpj || '';
        opt.value = cnpj;
        opt.textContent = (e.nome_razao_social || e.razao_social || e.nome || '') + ' — ' + cnpjMask(cnpj);
        opt.dataset.nome = e.nome_razao_social || e.razao_social || e.nome || '';
        sel.appendChild(opt);
    });
}

function cteInicializarComboboxEmit() {
    // Inicializa os três dropdowns globais
    const drops = ['dropCteEmit', 'dropCteRem', 'dropCteDest'];
    const empresas = _cteEmpresas;

    drops.forEach(id => {
        const drop = document.getElementById(id);
        if (!drop) return;

        drop.innerHTML = '<option value="">Selecione uma empresa...</option>';
        empresas.forEach(e => {
            const opt = document.createElement('option');
            const cnpj = e.cpf_cnpj || e.cnpj || '';
            opt.value = cnpj;
            opt.textContent = (e.nome_razao_social || e.razao_social || e.nome || '') + ' — ' + cnpjMask(cnpj);
            opt.dataset.nome = e.nome_razao_social || e.razao_social || e.nome || '';
            drop.appendChild(opt);
        });
    });
}

function cteSelecionarEmitente(sel) {
    const cnpj = sel.value;
    const emp  = _cteEmpresas.find(e => (e.cpf_cnpj||e.cnpj||'') === cnpj);
    if (emp) {
        ctePreencherEmitente(emp);
        // Sincroniza o input de busca do combobox
        const cb = document.getElementById('cbCteEmit');
        if (cb) cb.value = (emp.nome_razao_social || emp.razao_social || emp.nome || '');
    }
}

function ctePreencherEmitente(e) {
    const cnpj = e.cpf_cnpj||e.cnpj||'';
    const end = e.endereco || {};
    document.getElementById('cteEmitNome').value    = e.nome_razao_social||e.razao_social||e.nome||'';
    document.getElementById('cteEmitCNPJ').value    = cnpjMask(cnpj);
    document.getElementById('cteEmitIE').value      = e.inscricao_estadual||'';
    document.getElementById('cteEmitUF').value      = (end.uf || end.estado) || e.uf || '';
    document.getElementById('cteEmitcMun').value    = (end.codigo_ibge || end.codigo_municipio) || e.codigo_ibge || '';
    document.getElementById('cteEmitxMun').value    = (end.municipio || end.cidade) || e.cidade || '';
    document.getElementById('cteEmitxLgr').value    = end.logradouro || '';
    document.getElementById('cteEmitnro').value     = end.numero || 'SN';
    document.getElementById('cteEmitxBairro').value = end.bairro || '';
    document.getElementById('cteEmitCEP').value     = (end.cep||'').replace(/\D/g,'');
    _cteCnpjAtual = cnpj.replace(/\D/g,'');
}

function cteSelecionarRemetente(sel) {
    const cnpj = sel.value;
    const emp  = _cteEmpresas.find(e => (e.cpf_cnpj||e.cnpj||'') === cnpj);
    if (emp) {
        ctePreencherParte(emp, 'Rem');
        const cb = document.getElementById('cbCteRem');
        if (cb) cb.value = (emp.nome_razao_social || emp.razao_social || emp.nome || '');
    }
}

function cteSelecionarDestinatario(sel) {
    const cnpj = sel.value;
    const emp  = _cteEmpresas.find(e => (e.cpf_cnpj||e.cnpj||'') === cnpj);
    if (emp) {
        ctePreencherParte(emp, 'Dest');
        const cb = document.getElementById('cbCteDest');
        if (cb) cb.value = (emp.nome_razao_social || emp.razao_social || emp.nome || '');
    }
}

function ctePreencherParte(e, prefix) {
    const cnpj = e.cpf_cnpj||e.cnpj||'';
    const end = e.endereco || {};
    document.getElementById('cte' + prefix + 'CNPJ').value    = cnpj;
    document.getElementById('cte' + prefix + 'Nome').value    = e.nome_razao_social || e.razao_social || e.nome || '';
    document.getElementById('cte' + prefix + 'IE').value      = e.inscricao_estadual || '';
    document.getElementById('cte' + prefix + 'xLgr').value    = end.logradouro || '';
    document.getElementById('cte' + prefix + 'nro').value     = end.numero || 'SN';
    document.getElementById('cte' + prefix + 'xBairro').value = end.bairro || '';
    document.getElementById('cte' + prefix + 'CEP').value     = (end.cep || '').replace(/\D/g,'');
    document.getElementById('cte' + prefix + 'xMun').value    = end.municipio || end.cidade || '';
    document.getElementById('cte' + prefix + 'UF').value      = end.uf || e.uf || '';
    document.getElementById('cte' + prefix + 'cMun').value    = end.codigo_ibge || end.codigo_municipio || '';
    
    // Se for tomador automático, atualiza
    cteToggleTomadorOutros();
}

async function cteConsultarCnpjTomador(input) {
    const cnpj = input.value.replace(/\D/g, '');
    if (cnpj.length !== 14) return;

    const btn = input.nextElementSibling;
    const originalText = btn.innerText;
    btn.disabled = true;
    btn.innerText = '⏳';

    try {
        const r = await fetch('api/buscar_cnpj.php?cnpj=' + cnpj);
        const d = await r.json();
        
        if (d.error) {
            mostrarToast('Erro ao consultar CNPJ: ' + d.error, 'error');
            return;
        }

        const end = d.estabelecimento?.endereco || d.endereco || {};
        document.getElementById('cteTomaNome').value   = d.razao_social || d.nome || '';
        document.getElementById('cteTomaIE').value     = ''; 
        document.getElementById('cteTomaxLgr').value   = end.logradouro || '';
        document.getElementById('cteTomanro').value    = end.numero || 'SN';
        document.getElementById('cteTomaxBairro').value = end.xBairro || end.bairro || '';
        document.getElementById('cteTomaCEP').value    = (end.cep || '').replace(/\D/g, '');
        document.getElementById('cteTomaxMun').value   = end.municipio?.descricao || end.cidade || '';
        document.getElementById('cteTomaUF').value     = end.estado?.sigla || end.uf || '';
        document.getElementById('cteTomacMun').value   = end.municipio?.codigo_ibge || end.codigo_municipio || '';

        mostrarToast('Dados do tomador carregados!', 'success');
    } catch (e) {
        console.error(e);
        mostrarToast('Erro ao buscar CNPJ do tomador.', 'error');
    } finally {
        btn.disabled = false;
        btn.innerText = originalText;
    }
}


// ============================================================
// LISTAR CT-es
// ============================================================

async function buscarCtes(skip) {
    skip = skip || 0;
    _cteSkip = skip;
    const cnpj = ((document.getElementById('filtroEmpresaCte') ? document.getElementById('filtroEmpresaCte').value : '') || '').replace(/\D/g,'');
    const top  = parseInt((document.getElementById('filtroTopCte') ? document.getElementById('filtroTopCte').value : '20') || '20');
    _cteTop = top;
    if (!cnpj) {
        document.getElementById('corpoCtes').innerHTML =
            '<tr><td colspan="8" style="text-align:center;color:var(--text3);padding:32px;">Selecione uma transportadora para carregar os CT-es.</td></tr>';
        return;
    }
    _cteCnpjAtual = cnpj;
    document.getElementById('loadingCtes').style.display = 'block';
    document.getElementById('corpoCtes').innerHTML = '';
    try {
        const params = new URLSearchParams({ cpf_cnpj: cnpj, top: top, skip: skip });
        const r = await fetch('api/listar_ctes.php?' + params.toString());
        const d = await r.json();
        document.getElementById('loadingCtes').style.display = 'none';
        if (!r.ok) { mostrarToast('Erro ao carregar CT-es: ' + (d.error||r.status), 'error'); return; }

        const statusFiltro = (document.getElementById('filtroStatusCte') ? document.getElementById('filtroStatusCte').value : '') || '';
        let dados = d.data || d.value || [];
        if (statusFiltro) dados = dados.filter(function(c) { return (c.status||'').toLowerCase() === statusFiltro; });

        _cteTotal = d['@count'] != null ? d['@count'] : dados.length;
        renderCtes(dados);
        atualizarPaginacaoCte(dados.length);
    } catch(e) {
        document.getElementById('loadingCtes').style.display = 'none';
        mostrarToast('Erro ao buscar CT-es', 'error');
    }
}

function paginarCtes(dir) {
    var newSkip = _cteSkip + dir * _cteTop;
    if (newSkip < 0) return;
    buscarCtes(newSkip);
}

function atualizarPaginacaoCte(qtd) {
    var info = document.getElementById('infoPaginacaoCte');
    if (info) info.textContent = 'Exibindo ' + (_cteSkip + 1) + '–' + (_cteSkip + qtd) + (_cteTotal ? ' de ' + _cteTotal : '');
    var btnAnt  = document.getElementById('btnAnteriorCte');
    var btnProx = document.getElementById('btnProximoCte');
    if (btnAnt)  btnAnt.disabled  = _cteSkip <= 0;
    if (btnProx) btnProx.disabled = qtd < _cteTop;
}

var CTE_STATUS_BADGE = {
    autorizado: '<span class="status-badge status-auth">✅ Autorizado</span>',
    rejeitado:  '<span class="status-badge status-rej">❌ Rejeitado</span>',
    cancelado:  '<span class="status-badge status-canc">🚫 Cancelado</span>',
    pendente:   '<span class="status-badge status-pend">⏳ Pendente</span>',
};

function renderCtes(lista) {
    var tbody = document.getElementById('corpoCtes');
    if (!tbody) return;
    if (!lista.length) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text3);padding:32px;">Nenhum CT-e encontrado.</td></tr>';
        return;
    }
    tbody.innerHTML = lista.map(function(c) {
        var st    = (c.status||'').toLowerCase();
        var badge = CTE_STATUS_BADGE[st] || ('<span class="status-badge">' + (c.status||'—') + '</span>');
        var rem   = (c.remetente && (c.remetente.nome || c.remetente.razao_social)) || '—';
        var dest  = (c.destinatario && (c.destinatario.nome || c.destinatario.razao_social)) || '—';
        var val   = (c.valores && c.valores.valor_frete != null) ? 'R$ ' + Number(c.valores.valor_frete).toLocaleString('pt-BR',{minimumFractionDigits:2}) : '—';
        var chave = (c.chave_acesso||'').replace(/\D/g,'');
        var serie = c.serie||'?';
        var nCT   = c.numero||'?';
        var dhEmi = c.data_emissao ? c.data_emissao.slice(0,10).split('-').reverse().join('/') : '—';
        var id    = c.id || '';
        var isAut = st === 'autorizado';
        var isCan = st === 'cancelado';
        var isRej = st === 'rejeitado';
        var isPend= st === 'pendente';

        return '<tr>' +
            '<td>' + dhEmi + '</td>' +
            '<td>' + serie + '/' + nCT + '</td>' +
            '<td style="font-size:11px;">' + rem + '</td>' +
            '<td style="font-size:11px;">' + dest + '</td>' +
            '<td style="font-size:11px;color:var(--green);font-weight:600;">' + val + '</td>' +
            '<td>' + badge + '</td>' +
            '<td style="font-family:monospace;font-size:9px;max-width:120px;overflow:hidden;text-overflow:ellipsis;" title="' + chave + '">' + (chave||'—') + '</td>' +
            '<td><div style="display:flex;gap:3px;flex-wrap:wrap;">' +
              (isAut ? '<button class="btn-cte-action" onclick="abrirCteViewer(\'' + id + '\',\'' + serie + '/' + nCT + '\')">👁 DACTE</button>' : '') +
              ((isAut||isCan) ? '<button class="btn-cte-action" onclick="cteDownloadDireto(\'' + id + '\',\'xml\')">📄 XML</button>' : '') +
              (isAut ? '<button class="btn-cte-action" onclick="cteDownloadDireto(\'' + id + '\',\'pdf\')">🖨 PDF</button>' : '') +
              (isCan ? '<button class="btn-cte-action" onclick="cteDownloadDireto(\'' + id + '\',\'cancelamento_xml\')">📄 XML Can.</button>' : '') +
              (isCan ? '<button class="btn-cte-action" onclick="cteDownloadDireto(\'' + id + '\',\'cancelamento_pdf\')">🖨 PDF Can.</button>' : '') +
              (isAut ? '<button class="btn-cte-action danger" onclick="abrirCancelamentoCte(\'' + id + '\',\'' + serie + '/' + nCT + '\')">🗑 Cancelar</button>' : '') +
              (isAut ? '<button class="btn-cte-action" onclick="abrirCartaCorrecaoCte(\'' + id + '\')">✏️ Correção</button>' : '') +
              ((isRej||isPend) ? '<button class="btn-cte-action success" onclick="sincronizarCte(\'' + id + '\')">🔄 Sincronizar</button>' : '') +
              ((isRej||isPend) ? '<button class="btn-cte-action" style="background:var(--primary);color:#fff;" onclick="cteEditar(\'' + id + '\')">✍️ Reemitir</button>' : '') +
              '<button class="btn-cte-action" style="background:var(--purple);color:#fff;" onclick="cteClonar(\'' + id + '\')">📋 Clonar</button>' +
              (isRej ? '<button class="btn-cte-action" onclick="cteDownloadDireto(\'' + id + '\',\'xml_conhecimento\')">📄 XML Rej.</button>' : '') +
            '</div></td></tr>';
    }).join('');
}

// ============================================================
// VIEWER DACTE
// ============================================================

function abrirCteViewer(id, label) {
    _cteViewerId = id;
    document.getElementById('cteViewerTitulo').textContent = 'DACTE — CT-e ' + label;
    document.getElementById('iframeCte').src = 'api/download_cte.php?id=' + id + '&tipo=pdf';
    document.getElementById('cteViewerModal').style.display = 'block';
}

function fecharCteViewer() {
    document.getElementById('cteViewerModal').style.display = 'none';
    document.getElementById('iframeCte').src = '';
    _cteViewerId = null;
}

function cteDownload(tipo) {
    if (_cteViewerId) cteDownloadDireto(_cteViewerId, tipo);
}

function cteDownloadDireto(id, tipo) {
    window.open('api/download_cte.php?id=' + encodeURIComponent(id) + '&tipo=' + tipo, '_blank');
}

// ============================================================
// STATUS SEFAZ CT-e
// ============================================================

async function verificarStatusSefazCte() {
    var cnpj = _cteCnpjAtual || ((document.getElementById('filtroEmpresaCte') ? document.getElementById('filtroEmpresaCte').value : '') || '').replace(/\D/g,'');
    if (!cnpj) { mostrarToast('Selecione uma transportadora primeiro.', 'warning'); return; }

    document.getElementById('statusSefazCteContent').innerHTML =
        '<div style="text-align:center;padding:32px;color:var(--text2);"><div class="spinner" style="width:24px;height:24px;margin:0 auto 8px;"></div>Consultando SEFAZ...</div>';
    document.getElementById('modalStatusSefazCte').style.display = 'flex';

    try {
        var r = await fetch('api/status_sefaz_cte.php?cpf_cnpj=' + cnpj);
        var d = await r.json();
        var ok = r.ok;
        document.getElementById('statusSefazCteContent').innerHTML =
            '<div style="text-align:center;padding:24px;">' +
            '<div style="font-size:48px;margin-bottom:12px;">' + (ok ? '✅' : '⚠️') + '</div>' +
            '<div style="font-size:16px;font-weight:600;margin-bottom:8px;">' + (d.descricao||d.motivo||'Serviço disponível') + '</div>' +
            '<div style="font-size:12px;color:var(--text2);">Status: ' + (d.status||'OK') + ' | Ambiente: Homologação</div>' +
            (d.dhRecbto ? '<div style="font-size:11px;color:var(--text3);margin-top:6px;">' + d.dhRecbto + '</div>' : '') +
            '</div>';
    } catch(e) {
        document.getElementById('statusSefazCteContent').innerHTML =
            '<div style="text-align:center;padding:24px;color:var(--red);">Erro ao consultar status SEFAZ.</div>';
    }
}

// ============================================================
// SINCRONIZAR CT-e
// ============================================================

async function sincronizarCte(id) {
    mostrarToast('Sincronizando CT-e com SEFAZ...', 'info');
    try {
        var r = await fetch('api/sincronizar_cte.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': await getCsrfToken() },
            body: JSON.stringify({ id: id })
        });
        var d = await r.json();
        if (r.ok) {
            mostrarToast('CT-e sincronizado com sucesso.', 'success');
            buscarCtes(_cteSkip);
        } else {
            mostrarToast('Erro: ' + (d.error||d.message||r.status), 'error');
        }
    } catch(e) { mostrarToast('Erro ao sincronizar CT-e.', 'error'); }
}

// ============================================================
// CANCELAMENTO CT-e
// ============================================================

function abrirCancelamentoCte(id, serieNum) {
    _cteCancelando = id;
    document.getElementById('cancelCteId').textContent    = id;
    document.getElementById('cancelCteSerie').textContent = serieNum;
    document.getElementById('cancelCteJustificativa').value = '';
    document.getElementById('cancelCteContador').textContent = '0/255';
    document.getElementById('modalCancelamentoCte').style.display = 'flex';
}

function fecharModalCancelamentoCte() {
    document.getElementById('modalCancelamentoCte').style.display = 'none';
    _cteCancelando = null;
}

async function executarCancelamentoCte() {
    if (!_cteCancelando) return;
    var just = document.getElementById('cancelCteJustificativa').value.trim();
    if (just.length < 15) { mostrarToast('Justificativa deve ter no mínimo 15 caracteres.', 'error'); return; }

    var btn = document.querySelector('#modalCancelamentoCte .btn-danger');
    btn.disabled = true; btn.textContent = '⏳ Cancelando...';

    try {
        var r = await fetch('api/cancelar_cte.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': await getCsrfToken() },
            body: JSON.stringify({ id: _cteCancelando, justificativa: just })
        });
        var d = await r.json();
        if (d.success) {
            mostrarToast('CT-e cancelado com sucesso!', 'success');
            fecharModalCancelamentoCte();
            buscarCtes(_cteSkip);
        } else {
            mostrarToast('Erro: ' + (d.error||d.message||'Falha ao cancelar'), 'error');
        }
    } catch(e) { mostrarToast('Erro ao cancelar CT-e.', 'error'); }
    finally { btn.disabled = false; btn.textContent = '🗑️ Confirmar Cancelamento'; }
}

// ============================================================
// CARTA DE CORREÇÃO CT-e
// ============================================================

function abrirCartaCorrecaoCte(id) {
    _cteCorrigindo = id;
    document.getElementById('cceCteInfo').textContent = 'ID: ' + id;
    document.getElementById('cceDescEvento').value = '';
    document.getElementById('cceContador').textContent = '0/1000';
    document.getElementById('cceNSeqEvento').value = 1;
    document.getElementById('modalCartaCorrecaoCte').style.display = 'flex';
}

function fecharCartaCorrecaoCte() {
    document.getElementById('modalCartaCorrecaoCte').style.display = 'none';
    _cteCorrigindo = null;
}

async function enviarCartaCorrecaoCte() {
    if (!_cteCorrigindo) return;
    var desc = document.getElementById('cceDescEvento').value.trim();
    var seq  = parseInt(document.getElementById('cceNSeqEvento').value) || 1;
    if (desc.length < 15) { mostrarToast('Descrição deve ter no mínimo 15 caracteres.', 'error'); return; }

    var btn = document.querySelector('#modalCartaCorrecaoCte .btn-primary');
    btn.disabled = true; btn.textContent = '⏳ Enviando...';

    try {
        var r = await fetch('api/carta_correcao_cte.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': await getCsrfToken() },
            body: JSON.stringify({ id: _cteCorrigindo, descEvento: desc, nSeqEvento: seq })
        });
        var d = await r.json();
        if (r.ok) {
            mostrarToast('Carta de correção enviada com sucesso!', 'success');
            fecharCartaCorrecaoCte();
            buscarCtes(_cteSkip);
        } else {
            mostrarToast('Erro: ' + (d.error||d.message||r.status), 'error');
        }
    } catch(e) { mostrarToast('Erro ao enviar correção.', 'error'); }
    finally { btn.disabled = false; btn.textContent = '✏️ Enviar Correção'; }
}

// ============================================================
// EMISSÃO CT-e — ABERTURA / ABAS
// ============================================================

function abrirEmissaoCte() {
    if (!_cteEmpresasCarregadas) cteCarregarEmpresas();
    document.getElementById('modalEmissaoCte').style.display = 'block';
    cteAba('id');
    cteInicializarComponentes();
    cteAtualizarModal();
}

function fecharEmissaoCte() {
    document.getElementById('modalEmissaoCte').style.display = 'none';
}

function cteAba(nome) {
    var abas = ['id','emit','partes','serv','carga','modal'];
    abas.forEach(function(a) {
        var cap = a.charAt(0).toUpperCase() + a.slice(1);
        var abaEl = document.getElementById('cteAba' + cap);
        var tabEl = document.getElementById('cteTab' + cap);
        if (abaEl) abaEl.classList.remove('active');
        if (tabEl) tabEl.classList.remove('active');
    });
    var capNome = nome.charAt(0).toUpperCase() + nome.slice(1);
    var abaEl = document.getElementById('cteAba' + capNome);
    var tabEl = document.getElementById('cteTab' + capNome);
    if (abaEl) abaEl.classList.add('active');
    if (tabEl) tabEl.classList.add('active');
}

function cteAlerta(tipo, msg) {
    var div  = document.getElementById('cteAlerta');
    var icon = document.getElementById('cteAlertaIcon');
    var txt  = document.getElementById('cteAlertaMsg');
    div.className = 'emp-alert ' + tipo;
    icon.textContent = tipo === 'success' ? '✅' : tipo === 'error' ? '❌' : '⚠️';
    txt.textContent  = msg;
    div.style.display = 'flex';
    setTimeout(function() { div.style.display = 'none'; }, 7000);
}

// ============================================================
// COMPONENTES DINÂMICOS
// ============================================================

function cteInicializarComponentes() {
    var comp = document.getElementById('cteComponentes');
    var qtd  = document.getElementById('cteQuantidades');
    var docs = document.getElementById('cteDocumentos');
    if (comp && !comp.children.length) cteAddComponente();
    if (qtd  && !qtd.children.length)  cteAddQuantidade();
    if (docs && !docs.children.length)  cteAddNFe();
}

function cteAddComponente() {
    var d = document.getElementById('cteComponentes');
    var row = document.createElement('div');
    row.className = 'cte-row cte-row-comp';
    row.innerHTML =
        '<input type="text" placeholder="Nome (ex: FRETE VALOR)" value="FRETE VALOR">' +
        '<input type="number" placeholder="Valor (R$)" min="0" step="0.01" value="0" oninput="cteSincronizarFreteComp()">' +
        '<button class="btn-del" onclick="this.parentElement.remove()">✕</button>';
    d.appendChild(row);
}

function cteSincronizarFreteComp() {
    var inputs = document.querySelectorAll('#cteComponentes .cte-row input[type=number]');
    var total = 0;
    inputs.forEach(function(i) { total += parseFloat(i.value) || 0; });
    var vt = document.getElementById('cteVTPrest');
    var vr = document.getElementById('cteVRec');
    if (vt) vt.value = total.toFixed(2);
    if (vr) vr.value = total.toFixed(2);
    cteRecalcICMS();
}

function cteAddQuantidade() {
    var d = document.getElementById('cteQuantidades');
    var row = document.createElement('div');
    row.className = 'cte-row cte-row-qtd';
    row.innerHTML =
        '<select>' +
            '<option value="00">00 – M³</option>' +
            '<option value="01">01 – KG</option>' +
            '<option value="02">02 – TON</option>' +
            '<option value="03" selected>03 – Unidade</option>' +
            '<option value="04">04 – Litros</option>' +
        '</select>' +
        '<input type="text" placeholder="Tipo (ex: VOLUMES)" value="VOLUMES">' +
        '<input type="number" placeholder="Quantidade" min="0" step="0.001" value="1">' +
        '<button class="btn-del" onclick="this.parentElement.remove()">✕</button>';
    d.appendChild(row);
}

function cteAddNFe() {
    var d = document.getElementById('cteDocumentos');
    var row = document.createElement('div');
    row.className = 'cte-row cte-row-nfe';
    row.innerHTML =
        '<input type="text" placeholder="Chave NF-e (44 dígitos ou com espaços)" maxlength="59" inputmode="numeric"' +
        ' style="font-family:monospace;font-size:11px;"' +
        ' oninput="this.value=this.value.replace(/[^\\d ]/g,\'\').slice(0,59)">' +
        '<button class="btn-ghost" title="Importar dados da NFe" onclick="cteConsultarEImportarNFe(this.previousElementSibling)" style="padding: 2px 8px;">🔍</button>' +
        '<button class="btn-del" onclick="this.parentElement.remove()">✕</button>';
    d.appendChild(row);
}

async function cteConsultarEImportarNFe(input) {
    const chave = input.value.replace(/\D/g, '');
    if (chave.length !== 44) { mostrarToast('Chave de NFe inválida (deve ter 44 dígitos).', 'warning'); return; }

    const btn = input.nextElementSibling;
    const originalText = btn.innerText;
    input.disabled = true;
    btn.disabled = true;
    btn.innerText = '⏳';

    try {
        const r = await fetch('api/buscar_nfe.php?chave=' + chave);
        const d = await r.json();
        
        if (!r.ok || d.error) {
            mostrarToast('Erro ao buscar NFe: ' + (d.error || 'Não encontrada'), 'error');
            return;
        }

        const inf = d.infNFe;
        if (!inf) { mostrarToast('Dados da NFe não encontrados no retorno.', 'error'); return; }

        preencherDadosCteComInfNFe(inf);
        mostrarToast('Dados da NFe importados para o CT-e!', 'success');
        
    } catch (e) {
        console.error(e);
        mostrarToast('Erro ao processar importação da NFe.', 'error');
    } finally {
        input.disabled = false;
        btn.disabled = false;
        btn.innerText = originalText;
    }
}

/**
 * Preenche os campos do formulário CT-e com base no objeto infNFe (da API ou XML)
 */
function preencherDadosCteComInfNFe(inf) {
    // 1. Importar Valor da Carga (vNF)
    const vNF = parseFloat(inf.total?.ICMSTot?.vNF || inf.total?.vNF || 0);
    if (vNF > 0) {
        const vCargaEl = document.getElementById('cteVCarga');
        if (vCargaEl) {
            const atual = parseFloat(vCargaEl.value) || 0;
            vCargaEl.value = (atual + vNF).toFixed(2);
        }
    }

    // 2. Importar Produto Predominante se estiver vazio
    const proProdEl = document.getElementById('cteProProd');
    if (proProdEl && !proProdEl.value && inf.det && inf.det[0] && inf.det[0].prod) {
        proProdEl.value = (inf.det[0].prod.xProd || '').substring(0, 60);
    }

    // 3. Importar Quantidades (Listar itens da NFe individualmente)
    if (inf.det && inf.det.length > 0) {
        const divQtds = document.getElementById('cteQuantidades');
        
        // Se houver apenas uma linha de "VOLUMES" com valor 1 ou vazia, podemos removê-la para não poluir
        const rows = divQtds.querySelectorAll('.cte-row-qtd');
        if (rows.length === 1) {
            const valInput = rows[0].querySelectorAll('input')[1];
            if (!valInput || parseFloat(valInput.value) <= 1) {
                rows[0].remove();
            }
        }

        inf.det.forEach(item => {
            const qCom = parseFloat(item.prod?.qCom || 0);
            if (qCom > 0) {
                cteAddQuantidade();
                const newRow = divQtds.querySelector('.cte-row-qtd:last-child');
                const select = newRow.querySelector('select');
                const inputs = newRow.querySelectorAll('input');
                
                if (inputs[0]) inputs[0].value = (item.prod?.xProd || 'ITEM').substring(0, 20);
                if (inputs[1]) inputs[1].value = qCom;

                if (select) {
                    const u = (item.prod?.uCom || '').toUpperCase();
                    if (u.includes('KG')) select.value = '01';
                    else if (u.includes('TON')) select.value = '02';
                    else if (u.includes('M3')) select.value = '00';
                    else if (u.includes('L')) select.value = '04';
                    else select.value = '03'; // Padrão: Unidade
                }
            }
        });
        if (!inf.chave && !inf.NFeLocal) mostrarToast('Itens da NF-e importados com sucesso.', 'success');
    } else {
        // Caso não tenha itens detalhados (ex: nota resumo), adiciona/soma 1 volume genérico
        let rows = document.querySelectorAll('#cteQuantidades .cte-row-qtd');
        let targetInput = null;
        for (let row of rows) {
            let descInput = row.querySelectorAll('input')[0];
            if (descInput && descInput.value.trim().toUpperCase() === 'VOLUMES') {
                targetInput = row.querySelectorAll('input')[1];
                break;
            }
        }
        if (targetInput) {
            targetInput.value = (parseFloat(targetInput.value) || 0) + 1;
        } else {
            cteAddQuantidade();
            let lastRow = document.querySelector('#cteQuantidades .cte-row-qtd:last-child');
            if (lastRow) {
                lastRow.querySelectorAll('input')[0].value = 'VOLUMES';
                lastRow.querySelectorAll('input')[1].value = 1;
            }
        }
        if (!inf.chave && !inf.NFeLocal) mostrarToast('NF-e importada (sem detalhes de itens — apenas valor e 1 volume adicionado).', 'warning');
    }

    // 4. Se Remetente estiver vazio, tenta preencher com dados da NFe (Emitente da NFe)
    if (!document.getElementById('cteRemCNPJ').value && inf.emit) {
        const e = inf.emit;
        document.getElementById('cteRemCNPJ').value = e.CNPJ || e.CPF || '';
        document.getElementById('cteRemNome').value = e.xNome || '';
        document.getElementById('cteRemIE').value = e.IE || 'ISENTO';
        if (e.enderEmit) {
            const end = e.enderEmit;
            document.getElementById('cteRemxLgr').value = end.xLgr || '';
            document.getElementById('cteRemnro').value = end.nro || 'SN';
            document.getElementById('cteRemxBairro').value = end.xBairro || '';
            document.getElementById('cteRemCEP').value = end.CEP || '';
            document.getElementById('cteRemxMun').value = end.xMun || '';
            document.getElementById('cteRemUF').value = end.UF || '';
            document.getElementById('cteRemcMun').value = end.cMun || '';
        }
    }

    // 5. Se Destinatário estiver vazio, tenta preencher com dados da NFe (Destinatário da NFe)
    if (!document.getElementById('cteDestCNPJ').value && inf.dest) {
        const d = inf.dest;
        document.getElementById('cteDestCNPJ').value = d.CNPJ || d.CPF || '';
        document.getElementById('cteDestNome').value = d.xNome || '';
        document.getElementById('cteDestIE').value = d.IE || 'ISENTO';
        if (d.enderDest) {
            const end = d.enderDest;
            document.getElementById('cteDestxLgr').value = end.xLgr || '';
            document.getElementById('cteDestnro').value = end.nro || 'SN';
            document.getElementById('cteDestxBairro').value = end.xBairro || '';
            document.getElementById('cteDestCEP').value = end.CEP || '';
            document.getElementById('cteDestxMun').value = end.xMun || '';
            document.getElementById('cteDestUF').value = end.UF || '';
            document.getElementById('cteDestcMun').value = end.cMun || '';
        }
    }
}


/**
 * Importa um XML de NF-e localmente e preenche os campos do CT-e
 */
function cteImportarXmlLocal(input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(e.target.result, "text/xml");
            
            // Verifica se é uma NF-e
            const infNFe = xmlDoc.getElementsByTagName("infNFe")[0];
            if (!infNFe) {
                mostrarToast("Arquivo não parece ser uma NF-e válida.", "error");
                return;
            }

            // Função auxiliar para pegar valor de tag
            const getTag = (parent, tag) => {
                const el = parent.getElementsByTagName(tag)[0];
                return el ? el.textContent : "";
            };

            // Mapear para o formato que a função preencherDadosCteComInfNFe espera
            const inf = {
                NFeLocal: true,
                ide: { nNF: getTag(infNFe, "nNF"), serie: getTag(infNFe, "serie") },
                emit: { 
                    CNPJ: getTag(xmlDoc.getElementsByTagName("emit")[0], "CNPJ"),
                    CPF: getTag(xmlDoc.getElementsByTagName("emit")[0], "CPF"),
                    xNome: getTag(xmlDoc.getElementsByTagName("emit")[0], "xNome"),
                    IE: getTag(xmlDoc.getElementsByTagName("emit")[0], "IE"),
                    enderEmit: {
                        xLgr: getTag(xmlDoc.getElementsByTagName("enderEmit")[0], "xLgr"),
                        nro: getTag(xmlDoc.getElementsByTagName("enderEmit")[0], "nro"),
                        xBairro: getTag(xmlDoc.getElementsByTagName("enderEmit")[0], "xBairro"),
                        xMun: getTag(xmlDoc.getElementsByTagName("enderEmit")[0], "xMun"),
                        cMun: getTag(xmlDoc.getElementsByTagName("enderEmit")[0], "cMun"),
                        UF: getTag(xmlDoc.getElementsByTagName("enderEmit")[0], "UF"),
                        CEP: getTag(xmlDoc.getElementsByTagName("enderEmit")[0], "CEP"),
                    }
                },
                dest: {
                    CNPJ: getTag(xmlDoc.getElementsByTagName("dest")[0], "CNPJ"),
                    CPF: getTag(xmlDoc.getElementsByTagName("dest")[0], "CPF"),
                    xNome: getTag(xmlDoc.getElementsByTagName("dest")[0], "xNome"),
                    IE: getTag(xmlDoc.getElementsByTagName("dest")[0], "IE"),
                    enderDest: {
                        xLgr: getTag(xmlDoc.getElementsByTagName("enderDest")[0], "xLgr"),
                        nro: getTag(xmlDoc.getElementsByTagName("enderDest")[0], "nro"),
                        xBairro: getTag(xmlDoc.getElementsByTagName("enderDest")[0], "xBairro"),
                        xMun: getTag(xmlDoc.getElementsByTagName("enderDest")[0], "xMun"),
                        cMun: getTag(xmlDoc.getElementsByTagName("enderDest")[0], "cMun"),
                        UF: getTag(xmlDoc.getElementsByTagName("enderDest")[0], "UF"),
                        CEP: getTag(xmlDoc.getElementsByTagName("enderDest")[0], "CEP"),
                    }
                },
                total: {
                    ICMSTot: { vNF: getTag(xmlDoc.getElementsByTagName("ICMSTot")[0], "vNF") }
                },
                det: []
            };

            // Pegar a chave (do atributo Id do infNFe ou da tag chNFe se for protNFe)
            let chave = infNFe.getAttribute("Id") || "";
            chave = chave.replace(/\D/g, '');
            if (!chave) {
                chave = getTag(xmlDoc, "chNFe");
            }
            inf.chave = chave;

            // Extrair itens
            const dets = xmlDoc.getElementsByTagName("det");
            for (let i = 0; i < dets.length; i++) {
                const prod = dets[i].getElementsByTagName("prod")[0];
                if (prod) {
                    inf.det.push({
                        prod: {
                            xProd: getTag(prod, "xProd"),
                            qCom: getTag(prod, "qCom"),
                            uCom: getTag(prod, "uCom")
                        }
                    });
                }
            }

            preencherDadosCteComInfNFe(inf);
            
            // Se tiver chave, adiciona na lista de documentos
            if (chave.length === 44) {
                const docsRows = document.querySelectorAll('#cteDocumentos .cte-row-nfe input');
                let found = false;
                docsRows.forEach(i => { if(i.value.replace(/\D/g,'') === chave) found = true; });
                
                if (!found) {
                    cteAddNFe();
                    const lastRow = document.querySelector('#cteDocumentos .cte-row-nfe:last-child');
                    if (lastRow) lastRow.querySelector('input').value = chave;
                }
            }

            mostrarToast("Dados importados do XML com sucesso!", "success");
        } catch (err) {
            console.error(err);
            mostrarToast("Erro ao processar XML: " + err.message, "error");
        }
        input.value = ""; 
    };
    reader.readAsText(file);
}

function cteAddNF() {
    var d = document.getElementById('cteDocumentos');
    var row = document.createElement('div');
    row.className = 'cte-row cte-row-nf';
    row.innerHTML =
        '<input type="text" placeholder="Série" maxlength="3" style="max-width:60px;">' +
        '<input type="text" placeholder="Número NF papel">' +
        '<button class="btn-del" onclick="this.parentElement.remove()">✕</button>';
    d.appendChild(row);
}

function cteAddOutro() {
    var d = document.getElementById('cteDocumentos');
    var row = document.createElement('div');
    row.className = 'cte-row cte-row-outro';
    row.innerHTML =
        '<input type="text" placeholder="Tipo" maxlength="20">' +
        '<input type="text" placeholder="Descrição / número">' +
        '<button class="btn-del" onclick="this.parentElement.remove()">✕</button>';
    d.appendChild(row);
}

// ============================================================
// BUSCAR NF-es PARA REFERENCIAR
// ============================================================

async function cteBuscarNFesEmitente() {
    var cnpj = (document.getElementById('cteEmitCNPJ') ? document.getElementById('cteEmitCNPJ').value : '').replace(/\D/g,'');
    if (!cnpj) { mostrarToast('Selecione a transportadora primeiro (Aba 2).', 'warning'); return; }

    var div = document.getElementById('cteNFesDisponiveis');
    div.style.display = 'block';
    div.innerHTML = '<div style="text-align:center;padding:12px;color:var(--text2);"><div class="spinner" style="width:16px;height:16px;margin:0 auto 4px;"></div>Buscando NF-es...</div>';

    try {
        // Busca em paralelo na Nuvem Fiscal (emitente) e no Histórico Local (referenciada como transportadora)
        const [rNuvem, rLocal] = await Promise.all([
            fetch('api/consultar_nfes.php?cpf_cnpj=' + cnpj + '&top=20&skip=0').then(r => r.json()).catch(() => ({data:[]})),
            fetch('api/listar_nfes_por_transp.php?transp_cnpj=' + cnpj).then(r => r.json()).catch(() => ({data:[]}))
        ]);
        
        const listaNuvem = rNuvem.data || rNuvem.value || [];
        const listaLocal = rLocal.data || [];
        
        const chaves = new Set();
        const final = [];
        
        // 1. Prioridade Nuvem Fiscal (onde a empresa logada é a EMITENTE)
        listaNuvem.forEach(n => {
            const ch = (n.chave_acesso || '').replace(/\D/g,'');
            if (ch && ch.length === 44 && !chaves.has(ch)) {
                chaves.add(ch);
                final.push({
                    chave: ch,
                    numero: n.numero || n.nNF || '?',
                    dest: (n.destinatario && (n.destinatario.nome || n.destinatario.razao_social)) || '?',
                    origem: 'Nuvem Fiscal'
                });
            }
        });
        
        // 2. Histórico Local (onde a empresa foi selecionada como TRANSPORTADORA em outras emissões)
        listaLocal.forEach(n => {
            const ch = (n.chave || '').replace(/\D/g,'');
            if (ch && ch.length === 44 && !chaves.has(ch)) {
                chaves.add(ch);
                final.push({
                    chave: ch,
                    numero: n.numero || '?',
                    dest: n.dest_nome || '?',
                    origem: 'Histórico Local'
                });
            }
        });

        if (!final.length) {
            div.innerHTML = '<div style="padding:12px;color:var(--text3);text-align:center;">Nenhuma NF-e encontrada vinculada a esta transportadora.</div>';
            return;
        }

        div.innerHTML = '<div style="font-size:11px;color:var(--text2);margin-bottom:8px;font-weight:600;">NF-es vinculadas (como emitente ou transportadora):</div>' +
            '<div style="display:flex;flex-direction:column;gap:6px;">' +
            final.map(function(n) {
                return '<div onclick="cteAdicionarChaveNFe(\'' + n.chave + '\')"' +
                    ' class="nfe-selectable-item"' +
                    ' style="cursor:pointer;padding:8px;border:1px solid var(--border);border-radius:6px;font-size:11px;background:var(--bg-secondary);transition:all 0.2s;">' +
                    '<div style="display:flex;justify-content:space-between;margin-bottom:2px;">' +
                        '<strong>NF-e nº ' + n.numero + '</strong>' +
                        '<span style="font-size:9px;color:var(--text3);background:var(--bg);padding:1px 4px;border-radius:4px;">' + n.origem + '</span>' +
                    '</div>' +
                    '<div style="color:var(--text2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Dest: ' + n.dest + '</div>' +
                    '<div style="font-family:monospace;font-size:10px;color:var(--blue);margin-top:2px;">' + n.chave + '</div>' +
                    '</div>';
            }).join('') + '</div>';
            
    } catch(e) {
        console.error(e);
        div.innerHTML = '<div style="padding:12px;color:var(--red);text-align:center;">Erro ao buscar NF-es vinculadas.</div>';
    }
}

function cteAdicionarChaveNFe(chave) {
    var rows = document.querySelectorAll('#cteDocumentos .cte-row-nfe input');
    let targetInput = null;
    
    for (var i = 0; i < rows.length; i++) {
        if (!rows[i].value) { targetInput = rows[i]; break; }
        if (rows[i].value === chave) { mostrarToast('Chave já adicionada.', 'warning'); return; }
    }
    
    if (!targetInput) {
        cteAddNFe();
        const allRows = document.querySelectorAll('#cteDocumentos .cte-row-nfe input');
        targetInput = allRows[allRows.length - 1];
    }
    
    if (targetInput) {
        targetInput.value = chave;
        mostrarToast('Chave adicionada. Importando dados...', 'success');
        cteConsultarEImportarNFe(targetInput);
    }
}

// ============================================================
// ICMS CT-e
// ============================================================

function cteToggleICMSFields() {
    var cst = document.getElementById('cteCSTICMS').value;
    var campoAliq = document.getElementById('cteCampoAliq');
    var camposBc  = document.getElementById('cteCamposICMS');
    var semAliq = ['40','41','51','60'];
    if (campoAliq) campoAliq.style.display = semAliq.indexOf(cst) >= 0 ? 'none' : '';
    if (camposBc)  camposBc.style.display  = semAliq.indexOf(cst) >= 0 ? 'none' : '';
}

function cteRecalcICMS() {
    var vBC   = parseFloat((document.getElementById('cteVBC') ? document.getElementById('cteVBC').value : '') || '0') || parseFloat((document.getElementById('cteVTPrest') ? document.getElementById('cteVTPrest').value : '') || '0') || 0;
    var pICMS = parseFloat((document.getElementById('ctePICMS') ? document.getElementById('ctePICMS').value : '') || '0') || 0;
    var vICMS = +(vBC * pICMS / 100).toFixed(2);
    var bcEl  = document.getElementById('cteVBC');
    if (bcEl && !bcEl.value) bcEl.value = vBC.toFixed(2);
    var icmsEl = document.getElementById('cteVICMS');
    if (icmsEl) icmsEl.value = vICMS.toFixed(2);

    var vFrete = parseFloat((document.getElementById('cteVTPrest') ? document.getElementById('cteVTPrest').value : '') || '0') || 0;
    var resumo = document.getElementById('cteResumoValor');
    if (resumo) resumo.textContent = vFrete ? 'Frete: R$ ' + vFrete.toLocaleString('pt-BR',{minimumFractionDigits:2}) : '';
}

function cteRecalcICMSManual() {
    var vBC   = parseFloat((document.getElementById('cteVBC') ? document.getElementById('cteVBC').value : '') || '0') || 0;
    var pICMS = parseFloat((document.getElementById('ctePICMS') ? document.getElementById('ctePICMS').value : '') || '0') || 0;
    var el = document.getElementById('cteVICMS');
    if (el) el.value = (vBC * pICMS / 100).toFixed(2);
}

// ============================================================
// TIPO / MODAL CT-e
// ============================================================

function cteAtualizarModelo() {
    var modelo = document.getElementById('cteModelo').value;
    var tomaSelect = document.getElementById('cteToma');
    var toma4Section = document.getElementById('cteTomadorOutrosSection');
    var tpServSelect = document.getElementById('cteTpServ');
    var tpServLabel = document.getElementById('cteTpServLabel');

    // Limpar opções existentes do tpServ
    tpServSelect.innerHTML = '';

    if (modelo === '57') {
        // CT-e Normal
        tpServLabel.textContent = 'Tipo do Serviço';
        tpServLabel.nextElementSibling.setAttribute('data-tip', 'CT-e Normal: tipos de contratação.');
        tpServSelect.innerHTML = `
            <option value="0">0 – Normal</option>
            <option value="1">1 – Subcontratação</option>
            <option value="2">2 – Redespacho</option>
            <option value="3">3 – Redespacho Intermediário</option>
            <option value="4">4 – Serviço Vinculado a Multimodal</option>
        `;
    } else if (modelo === '67') {
        // CT-e OS
        tpServLabel.textContent = 'Tipo do Serviço';
        tpServLabel.nextElementSibling.setAttribute('data-tip', 'CT-e OS: tipos de transporte de pessoas/valores/bagagem.');
        tpServSelect.innerHTML = `
            <option value="6">6 – Transporte de Pessoas</option>
            <option value="7">7 – Transporte de Valores</option>
            <option value="8">8 – Excesso de Bagagem</option>
        `;
    }

    // Para CT-e OS (67), só permitir tomadores 0-3
    if (modelo === '67') {
        // Remover opção 4 se existir
        var option4 = tomaSelect.querySelector('option[value="4"]');
        if (option4) option4.style.display = 'none';

        // Se estiver selecionado toma=4, voltar para 3
        if (tomaSelect.value === '4') {
            tomaSelect.value = '3';
            if (toma4Section) toma4Section.style.display = 'none';
        }
    } else {
        // Para CT-e Normal (57), mostrar opção 4
        var option4 = tomaSelect.querySelector('option[value="4"]');
        if (option4) option4.style.display = '';
    }
}

function cteAtualizarTipo() {
    var tp  = document.getElementById('cteTpCTe').value;
    var div = document.getElementById('cteRefCTeDiv');
    if (div) div.style.display = (tp === '1' || tp === '3') ? '' : 'none';
}

function cteAtualizarModal() {
    var modal  = (document.getElementById('cteModal') ? document.getElementById('cteModal').value : '01') || '01';
    var secoes = { rodo:'cteSecaoRodo', aereo:'cteSecaoAereo', aqua:'cteSecaoAqua', ferro:'cteSecaoFerro' };
    var mapa   = { '01':'rodo', '02':'aereo', '03':'aqua', '04':'ferro' };
    Object.keys(secoes).forEach(function(k) {
        var el = document.getElementById(secoes[k]);
        if (el) el.style.display = 'none';
    });
    var key = mapa[modal];
    if (key && secoes[key]) {
        var el = document.getElementById(secoes[key]);
        if (el) el.style.display = '';
    }
}

// ============================================================
// MÁSCARAS
// ============================================================

function cteMascaraDoc(input) {
    var v = input.value.replace(/\D/g,'');
    if (v.length <= 11) {
        v = v.replace(/(\d{3})(\d{3})(\d{3})(\d{2}).*/,'$1.$2.$3-$4');
    } else {
        v = v.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2}).*/,'$1.$2.$3/$4-$5');
    }
    input.value = v;
}

// ============================================================
// MONTAR PAYLOAD CT-e
// ============================================================

function cteGetV(id) { var el = document.getElementById(id); return el ? (el.value || '').trim() : ''; }
function cteGetN(id) { return parseFloat(cteGetV(id)) || 0; }
function cteGetI(id) { return parseInt(cteGetV(id))   || 0; }

function cteMontarPayload() {
    // --- VALIDAÇÕES DE CAMPOS OBRIGATÓRIOS ---
    const camposObrigatorios = [
        { id: 'cteEmitCNPJ', label: 'CNPJ do Emitente' },
        { id: 'cteEmitNome', label: 'Razão Social do Emitente' },
        { id: 'cteEmitxLgr', label: 'Logradouro do Emitente' },
        { id: 'cteEmitxMun', label: 'Município do Emitente' },
        { id: 'cteEmitUF',   label: 'UF do Emitente' },
        { id: 'cteRemCNPJ',  label: 'CNPJ/CPF do Remetente' },
        { id: 'cteRemNome',  label: 'Nome do Remetente' },
        { id: 'cteRemxMun',  label: 'Município do Remetente' },
        { id: 'cteDestCNPJ', label: 'CNPJ/CPF do Destinatário' },
        { id: 'cteDestNome', label: 'Nome do Destinatário' },
        { id: 'cteDestxMun', label: 'Município do Destinatário' },
        { id: 'cteVTPrest',  label: 'Valor da Prestação (Frete)' },
        { id: 'cteVCarga',   label: 'Valor da Carga' },
        { id: 'cteProProd',  label: 'Produto Predominante' },
    ];

    for (let campo of camposObrigatorios) {
        if (!cteGetV(campo.id)) {
            throw new Error(`O campo "${campo.label}" é obrigatório.`);
        }
    }

    var modal   = cteGetV('cteModal')   || '01';
    if (modal === '01' && !cteGetV('cteRNTRC')) {
        throw new Error('O RNTRC é obrigatório para o modal Rodoviário.');
    }

    var modelo  = parseInt(cteGetV('cteModelo')) || 57;
    var tpCTe   = parseInt(cteGetV('cteTpCTe'))  || 0;
    var CFOP    = cteGetV('cteCFOP')    || '5353';
    var natOp   = cteGetV('cteNatOp')   || 'PRESTACAO DE SERVICO DE TRANSPORTE';
    var serie   = cteGetI('cteSerie')   || 1;
    var nCT     = cteGetI('cteNCT')     || 1;
    var cst     = cteGetV('cteCSTICMS') || '00';
    var pICMS   = cteGetN('ctePICMS');
    var vBC     = cteGetN('cteVBC')  || cteGetN('cteVTPrest');
    var vICMSraw= parseFloat(cteGetV('cteVICMS')) || +(vBC * pICMS / 100);
    var vICMS   = +vICMSraw.toFixed(2);
    var vTPrest = cteGetN('cteVTPrest');
    var vRec    = cteGetN('cteVRec') || vTPrest;
    var pRedBC  = cteGetN('ctePRedBC');
    var vTotTrib= cteGetN('cteVTotTrib');
    var emitUF  = cteGetV('cteEmitUF').toUpperCase();
    var emitcMun= String(cteGetV('cteEmitcMun') || '9999999').replace(/\D/g,'').padStart(7, '0');
    var cUF     = UF_IBGE[emitUF] || 35;
    var dhEmi   = new Date().toISOString().slice(0,19) + '-03:00';

    var emitCNPJ= cteGetV('cteEmitCNPJ').replace(/\D/g,'');
    var emitNome= cteGetV('cteEmitNome');
    var emitIE  = cteGetV('cteEmitIE');
    var emitCRT = parseInt(cteGetV('cteEmitCRT')) || 1;

    if (!emitCNPJ)           throw new Error('Selecione a transportadora (Aba 2).');
    if (!cteGetV('cteRemCNPJ') || !cteGetV('cteRemNome')) throw new Error('Preencha os dados do Remetente (Aba 3).');
    if (!cteGetV('cteDestCNPJ')|| !cteGetV('cteDestNome'))throw new Error('Preencha os dados do Destinatário (Aba 3).');

    function buildPessoa(prefixo, endPref) {
        var raw   = cteGetV(prefixo + 'CNPJ').replace(/\D/g,'');
        if (!raw) raw = cteGetV(prefixo + 'CPF').replace(/\D/g,'');
        var nome  = cteGetV(prefixo + 'Nome');
        var xFant = cteGetV(prefixo + 'xFant');
        var ie    = cteGetV(prefixo + 'IE');
        var email = cteGetV(prefixo + 'Email');
        var fone  = cteGetV(prefixo + 'Fone');
        var uf    = cteGetV(prefixo + 'UF').toUpperCase();
        var cMun  = String(cteGetV(prefixo + 'cMun') || '9999999').replace(/\D/g,'');
        var obj   = { xNome: nome };
        if (xFant) obj.xFant = xFant;
        if (ie)    obj.IE    = ie;
        if (email) obj.email = email;
        if (fone)  obj.fone   = fone;
        if (raw) obj[raw.length === 11 ? 'CPF' : 'CNPJ'] = raw;
        var ender = {
            xLgr:    cteGetV(prefixo + 'xLgr')    || 'N/I',
            nro:     cteGetV(prefixo + 'nro')      || 'SN',
            xBairro: cteGetV(prefixo + 'xBairro')  || 'N/I',
            cMun:    cMun.padStart(7, '0'),
            xMun:    cteGetV(prefixo + 'xMun')     || 'N/I',
            CEP:     String(cteGetV(prefixo + 'CEP')).replace(/\D/g,'').padStart(8, '0') || '00000000',
            UF:      uf || 'SP',
        };
        obj[endPref] = ender;
        return obj;
    }

    var rem  = buildPessoa('cteRem',  'enderReme');
    var dest = buildPessoa('cteDest', 'enderDest');
    var tomadorOutros = null;
    if (parseInt(cteGetV('cteToma')) === 4) {
        tomadorOutros = buildPessoa('cteToma4', 'enderToma');
        if (!tomadorOutros.xNome) {
            throw new Error('Preencha o nome do Tomador Outros.');
        }
        if (!tomadorOutros.CNPJ && !tomadorOutros.CPF) {
            throw new Error('Informe o CNPJ ou CPF do Tomador Outros.');
        }
    }

    // Componentes frete
    var compRows = document.querySelectorAll('#cteComponentes .cte-row');
    var comp = [];
    compRows.forEach(function(row) {
        var inputs = row.querySelectorAll('input');
        var v = parseFloat((inputs[1] ? inputs[1].value : '0')) || 0;
        if (v > 0) comp.push({ xNome: (inputs[0] ? inputs[0].value.trim() : '') || 'FRETE VALOR', vComp: v });
    });
    if (!comp.length) comp.push({ xNome: 'FRETE VALOR', vComp: vTPrest });

    // ICMS
    var icmsObj = {};
    var semAliq = ['40','41','45'];
    if (semAliq.indexOf(cst) >= 0) {
        // No CT-e, os CSTs 40, 41 e 45 são todos agrupados na propriedade "ICMS45"
        icmsObj['ICMS45'] = { CST: cst };
    } else if (cst === '20') {
        icmsObj['ICMS20'] = { CST:'20', pRedBC: pRedBC, vBC: +(vBC*(1-pRedBC/100)).toFixed(2), pICMS: pICMS, vICMS: vICMS };
    } else if (cst === '51') {
        icmsObj['ICMS51'] = { CST:'51', pRedBC: pRedBC, vBC: vBC, pICMS: pICMS, vICMS: 0, pDif: 100, vICMSDif: vICMS };
    } else if (cst === '60') {
        icmsObj['ICMS60'] = { CST:'60', vBCSTRet: vBC, pICMSSTRet: pICMS, vICMSSTRet: vICMS };
    } else if (cst === '90') {
        icmsObj['ICMS90'] = { CST:'90', vBC: vBC, pICMS: pICMS, vICMS: vICMS };
    } else {
        icmsObj['ICMS00'] = { CST:'00', vBC: vBC, pICMS: pICMS, vICMS: vICMS };
    }

    // Quantidades
    var qtdRows = document.querySelectorAll('#cteQuantidades .cte-row-qtd');
    var infQ = [];
    qtdRows.forEach(function(row) {
        var sel = row.querySelector('select');
        var ins = row.querySelectorAll('input');
        var q = parseFloat((ins[1] ? ins[1].value : '0')) || 0;
        if (q > 0) infQ.push({ cUnid: (sel ? sel.value : '00') || '00', tpMed: (ins[0] ? ins[0].value.trim() : '') || 'VOLUMES', qCarga: q });
    });
    if (!infQ.length) infQ.push({ cUnid:'00', tpMed:'VOLUMES', qCarga:1 });

    // Documentos
    var infNFe = [], infNF = [], infOutros = [];
    document.querySelectorAll('#cteDocumentos .cte-row-nfe').forEach(function(row) {
        var chave = (row.querySelector('input') ? row.querySelector('input').value.replace(/\D/g,'') : '') || '';
        if (chave.length === 44) infNFe.push({ chave: chave });
    });
    document.querySelectorAll('#cteDocumentos .cte-row-nf').forEach(function(row) {
        var ins = row.querySelectorAll('input');
        if (ins[1] && ins[1].value) infNF.push({ serie: (ins[0] ? ins[0].value : '') || '1', nNF: ins[1].value });
    });
    document.querySelectorAll('#cteDocumentos .cte-row-outro').forEach(function(row) {
        var ins = row.querySelectorAll('input');
        if (ins[1] && ins[1].value) infOutros.push({ tpDoc: (ins[0] ? ins[0].value : '') || 'Outro', descOutros: ins[1].value });
    });

    var infDoc = {};
    if (infNFe.length)    infDoc.infNFe    = infNFe;
    if (infNF.length)     infDoc.infNF      = infNF;
    if (infOutros.length) infDoc.infOutros  = infOutros;
    if (!Object.keys(infDoc).length) infDoc.infNFe = [];

    // Modal
    var infModal = { versaoModal: '4.00' };
    if (modal === '01') {
        var condutor = [];
        var mNome = cteGetV('cteMotoristaNome');
        var mCPF  = cteGetV('cteMotoristaCPF').replace(/\D/g,'');
        if (mNome && mCPF) condutor.push({ xNome: mNome, CPF: mCPF });

        var veic = {
            placa:  cteGetV('ctePlaca'),
            RENAVAM: null,
            tara:   cteGetI('cteTara'),
            capKG:  cteGetI('cteCapKG'),
            tpVeic: 6,
            tpRod:  cteGetI('cteTpRod') || 1,
            tpCar:  cteGetV('cteTpCar') || '00',
            UF:     cteGetV('cteVeicUF').toUpperCase() || 'SP',
        };
        if (condutor.length) veic.condutor = condutor;

        var rntrcRaw = cteGetV('cteRNTRC').toUpperCase().trim();
        var rntrcFinal = 'ISENTO';
        
        if (rntrcRaw !== 'ISENTO') {
            // Remove tudo que não é número
            rntrcFinal = rntrcRaw.replace(/\D/g, '');
            // Se ficou vazio, vira ISENTO, senão garante 8 dígitos com zeros à esquerda
            if (!rntrcFinal) rntrcFinal = 'ISENTO';
            else rntrcFinal = rntrcFinal.padStart(8, '0').substring(0, 8);
        }

        infModal.rodo = {
            RNTRC: rntrcFinal
        };
    } else if (modal === '02') {
        infModal.aereo = {
            nVoo: cteGetV('cteNVoo'), dVoo: cteGetV('cteDVoo'),
            CIataOrig: cteGetV('cteCIataOrig'), CIataDest: cteGetV('cteCIataDest'),
        };
    } else if (modal === '03') {
        infModal.aquav = { IRIN: cteGetV('cteIRIN'), xNavio: cteGetV('cteXNavio') };
    } else if (modal === '04') {
        infModal.ferrov = { tpTraf: cteGetV('cteTpTraf'), trem: { xPref: cteGetV('cteTrem') } };
    }

    // Ref CT-e complementar/substituição
    var infCTeRef = [];
    if (tpCTe === 1 || tpCTe === 3) {
        var chRef = cteGetV('cteChaveRef').replace(/\D/g,'');
        if (chRef.length === 44) infCTeRef.push({ refCte: chRef });
    }

    // Dados dinâmicos baseados no que está na tela (que veio do cadastro ou manual)
    var cMunEnv = cteGetV('cteEmitcMun') || emitcMun;
    var xMunEnv = cteGetV('cteEmitxMun') || 'N/I';
    var UFEnv   = cteGetV('cteEmitUF')   || emitUF;

    var cMunIni = cteGetV('cteEmitcMun') || emitcMun;
    var xMunIni = cteGetV('cteEmitxMun') || 'N/I';
    var UFIni   = cteGetV('cteEmitUF')   || emitUF;

    var cMunFim = String(cteGetV('cteDestcMun') || '9999999').replace(/\D/g,'').padStart(7, '0');
    var xMunFim = cteGetV('cteDestxMun') || 'N/I';
    var UFFim   = (cteGetV('cteDestUF') || 'SP').toUpperCase();

    var ide = {
        cUF: cUF, cCT: String(nCT).padStart(8,'0'), CFOP: CFOP, natOp: natOp,
        mod: modelo, serie: serie, nCT: nCT, dhEmi: dhEmi,
        tpImp: 1, tpEmis: 1, tpAmb: 2, tpCTe: tpCTe,
        indIEToma: parseInt(cteGetV('cteIndIEToma')) || 1,
        modal: modal,
        tpServ: parseInt(cteGetV('cteTpServ')) || (modelo === 57 ? 0 : 6),
        cMunEnv: cMunEnv.replace(/\D/g,'').padStart(7, '0'),
        xMunEnv: xMunEnv,
        UFEnv:   UFEnv.toUpperCase(),
        cMunIni: cMunIni.replace(/\D/g,'').padStart(7, '0'),
        xMunIni: xMunIni,
        UFIni:   UFIni.toUpperCase(),
        cMunFim: cMunFim,
        xMunFim: xMunFim,
        UFFim:   UFFim,
        retira:  1, // 1 - Não
        procEmi: 0,
        verProc: '1.0'
    };

    // Tomador: toma3 (indicador 0-3) ou toma4 (indicador 4 + dados)
    var tomadorTipo = parseInt(cteGetV('cteToma')) || 3;
    if (tomadorTipo === 4) {
        if (tomadorOutros && modelo === 57) {
            ide.toma4 = tomadorOutros;
            ide.toma4.toma = 4;
        } else {
            // Fallback para toma3 se não houver dados de outros
            ide.toma3 = { toma: 3 };
        }
    } else {
        ide.toma3 = { toma: tomadorTipo };
    }

    if (infCTeRef.length) ide.infCTeRef = infCTeRef;

    var emit = {
        CNPJ: emitCNPJ, xNome: emitNome, CRT: emitCRT,
        enderEmit: {
            xLgr:    cteGetV('cteEmitxLgr')    || 'N/I',
            nro:     cteGetV('cteEmitnro')      || 'SN',
            xBairro: cteGetV('cteEmitxBairro')  || 'N/I',
            cMun:    emitcMun,
            xMun:    cteGetV('cteEmitxMun')     || 'N/I',
            CEP:     String(cteGetV('cteEmitCEP')).replace(/\D/g,'').padStart(8, '0') || '00000000',
            UF:      emitUF || 'SP',
        },
    };
    if (emitIE) emit.IE = emitIE;

    var imp = { ICMS: icmsObj };
    if (vTotTrib) imp.vTotTrib = vTotTrib;

    var cobr = getCobrancaCTE();
    if (cobr) imp.cobr = cobr;

    var payload;
    if (modelo === 57) {
        payload = {
            ambiente: 'homologacao',
            referencia: 'CTE-' + serie + '-' + nCT + '-' + Date.now(),
            infCte: {
                versao: '4.00',
                ide: ide,
                emit: emit,
                rem: rem,
                dest: dest,
                vPrest: { vTPrest: vTPrest, vRec: vRec, Comp: comp },
                imp: imp,
                infCTeNorm: {
                    infCarga: {
                        vCarga:  cteGetN('cteVCarga'),
                        proPred: cteGetV('cteProProd') || 'MERCADORIAS EM GERAL',
                        infQ: infQ,
                    },
                    infDoc: infDoc,
                    infModal: infModal,
                }
            }
        };
    } else {
        payload = {
            ambiente: 'homologacao',
            referencia: 'CTE-' + serie + '-' + nCT + '-' + Date.now(),
            infCte: {
                versao: '4.00',
                ide: ide,
                emit: emit,
                vPrest: { vTPrest: vTPrest, vRec: vRec, Comp: comp },
                imp: imp,
                inf_cte_norm: {
                    infCarga: {
                        vCarga:  cteGetN('cteVCarga'),
                        proPred: cteGetV('cteProProd') || 'MERCADORIAS EM GERAL',
                        infQ: infQ,
                    },
                    infDoc: infDoc,
                    infModal: infModal,
                }
            }
        };
    }

    return payload;
}

// ============================================================
// CONFERIR PAYLOAD
// ============================================================

function cteConferirPayload() {
    try {
        var p  = cteMontarPayload();
        var ta = document.getElementById('xml-output');
        if (ta) { ta.value = JSON.stringify(p, null, 2); ta.style.display = 'block'; }
        mostrarToast('JSON gerado — veja o painel de conferência.', 'success');
    } catch(e) { cteAlerta('error', e.message); }
}

// ============================================================
// TRANSMITIR CT-e
// ============================================================

async function transmitirCte() {
    var payload;
    try { payload = cteMontarPayload(); }
    catch(e) { cteAlerta('error', e.message); return; }

    var btn = document.getElementById('btnTransmitirCte');
    btn.disabled = true; btn.textContent = '⏳ Transmitindo...';

    try {
        var r = await fetch('api/emitir_cte.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': await getCsrfToken() },
            body: JSON.stringify(payload)
        });
        var d = await r.json();

        if (r.ok && (d.status === 'autorizado' || d.id)) {
            var serie = payload.infCte.ide.serie;
            var nCT   = payload.infCte.ide.nCT;
            cteAlerta('success', 'CT-e ' + serie + '/' + nCT + ' transmitido! Status: ' + (d.status || 'enviado'));
            mostrarToast('CT-e ' + serie + '/' + nCT + ' transmitido com sucesso!', 'success');
            var nctEl = document.getElementById('cteNCT');
            if (nctEl) nctEl.value = (parseInt(nctEl.value)||1) + 1;
            setTimeout(function() { fecharEmissaoCte(); buscarCtes(0); }, 2500);
        } else {
            var msg = (d.mensagens && d.mensagens[0] && d.mensagens[0].descricao)
                || d.error || d.message || JSON.stringify(d).slice(0,250);
            cteAlerta('error', 'Erro: ' + msg);
            mostrarToast('Erro ao transmitir CT-e: ' + msg, 'error');
        }
    } catch(e) {
        cteAlerta('error', 'Erro de comunicação: ' + e.message);
    } finally {
        btn.disabled = false; btn.textContent = '🚀 Transmitir CT-e';
    }
}

// ============================================================
// CONTADORES DE CARACTERES
// ============================================================

// TESTAR CT-e (sem enviar para SEFAZ)
// ============================================================

async function testarCte() {
    var payload;
    try { payload = cteMontarPayload(); }
    catch(e) { cteAlerta('error', e.message); return; }

    var btn = document.getElementById('btnTestarCte');
    btn.disabled = true; btn.textContent = '⏳ Simulando...';

    try {
        // Chamar a API de simulação LOCAL
        var r = await fetch('api/testar_cte.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': await getCsrfToken() },
            body: JSON.stringify(payload)
        });
        
        var d = await r.json();

        if (r.ok) {
            var jsonStr = JSON.stringify(payload, null, 2);
            var xmlBase64 = d.xml;
            
            // Criar modal de simulação local
            var modalHtml = `
                <div id="modalTesteCte" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7); z-index:20000; justify-content:center; align-items:center;">
                    <div style="background:var(--bg); border-radius:12px; width:90%; max-width:1000px; max-height:95vh; display:flex; flex-direction:column; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
                        <div style="padding:20px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center; background: var(--bg2); border-radius:12px 12px 0 0;">
                            <div>
                                <h3 style="margin:0; color:var(--text);">🧪 CT-e Simulado (Local)</h3>
                                <p style="margin:4px 0 0 0; color:var(--text-light); font-size:13px;">Teste interno de estrutura e valores — SEM ENVIO PARA SEFAZ</p>
                            </div>
                            <button class="btn btn-ghost" onclick="document.getElementById('modalTesteCte').remove()">✕ Fechar</button>
                        </div>
                        
                        <div style="padding:16px 20px; background:var(--bg); border-bottom:1px solid var(--border);">
                            <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:center;">
                                <div style="background:var(--bg2); padding:8px 16px; border-radius:8px; font-size:13px; border:1px solid var(--border);">
                                    <strong style="color:var(--primary);">Retorno:</strong> <span style="color:var(--green); font-weight:600;">100 - AUTORIZADO (SIMULAÇÃO)</span>
                                </div>
                                <div style="background:var(--bg2); padding:8px 16px; border-radius:8px; font-size:13px; border:1px solid var(--border);">
                                    <strong>Chave:</strong> <span style="font-family:monospace;">${d.chave}</span>
                                </div>
                                <div style="flex:1; display:flex; justify-content:flex-end; gap:8px;">
                                    <button class="btn btn-success" onclick="baixarXmlString('${xmlBase64}', 'CTE_SIMULADO_${payload.infCte.ide.nCT}.xml')">📥 Baixar XML Fake</button>
                                </div>
                            </div>
                        </div>

                        <div style="flex:1; overflow:auto; padding:20px; background:#1e1e1e;">
                            <div style="color:#888; font-size:11px; margin-bottom:10px; text-transform:uppercase; letter-spacing:1px;">Payload JSON (O que seria enviado):</div>
                            <pre style="margin:0; padding:0; color:#d4d4d4; font-size:12px; line-height:1.5;">${jsonStr.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
                        </div>

                        <div style="padding:16px 20px; border-top:1px solid var(--border); display:flex; justify-content:flex-end; gap:12px; background: var(--bg2); border-radius: 0 0 12px 12px;">
                            <button class="btn btn-ghost" onclick="document.getElementById('modalTesteCte').remove()">Fechar</button>
                            <button class="btn btn-primary" onclick="navigator.clipboard.writeText(JSON.stringify(payload, null, 2)); this.textContent='✓ Copiado!'; setTimeout(()=>this.textContent='📋 Copiar JSON',2000);">📋 Copiar JSON</button>
                        </div>
                    </div>
                </div>
            `;
            
            var existingModal = document.getElementById('modalTesteCte');
            if (existingModal) existingModal.remove();
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            document.getElementById('modalTesteCte').style.display = 'flex';
            
            cteAlerta('success', 'Simulação local concluída com sucesso!');
        } else {
            var errorMsg = d.error || 'Erro na simulação local';
            cteAlerta('error', errorMsg);
        }
    } catch(e) {
        cteAlerta('error', 'Erro na simulação: ' + e.message);
    } finally {
        btn.disabled = false; btn.textContent = '🧪 Testar (sem enviar)';
    }
}

/**
 * Auxiliar para baixar string base64 como arquivo
 */
function baixarXmlString(base64, filename) {
    if (!base64) { mostrarToast('XML não disponível.', 'error'); return; }
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'text/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

document.addEventListener('DOMContentLoaded', function() {
    var ta = document.getElementById('cancelCteJustificativa');
    if (ta) ta.addEventListener('input', function() {
        document.getElementById('cancelCteContador').textContent = ta.value.length + '/255';
    });
    var ta2 = document.getElementById('cceDescEvento');
    if (ta2) ta2.addEventListener('input', function() {
        document.getElementById('cceContador').textContent = ta2.value.length + '/1000';
    });
    cteAtualizarModelo();
    cteToggleTomadorOutros();
});
