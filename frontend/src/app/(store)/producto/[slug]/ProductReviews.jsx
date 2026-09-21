"use client";

import { useEffect, useState } from "react";
import styles from "./ProductDetail.module.css";

const RATING_VALUES = [1, 2, 3, 4, 5];
const NAME_MAX_LENGTH = 60;
const TEXT_MAX_LENGTH = 300;

function average(reviews) {
  if (reviews.length === 0) return 0;
  const total = reviews.reduce((sum, review) => sum + review.rating, 0);
  return total / reviews.length;
}

/** Estrellas decorativas. `srLabel`, si se pasa, agrega el puntaje para lectores de pantalla. */
function Stars({ rating, srLabel }) {
  return (
    <>
      <div className={styles.reviewStars} aria-hidden="true">
        {RATING_VALUES.map((value) => (
          <span
            key={value}
            className={value <= rating ? styles.reviewStarFilled : styles.reviewStarEmpty}
          >
            ★
          </span>
        ))}
      </div>
      {srLabel && <span className={styles.srOnly}>{srLabel}</span>}
    </>
  );
}

function ReviewCard({ review }) {
  const date = new Date(review.createdAt).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return (
    <li className={styles.reviewCard}>
      <Stars rating={review.rating} srLabel={`${review.rating} de 5 estrellas`} />
      <p className={styles.reviewText}>&ldquo;{review.text}&rdquo;</p>
      <div className={styles.reviewMeta}>
        <span className={styles.reviewAuthor}>{review.name}</span>
        <span className={styles.reviewDate}>{date}</span>
      </div>
    </li>
  );
}

function RatingField({ rating, onChange }) {
  return (
    <fieldset className={styles.reviewRatingField}>
      <legend className={styles.reviewRatingLegend}>Tu puntaje</legend>
      <div className={styles.reviewRatingOptions}>
        {RATING_VALUES.map((value) => {
          const isFilled = value <= rating;
          const optionClassName = isFilled
            ? `${styles.reviewRatingOption} ${styles.reviewRatingOptionFilled}`
            : styles.reviewRatingOption;

          return (
            <label key={value} className={optionClassName}>
              <input
                type="radio"
                name="rating"
                className={styles.reviewRatingInput}
                value={value}
                checked={rating === value}
                onChange={() => onChange(value)}
                aria-label={`${value} estrella${value === 1 ? "" : "s"}`}
              />
              <span aria-hidden="true">★</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/**
 * Form de alta de reseña (ADR 0005 §4, spec-pdp-c1c3.md C3). La reseña entra
 * `approved=false` (moderación): a propósito NO se agrega a la lista de forma
 * optimista, solo se informa que quedó pendiente de aprobación.
 */
function ReviewForm({ productId }) {
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [rating, setRating] = useState(5);
  const [status, setStatus] = useState("idle"); // idle | loading | success | error
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (status === "loading") return;

    setStatus("loading");
    setErrorMessage("");

    try {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, text, rating, productId }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setErrorMessage(body?.error ?? "No se pudo enviar la reseña. Probá de nuevo.");
        setStatus("error");
        return;
      }

      setName("");
      setText("");
      setRating(5);
      setStatus("success");
    } catch {
      setErrorMessage("No se pudo enviar la reseña. Probá de nuevo.");
      setStatus("error");
    }
  };

  if (status === "success") {
    return (
      <p className={styles.reviewFormSuccess} role="status">
        ¡Gracias por tu reseña! Queda pendiente de aprobación antes de publicarse.
      </p>
    );
  }

  return (
    <form className={styles.reviewForm} onSubmit={handleSubmit}>
      <h3 className={styles.reviewFormTitle}>Dejá tu reseña</h3>

      <RatingField rating={rating} onChange={setRating} />

      <label className={styles.reviewFormLabel} htmlFor="review-name">
        Nombre
      </label>
      <input
        id="review-name"
        className={styles.reviewInput}
        type="text"
        value={name}
        onChange={(event) => setName(event.target.value)}
        required
        maxLength={NAME_MAX_LENGTH}
      />

      <label className={styles.reviewFormLabel} htmlFor="review-text">
        Tu experiencia
      </label>
      <textarea
        id="review-text"
        className={styles.reviewTextarea}
        value={text}
        onChange={(event) => setText(event.target.value)}
        required
        maxLength={TEXT_MAX_LENGTH}
        rows={3}
      />

      {status === "error" && (
        <p className={styles.reviewFormError} role="alert">
          {errorMessage}
        </p>
      )}

      <button className={styles.reviewSubmitBtn} type="submit" disabled={status === "loading"}>
        {status === "loading" ? "Enviando..." : "Enviar reseña"}
      </button>
    </form>
  );
}

/**
 * Reseñas por producto (ADR 0005 §4, spec-pdp-c1c3.md C3). Client Component:
 * necesita fetch + estado del form. Lista SOLO reseñas aprobadas de este
 * producto (`GET /api/reviews?productId=`); promedio/cantidad se derivan acá,
 * no se persisten.
 */
export default function ProductReviews({ productId }) {
  const [reviews, setReviews] = useState([]);
  const [loadStatus, setLoadStatus] = useState("loading"); // loading | ready | error

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/reviews?productId=${productId}`)
      .then((response) => {
        if (!response.ok) throw new Error("request failed");
        return response.json();
      })
      .then((data) => {
        if (cancelled) return;
        setReviews(Array.isArray(data) ? data : []);
        setLoadStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setLoadStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [productId]);

  const count = reviews.length;
  const avg = average(reviews);

  return (
    <section className={styles.reviewsSection} aria-labelledby="product-reviews-heading">
      <h2 id="product-reviews-heading" className={styles.reviewsHeading}>
        Reseñas
      </h2>

      {loadStatus === "loading" && <p className={styles.reviewsEmpty}>Cargando reseñas…</p>}

      {loadStatus === "error" && (
        <p className={styles.reviewsEmpty}>No se pudieron cargar las reseñas.</p>
      )}

      {loadStatus === "ready" && count > 0 && (
        <div className={styles.reviewsSummary}>
          <Stars rating={Math.round(avg)} />
          <span className={styles.reviewsSummaryText}>
            {avg.toFixed(1)} de 5 · {count} reseña{count === 1 ? "" : "s"}
          </span>
        </div>
      )}

      {loadStatus === "ready" && count === 0 && (
        <p className={styles.reviewsEmpty}>Sé el primero en dejar una reseña.</p>
      )}

      {count > 0 && (
        <ul className={styles.reviewsList}>
          {reviews.map((review) => (
            <ReviewCard key={review._id} review={review} />
          ))}
        </ul>
      )}

      <div className={styles.reviewFormWrapper}>
        <ReviewForm productId={productId} />
      </div>
    </section>
  );
}
