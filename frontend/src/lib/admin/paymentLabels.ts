import type { PaymentStatus, ReviewReason } from "../orders";

/** Tonos del badge del panel (`AdminBadgeTone`); se repite el literal para no importar un componente desde lib. */
export type PaymentBadgeTone = "neutral" | "info" | "success" | "warning" | "danger";

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  pending: "Esperando pago",
  in_process: "Procesando",
  in_mediation: "En disputa",
  approved: "Pagado",
  rejected: "Rechazado",
  cancelled: "Cancelado",
  refunded: "Revertido",
  charged_back: "Contracargo",
};

export const PAYMENT_STATUS_TONE: Record<PaymentStatus, PaymentBadgeTone> = {
  pending: "neutral",
  in_process: "info",
  in_mediation: "warning",
  approved: "success",
  rejected: "danger",
  cancelled: "neutral",
  refunded: "warning",
  charged_back: "danger",
};

/** Texto largo de "Para revisar": qué pasó y qué hacer (va en una línea visible bajo el badge). */
export const REVIEW_REASON_LABEL: Record<ReviewReason, string> = {
  sin_stock: "Pago aprobado, pero no había stock al acreditarse. Revisá el stock y coordiná con el cliente.",
  monto_distinto: "El monto pagado no coincide con el pedido. Verificalo en Mercado Pago.",
  pago_duplicado: "Entró un segundo pago aprobado. Revisalo en Mercado Pago.",
  pago_en_pedido_cancelado: "Se aprobó un pago de un pedido cancelado. Revisalo en Mercado Pago.",
  pago_refunded: "El cobro fue revertido en Mercado Pago.",
  pago_charged_back: "Contracargo registrado en Mercado Pago.",
  pago_in_mediation: "Pago en disputa en Mercado Pago.",
  pago_cancelled: "Pago cancelado en Mercado Pago.",
};
