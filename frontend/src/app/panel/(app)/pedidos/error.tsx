"use client";

import { AdminErrorState } from "../../../../components/admin";

export default function Error({ reset }: { reset: () => void }) {
  return <AdminErrorState message="No pudimos cargar los pedidos." onRetry={reset} />;
}
