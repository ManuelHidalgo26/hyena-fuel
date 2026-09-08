import type { ReactNode } from "react";
import styles from "./admin.module.css";

export type AdminPageHeaderProps = {
  title: string;
  description?: string;
  /** Slot para la acción principal de la página (normalmente un <AdminButton>). */
  action?: ReactNode;
};

/**
 * Encabezado estándar de cada sección del panel (`/panel/pedidos`,
 * `/panel/productos`, etc.): título + descripción opcional + acción a la
 * derecha (se apila debajo del título en mobile/tablet angosto).
 */
export default function AdminPageHeader({ title, description, action }: AdminPageHeaderProps) {
  return (
    <header className={styles.pageHeader}>
      <div className={styles.pageHeaderText}>
        <h1 className={styles.pageTitle}>{title}</h1>
        {description && <p className={styles.pageDescription}>{description}</p>}
      </div>
      {action && <div className={styles.pageHeaderAction}>{action}</div>}
    </header>
  );
}
