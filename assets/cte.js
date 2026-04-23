
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

function ctePopularFiltroEmpresas() {
    const sel = document.getElementById('filtroEmpresaCte');
    if (!sel) return;
    sel.innerHTML = '<option value="">Selecione a transportadora...</option>';
    _cteEmpresas.forEach(e => {
        const opt = document.createElement('option');
        const cnpj = e.cpf_cnpj || e.cnpj || '';
        opt.value = cnpj;
        opt.textContent = (e.nome_razao_social || e.razao_social || e.nome || '') + ' — ' + cnpjMask(cnpj);
        sel.appendChild(opt);
    });

    const cb   = document.getElementById('cbFiltroCte');
    const list = document.getElementById('cbFiltroCteList');
    if (!cb || !list) return;

    cb.addEventListener('input', () => {
        const q = cb.value.toLowerCase();
        list.innerHTML = '';
        if (!q) { list.style.display = 'none'; return; }
        const matches = _cteEmpresas.filter(e => {
            const nome = (e.nome_razao_social||e.razao_social||e.nome||'').toLowerCase();
            const cnpj = (e.cpf_cnpj||e.cnpj||'');
            return nome.includes(q) || cnpj.includes(q.replace(/\D/g,''));
        }).slice(0,8);
        if (!matches.length) { list.style.display = 'none'; return; }
        matches.forEach(e => {
            const cnpj = e.cpf_cnpj||e.cnpj||'';
            const li = document.createElement('div');
            li.className = 'combobox-item';
            li.textContent = (e.nome_razao_social||e.razao_social||e.nome||'') + ' — ' + cnpjMask(cnpj);
            li.onclick = () => {
                cb.value = li.textContent;
                document.getElementById('filtroEmpresaCte').value = cnpj;
                list.style.display = 'none';
                buscarCtes(0);
            };
            list.appendChild(li);
        });
        list.style.display = 'block';
    });
    document.addEventListener('click', ev => { if (!cb.contains(ev.target)) list.style.display = 'none'; });
}

function cteInicializarComboboxEmit() {
    const cb   = document.getElementById('cbCteEmit');
    const list = document.getElementById('cbCteEmitList');
    if (!cb || !list) return;

    cb.addEventListener('input', () => {
        const q = cb.value.toLowerCase();
        list.innerHTML = '';
        if (!q) { list.style.display = 'none'; return; }
        const matches = _cteEmpresas.filter(e => {
            const nome = (e.nome_razao_social||e.razao_social||e.nome||'').toLowerCase();
            const cnpj = (e.cpf_cnpj||e.cnpj||'');
            return nome.includes(q) || cnpj.includes(q.replace(/\D/g,''));
        }).slice(0,8);
        if (!matches.length) { list.style.display = 'none'; return; }
        matches.forEach(e => {
            const cnpj = e.cpf_cnpj||e.cnpj||'';
            const li = document.createElement('div');
            li.className = 'combobox-item';
            li.textContent = (e.nome_razao_social||e.razao_social||e.nome||'') + ' — ' + cnpjMask(cnpj);
            li.onclick = () => {
                cb.value = li.textContent;
                list.style.display = 'none';
                ctePreencherEmitente(e);
            };
            list.appendChild(li);
        });
        list.style.display = 'block';
    });
    document.addEventListener('click', ev => { if (!cb.contains(ev.target)) list.style.display = 'none'; });
}

function cteSelecionarEmitente(sel) {
    const cnpj = sel.value;
    const emp  = _cteEmpresas.find(e => (e.cpf_cnpj||e.cnpj||'') === cnpj);
    if (emp) ctePreencherEmitente(emp);
}

function ctePreencherEmitente(e) {
    const cnpj = e.cpf_cnpj||e.cnpj||'';
    document.getElementById('cteEmitNome').value    = e.nome_razao_social||e.razao_social||e.nome||'';
    document.getElementById('cteEmitCNPJ').value    = cnpjMask(cnpj);
    document.getElementById('cteEmitIE').value      = e.inscricao_estadual||'';
    document.getElementById('cteEmitUF').value      = (e.endereco && e.endereco.uf) || e.uf || '';
    document.getElementById('cteEmitcMun').value    = (e.endereco && e.endereco.codigo_ibge) || e.codigo_ibge || '';
    document.getElementById('cteEmitxMun').value    = (e.endereco && e.endereco.municipio) || e.cidade || '';
    document.getElementById('cteEmitxLgr').value    = (e.endereco && e.endereco.logradouro) || '';
    document.getElementById('cteEmitnro').value     = (e.endereco && e.endereco.numero) || '';
    document.getElementById('cteEmitxBairro').value = (e.endereco && e.endereco.bairro) || '';
    document.getElementById('cteEmitCEP').value     = ((e.endereco && e.endereco.cep)||'').replace(/\D/g,'');
    _cteCnpjAtual = cnpj.replace(/\D/g,'');
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
        '<input type="text" placeholder="Chave NF-e (44 dígitos)" maxlength="44" inputmode="numeric"' +
        ' style="font-family:monospace;font-size:11px;"' +
        ' oninput="this.value=this.value.replace(/\\D/g,\'\').slice(0,44)">' +
        '<button class="btn-del" onclick="this.parentElement.remove()">✕</button>';
    d.appendChild(row);
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
    div.innerHTML = '<div style="text-align:center;padding:12px;color:var(--text2);">Buscando NF-es...</div>';

    try {
        var r = await fetch('api/consultar_nfes.php?cpf_cnpj=' + cnpj + '&top=30&skip=0');
        var d = await r.json();
        var lista = d.data || d.value || [];
        var auth  = lista.filter(function(n) { return (n.status||'').toLowerCase() === 'autorizado'; });
        if (!auth.length) {
            div.innerHTML = '<div style="padding:12px;color:var(--text3);">Nenhuma NF-e autorizada encontrada.</div>';
            return;
        }
        div.innerHTML = '<div style="font-size:11px;color:var(--text2);margin-bottom:6px;">Clique para adicionar a chave:</div>' +
            auth.map(function(n) {
                var chave = n.chave_acesso || '';
                var num   = n.numero || n.nNF || '?';
                var dest  = (n.destinatario && (n.destinatario.nome || n.destinatario.razao_social)) || '?';
                return '<div onclick="cteAdicionarChaveNFe(\'' + chave + '\')"' +
                    ' style="cursor:pointer;padding:6px 8px;border:1px solid var(--border);border-radius:4px;margin-bottom:4px;font-size:11px;"' +
                    ' onmouseover="this.style.background=\'var(--bg2)\'" onmouseout="this.style.background=\'\'">' +
                    '<strong>NF-e nº ' + num + '</strong> — ' + dest + '<br>' +
                    '<span style="font-family:monospace;font-size:10px;color:var(--text3);">' + chave + '</span>' +
                    '</div>';
            }).join('');
    } catch(e) {
        div.innerHTML = '<div style="padding:12px;color:var(--red);">Erro ao buscar NF-es.</div>';
    }
}

