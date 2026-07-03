import type { AuthProviderProps } from "react-oidc-context";
import { WebStorageStateStore } from "oidc-client-ts";

const KC_URL = import.meta.env.VITE_KEYCLOAK_URL as string;
const KC_REALM = import.meta.env.VITE_KEYCLOAK_REALM as string;
const KC_CLIENT_ID = import.meta.env.VITE_KEYCLOAK_CLIENT_ID as string;

export const oidcConfig: AuthProviderProps = {
  authority: `${KC_URL}/realms/${KC_REALM}`,
  client_id: KC_CLIENT_ID,
  redirect_uri: window.location.origin,
  post_logout_redirect_uri: window.location.origin,
  scope: "openid profile email",
  automaticSilentRenew: true,
  // Usar sessionStorage (se limpia al cerrar la pestaña)
  userStore: new WebStorageStateStore({ store: window.sessionStorage }),
  onSigninCallback: () => {
    window.history.replaceState({}, document.title, window.location.pathname);
  },
};
