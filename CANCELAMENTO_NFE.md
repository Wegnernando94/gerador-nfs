# Cancelamento de Nota Fiscal (NF-e/NFC-e)

## Visão Geral

Endpoint backend para cancelamento de notas fiscais via API Nuvem Fiscal. Implementado em PHP seguindo os padrões de segurança e autenticação do projeto.

## Características

- ✅ Validação de CSRF token (OWASP A01)
- ✅ Autenticação OAuth2 automática
- ✅ Tratamento robusto de erros HTTP (404, 422, 401, etc.)
- ✅ Validação de parâmetros (ID e justificativa)
- ✅ Logging de erros para diagnóstico
- ✅ Suporte a Bearer Token da Nuvem Fiscal
- ✅ SSL/TLS verificado com CA bundle local

## Requisição

**Endpoint:** `POST /api/cancelar_nfe.php`

**Headers Obrigatórios:**
```
Content-Type: application/json
X-CSRF-Token: {token_csrf}
```

**Corpo (JSON):**
```json
{
  "id": "id_da_nota_gerado_pela_nuvem_fiscal",
  "justificativa": "Justificativa com no mínimo 15 caracteres (máximo 255)"
}
```

## Parâmetros

| Parâmetro | Tipo | Descrição | Validação |
|-----------|------|-----------|-----------|
| `id` | string | ID da nota gerado pela Nuvem Fiscal | Obrigatório, alfanumérico com `-` e `_` |
| `justificativa` | string | Motivo do cancelamento | Obrigatório, 15-255 caracteres |

## Respostas

### ✅ Sucesso (200)

```json
{
  "success": true,
  "message": "Nota fiscal cancelada com sucesso.",
  "data": {
    "id": "...",
    "status": "cancelada",
    ...
  }
}
```

### ❌ Validação falhou (400)

```json
{
  "error": "Justificativa é obrigatória e deve ter no mínimo 15 caracteres.",
  "current_length": 5
}
```

### ❌ CSRF inválido (403)

```json
{
  "error": "CSRF token inválido ou ausente."
}
```

### ❌ Autenticação falhou (401)

```json
{
  "error": "Falha na autenticação. Verifique as credenciais."
}
```

### ❌ Nota não encontrada (404)

```json
{
  "error": "Nota fiscal não encontrada.",
  "id": "...",
  "details": { ... }
}
```

### ❌ Erro SEFAZ (422)

```json
{
  "error": "Erro de validação SEFAZ. Verifique os dados e tente novamente.",
  "details": {
    "error": "Motivo da rejeição pela SEFAZ"
  }
}
```

### ❌ Erro interno (500)

```json
{
  "error": "Erro interno do servidor."
}
```

## Exemplo de Uso (JavaScript)

### Com a função securePost existente:

```javascript
async function cancelarNota(idNota, justificativa) {
  try {
    // Validação básica no frontend
    if (!idNota || !idNota.trim()) {
      alert('ID da nota é obrigatório');
      return;
    }
    
    if (justificativa.length < 15) {
      alert('Justificativa deve ter no mínimo 15 caracteres');
      return;
    }

    // Fazer requisição
    const response = await securePost('api/cancelar_nfe.php', {
      id: idNota.trim(),
      justificativa: justificativa.trim()
    });

    const result = await response.json();

    if (response.ok) {
      console.log('Nota cancelada com sucesso:', result.data);
      alert('Nota fiscal cancelada com sucesso!');
      // Recarregar lista de notas, etc.
    } else {
      handleCancelamentoError(response.status, result);
    }
  } catch (error) {
    console.error('Erro ao cancelar nota:', error);
    alert('Erro ao comunicar com o servidor: ' + error.message);
  }
}

function handleCancelamentoError(status, errorData) {
  let mensagem = errorData.error || 'Erro desconhecido';
  
  if (status === 400) {
    mensagem = 'Validação falhou: ' + mensagem;
  } else if (status === 401) {
    mensagem = 'Sessão expirada. Faça login novamente.';
  } else if (status === 404) {
    mensagem = 'Nota não encontrada: ' + mensagem;
  } else if (status === 422) {
    mensagem = 'A SEFAZ rejeitou o cancelamento: ' + mensagem;
  } else if (status === 500) {
    mensagem = 'Erro no servidor. Tente novamente em alguns momentos.';
  }
  
  alert(mensagem);
}
```

### Com evento de botão:

