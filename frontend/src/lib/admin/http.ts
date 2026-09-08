/**
 * Lee el mensaje de error de una respuesta de Route Handler admin. Contrato
 * de los handlers nuevos (spec Admin UI §3.2, gotcha explícito): `{ error,
 * details? }`, no `data.message` como el admin viejo.
 */
export async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const data: unknown = await response.json();
    if (data && typeof data === "object" && "error" in data) {
      const { error } = data as { error: unknown };
      if (typeof error === "string" && error.length > 0) return error;
    }
  } catch {
    // Respuesta sin body JSON (o no parseable): usamos el fallback.
  }
  return fallback;
}
