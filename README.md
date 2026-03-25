# 🛡️ NF-e QA Enterprise Studio

> Ferramenta web que desenvolvi para emissão, consulta, devolução e download de NF-e (Nota Fiscal Eletrônica), integrada com a API da [Nuvem Fiscal](https://nuvemfiscal.com.br).

---

## 📋 Índice

- [Sobre o Projeto](#-sobre-o-projeto)
- [Funcionalidades](#-funcionalidades)
- [Tecnologias](#-tecnologias)
- [Pré-requisitos](#-pré-requisitos)
- [Instalação e Configuração](#-instalação-e-configuração)
- [Estrutura de Arquivos](#-estrutura-de-arquivos)
- [Como Usar](#-como-usar)
- [Segurança](#-segurança)
- [Ambiente](#-ambiente)
- [Contribuição](#-contribuição)

---

## 📌 Sobre o Projeto

O **NF-e QA Enterprise Studio** é uma aplicação web que criei para emitir, consultar e gerenciar Notas Fiscais Eletrônicas (modelo 55) diretamente no **ambiente de homologação (sandbox)** da SEFAZ, sem depender de sistemas ERP ou acesso a produção.

Desenvolvi a aplicação como um cliente front-end + proxy PHP para a [API REST da Nuvem Fiscal](https://dev.nuvemfiscal.com.br/docs), mantendo as credenciais seguras no servidor.

---

## ✨ Funcionalidades

### 📄 Emissão de NF-e
- Seleção de empresa **emitente** e **destinatária** via dropdown (carregado dinamicamente da API)
- Auto-preenchimento de endereço, CNPJ, UF e dados fiscais ao selecionar a empresa
- **Auto-sequência de número** — ao selecionar o emitente, o sistema consulta o último número emitido e já sugere o próximo (`nNF + 1`)
- **Validação de duplicidade** antes de transmitir — bloqueia se o número já foi emitido
- Suporte a múltiplos itens com cálculo automático de ICMS, PIS e COFINS
- Seleção de CFOP com lista completa (operações internas e interestaduais)
- Suporte a **Simples Nacional** (CSOSN) e **Regime Normal** (CST)
- Cálculo automático de alíquota interestadual (ICMS conforme Resolução SF 22/89)
- Finalidades: NF-e Normal (venda) e **NF-e de Devolução** (finNFe=4)

### 🔁 Devolução de NF-e
- Consulta da nota original via **chave de acesso (44 dígitos)**
- Geração automática da NF-e de devolução com base nos dados da nota original:
  - Inversão de CFOP (5xxx → 5201/5202, 6xxx → 6201/6202)
  - Referência à nota original (`NFref`)
  - Forma de pagamento `90 - Sem Pagamento` (obrigatório para finNFe=4)
- Validações completas de `enderDest`, `indIEDest`, campos numéricos e itens

### 🔍 Consulta de Notas
- Listagem paginada de NF-e por empresa
- **Filtro por status** (autorizado, rejeitado, cancelado, pendente) — aplicado localmente via paginação múltipla
- Exibição de: data de emissão, série/número, CNPJ emitente, referência, valor, status, chave de acesso
- Motivo de rejeição acessível via tooltip/badge

### 📥 Download de Documentos
- **Visualizar DANFE** (PDF inline no browser)
- **Baixar DANFE** (PDF)
- **Baixar XML** da NF-e autorizada

---

## 🛠 Tecnologias

| Camada | Tecnologia |
|--------|-----------|
| Front-end | HTML5, CSS3, JavaScript (Vanilla ES2020) |
| Back-end (proxy) | PHP 8.x |
| API Fiscal | [Nuvem Fiscal REST API v1](https://dev.nuvemfiscal.com.br/docs) |
| Autenticação API | OAuth 2.0 — Client Credentials |
| Servidor local | PHP Built-in Server / Apache / Nginx |

---

## 📦 Pré-requisitos

- **PHP 8.0+** com extensões: `curl`, `json`, `session`, `openssl`
- Conta ativa na [Nuvem Fiscal](https://nuvemfiscal.com.br) com acesso ao **sandbox**
- `Client ID` e `Client Secret` da Nuvem Fiscal
- Servidor web com suporte a `.htaccess` (Apache) **ou** uso do servidor embutido do PHP

---

## ⚙️ Instalação e Configuração

### 1. Clone o repositório

```bash
git clone https://github.com/seu-usuario/gerador-nfs.git
cd gerador-nfs
```

### 2. Configure as credenciais

Edite o arquivo `config.php` com suas credenciais da Nuvem Fiscal:

```php
<?php
return [
    'client_id'     => 'SEU_CLIENT_ID',
    'client_secret' => 'SEU_CLIENT_SECRET',
    'api_base'      => 'https://api.sandbox.nuvemfiscal.com.br'
];
```

> ⚠️ **IMPORTANTE:** Nunca versione o `config.php` com credenciais reais. Adicione-o ao `.gitignore`.

### 3. Adicione ao `.gitignore`

```
config.php
config.js
.env
```

### 4. Inicie o servidor

**Opção A — Servidor embutido do PHP (desenvolvimento local):**

```bash
php -S localhost:8000
```

Acesse: [http://localhost:8000](http://localhost:8000)

**Opção B — Apache/Nginx:**

Aponte o `DocumentRoot` para a pasta do projeto. O `.htaccess` incluído já aplica as configurações de segurança.

---

## 📁 Estrutura de Arquivos

```
gerador-nfs/
│
├── index.html              # Interface principal da aplicação
├── script.js               # Toda a lógica front-end (emissão, devolução, consulta)
├── style.css               # Estilos globais
│
├── config.php              # 🔒 Credenciais da API (NÃO versionar)
├── config.js               # 🔒 Credenciais JS (NÃO versionar)
│
├── transmitir.php          # Proxy: envia NF-e para a Nuvem Fiscal
├── buscar_nfe.php          # Proxy: busca NF-e por chave de acesso
├── consultar_nfes.php      # Proxy: lista NF-es com filtros e paginação
├── listar_empresas.php     # Proxy: carrega empresas cadastradas na API
├── danfe.php               # Proxy: retorna PDF do DANFE
├── download_xml.php        # Proxy: retorna XML da NF-e
│
├── session_check.php       # Proteções de segurança (rate limiting)
├── .htaccess               # Regras Apache: headers, bloqueio de arquivos sensíveis
│
├── autoload_manual.php     # Autoloader manual para a lib
├── composer.json           # Dependências PHP
└── lib/                    # SDK PHP da Nuvem Fiscal (dependência)
```

---

## 🚀 Como Usar

### Emitir uma NF-e

1. Selecione a **empresa emitente** — o sistema auto-preenche os dados e sugere o próximo número disponível
2. Selecione a **empresa destinatária**
3. Adicione os **itens** com descrição, CFOP, NCM, quantidade e valor
4. Selecione o **regime tributário** (Simples Nacional ou Normal) e o CST/CSOSN
5. Clique em **TRANSMITIR PARA SEFAZ**
6. Após autorização, visualize/baixe o **DANFE** ou **XML**

### Emitir NF-e de Devolução

1. Selecione a finalidade **"4 - Devolução de Mercadoria"**
2. Informe a **chave de acesso** da nota original (44 dígitos) e clique em **Consultar**
3. Confirme os dados exibidos e clique em **Realizar Devolução**
4. O sistema gera automaticamente a NF-e de devolução com CFOP invertido e referência à nota original

### Consultar Notas Emitidas

1. Clique em **Consultar Notas** no menu superior
2. Selecione a empresa e aplique filtros (status, quantidade)
3. Visualize, baixe PDF ou XML de qualquer nota listada

---

## 🔒 Segurança

As seguintes proteções estão implementadas para uso em rede interna/staging:

| Proteção | Implementação |
|----------|--------------|
| **Bloqueio de arquivos sensíveis** | `.htaccess` bloqueia acesso direto a `config.php`, `composer.json`, `.env` |
| **Sem listagem de diretório** | `Options -Indexes` no `.htaccess` |
| **Bloqueio da pasta `/lib`** | Retorna HTTP 403 para acesso direto |
| **Headers de segurança HTTP** | `X-Frame-Options`, `X-Content-Type-Options`, `X-XSS-Protection`, `Content-Security-Policy`, `Referrer-Policy` |
| **Rate limiting** | Máximo de 60 requisições/minuto por sessão (HTTP 429 ao exceder) |
| **Validação de JSON** | `transmitir.php` rejeita payloads malformados |
| **Sanitização de inputs** | `preg_replace` em todos os parâmetros recebidos pelos PHPs |
| **Credenciais no servidor** | `config.php` nunca exposto ao cliente; PHPs atuam como proxy |

> Para deploy em produção, habilitar também:
> - Forçar HTTPS (descomentar bloco no `.htaccess`)
> - Configurar `CURLOPT_SSL_VERIFYPEER => true` nos arquivos PHP
> - Adicionar autenticação (Basic Auth ou login com sessão PHP)

---

## 🌐 Ambiente

Esta aplicação opera **exclusivamente no ambiente de homologação (sandbox)** da Nuvem Fiscal e da SEFAZ.

- As NF-es emitidas **não têm validade fiscal**
- Nenhum documento real é gerado ou enviado à SEFAZ em produção
- Ideal para testes de integração, validação de payloads e treinamento de equipe

Para usar em produção, alterar:
- `api_base` em `config.php` para `https://api.nuvemfiscal.com.br`
- `ambiente: "homologacao"` para `"producao"` nos payloads em `script.js` e nos PHPs
- `tpAmb: 2` para `tpAmb: 1` nos payloads JSON

---

## 🤝 Contribuição

Abra uma _issue_ ou _pull request_ com sugestões e melhorias.

---

<div align="center">
  <sub>Desenvolvido por Fernando Henrique Wegner</sub>
</div>
