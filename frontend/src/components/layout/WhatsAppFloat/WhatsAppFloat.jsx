import styles from "./WhatsAppFloat.module.css";

/**
 * Botón flotante de WhatsApp (spec Fase 2 §3.1/§11, tanda B1). Solo vive en
 * `(store)/layout.tsx`, así que nunca aparece en `/panel`.
 */
export default function WhatsAppFloat() {
  return (
    <a
      href="https://wa.me/5493519152450"
      target="_blank"
      rel="noopener noreferrer"
      className={styles.fab}
      aria-label="Escribir por WhatsApp"
    >
      <span aria-hidden="true">💬</span>
    </a>
  );
}
