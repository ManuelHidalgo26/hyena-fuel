import styles from "./ProductDetail.module.css";

const SPEC_ROWS = [
  { key: "servingSize", label: "Porción" },
  { key: "servingsPerContainer", label: "Porciones por envase" },
  { key: "proteinPerServing", label: "Proteína por porción" },
  { key: "netWeight", label: "Peso neto" },
];

function hasValue(value) {
  return value !== undefined && value !== null && value !== "";
}

/**
 * Ficha técnica de la PDP (ADR 0005 §2, spec-pdp-c1c3.md C2). Server Component
 * presentacional: renderiza solo los campos presentes en `attributes`
 * (servingSize/servingsPerContainer/proteinPerServing/netWeight/highlights).
 * Si no hay ningún campo presente, no renderiza nada (nunca una ficha vacía).
 * Los sabores (`attributes.flavors`) NO se muestran acá: los maneja `FlavorList`.
 */
export default function ProductSpecs({ attributes }) {
  const rows = SPEC_ROWS.filter((row) => hasValue(attributes?.[row.key]));
  const highlights = (attributes?.highlights ?? []).filter(hasValue);

  if (rows.length === 0 && highlights.length === 0) {
    return null;
  }

  return (
    <section className={styles.specsSection} aria-labelledby="product-specs-heading">
      <h2 id="product-specs-heading" className={styles.specsHeading}>
        Ficha técnica
      </h2>

      {rows.length > 0 && (
        <dl className={styles.specsList}>
          {rows.map((row) => (
            <div key={row.key} className={styles.specsRow}>
              <dt className={styles.specsLabel}>{row.label}</dt>
              <dd className={styles.specsValue}>{attributes[row.key]}</dd>
            </div>
          ))}
        </dl>
      )}

      {highlights.length > 0 && (
        <ul className={styles.specsHighlights}>
          {highlights.map((highlight) => (
            <li key={highlight}>{highlight}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
