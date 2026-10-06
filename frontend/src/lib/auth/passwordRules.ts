import { z } from "zod";

/**
 * Reglas de contraseña compartidas entre server (Route Handlers) y client (forms del panel).
 * Viven aparte de `password.ts` porque ese módulo importa `node:crypto` y no puede ir al bundle
 * del navegador.
 */

/** Longitud mínima exigida en toda la app: alta de vendedor, reset admin y cambio propio (ADR 0003). */
export const MIN_PASSWORD_LENGTH = 8;
/** Supabase Auth (bcrypt) ignora todo lo que pase de 72 bytes: se rechaza antes para no dar una falsa sensación de seguridad. */
export const MAX_PASSWORD_LENGTH = 72;

export const PASSWORD_LENGTH_MESSAGE = `La contraseña debe tener entre ${MIN_PASSWORD_LENGTH} y ${MAX_PASSWORD_LENGTH} caracteres`;

export const passwordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH, PASSWORD_LENGTH_MESSAGE)
  .max(MAX_PASSWORD_LENGTH, PASSWORD_LENGTH_MESSAGE);

/** Validación client-side equivalente a `passwordSchema` (sin arrastrar zod al form). */
export function isValidPasswordLength(password: string): boolean {
  return password.length >= MIN_PASSWORD_LENGTH && password.length <= MAX_PASSWORD_LENGTH;
}
