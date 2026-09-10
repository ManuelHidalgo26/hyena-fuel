import { AdminTableSkeleton } from "../../../components/admin";

export default function Loading() {
  return <AdminTableSkeleton rows={2} columns={6} label="Cargando resumen…" />;
}
