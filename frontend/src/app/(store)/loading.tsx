import styles from "./loading.module.css";

const SKELETON_CARDS = Array.from({ length: 8 }, (_, index) => index);

/**
 * Skeleton genérico del route group `(store)` (Next App Router lo muestra
 * automáticamente como fallback de Suspense durante la navegación entre
 * rutas de esta carpeta, ej. home -> PDP). El chrome (Navbar/ShippingBanner/
 * Footer) lo sigue poniendo `layout.tsx`, esto solo reemplaza el contenido
 * de `<main>` mientras carga. Percepción de velocidad, no cambia el CWV de
 * la carga inicial (perf-audit.md, fix #5/#3).
 */
export default function StoreLoading() {
  return (
    <div className={styles.wrapper} aria-busy="true" aria-label="Cargando…">
      <div className={styles.hero} />
      <div className={styles.grid}>
        {SKELETON_CARDS.map((index) => (
          <div key={index} className={styles.card}>
            <div className={styles.cardImage} />
            <div className={styles.cardLine} />
            <div className={`${styles.cardLine} ${styles.cardLineShort}`} />
          </div>
        ))}
      </div>
    </div>
  );
}
