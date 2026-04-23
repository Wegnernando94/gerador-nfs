#!/bin/bash
# ============================================
# TESTES DE CANCELAMENTO DE NF-e
# ============================================
# Script para testar o endpoint de cancelamento
# via cURL. Substitua os valores conforme necessário.

# CONFIGURAÇÃO
BASE_URL="http://localhost:8000"
API_ENDPOINT="${BASE_URL}/api/cancelar_nfe.php"

# Cores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== TESTES DE CANCELAMENTO DE NF-e ===${NC}\n"

# ============================================
# TESTE 1: Validação de ID obrigatório
# ============================================
echo -e "${YELLOW}TESTE 1: Validação de ID obrigatório${NC}"
echo "POST ${API_ENDPOINT}"
echo "Body: {\"id\":\"\", \"justificativa\":\"Cancelamento por erro do sistema\"}"
echo ""

curl -X POST "${API_ENDPOINT}" \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: token_teste" \
  -d '{
    "id": "",
    "justificativa": "Cancelamento por erro do sistema"
  }' \
  -w "\nStatus: %{http_code}\n\n"

# ============================================
# TESTE 2: Validação de justificativa curta
# ============================================
echo -e "${YELLOW}TESTE 2: Validação de justificativa < 15 caracteres${NC}"
echo "POST ${API_ENDPOINT}"
echo "Body: {\"id\":\"abc123\", \"justificativa\":\"Curto\"}"
echo ""

curl -X POST "${API_ENDPOINT}" \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: token_teste" \
  -d '{
    "id": "abc123",
    "justificativa": "Curto"
  }' \
  -w "\nStatus: %{http_code}\n\n"

# ============================================
# TESTE 3: Validação de justificativa longa
# ============================================
echo -e "${YELLOW}TESTE 3: Validação de justificativa > 255 caracteres${NC}"
JUSTIFICATIVA_LONGA=$(python3 -c "print('a' * 300)")
echo "POST ${API_ENDPOINT}"
echo "Body: {\"id\":\"abc123\", \"justificativa\":\"${JUSTIFICATIVA_LONGA:0:50}...\"}"
echo ""

curl -X POST "${API_ENDPOINT}" \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: token_teste" \
  -d "{
    \"id\": \"abc123\",
    \"justificativa\": \"${JUSTIFICATIVA_LONGA}\"
  }" \
  -w "\nStatus: %{http_code}\n\n"

# ============================================
# TESTE 4: CSRF token inválido
# ============================================
echo -e "${YELLOW}TESTE 4: CSRF token inválido (403 esperado)${NC}"
echo "POST ${API_ENDPOINT}"
echo "Header: X-CSRF-Token: token_invalido"
echo ""

curl -X POST "${API_ENDPOINT}" \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: token_invalido" \
  -d '{
    "id": "nota123",
    "justificativa": "Cancelamento por solicitação do cliente"
  }' \
  -w "\nStatus: %{http_code}\n\n"

# ============================================
# TESTE 5: Requisição válida (com ID e justificativa corretos)
# ============================================
echo -e "${YELLOW}TESTE 5: Requisição válida com parâmetros corretos${NC}"
echo "POST ${API_ENDPOINT}"
echo "Body: {\"id\":\"nota_abc123\", \"justificativa\":\"Cancelamento por solicitação do cliente\"}"
echo ""

curl -X POST "${API_ENDPOINT}" \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: token_teste" \
  -d '{
    "id": "nota_abc123",
    "justificativa": "Cancelamento por solicitação do cliente"
  }' \
  -w "\nStatus: %{http_code}\n\n"

# ============================================
# TESTE 6: Requisição com ID não encontrado
# ============================================
echo -e "${YELLOW}TESTE 6: ID da nota não encontrada (404 esperado)${NC}"
echo "POST ${API_ENDPOINT}"
echo "Body: {\"id\":\"nota_inexistente_12345\", \"justificativa\":\"Cancelamento por erro\"}"
echo ""

curl -X POST "${API_ENDPOINT}" \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: token_teste" \
  -d '{
    "id": "nota_inexistente_12345",
    "justificativa": "Cancelamento por erro do sistema"
  }' \
  -w "\nStatus: %{http_code}\n\n"

# ============================================
# TESTE 7: Method not allowed
# ============================================
echo -e "${YELLOW}TESTE 7: Método GET não permitido (405 esperado)${NC}"
echo "GET ${API_ENDPOINT}"
echo ""

curl -X GET "${API_ENDPOINT}" \
  -H "X-CSRF-Token: token_teste" \
  -w "\nStatus: %{http_code}\n\n"

# ============================================
# TESTE 8: JSON inválido
# ============================================
echo -e "${YELLOW}TESTE 8: JSON malformado (400 esperado)${NC}"
echo "POST ${API_ENDPOINT}"
echo "Body: {\"id\": invalid json}"
echo ""

curl -X POST "${API_ENDPOINT}" \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: token_teste" \
  -d '{
    "id": invalid json
  }' \
  -w "\nStatus: %{http_code}\n\n"

# ============================================
# RESUMO
# ============================================
echo -e "${GREEN}"
echo "=== TESTES CONCLUÍDOS ==="
echo ""
echo "Códigos de status esperados:"
echo "  200/201: Sucesso (nota cancelada)"
echo "  400:     Bad request (validação falhou)"
echo "  403:     Forbidden (CSRF inválido)"
echo "  404:     Not found (nota não existe)"
echo "  405:     Method not allowed"
echo "  422:     Unprocessable entity (erro SEFAZ)"
echo "  500:     Server error"
echo -e "${NC}"

# ============================================
# NOTAS PARA TESTE MANUAL
# ============================================
cat << 'EOF'

USANDO POSTMAN:
1. Crie uma nova requisição POST
2. URL: http://localhost:8000/api/cancelar_nfe.php
3. Body (raw, JSON):
   {
     "id": "seu_id_aqui",
     "justificativa": "Cancelamento por motivo válido"
   }
4. Headers:
   - Content-Type: application/json
   - X-CSRF-Token: seu_csrf_token

OBTENDO CSRF TOKEN:
curl -I http://localhost:8000/api/listar_empresas.php | grep X-CSRF-Token

LOGS:
tail -f /var/log/php-fpm/error.log  # Linux
# ou seu arquivo de log específico

EOF
