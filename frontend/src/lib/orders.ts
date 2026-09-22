import { z } from "zod";
import { calculateUnitCommission } from "./commission";
import { roundMoney } from "./money";
import type { DiscountCodeType } from "./discountCodes";

/** Envío gratis a partir de este subtotal a pagar; si no, cuesta $5000 (retiro en persona siempre es gratis). */
export const FREE_SHIPPING_THRESHOLD = 160000;
export const SHIPPING_COST = 5000;

/**
 * Cotas anti-abuso (QA-3): compartidas entre el alta de orden (`POST /api/orders`) y la
 * previsualización de cupón (`POST /api/discount-codes/validate`, ADR 0010) — un carrito
 * legítimo nunca necesita más que esto.
 */
export const MAX_QUANTITY_PER_ITEM = 100;
export const MAX_ITEMS_PER_ORDER = 50;
export const MAX_FLAVOR_LENGTH = 100;

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

/** Forma de un ítem del carrito tal como lo manda el cliente (`POST /api/orders` y `POST /api/discount-codes/validate`). */
export const orderItemSchema = z.object({
  productId: z.uuid("productId inválido"),
  quantity: z
    .number()
    .int("La cantidad debe ser un número entero")
    .positive("La cantidad debe ser mayor a 0")
    .max(MAX_QUANTITY_PER_ITEM, `La cantidad máxima por producto es ${MAX_QUANTITY_PER_ITEM}`),
  // Nombre del sabor elegido (ADR 0008). Requerido/prohibido según variantes del producto
  // se valida contra la DB en `validateStockAndActive` (Zod no conoce el catálogo).
  flavor: z
    .string()
    .trim()
    .min(1, "El sabor no puede estar vacío")
    .max(MAX_FLAVOR_LENGTH, `El sabor admite hasta ${MAX_FLAVOR_LENGTH} caracteres`)
    .optional(),
});

export type OrderLineItem = z.infer<typeof orderItemSchema>;

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
  /** Sabor congelado en la línea (ADR 0008). `undefined` = producto sin sabores. */
  flavor?: string;
};

/** Cupón ya resuelto y validado (`resolveDiscountCode`, ADR 0010) listo para tarifar/canjear. */
export type OrderCouponInput = {
  id: string;
  code: string;
  type: DiscountCodeType;
  value: number;
};

export type OrderTotals = {
  subtotal: number;
  /** Ahorro TOTAL = transferencia + cupón (ADR 0002/0010, invariante `total_final = subtotal − discount + shipping_cost`). */
  discount: number;
  shippingCost: number;
  totalFinal: number;
  commissionTotal: number;
  /** Desglose: solo la parte del descuento que aportó el cupón (para reporte de campaña, ADR 0010 §2.2). */
  couponDiscount: number;
  /** Código canjeado (snapshot), o `null` si no se aplicó ninguno. */
  discountCode: string | null;
};

/** Línea mínima necesaria para tarifar: precio de lista, precio transferencia y cantidad. */
export type PriceableLine = {
  unitPrice: number;
  transferPrice: number | null;
  quantity: number;
};

export type PricingBreakdown = {
  subtotal: number;
  transferDiscount: number;
  payableSubtotal: number;
  couponDiscount: number;
  discountedSubtotal: number;
  shippingCost: number;
  totalFinal: number;
};

/**
 * Suma cantidades repetidas de la misma línea (protege ante payloads manuales con líneas
 * duplicadas). La clave de la línea es `productId + flavor` (ADR 0008): dos sabores del
 * mismo producto son líneas distintas, pero el mismo sabor repetido se funde en una sola.
 */
export function mergeLineItemsByProduct(items: OrderLineItem[]): OrderLineItem[] {
  const mergedByKey = new Map<string, OrderLineItem>();

  for (const item of items) {
    const key = `${item.productId}::${item.flavor ?? ""}`;
    const existing = mergedByKey.get(key);
    mergedByKey.set(key, {
      productId: item.productId,
      flavor: item.flavor,
      quantity: (existing?.quantity ?? 0) + item.quantity,
    });
  }

  return Array.from(mergedByKey.values());
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
  return items.map(({ productId, quantity, flavor }) => {
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
      flavor,
    };
  });
}

