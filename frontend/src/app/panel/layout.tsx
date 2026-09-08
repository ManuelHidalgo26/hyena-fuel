import type { ReactNode } from "react";
import styles from "./panel.module.css";

export const metadata = {
  title: "Panel | HYENA FUEL",
  robots: { index: false, follow: false },
};

/**
 * Shell neutro del panel (ADR 0004): envuelve TODO `/panel`, login incluido.
 * Fondo oscuro full-height, sin nav — la navegación de admin la agrega
 * `panel/(app)/layout.tsx`, que solo envuelve las vistas autenticadas.
 */
export default function PanelLayout({ children }: { children: ReactNode }) {
  return <div className={styles.shell}>{children}</div>;
}
