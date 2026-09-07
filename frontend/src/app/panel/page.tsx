import { redirect } from "next/navigation";
import { getSessionUser } from "../../lib/auth/guards";
import { signOutAction } from "./actions";
import styles from "./panel.module.css";

export const metadata = {
  title: "Panel | HYENA FUEL",
  robots: { index: false, follow: false },
};

/**
 * Placeholder del panel admin (Fase 1: solo confirma que login + middleware
 * funcionan). El contenido real (pedidos, productos, etc.) es la parte
 * siguiente.
 *
 * El middleware ya protege `/panel/**`, pero esta verificación server-side
 * es la segunda capa de defensa en profundidad del ADR 0003.
 */
export default async function PanelPage() {
  const user = await getSessionUser();

  if (!user || user.role !== "admin") {
    redirect("/panel/login");
  }

  return (
    <main className={styles.wrapper}>
      <div className={styles.card}>
        <span className={styles.roleBadge}>{user.role}</span>
        <h1 className={styles.title}>Panel — HYENA FUEL</h1>
        <p className={styles.subtitle}>Sesión iniciada como</p>
        <p className={styles.email}>{user.email}</p>

        <form action={signOutAction} className={styles.logoutForm}>
          <button type="submit" className={styles.logoutBtn}>
            Cerrar sesión
          </button>
        </form>
      </div>
    </main>
  );
}
