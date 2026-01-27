import { Suspense } from "react";
import PedidosClient from "./PedidosClient";

export const dynamic = "force-dynamic";

export default function PedidosPage() {
    return (
    <Suspense fallback={<p style={{ padding: "2rem" }}>Cargando pedidos...</p>}>
        <PedidosClient />
    </Suspense>
    );
}
