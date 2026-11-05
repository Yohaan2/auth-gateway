const fs = require("node:fs");
const path = require("node:path");
const https = require("node:https");
const { randomBytes } = require("node:crypto");
const dotenv = require("dotenv");

const env = dotenv.parse(fs.readFileSync(path.join(__dirname, "smoke", ".env")));
const realm = env.KEYCLOAK_REALM;

function request(label, method, url, body, bearer, expected = 200) {
  const payload = body == null ? undefined : typeof body === "string" ? body : JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: "127.0.0.1",
      port: 18443,
      servername: "auth.optrax.io",
      path: url,
      method,
      rejectUnauthorized: false, // Solo certificado efimero de la prueba aislada.
      headers: {
        Host: "auth.optrax.io",
        ...(payload ? { "Content-Type": typeof body === "string" ? "application/x-www-form-urlencoded" : "application/json" } : {}),
        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
      },
    }, (res) => {
      let text = "";
      res.on("data", (chunk) => { text += chunk; });
      res.on("end", () => {
        if (res.statusCode !== expected) {
          reject(new Error(`${label}: HTTP ${res.statusCode} (esperado ${expected})`));
          return;
        }
        console.log(`${label}: HTTP ${res.statusCode}`);
        try {
          resolve(text && text.trim().startsWith("{") ? JSON.parse(text) : { headers: res.headers });
        } catch {
          reject(new Error(`${label}: JSON invalido`));
        }
      });
    });
    req.on("error", reject);
    req.setTimeout(15000, () => req.destroy(new Error(`${label}: timeout`)));
    req.end(payload);
  });
}

function form(values) {
  return new URLSearchParams(values).toString();
}

async function main() {
  await request("App y DB", "GET", "/api/health");
  await request("Frontend", "GET", "/");
  const discovery = await request("Keycloak OIDC", "GET", `/auth/realms/${realm}/.well-known/openid-configuration`);
  if (discovery.issuer !== `https://auth.optrax.io/auth/realms/${realm}`) {
    throw new Error("Issuer incorrecto");
  }
  await request("Endpoint protegido sin token", "GET", "/api/iam/me", undefined, undefined, 401);

  const master = await request("Admin master", "POST", "/auth/realms/master/protocol/openid-connect/token",
    form({ grant_type: "password", client_id: "admin-cli", username: env.KC_BOOTSTRAP_ADMIN_USERNAME,
      password: env.KC_BOOTSTRAP_ADMIN_PASSWORD }));
  const username = `smoke-${randomBytes(5).toString("hex")}`;
  const password = randomBytes(24).toString("hex");
  const created = await request("Crear usuario aislado", "POST", `/auth/admin/realms/${realm}/users`,
    { username, enabled: true, emailVerified: true, credentials: [{ type: "password", value: password, temporary: false }] },
    master.access_token, 201);
  const userId = created.headers.location?.split("/").pop();
  if (!userId) throw new Error("Keycloak no devolvio el ID del usuario");
  const role = await request("Consultar rol", "GET", `/auth/admin/realms/${realm}/roles/SUPER_ADMIN`, undefined, master.access_token);
  await request("Asignar rol", "POST", `/auth/admin/realms/${realm}/users/${userId}/role-mappings/realm`,
    [role], master.access_token, 204);

  const frontend = await request("Login OIDC frontend", "POST", `/auth/realms/${realm}/protocol/openid-connect/token`,
    form({ grant_type: "password", client_id: "optrax-frontend", username, password }));
  const profile = await request("IAM autenticado", "GET", "/api/iam/me", undefined, frontend.access_token);
  if (!profile.roles.includes("SUPER_ADMIN")) throw new Error("Falta rol SUPER_ADMIN en el perfil");
  await request("Dashboard + service account", "GET", "/api/admin/dashboard", undefined, frontend.access_token);
  await request("Registrar modulo en gateway", "POST", "/api/admin/gateway/clients",
    { clientId: "optrax-app", clientSecret: env.KEYCLOAK_CLIENT_SECRET, name: "Smoke" }, frontend.access_token, 201);

  const login = await request("Gateway login", "POST", "/api/gateway/login",
    { username, password, clientId: "optrax-app" });
  await request("Gateway verify", "GET", "/api/gateway/verify", undefined, login.access_token);
  const refreshed = await request("Gateway refresh", "POST", "/api/gateway/refresh",
    { refresh_token: login.refresh_token, clientId: "optrax-app" });
  await request("Gateway logout", "POST", "/api/gateway/logout",
    { refresh_token: refreshed.refresh_token, clientId: "optrax-app" });
  console.log("Prueba integrada local completada.");
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
