import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSessionUser } from "../../../lib/auth/guards";
import PanelNav from "./PanelNav";
import styles from "../../../components/admin/admin.module.css";

/**
 * Layout de las vistas autenticadas del panel (`/panel/pedidos`, `/panel/productos`,
 * `/panel/resenas`, `/panel/suscriptores`). Guard server-side (`getSessionUser()` +
 * `role==="admin"`) como 2ª capa de defensa además del middleware (ADR 0003);
 * agrega la nav de admin (`AdminNav`) sobre las 4 secciones.
 */
export default async function AdminAppLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();

  if (!user || user.role !== "admin") {
    redirect("/panel/login");
  }

  return (
    <>
      <PanelNav userEmail={user.email} />
      <main className={styles.page}>{children}</main>
    </>
  );
}
