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

# Habilita variáveis de ambiente do sistema no PHP via Apache
RUN echo 'PassEnv NUVEMFISCAL_CLIENT_ID' >> /etc/apache2/apache2.conf \
 && echo 'PassEnv NUVEMFISCAL_CLIENT_SECRET' >> /etc/apache2/apache2.conf

# Gera config.php que lê as credenciais das variáveis de ambiente em runtime
RUN printf '<?php\nreturn [\n    "client_id"     => getenv("NUVEMFISCAL_CLIENT_ID"),\n    "client_secret" => getenv("NUVEMFISCAL_CLIENT_SECRET"),\n    "api_base"      => "https://api.sandbox.nuvemfiscal.com.br"\n];\n' > /var/www/html/config.php

# Dá permissão total para a pasta
RUN chown -R www-data:www-data /var/www/html \
    && chmod -R 755 /var/www/html

EXPOSE 80