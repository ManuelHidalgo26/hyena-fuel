"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AdminPageHeader,
  AdminButton,
  AdminFilterTabs,
  AdminTable,
  AdminModal,
  AdminEmptyState,
  OrderStatusBadge,
  PaymentMethodBadge,
  DeliveryMethodBadge,
} from "../../../../components/admin";
import styles from "../../../../components/admin/admin.module.css";
import type { AdminOrder, OrderStatus } from "../../../../lib/admin/orders";
import { readErrorMessage } from "../../../../lib/admin/http";

type PaymentFilter = "all" | "transferencia" | "mercadopago";

const COMPLETED_STATUSES: OrderStatus[] = ["dispatched", "paid", "cancelled"];

const PAYMENT_FILTER_OPTIONS: Array<{ value: PaymentFilter; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "transferencia", label: "Transferencia" },
  { value: "mercadopago", label: "Mercado Pago" },
];

type StatusAction = { label: string; nextStatus: OrderStatus };

/** Botones de transición disponibles según el estado actual (paridad con el admin viejo). */
function getStatusActions(order: AdminOrder): StatusAction[] {
  const actions: StatusAction[] = [];
  if (order.status === "pending") {
    actions.push({ label: "Confirmar", nextStatus: "confirmed" });
  }
  if (order.status === "pending" || order.status === "confirmed") {
    actions.push({ label: "Despachar", nextStatus: "dispatched" });
  }
  return actions;
}

function canCancel(order: AdminOrder): boolean {
  return order.status === "pending" || order.status === "confirmed";
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  const day = date.toLocaleDateString("es-AR");
  const time = date.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  return `${day} ${time}`;
}

type PedidosClientProps = {
  initialOrders: AdminOrder[];
};

/**
 * Mutaciones de Pedidos (spec Admin UI §1.1/§4): cambiar estado, cancelar
 * (destructivo, con confirmación) y limpiar finalizados (destructivo, con
 * confirmación). Filtro por medio de pago sobre la lista que trae el Server
 * Component padre. Toda mutación exitosa dispara `router.refresh()`.
 */
