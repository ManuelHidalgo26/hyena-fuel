import { redirect } from "next/navigation";
import { getSessionUser } from "../../../lib/auth/guards";
import { createClient } from "../../../lib/supabase/server";
import {
  SELLER_COLUMNS,
  mapSeller,
  summarizeSellerOrders,
  type SellerOrderRow,
  type SellerRow,
} from "../../../lib/sellers";
import { AdminEmptyState, AdminPageHeader } from "../../../components/admin";
import styles from "../../../components/admin/admin.module.css";
import SellerCodeDisplay from "./SellerCodeDisplay";
import PasswordForm from "./PasswordForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Mi panel | Vendedores HYENA FUEL",
};

function formatMoney(value: number): string {
  return `$${value.toLocaleString("es-AR")}`;
}

/**
 * Portal del vendedor (Tanda A): su código para compartir, su comisión, el resumen de
 * ventas y el cambio de contraseña. Lee con el cliente de sesión: RLS (`sellers_self_read`,
 * `orders_seller_read`) limita todo a sus propias filas — nunca service role acá.
 */
export default async function SellerPortalPage() {
  const user = await getSessionUser();
  if (!user || user.role !== "seller") {
    redirect("/panel/login");
  }

  const supabase = await createClient();
  const [sellerResult, ordersResult] = await Promise.all([
    supabase.from("sellers").select(SELLER_COLUMNS).eq("id", user.id).maybeSingle().returns<SellerRow | null>(),
    supabase
      .from("orders")
      .select("status, total_final, commission_total")
      .eq("seller_id", user.id)
      .returns<SellerOrderRow[]>(),
  ]);

  if (sellerResult.error || ordersResult.error) {
    throw new Error("No se pudo cargar el panel del vendedor");
  }

  if (!sellerResult.data) {
    return (
      <AdminEmptyState
        title="Tu cuenta todavía no tiene ficha de vendedor"
        description="Escribile al equipo de HYENA FUEL para que la terminen de configurar."
      />
    );
  }

  const seller = mapSeller(sellerResult.data);

  if (!seller.active) {
    return (
      <AdminEmptyState
        title="Tu cuenta de vendedor está pausada"
        description="Si creés que es un error, escribile al equipo de HYENA FUEL."
      />
    );
  }

  const sales = summarizeSellerOrders(ordersResult.data ?? []);

  return (
    <>
      <AdminPageHeader
        title={`¡Hola, ${seller.name}!`}
        description="Compartí tu código: cada compra que lo use te suma comisión."
      />

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Tu código de vendedor</h2>
        <SellerCodeDisplay code={seller.code} />
        <p className={styles.hint}>
          El cliente lo escribe en el carrito, en &quot;Código de vendedor&quot;. Ganás el {seller.defaultCommissionPct}% de
          cada producto que compre.
        </p>
      </div>

      <h2 className={styles.sectionTitle}>Tus ventas</h2>
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Pedidos con tu código</span>
          <span className={styles.kpiValue}>{sales.ordersCount}</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Total vendido</span>
          <span className={styles.kpiValue}>{formatMoney(sales.totalRevenue)}</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Comisión ganada</span>
          <span className={styles.kpiValue}>{formatMoney(sales.commissionAccumulated)}</span>
          <span className={styles.kpiHint}>De pedidos ya confirmados.</span>
        </div>
      </div>

      <h2 className={styles.sectionTitle}>Cambiar contraseña</h2>
      <PasswordForm />
    </>
  );
}
