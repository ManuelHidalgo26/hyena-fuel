"use client";

import styles from "./pedidos.module.css";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const API = "https://hyena-fuel-api.onrender.com";
const ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_KEY;

export default function PedidosClient() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const key = searchParams.get("key");

    const [tab, setTab] = useState("pedidos"); // "pedidos" | "suscriptores" | "resenas"
    const [orders, setOrders] = useState([]);
    const [subscribers, setSubscribers] = useState([]);
    const [pendingReviews, setPendingReviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("all");

    useEffect(() => {
        if (key !== ADMIN_KEY) {
            router.replace("/");
            return;
        }

        Promise.all([
            fetch(`${API}/api/orders`, { cache: "no-store" }).then((r) => r.json()),
            fetch(`${API}/api/newsletter`, { cache: "no-store" }).then((r) => r.json()),
            fetch(`${API}/api/reviews/pending`, { cache: "no-store" }).then((r) => r.json()),
        ]).then(([ordersData, subsData, reviewsData]) => {
            setOrders(ordersData);
            setSubscribers(subsData);
            setPendingReviews(Array.isArray(reviewsData) ? reviewsData : []);
            setLoading(false);
        });
    }, [key, router]);

    const approveReview = async (id) => {
        await fetch(`${API}/api/reviews/${id}/approve`, { method: "PATCH" });
        setPendingReviews((prev) => prev.filter((r) => r._id !== id));
    };

    const deleteReview = async (id) => {
        await fetch(`${API}/api/reviews/${id}`, { method: "DELETE" });
        setPendingReviews((prev) => prev.filter((r) => r._id !== id));
    };

    const updateStatus = async (orderId, status) => {
        await fetch(`${API}/api/orders/${orderId}/status`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status }),
        });
        setOrders((prev) =>
            prev.map((o) => (o._id === orderId ? { ...o, status } : o))
        );
    };

    const filteredOrders = useMemo(() => {
        if (filter === "all") return orders;
        return orders.filter((o) => o.paymentMethod === filter);
    }, [orders, filter]);

    if (loading) {
        return <p className={styles.loading}>Cargando...</p>;
    }

    return (
        <section className={styles.container}>
            <h1 className={styles.title}>Panel Admin</h1>

            {/* TABS */}
            <div className={styles.tabs}>
                <button
                    className={tab === "pedidos" ? styles.tabActive : styles.tab}
                    onClick={() => setTab("pedidos")}
                >
                    📦 Pedidos ({orders.length})
                </button>
                <button
                    className={tab === "suscriptores" ? styles.tabActive : styles.tab}
                    onClick={() => setTab("suscriptores")}
                >
                    📧 Suscriptores ({subscribers.length})
                </button>
                <button
                    className={tab === "resenas" ? styles.tabActive : styles.tab}
                    onClick={() => setTab("resenas")}
                >
                    ⭐ Reseñas {pendingReviews.length > 0 && `(${pendingReviews.length} pendiente${pendingReviews.length !== 1 ? "s" : ""})`}
                </button>
            </div>

            {/* ===== PEDIDOS ===== */}
            {tab === "pedidos" && (
                <>
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
                                            <span className={`${styles.status} ${styles[order.status]}`}>
                                                {order.status}
                                            </span>
                                        </div>
                                    </div>

                                    <p className={styles.name}>{order.customerName}</p>
                                    <p className={styles.phone}>📞 {order.customerPhone}</p>
                                    <p className={styles.email}>📧 {order.customerEmail}</p>
                                    {order.customerAddress && (
                                        <p className={styles.email}>📍 {order.customerAddress}</p>
                                    )}

                                    <div className={styles.prices}>
                                        <p>Subtotal: ${order.subtotal?.toLocaleString("es-AR")}</p>
                                        {order.discount > 0 && (
                                            <p className={styles.discount}>
                                                Descuento: -${order.discount.toLocaleString("es-AR")}
                                            </p>
                                        )}
                                        <p>
                                            Envío:{" "}
                                            {order.shippingCost === 0
                                                ? "GRATIS"
                                                : `$${order.shippingCost.toLocaleString("es-AR")}`}
                                        </p>
                                        <p className={styles.total}>
                                            💰 Total: ${order.totalFinal?.toLocaleString("es-AR")}
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
                </>
            )}

            {/* ===== SUSCRIPTORES ===== */}
            {/* ===== RESEÑAS ===== */}
            {tab === "resenas" && (
                <div className={styles.subsContainer}>
                    {pendingReviews.length === 0 ? (
                        <p className={styles.subsHint}>No hay reseñas pendientes de aprobación.</p>
                    ) : (
                        <>
                            <p className={styles.subsHint}>
                                {pendingReviews.length} reseña{pendingReviews.length !== 1 ? "s" : ""} esperando tu aprobación para publicarse.
                            </p>
                            <div className={styles.reviewsList}>
                                {pendingReviews.map((r) => (
                                    <div key={r._id} className={styles.reviewCard}>
                                        <div className={styles.reviewHeader}>
                                            <span className={styles.reviewName}>{r.name}</span>
                                            <span className={styles.reviewStars}>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
                                            <span className={styles.subDate}>
                                                {new Date(r.createdAt).toLocaleDateString("es-AR")}
                                            </span>
                                        </div>
                                        <p className={styles.reviewText}>&ldquo;{r.text}&rdquo;</p>
                                        <div className={styles.reviewActions}>
                                            <button className={styles.approveBtn} onClick={() => approveReview(r._id)}>
                                                ✓ Aprobar y publicar
                                            </button>
                                            <button className={styles.deleteBtn} onClick={() => deleteReview(r._id)}>
                                                ✗ Eliminar
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            )}

            {tab === "suscriptores" && (
                <div className={styles.subsContainer}>
                    <p className={styles.subsHint}>
                        {subscribers.length === 0
                            ? "Todavía no hay suscriptores."
                            : `${subscribers.length} persona${subscribers.length !== 1 ? "s" : ""} suscripta${subscribers.length !== 1 ? "s" : ""} para recibir novedades y ofertas.`}
                    </p>

                    {subscribers.length > 0 && (
                        <div className={styles.subsList}>
                            {subscribers.map((s, i) => (
                                <div key={s._id} className={styles.subRow}>
                                    <span className={styles.subIndex}>#{i + 1}</span>
                                    <span className={styles.subEmail}>{s.email}</span>
                                    <span className={styles.subDate}>
                                        {new Date(s.createdAt).toLocaleDateString("es-AR")}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </section>
    );
}
