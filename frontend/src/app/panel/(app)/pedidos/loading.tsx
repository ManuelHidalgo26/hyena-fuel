import { AdminTableSkeleton } from "../../../../components/admin";

export default function Loading() {
  return <AdminTableSkeleton rows={6} columns={6} label="Cargando pedidos…" />;
}
