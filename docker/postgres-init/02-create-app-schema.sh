#!/bin/sh
set -e

# postgres ejecuta estos scripts solo cuando inicializa un volumen nuevo.
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -f /opt/optrax-schema/0000.sql
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -f /opt/optrax-schema/0001.sql
