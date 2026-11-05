const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");

const env = dotenv.parse(fs.readFileSync(path.join(__dirname, "local", ".env")));
const base = "http://localhost:19080/auth";
const realm = env.KEYCLOAK_REALM;

async function api(label, url, options = {}, expected = 200) {
  const response = await fetch(url, options);
  if (response.status !== expected) {
    throw new Error(`${label}: HTTP ${response.status} (esperado ${expected}).`);
  }
  return response;
}

async function main() {
  const tokenResponse = await api("Admin master", `${base}/realms/master/protocol/openid-connect/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "password",
      client_id: "admin-cli",
      username: env.KC_BOOTSTRAP_ADMIN_USERNAME,
      password: env.KC_BOOTSTRAP_ADMIN_PASSWORD,
    }),
  });
  const { access_token } = await tokenResponse.json();
  const headers = { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" };

  // Los exports anteriores no incluian el scope basic: sin el claim sub
  // el backend rechaza incluso un token firmado y con rol valido.
  const scopesResponse = await api("Listar scopes", `${base}/admin/realms/${realm}/client-scopes`, { headers });
  const scopes = await scopesResponse.json();
  let basic = scopes.find((scope) => scope.name === "basic");
  if (!basic) {
    const template = require("./keycloak-realm-export.json");
    const basicTemplate = template.clientScopes.find((scope) => scope.name === "basic");
    await api("Crear scope basic", `${base}/admin/realms/${realm}/client-scopes`, {
      method: "POST", headers, body: JSON.stringify(basicTemplate),
    }, 201);
    const updated = await (await api("Consultar scope basic", `${base}/admin/realms/${realm}/client-scopes`, { headers })).json();
    basic = updated.find((scope) => scope.name === "basic");
  }
  if (!basic) throw new Error("No se pudo crear el scope basic de Keycloak.");

  for (const clientId of ["optrax-frontend", "optrax-app", "auth-manager-sa"]) {
    const clients = await (await api("Buscar cliente", `${base}/admin/realms/${realm}/clients?clientId=${clientId}`, { headers })).json();
    const client = clients.find((item) => item.clientId === clientId);
    if (!client) throw new Error(`Falta el cliente ${clientId}.`);
    const defaults = await (await api("Scopes del cliente", `${base}/admin/realms/${realm}/clients/${client.id}/default-client-scopes`, { headers })).json();
    if (!defaults.some((scope) => scope.id === basic.id)) {
      await api("Asignar scope basic", `${base}/admin/realms/${realm}/clients/${client.id}/default-client-scopes/${basic.id}`, {
        method: "PUT", headers,
      }, 204);
    }
    if (clientId === "optrax-frontend" && client.baseUrl !== "http://localhost:19080") {
      await api("Actualizar URL del frontend", `${base}/admin/realms/${realm}/clients/${client.id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ ...client, baseUrl: "http://localhost:19080", adminUrl: "http://localhost:19080" }),
      }, 204);
    }
  }

  const usersResponse = await api("Buscar usuario", `${base}/admin/realms/${realm}/users?username=${encodeURIComponent(env.LOCAL_PANEL_USERNAME)}&exact=true`, { headers });
  const existing = (await usersResponse.json()).find((user) => user.username === env.LOCAL_PANEL_USERNAME);
  let userId = existing?.id;
  if (existing) {
    await api("Completar perfil local", `${base}/admin/realms/${realm}/users/${userId}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        ...existing,
        email: "admin-local@localhost.test",
        firstName: "Admin",
        lastName: "Local",
        emailVerified: true,
        requiredActions: [],
      }),
    }, 204);
  } else {
    const created = await api("Crear usuario local", `${base}/admin/realms/${realm}/users`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        username: env.LOCAL_PANEL_USERNAME,
        email: "admin-local@localhost.test",
        firstName: "Admin",
        lastName: "Local",
        enabled: true,
        emailVerified: true,
        requiredActions: [],
        credentials: [{ type: "password", value: env.LOCAL_PANEL_PASSWORD, temporary: false }],
      }),
    }, 201);
    userId = created.headers.get("location")?.split("/").pop();
  }
  if (!userId) throw new Error("Keycloak no devolvio el ID del nuevo usuario.");

  const roleResponse = await api("Buscar rol", `${base}/admin/realms/${realm}/roles/SUPER_ADMIN`, { headers });
  const role = await roleResponse.json();
  await api("Asignar SUPER_ADMIN", `${base}/admin/realms/${realm}/users/${userId}/role-mappings/realm`, {
    method: "POST",
    headers,
    body: JSON.stringify([role]),
  }, 204);
  console.log("Usuario local del panel listo; credenciales guardadas en docker/local/.env.");
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
