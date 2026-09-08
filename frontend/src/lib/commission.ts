import { roundMoney } from "./money";

export type CommissionInputs = {
  /** Precio lista del producto: la comisión siempre se calcula sobre este valor, nunca sobre transferPrice. */
  unitPrice: number;
  sellerDefaultCommissionPct: number;
  overrideCommissionPct: number | null;
  overrideCommissionAmount: number | null;
};

/**
 * Comisión por unidad de un ítem de orden (ADR 0002 #3).
 * Precedencia: monto fijo (`commission_override_amount`) > porcentaje (`commission_override_pct`)
 * > porcentaje por defecto del vendedor (`sellers.default_commission_pct`).
 */
export function calculateUnitCommission({
  unitPrice,
  sellerDefaultCommissionPct,
  overrideCommissionPct,
  overrideCommissionAmount,
}: CommissionInputs): number {
  if (overrideCommissionAmount !== null) {
    return roundMoney(overrideCommissionAmount);
  }

  const pct = overrideCommissionPct !== null ? overrideCommissionPct : sellerDefaultCommissionPct;
  return roundMoney((unitPrice * pct) / 100);
}
