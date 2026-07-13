-- Crea la base de datos de Keycloak si no existe.
-- Este script se ejecuta una sola vez al inicializar el volumen de PostgreSQL.
SELECT 'CREATE DATABASE keycloak'
WHERE NOT EXISTS (
  SELECT FROM pg_database WHERE datname = 'keycloak'
)\gexec
