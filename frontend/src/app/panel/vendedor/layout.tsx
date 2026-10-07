import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSessionUser } from "../../../lib/auth/guards";
import { AdminNav, AdminButton } from "../../../components/admin";
import { signOutAction } from "../actions";
import styles from "../../../components/admin/admin.module.css";

/**
 * Layout del portal del vendedor (`/panel/vendedor`, ADR 0003). Vive fuera del grupo
 * `(app)` porque ese layout exige rol admin. Guard server-side como 2ª capa además del
 * middleware: un admin va a su gestión de vendedores; sin sesión, al login.
 */
export default async function SellerPortalLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();

  if (!user) {
    redirect("/panel/login");
  }
  if (user.role === "admin") {
    redirect("/panel/vendedores");
  }
  if (user.role !== "seller") {
    redirect("/panel/login?error=forbidden");
  }

  return (
    <>
      <AdminNav
        items={[{ href: "/panel/vendedor", label: "Mi panel", active: true }]}
        userEmail={user.email}
        brand={
          <div className={styles.navBrand}>
            <span className={styles.navBrandMark}>HYENA FUEL</span>
            <span className={styles.navBrandCaption}>Vendedores</span>
          </div>
        }
        signOutSlot={
          <form action={signOutAction}>
            <AdminButton type="submit" variant="secondary" size="sm">
              Cerrar sesión
            </AdminButton>
          </form>
        }
      />
      <main className={styles.page}>{children}</main>
    </>
  );
}
