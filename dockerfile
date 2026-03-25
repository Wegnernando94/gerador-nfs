FROM php:8.2-apache

# Instala dependências para manipulação de XML e PDFs (comum em NF-e)
RUN apt-get update && apt-get install -y \
    libxml2-dev \
    libpng-dev \
    && docker-php-ext-install dom soap gd

# Copia TODO o conteúdo da sua pasta para o servidor
COPY . /var/www/html/

# Dá permissão total para a pasta (essencial para gerar arquivos de nota)
RUN chown -R www-data:www-data /var/www/html \
    && chmod -R 755 /var/www/html

EXPOSE 80