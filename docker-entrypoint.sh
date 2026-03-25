#!/bin/sh
# Gera o config.php em runtime com as variáveis de ambiente disponíveis
cat > /var/www/html/config.php <<EOF
<?php
return [
    'client_id'     => '${NUVEMFISCAL_CLIENT_ID}',
    'client_secret' => '${NUVEMFISCAL_CLIENT_SECRET}',
    'api_base'      => 'https://api.sandbox.nuvemfiscal.com.br'
];
EOF

# Inicia o Apache
exec apache2-foreground
