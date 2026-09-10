import { AdminBadge, OrderStatusBadge, type OrderStatus } from "./AdminBadge";
import AdminEmptyState from "./AdminEmptyState";
import styles from "./admin.module.css";
// NOTA (ux → dev): este módulo todavía no existe — lo crea dev (spec-panel-admin-mejoras.md §3.3).
// Import intencional aunque no compile todavía; dev valida tsc/build al integrar.
import type { DashboardData } from "../../lib/admin/dashboard";

export type DashboardViewProps = {
  data: DashboardData;
};

const ORDER_STATUS_ORDER: OrderStatus[] = ["pending", "confirmed", "dispatched", "paid", "cancelled"];

function formatMoney(value: number): string {
  return `$${Math.round(value).toLocaleString("es-AR")}`;
}

/** `date` viene como "YYYY-MM-DD" (spec §3.3, agrupado en America/Argentina). */
function formatDayLabel(dateIso: string): string {
  const [, month, day] = dateIso.split("-");
  return `${day}/${month}`;
}

/**
 * Vista presentacional del dashboard (`/panel`, spec §3.4). Recibe
 * `DashboardData` ya calculado por dev (SSR) y solo pinta: KPI cards, barras
 * CSS de ventas/30d, barras horizontales de top productos y desglose por
 * estado. Sin librería de gráficos (decisión de arqui, spec §3.5). Estado
 * vacío global cuando `hasOrders === false` (spec §3.6, criterio duro): los
 * gráficos se reemplazan por un único `AdminEmptyState`, pero las cards de
 * KPI (incluidas las de stock) siguen mostrando datos reales.
 */
export default function DashboardView({ data }: DashboardViewProps) {
  const { kpis, hasOrders, costsIncomplete, ordersByStatus, salesByDay, topProducts } = data;

  const revenueMax = Math.max(1, ...salesByDay.map((day) => day.revenue));
  const unitsMax = Math.max(1, ...topProducts.map((product) => product.units));
  const totalRevenue30d = salesByDay.reduce((sum, day) => sum + day.revenue, 0);

  return (
    <div className={styles.dashboard}>
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Facturación</span>
          <span className={styles.kpiValue}>{formatMoney(kpis.revenueTotal)}</span>
        </div>

        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Órdenes</span>
          <span className={styles.kpiValue}>{kpis.ordersCount.toLocaleString("es-AR")}</span>
        </div>

        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Ticket promedio</span>
          <span className={styles.kpiValue}>{kpis.avgTicket === null ? "—" : formatMoney(kpis.avgTicket)}</span>
        </div>

        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Ganancia estimada</span>
          <span className={styles.kpiValue}>{formatMoney(kpis.estimatedProfit)}</span>
          {costsIncomplete && <span className={styles.kpiHint}>Estimada — faltan costos cargados</span>}
        </div>

        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Comisiones</span>
          <span className={styles.kpiValue}>{formatMoney(kpis.commissionsAccrued)}</span>
        </div>

        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Stock</span>
          <div className={styles.kpiBadgeRow}>
            <AdminBadge tone="danger">Sin stock: {kpis.outOfStockCount}</AdminBadge>
            <AdminBadge tone="warning">Stock bajo: {kpis.lowStockCount}</AdminBadge>
          </div>
        </div>
      </div>

      {!hasOrders ? (
        <div className={styles.chartEmptyWrap}>
          <AdminEmptyState
            title="Todavía no hay ventas para mostrar"
            description="Cuando entren pedidos, acá vas a ver la evolución de ventas y los productos más vendidos."
          />
        </div>
      ) : (
        <>
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Ventas por día (últimos 30 días)</h2>
            <p className={styles.srOnly}>Total facturado en los últimos 30 días: {formatMoney(totalRevenue30d)}.</p>
            <div className={styles.salesChart} aria-hidden="true">
              {salesByDay.map((day) => {
                const pct = revenueMax > 0 ? (day.revenue / revenueMax) * 100 : 0;
                return (
                  <div className={styles.salesBarCol} key={day.date}>
                    <div
                      className={styles.salesBar}
                      style={{ height: `${Math.max(2, pct)}%` }}
                      title={`${day.date}: ${formatMoney(day.revenue)} · ${day.orders} pedido${day.orders === 1 ? "" : "s"}`}
                    />
                  </div>
                );
              })}
            </div>
            <div className={styles.salesChartAxis} aria-hidden="true">
              {salesByDay.map((day, index) => (
                <span className={styles.salesAxisTick} key={day.date}>
                  {index % 7 === 0 ? formatDayLabel(day.date) : ""}
                </span>
              ))}
            </div>
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Top productos</h2>
            <ul className={styles.topProductsList}>
              {topProducts.map((product) => {
                const pct = unitsMax > 0 ? (product.units / unitsMax) * 100 : 0;
                return (
                  <li className={styles.topProductRow} key={product.name}>
                    <span className={styles.topProductName}>{product.name}</span>
                    <span className={styles.topProductBarTrack} aria-hidden="true">
                      <span className={styles.topProductBarFill} style={{ width: `${Math.max(4, pct)}%` }} />
                    </span>
                    <span className={styles.topProductValue}>
                      {product.units} u · {formatMoney(product.revenue)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Pedidos por estado</h2>
            <div className={styles.statusBreakdown}>
              {ORDER_STATUS_ORDER.map((status) => (
                <div className={styles.statusBreakdownItem} key={status}>
                  <OrderStatusBadge status={status} />
                  <span className={styles.statusBreakdownCount}>{ordersByStatus[status] ?? 0}</span>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
