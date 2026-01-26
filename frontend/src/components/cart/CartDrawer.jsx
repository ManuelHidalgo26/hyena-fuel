"use client";

import { useState } from "react";
import styles from "./CartDrawer.module.css";
import { useCart } from "../../context/CartContext";

export default function CartDrawer() {
  const {
    isCartOpen,
    closeCart,
    cartItems,
    increase,
    decrease,
    getTotalPrice,
    checkout,
  } = useCart();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  if (!isCartOpen) return null;

  const handleCheckout = async () => {
    if (!name || !email || !phone) {
      alert("Por favor completá tus datos de contacto antes de continuar.");
      return;
    }

    const mpWindow = window.open(
      "https://link.mercadopago.com.ar/hyenafuel",
      "_blank"
    );

    if (!mpWindow) {
      alert("Por favor habilitá los popups para continuar con el pago.");
      return;
    }

    try {
      const order = await checkout({
        name,
        email,
        phone,
      });

      console.log("✅ Pedido creado desde la web:", order);
      closeCart();
    } catch (error) {
      console.error(error);
      alert("Error al crear el pedido");
      mpWindow.close();
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
          {cartItems.length === 0 ? (
            <p className={styles.empty}>El carrito está vacío</p>
          ) : (
            <>
              <ul className={styles.list}>
                {cartItems.map((item) => (
                  <li key={item._id} className={styles.item}>
                    {item.image && (
                      <img
                        src={item.image}
                        alt={item.name}
                        className={styles.image}
                      />
                    )}

                    <div className={styles.info}>
                      <p className={styles.name}>{item.name}</p>
                      <p className={styles.price}>${item.price}</p>

                      <div className={styles.quantity}>
                        <button onClick={() => decrease(item._id)}>-</button>
                        <span>{item.quantity}</span>
                        <button onClick={() => increase(item._id)}>+</button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              {/* DATOS DEL CLIENTE */}
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
              </div>

              <div className={styles.summary}>
                <div className={styles.total}>
                  <span>Total del carrito</span>
                  <strong>${getTotalPrice()}</strong>
                </div>

                <div className={styles.payInfo}>
                  <p><strong>Monto a pagar en Mercado Pago:</strong></p>
                  <p className={styles.payAmount}>${getTotalPrice()}</p>
                  <p className={styles.payHint}>
                    Ingresá este monto al momento de pagar.Y recordá que debes enviar el comprobante de pago una vez realizado, para así poder ser despachado
                  </p>
                </div>

                <button
                  className={styles.checkout}
                  onClick={handleCheckout}
                >
                  Finalizar compra
                </button>
              </div>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
