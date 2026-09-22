import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Tipo de descuento de un código (ADR 0010, decisión cerrada #1: un código es de UN tipo). */
export type DiscountCodeType = "pct" | "fixed";

export type DiscountCodeRow = {
  id: string;
  code: string;
  type: DiscountCodeType;
  value: number | string;
  max_uses: number | null;
  uses_count: number;
  min_purchase: number | string | null;
  starts_at: string | null;
  expires_at: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type DiscountCode = {
  id: string;
  code: string;
  type: DiscountCodeType;
  value: number;
  maxUses: number | null;
  usesCount: number;
  minPurchase: number | null;
  startsAt: string | null;
  expiresAt: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export const DISCOUNT_CODE_COLUMNS =
  "id, code, type, value, max_uses, uses_count, min_purchase, starts_at, expires_at, active, created_at, updated_at";

export function mapDiscountCode(row: DiscountCodeRow): DiscountCode {
  return {
    id: row.id,
    code: row.code,
    type: row.type,
    value: Number(row.value),
    maxUses: row.max_uses,
    usesCount: row.uses_count,
    minPurchase: row.min_purchase === null ? null : Number(row.min_purchase),
    startsAt: row.starts_at,
    expiresAt: row.expires_at,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Formato del código (ADR 0010 D7 — lo escribe el admin, memorable para redes): mayúsculas,
 * alfanumérico con guiones, 3 a 32 caracteres. Compartido por el alta y la edición admin.
 */
export const discountCodeFormatSchema = z
  .string()
  .trim()
  .min(1, "Falta el código")
  .transform((value) => value.toUpperCase())
  .pipe(
    z
      .string()
      .regex(
        /^[A-Z0-9][A-Z0-9-]{2,31}$/,
        "El código debe tener entre 3 y 32 caracteres: letras, números o guiones"
      )
  );

export type DiscountCodeStatus = "desactivado" | "vencido" | "agotado" | "programado" | "activo";

/**
 * Estado mostrado en el admin, DERIVADO de los datos (spec §7.1) — no depende de pg_cron
 * (defensa secundaria opcional, ADR 0010 decisión 10): un código vencido/agotado se ve así
 * aunque el cron nunca haya corrido. Precedencia: Desactivado > Vencido > Agotado >
 * Programado > Activo.
 */
export function deriveDiscountCodeStatus(code: DiscountCode, now: Date = new Date()): DiscountCodeStatus {
  if (!code.active) return "desactivado";
  if (code.expiresAt !== null && now >= new Date(code.expiresAt)) return "vencido";
  if (code.maxUses !== null && code.usesCount >= code.maxUses) return "agotado";
  if (code.startsAt !== null && now < new Date(code.startsAt)) return "programado";
  return "activo";
}

/** Usos restantes; `null` = ilimitado (`max_uses` no seteado). */
export function remainingDiscountCodeUses(code: DiscountCode): number | null {
  return code.maxUses === null ? null : Math.max(0, code.maxUses - code.usesCount);
}

/** Cupón ya validado, listo para tarifar (`calculatePricingBreakdown`/`calculateOrderTotals`) y canjear. */
export type ResolvedDiscountCode = {
  id: string;
  code: string;
  type: DiscountCodeType;
  value: number;
};

export type DiscountCodeResolution =
  | { ok: true; coupon: ResolvedDiscountCode }
  | { ok: false; reason: string };

type ResolveRow = Omit<DiscountCodeRow, "created_at" | "updated_at">;

const RESOLVE_COLUMNS =
  "id, code, type, value, max_uses, uses_count, min_purchase, starts_at, expires_at, active";

// Copy en positivo (spec §6.3): nunca distinguir más de lo necesario entre "no existe",
// "vencido" o "desactivado" — todos caen en el mismo mensaje genérico salvo lo útil para
// UX (sin usos, no disponible todavía, compra mínima — spec §5.1/D5).
const GENERIC_INVALID_REASON = "Ese código no es válido";
const NO_USES_LEFT_REASON = "Este código ya no tiene usos disponibles";
const NOT_AVAILABLE_YET_REASON = "Este código no está disponible por ahora";

/**
 * Resuelve y valida un código (ADR 0010 §4.2 / spec §4.2): existe, activo, dentro de
 * ventana, con usos disponibles y compra mínima alcanzada (`subtotal` a precio de lista,
 * D2). Reutilizado por `POST /api/discount-codes/validate` (previsualización) y por
 * `createOrder()` (canje real) — el monto lo calcula el caller
 * (`calculatePricingBreakdown`/`calculateOrderTotals`), esta función solo valida y
 * devuelve `{id, code, type, value}`. El guard atómico de la RPC `create_order` sigue
 * siendo la autoridad final de concurrencia: esto es una validación "amigable" con
 * mensajes legibles, no lo reemplaza.
 */
export async function resolveDiscountCode(
  supabase: SupabaseClient,
  rawCode: string,
  subtotal: number
): Promise<DiscountCodeResolution> {
  const code = rawCode.trim();
  if (code.length === 0) return { ok: false, reason: GENERIC_INVALID_REASON };

  const { data, error } = await supabase
    .from("discount_codes")
    .select(RESOLVE_COLUMNS)
    .eq("code", code)
    .maybeSingle()
    .returns<ResolveRow | null>();

  if (error) {
    console.error("[resolveDiscountCode]", error);
    return { ok: false, reason: GENERIC_INVALID_REASON };
  }
  if (!data || !data.active) {
    return { ok: false, reason: GENERIC_INVALID_REASON };
  }

  const now = new Date();
  if (data.starts_at !== null && now < new Date(data.starts_at)) {
    return { ok: false, reason: NOT_AVAILABLE_YET_REASON };
  }
  if (data.expires_at !== null && now >= new Date(data.expires_at)) {
    return { ok: false, reason: NOT_AVAILABLE_YET_REASON };
  }
  if (data.max_uses !== null && data.uses_count >= data.max_uses) {
    return { ok: false, reason: NO_USES_LEFT_REASON };
  }

  const minPurchase = data.min_purchase === null ? null : Number(data.min_purchase);
  if (minPurchase !== null && subtotal < minPurchase) {
    return { ok: false, reason: `Válido en compras desde $${formatArs(minPurchase)}` };
  }

  return {
    ok: true,
    coupon: { id: data.id, code: data.code, type: data.type, value: Number(data.value) },
  };
}

function formatArs(amount: number): string {
  return Math.round(amount).toLocaleString("es-AR");
}
