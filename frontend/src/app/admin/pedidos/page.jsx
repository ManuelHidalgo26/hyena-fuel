"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import styles from "./pedidos.module.css";

const API_URL = "https://hyena-fuel-api.onrender.com/api/orders";
const ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_KEY;

export default function PedidosAdmin() {
  const searchParams = useSearchParams();
  const key = searchParams.get("key");

  const [authorized, setAuthorized] = useState(false);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  /* =========================
      AUTH SIMPLE POR KEY
  ========================= */
  useEffect(() => {
    if (key && key === ADMIN_KEY) {
      setAuthorized(true);
    } else {
      setAuthorized(false);
    }
  }, [key]);

  /* =========================
      FETCH PEDIDOS
  ========================= */
  useEffect(() => {
    if (!authorized) return;

    const fetchOrders = async () => {
      try {
        const res = await fetch(API_URL, { cache: "no-store" });
        const data = await res.json();
        setOrders(data);
      } catch (error) {
        console.error("❌ Error cargando pedidos", error);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [authorized]);

  /* =========================
      UPDATE STATUS
  ========================= */
  const updateStatus = async (orderId, status) => {
    await fetch(`${API_URL}/${orderId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

    // refrescar pedidos sin F5
    const res = await fetch(API_URL, { cache: "no-store" });
    setOrders(await res.json());
  };

  /* =========================
      BLOQUEO SI NO AUTORIZADO
  ========================= */
  if (!authorized) {
    return (
      <section className={styles.container}>
        <h1 className={styles.title}>⛔ Acceso restringido</h1>
        <p className={styles.error}>
          Clave inválida o inexistente.
        </p>
      </section>
    );
  }

  if (loading) {
    return (
      <section className={styles.container}>
        <p>Cargando pedidos...</p>
      </section>
    );
  }

  return (
    <section className={styles.container}>
      <h1 className={styles.title}>📦 Pedidos</h1>

      <div className={styles.list}>
        {orders.map((order) => {
          const date = new Date(order.createdAt);

          return (
            <div key={order._id} className={styles.card}>
              {/* HEADER */}
              <div className={styles.header}>
                <span className={styles.date}>
                  🕒 {date.toLocaleDateString("es-AR")}{" "}
                  {date.toLocaleTimeString("es-AR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>

                <span className={`${styles.status} ${styles[order.status]}`}>
                  {order.status}
                </span>
              </div>

              {/* CLIENTE */}
              <p className={styles.name}>{order.customerName}</p>
              <p className={styles.phone}>📞 {order.customerPhone}</p>
              <p className={styles.email}>📧 {order.customerEmail}</p>

              {/* TOTAL */}
              <p className={styles.total}>
                💰 ${order.totalAmount.toLocaleString("es-AR")}
              </p>

              {/* ITEMS */}
              <ul className={styles.items}>
                {order.items.map((item, index) => (
                  <li key={index}>
                    {item.quantity}× {item.name}
                  </li>
                ))}
              </ul>

              {/* ACCIONES */}
              <div className={styles.actions}>
                {order.status === "pending" && (
                  <button
                    className={styles.confirm}
                    onClick={() =>
                      updateStatus(order._id, "confirmed")
                    }
                  >
                    Confirmar pago
                  </button>
                )}

                {order.status !== "dispatched" && (
                  <button
                    className={styles.dispatch}
                    onClick={() =>
                      updateStatus(order._id, "dispatched")
                    }
                  >
                    Marcar despachado
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
