const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * `true` si `value` tiene formato de UUID (no valida versión/variant).
 * Se usa para distinguir `slug` de `id` en rutas `[key]` y para devolver 400
 * en vez de dejar que Postgres tire un error de sintaxis por un id malformado.
 */
export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}
