"use client";

import styles from "./pedidos.module.css";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function PedidosClient() {
    const searchParams = useSearchParams();
    const router = useRouter();

    const key = searchParams.get("key");
    const ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_KEY;

    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);

    // 🔐 Protección básica
    useEffect(() => {
    if (key !== ADMIN_KEY) {
        router.replace("/");
    }
    }, [key, ADMIN_KEY, router]);

    //📦 Traer pedidos
    useEffect(() => {
    async function fetchOrders() {
        const res = await fetch(
        "https://hyena-fuel-api.onrender.com/api/orders",
        { cache: "no-store" }
        );
        const data = await res.json();
        setOrders(data);
        setLoading(false);
    }

    if (key === ADMIN_KEY) {
        fetchOrders();
    }
    }, [key, ADMIN_KEY]);

    if (loading) {
    return <p className={styles.loading}>Cargando pedidos...</p>;
    }

    return (
    <section className={styles.container}>
        <h1 className={styles.title}>📦 Pedidos</h1>

        <div className={styles.list}>
        {orders.map((order) => {
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

                <span
                    className={`${styles.status} ${styles[order.status]}`}
                >
                    {order.status}
                </span>
                </div>

                <p className={styles.name}>{order.customerName}</p>
                <p className={styles.phone}>📞 {order.customerPhone}</p>
                <p className={styles.email}>📧 {order.customerEmail}</p>

                <p className={styles.total}>
                💰 ${order.totalAmount.toLocaleString("es-AR")}
                </p>

                <ul className={styles.items}>
                {order.items.map((item, index) => (
                    <li key={index}>
                    {item.quantity}× {item.name}
                    </li>
                ))}
                </ul>
            </div>
            );
        })}
        </div>
    </section>
    );
}
