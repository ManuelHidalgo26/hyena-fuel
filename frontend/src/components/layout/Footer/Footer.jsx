"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import logo from "../../../../public/images/hyena-fuel-logo.png";
import styles from "./Footer.module.css";

const NAV_LINKS = [
  { href: "/", label: "Inicio" },
  { href: "/#products", label: "Productos" },
  { href: "/como-comprar", label: "Cómo comprar" },
  { href: "/about", label: "Nosotros" },
];

const PAYMENT_BADGES = [
  "💵 Efectivo",
  "🏦 Transferencia (10% OFF)",
  "💳 Débito",
  "💳 Crédito",
];

function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState(null); // "success" | "error" | "duplicate"
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || loading) return;

    setLoading(true);
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

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
      <div className={styles.grid}>
        <div className={styles.brand}>
          <Image src={logo} alt="HYENA Fuel" width={110} height={45} />
          <p className={styles.tagline}>
            Combustible para tu entrenamiento. Suplementos deportivos en Córdoba, con
            las mejores marcas y atención directa por WhatsApp.
          </p>
          <div className={styles.social}>
            <a href="https://www.instagram.com/hyenafuel/" target="_blank" rel="noopener noreferrer">
              📸 @hyenafuel
            </a>
            <a href="https://wa.me/5493519152450" target="_blank" rel="noopener noreferrer">
              💬 WhatsApp
            </a>
          </div>
        </div>

        <div>
          <span className={styles.colTitle}>Navegación</span>
          <nav className={styles.links}>
            {NAV_LINKS.map((link) => (
              <Link key={link.href} href={link.href}>
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div>
          <span className={styles.colTitle}>Cómo comprar</span>
          <nav className={styles.links}>
            <Link href="/como-comprar">Ver el paso a paso</Link>
          </nav>
          <p className={styles.note}>📅 Envíos los miércoles a Córdoba</p>
          <p className={styles.note}>🏪 Retiro en Córdoba (coordinás por WhatsApp)</p>
          <p className={styles.note}>🔁 Cambios en productos sin abrir</p>
        </div>

        <div>
          <span className={styles.colTitle}>Contacto</span>
          <nav className={styles.links}>
            <a href="https://wa.me/5493519152450" target="_blank" rel="noopener noreferrer">
              💬 WhatsApp
            </a>
            <a href="https://www.instagram.com/hyenafuel/" target="_blank" rel="noopener noreferrer">
              📸 Instagram @hyenafuel
            </a>
          </nav>
          <p className={styles.note}>Córdoba Capital, Argentina</p>
        </div>

        <div>
          <span className={styles.colTitle}>Novedades y ofertas</span>
          <NewsletterForm />
        </div>
      </div>

      <div className={styles.middle}>
        <div className={styles.badgeRow} aria-label="Medios de pago aceptados">
          {PAYMENT_BADGES.map((badge) => (
            <span key={badge} className={styles.badgePill}>
              {badge}
            </span>
          ))}
        </div>
        <p className={styles.trust}>
          🏆 Trabajamos solo con las mejores marcas · 💬 Atención directa por WhatsApp ·
          🔁 Cambios en productos sin abrir
        </p>
      </div>

      <div className={styles.bottomBar}>
        © {new Date().getFullYear()} HYENA FUEL — Todos los derechos reservados.
      </div>
    </footer>
  );
}
