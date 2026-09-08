import type { HTMLAttributes, ReactNode } from "react";
import styles from "./admin.module.css";

export type AdminBadgeTone = "neutral" | "info" | "accent" | "success" | "warning" | "danger";
export type AdminBadgeVariant = "solid" | "outline";

const TONE_CLASS: Record<AdminBadgeTone, string> = {
  neutral: styles.toneNeutral,
  info: styles.toneInfo,
  accent: styles.toneAccent,
  success: styles.toneSuccess,
  warning: styles.toneWarning,
  danger: styles.toneDanger,
};

export type AdminBadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone: AdminBadgeTone;
  /** `solid` (fondo tintado, para el dato principal) o `outline` (borde, para metadata secundaria). @default "solid" */
  variant?: AdminBadgeVariant;
  children: ReactNode;
};

/** Pill de estado genérico. Base de OrderStatusBadge/PaymentMethodBadge/DeliveryMethodBadge de abajo. */
export function AdminBadge({ tone, variant = "solid", className, children, ...rest }: AdminBadgeProps) {
  const classes = [styles.badge, TONE_CLASS[tone], variant === "outline" ? styles.badgeOutline : "", className]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={classes} {...rest}>
      {children}
    </span>
  );
}

/** Enum exacto de `orders.status` (ADR 0002). No re-litigar el enum acá. */
export type OrderStatus = "pending" | "confirmed" | "dispatched" | "paid" | "cancelled";

const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Pendiente",
  confirmed: "Confirmado",
  dispatched: "Despachado",
  paid: "Pagado",
  cancelled: "Cancelado",
};

const ORDER_STATUS_TONE: Record<OrderStatus, AdminBadgeTone> = {
  pending: "neutral",
  confirmed: "info",
  dispatched: "accent",
  paid: "success",
  cancelled: "danger",
};

/** Badge de estado de pedido. Mismo tono en toda la app: no recolorear a mano en otro lado. */
export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <AdminBadge tone={ORDER_STATUS_TONE[status]}>{ORDER_STATUS_LABEL[status]}</AdminBadge>;
}

export type PaymentMethod = "transferencia" | "mercadopago";

const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  transferencia: "Transferencia",
  mercadopago: "Tarjeta / efectivo",
};

const PAYMENT_METHOD_TONE: Record<PaymentMethod, AdminBadgeTone> = {
  transferencia: "success",
  mercadopago: "info",
};

/** Badge secundario (outline) para `orders.paymentMethod`. */
export function PaymentMethodBadge({ method }: { method: PaymentMethod }) {
  return (
    <AdminBadge tone={PAYMENT_METHOD_TONE[method]} variant="outline">
      {PAYMENT_METHOD_LABEL[method]}
    </AdminBadge>
  );
}

export type DeliveryMethod = "envio" | "retiro";

const DELIVERY_METHOD_LABEL: Record<DeliveryMethod, string> = {
  envio: "Envío",
  retiro: "Retiro en local",
};

const DELIVERY_METHOD_TONE: Record<DeliveryMethod, AdminBadgeTone> = {
  envio: "neutral",
  retiro: "warning",
};

/** Badge secundario (outline) para `orders.deliveryMethod`. */
export function DeliveryMethodBadge({ method }: { method: DeliveryMethod }) {
  return (
    <AdminBadge tone={DELIVERY_METHOD_TONE[method]} variant="outline">
      {DELIVERY_METHOD_LABEL[method]}
    </AdminBadge>
  );
}
