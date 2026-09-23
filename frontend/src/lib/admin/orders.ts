/**
 * Shape/mapper de órdenes para el panel admin, usado por el Server Component
 * de `/panel/pedidos` (lectura directa vía cliente SSR, spec Admin UI §3.2) y
 * por `GET /api/orders` (`api/orders/route.ts`), que reexporta estas mismas
 * columnas/mapper en vez de duplicarlas (deuda D2-1).
 */

/** Enum exacto de `orders.status`/`payment_method`/`delivery_method` (ADR 0002, `check` constraints en 0001_init.sql). */
export type OrderStatus = "pending" | "confirmed" | "dispatched" | "paid" | "cancelled";
export type OrderPaymentMethod = "transferencia" | "mercadopago";
export type OrderDeliveryMethod = "envio" | "retiro";

export type AdminOrderItem = {
  productId: string | null;
  name: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  unitCommission: number;
  flavor: string | null;
};

export type AdminOrder = {
  _id: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  customerAddress: string | null;
  paymentMethod: OrderPaymentMethod;
  deliveryMethod: OrderDeliveryMethod;
  status: OrderStatus;
  subtotal: number;
  discount: number;
  shippingCost: number;
  totalFinal: number;
  sellerId: string | null;
  attributionSource: string | null;
  commissionTotal: number;
  discountCode: string | null;
  discountCodeAmount: number;
  /** Nota libre del comprador (ADR 0006), lectura admin-only — `null` si no dejó nada. */
  note: string | null;
  createdAt: string;
  items: AdminOrderItem[];
};

type AdminOrderItemRow = {
  id: string;
  product_id: string | null;
  name: string;
  quantity: number;
  unit_price: number | string;
  unit_cost: number | string;
  unit_commission: number | string;
  flavor: string | null;
};

export type AdminOrderRow = {
  id: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  payment_method: string;
  delivery_method: string;
  status: string;
  subtotal: number | string;
  discount: number | string;
  shipping_cost: number | string;
  total_final: number | string;
  seller_id: string | null;
  attribution_source: string | null;
  commission_total: number | string;
  discount_code: string | null;
  discount_code_amount: number | string;
  note: string | null;
  created_at: string;
  order_items: AdminOrderItemRow[];
};

/** Columnas de `orders` + `order_items` embebidos, fuente única para el panel admin y `GET /api/orders`. */
export const ADMIN_ORDER_COLUMNS =
  "id, customer_name, customer_email, customer_phone, customer_address, payment_method, delivery_method, status, subtotal, discount, shipping_cost, total_final, seller_id, attribution_source, commission_total, discount_code, discount_code_amount, note, created_at, order_items(id, product_id, name, quantity, unit_price, unit_cost, unit_commission, flavor)";

/** Las columnas de texto vienen validadas por `check` constraints en Postgres (ver 0001_init.sql). */
function toOrderStatus(value: string): OrderStatus {
  return value as OrderStatus;
}

function toPaymentMethod(value: string): OrderPaymentMethod {
  return value as OrderPaymentMethod;
}

function toDeliveryMethod(value: string): OrderDeliveryMethod {
  return value as OrderDeliveryMethod;
}

export function mapAdminOrder(row: AdminOrderRow): AdminOrder {
  return {
    _id: row.id,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    customerPhone: row.customer_phone,
    customerAddress: row.customer_address,
    paymentMethod: toPaymentMethod(row.payment_method),
    deliveryMethod: toDeliveryMethod(row.delivery_method),
    status: toOrderStatus(row.status),
    subtotal: Number(row.subtotal),
    discount: Number(row.discount),
    shippingCost: Number(row.shipping_cost),
    totalFinal: Number(row.total_final),
    sellerId: row.seller_id,
    attributionSource: row.attribution_source,
    commissionTotal: Number(row.commission_total),
    discountCode: row.discount_code,
    discountCodeAmount: Number(row.discount_code_amount),
    note: row.note,
    createdAt: row.created_at,
    items: row.order_items.map((item) => ({
      productId: item.product_id,
      name: item.name,
      quantity: item.quantity,
      unitPrice: Number(item.unit_price),
      unitCost: Number(item.unit_cost),
      unitCommission: Number(item.unit_commission),
      flavor: item.flavor,
    })),
  };
}
