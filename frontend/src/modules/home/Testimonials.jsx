"use client";

import { useState, useEffect } from "react";
import styles from "./Testimonials.module.css";

const STATIC = [
  {
    _id: "s1",
    name: "Martín R.",
    text: "La proteína es de muy buena calidad, sin rellenos. Llegó en 2 días bien empaquetada. Me gustó que te aclaran todo antes de comprar.",
    rating: 5,
    location: "Córdoba Capital",
  },
  {
    _id: "s2",
    name: "Lucía T.",
    text: "Llevo 3 meses usando la creatina y el pre-entreno. Los resultados son reales. El precio por transferencia es muy conveniente.",
    rating: 5,
    location: "Córdoba Capital",
  },
  {
    _id: "s3",
    name: "Federico M.",
    text: "Me contacté por Instagram y me respondieron al toque. Los suplementos son originales y el envío gratis a partir de $120k es un golazo.",
    rating: 5,
    location: "Córdoba Capital",
  },
];

function Stars({ count, interactive = false, onSelect }) {
  return (
    <div className={styles.stars}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          className={n <= count ? styles.starFilled : styles.starEmpty}
          onClick={() => interactive && onSelect?.(n)}
          style={interactive ? { cursor: "pointer" } : undefined}
        >
          ★
        </span>
      ))}
    </div>
  );
}

function ReviewCard({ review }) {
  return (
    <div className={styles.card}>
      <Stars count={review.rating} />
      <p className={styles.text}>&ldquo;{review.text}&rdquo;</p>
      <div className={styles.author}>
        <div className={styles.avatar}>{review.name.charAt(0).toUpperCase()}</div>
        <div>
          <p className={styles.authorName}>{review.name}</p>
          {review.location && (
            <p className={styles.authorRole}>{review.location}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function ReviewForm() {
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [rating, setRating] = useState(5);
  const [hover, setHover] = useState(0);
  const [status, setStatus] = useState(null); // "success" | "error"
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !text.trim() || loading) return;
    setLoading(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/reviews`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, text, rating }),
        }
      );
      setStatus(res.ok ? "success" : "error");
      if (res.ok) { setName(""); setText(""); setRating(5); }
    } catch {
      setStatus("error");
    } finally {
      setLoading(false);
    }
  };

  if (status === "success") {
    return (
      <div className={styles.formSuccess}>
        ✅ ¡Gracias por tu reseña! Será publicada una vez revisada.
      </div>
    );
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <h3 className={styles.formTitle}>Dejá tu reseña</h3>

      {/* Star selector */}
      <div className={styles.starSelector}>
        {[1, 2, 3, 4, 5].map((n) => (
          <span
            key={n}
            className={(hover || rating) >= n ? styles.starFilled : styles.starEmpty}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => setRating(n)}
          >
            ★
          </span>
        ))}
      </div>

      <input
        className={styles.input}
        type="text"
        placeholder="Tu nombre"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        maxLength={60}
      />

      <textarea
        className={styles.textarea}
        placeholder="Contanos tu experiencia (máx. 300 caracteres)"
        value={text}
        onChange={(e) => setText(e.target.value)}
        required
        maxLength={300}
        rows={3}
      />

      {status === "error" && (
        <p className={styles.formError}>Error al enviar. Intentá de nuevo.</p>
      )}

      <button className={styles.submitBtn} type="submit" disabled={loading}>
        {loading ? "Enviando..." : "Enviar reseña"}
      </button>
    </form>
  );
}

export default function Testimonials() {
  const [reviews, setReviews] = useState([]);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/reviews`)
      .then((r) => r.json())
      .then((data) => { setReviews(Array.isArray(data) ? data : []); })
      .catch(() => {});
  }, []);

  const all = [...STATIC, ...reviews];
  const displayed = showAll ? all : all.slice(0, 6);

  return (
    <section className={styles.section}>
      <h2 className={styles.title}>Lo que dicen nuestros clientes</h2>
      <p className={styles.subtitle}>Atletas reales, resultados reales.</p>

      <div className={styles.grid}>
        {displayed.map((r) => (
          <ReviewCard key={r._id} review={r} />
        ))}
      </div>

      {all.length > 6 && (
        <div className={styles.showMoreWrapper}>
          <button
            className={styles.showMoreBtn}
            onClick={() => setShowAll((v) => !v)}
          >
            {showAll ? "Ver menos ↑" : `Ver todas las reseñas (${all.length}) ↓`}
          </button>
        </div>
      )}

      <div className={styles.formWrapper}>
        <ReviewForm />
      </div>
    </section>
  );
}
