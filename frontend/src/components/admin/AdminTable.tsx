import type { ReactNode } from "react";
import styles from "./admin.module.css";

export type AdminTableProps = {
  /** Texto para lectores de pantalla (no se ve, va en un `<caption>` visualmente oculto). */
  caption: string;
  /** Markup nativo de tabla: normalmente un `<thead>` + `<tbody>`. */
  children: ReactNode;
};

/**
 * Contenedor de tabla densa del panel. Presentacional: no define columnas
 * ni tipa filas (cada sección tiene columnas muy distintas) — dev escribe
 * `<thead>/<tbody>` nativo adentro y usa las clases ya estilizadas de
 * `admin.module.css` para celdas especiales:
 *
 * - `styles.rowInactive` en el `<tr>` de una fila desactivada (opacidad).
 * - `styles.rowMedia` / `styles.rowThumb` / `styles.rowTitle` / `styles.rowSubtitle`
 *   para la celda "producto" (thumb + nombre + subtítulo).
 * - `styles.cellNumeric` en `<td>` de precios/stock (alineado a la derecha, tabular).
 * - `styles.cellMuted` en `<td>` de datos secundarios (fecha, id).
 * - `styles.cellActions` en el `<td>` de acciones + `styles.cellActionsInner`
 *   en un `<div>` adentro para alinear los botones.
 *
 * `<th>`/`<td>` nativos ya vienen estilizados por selector de elemento
 * (`.table th`, `.table td`), no hace falta clase extra salvo las de arriba.
 */
export default function AdminTable({ caption, children }: AdminTableProps) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <caption className={styles.srOnly}>{caption}</caption>
        {children}
      </table>
    </div>
  );
}
