/**
 * Link de vendedor (Tanda B): `https://www.hyenafuel.com/?ref=JUAN10` (o cualquier
 * página de la tienda con `?ref=`). El código queda guardado en el navegador del
 * cliente y el carrito lo aplica solo, sin que tenga que escribir nada.
 *
 * - Vale por REFERRAL_TTL_DAYS desde el último click (el último link gana).
 * - Solo se guarda un formato válido; si el server lo ignora (código inexistente
 *   o inactivo) el carrito lo borra para no seguir mandándolo.
 * - Todo va en try/catch: sin localStorage (modo privado, bloqueo) simplemente no
 *   hay atribución automática, el cliente igual puede escribir el código.
 */

export const REFERRAL_QUERY_PARAM = "ref";
const STORAGE_KEY = "sellerRef";
const REFERRAL_TTL_DAYS = 30;
const REFERRAL_TTL_MS = REFERRAL_TTL_DAYS * 24 * 60 * 60 * 1000;

/** Mismo formato que `sellerCodeSchema` (letras y números), normalizado a mayúsculas. */
export function normalizeReferralCode(value) {
  if (typeof value !== "string") return null;
  const code = value.trim().toUpperCase();
  return /^[A-Z0-9]{1,32}$/.test(code) ? code : null;
}

export function saveReferral(code) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ code, savedAt: Date.now() }));
  } catch {
    // Sin storage disponible: no hay atribución automática.
  }
}

export function readReferral() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const { code, savedAt } = JSON.parse(raw);
    const normalized = normalizeReferralCode(code);
    if (!normalized || typeof savedAt !== "number" || Date.now() - savedAt > REFERRAL_TTL_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return normalized;
  } catch {
    return null;
  }
}

export function clearReferral() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nada que limpiar.
  }
}

/**
 * Lee `?ref=` de la URL actual: si es válido lo guarda y lo saca de la barra de
 * direcciones (la URL queda limpia para compartir y no duplica páginas). Devuelve
 * el código vigente (el nuevo o el que ya estaba guardado).
 */
export function captureReferralFromUrl() {
  if (typeof window === "undefined") return null;

  const url = new URL(window.location.href);
  const fromUrl = normalizeReferralCode(url.searchParams.get(REFERRAL_QUERY_PARAM));

  if (url.searchParams.has(REFERRAL_QUERY_PARAM)) {
    url.searchParams.delete(REFERRAL_QUERY_PARAM);
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  }

  if (fromUrl) {
    saveReferral(fromUrl);
    return fromUrl;
  }
  return readReferral();
}
