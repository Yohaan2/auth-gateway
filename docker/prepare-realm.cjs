const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");

const root = path.resolve(__dirname, "..");
const input = path.resolve(process.argv[2] || path.join(root, ".env"));
const config = dotenv.parse(fs.readFileSync(input));
const template = JSON.parse(fs.readFileSync(path.join(__dirname, "keycloak-realm-export.json"), "utf8"));

const clients = [
  ["optrax-app", "KEYCLOAK_CLIENT_SECRET"],
  ["auth-manager-sa", "KEYCLOAK_SA_CLIENT_SECRET"],
];
for (const [clientId, variable] of clients) {
  const client = template.clients.find((item) => item.clientId === clientId);
  const secret = config[variable];
  if (!client || !secret || secret.length < 32) {
    throw new Error(`Falta ${variable} (minimo 32 caracteres) o el cliente ${clientId} en el template.`);
  }
  client.secret = secret;
}

if (config.KEYCLOAK_CLIENT_ID !== "optrax-app" || config.KEYCLOAK_SA_CLIENT_ID !== "auth-manager-sa") {
  throw new Error("Los client IDs de .env no coinciden con el export del realm.");
}

const frontend = template.clients.find((item) => item.clientId === "optrax-frontend");
const origin = new URL(config.APP_URL).origin;
if (!frontend) throw new Error("Falta el cliente optrax-frontend en el template.");
frontend.redirectUris = [`${origin}/*`];
frontend.webOrigins = [origin];
frontend.baseUrl = origin;
frontend.adminUrl = origin;

const target = path.resolve(process.argv[3] || path.join(__dirname, "generated"));
fs.mkdirSync(target, { recursive: true });
const output = path.join(target, "realm.json");
fs.writeFileSync(output, JSON.stringify(template, null, 2), { mode: 0o600 });
fs.chmodSync(output, 0o600);
console.log("Realm generado en directorio no versionado.");
