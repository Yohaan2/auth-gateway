const fs = require("node:fs");
const path = require("node:path");
const { randomBytes } = require("node:crypto");

const directory = path.join(__dirname, "smoke");
fs.mkdirSync(path.join(directory, "certs"), { recursive: true });

const password = randomBytes(32).toString("hex");
const values = {
  NODE_ENV: "production",
  PORT: "3000",
  DOMAIN: "auth.optrax.io",
  APP_URL: "https://auth.optrax.io",
  FRONTEND_URL: "https://auth.optrax.io",
  SESSION_SECRET: randomBytes(32).toString("hex"),
  ENABLE_ADMIN_BOOTSTRAP: "false",
  POSTGRES_USER: "postgres",
  POSTGRES_PASSWORD: password,
  POSTGRES_DB: "auth_optrax",
  DATABASE_URL: `postgresql://postgres:${password}@postgres:5432/auth_optrax`,
  KC_DB_URL: "jdbc:postgresql://postgres:5432/keycloak",
  KC_DB_USERNAME: "postgres",
  KC_DB_PASSWORD: password,
  KC_BOOTSTRAP_ADMIN_USERNAME: "smoke-master-admin",
  KC_BOOTSTRAP_ADMIN_PASSWORD: randomBytes(32).toString("hex"),
  KEYCLOAK_URL: "https://auth.optrax.io/auth",
  KEYCLOAK_INTERNAL_URL: "http://keycloak:8080/auth",
  KEYCLOAK_REALM: "optrax-realm",
  KEYCLOAK_ALLOWED_CLIENT_IDS: "optrax-frontend",
  KEYCLOAK_CLIENT_ID: "optrax-app",
  KEYCLOAK_CLIENT_SECRET: randomBytes(32).toString("hex"),
  KEYCLOAK_REDIRECT_URI: "https://auth.optrax.io/api/auth/callback",
  KEYCLOAK_POST_LOGOUT_REDIRECT_URI: "https://auth.optrax.io/",
  KEYCLOAK_SA_CLIENT_ID: "auth-manager-sa",
  KEYCLOAK_SA_CLIENT_SECRET: randomBytes(32).toString("hex"),
  KEYCLOAK_ADMIN_ROLE: "SUPER_ADMIN",
  KEYCLOAK_VIEWER_ROLE: "AUDITOR",
  VITE_KEYCLOAK_URL: "https://auth.optrax.io/auth",
  VITE_KEYCLOAK_REALM: "optrax-realm",
  VITE_KEYCLOAK_CLIENT_ID: "optrax-frontend",
  VITE_ADMIN_ROLE: "SUPER_ADMIN",
  VITE_VIEWER_ROLE: "AUDITOR",
};

const target = path.join(directory, ".env");
if (fs.existsSync(target)) {
  throw new Error("docker/smoke/.env ya existe: no se sobrescriben datos de una prueba anterior.");
}
fs.writeFileSync(target, Object.entries(values).map(([key, value]) => `${key}=${value}`).join("\n") + "\n", { mode: 0o600 });
fs.chmodSync(target, 0o600);
console.log("Entorno de prueba aislado generado en docker/smoke/.env.");
