/**
 * Cómputo puro del dashboard de `/panel` (spec-panel-admin-mejoras.md §3.3).
 * Recibe los datos ya leídos por el Server Component (`AdminOrder[]` +
 * `AdminProduct[]`, mismo shape que `/panel/pedidos`/`/panel/productos`) y
 * devuelve `DashboardData` lista para `DashboardView` (ux). Sin fetch, sin
 * Supabase: solo agregación en memoria.
 */
import { roundMoney } from "../money";
import { CANCELLED_ORDER_STATUS, PAYABLE_ORDER_STATUSES } from "../orders";
import type { AdminOrder, OrderStatus } from "./orders";
import type { AdminProduct } from "../products";

/** Umbral de "stock bajo" (mismo criterio que la tienda, `modules/home/ProductsClient.jsx`). */
const LOW_STOCK_THRESHOLD = 5;

/** Enum exacto de `orders.status` (ADR 0002), para inicializar el desglose por estado en 0. */
const ALL_ORDER_STATUSES: OrderStatus[] = ["pending", "confirmed", "dispatched", "paid", "cancelled"];

const PAYABLE_STATUS_SET = new Set<OrderStatus>(PAYABLE_ORDER_STATUSES);

export type DashboardData = {
  /** `false` → estado vacío global (spec §3.6). */
  hasOrders: boolean;
  /** Hay ventas con algún `unitCost === 0` → la ganancia estimada es poco confiable. */
  costsIncomplete: boolean;
  kpis: {
    ordersCount: number;
    revenueTotal: number;
    avgTicket: number | null;
    estimatedProfit: number;
    commissionsAccrued: number;
    outOfStockCount: number;
    lowStockCount: number;
  };
  ordersByStatus: Record<OrderStatus, number>;
  salesByDay: Array<{ date: string; orders: number; revenue: number }>;
  topProducts: Array<{ name: string; units: number; revenue: number }>;
};

/** "Venta" = orden no cancelada (spec §3.2). */
function isSale(order: AdminOrder): boolean {
  return order.status !== CANCELLED_ORDER_STATUS;
}

/** Comisión solo pagable/acumulable desde `confirmed` (ADR 0002 #5, spec §3.2). */
function isPayable(order: AdminOrder): boolean {
  return PAYABLE_STATUS_SET.has(order.status);
}

function sumRevenue(orders: AdminOrder[]): number {
  return roundMoney(orders.reduce((sum, order) => sum + order.totalFinal, 0));
}

function sumCommissions(orders: AdminOrder[]): number {
  return roundMoney(orders.reduce((sum, order) => sum + order.commissionTotal, 0));
}

/** Ganancia bruta de una orden: total cobrado menos envío menos costo de los ítems (spec §3.3). */
function orderGrossProfit(order: AdminOrder): number {
  const itemsCost = order.items.reduce((sum, item) => sum + item.unitCost * item.quantity, 0);
  return order.totalFinal - order.shippingCost - itemsCost;
}

function hasIncompleteCost(orders: AdminOrder[]): boolean {
  return orders.some((order) => order.items.some((item) => item.unitCost === 0));
}

function computeKpis(salesOrders: AdminOrder[], payableOrders: AdminOrder[], products: AdminProduct[]): DashboardData["kpis"] {
  const ordersCount = salesOrders.length;
  const revenueTotal = sumRevenue(salesOrders);
  const commissionsAccrued = sumCommissions(payableOrders);
  const grossProfit = roundMoney(salesOrders.reduce((sum, order) => sum + orderGrossProfit(order), 0));

  const activeProducts = products.filter((product) => product.active);

  return {
    ordersCount,
    revenueTotal,
    avgTicket: ordersCount === 0 ? null : roundMoney(revenueTotal / ordersCount),
    estimatedProfit: roundMoney(grossProfit - commissionsAccrued),
    commissionsAccrued,
    outOfStockCount: activeProducts.filter((product) => product.stock === 0).length,
    lowStockCount: activeProducts.filter((product) => product.stock > 0 && product.stock <= LOW_STOCK_THRESHOLD).length,
  };
}

function computeOrdersByStatus(orders: AdminOrder[]): Record<OrderStatus, number> {
  const counts = Object.fromEntries(ALL_ORDER_STATUSES.map((status) => [status, 0])) as Record<OrderStatus, number>;
  for (const order of orders) {
    counts[order.status] += 1;
  }
  return counts;
}

/** `YYYY-MM-DD` de `iso` en America/Argentina (UTC−3 fijo, sin horario de verano — spec §3.3). */
function toArgentinaDateKey(iso: string): string {
  const ARGENTINA_OFFSET_MS = -3 * 60 * 60 * 1000;
  const localTime = new Date(new Date(iso).getTime() + ARGENTINA_OFFSET_MS);
  return localTime.toISOString().slice(0, 10);
}

/** Los 30 días (incluido `reference`) en America/Argentina, más viejo primero. */
function last30DayKeys(referenceIso: string): string[] {
  const [year, month, day] = toArgentinaDateKey(referenceIso).split("-").map(Number);
  const referenceUtcMidnight = Date.UTC(year, month - 1, day);
  const dayMs = 24 * 60 * 60 * 1000;

  return Array.from({ length: 30 }, (_, index) => {
    const offsetFromOldest = 29 - index;
    return new Date(referenceUtcMidnight - offsetFromOldest * dayMs).toISOString().slice(0, 10);
  });
}

function computeSalesByDay(salesOrders: AdminOrder[], now: Date): DashboardData["salesByDay"] {
  const days = last30DayKeys(now.toISOString());
  const byDay = new Map(days.map((date) => [date, { date, orders: 0, revenue: 0 }]));

  for (const order of salesOrders) {
    const bucket = byDay.get(toArgentinaDateKey(order.createdAt));
    if (bucket) {
      bucket.orders += 1;
      bucket.revenue = roundMoney(bucket.revenue + order.totalFinal);
    }
  }

  return days.map((date) => byDay.get(date)!);
}

/** Agrupa `order_items` de las ventas por `name` (robusto ante `productId` null de productos borrados). */
function computeTopProducts(salesOrders: AdminOrder[]): DashboardData["topProducts"] {
  const byName = new Map<string, { name: string; units: number; revenue: number }>();

  for (const order of salesOrders) {
    for (const item of order.items) {
      const existing = byName.get(item.name) ?? { name: item.name, units: 0, revenue: 0 };
      existing.units += item.quantity;
      existing.revenue = roundMoney(existing.revenue + item.unitPrice * item.quantity);
      byName.set(item.name, existing);
    }
  }

  return Array.from(byName.values())
    .sort((a, b) => b.units - a.units)
    .slice(0, 5);
}

/**
 * Computa el `DashboardData` completo para `/panel`. `now` es inyectable
 * para tests deterministas; en producción usa el momento del request SSR.
 */
export function computeDashboardData(orders: AdminOrder[], products: AdminProduct[], now: Date = new Date()): DashboardData {
  const salesOrders = orders.filter(isSale);
  const payableOrders = orders.filter(isPayable);

  return {
    hasOrders: salesOrders.length > 0,
    costsIncomplete: hasIncompleteCost(salesOrders),
    kpis: computeKpis(salesOrders, payableOrders, products),
    ordersByStatus: computeOrdersByStatus(orders),
    salesByDay: computeSalesByDay(salesOrders, now),
    topProducts: computeTopProducts(salesOrders),
  };
}
