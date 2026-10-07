import { AdminTableSkeleton } from "../../../components/admin";

export default function Loading() {
  return <AdminTableSkeleton rows={3} columns={3} label="Cargando tu panel…" />;
}
