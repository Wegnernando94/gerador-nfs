FROM php:8.2-apache

# Instala dependências para manipulação de XML e PDFs (comum em NF-e)
RUN apt-get update && apt-get install -y \
    libxml2-dev \
    libpng-dev \
    && docker-php-ext-install dom soap gd

# Habilita mod_rewrite para o .htaccess funcionar
RUN a2enmod rewrite headers
RUN sed -i 's/AllowOverride None/AllowOverride All/g' /etc/apache2/apache2.conf

# Copia TODO o conteúdo da sua pasta para o servidor
COPY . /var/www/html/

# Cria o config.php com as credenciais via variáveis de ambiente
RUN echo '<?php\nreturn [\n    '"'"'client_id'"'"'     => getenv('"'"'NUVEMFISCAL_CLIENT_ID'"'"'),\n    '"'"'client_secret'"'"' => getenv('"'"'NUVEMFISCAL_CLIENT_SECRET'"'"'),\n    '"'"'api_base'"'"'      => '"'"'https://api.sandbox.nuvemfiscal.com.br'"'"'\n];' > /var/www/html/config.php

# Dá permissão total para a pasta
RUN chown -R www-data:www-data /var/www/html \
    && chmod -R 755 /var/www/html

EXPOSE 80