"use client";

import { useState, useEffect, useRef } from "react";
import NextImage from "next/image";
import styles from "./CartDrawer.module.css";
import { useCart } from "../../context/CartContext";
import { trackEvent, GA_EVENTS } from "../../lib/ga";

export default function CartDrawer() {
  const {
    isCartOpen,
    closeCart,
    cartItems,
    increase,
    decrease,
    clearCart,

    getSubtotalByPaymentMethod,
    getDiscountByPaymentMethod,
    getShippingCost,
    getMissingForFreeShipping,

    checkout,
  } = useCart();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const processingRef = useRef(false);

  const [paymentMethod, setPaymentMethod] = useState("mercadopago");

  const subtotal = getSubtotalByPaymentMethod(paymentMethod);
  const discount = getDiscountByPaymentMethod(paymentMethod);
  const shippingCost = getShippingCost(paymentMethod);
  const missingForFree = getMissingForFreeShipping(paymentMethod);
  const totalFinal = subtotal - discount + shippingCost;

  useEffect(() => {
    if (isCartOpen && cartItems.length === 0) {
      closeCart();
    }
  }, [cartItems, isCartOpen, closeCart]);

  const WHATSAPP_MSG = encodeURIComponent(
    "Hola! Acabo de hacer un pedido en Hyena Fuel, les mando el comprobante."
  );

  if (orderSuccess) {
    return (
      <div className={styles.successOverlay}>
        <div className={styles.successBox}>
          <h2>✅ Pedido registrado</h2>
          <p>
            {paymentMethod === "mercadopago"
              ? "Te redirigimos a MercadoPago para completar el pago. Una vez aprobado, coordinamos el envío."
              : "Envianos el comprobante de transferencia por WhatsApp para confirmar tu pedido."}
          </p>

          <div className={styles.successActions}>
            <a
              href={`https://wa.me/549XXXXXXXXXX?text=${WHATSAPP_MSG}`}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.whatsappBtn}
            >
              💬 WhatsApp
            </a>
            <a
              href="https://www.instagram.com/hyenafuel/"
              target="_blank"
              rel="noopener noreferrer"
            >
              📸 Instagram
            </a>
          </div>

          <button onClick={() => setOrderSuccess(false)}>Cerrar</button>
        </div>
      </div>
    );
  }

  if (!isCartOpen) return null;

  const handleCheckout = async () => {
    if (processingRef.current) return;

    if (!name || !email || !phone || !address) {
      alert("Completá todos tus datos antes de continuar.");
      return;
    }

    processingRef.current = true;
    setIsLoading(true);

    try {
      const order = await checkout({
        name,
        email,
        phone,
        address,
        paymentMethod,
      });

      // GA4 purchase event
      trackEvent(GA_EVENTS.PURCHASE, {
        transaction_id: order._id,
        value: totalFinal,
        currency: "ARS",
        items: cartItems.map((item) => ({
          item_id: item._id,
          item_name: item.name,
          price: item.price,
          quantity: item.quantity,
        })),
      });

      if (paymentMethod === "mercadopago") {
        try {
          const payRes = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/api/payments/create`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                items: cartItems.map((item) => ({
                  name: item.name,
                  price: item.price,
                  quantity: item.quantity,
                })),
                orderId: order._id,
                customerEmail: email,
              }),
            }
          );
          const payData = await payRes.json();
          const checkoutUrl =
            payData.checkoutUrl ||
            "https://link.mercadopago.com.ar/hyenafuel";
          window.open(checkoutUrl, "_blank");
        } catch {
          window.open("https://link.mercadopago.com.ar/hyenafuel", "_blank");
        }
      }

      clearCart();
      closeCart();
      setOrderSuccess(true);
    } catch (error) {
      console.error(error);
      alert("Error al crear el pedido. Intentá de nuevo.");
    } finally {
      processingRef.current = false;
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className={styles.overlay} onClick={closeCart} />

      <aside className={styles.drawer}>
        <header className={styles.header}>
          <h2>Tu carrito</h2>
          <button
            className={styles.closeButton}
            onClick={closeCart}
            aria-label="Cerrar carrito"
          >
            ✕
          </button>
        </header>

        <div className={styles.content}>
          <ul className={styles.list}>
            {cartItems.map((item) => {
              const unitPrice =
                paymentMethod === "transferencia" &&
                typeof item.transferPrice === "number"
                  ? item.transferPrice
                  : item.price;

              return (
                <li key={item._id} className={styles.item}>
                  {item.image && (
                    <NextImage
                      src={item.image}
                      alt={item.name}
                      width={60}
                      height={60}
                      className={styles.image}
                    />
                  )}

                  <div className={styles.info}>
                    <p className={styles.name}>{item.name}</p>

                    <p className={styles.price}>
                      ${unitPrice.toLocaleString("es-AR")}
                    </p>

                    <div className={styles.quantity}>
                      <button onClick={() => decrease(item._id)}>-</button>
                      <span>{item.quantity}</span>
                      <button onClick={() => increase(item._id)}>+</button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* DATOS CLIENTE */}
          <div className={styles.form}>
            <h3>Datos de contacto</h3>

            <input
              type="text"
              placeholder="Nombre completo"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <input
              type="tel"
              placeholder="Teléfono"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />

            <input
              type="text"
              placeholder="Dirección de envío (calle, número, ciudad)"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>

          {/* MÉTODO DE PAGO */}
          <div className={styles.form}>
            <h3>Método de pago</h3>

            <label className={styles.radioLabel}>
              <input
                type="radio"
                checked={paymentMethod === "mercadopago"}
                onChange={() => setPaymentMethod("mercadopago")}
              />
              💳 Débito / Crédito (MercadoPago)
            </label>

            <label className={styles.radioLabel}>
              <input
                type="radio"
                checked={paymentMethod === "transferencia"}
                onChange={() => setPaymentMethod("transferencia")}
              />
              🏦 Transferencia bancaria&nbsp;
              <span className={styles.discountBadge}>10% OFF</span>
            </label>
          </div>

          {/* RESUMEN */}
          <div className={styles.summary}>
            <div className={styles.summaryRow}>
              <span>Subtotal:</span>
              <strong>${subtotal.toLocaleString("es-AR")}</strong>
            </div>

            {discount > 0 && (
              <div className={`${styles.summaryRow} ${styles.discountRow}`}>
                <span>Descuento transferencia:</span>
                <strong>- ${discount.toLocaleString("es-AR")}</strong>
              </div>
            )}

            <div className={styles.summaryRow}>
              <span>Envío:</span>
              <strong>
                {shippingCost === 0
                  ? "GRATIS"
                  : `$${shippingCost.toLocaleString("es-AR")}`}
              </strong>
            </div>

            {missingForFree > 0 ? (
              <p className={styles.freeShippingHint}>
                Te faltan ${missingForFree.toLocaleString("es-AR")} para envío gratis
              </p>
            ) : (
              <p className={styles.freeShippingSuccess}>
                ✓ Envío gratis aplicado
              </p>
            )}

            <div className={styles.grandTotal}>
              <span>Total a pagar:</span>
              <strong>${totalFinal.toLocaleString("es-AR")}</strong>
            </div>

            <div className={styles.actions}>
              <button
                className={styles.clearCart}
                onClick={() => {
                  clearCart();
                  closeCart();
                }}
              >
                Vaciar carrito
              </button>

              <button
                className={styles.checkout}
                onClick={handleCheckout}
                disabled={isLoading}
              >
                {isLoading ? "Procesando..." : "Finalizar compra"}
              </button>
            </div>

            {/* TRUST BADGES */}
            <div className={styles.trustBadges}>
              <span className={styles.trustBadge}>🔒 Pago seguro</span>
              <span className={styles.trustBadge}>🚚 Envío a todo Córdoba</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
