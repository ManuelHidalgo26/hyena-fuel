import { describe, expect, it } from "vitest";
import { hasUnapprovedOnlinePayment, isAbandonedCardOrder, isClearableOrder, isSaleOrder } from "./orders";

const NOW = new Date("2026-10-13T12:00:00.000Z");
const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * 60 * 60 * 1000).toISOString();

const cardOrder = {
  paymentMethod: "mercadopago",
  status: "pending",
  paymentStatus: "pending" as string | null,
  paidAt: null as string | null,
  createdAt: hoursAgo(25),
  needsReview: false,
};

describe("isSaleOrder", () => {
  it("transferencia (sin pago online) cuenta salvo que esté cancelada", () => {
    expect(isSaleOrder({ status: "pending", paymentStatus: null, paidAt: null })).toBe(true);
    expect(isSaleOrder({ status: "cancelled", paymentStatus: null, paidAt: null })).toBe(false);
  });

  it("tarjeta cuenta solo cuando está cobrada", () => {
    expect(isSaleOrder({ status: "pending", paymentStatus: "pending", paidAt: null })).toBe(false);
    expect(isSaleOrder({ status: "confirmed", paymentStatus: "approved", paidAt: hoursAgo(1) })).toBe(true);
    expect(isSaleOrder({ status: "cancelled", paymentStatus: "approved", paidAt: hoursAgo(1) })).toBe(false);
  });
});

describe("hasUnapprovedOnlinePayment", () => {
  it("es true solo con pago online sin paid_at", () => {
    expect(hasUnapprovedOnlinePayment({ paymentStatus: "pending", paidAt: null })).toBe(true);
    expect(hasUnapprovedOnlinePayment({ paymentStatus: null, paidAt: null })).toBe(false);
    expect(hasUnapprovedOnlinePayment({ paymentStatus: "approved", paidAt: hoursAgo(1) })).toBe(false);
  });
});

describe("isAbandonedCardOrder", () => {
  it("pedido con tarjeta sin pagar y con más de 24 h está abandonado", () => {
    expect(isAbandonedCardOrder(cardOrder, NOW)).toBe(true);
    expect(isAbandonedCardOrder({ ...cardOrder, paymentStatus: "rejected" }, NOW)).toBe(true);
  });

  it("no lo está antes de 24 h", () => {
    expect(isAbandonedCardOrder({ ...cardOrder, createdAt: hoursAgo(23) }, NOW)).toBe(false);
  });

  it("in_process e in_mediation nunca están abandonados", () => {
    expect(isAbandonedCardOrder({ ...cardOrder, paymentStatus: "in_process" }, NOW)).toBe(false);
    expect(isAbandonedCardOrder({ ...cardOrder, paymentStatus: "in_mediation" }, NOW)).toBe(false);
  });

  it("transferencia, pagados e históricos sin estado de pago no están abandonados", () => {
    expect(isAbandonedCardOrder({ ...cardOrder, paymentMethod: "transferencia", paymentStatus: null }, NOW)).toBe(false);
    expect(isAbandonedCardOrder({ ...cardOrder, paidAt: hoursAgo(2) }, NOW)).toBe(false);
    expect(isAbandonedCardOrder({ ...cardOrder, paymentStatus: null }, NOW)).toBe(false);
  });
});

describe("isClearableOrder", () => {
  it("limpia finalizados y abandonados", () => {
    const dispatched = { ...cardOrder, status: "dispatched", paymentStatus: "approved", paidAt: hoursAgo(30) };
    expect(isClearableOrder(dispatched, NOW)).toBe(true);
    expect(isClearableOrder(cardOrder, NOW)).toBe(true);
  });

  it("nunca limpia un pedido que requiere revisión", () => {
    expect(isClearableOrder({ ...cardOrder, status: "cancelled", needsReview: true }, NOW)).toBe(false);
  });

  it("no limpia un cancelado que ya se cobró", () => {
    expect(isClearableOrder({ ...cardOrder, status: "cancelled", paymentStatus: "approved", paidAt: hoursAgo(30) }, NOW)).toBe(false);
  });

  it("no limpia un pedido pendiente reciente", () => {
    expect(isClearableOrder({ ...cardOrder, createdAt: hoursAgo(1) }, NOW)).toBe(false);
  });
});
