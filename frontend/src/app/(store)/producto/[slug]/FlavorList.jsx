import styles from "./ProductDetail.module.css";

function hasText(value) {
  return typeof value === "string" && value.trim() !== "";
}

/**
 * Lista display-only de sabores de catálogo (ADR 0005 §3), Server Component
 * presentacional. Los sabores REALES (con stock/imagen propios) viven en
 * `product.variants` y su selector interactivo es `ProductPurchasePanel`
 * (ADR 0008). Esta lista es solo texto legado de `attributes.flavors[]`:
 * se SUPRIME por completo si el producto tiene variantes, para que el
 * selector interactivo sea la única fuente de sabores (spec-pdp-c1c3.md C2).
 */
export default function FlavorList({ flavors, hasVariants }) {
  if (hasVariants) {
    return null;
  }

  const list = (flavors ?? []).filter(hasText);

  if (list.length === 0) {
    return null;
  }

  return (
    <section className={styles.flavorListSection} aria-labelledby="flavor-list-heading">
      <h2 id="flavor-list-heading" className={styles.flavorListHeading}>
        Sabores disponibles
      </h2>
      <ul className={styles.flavorListDisplay}>
        {list.map((flavor) => (
          <li key={flavor} className={styles.flavorListDisplayItem}>
            {flavor}
          </li>
        ))}
      </ul>
    </section>
  );
}
