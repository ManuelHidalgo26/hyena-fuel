import { Suspense } from "react";
import PedidosClient from "./PedidosClient";

export default function Page() {
    return (
    <Suspense fallback={<p style={{ padding: "2rem" }}>Cargando pedidos...</p>}>
        <PedidosClient />
    </Suspense>
    );
}
