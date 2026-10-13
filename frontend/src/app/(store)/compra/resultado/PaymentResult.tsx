"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useCart } from "../../../../context/CartContext";
import { fbTrack } from "../../../../lib/fbpixel";
import { GA_EVENTS, trackEvent } from "../../../../lib/ga";
import {
  formatDelivery,
  formatOrderTotal,
  getResultView,
  getResultWhatsAppLink,
  parseReturnHint,
  shouldClearCart,
  type PaymentStatusResponse,
  type ResultAction,
  type ResultData,
  type ResultTone,
  type ResultViewKey,
} from "../../../../lib/paymentResult";
import { isUuid } from "../../../../lib/uuid";
import styles from "./PaymentResult.module.css";

const POLL_INTERVAL_MS = 3000;
const POLL_MAX_MS = 60_000;
const PENDING_STORAGE_KEY = "hf_mp_pending";
const PURCHASE_MARK_PREFIX = "hf_purchase_";

/** Datos que el carrito guardó antes de redirigir a Mercado Pago (`CartDrawer`). */
type PendingOrder = {
  orderId: string;
  value?: number;
  items?: Array<{ item_id: string; item_name: string; price: number; quantity: number }>;
  sellerCodeIgnored?: boolean;
  sellerCode?: string;
};

type Phase = {
  view: ResultViewKey;
  data?: PaymentStatusResponse;
  pending?: PendingOrder | null;
};

type FetchResult =
  | { kind: "ok"; data: PaymentStatusResponse }
  | { kind: "not_found" }
  | { kind: "error" };

const LOADING_PHASE: Phase = { view: "loading" };
const UNKNOWN_PHASE: Phase = { view: "unknown" };

async function fetchPaymentStatus(orderId: string, paymentId: string | null): Promise<FetchResult> {
  const query = paymentId ? `?payment_id=${encodeURIComponent(paymentId)}` : "";
  try {
    const response = await fetch(`/api/orders/${orderId}/payment${query}`, { cache: "no-store" });
    if (response.status === 404 || response.status === 400) return { kind: "not_found" };
    if (!response.ok) return { kind: "error" };
    return { kind: "ok", data: (await response.json()) as PaymentStatusResponse };
  } catch {
    return { kind: "error" };
  }
}

