import styles from "./HomeGridSkeleton.module.css";

const SKELETON_CARDS = Array.from({ length: 8 }, (_, index) => index);

/**
 * Skeleton de la grilla de productos de la home. Fallback del `<Suspense>`
 * explícito que envuelve `<Products/>` (contingencia §3(b) de
 * spec-soft404-fix.md, autorizada por ADR 0009 D7/riesgo §7).
 *
 * Reemplaza al `(store)/loading.tsx` a nivel de todo el route group: ese
 * boundary global hacía streaming del shell con status 200 incluso cuando
 * `producto/[slug]` llamaba `notFound()` (soft-404), porque activaba el
 * flush temprano del shell para cualquier user-agent. Sin ningún `<Suspense>`
 * ancestro sobre la PDP, su render queda buffereado y el 404 es real.
 *
 * El Hero real ya no tiene skeleton propio: se pinta al instante (menos CLS,
 * mejor percepción) porque ya no está detrás del mismo boundary que la
 * grilla, que sí puede tardar por la consulta a Supabase.
 */
export default function HomeGridSkeleton() {
  return (
    <div className={styles.wrapper} aria-busy="true" aria-label="Cargando productos…">
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