```html
<!-- HTML -->
<div id="painelCancelamento" style="display:none;">
  <h3>Cancelar Nota Fiscal</h3>
  <p>ID da Nota: <span id="nfId"></span></p>
  <textarea id="justificativaCancelamento" 
    placeholder="Justificativa (mínimo 15 caracteres)"
    rows="3"></textarea>
  <p id="charCount" style="font-size:0.9em; color:#666;">0/255 caracteres</p>
  <button onclick="executarCancelamento()">Cancelar Nota</button>
  <button onclick="fecharPainelCancelamento()">Voltar</button>
</div>

<script>
let _nfParaCancelar = null;

function abrirPainelCancelamento(idNota) {
  _nfParaCancelar = idNota;
  document.getElementById('nfId').textContent = idNota;
  document.getElementById('justificativaCancelamento').value = '';
  document.getElementById('painelCancelamento').style.display = 'block';
  atualizarCharCount();
}

function fecharPainelCancelamento() {
  document.getElementById('painelCancelamento').style.display = 'none';
  _nfParaCancelar = null;
}

// Atualizar contador de caracteres em tempo real
document.addEventListener('DOMContentLoaded', () => {
  const textarea = document.getElementById('justificativaCancelamento');
  if (textarea) {
    textarea.addEventListener('input', atualizarCharCount);
  }
});

function atualizarCharCount() {
  const textarea = document.getElementById('justificativaCancelamento');
  const counter = document.getElementById('charCount');
  const len = textarea.value.length;
  counter.textContent = len + '/255 caracteres';
  counter.style.color = len < 15 ? '#f44336' : len > 255 ? '#f44336' : '#4caf50';
}

async function executarCancelamento() {
  if (!_nfParaCancelar) return;
  
  const justificativa = document.getElementById('justificativaCancelamento').value;
  
  if (justificativa.length < 15) {
    alert('Justificativa deve ter no mínimo 15 caracteres');
    return;
  }
  
  if (!confirm('Tem certeza que deseja cancelar esta nota fiscal?\nEsta ação não pode ser desfeita.')) {
    return;
  }
  
  await cancelarNota(_nfParaCancelar, justificativa);
  fecharPainelCancelamento();
}
</script>
```

## Fluxo de Autenticação

1. **Frontend:** Envia requisição POST com CSRF token
2. **PHP (cancelar_nfe.php):**
   - Valida CSRF token
   - Valida parâmetros de entrada
   - Importa `auth_nuvem.php`
3. **auth_nuvem.php:**
   - Verifica cache de token em sessão
   - Se expirado, faz OAuth2 request para obter novo token
   - Armazena token em sessão
4. **API Nuvem Fiscal:**
   - Recebe POST com Bearer Token
   - Processa cancelamento
   - Retorna status HTTP apropriado
5. **PHP:** Trata resposta e retorna ao frontend

## Tratamento de Erros

### Validação Côlegial

```
15 caracteres ❌ → erro 400
15 caracteres ✅ → aceita
256 caracteres ❌ → erro 400 (máx 255)
```

### Códigos HTTP Tratados

| Status | Significado | Ação |
|--------|-------------|------|
| 200/201 | Sucesso | Cancelamento concluído |
| 400 | Bad Request | Parâmetros inválidos |
| 401 | Unauthorized | Token expirado/inválido |
| 403 | Forbidden | CSRF token inválido |
| 404 | Not Found | Nota não existe na Nuvem Fiscal |
| 422 | Unprocessable Entity | SEFAZ rejeitou cancelamento |
| 500-503 | Server Error | Erro na API Nuvem Fiscal |

## Modelo de Dados (NfePedidoCancelamento)

Confira `model/NfePedidoCancelamento.md` para detalhes da estrutura esperada pela API Nuvem Fiscal.

**Campo obrigatório:**
- `justificativa` (string, 15-255 caracteres) - Preenchido automaticamente se em branco

## Segurança

### Implementações

✅ CSRF Token validation (X-CSRF-Token header)  
✅ Session-based authentication  
✅ Input sanitization (regex alphanumeric + `-_`)  
✅ SSL/TLS verification  
✅ Bearer token in Authorization header  
✅ Error logging sem exposição de detalhes técnicos  
✅ HTTP method restriction (POST only)  
✅ CORS headers configurados  

### Boas Práticas

- **Não altere** a validação de CSRF — é crítica para segurança
- **Sempre valide** justificativa no frontend antes de submeter
- **Trate erros** graciosamente sem expor detalhes técnicos
- **Log** todas as tentativas de cancelamento para auditoria
- **Monitore** padrões de cancelamento em massa

## Monitoramento

Verifique o arquivo de log do PHP para diagnóstico:

```bash
# Linux/macOS
tail -f /var/log/php-fpm/error.log
# ou seu caminho específico
tail -f storage/logs/php-errors.log

# Windows
# Procure por %USERPROFILE%\AppData\Local\PHP\logs
```

Logs do cancelamento iniciam com `[CancelarNfe]`:
```
[CancelarNfe] POST /nfe/abc123/cancelamentos body={"justificativa":"..."}
[CancelarNfe] Non-2xx response for POST /nfe/abc123/cancelamentos: HTTP 404
```

## Próximos Passos

1. **Integrar botão de cancelamento** na lista de notas fiscais
2. **Adicionar confirmação visual** antes de cancelar
3. **Implementar auditoria** (log em DB de quem cancelou, quando, por quê)
4. **Webhook** para sincronizar status com seu banco de dados local
5. **Relatório** de cancelamentos por período/empresa

## Referências

- [API Nuvem Fiscal - Cancelamentos](https://docs.nuvemfiscal.com.br/)
- [Model NfePedidoCancelamento](./model/NfePedidoCancelamento.md)
- [Auth Helper](./api/auth_nuvem.php)
- [OWASP CSRF Prevention](https://owasp.org/www-community/attacks/csrf)
