/**
 * Roles que vstation espera en Keycloak (ver vstation: server/jwtAuth.ts y shared/tabs.ts).
 *
 * - Rol de realm de acceso: solo deja entrar a vstation (sin él, el login se rechaza).
 * - Nivel de permisos: administrator / supervisor / operator como roles del cliente `vstation`
 *   (vstation también acepta los de realm). Sin ninguno, el usuario es Visualizador.
 * - Pestañas: roles tab-* del cliente `vstation`. Sin ninguno se ven todas; con alguno, solo esas.
 *
 * Los nombres deben coincidir exactamente con los que lee vstation.
 */
import { kcAdmin } from "../services/keycloak-admin.service";

export const VSTATION_CLIENT_ID = process.env.VSTATION_CLIENT_ID?.trim() || "vstation";
export const VSTATION_ACCESS_ROLE = process.env.VSTATION_ACCESS_ROLE?.trim() || "access-vstation";

export type PresetRole = { name: string; description: string; kind: "access" | "level" | "tab" };

export const VSTATION_REALM_ROLES: PresetRole[] = [
  { name: VSTATION_ACCESS_ROLE, description: "vstation: permite iniciar sesión (sin otro rol entra como Visualizador)", kind: "access" },
];

export const VSTATION_CLIENT_ROLES: PresetRole[] = [
  { name: "administrator", description: "vstation: Administrador (todo, incluidos Ajustes y Almacenamiento)", kind: "level" },
  { name: "supervisor", description: "vstation: Supervisor (edita cámaras y grupos, comparte videowalls)", kind: "level" },
  { name: "operator", description: "vstation: Operador (agrega, edita y elimina cámaras y grupos)", kind: "level" },
  { name: "tab-dashboard", description: "vstation: ver la pestaña Dashboard", kind: "tab" },
  { name: "tab-camaras", description: "vstation: ver la pestaña Cámaras", kind: "tab" },
  { name: "tab-mapa", description: "vstation: ver la pestaña Mapa", kind: "tab" },
  { name: "tab-grupos", description: "vstation: ver la pestaña Grupos", kind: "tab" },
  { name: "tab-videowall", description: "vstation: ver la pestaña Videowall", kind: "tab" },
  { name: "tab-ajustes", description: "vstation: ver la pestaña Ajustes (además requiere administrator)", kind: "tab" },
  { name: "tab-almacenamiento", description: "vstation: ver la pestaña Almacenamiento (además requiere administrator)", kind: "tab" },
];

export type PresetStatus = {
  clientId: string;
  /** UUID del cliente en Keycloak; null si el cliente no existe. */
  clientUuid: string | null;
  realmRoles: Array<PresetRole & { exists: boolean }>;
  clientRoles: Array<PresetRole & { exists: boolean }>;
  missing: number;
};

/** Qué roles del preset existen ya en Keycloak. Solo lectura. */
export async function getVstationPresetStatus(): Promise<PresetStatus> {
  const clients = await kcAdmin.listClients({ search: VSTATION_CLIENT_ID });
  const client = clients.find((c) => c.clientId === VSTATION_CLIENT_ID) ?? null;
  const realmNames = new Set((await kcAdmin.listRealmRoles()).map((r) => r.name));
  const clientNames = new Set(client ? (await kcAdmin.getClientRoles(client.id)).map((r) => r.name) : []);

  const realmRoles = VSTATION_REALM_ROLES.map((r) => ({ ...r, exists: realmNames.has(r.name) }));
  const clientRoles = VSTATION_CLIENT_ROLES.map((r) => ({ ...r, exists: clientNames.has(r.name) }));
  return {
    clientId: VSTATION_CLIENT_ID,
    clientUuid: client?.id ?? null,
    realmRoles,
    clientRoles,
    missing: [...realmRoles, ...clientRoles].filter((r) => !r.exists).length,
  };
}

/** Crea los roles del preset que falten. No modifica ni borra los existentes. */
export async function applyVstationPreset(): Promise<{ created: string[]; status: PresetStatus }> {
  const before = await getVstationPresetStatus();
  if (!before.clientUuid) {
    throw Object.assign(new Error(`No existe el cliente "${VSTATION_CLIENT_ID}" en Keycloak.`), { statusCode: 404 });
  }
  const created: string[] = [];
  for (const role of before.realmRoles.filter((r) => !r.exists)) {
    await kcAdmin.createRealmRole({ name: role.name, description: role.description });
    created.push(`realm:${role.name}`);
  }
  for (const role of before.clientRoles.filter((r) => !r.exists)) {
    await kcAdmin.createClientRole(before.clientUuid, { name: role.name, description: role.description });
    created.push(`${VSTATION_CLIENT_ID}:${role.name}`);
  }
  return { created, status: await getVstationPresetStatus() };
}
