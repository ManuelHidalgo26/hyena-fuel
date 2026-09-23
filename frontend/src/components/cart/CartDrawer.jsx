"use client";

import { useState, useEffect, useRef } from "react";
import NextImage from "next/image";
import styles from "./CartDrawer.module.css";
import { useCart, toOrderItemsPayload } from "../../context/CartContext";
import { trackEvent, GA_EVENTS } from "../../lib/ga";
import { fbTrack } from "../../lib/fbpixel";
import { TRANSFER_ALIAS } from "../../lib/payment";

/** Copy exacto de la carrera perdida al finalizar (spec §6.3) — NO confiar en `error.message` del 409 (ver §B.6). */
const COUPON_UNAVAILABLE_AT_CHECKOUT_MESSAGE =
  "El código ya no está disponible — podés finalizar tu compra sin él";

/**
 * Previsualiza un código de descuento contra el carrito actual (ADR 0010 §5.1).
 * Siempre resuelve a `{valid, ...}` o `{valid:false, reason}` — nunca rechaza
 * (errores de red/parseo se traducen a un motivo legible).
 */
async function requestDiscountValidation({ code, cartItems, paymentMethod, deliveryMethod }) {
  let response;
  try {
    response = await fetch("/api/discount-codes/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        items: toOrderItemsPayload(cartItems),
        paymentMethod,
        deliveryMethod,
      }),
    });
  } catch (error) {
    console.error(error);
    return { valid: false, reason: "No pudimos validar el código. Probá de nuevo." };
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    return { valid: false, reason: data?.error || "No pudimos validar el código. Probá de nuevo." };
  }

  return data;
}

/**
 * Redondea a pesos enteros antes de mostrar (mismo criterio que `formatArs`
 * en `lib/discountCodes.ts:176`): `discountAmount`/`totalFinal` pueden traer
 * centavos (porcentaje del cupón sobre un subtotal impar) y el resto de la
 * tienda siempre muestra pesos enteros.
 */
