import { randomInt } from "node:crypto";

/** Longitud mínima exigida en toda la app: alta de vendedor, reset admin y cambio propio (ADR 0003). */
export const MIN_PASSWORD_LENGTH = 8;

const TEMP_PASSWORD_LENGTH = 12;
// Sin caracteres ambiguos (0/O, 1/l/I): la contraseña temporal se entrega a mano al vendedor.
const TEMP_PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

/**
 * Contraseña temporal criptográficamente aleatoria para un vendedor recién creado,
 * usada cuando el admin no especifica una propia en el alta.
 */
export function generateTemporaryPassword(): string {
  return Array.from(
    { length: TEMP_PASSWORD_LENGTH },
    () => TEMP_PASSWORD_ALPHABET[randomInt(TEMP_PASSWORD_ALPHABET.length)]
  ).join("");
}
