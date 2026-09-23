import { revalidatePath } from "next/cache";

/**
 * Invalida toda la tienda pública (ADR 0009 D4): home, todas las PDP
 * (incluidos los 404 cacheados), `/about`, `/como-comprar` y el sitemap.
 *
 * Se invalida por el layout del route group `(store)` y no por
 * `revalidatePath("/producto/[slug]", "page")`: ese path, sin el grupo, no
 * matchea ningún tag implícito en Next 16.1.5 y no hace nada en silencio
 * (bug latente de la spec de Sesión 23, corregido acá).
 *
 * NUNCA tira errores: es un efecto secundario de una escritura que ya
 * llegó a la DB. Nunca puede convertir un 2xx en un 500 (crítico en el
 * checkout: un 500 después de persistir invitaría a reintentar y duplicar
 * el pedido).
 */
export function revalidateStorefront(reason: string): void {
  try {
    revalidatePath("/(store)", "layout");
    revalidatePath("/");
    revalidatePath("/sitemap.xml");
  } catch (error) {
    console.error(`[revalidateStorefront] ${reason}`, error);
  }
}
