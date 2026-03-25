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

# Copia e prepara o entrypoint
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Dá permissão total para a pasta
RUN chown -R www-data:www-data /var/www/html \
    && chmod -R 755 /var/www/html

EXPOSE 80

ENTRYPOINT ["docker-entrypoint.sh"]