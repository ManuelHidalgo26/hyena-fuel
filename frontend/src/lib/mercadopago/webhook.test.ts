import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getMercadoPagoClient: vi.fn(),
  getWebhookSecret: vi.fn(),
  fetchPayment: vi.fn(),
  syncPayment: vi.fn(),
  revalidateStorefront: vi.fn(),
  createAdminClient: vi.fn(),
}));

vi.mock("./client", () => ({
  getMercadoPagoClient: mocks.getMercadoPagoClient,
  getWebhookSecret: mocks.getWebhookSecret,
}));
vi.mock("./sync", () => ({ fetchPayment: mocks.fetchPayment, syncPayment: mocks.syncPayment }));
vi.mock("../revalidate", () => ({ revalidateStorefront: mocks.revalidateStorefront }));
vi.mock("../supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));

import { handleMercadoPagoWebhook } from "./webhook";

// Secreto inventado solo para los tests: no es ninguna credencial real.
const SECRET = "test-webhook-secret";
const PAYMENT_ID = "987654321";
const REQUEST_ID = "req-abc";
const ORDER_ID = "a1b2c3d4-0000-4000-8000-000000000001";

const payment = {
  id: PAYMENT_ID,
  status: "approved",
  statusDetail: "accredited",
  externalReference: ORDER_ID,
  amount: 105000,
  currency: "ARS",
  dateApproved: "2026-10-13T12:00:00.000-03:00",
  dateLastUpdated: "2026-10-13T12:00:01.000-03:00",
};

function signedRequest(options: { dataId?: string; type?: string; signature?: string; body?: unknown } = {}) {
  const dataId = options.dataId ?? PAYMENT_ID;
  const ts = String(Date.now());
  const v1 = createHmac("sha256", SECRET).update(`id:${dataId};request-id:${REQUEST_ID};ts:${ts};`).digest("hex");
  const query = new URLSearchParams({ "data.id": dataId, type: options.type ?? "payment" });

  return new NextRequest(`http://localhost/api/webhooks/mercadopago?${query}`, {
    method: "POST",
    headers: {
      "x-signature": options.signature ?? `ts=${ts},v1=${v1}`,
      "x-request-id": REQUEST_ID,
      "content-type": "application/json",
    },
    body: JSON.stringify(options.body ?? { action: "payment.updated", data: { id: dataId } }),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  mocks.getWebhookSecret.mockReturnValue(SECRET);
  mocks.getMercadoPagoClient.mockReturnValue({ accessToken: "fake" });
  mocks.fetchPayment.mockResolvedValue(payment);
  mocks.syncPayment.mockResolvedValue({ kind: "applied", orderId: ORDER_ID, outcome: "approved" });
});

describe("handleMercadoPagoWebhook", () => {
  it("firma inválida: 401 sin consultar a Mercado Pago ni tocar la base", async () => {
    const response = await handleMercadoPagoWebhook(signedRequest({ signature: `ts=${Date.now()},v1=${"a".repeat(64)}` }));

    expect(response.status).toBe(401);
    expect(mocks.fetchPayment).not.toHaveBeenCalled();
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
    expect(mocks.syncPayment).not.toHaveBeenCalled();
  });

  it("sin headers de firma: 401", async () => {
    const request = new NextRequest(`http://localhost/api/webhooks/mercadopago?data.id=${PAYMENT_ID}&type=payment`, {
      method: "POST",
      body: "{}",
    });

    expect((await handleMercadoPagoWebhook(request)).status).toBe(401);
  });

  it("sin MP_WEBHOOK_SECRET o sin token: falla cerrado con 500", async () => {
    mocks.getWebhookSecret.mockReturnValue(null);
    expect((await handleMercadoPagoWebhook(signedRequest())).status).toBe(500);

    mocks.getWebhookSecret.mockReturnValue(SECRET);
    mocks.getMercadoPagoClient.mockReturnValue(null);
    expect((await handleMercadoPagoWebhook(signedRequest())).status).toBe(500);
    expect(mocks.syncPayment).not.toHaveBeenCalled();
  });

  it("notificación que no es de pago: 200 ignorada", async () => {
    const response = await handleMercadoPagoWebhook(signedRequest({ type: "merchant_order" }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ignored: true });
    expect(mocks.fetchPayment).not.toHaveBeenCalled();
  });

  it("pago aprobado: consulta la API, aplica el pago y revalida la tienda", async () => {
    const response = await handleMercadoPagoWebhook(signedRequest());

    expect(response.status).toBe(200);
    expect(mocks.fetchPayment).toHaveBeenCalledWith({ accessToken: "fake" }, PAYMENT_ID);
    expect(mocks.syncPayment).toHaveBeenCalledWith(undefined, payment);
    expect(mocks.revalidateStorefront).toHaveBeenCalledWith("mp-payment");
  });

  it("no confía en el body: el estado sale del pago consultado a la API", async () => {
    const body = { data: { id: PAYMENT_ID }, status: "approved", external_reference: "otro-pedido" };
    mocks.fetchPayment.mockResolvedValue({ ...payment, status: "rejected" });

    await handleMercadoPagoWebhook(signedRequest({ body }));

    expect(mocks.syncPayment).toHaveBeenCalledWith(undefined, expect.objectContaining({ status: "rejected" }));
  });

  it("notificación repetida (noop): 200 y sin revalidar", async () => {
    mocks.syncPayment.mockResolvedValue({ kind: "applied", orderId: ORDER_ID, outcome: "noop" });

    const response = await handleMercadoPagoWebhook(signedRequest());

    expect(response.status).toBe(200);
    expect(mocks.revalidateStorefront).not.toHaveBeenCalled();
  });

  it("pago inexistente en una notificación real: 500 para que Mercado Pago reintente", async () => {
    mocks.fetchPayment.mockResolvedValue(null);

    const response = await handleMercadoPagoWebhook(signedRequest({ body: { data: { id: PAYMENT_ID }, live_mode: true } }));

    expect(response.status).toBe(500);
    expect(mocks.syncPayment).not.toHaveBeenCalled();
  });

  it("pago inexistente sin live_mode en el body: se trata como real (500)", async () => {
    mocks.fetchPayment.mockResolvedValue(null);

    expect((await handleMercadoPagoWebhook(signedRequest())).status).toBe(500);
  });

  it("simulación del panel de Mercado Pago (live_mode false): 200 sin aplicar", async () => {
    mocks.fetchPayment.mockResolvedValue(null);

    const response = await handleMercadoPagoWebhook(signedRequest({ body: { data: { id: PAYMENT_ID }, live_mode: false } }));

    expect(response.status).toBe(200);
    expect(mocks.syncPayment).not.toHaveBeenCalled();
  });

  it("con firma inválida no lee el body", async () => {
    const request = signedRequest({ signature: `ts=${Date.now()},v1=${"a".repeat(64)}` });
    const json = vi.spyOn(request, "json");

    expect((await handleMercadoPagoWebhook(request)).status).toBe(401);
    expect(json).not.toHaveBeenCalled();
  });

  it("pago con external_reference inválido o estado desconocido: 200 ignorado", async () => {
    mocks.syncPayment.mockResolvedValue({ kind: "ignored", reason: "invalid_external_reference" });

    const response = await handleMercadoPagoWebhook(signedRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ignored: true });
    expect(mocks.revalidateStorefront).not.toHaveBeenCalled();
  });

  it("error transitorio al consultar el pago: 500 para que Mercado Pago reintente", async () => {
    mocks.fetchPayment.mockRejectedValue(new Error("timeout"));

    expect((await handleMercadoPagoWebhook(signedRequest())).status).toBe(500);
    expect(mocks.syncPayment).not.toHaveBeenCalled();
  });

  it("error de la RPC: 500 para que Mercado Pago reintente", async () => {
    mocks.syncPayment.mockRejectedValue(new Error("db caída"));

    expect((await handleMercadoPagoWebhook(signedRequest())).status).toBe(500);
    expect(mocks.revalidateStorefront).not.toHaveBeenCalled();
  });

  it("id de pago que no es numérico: 200 ignorado sin consultar", async () => {
    const response = await handleMercadoPagoWebhook(signedRequest({ dataId: "../etc" }));

    expect(response.status).toBe(200);
    expect(mocks.fetchPayment).not.toHaveBeenCalled();
  });
});
