import { randomInt } from "node:crypto";

export { MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH, passwordSchema } from "./passwordRules";

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
