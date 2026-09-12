"use client";

import { useCart } from "../../context/CartContext";
import styles from "./ShippingBanner.module.css";

const STATIC_MESSAGES = [
  "📅 Envíos los miércoles — coordinás por WhatsApp",
  "🏦 10% OFF pagando por transferencia",
];

export default function ShippingBanner() {
  const { getMissingForFreeShipping, cartItems } = useCart();
  const missing = getMissingForFreeShipping("transferencia");
  const hasItems = cartItems.length > 0;
  const isFree = hasItems && missing === 0;

  let mainMessage = "🚚 Envío gratis a Córdoba Capital en compras superiores a $160.000";
  if (hasItems && missing > 0) {
    mainMessage = `🚚 Te faltan $${missing.toLocaleString("es-AR")} para envío gratis`;
  } else if (isFree) {
    mainMessage = "🎉 ¡Tenés envío gratis aplicado!";
  }

  const messages = [mainMessage, ...STATIC_MESSAGES];

  return (
    <div className={`${styles.banner} ${isFree ? styles.success : ""}`} aria-live="off">
      <div className={styles.track}>
        {messages.map((text, index) => (
          <span key={`msg-${index}`}>{text}</span>
        ))}
        {messages.map((text, index) => (
          <span key={`dup-${index}`} aria-hidden="true">{text}</span>
        ))}
      </div>
    </div>
  );
}
