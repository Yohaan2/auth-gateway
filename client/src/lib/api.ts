/**
 * Cliente HTTP ligero basado en fetch para interactuar con la API backend.
 * Incluye por defecto las credenciales (cookies de sesión).
 */
export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  
  const defaultHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    "Accept": "application/json",
  };

  const config: RequestInit = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
    // Esencial para transmitir las cookies de sesión con express-session
    credentials: "include",
  };

  try {
    const response = await fetch(url, config);

    // Si la respuesta no es exitosa, arrojar error descriptivo
    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = { message: "Ha ocurrido un error en la comunicación con el servidor." };
      }
      
      const error = new Error(errorData.error?.message || errorData.message || `HTTP ${response.status}`);
      (error as any).statusCode = response.status;
      (error as any).details = errorData.error?.details || errorData;
      throw error;
    }

    // Para endpoints sin contenido, retornar vacío
    if (response.status === 204) {
      return {} as T;
    }

    return await response.json() as T;
  } catch (error: any) {
    console.error(`❌ Error en llamada API (${url}):`, error);
    throw error;
  }
}
