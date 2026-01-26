import styles from "./pedidos.module.css";

async function getOrders() {
    const res = await fetch(
    "https://hyena-fuel-api.onrender.com/api/orders",
    { cache: "no-store" }
    );

    if (!res.ok) {
    throw new Error("Error cargando pedidos");
    }

    return res.json();
}

async function updateStatus(orderId, status) {
    "use server";

    await fetch(
    `https://hyena-fuel-api.onrender.com/api/orders/${orderId}/status`,
    {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
    }
    );
}

export default async function PedidosAdmin() {
    const orders = await getOrders();

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

                <span
                    className={`${styles.status} ${styles[order.status]}`}
                >
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
                    <form
                    action={updateStatus.bind(
                        null,
                        order._id,
                        "confirmed"
                    )}
                    >
                    <button className={styles.confirm}>
                        Confirmar pago
                    </button>
                    </form>
                )}

                {order.status !== "dispatched" && (
                    <form
                    action={updateStatus.bind(
                        null,
                        order._id,
                        "dispatched"
                    )}
                    >
                    <button className={styles.dispatch}>
                        Marcar despachado
                    </button>
                    </form>
                )}
                </div>
            </div>
            );
        })}
        </div>
    </section>
    );
}
