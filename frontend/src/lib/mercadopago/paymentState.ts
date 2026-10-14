import type { PaymentStatus } from "../orders";

/** Estado del pago que ve el comprador en `/compra/resultado` (sin datos personales). */
export type PublicPaymentState = "approved" | "processing" | "failed" | "pending";

const PUBLIC_STATE_BY_PAYMENT_STATUS: Record<PaymentStatus, PublicPaymentState> = {
  approved: "approved",
  in_process: "processing",
  in_mediation: "processing",
  pending: "pending",
  rejected: "failed",
  cancelled: "failed",
  refunded: "failed",
  charged_back: "failed",
};

export function toPublicPaymentState(status: PaymentStatus): PublicPaymentState {
  return PUBLIC_STATE_BY_PAYMENT_STATUS[status];
}
