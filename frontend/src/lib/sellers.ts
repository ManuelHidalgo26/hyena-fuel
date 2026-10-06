import { z } from "zod";
import { roundMoney } from "./money";
import { CANCELLED_ORDER_STATUS, PAYABLE_ORDER_STATUSES } from "./orders";

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

/** Fila mínima de `orders` para resumir las ventas de un vendedor. */
export type SellerOrderRow = {
  status: string;
  total_final: number | string;
  commission_total: number | string;
};

export type SellerSalesSummary = {
  ordersCount: number;
  totalRevenue: number;
  commissionAccumulated: number;
};

const PAYABLE_STATUSES: readonly string[] = PAYABLE_ORDER_STATUSES;

/**
 * Ventas = toda orden no cancelada; comisión acumulada = solo la de órdenes ya "ganadas"
 * (ADR 0002 #5). Compartido entre el portal del vendedor (`/api/seller/me`, `/panel/vendedor`)
 * y el listado admin (`/panel/vendedores`) para que ambos muestren el mismo número.
 */
export function summarizeSellerOrders(orders: SellerOrderRow[]): SellerSalesSummary {
  const summary = orders.reduce(
    (acc, order) => {
      if (order.status === CANCELLED_ORDER_STATUS) return acc;

      acc.ordersCount += 1;
      acc.totalRevenue += Number(order.total_final);
      if (PAYABLE_STATUSES.includes(order.status)) {
        acc.commissionAccumulated += Number(order.commission_total);
      }
      return acc;
    },
    { ordersCount: 0, totalRevenue: 0, commissionAccumulated: 0 }
  );

  return {
    ordersCount: summary.ordersCount,
    totalRevenue: roundMoney(summary.totalRevenue),
    commissionAccumulated: roundMoney(summary.commissionAccumulated),
  };
}
