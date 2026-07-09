#!/bin/bash

# ==============================================================================
# Script de Renovación Manual/Automatizada de Certificados SSL
# Dominio: auth.optrax.io
# ==============================================================================

# Detener el script si ocurre algún error
set -e

# Determinar comando docker compose
DOCKER_COMPOSE="docker compose -f docker/docker-compose.yml"

echo "=== Iniciando proceso de renovación de certificados ==="

# Ejecutar renovación en el contenedor de certbot
$DOCKER_COMPOSE run --rm certbot renew

# Recargar nginx para aplicar los cambios si se renovó el certificado
echo "=== Recargando Nginx ==="
$DOCKER_COMPOSE exec nginx nginx -s reload

echo "=== ¡Renovación finalizada correctamente! ==="
