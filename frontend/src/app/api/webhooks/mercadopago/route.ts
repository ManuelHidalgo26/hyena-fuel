import type { NextRequest } from "next/server";
import { handleMercadoPagoWebhook } from "../../../../lib/mercadopago/webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Notificaciones de pago de Mercado Pago (ver `lib/mercadopago/webhook.ts`). */
export function POST(request: NextRequest) {
  return handleMercadoPagoWebhook(request);
}
