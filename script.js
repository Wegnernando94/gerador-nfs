// ==========================================
// CONFIGURAÇÕES DA API (NUVEM FISCAL)
// ==========================================
const API_BASE = "https://api.sandbox.nuvemfiscal.com.br";

// ==========================================
// INICIALIZAÇÃO E EVENTOS
// ==========================================
window.onload = () => {
    document.getElementById('dhEmi').value = new Date().toISOString().slice(0,16);
    addProduto();

    // Listener para mostrar/esconder o campo de Chave Referenciada
    const selectPerfil = document.getElementById('perfilNota');
    if(selectPerfil) {
        selectPerfil.addEventListener('change', (e) => {
            const divRef = document.getElementById('divRefNFe');
            if(divRef) {
                divRef.style.display = e.target.value === 'DEVOLUCAO' ? 'block' : 'none';
            }
        });
    }
};

// ==========================================
// FUNÇÕES UTILITÁRIAS
// ==========================================
function clean(v) { return v ? v.replace(/\D/g, '') : ""; }
function getV(id) { return (document.getElementById(id) || {value: ""}).value; }

function numAleatorio(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min);
}

// ==========================================
// LÓGICA DE PRODUTOS E CÁLCULOS
// ==========================================
function addProduto() {
    const container = document.getElementById('listaProdutos');
    const id = Date.now();
    const nItens = document.querySelectorAll('.produto-item').length + 1;
    const div = document.createElement('div');
    div.className = 'produto-item';
    div.id = `prod-${id}`;
    div.innerHTML = `
        <div style="display:grid; grid-template-columns: 0.5fr 2fr 1fr 1fr 0.5fr; gap:10px;">
            <input type="text" class="cProd" value="${nItens}">
            <input type="text" class="xProd" value="PRODUTO TRIBUTADO QA">
            <input type="number" class="qtd" value="1" oninput="recalc()">
            <input type="number" class="vUn" value="100.00" oninput="recalc()">
            <button class="btn btn-danger" onclick="document.getElementById('prod-${id}').remove(); recalc()">X</button>
        </div>
    `;
    container.appendChild(div);
    recalc();
}

function recalc() {
    let prodT = 0, icmsT = 0, pisT = 0, cofT = 0, stT = 0;
    const perfil = getV('perfilNota');

    document.querySelectorAll(".produto-item").forEach(item => {
        const q = parseFloat(item.querySelector(".qtd").value) || 0;
        const v = parseFloat(item.querySelector(".vUn").value) || 0;
        const base = q * v;
        prodT += base;

        if (perfil === "NORMAL" || perfil === "ST") {
            icmsT += (base * 0.18);
            pisT += (base * 0.0165);
            cofT += (base * 0.076);
        }
        if (perfil === "ST") stT += (base * 0.10);
    });

    const vNF = prodT + stT;
    document.getElementById('resTotalNota').innerText = vNF.toFixed(2);
    return { prodT, icmsT, pisT, cofT, stT, vNF };
}