export default function PedidosClient({ initialOrders }: PedidosClientProps) {
  const router = useRouter();
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("all");
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<AdminOrder | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [clearModalOpen, setClearModalOpen] = useState(false);
  const [clearLoading, setClearLoading] = useState(false);

  const filteredOrders = useMemo(() => {
    if (paymentFilter === "all") return initialOrders;
    return initialOrders.filter((order) => order.paymentMethod === paymentFilter);
  }, [initialOrders, paymentFilter]);

  const completedCount = useMemo(
    () => initialOrders.filter((order) => COMPLETED_STATUSES.includes(order.status)).length,
    [initialOrders]
  );

  async function updateStatus(orderId: string, status: OrderStatus) {
    setMutationError(null);
    setUpdatingOrderId(orderId);
    try {
      const response = await fetch(`/api/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        setMutationError(await readErrorMessage(response, "No se pudo actualizar el pedido"));
        return;
      }
      router.refresh();
    } finally {
      setUpdatingOrderId(null);
    }
  }

  async function handleCancelConfirm() {
    if (!cancelTarget) return;
    setCancelLoading(true);
    setMutationError(null);
    try {
      const response = await fetch(`/api/orders/${cancelTarget._id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });
      if (!response.ok) {
        setMutationError(await readErrorMessage(response, "No se pudo cancelar el pedido"));
        return;
      }
      setCancelTarget(null);
      router.refresh();
    } finally {
      setCancelLoading(false);
    }
  }

  async function handleClearConfirm() {
    setClearLoading(true);
    setMutationError(null);
    try {
      const response = await fetch("/api/orders/completed", { method: "DELETE" });
      if (!response.ok) {
        setMutationError(await readErrorMessage(response, "No se pudieron limpiar los pedidos finalizados"));
        return;
      }
      setClearModalOpen(false);
      router.refresh();
    } finally {
      setClearLoading(false);
    }
  }

  return (
    <>
      <AdminPageHeader
        title="Pedidos"
        description="Todos los pedidos, más recientes primero."
        action={
          completedCount > 0 ? (
            <AdminButton variant="danger" onClick={() => setClearModalOpen(true)}>
              Limpiar finalizados ({completedCount})
            </AdminButton>
          ) : undefined
        }
      />

      {mutationError && (
        <p className={`${styles.banner} ${styles.bannerError}`} role="alert">
          {mutationError}
        </p>
      )}

      {initialOrders.length > 0 && (
        <AdminFilterTabs<PaymentFilter>
          label="Filtrar por medio de pago"
          value={paymentFilter}
          onChange={setPaymentFilter}
          options={PAYMENT_FILTER_OPTIONS}
        />
      )}

      {initialOrders.length === 0 ? (
        <AdminEmptyState
          title="No hay pedidos todavía"
          description="Cuando entre el primer pedido, va a aparecer acá."
        />
      ) : filteredOrders.length === 0 ? (
        <AdminEmptyState
          title="No hay pedidos con ese medio de pago"
          description="Probá con otro filtro."
        />
      ) : (
        <AdminTable caption="Listado de pedidos">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Cliente</th>
              <th>Ítems</th>
              <th>Medio de pago</th>
              <th>Entrega</th>
              <th>Estado</th>
              <th className={styles.cellNumeric}>Total</th>
              <th className={styles.cellActions}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.map((order) => {
              const isUpdating = updatingOrderId === order._id;
              const statusActions = getStatusActions(order);
              const showCancel = canCancel(order);

              return (
                <tr key={order._id} className={order.status === "cancelled" ? styles.rowInactive : undefined}>
                  <td className={styles.cellMuted}>{formatDate(order.createdAt)}</td>
                  <td>
                    <p className={styles.rowTitle}>{order.customerName}</p>
                    <p className={styles.rowSubtitle}>{order.customerPhone ?? order.customerEmail ?? "—"}</p>
                    {order.customerAddress && <p className={styles.rowSubtitle}>{order.customerAddress}</p>}
                  </td>
                  <td>
                    {order.items.map((item) => (
                      <p key={item.name} className={styles.rowSubtitle}>
                        {item.quantity}× {item.name}
                      </p>
                    ))}
                  </td>
                  <td>
                    <PaymentMethodBadge method={order.paymentMethod} />
                  </td>
                  <td>
                    <DeliveryMethodBadge method={order.deliveryMethod} />
                  </td>
                  <td>
                    <OrderStatusBadge status={order.status} />
                  </td>
                  <td className={styles.cellNumeric}>${order.totalFinal.toLocaleString("es-AR")}</td>
                  <td className={styles.cellActions}>
                    {statusActions.length === 0 && !showCancel ? (
                      <span className={styles.cellMuted}>—</span>
                    ) : (
                      <div className={styles.cellActionsInner}>
                        {statusActions.map((action) => (
                          <AdminButton
                            key={action.nextStatus}
                            size="sm"
                            loading={isUpdating}
                            onClick={() => updateStatus(order._id, action.nextStatus)}
                          >
                            {action.label}
                          </AdminButton>
                        ))}
                        {showCancel && (
                          <AdminButton
                            size="sm"
                            variant="danger"
                            disabled={isUpdating}
                            onClick={() => setCancelTarget(order)}
                          >
                            Cancelar
                          </AdminButton>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </AdminTable>
      )}

      <AdminModal
        open={cancelTarget !== null}
        title="¿Cancelar este pedido?"
        description={
          cancelTarget
            ? `El pedido de ${cancelTarget.customerName} pasa a estado cancelado. Esta acción no se puede deshacer.`
            : undefined
        }
        tone="danger"
        confirmLabel="Sí, cancelar pedido"
        confirmLoading={cancelLoading}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleCancelConfirm}
      />

      <AdminModal
        open={clearModalOpen}
        title="¿Limpiar pedidos finalizados?"
        description={`Se van a eliminar ${completedCount} pedido${completedCount === 1 ? "" : "s"} despachado(s), pagado(s) o cancelado(s). Esta acción no se puede deshacer.`}
        tone="danger"
        confirmLabel="Limpiar finalizados"
        confirmLoading={clearLoading}
        onClose={() => setClearModalOpen(false)}
        onConfirm={handleClearConfirm}
      />
    </>
  );
}
