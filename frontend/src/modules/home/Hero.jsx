import Link from "next/link";
import styles from "./Hero.module.css";

const TRUST_ITEMS = [
  { icon: "🚚", label: "Envío gratis +$160k" },
  { icon: "🏆", label: "Las mejores marcas" },
  { icon: "🏦", label: "-10% transferencia" },
  { icon: "💬", label: "Atención por WhatsApp" },
];

export default function Hero() {
  return (
    <section className={styles.hero}>
      <div className={styles.hyena} aria-hidden="true" />

      <div className={styles.grid}>
        <div>
          <span className={styles.eyebrow}>Suplementos deportivos · Córdoba</span>
          <h1 className={styles.title}>
            HYENA FUEL <span>Combustible para tu entrenamiento.</span>
          </h1>
          <p className={styles.subtitle}>
            Trabajamos solo con las mejores marcas, a precio real y con atención
            directa por WhatsApp. Para atletas que no negocian con la mediocridad.
          </p>

          <div className={styles.ctas}>
            <Link href="/#products" className={`${styles.btn} ${styles.btnPrimary}`}>
              Ver productos
            </Link>
            <Link href="/como-comprar" className={`${styles.btn} ${styles.btnSecondary}`}>
              Cómo comprar
            </Link>
          </div>

          <ul className={styles.trustStrip}>
            {TRUST_ITEMS.map(({ icon, label }) => (
              <li key={label}>
                <span className={styles.trustIcon} aria-hidden="true">
                  {icon}
                </span>
                {label}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
