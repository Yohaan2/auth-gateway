import { useAuth } from "react-oidc-context";

const ADMIN_ROLE = import.meta.env.VITE_ADMIN_ROLE as string || "auth-manager-admin";
const VIEWER_ROLE = import.meta.env.VITE_VIEWER_ROLE as string || "auth-manager-viewer";

// Los realm_access.roles están en el access_token, no en el id_token (profile).
// Los decodificamos directamente del JWT del access token.
function decodeJwtPayload(token: string): Record<string, unknown> {
  try {
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(base64));
  } catch {
    return {};
  }
}

export function useRoles() {
  const { user } = useAuth();

  const accessPayload = user?.access_token ? decodeJwtPayload(user.access_token) : {};
  const realmAccess = (accessPayload?.realm_access ?? (user?.profile as any)?.realm_access) as
    | { roles: string[] }
    | undefined;
  const realmRoles: string[] = realmAccess?.roles ?? [];

  return {
    isAdmin: realmRoles.includes(ADMIN_ROLE),
    isViewer: realmRoles.includes(VIEWER_ROLE),
    hasAccess: realmRoles.includes(ADMIN_ROLE) || realmRoles.includes(VIEWER_ROLE),
    roles: realmRoles,
  };
}
