const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const base = {
  NODE_ENV: "production",
  APP_URL: "http://localhost:19080",
  FRONTEND_URL: "http://localhost:19080",
  KEYCLOAK_URL: "http://localhost:19080/auth",
  KEYCLOAK_REALM: "local",
  KEYCLOAK_ALLOWED_CLIENT_IDS: "optrax-frontend",
  KEYCLOAK_CLIENT_ID: "optrax-app",
  KEYCLOAK_CLIENT_SECRET: "test-secret",
  KEYCLOAK_REDIRECT_URI: "http://localhost:19080/api/auth/callback",
  KEYCLOAK_SA_CLIENT_ID: "auth-manager-sa",
  KEYCLOAK_SA_CLIENT_SECRET: "test-secret",
  SESSION_SECRET: "a".repeat(32),
  DATABASE_URL: "postgresql://local:local@localhost:5432/local",
  ENABLE_ADMIN_BOOTSTRAP: "false",
};

function load(override = {}) {
  return spawnSync(process.execPath, ["-e", "require('./server/dist/config/env')"], {
    cwd: path.join(__dirname, ".."),
    env: { ...process.env, ...base, ...override },
    encoding: "utf8",
  }).status;
}

test("HTTP sin permiso local falla en producción", () => {
  assert.notEqual(load({ LOCAL_HTTP_ONLY: "false" }), 0);
});

test("HTTP localhost con permiso local pasa", () => {
  assert.equal(load({ LOCAL_HTTP_ONLY: "true" }), 0);
});

test("el permiso local no autoriza dominios ni IPs externas", () => {
  assert.notEqual(load({ LOCAL_HTTP_ONLY: "true", APP_URL: "http://192.168.1.5:19080" }), 0);
  assert.notEqual(load({ LOCAL_HTTP_ONLY: "true", KEYCLOAK_URL: "http://example.com/auth" }), 0);
});

test("HTTP por IP con INSECURE_HTTP pasa en producción", () => {
  assert.equal(
    load({
      INSECURE_HTTP: "true",
      APP_URL: "http://10.0.10.16",
      FRONTEND_URL: "http://10.0.10.16",
      KEYCLOAK_URL: "http://10.0.10.16/auth",
      KEYCLOAK_ALLOWED_CLIENT_IDS: "optrax-frontend",
    }),
    0
  );
});