function formatArs(amount) {
  return Math.round(amount).toLocaleString("es-AR");
}

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
  const [note, setNote] = useState("");
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [orderTotal, setOrderTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const processingRef = useRef(false);

  const [paymentMethod, setPaymentMethod] = useState("transferencia");
  const [deliveryMethod, setDeliveryMethod] = useState("envio");

  const [aliasCopied, setAliasCopied] = useState(false);
  const aliasCopyTimeoutRef = useRef(null);

  // Código de descuento (ADR 0010, CD5): máquina de 4 estados idle/validating/applied/invalid.
  const [couponInput, setCouponInput] = useState("");
  const [couponStatus, setCouponStatus] = useState("idle");
  const [appliedCoupon, setAppliedCoupon] = useState(null); // {code, discountType, discountValue, discountAmount}
  const [couponErrorMessage, setCouponErrorMessage] = useState("");
  const couponInputRef = useRef(null);
  // Espejo de `appliedCoupon` en un ref: el efecto de re-validación abajo solo debe
  // reaccionar a cambios de carrito/método (no a los suyos propios), así que lee el
  // cupón vigente sin declararlo como dependencia (evita loop de renders).
  const appliedCouponRef = useRef(null);

  // `subtotal` ya viene con el descuento por transferencia/efectivo aplicado
  // (getSubtotalByPaymentMethod usa transferPrice cuando corresponde), igual que
  // el servidor (lib/orders.calculateOrderTotals → payableSubtotal). `discount`
  // es solo el monto ahorrado, para mostrarlo — NO se vuelve a restar (eso era el
  // doble descuento). Total a pagar = subtotal (ya con descuento) + envío − cupón.
  const subtotal = getSubtotalByPaymentMethod(paymentMethod);
  const discount = getDiscountByPaymentMethod(paymentMethod);
  const shippingCost = getShippingCost(paymentMethod);
  const missingForFree = getMissingForFreeShipping(paymentMethod);
  const effectiveShipping = deliveryMethod === "retiro" ? 0 : shippingCost;
  const couponDiscountAmount = appliedCoupon?.discountAmount ?? 0;
  const totalFinal = subtotal + effectiveShipping - couponDiscountAmount;

  useEffect(() => {
    appliedCouponRef.current = appliedCoupon;
  }, [appliedCoupon]);

  // Re-validar en silencio cuando cambian cantidades o método de pago (spec §6.1): el
  // descuento depende de `payableSubtotal`. No pasa por "validating" (no debe parpadear
  // el chip aplicado) — si sigue válido, actualiza el monto; si no, cae a "invalid".
  useEffect(() => {
    const current = appliedCouponRef.current;
    if (!current) return;

    let cancelled = false;

    (async () => {
      const result = await requestDiscountValidation({
        code: current.code,
        cartItems,
        paymentMethod,
        deliveryMethod,
      });
      if (cancelled) return;

      if (result.valid) {
        setAppliedCoupon((prev) =>
          prev && prev.code === result.code
            ? {
                code: result.code,
                discountType: result.discountType,
                discountValue: result.discountValue,
                discountAmount: result.discountAmount,
              }
            : prev
        );
      } else if (appliedCouponRef.current?.code === current.code) {
        // Guard contra respuesta stale (mismo criterio que la rama `valid` de arriba):
        // si el usuario ya quitó/cambió el cupón mientras este fetch estaba en vuelo,
        // no pisamos el estado que fijó explícitamente.
        setAppliedCoupon(null);
        setCouponStatus("invalid");
        setCouponErrorMessage(result.reason);
        setCouponInput("");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [cartItems, paymentMethod, deliveryMethod]);

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

  const handleApplyCoupon = async () => {
    const code = couponInput.trim();
    if (!code) return;

    setCouponStatus("validating");
    const result = await requestDiscountValidation({ code, cartItems, paymentMethod, deliveryMethod });

    if (result.valid) {
      setAppliedCoupon({
        code: result.code,
        discountType: result.discountType,
        discountValue: result.discountValue,
        discountAmount: result.discountAmount,
      });
      setCouponStatus("applied");
      setCouponInput("");
      setCouponErrorMessage("");
    } else {
      setCouponStatus("invalid");
      setCouponErrorMessage(result.reason);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponStatus("idle");
    setCouponInput("");
    setCouponErrorMessage("");
    // El input recién vuelve a montarse en este mismo commit; rAF espera al próximo
    // frame (ya pintado) para enfocarlo sin dejar el foco huérfano (§B.8).
    requestAnimationFrame(() => couponInputRef.current?.focus());
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
                ? <>Transferí <strong>${formatArs(orderTotal)}</strong> al alias <strong>{TRANSFER_ALIAS}</strong> (o coordinás el pago en efectivo) y enviános el comprobante. Retirá en <strong>Córdoba</strong>, coordinamos el lugar y el horario por WhatsApp.</>
                : <>Transferí <strong>${formatArs(orderTotal)}</strong> al alias <strong>{TRANSFER_ALIAS}</strong> (o coordinás el pago en efectivo) y enviános el comprobante por WhatsApp o Instagram para confirmar tu pedido.</>
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

    if (!name || !phone || (deliveryMethod === "envio" && !address)) {
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
        discountCode: appliedCoupon?.code,
        note,
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

      // Carrera perdida por el cupón (409, HY002 u otro código inválido — ver §B.6): la
      // verdad la fija el server al crear la orden. No confiamos en `error.message`
      // crudo del server acá — mostramos el copy exacto de la spec y dejamos que el
      // usuario finalice de nuevo sin el código, sin bloquear con un alert().
      if (error.status === 409 && appliedCoupon) {
        setAppliedCoupon(null);
        setCouponStatus("invalid");
        setCouponErrorMessage(COUPON_UNAVAILABLE_AT_CHECKOUT_MESSAGE);
        setCouponInput("");
      } else {
        alert("Error al crear el pedido. Intentá de nuevo.");
      }
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
                <li
                  key={`${item._id}-${item.flavor ?? "sin-sabor"}`}
                  className={styles.item}
                >
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
                    {item.flavor && (
                      <p className={styles.itemFlavor}>{item.flavor}</p>
                    )}

                    <p className={styles.price}>
                      ${unitPrice.toLocaleString("es-AR")}
                    </p>

                    <div className={styles.quantity}>
                      <button onClick={() => decrease(item._id, item.flavor)}>-</button>
                      <span>{item.quantity}</span>
                      <button onClick={() => increase(item._id, item.flavor)}>+</button>
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
              type="tel"
              placeholder="Teléfono"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />

            <input
              type="email"
              placeholder="Email (opcional)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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

          {/* NOTA DEL PEDIDO */}
          <div className={styles.form}>
            <label htmlFor="order-note" className={styles.noteLabel}>
              Nota para tu pedido (opcional)
            </label>
            <textarea
              id="order-note"
              className={styles.noteTextarea}
              placeholder="Contanos algo más: sabor, horario de entrega, si es un regalo…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              rows={3}
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

          {/* CÓDIGO DE DESCUENTO */}
          <div className={styles.couponBox}>
            <h3>Código de descuento</h3>

            {couponStatus === "applied" && appliedCoupon ? (
              <div className={styles.couponChipRow}>
                <span className={styles.couponChip}>
                  <span className={styles.couponChipCode}>{appliedCoupon.code}</span>
                  <span className={styles.couponChipAmount}>
                    −${formatArs(appliedCoupon.discountAmount)}
                  </span>
                </span>
                <button type="button" className={styles.couponRemoveBtn} onClick={handleRemoveCoupon}>
                  Quitar
                </button>
                {/* Anuncio para lectores de pantalla, copy exacto spec §6.3 — no duplicado
                    visualmente (el chip ya muestra código+monto de forma compacta). */}
                <span className={styles.srOnly} role="status" aria-live="polite">
                  Código aplicado: ahorrás ${formatArs(appliedCoupon.discountAmount)}
                </span>
              </div>
            ) : (
              <>
                <form
                  className={styles.couponRow}
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleApplyCoupon();
                  }}
                >
                  <label htmlFor="coupon-code" className={styles.srOnly}>
                    Código de descuento
                  </label>
                  <input
                    id="coupon-code"
                    ref={couponInputRef}
                    type="text"
                    className={styles.couponInput}
                    placeholder="Código de descuento"
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value)}
                    disabled={couponStatus === "validating"}
                    aria-invalid={couponStatus === "invalid"}
                    aria-describedby={couponStatus === "invalid" ? "coupon-error" : undefined}
                  />
                  <button
                    type="submit"
                    className={styles.couponApplyBtn}
                    disabled={couponStatus === "validating" || couponInput.trim() === ""}
                  >
                    {couponStatus === "validating" ? "Aplicando…" : "Aplicar"}
                  </button>
                </form>
                {couponStatus === "invalid" && (
                  <p id="coupon-error" className={styles.couponError} role="alert">
                    {couponErrorMessage}
                  </p>
                )}
              </>
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

            {appliedCoupon && (
              <div className={`${styles.summaryRow} ${styles.discountRow}`}>
                <span>Código {appliedCoupon.code}:</span>
                <strong>−${formatArs(appliedCoupon.discountAmount)}</strong>
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
              <strong>${formatArs(totalFinal)}</strong>
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
