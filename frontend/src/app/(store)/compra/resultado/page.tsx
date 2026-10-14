import { Suspense } from "react";
import type { Metadata } from "next";
import PaymentResult from "./PaymentResult";

export const metadata: Metadata = {
  title: "Confirmando tu pago — HYENA FUEL",
  robots: { index: false, follow: false },
};

/**
 * Página de retorno de Mercado Pago. Estática a propósito (regla ISR de `(store)`): no lee
 * `searchParams` en el servidor; el Client Component consulta el estado verificado del pago.
 */
export default function PaymentResultPage() {
  return (
    <Suspense fallback={null}>
      <PaymentResult />
    </Suspense>
  );
}
