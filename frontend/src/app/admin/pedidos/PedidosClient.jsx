"use client";

import styles from "./pedidos.module.css";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_KEY;

export default function PedidosClient() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const key = searchParams.get("key");

    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("all"); // all | mercadopago | transferencia

    // 🔐 Protección mínima
    useEffect(() => {
    if (key !== ADMIN_KEY) {
        router.replace("/");
        return;
    }

    fetch("https://hyena-fuel-api.onrender.com/api/orders", {
        cache: "no-store",
    })
        .then((res) => res.json())
        .then((data) => {
        setOrders(data);
        setLoading(false);
        });
    }, [key, router]);

    const updateStatus = async (orderId, status) => {
    await fetch(
        `https://hyena-fuel-api.onrender.com/api/orders/${orderId}/status`,
        {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
        }
    );

    setOrders((prev) =>
        prev.map((o) => (o._id === orderId ? { ...o, status } : o))
    );
    };

    const filteredOrders = useMemo(() => {
    if (filter === "all") return orders;
    return orders.filter((o) => o.paymentMethod === filter);
    }, [orders, filter]);

    if (loading) {
    return <p className={styles.loading}>Cargando pedidos...</p>;
    }

    return (
    <section className={styles.container}>
        <h1 className={styles.title}>📦 Pedidos</h1>

        {/* FILTRO */}
        <div className={styles.filters}>
        <button
            className={filter === "all" ? styles.active : ""}
            onClick={() => setFilter("all")}
        >
            Todos
        </button>
        <button
            className={filter === "transferencia" ? styles.active : ""}
            onClick={() => setFilter("transferencia")}
        >
            Transferencia
        </button>
        <button
            className={filter === "mercadopago" ? styles.active : ""}
            onClick={() => setFilter("mercadopago")}
        >
            Mercado Pago
        </button>
        </div>

        <div className={styles.list}>
        {filteredOrders.map((order) => {
            const date = new Date(order.createdAt);

            return (
            <div key={order._id} className={styles.card}>
                <div className={styles.header}>
                <span className={styles.date}>
                    🕒 {date.toLocaleDateString("es-AR")}{" "}
                    {date.toLocaleTimeString("es-AR", {
                    hour: "2-digit",
                    minute: "2-digit",
                    })}
                </span>

                <div className={styles.badges}>
                    <span
                    className={`${styles.badge} ${
                        order.paymentMethod === "transferencia"
                        ? styles.transferencia
                        : styles.mercadopago
                    }`}
                    >
                    {order.paymentMethod === "transferencia"
                        ? "TRANSFERENCIA"
                        : "MERCADO PAGO"}
                    </span>

                    <span
                    className={`${styles.status} ${styles[order.status]}`}
                    >
                    {order.status}
                    </span>
                </div>
                </div>

                <p className={styles.name}>{order.customerName}</p>
                <p className={styles.phone}>📞 {order.customerPhone}</p>
                <p className={styles.email}>📧 {order.customerEmail}</p>

                {/* DESGLOSE */}
                <div className={styles.prices}>
                <p>Subtotal: ${order.subtotal?.toLocaleString("es-AR")}</p>

                {order.discount > 0 && (
                    <p className={styles.discount}>
                    Descuento: -$
                    {order.discount.toLocaleString("es-AR")}
                    </p>
                )}

                <p>
                    Envío:{" "}
                    {order.shippingCost === 0
                    ? "GRATIS"
                    : `$${order.shippingCost.toLocaleString("es-AR")}`}
                </p>

                <p className={styles.total}>
                    💰 Total: $
                    {order.totalFinal?.toLocaleString("es-AR")}
                </p>
                </div>

                <ul className={styles.items}>
                {order.items.map((item, i) => (
                    <li key={i}>
                    {item.quantity}× {item.name}
                    </li>
                ))}
                </ul>

                <div className={styles.actions}>
                {order.status === "pending" && (
                    <button
                    className={styles.confirm}
                    onClick={() => updateStatus(order._id, "confirmed")}
                    >
                    Confirmar pago
                    </button>
                )}

                {order.status !== "dispatched" && (
                    <button
                    className={styles.dispatch}
                    onClick={() => updateStatus(order._id, "dispatched")}
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
