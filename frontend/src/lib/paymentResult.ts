import { buildStoreWhatsAppLink } from "./whatsapp";

/**
 * Presentación de `/compra/resultado` (docs/design-mercadopago.md §2): tabla de estados →
 * textos y acciones. Pura, para que el componente cliente solo la renderice.
 */

/** Estado público del pago que devuelve `GET /api/orders/[id]/payment`. */
export type PaymentApiState = "approved" | "processing" | "failed" | "pending";

export type DeliveryMethodPublic = "envio" | "retiro";

export type PaymentStatusResponse = {
  orderId: string;
  shortId: string;
  state: PaymentApiState;
  totalFinal: number;
  deliveryMethod: DeliveryMethodPublic;
};

export type ResultViewKey = "loading" | "approved" | "processing" | "pending" | "failed" | "unknown" | "error";

/** Parámetro `r` de la `back_url`: solo elige el título provisional mientras carga. */
export type ReturnHint = "ok" | "pendiente" | "error" | null;

export type ResultTone = "success" | "warning" | "danger" | "neutral" | "loading";

export type ResultActionId =
  | "whatsapp"
  | "continue-shopping"
  | "back-to-store"
  | "refresh"
  | "open-cart"
  | "retry";

export type ResultAction = { id: ResultActionId; label: string };

export type ResultData = {
  shortId?: string;
  totalFinal?: number;
  deliveryMethod?: DeliveryMethodPublic;
};

export type ResultViewConfig = {
  documentTitle: string;
  title: string;
  tone: ResultTone;
  body: string[];
  actions: ResultAction[];
  /** Muestra el bloque Pedido / Total / Entrega. */
  showDetails: boolean;
};

const BRAND_SUFFIX = "HYENA FUEL";

const SHIPPING_NOTE = "Coordinamos el envío por WhatsApp. Los envíos salen los miércoles.";
const PICKUP_NOTE = "Coordinamos el lugar y el horario de retiro en Córdoba por WhatsApp.";

const PROVISIONAL_TITLES: Record<Exclude<ReturnHint, null>, string> = {
  ok: "Estamos confirmando tu pago",
  pendiente: "Estamos registrando tu pago",
  error: "Estamos revisando tu pago",
};

const DEFAULT_PROVISIONAL_TITLE = PROVISIONAL_TITLES.ok;

export function parseReturnHint(value: string | null): ReturnHint {
  return value === "ok" || value === "pendiente" || value === "error" ? value : null;
}

export function deliveryNote(deliveryMethod: DeliveryMethodPublic | undefined): string {
  return deliveryMethod === "retiro" ? PICKUP_NOTE : SHIPPING_NOTE;
}

export function formatDelivery(deliveryMethod: DeliveryMethodPublic | undefined): string {
  return deliveryMethod === "retiro" ? "Retiro en Córdoba" : "Envío a domicilio";
}

export function formatOrderTotal(total: number): string {
  return `$${Math.round(total).toLocaleString("es-AR")}`;
}

const REFRESH: ResultAction = { id: "refresh", label: "Actualizar estado" };
const WHATSAPP: ResultAction = { id: "whatsapp", label: "Escribir por WhatsApp" };

