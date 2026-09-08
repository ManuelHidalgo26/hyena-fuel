import type { ReactNode } from "react";
import AdminButton from "./AdminButton";
import styles from "./admin.module.css";

export type AdminErrorStateProps = {
  /** @default "No se pudo cargar la información." */
  message?: string;
  icon?: ReactNode;
  /**
   * Reintentar. En un `error.tsx` de segmento (Next App Router, siempre
   * "use client"), pasale la función `reset` que te da Next:
   * `<AdminErrorState onRetry={reset} />`.
   */
  onRetry?: () => void;
};

/**
 * Estado de error de carga (para `error.tsx` por segmento) o de una
 * sección puntual. Si se pasa `onRetry`, muestra el botón "Reintentar".
 */
export default function AdminErrorState({
  message = "No se pudo cargar la información.",
  icon,
  onRetry,
}: AdminErrorStateProps) {
  return (
    <div className={`${styles.stateBlock} ${styles.errorBlock}`} role="alert">
      {icon && (
        <div className={styles.stateIcon} aria-hidden="true">
          {icon}
        </div>
      )}
      <p className={styles.stateTitle}>Algo salió mal</p>
      <p className={styles.stateDescription}>{message}</p>
      {onRetry && (
        <div className={styles.stateAction}>
          <AdminButton variant="secondary" onClick={onRetry}>
            Reintentar
          </AdminButton>
        </div>
      )}
    </div>
  );
}
