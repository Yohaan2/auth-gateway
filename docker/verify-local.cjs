const fs = require("node:fs");
const path = require("node:path");
const { createHash, randomBytes } = require("node:crypto");
const dotenv = require("dotenv");

const env = dotenv.parse(fs.readFileSync(path.join(__dirname, "local", ".env")));
const base = "http://localhost:19080";

async function check(label, url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`${label}: HTTP ${response.status}`);
  console.log(`${label}: HTTP ${response.status}`);
  return response;
}

async function main() {
  await check("App + PostgreSQL", `${base}/api/health`);
  const discovery = await (await check("OIDC discovery", `${base}/auth/realms/optrax-realm/.well-known/openid-configuration`)).json();
  if (discovery.issuer !== `${base}/auth/realms/optrax-realm`) throw new Error("Issuer incorrecto");

  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const authorizationUrl = new URL(discovery.authorization_endpoint);
  authorizationUrl.search = new URLSearchParams({
    client_id: "optrax-frontend",
    response_type: "code",
    scope: "openid profile email",
    redirect_uri: base,
    code_challenge_method: "S256",
    code_challenge: challenge,
    state: randomBytes(16).toString("hex"),
    nonce: randomBytes(16).toString("hex"),
  }).toString();
  const loginPage = await check("Redirect URI del navegador", authorizationUrl);
  if ((await loginPage.text()).includes("Invalid parameter: redirect_uri")) {
    throw new Error("Keycloak rechazo la URL de retorno local");
  }

  const login = await check("Credenciales del usuario local", discovery.token_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "password",
      client_id: "optrax-frontend",
      username: env.LOCAL_PANEL_USERNAME,
      password: env.LOCAL_PANEL_PASSWORD,
    }),
  });
  const { access_token } = await login.json();
  const auth = { Authorization: `Bearer ${access_token}` };
  const profile = await (await check("Perfil del panel", `${base}/api/iam/me`, { headers: auth })).json();
  if (!profile.roles.includes("SUPER_ADMIN")) throw new Error("El rol SUPER_ADMIN no se asigno al usuario");
  await check("Dashboard + Keycloak Admin API", `${base}/api/admin/dashboard`, { headers: auth });
  console.log("Validacion local correcta. Abrir http://localhost:19080/");
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