// ==========================================
// GERAÇÃO DO XML
// ==========================================
function gerarXML() {
    const r = recalc();
    const perfil = getV('perfilNota');
    const nNF = numAleatorio(1000, 999999);
    const cNF = numAleatorio(10000000, 99999999);
    const chave = "422401" + clean(getV('cnpjEmit')).padStart(14,'0') + "55001" + nNF.toString().padStart(9,'0') + "1" + cNF.toString().slice(0,8);
    const dh = getV('dhEmi') + ":00-03:00";
    
    // --- LÓGICA DINÂMICA DE OPERAÇÃO E DEVOLUÇÃO ---
    let natOp = "VENDA";
    let finNFe = "1";
    let cfopBase = "5102"; 
    let nfrefXml = "";

    if (perfil === "DEVOLUCAO") {
        natOp = "DEVOLUCAO DE MERCADORIA";
        finNFe = "4";      
        cfopBase = "5202"; 
        
        const chaveRef = clean(getV('refNFe'));
        if (chaveRef.length === 44) {
            nfrefXml = `<NFref><refNFe>${chaveRef}</refNFe></NFref>`;
        }
    }
    // -----------------------------------------------

    let det = "";
    document.querySelectorAll(".produto-item").forEach((item, i) => {
        const q = parseFloat(item.querySelector(".qtd").value) || 1;
        const v = parseFloat(item.querySelector(".vUn").value) || 0;
        const vP = (q * v).toFixed(2);
        
        let impostoXml = "";

        if (perfil === "NORMAL") {
            impostoXml = `
                <ICMS><ICMS00><orig>0</orig><CST>00</CST><vBC>${vP}</vBC><pICMS>18.00</pICMS><vICMS>${(vP*0.18).toFixed(2)}</vICMS></ICMS00></ICMS>
                <PIS><PISAliq><CST>01</CST><vBC>${vP}</vBC><pPIS>1.65</pPIS><vPIS>${(vP*0.0165).toFixed(2)}</vPIS></PISAliq></PIS>
                <COFINS><COFINSAliq><CST>01</CST><vBC>${vP}</vBC><pCOFINS>7.60</pCOFINS><vCOFINS>${(vP*0.076).toFixed(2)}</vCOFINS></COFINSAliq></COFINS>`;
        } else if (perfil === "SIMPLES") {
            impostoXml = `
                <ICMS><ICMSSN102><orig>0</orig><CSOSN>102</CSOSN></ICMSSN102></ICMS>
                <PIS><PISNT><CST>07</CST></PISNT></PIS>
                <COFINS><COFINSNT><CST>07</CST></COFINSNT></COFINS>`;
        } else {
            impostoXml = `
                <ICMS><ICMS40><orig>0</orig><CST>40</CST></ICMS40></ICMS>
                <PIS><PISNT><CST>08</CST></PISNT></PIS>
                <COFINS><COFINSNT><CST>08</CST></COFINSNT></COFINS>`;
        }

        det += `
        <det nItem="${i+1}">
            <prod>
                <cProd>${item.querySelector(".cProd").value}</cProd><xProd>${item.querySelector(".xProd").value}</xProd>
                <NCM>21069090</NCM><CFOP>${cfopBase}</CFOP><uCom>UN</uCom><qCom>${q.toFixed(4)}</qCom>
                <vUnCom>${v.toFixed(10)}</vUnCom><vProd>${vP}</vProd><indTot>1</indTot>
            </prod>
            <imposto>${impostoXml}</imposto>
        </det>`;
    });

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
    <NFe>
        <infNFe Id="NFe${chave}" versao="4.00">
            <ide>
                <cUF>42</cUF><cNF>${cNF}</cNF><natOp>${natOp}</natOp><mod>55</mod><serie>1</serie><nNF>${nNF}</nNF><dhEmi>${dh}</dhEmi><tpNF>1</tpNF><idDest>1</idDest><tpAmb>1</tpAmb><finNFe>${finNFe}</finNFe><procEmi>0</procEmi><verProc>6.3</verProc>
                ${nfrefXml}
            </ide>
            <emit><CNPJ>${clean(getV('cnpjEmit'))}</CNPJ><xNome>${getV('xNomeEmit')}</xNome><enderEmit><UF>SP</UF></enderEmit></emit>
            <dest><CNPJ>${clean(getV('cnpjDest'))}</CNPJ><xNome>${getV('xNomeDest')}</xNome><enderDest><UF>SP</UF></enderDest></dest>
            ${det}
            <total>
                <ICMSTot>
                    <vBC>${(perfil==="NORMAL"?r.prodT:0).toFixed(2)}</vBC>
                    <vICMS>${r.icmsT.toFixed(2)}</vICMS>
                    <vST>${r.stT.toFixed(2)}</vST>
                    <vProd>${r.prodT.toFixed(2)}</vProd>
                    <vPIS>${r.pisT.toFixed(2)}</vPIS>
                    <vCOFINS>${r.cofT.toFixed(2)}</vCOFINS>
                    <vNF>${r.vNF.toFixed(2)}</vNF>
                </ICMSTot>
            </total>
            <transp><modFrete>0</modFrete></transp>
        </infNFe>
    </NFe>
    <protNFe versao="4.00">
        <infProt><chNFe>${chave}</chNFe><dhRecbto>${dh}</dhRecbto><nProt>${numAleatorio(100000,999999)}</nProt><cStat>100</cStat></infProt>
    </protNFe>
</nfeProc>`;
    
    document.getElementById('xml-output').value = xml.trim();
    document.getElementById('xml-output').style.display = 'block';
    document.getElementById('btnDownload').style.display = 'block';
    
    const btnTransmitir = document.getElementById('btnTransmitir');
    if(btnTransmitir) btnTransmitir.style.display = 'block';
}

function baixarXML() {
    const b = new Blob([document.getElementById('xml-output').value], {type:'text/xml'});
    const a = document.createElement('a'); 
    a.href = URL.createObjectURL(b); 
    a.download = `nfe_${getV('perfilNota')}_${numAleatorio(1,999)}.xml`; 
    a.click();
}

// ==========================================
// INTEGRAÇÃO API - NUVEM FISCAL
// ==========================================
async function obterToken() {
    const clientId = getV('clientId');
    const clientSecret = getV('clientSecret');

    if (!clientId || !clientSecret) {
        throw new Error("O Client ID e o Client Secret devem ser preenchidos!");
    }

    const resp = await fetch(`${API_BASE}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: clientId,
            client_secret: clientSecret,
            scope: 'nfe'
        })
    });
    
    if (!resp.ok) {
        throw new Error("Falha ao autenticar na Nuvem Fiscal. Verifique se o Client ID e Secret estão corretos.");
    }

    const data = await resp.json();
    return data.access_token;
}

async function transmitirParaSefaz() {
    const xmlContent = document.getElementById('xml-output').value;
    if (!xmlContent) return alert("Gere o XML primeiro!");

    const btn = document.getElementById('btnTransmitir');
    btn.innerText = "⏳ TRANSMITINDO...";
    btn.disabled = true;

    try {
        const token = await obterToken();
        const resp = await fetch(`${API_BASE}/nfe`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/xml'
            },
            body: xmlContent
        });

        const resultado = await resp.json();
        console.log("Retorno Nuvem Fiscal:", resultado);
        
        if (resp.ok) {
            alert(`✅ Sucesso! Status SEFAZ: ${resultado.status}`);
        } else {
            alert(`❌ Erro: ${resultado.error ? resultado.error.message : 'Falha na requisição'}`);
        }
    } catch (err) {
        console.error("Erro no fetch:", err);
        alert(err.message || "Erro na comunicação com a API da Nuvem Fiscal.");
    } finally {
        btn.innerText = "🚀 TRANSMITIR PARA SEFAZ (HOMOLOGAÇÃO)";
        btn.disabled = false;
    }
}