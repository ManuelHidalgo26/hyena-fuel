"use client";

import { useState } from "react";
import styles from "./Footer.module.css";
import Image from "next/image";
import Link from "next/link";
import logo from "../../../../public/images/hyena-fuel-logo.png";
import { FaInstagram, FaWhatsapp } from "react-icons/fa";

function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState(null); // "success" | "error" | "duplicate"
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || loading) return;

    setLoading(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/newsletter`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        }
      );

      if (res.status === 201) {
        setStatus("success");
        setEmail("");
      } else if (res.status === 409) {
        setStatus("duplicate");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    } finally {
      setLoading(false);
    }
  };

  if (status === "success") {
    return <p className={styles.newsletterSuccess}>✓ ¡Suscripción exitosa! Te avisamos con novedades.</p>;
  }

  return (
    <form className={styles.newsletterForm} onSubmit={handleSubmit}>
      <input
        type="email"
        placeholder="Tu email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className={styles.newsletterInput}
        required
      />
      <button type="submit" className={styles.newsletterBtn} disabled={loading}>
        {loading ? "..." : "Suscribirse"}
      </button>
      {status === "duplicate" && (
        <p className={styles.newsletterNote}>Ya estás suscripto.</p>
      )}
      {status === "error" && (
        <p className={styles.newsletterNote}>Error al suscribirse. Intentá de nuevo.</p>
      )}
    </form>
  );
}

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.container}>

        {/* Logo + tagline */}
        <div className={styles.brand}>
          <Image src={logo} alt="HYENA Fuel" width={100} height={45} />
          <p className={styles.tagline}>Combustible para tu entrenamiento.</p>
        </div>

        {/* Links */}
        <nav className={styles.links}>
          <span className={styles.colTitle}>Navegación</span>
          <Link href="/">Inicio</Link>
          <Link href="/about">Nosotros</Link>
          <Link href="/#products">Productos</Link>
        </nav>

        {/* Info */}
        <div className={styles.info}>
          <span className={styles.colTitle}>Información</span>

          <div className={styles.shipping}>
            <span className={styles.shippingIcon}>🚚</span>
            <span>Envío gratis a Córdoba Capital en compras de +$120.000</span>
          </div>

          <div className={styles.payment}>
            <span className={styles.colTitle}>Medios de pago</span>
            <div className={styles.paymentBadges}>
              <span className={styles.badge}>💵 Efectivo</span>
              <span className={styles.badge}>🏦 Transferencia</span>
              <span className={styles.badge}>💳 Débito</span>
              <span className={styles.badge}>💳 Crédito</span>
            </div>
            <p className={styles.paymentNote}>
              Pagando con transferencia obtenés un 10% de descuento.
            </p>
          </div>
        </div>

        {/* Redes + Newsletter */}
        <div className={styles.social}>
          <span className={styles.colTitle}>Seguinos</span>
          <a href="https://www.instagram.com/hyenafuel/" target="_blank" rel="noopener noreferrer" className={styles.instaLink}>
            <FaInstagram />@hyenafuel
          </a>
          <a href="https://wa.me/549XXXXXXXXXX" target="_blank" rel="noopener noreferrer" className={styles.whatsappLink}>
            <FaWhatsapp />WhatsApp
          </a>

          <div className={styles.newsletter}>
            <span className={styles.colTitle}>Novedades y ofertas</span>
            <NewsletterForm />
          </div>
        </div>

      </div>

      {/* Bottom bar */}
      <div className={styles.bottomBar}>
        © {new Date().getFullYear()} HYENA FUEL — All rights reserved.
      </div>
    </footer>
  );
}