export function getResultView(view: ResultViewKey, data: ResultData = {}, hint: ReturnHint = null): ResultViewConfig {
  const orderRef = data.shortId ? `tu pedido #${data.shortId}` : "tu pedido";
  const hasOrder = Boolean(data.shortId);

  switch (view) {
    case "loading":
      return {
        documentTitle: `Confirmando tu pago — ${BRAND_SUFFIX}`,
        title: hint ? PROVISIONAL_TITLES[hint] : DEFAULT_PROVISIONAL_TITLE,
        tone: "loading",
        body: ["Esto lleva unos segundos. No cierres esta página."],
        actions: [],
        showDetails: false,
      };
    case "approved":
      return {
        documentTitle: `Pago aprobado — ${BRAND_SUFFIX}`,
        title: "¡Pago aprobado!",
        tone: "success",
        body: [
          `Recibimos tu pago y ${orderRef} está en marcha.${
            data.totalFinal === undefined ? "" : ` Total: ${formatOrderTotal(data.totalFinal)}.`
          }`,
          deliveryNote(data.deliveryMethod),
        ],
        actions: [{ id: "whatsapp", label: "Coordinar entrega por WhatsApp" }, { id: "continue-shopping", label: "Seguir comprando" }],
        showDetails: hasOrder,
      };
    case "processing":
      return {
        documentTitle: `Pago en proceso — ${BRAND_SUFFIX}`,
        title: "Tu pago se está procesando",
        tone: "warning",
        body: [
          `Mercado Pago lo está acreditando y puede demorar unos minutos. ${
            hasOrder ? `Tu pedido #${data.shortId} ya está registrado.` : "Tu pedido ya está registrado."
          } Apenas se confirme, coordinamos la entrega por WhatsApp.`,
        ],
        actions: [REFRESH, WHATSAPP, { id: "continue-shopping", label: "Seguir comprando" }],
        showDetails: hasOrder,
      };
    case "pending":
      return {
        documentTitle: `Esperando tu pago — ${BRAND_SUFFIX}`,
        title: "Estamos esperando la confirmación",
        tone: "warning",
        body: [
          "Si ya pagaste, puede tardar unos minutos en reflejarse. Apenas llegue, coordinamos la entrega por WhatsApp. Si todavía no pagaste, podés volver al carrito.",
        ],
        actions: [REFRESH, { id: "open-cart", label: "Volver al carrito" }, WHATSAPP],
        showDetails: false,
      };
    case "failed":
      return {
        documentTitle: `Pago no completado — ${BRAND_SUFFIX}`,
        title: "El pago no se completó",
        tone: "danger",
        body: [
          "Podés intentarlo de nuevo con otra tarjeta u otro medio de pago, o elegir transferencia o efectivo con 10% OFF. Tus productos siguen en el carrito.",
        ],
        actions: [{ id: "open-cart", label: "Volver al carrito" }, WHATSAPP, { id: "back-to-store", label: "Volver a la tienda" }],
        showDetails: false,
      };
    case "unknown":
      return {
        documentTitle: `No encontramos tu pedido — ${BRAND_SUFFIX}`,
        title: "No encontramos tu pedido",
        tone: "neutral",
        body: [
          "Si pagaste, quedate tranquilo/a: escribinos por WhatsApp con tu comprobante o el número de pedido y lo revisamos enseguida.",
        ],
        actions: [WHATSAPP, { id: "back-to-store", label: "Volver a la tienda" }],
        showDetails: false,
      };
    case "error":
      return {
        documentTitle: `No pudimos consultar el pago — ${BRAND_SUFFIX}`,
        title: "No pudimos ver el estado de tu pago",
        tone: "neutral",
        body: [
          "Puede ser un problema de conexión. Si ya pagaste, tu pedido queda registrado igual y lo vamos a ver. Probá de nuevo en unos segundos.",
        ],
        actions: [{ id: "retry", label: "Reintentar" }, WHATSAPP],
        showDetails: false,
      };
  }
}

/** Mensaje de WhatsApp prellenado según la vista (docs/design-mercadopago.md §2.5). */
export function getResultWhatsAppLink(view: ResultViewKey, data: ResultData = {}): string {
  const orderRef = data.shortId ? ` #${data.shortId}` : "";

  switch (view) {
    case "approved": {
      const goal = data.deliveryMethod === "retiro" ? "coordinar el retiro" : "coordinar la entrega";
      return buildStoreWhatsAppLink(`Hola! Pagué mi pedido${orderRef} con tarjeta en Hyena Fuel. Quiero ${goal}.`);
    }
    case "processing":
    case "pending":
      return buildStoreWhatsAppLink(
        `Hola! Tengo el pedido${orderRef} en Hyena Fuel con el pago en proceso. ¿Me ayudan a confirmarlo?`
      );
    case "failed":
      return buildStoreWhatsAppLink(
        "Hola! Quise pagar con tarjeta en Hyena Fuel y el pago no se completó. ¿Me ayudan con otra forma de pago?"
      );
    default:
      return buildStoreWhatsAppLink("Hola! Hice un pago en Hyena Fuel y no veo mi pedido. Les paso mi comprobante.");
  }
}

/**
 * ¿Hay que vaciar el carrito al mostrar esta vista? Con pago aprobado siempre; con pago en
 * proceso o pendiente solo si volvió con `payment_id` (si volvió con "Volver al sitio" sin
 * pagar, el carrito se conserva). Un pago fallido conserva el carrito.
 */
export function shouldClearCart(view: ResultViewKey, hasPaymentId: boolean): boolean {
  if (view === "approved") return true;
  return (view === "processing" || view === "pending") && hasPaymentId;
}
