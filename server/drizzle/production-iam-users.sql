-- Ejecutar una vez en auth_optrax ANTES de iniciar la app en producción.
-- La migración 0000 versionada no incluye iam_users aunque la aplicación la usa.
CREATE TABLE IF NOT EXISTS iam_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  keycloak_id varchar(255) NOT NULL UNIQUE,
  username varchar(255) NOT NULL,
  email varchar(255),
  first_name varchar(255),
  last_name varchar(255),
  tenant varchar(255),
  template_id uuid REFERENCES access_templates(id) ON DELETE SET NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_logs_timestamp_idx ON audit_logs (timestamp DESC);
CREATE INDEX IF NOT EXISTS iam_users_template_id_idx ON iam_users (template_id);
