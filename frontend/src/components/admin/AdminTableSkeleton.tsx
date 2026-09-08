import styles from "./admin.module.css";

export type AdminTableSkeletonProps = {
  /** @default 6 */
  rows?: number;
  /** @default 4 */
  columns?: number;
  /** Texto para lectores de pantalla, ej. "Cargando pedidos…". @default "Cargando…" */
  label?: string;
};

/**
 * Skeleton oscuro para `loading.tsx` de cada segmento (`/panel/pedidos`,
 * `/panel/productos`, etc.) mientras el Server Component trae los datos.
 * Puramente decorativo: `aria-hidden` en las barras, con un texto
 * accesible único (`role="status"`) para lectores de pantalla.
 */
export default function AdminTableSkeleton({ rows = 6, columns = 4, label = "Cargando…" }: AdminTableSkeletonProps) {
  return (
    <div className={styles.skeletonWrap} role="status">
      <span className={styles.srOnly}>{label}</span>
      <div className={`${styles.skeletonBar} ${styles.skeletonHeaderBar}`} aria-hidden="true" />
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div className={styles.skeletonRow} key={rowIndex} aria-hidden="true">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <span
              key={colIndex}
              className={styles.skeletonBar}
              style={{ flex: colIndex === 0 ? 2 : 1 }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
