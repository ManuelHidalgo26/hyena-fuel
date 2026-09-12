"use client";

import { useState, useEffect, useRef } from "react";
import NextImage from "next/image";
import styles from "./CartDrawer.module.css";
import { useCart } from "../../context/CartContext";
import { trackEvent, GA_EVENTS } from "../../lib/ga";
import { fbTrack } from "../../lib/fbpixel";
import { TRANSFER_ALIAS } from "../../lib/payment";

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
  const [orderTotal, setOrderTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const processingRef = useRef(false);

  const [paymentMethod, setPaymentMethod] = useState("transferencia");
  const [deliveryMethod, setDeliveryMethod] = useState("envio");

  const [aliasCopied, setAliasCopied] = useState(false);
  const aliasCopyTimeoutRef = useRef(null);

  // `subtotal` ya viene con el descuento por transferencia/efectivo aplicado
  // (getSubtotalByPaymentMethod usa transferPrice cuando corresponde), igual que
  // el servidor (lib/orders.calculateOrderTotals → payableSubtotal). `discount`
  // es solo el monto ahorrado, para mostrarlo — NO se vuelve a restar (eso era el
  // doble descuento). Total a pagar = subtotal (ya con descuento) + envío.
  const subtotal = getSubtotalByPaymentMethod(paymentMethod);
  const discount = getDiscountByPaymentMethod(paymentMethod);
  const shippingCost = getShippingCost(paymentMethod);
  const missingForFree = getMissingForFreeShipping(paymentMethod);
  const effectiveShipping = deliveryMethod === "retiro" ? 0 : shippingCost;
  const totalFinal = subtotal + effectiveShipping;

  useEffect(() => {
    if (isCartOpen && cartItems.length === 0) {
      closeCart();
      return;
    }
    if (isCartOpen && cartItems.length > 0) {
      trackEvent(GA_EVENTS.VIEW_CART, {
        currency: "ARS",
        value: cartItems.reduce((s, i) => s + i.price * i.quantity, 0),
        items: cartItems.map((i) => ({ item_id: i._id, item_name: i.name, price: i.price, quantity: i.quantity })),
      });
    }
  }, [isCartOpen, cartItems, closeCart]);

  useEffect(() => {
    return () => {
      if (aliasCopyTimeoutRef.current) {
        clearTimeout(aliasCopyTimeoutRef.current);
      }
    };
  }, []);

  const handleCopyAlias = async () => {
    try {
      if (!navigator.clipboard) return;
      await navigator.clipboard.writeText(TRANSFER_ALIAS);
    } catch (error) {
      console.error(error);
      return;
    }

    setAliasCopied(true);
    if (aliasCopyTimeoutRef.current) {
      clearTimeout(aliasCopyTimeoutRef.current);
    }
    aliasCopyTimeoutRef.current = setTimeout(() => {
      setAliasCopied(false);
    }, 2000);
  };

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
              ? deliveryMethod === "retiro"
                ? <>¡Pedido registrado! Retirá en <strong>Córdoba</strong> — coordinamos el lugar, el horario y el pago con tarjeta (débito o crédito) por WhatsApp o Instagram.</>
                : "Recibimos tu pedido. Coordinamos el pago con tarjeta (débito o crédito) y la entrega por WhatsApp."
              : deliveryMethod === "retiro"
                ? <>Transferí <strong>${orderTotal.toLocaleString("es-AR")}</strong> al alias <strong>{TRANSFER_ALIAS}</strong> (o coordinás el pago en efectivo) y enviános el comprobante. Retirá en <strong>Córdoba</strong>, coordinamos el lugar y el horario por WhatsApp.</>
                : <>Transferí <strong>${orderTotal.toLocaleString("es-AR")}</strong> al alias <strong>{TRANSFER_ALIAS}</strong> (o coordinás el pago en efectivo) y enviános el comprobante por WhatsApp o Instagram para confirmar tu pedido.</>
            }
          </p>

          <div className={styles.successActions}>
            <a
              href={`https://wa.me/5493519152450?text=${WHATSAPP_MSG}`}
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
              className={styles.instagramBtn}
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

    if (!name || !email || !phone || (deliveryMethod === "envio" && !address)) {
      alert("Completá todos tus datos antes de continuar.");
      return;
    }

    processingRef.current = true;
    setIsLoading(true);

    // GA4 + FB begin_checkout / InitiateCheckout
    trackEvent(GA_EVENTS.BEGIN_CHECKOUT, {
      currency: "ARS",
      value: totalFinal,
      items: cartItems.map((i) => ({ item_id: i._id, item_name: i.name, price: i.price, quantity: i.quantity })),
    });
    fbTrack("InitiateCheckout", {
      content_ids: cartItems.map((i) => i._id),
      num_items: cartItems.reduce((s, i) => s + i.quantity, 0),
      value: totalFinal,
      currency: "ARS",
    });

    try {
      const order = await checkout({
        name,
        email,
        phone,
        address: deliveryMethod === "retiro" ? "Retiro en persona" : address,
        paymentMethod,
        deliveryMethod,
      });

      // GA4 purchase
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

      // Facebook Pixel purchase
      fbTrack("Purchase", {
        content_ids: cartItems.map((i) => i._id),
        content_type: "product",
        value: totalFinal,
        currency: "ARS",
        num_items: cartItems.reduce((s, i) => s + i.quantity, 0),
      });

      setOrderTotal(totalFinal);
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

          {/* ENTREGA */}
          <div className={styles.form}>
            <h3>Entrega</h3>

            <label className={styles.radioLabel}>
              <input
                type="radio"
                checked={deliveryMethod === "envio"}
                onChange={() => setDeliveryMethod("envio")}
              />
              🚚 Envío a domicilio
            </label>

            <label className={styles.radioLabel}>
              <input
                type="radio"
                checked={deliveryMethod === "retiro"}
                onChange={() => setDeliveryMethod("retiro")}
              />
              🏪 Retiro en persona&nbsp;
              <span className={styles.discountBadge}>¡SIN COSTO!</span>
            </label>
          </div>

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

            {deliveryMethod === "envio" && (
              <input
                type="text"
                placeholder="Dirección de envío (calle, número, ciudad)"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            )}
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
              💳 Débito / Crédito
            </label>

            <label className={styles.radioLabel}>
              <input
                type="radio"
                checked={paymentMethod === "transferencia"}
                onChange={() => setPaymentMethod("transferencia")}
              />
              🏦 Transferencia / Efectivo&nbsp;
              <span className={styles.discountBadge}>10% OFF</span>
            </label>

            {paymentMethod === "transferencia" && (
              <div className={styles.aliasBox}>
                <p className={styles.aliasBoxLabel}>Alias para transferir</p>

                <div className={styles.aliasRow}>
                  <span className={styles.aliasValue}>{TRANSFER_ALIAS}</span>
                  <button
                    type="button"
                    className={
                      aliasCopied
                        ? `${styles.copyAliasBtn} ${styles.copyAliasBtnCopied}`
                        : styles.copyAliasBtn
                    }
                    onClick={handleCopyAlias}
                    aria-live="polite"
                  >
                    {aliasCopied ? "✅ ¡Copiado!" : "📋 Copiar"}
                  </button>
                </div>

                <p className={styles.aliasHint}>
                  Transferí el total y enviános el comprobante por WhatsApp o
                  Instagram para confirmar tu pedido.
                </p>
              </div>
            )}
          </div>

          {/* RESUMEN */}
          <div className={styles.summary}>
            <div className={styles.summaryRow}>
              <span>Subtotal:</span>
              <strong>${subtotal.toLocaleString("es-AR")}</strong>
            </div>

            {discount > 0 && (
              <div className={`${styles.summaryRow} ${styles.discountRow}`}>
                <span>Ahorrás con transferencia/efectivo (10% OFF):</span>
                <strong>${discount.toLocaleString("es-AR")}</strong>
              </div>
            )}

            <div className={styles.summaryRow}>
              <span>Envío:</span>
              <strong>
                {deliveryMethod === "retiro"
                  ? <span className={styles.freeText}>Retiro sin costo</span>
                  : effectiveShipping === 0
                    ? "GRATIS"
                    : `$${effectiveShipping.toLocaleString("es-AR")}`}
              </strong>
            </div>

            {deliveryMethod === "envio" && missingForFree > 0 && (
              <p className={styles.freeShippingHint}>
                Te faltan ${missingForFree.toLocaleString("es-AR")} para envío gratis
              </p>
            )}
            {deliveryMethod === "envio" && missingForFree === 0 && (
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
