import { z } from "zod";

/** Fila cruda de `sellers` (ADR 0002). No incluye el email: vive en `auth.users`. */
export type SellerRow = {
  id: string;
  code: string;
  name: string;
  phone: string | null;
  default_commission_pct: number | string;
  active: boolean;
  created_at: string;
};

export type Seller = {
  id: string;
  code: string;
  name: string;
  phone: string | null;
  defaultCommissionPct: number;
  active: boolean;
  createdAt: string;
};

export const SELLER_COLUMNS = "id, code, name, phone, default_commission_pct, active, created_at";

export function mapSeller(row: SellerRow): Seller {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    phone: row.phone,
    defaultCommissionPct: Number(row.default_commission_pct),
    active: row.active,
    createdAt: row.created_at,
  };
}

/**
 * Código de vendedor (ej. "JUAN10"): solo letras/números, normalizado a mayúsculas para que
 * dos altas no terminen en códigos que solo difieren en capitalización. Compartido entre el
 * alta (`POST /api/admin/sellers`) y la edición (`PATCH /api/admin/sellers/[id]`).
 */
export const sellerCodeSchema = z
  .string()
  .trim()
  .min(1, "Falta el código")
  .regex(/^[A-Za-z0-9]+$/, "El código solo admite letras y números")
  .transform((value) => value.toUpperCase());
