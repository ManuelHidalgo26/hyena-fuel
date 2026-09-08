import { AdminTableSkeleton } from "../../../../components/admin";

export default function Loading() {
  return <AdminTableSkeleton rows={5} columns={2} label="Cargando suscriptores…" />;
}
