import Link from "next/link";
import styles from "./not-found.module.css";

/**
 * 404 real del route group `(store)` (Navbar/ShippingBanner/Footer los pone
 * el layout de la tienda). Cubre cualquier ruta de tienda inexistente y,
 * puntualmente, `producto/[slug]` cuando llama `notFound()` por slug
 * inactivo/inexistente — antes ese caso devolvía HTTP 200 (soft-404).
 */
export const metadata = {
  title: "Página no encontrada | HYENA FUEL",
  robots: { index: false, follow: true },
};

export default function StoreNotFound() {
  return (
    <section className={styles.wrapper}>
      <p className={styles.eyebrow}>Error 404</p>
      <h1 className={styles.title}>No encontramos esta página</h1>
      <p className={styles.subtitle}>
        El producto o la página que buscás no existe o ya no está disponible.
      </p>
      <div className={styles.actions}>
        <Link href="/" className={styles.btnPrimary}>
          Ir al inicio
        </Link>
        <Link href="/#products" className={styles.btnSecondary}>
          Ver productos
        </Link>
      </div>
    </section>
  );
}
