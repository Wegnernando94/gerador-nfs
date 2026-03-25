# Usa a imagem oficial do PHP com Apache
FROM php:8.2-apache

# Copia todos os arquivos da sua pasta atual para dentro do servidor no Render
COPY . /var/www/html/

# Dá permissão para o Apache ler seus arquivos
RUN chown -R www-data:www-data /var/www/html

# Informa ao Render que vamos usar a porta 80
EXPOSE 80