import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabase, type FakeResult } from "../../../../../test/fakeSupabase";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  getMercadoPagoClient: vi.fn(),
  fetchPayment: vi.fn(),
  syncPayment: vi.fn(),
  revalidateStorefront: vi.fn(),
  isRateLimited: vi.fn(),
}));

vi.mock("../../../../../lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("../../../../../lib/mercadopago/client", () => ({ getMercadoPagoClient: mocks.getMercadoPagoClient }));
vi.mock("../../../../../lib/mercadopago/sync", () => ({
  fetchPayment: mocks.fetchPayment,
  syncPayment: mocks.syncPayment,
}));
vi.mock("../../../../../lib/revalidate", () => ({ revalidateStorefront: mocks.revalidateStorefront }));
vi.mock("../../../../../lib/rateLimit", () => ({ isRateLimited: mocks.isRateLimited, getClientIp: () => "1.2.3.4" }));

import { GET } from "./route";

const ORDER_ID = "a1b2c3d4-0000-4000-8000-000000000001";

const orderResult = (paymentStatus: string | null, paidAt: string | null = null): FakeResult => ({
  data: { id: ORDER_ID, payment_status: paymentStatus, paid_at: paidAt, total_final: 105000, delivery_method: "envio" },
  error: null,
});

const payment = { id: "999", status: "approved", externalReference: ORDER_ID };

function call(id: string, query = "") {
  return GET(new NextRequest(`http://localhost/api/orders/${id}/payment${query}`), {
    params: Promise.resolve({ id }),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  mocks.isRateLimited.mockReturnValue(false);
  mocks.getMercadoPagoClient.mockReturnValue({ accessToken: "fake" });
});

describe("GET /api/orders/[id]/payment", () => {
  it("id que no es UUID: 400", async () => {
    expect((await call("no-es-uuid")).status).toBe(400);
  });

  it("pedido inexistente: 404", async () => {
    mocks.createAdminClient.mockReturnValue(createFakeSupabase({ tables: { orders: { data: null, error: null } } }).client);

    expect((await call(ORDER_ID)).status).toBe(404);
  });

  it("pedido sin pago online (transferencia): 404", async () => {
    mocks.createAdminClient.mockReturnValue(createFakeSupabase({ tables: { orders: orderResult(null) } }).client);

    expect((await call(ORDER_ID)).status).toBe(404);
  });

  it("rate limit: 429", async () => {
    mocks.isRateLimited.mockReturnValue(true);

    expect((await call(ORDER_ID)).status).toBe(429);
  });

  it("devuelve solo el estado, sin datos personales, y no se cachea", async () => {
    mocks.createAdminClient.mockReturnValue(createFakeSupabase({ tables: { orders: orderResult("in_process") } }).client);

    const response = await call(ORDER_ID);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      orderId: ORDER_ID,
      shortId: "A1B2C3",
      state: "processing",
      totalFinal: 105000,
      deliveryMethod: "envio",
    });
  });

  it("sin payment_id no consulta a Mercado Pago", async () => {
    mocks.createAdminClient.mockReturnValue(createFakeSupabase({ tables: { orders: orderResult("pending") } }).client);

    await call(ORDER_ID);

    expect(mocks.fetchPayment).not.toHaveBeenCalled();
  });

  it("sincroniza el pago solo si su external_reference es este pedido", async () => {
    mocks.createAdminClient.mockReturnValue(createFakeSupabase({ tables: { orders: orderResult("pending") } }).client);
    mocks.fetchPayment.mockResolvedValue({ ...payment, externalReference: "b1b2c3d4-0000-4000-8000-000000000002" });

    const response = await call(ORDER_ID, "?payment_id=999");

    expect(mocks.fetchPayment).toHaveBeenCalledTimes(1);
    expect(mocks.syncPayment).not.toHaveBeenCalled();
    expect((await response.json()).state).toBe("pending");
  });

  it("aplica el pago cuando coincide y devuelve el estado actualizado", async () => {
    mocks.createAdminClient.mockReturnValue(
      createFakeSupabase({ tables: { orders: [orderResult("pending"), orderResult("approved", "2026-10-13T12:00:00Z")] } }).client
    );
    mocks.fetchPayment.mockResolvedValue(payment);
    mocks.syncPayment.mockResolvedValue({ kind: "applied", orderId: ORDER_ID, outcome: "approved" });

    const response = await call(ORDER_ID, "?payment_id=999");

    expect(mocks.syncPayment).toHaveBeenCalledTimes(1);
    expect(mocks.revalidateStorefront).toHaveBeenCalledWith("mp-payment");
    expect((await response.json()).state).toBe("approved");
  });

  it("no consulta a Mercado Pago si el pedido ya está pagado", async () => {
    mocks.createAdminClient.mockReturnValue(
      createFakeSupabase({ tables: { orders: orderResult("approved", "2026-10-13T12:00:00Z") } }).client
    );

    await call(ORDER_ID, "?payment_id=999");

    expect(mocks.fetchPayment).not.toHaveBeenCalled();
  });

  it("si Mercado Pago falla, devuelve lo que hay en la base", async () => {
    mocks.createAdminClient.mockReturnValue(createFakeSupabase({ tables: { orders: orderResult("pending") } }).client);
    mocks.fetchPayment.mockRejectedValue(new Error("timeout"));

    const response = await call(ORDER_ID, "?payment_id=999");

    expect(response.status).toBe(200);
    expect((await response.json()).state).toBe("pending");
  });

  it("ignora un payment_id que no es numérico", async () => {
    mocks.createAdminClient.mockReturnValue(createFakeSupabase({ tables: { orders: orderResult("pending") } }).client);

    await call(ORDER_ID, "?payment_id=../x");

    expect(mocks.fetchPayment).not.toHaveBeenCalled();
  });
});
