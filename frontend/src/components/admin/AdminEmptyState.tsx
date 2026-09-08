import type { ReactNode } from "react";
import styles from "./admin.module.css";

export type AdminEmptyStateProps = {
  title: string;
  description?: string;
  /** Ícono opcional (ej. `lucide-react`, ya es dependencia del proyecto). Decorativo: se renderiza con aria-hidden. */
  icon?: ReactNode;
  /** Acción opcional (normalmente un <AdminButton variant="secondary">). */
  action?: ReactNode;
};

/**
 * Estado vacío de una sección ("No hay pedidos todavía", "Todavía no hay
 * suscriptores", etc. — copy exacto por sección lo define dev/arqui según
 * spec §3.3). Va en el lugar donde iría la tabla/lista cuando el array
 * viene vacío.
 */
export default function AdminEmptyState({ title, description, icon, action }: AdminEmptyStateProps) {
  return (
    <div className={styles.stateBlock} role="status">
      {icon && (
        <div className={styles.stateIcon} aria-hidden="true">
          {icon}
        </div>
      )}
      <p className={styles.stateTitle}>{title}</p>
      {description && <p className={styles.stateDescription}>{description}</p>}
      {action && <div className={styles.stateAction}>{action}</div>}
    </div>
  );
}