/**
 * Desglose de precio puro (sin comisión): subtotal, descuento por transferencia, cupón,
 * envío y total final. Orden de operaciones = ADR 0010 §4 (transferencia primero, cupón
 * sobre el subtotal ya rebajado, envío gratis evaluado PRE-cupón — D1). Reutilizado por
 * `calculateOrderTotals` (alta real de orden) y por `POST /api/discount-codes/validate`
 * (previsualización, sin comisión ni congelamiento de ítems).
 */
export function calculatePricingBreakdown(
  lines: PriceableLine[],
  paymentMethod: PaymentMethod,
  deliveryMethod: DeliveryMethod,
  coupon: OrderCouponInput | null = null
): PricingBreakdown {
  const subtotal = roundMoney(lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0));

  const transferDiscount = roundMoney(paymentMethod === "transferencia" ? sumTransferDiscount(lines) : 0);

  const payableSubtotal = subtotal - transferDiscount;
  const couponDiscount = coupon ? computeCouponDiscount(coupon, payableSubtotal) : 0;
  const discountedSubtotal = payableSubtotal - couponDiscount;

  // Envío gratis evaluado sobre `payableSubtotal` (post-transferencia, PRE-cupón — ADR 0010
  // Decisión 4 / spec §4.1 D1): el cupón nunca le quita al cliente un envío gratis ya ganado.
  const shippingCost =
    deliveryMethod === "retiro" || payableSubtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_COST;

  return {
    subtotal,
    transferDiscount,
    payableSubtotal,
    couponDiscount,
    discountedSubtotal,
    shippingCost,
    totalFinal: roundMoney(discountedSubtotal + shippingCost),
  };
}

/** Totales de la orden: subtotal, descuento (transferencia + cupón), envío, total final y comisión. */
export function calculateOrderTotals(
  frozenItems: FrozenOrderItem[],
  productsById: Map<string, OrderProductInput>,
  paymentMethod: PaymentMethod,
  deliveryMethod: DeliveryMethod,
  coupon: OrderCouponInput | null = null
): OrderTotals {
  const lines: PriceableLine[] = frozenItems.map((item) => ({
    unitPrice: item.unitPrice,
    transferPrice: productsById.get(item.productId)?.transferPrice ?? null,
    quantity: item.quantity,
  }));

  const breakdown = calculatePricingBreakdown(lines, paymentMethod, deliveryMethod, coupon);

  const commissionTotal = roundMoney(
    frozenItems.reduce((sum, item) => sum + item.unitCommission * item.quantity, 0)
  );

  return {
    subtotal: breakdown.subtotal,
    discount: roundMoney(breakdown.transferDiscount + breakdown.couponDiscount),
    shippingCost: breakdown.shippingCost,
    totalFinal: breakdown.totalFinal,
    commissionTotal,
    couponDiscount: breakdown.couponDiscount,
    discountCode: coupon?.code ?? null,
  };
}

function sumTransferDiscount(lines: PriceableLine[]): number {
  return lines.reduce((sum, line) => {
    if (line.transferPrice === null) return sum;
    return sum + (line.unitPrice - line.transferPrice) * line.quantity;
  }, 0);
}

/**
 * Monto que aporta el cupón sobre `payableSubtotal` (ya rebajado por transferencia si
 * corresponde), con piso en 0 y techo en `payableSubtotal` (ADR 0010 §4 paso 3): nunca
 * deja el subtotal negativo ni le come el envío.
 */
function computeCouponDiscount(coupon: OrderCouponInput, payableSubtotal: number): number {
  if (payableSubtotal <= 0) return 0;

  const rawDiscount =
    coupon.type === "pct" ? roundMoney((payableSubtotal * coupon.value) / 100) : coupon.value;

  return Math.min(Math.max(rawDiscount, 0), payableSubtotal);
}
