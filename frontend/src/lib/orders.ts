import { calculateUnitCommission } from "./commission";
import { roundMoney } from "./money";

/** Envío gratis a partir de este subtotal a pagar; si no, cuesta $5000 (retiro en persona siempre es gratis). */
export const FREE_SHIPPING_THRESHOLD = 160000;
export const SHIPPING_COST = 5000;

export type PaymentMethod = "transferencia" | "mercadopago";
export type DeliveryMethod = "envio" | "retiro";

/**
 * Estados en los que una orden "gana" comisión de verdad (ADR 0002 #5): `commission_total`
 * se congela al crear la orden, pero solo es pagable/acumulable a partir de `confirmed`.
 * `pending` todavía no se confirmó y `cancelled` se excluye siempre de liquidaciones.
 */
export const PAYABLE_ORDER_STATUSES = ["confirmed", "dispatched", "paid"] as const;

/** Único estado que se excluye de "ventas" del vendedor: un pedido cancelado no fue una venta. */
export const CANCELLED_ORDER_STATUS = "cancelled";

export type OrderLineItem = {
  productId: string;
  quantity: number;
};

/** Datos del producto necesarios para congelar un ítem y calcular totales. */
export type OrderProductInput = {
  id: string;
  name: string;
  price: number;
  transferPrice: number | null;
  cost: number;
  commissionOverridePct: number | null;
  commissionOverrideAmount: number | null;
};

export type OrderSellerInput = {
  id: string;
  defaultCommissionPct: number;
};

export type FrozenOrderItem = {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  unitCommission: number;
};

export type OrderTotals = {
  subtotal: number;
  discount: number;
  shippingCost: number;
  totalFinal: number;
  commissionTotal: number;
};

/** Suma cantidades repetidas del mismo producto (protege ante payloads manuales con líneas duplicadas). */
export function mergeLineItemsByProduct(items: OrderLineItem[]): OrderLineItem[] {
  const quantityByProduct = new Map<string, number>();

  for (const item of items) {
    quantityByProduct.set(
      item.productId,
      (quantityByProduct.get(item.productId) ?? 0) + item.quantity
    );
  }

  return Array.from(quantityByProduct, ([productId, quantity]) => ({ productId, quantity }));
}

/**
 * Congela `name`, `unit_price`, `unit_cost` y `unit_commission` por ítem (ADR 0002 #2).
 * Asume que `items` ya fue validado contra stock/existencia/activo.
 */
export function freezeOrderItems(
  items: OrderLineItem[],
  productsById: Map<string, OrderProductInput>,
  seller: OrderSellerInput | null
): FrozenOrderItem[] {
  return items.map(({ productId, quantity }) => {
    const product = productsById.get(productId);
    if (!product) {
      throw new Error(`Producto ${productId} no encontrado al congelar el ítem`);
    }

    const unitPrice = roundMoney(product.price);
    const unitCommission = seller
      ? calculateUnitCommission({
          unitPrice,
          sellerDefaultCommissionPct: seller.defaultCommissionPct,
          overrideCommissionPct: product.commissionOverridePct,
          overrideCommissionAmount: product.commissionOverrideAmount,
        })
      : 0;

    return {
      productId,
      name: product.name,
      quantity,
      unitPrice,
      unitCost: roundMoney(product.cost),
      unitCommission,
    };
  });
}

/** Totales de la orden: subtotal, descuento por transferencia, envío y total final (ADR 0002). */
export function calculateOrderTotals(
  frozenItems: FrozenOrderItem[],
  productsById: Map<string, OrderProductInput>,
  paymentMethod: PaymentMethod,
  deliveryMethod: DeliveryMethod
): OrderTotals {
  const subtotal = roundMoney(
    frozenItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
  );

  const discount = roundMoney(
    paymentMethod === "transferencia" ? sumTransferDiscount(frozenItems, productsById) : 0
  );

  const payableSubtotal = subtotal - discount;
  const shippingCost =
    deliveryMethod === "retiro" || payableSubtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_COST;

  const commissionTotal = roundMoney(
    frozenItems.reduce((sum, item) => sum + item.unitCommission * item.quantity, 0)
  );

  return {
    subtotal,
    discount,
    shippingCost,
    totalFinal: roundMoney(payableSubtotal + shippingCost),
    commissionTotal,
  };
}

function sumTransferDiscount(
  frozenItems: FrozenOrderItem[],
  productsById: Map<string, OrderProductInput>
): number {
  return frozenItems.reduce((sum, item) => {
    const transferPrice = productsById.get(item.productId)?.transferPrice;
    if (transferPrice === null || transferPrice === undefined) return sum;
    return sum + (item.unitPrice - transferPrice) * item.quantity;
  }, 0);
}
