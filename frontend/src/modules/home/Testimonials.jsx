import styles from "./Testimonials.module.css";

const testimonials = [
  {
    name: "Martín R.",
    location: "Córdoba Capital",
    role: "Culturismo amateur",
    text: "La proteína es de muy buena calidad, sin rellenos. Llegó en 2 días bien empaquetada. Me gustó que te aclaran todo antes de comprar.",
    stars: 5,
  },
  {
    name: "Lucía T.",
    location: "Villa Carlos Paz",
    role: "CrossFit",
    text: "Llevo 3 meses usando la creatina y el pre-entreno. Los resultados son reales. El precio por transferencia es muy conveniente.",
    stars: 5,
  },
  {
    name: "Federico M.",
    location: "Córdoba",
    role: "Entrenamiento funcional",
    text: "El soporte por WhatsApp es muy ágil, te responden rápido. Los suplementos son originales y el envío gratis a partir de $120k es un golazo.",
    stars: 5,
  },
];

function StarRating({ count }) {
  return (
    <div className={styles.stars} aria-label={`${count} estrellas`}>
      {"★".repeat(count)}
      {"☆".repeat(5 - count)}
    </div>
  );
}

export default function Testimonials() {
  return (
    <section className={styles.section}>
      <h2 className={styles.title}>Lo que dicen nuestros clientes</h2>
      <p className={styles.subtitle}>Atletas reales, resultados reales.</p>

      <div className={styles.grid}>
        {testimonials.map((t) => (
          <div key={t.name} className={styles.card}>
            <StarRating count={t.stars} />
            <p className={styles.text}>"{t.text}"</p>
            <div className={styles.author}>
              <div className={styles.avatar}>
                {t.name.charAt(0)}
              </div>
              <div>
                <p className={styles.authorName}>{t.name}</p>
                <p className={styles.authorRole}>
                  {t.role} · {t.location}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