function cteAdicionarChaveNFe(chave) {
    var rows = document.querySelectorAll('#cteDocumentos .cte-row-nfe input');
    for (var i = 0; i < rows.length; i++) {
        if (!rows[i].value) { rows[i].value = chave; mostrarToast('Chave adicionada.', 'success'); return; }
        if (rows[i].value === chave) { mostrarToast('Chave já adicionada.', 'warning'); return; }
    }
    cteAddNFe();
    var last = document.querySelector('#cteDocumentos .cte-row-nfe:last-child input');
    if (last) last.value = chave;
    mostrarToast('Chave adicionada.', 'success');
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
    var modal   = cteGetV('cteModal')   || '01';
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
    var emitcMun= cteGetI('cteEmitcMun');
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
        var cMun  = cteGetI(prefixo + 'cMun');
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
            cMun:    cMun || 9999999,
            xMun:    cteGetV(prefixo + 'xMun')     || 'N/I',
            CEP:     cteGetV(prefixo + 'CEP').replace(/\D/g,'') || '00000000',
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
    var semAliq = ['40','41'];
    if (semAliq.indexOf(cst) >= 0) {
        icmsObj['ICMS' + cst] = { CST: cst };
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
    var qtdRows = document.querySelectorAll('#cteQuantidades .cte-row');
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
    var infModal = {};
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

        infModal.rodo = {
            RNTRC: cteGetV('cteRNTRC') || '00000000',
            lota:  document.getElementById('cteLota') ? document.getElementById('cteLota').value === 'true' : false,
            veic:  veic
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

    var ide = {
        cUF: cUF, cCT: String(nCT).padStart(8,'0'), CFOP: CFOP, natOp: natOp,
        mod: modelo, serie: serie, nCT: nCT, dhEmi: dhEmi,
        tpImp: 1, tpEmis: 1, tpAmb: 2, tpCTe: tpCTe,
        indIEToma: parseInt(cteGetV('cteIndIEToma')) || 1,
        toma: parseInt(cteGetV('cteToma')) || 3,
        modal: modal,
        tpServ: parseInt(cteGetV('cteTpServ')) || (modelo === 57 ? 0 : 6),
    };
    if (infCTeRef.length) ide.infCTeRef = infCTeRef;
    // Só usar toma4 para CT-e Normal (modelo 57)
    if (tomadorOutros && modelo === 57) ide.toma4 = tomadorOutros;

    var emit = {
        CNPJ: emitCNPJ, xNome: emitNome, CRT: emitCRT,
        enderEmit: {
            xLgr:    cteGetV('cteEmitxLgr')    || 'N/I',
            nro:     cteGetV('cteEmitnro')      || 'SN',
            xBairro: cteGetV('cteEmitxBairro')  || 'N/I',
            cMun:    emitcMun || 9999999,
            xMun:    cteGetV('cteEmitxMun')     || 'N/I',
            CEP:     cteGetV('cteEmitCEP').replace(/\D/g,'') || '00000000',
            UF:      emitUF || 'SP',
        },
    };
    if (emitIE) emit.IE = emitIE;

    var imp = { ICMS: icmsObj };
    if (vTotTrib) imp.vTotTrib = vTotTrib;

    // Cobrança / Duplicatas (se informadas)
    var cobr = getCobrancaCTE();
    if (cobr) imp.cobr = cobr;

    var payload = {
        ambiente: 'homologacao',
        referencia: 'CTE-' + serie + '-' + nCT + '-' + Date.now(),
        infCte: {
            ide: ide,
            emit: emit,
            rem: rem,
            dest: dest,
            vPrest: { vTPrest: vTPrest, vRec: vRec, comp: comp },
            imp: imp,
            infCTeNorm: {
                infCarga: {
                    vCarga:  cteGetN('cteVCarga'),
                    proProd: cteGetV('cteProProd') || 'MERCADORIAS EM GERAL',
                    infQ: infQ,
                },
                infDoc: infDoc,
                infModal: infModal,
            }
        }
    };

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
