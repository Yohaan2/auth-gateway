const fs = require("node:fs");
const path = require("node:path");
const { randomBytes } = require("node:crypto");
const { execFileSync } = require("node:child_process");

const directory = path.join(__dirname, "local");
const target = path.join(directory, ".env");
if (fs.existsSync(target)) {
  throw new Error("docker/local/.env ya existe: no se sobrescriben credenciales ni datos locales.");
}

fs.mkdirSync(directory, { recursive: true });
const password = randomBytes(32).toString("hex");
const origin = "http://localhost:19080";
const values = {
  NODE_ENV: "production",
  LOCAL_HTTP_ONLY: "true",
  PORT: "3000",
  APP_URL: origin,
  FRONTEND_URL: origin,
  SESSION_SECRET: randomBytes(32).toString("hex"),
  ENABLE_ADMIN_BOOTSTRAP: "false",
  POSTGRES_USER: "postgres",
  POSTGRES_PASSWORD: password,
  POSTGRES_DB: "auth_optrax",
  DATABASE_URL: `postgresql://postgres:${password}@postgres:5432/auth_optrax`,
  KC_DB_URL: "jdbc:postgresql://postgres:5432/keycloak",
  KC_DB_USERNAME: "postgres",
  KC_DB_PASSWORD: password,
  KC_BOOTSTRAP_ADMIN_USERNAME: "local-master-admin",
  KC_BOOTSTRAP_ADMIN_PASSWORD: randomBytes(32).toString("hex"),
  LOCAL_PANEL_USERNAME: "admin-local",
  LOCAL_PANEL_PASSWORD: randomBytes(32).toString("hex"),
  KEYCLOAK_URL: `${origin}/auth`,
  KEYCLOAK_INTERNAL_URL: "http://keycloak:8080/auth",
  KEYCLOAK_REALM: "optrax-realm",
  KEYCLOAK_ALLOWED_CLIENT_IDS: "optrax-frontend",
  KEYCLOAK_CLIENT_ID: "optrax-app",
  KEYCLOAK_CLIENT_SECRET: randomBytes(32).toString("hex"),
  KEYCLOAK_REDIRECT_URI: `${origin}/api/auth/callback`,
  KEYCLOAK_POST_LOGOUT_REDIRECT_URI: `${origin}/`,
  KEYCLOAK_SA_CLIENT_ID: "auth-manager-sa",
  KEYCLOAK_SA_CLIENT_SECRET: randomBytes(32).toString("hex"),
  KEYCLOAK_ADMIN_ROLE: "SUPER_ADMIN",
  KEYCLOAK_VIEWER_ROLE: "AUDITOR",
  VITE_KEYCLOAK_URL: `${origin}/auth`,
  VITE_KEYCLOAK_REALM: "optrax-realm",
  VITE_KEYCLOAK_CLIENT_ID: "optrax-frontend",
  VITE_ADMIN_ROLE: "SUPER_ADMIN",
  VITE_VIEWER_ROLE: "AUDITOR",
};

fs.writeFileSync(target, Object.entries(values).map(([key, value]) => `${key}=${value}`).join("\n") + "\n", { mode: 0o600 });
fs.chmodSync(target, 0o600);
execFileSync(process.execPath, [path.join(__dirname, "prepare-realm.cjs"), target, directory], { stdio: "inherit" });
console.log("Entorno local creado. Credenciales del panel: docker/local/.env (LOCAL_PANEL_USERNAME y LOCAL_PANEL_PASSWORD).");
