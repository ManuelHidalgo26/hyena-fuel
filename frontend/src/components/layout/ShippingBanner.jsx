"use client";

import { useCart } from "../../context/CartContext";
import styles from "./ShippingBanner.module.css";

export default function ShippingBanner() {
  const { getMissingForFreeShipping, cartItems } = useCart();
  const missing = getMissingForFreeShipping("mercadopago");
  const hasItems = cartItems.length > 0;

  let message = "";

  if (!hasItems) {
    message = "🚚 Envío gratis a Córdoba Capital en compras superiores a $120.000";
  } else if (missing > 0) {
    message = `🚚 Te faltan $${missing.toLocaleString("es-AR")} para envío gratis`;
  } else {
    message = "🎉 ¡Tenés envío gratis aplicado!";
  }

  return (
    <div className={`${styles.banner} ${missing === 0 && hasItems ? styles.success : ""}`}>
      <div className={styles.track}>
  <span>{message}</span>
  <span>{message}</span>
  <span>{message}</span>
  <span>{message}</span>
  <span>{message}</span>
  <span>{message}</span>
  <span>{message}</span>
  <span>{message}</span>
  <span>{message}</span>
  <span>{message}</span>
  <span>{message}</span>
</div>
    </div>
  );
}