function readPendingOrder(orderId: string): PendingOrder | null {
  try {
    const raw = sessionStorage.getItem(PENDING_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingOrder;
    return parsed.orderId === orderId ? parsed : null;
  } catch {
    return null;
  }
}

/** Registra `purchase` en GA y Pixel una sola vez por pedido (marca en localStorage). */
function trackPurchaseOnce(data: PaymentStatusResponse, pending: PendingOrder | null): void {
  const markKey = `${PURCHASE_MARK_PREFIX}${data.orderId}`;
  try {
    if (localStorage.getItem(markKey)) return;
    localStorage.setItem(markKey, "1");
  } catch {
    return;
  }

  const value = pending?.value ?? data.totalFinal;
  const items = pending?.items ?? [];
  trackEvent(GA_EVENTS.PURCHASE, { transaction_id: data.orderId, value, currency: "ARS", items });
  fbTrack("Purchase", {
    content_ids: items.map((item) => item.item_id),
    content_type: "product",
    value,
    currency: "ARS",
    num_items: items.reduce((sum, item) => sum + item.quantity, 0),
  });
  sessionStorage.removeItem(PENDING_STORAGE_KEY);
}

function toPhase(data: PaymentStatusResponse): Phase {
  return { view: data.state, data, pending: readPendingOrder(data.orderId) };
}

export default function PaymentResult() {
  const searchParams = useSearchParams();
  // `CartContext` es JSX sin tipos: se declara acá lo único que esta página usa.
  const { clearCart, openCart } = useCart() as { clearCart: () => void; openCart: () => void };

  const rawOrderId = searchParams.get("external_reference");
  const orderId = rawOrderId && isUuid(rawOrderId) ? rawOrderId : null;
  const paymentId = searchParams.get("payment_id") ?? searchParams.get("collection_id");
  const hint = parseReturnHint(searchParams.get("r"));

  const [phase, setPhase] = useState<Phase>(LOADING_PHASE);
  const [refreshing, setRefreshing] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  // Última vista cuyos efectos (foco, carrito, compra) ya se aplicaron: una vez por transición.
  const handledViewRef = useRef<ResultViewKey | null>(null);

  // Consulta el estado verificado. La primera vez espera hasta 60 s a que un pago en proceso se
  // resuelva (sin payment_id: la sincronización con MP ya se hizo en la primera consulta).
  useEffect(() => {
    if (!orderId) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const startedAt = Date.now();
    const maxWaitMs = attempt === 0 ? POLL_MAX_MS : 0;

    const poll = async (withPaymentId: boolean) => {
      const result = await fetchPaymentStatus(orderId, withPaymentId ? paymentId : null);
      if (cancelled) return;

      if (result.kind === "ok") {
        const isUnresolved = result.data.state === "pending" || result.data.state === "processing";
        if (isUnresolved && Date.now() - startedAt < maxWaitMs) {
          timer = setTimeout(() => poll(false), POLL_INTERVAL_MS);
          return;
        }
        setPhase(toPhase(result.data));
      } else {
        setPhase(result.kind === "not_found" ? UNKNOWN_PHASE : { view: "error" });
      }
      setRefreshing(false);
    };

    poll(true);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [orderId, paymentId, attempt]);

  const effectivePhase = orderId ? phase : UNKNOWN_PHASE;
  const { view, data, pending } = effectivePhase;

  const viewData: ResultData = useMemo(
    () => ({ shortId: data?.shortId, totalFinal: data?.totalFinal, deliveryMethod: data?.deliveryMethod }),
    [data]
  );
  const config = getResultView(view, viewData, hint);

  // Efectos de resolver el estado: título, foco al H1, carrito y compra en GA/Pixel.
  useEffect(() => {
    document.title = config.documentTitle;
    if (view === "loading" || handledViewRef.current === view) return;
    handledViewRef.current = view;

    const active = document.activeElement;
    const isOnControl = active instanceof HTMLButtonElement || active instanceof HTMLAnchorElement;
    if (!isOnControl) headingRef.current?.focus();

    if (shouldClearCart(view, Boolean(paymentId))) clearCart();
    if (view === "approved" && data) trackPurchaseOnce(data, pending ?? null);
  }, [view, config.documentTitle, data, pending, paymentId, clearCart]);

  const handleAction = (id: ResultAction["id"]) => {
    if (id === "open-cart") openCart();
    if (id === "refresh" || id === "retry") {
      setRefreshing(true);
      setAttempt((current) => current + 1);
    }
  };

  const showSellerNotice = pending?.sellerCodeIgnored && (view === "approved" || view === "processing");
  const isLoading = view === "loading";

  return (
    <section className={styles.page}>
      <div className={styles.card}>
        <div aria-live="polite" aria-atomic="true">
          <div className={`${styles.statusIcon} ${styles[config.tone]}`}>
            <StatusIcon tone={config.tone} />
          </div>
          <h1 ref={headingRef} tabIndex={-1} className={styles.title}>
            {config.title}
          </h1>
          {config.body.map((paragraph) => (
            <p key={paragraph} className={styles.body} role={isLoading ? "status" : undefined}>
              {paragraph}
            </p>
          ))}
        </div>

        {config.showDetails && (
          <dl className={styles.details}>
            <dt>Pedido</dt>
            <dd>
              <strong>#{viewData.shortId}</strong>
            </dd>
            {viewData.totalFinal !== undefined && (
              <>
                <dt>Total</dt>
                <dd>{formatOrderTotal(viewData.totalFinal)}</dd>
              </>
            )}
            <dt>Entrega</dt>
            <dd>{formatDelivery(viewData.deliveryMethod)}</dd>
          </dl>
        )}

        {showSellerNotice && (
          <p className={styles.notice} role="status">
            El código de vendedor <strong>{pending?.sellerCode}</strong> no está activo, así que no se asoció a tu
            pedido. Tu compra quedó registrada igual.
          </p>
        )}

        {config.actions.length > 0 && (
          <div className={styles.actions}>
            {config.actions.map((action, index) => (
              <ActionControl
                key={action.id}
                action={action}
                position={index}
                busy={refreshing && (action.id === "refresh" || action.id === "retry")}
                whatsappHref={getResultWhatsAppLink(view, viewData)}
                onAction={handleAction}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

type ActionControlProps = {
  action: ResultAction;
  position: number;
  busy: boolean;
  whatsappHref: string;
  onAction: (id: ResultAction["id"]) => void;
};

function ActionControl({ action, position, busy, whatsappHref, onAction }: ActionControlProps) {
  const variant = position === 0 ? styles.btnPrimary : position === 1 ? styles.btnSecondary : styles.btnText;

  if (action.id === "whatsapp") {
    return (
      <a
        href={whatsappHref}
        target="_blank"
        rel="noopener noreferrer"
        className={`${styles.btn} ${styles.btnWhatsapp}`}
      >
        {action.label}
        <span className={styles.srOnly}> (se abre en otra pestaña)</span>
      </a>
    );
  }

  if (action.id === "continue-shopping" || action.id === "back-to-store") {
    return (
      <Link href="/" className={`${styles.btn} ${variant}`}>
        {action.label}
      </Link>
    );
  }

  return (
    <button
      type="button"
      className={`${styles.btn} ${variant}`}
      onClick={() => onAction(action.id)}
      aria-busy={busy}
      disabled={busy}
    >
      {busy ? "Consultando…" : action.label}
    </button>
  );
}

function StatusIcon({ tone }: { tone: ResultTone }): ReactNode {
  switch (tone) {
    case "success":
      return (
        <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      );
    case "warning":
      return (
        <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 7.5V12l3 2" />
        </svg>
      );
    case "danger":
      return (
        <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 7l10 10M17 7L7 17" />
        </svg>
      );
    case "neutral":
      return (
        <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9.5 9.5a2.5 2.5 0 114 2c-.9.7-1.5 1.2-1.5 2.3" />
          <path d="M12 17.5h.01" />
        </svg>
      );
    case "loading":
      return <span className={styles.spinner} aria-hidden="true" />;
  }
}
