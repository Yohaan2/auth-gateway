#!/bin/bash

# ==============================================================================
# Script de Configuración SSL Automatizado para Auth Optrax
# Dominio: auth.optrax.io
# ==============================================================================

# Detener el script si ocurre algún error
set -e

domains=(auth.optrax.io)
rsa_key_size=4096
data_path="./docker/certbot"
email="garciayohan57@gmail.com"
staging=0

# Mostrar banner de presentación
echo "================================================================================"
echo "      Configuración Automática de Certificados SSL (Let's Encrypt)       "
echo "                      Dominio: ${domains[@]}                             "
echo "================================================================================"

if [ -d "$data_path" ]; then
  read -p "Existen datos previos en $data_path para $domains. ¿Deseas borrarlos y reemplazarlos por un nuevo certificado? (y/N) " decision
  if [ "$decision" != "Y" ] && [ "$decision" != "y" ]; then
    exit
  fi
fi

if [ ! -e "$data_path/conf/options-ssl-nginx.conf" ] || [ ! -e "$data_path/conf/ssl-dhparams.pem" ]; then
  echo "### Descargando parámetros TLS recomendados..."
  mkdir -p "$data_path/conf"
  curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf > "$data_path/conf/options-ssl-nginx.conf"
  curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot/certbot/ssl-dhparams.pem > "$data_path/conf/ssl-dhparams.pem"
  echo
fi

echo "### Creando certificado temporal (dummy) para $domains..."
path="/etc/letsencrypt/live/$domains"
mkdir -p "$data_path/conf/live/$domains"
docker compose -f docker/docker-compose.yml run --rm --entrypoint "\
  openssl req -x509 -nodes -newkey rsa:$rsa_key_size -days 1\
    -keyout '$path/privkey.pem' \
    -out '$path/fullchain.pem' \
    -subj '/CN=localhost'" certbot
echo

echo "### Iniciando Nginx con certificado temporal..."
docker compose -f docker/docker-compose.yml up --force-recreate -d nginx
echo

echo "### Eliminando certificado temporal para $domains..."
docker compose -f docker/docker-compose.yml run --rm --entrypoint "\
  rm -Rf /etc/letsencrypt/live/$domains && \
  rm -Rf /etc/letsencrypt/archive/$domains && \
  rm -Rf /etc/letsencrypt/renewal/$domains.conf" certbot
echo

echo "### Solicitando certificado real Let's Encrypt para $domains..."
domain_args=""
for domain in "${domains[@]}"; do
  domain_args="$domain_args -d $domain"
done

case "$email" in
  "") email_arg="--register-unsafely-without-email" ;;
  *) email_arg="--email $email" ;;
esac

if [ $staging != "0" ]; then staging_arg="--staging"; fi

docker compose -f docker/docker-compose.yml run --rm --entrypoint "\
  certbot certonly --webroot -w /var/www/certbot \
    $staging_arg \
    $email_arg \
    $domain_args \
    --rsa-key-size $rsa_key_size \
    --agree-tos \
    --no-eff-email \
    --force-renewal" certbot
echo

echo "### Recargando Nginx para aplicar el certificado real..."
docker compose -f docker/docker-compose.yml exec nginx nginx -s reload

echo "================================================================================"
echo " ¡Proceso Completado con Éxito! "
echo " Tu dominio https://${domains[@]} ya cuenta con certificados SSL."
echo "================================================================================"
