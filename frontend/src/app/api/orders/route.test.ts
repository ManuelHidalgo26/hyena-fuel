import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabase, findCall } from "../../../test/fakeSupabase";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  getMercadoPagoClient: vi.fn(),
  createPreference: vi.fn(),
  revalidateStorefront: vi.fn(),
  isRateLimited: vi.fn(),
}));

vi.mock("../../../lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("../../../lib/mercadopago/client", () => ({ getMercadoPagoClient: mocks.getMercadoPagoClient }));
vi.mock("../../../lib/mercadopago/preference", () => ({ createPreference: mocks.createPreference }));
vi.mock("../../../lib/revalidate", () => ({ revalidateStorefront: mocks.revalidateStorefront }));
vi.mock("../../../lib/rateLimit", () => ({ isRateLimited: mocks.isRateLimited, getClientIp: () => "1.2.3.4" }));
vi.mock("../../../lib/auth/guards", () => ({ requireAdmin: vi.fn() }));

import { POST } from "./route";

const PRODUCT_ID = "11111111-1111-4111-8111-111111111111";
const ORDER_ID = "a1b2c3d4-0000-4000-8000-000000000001";

const productRow = {
  id: PRODUCT_ID,
  name: "Whey",
  price: 100000,
  transfer_price: 90000,
  cost: 50000,
  stock: 5,
  active: true,
  commission_override_pct: null,
  commission_override_amount: null,
};

const orderRow = (paymentMethod: "mercadopago" | "transferencia") => ({
  id: ORDER_ID,
  customer_name: "Juan",
  customer_email: null,
  customer_phone: "123",
  customer_address: null,
  payment_method: paymentMethod,
  delivery_method: "retiro",
  status: "pending",
  subtotal: 100000,
  discount: 0,
  shipping_cost: 0,
  total_final: 100000,
  seller_id: null,
  commission_total: 0,
  discount_code: null,
  discount_code_amount: 0,
  payment_status: paymentMethod === "mercadopago" ? "pending" : null,
  created_at: "2026-10-13T12:00:00Z",
});

function setupSupabase(paymentMethod: "mercadopago" | "transferencia") {
  const fake = createFakeSupabase({
    tables: {
      products: { data: [productRow], error: null },
      product_variants: { data: [], error: null },
      orders: { data: null, error: null },
    },
    rpc: { data: orderRow(paymentMethod), error: null },
  });
  mocks.createAdminClient.mockReturnValue(fake.client);
  return fake;
}

function orderRequest(
  paymentMethod: "mercadopago" | "transferencia",
  contact: { customerPhone?: string; customerEmail?: string } = {}
) {
  return new NextRequest("http://localhost/api/orders", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      items: [{ productId: PRODUCT_ID, quantity: 1 }],
      customerName: "Juan",
      customerPhone: "123",
      ...contact,
      paymentMethod,
      deliveryMethod: "retiro",
    }),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  mocks.isRateLimited.mockReturnValue(false);
  mocks.getMercadoPagoClient.mockReturnValue({ accessToken: "fake" });
  mocks.createPreference.mockResolvedValue({
    id: "pref-1",
    initPoint: "https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=pref-1",
  });
});

describe("POST /api/orders con tarjeta", () => {
  it("sin credenciales de Mercado Pago: 503 y no crea ningún pedido", async () => {
    const fake = setupSupabase("mercadopago");
    mocks.getMercadoPagoClient.mockReturnValue(null);

    const response = await POST(orderRequest("mercadopago"));

    expect(response.status).toBe(503);
    expect(fake.rpcCalls).toHaveLength(0);
  });

  it("falla la preferencia: 502 y el pedido queda cancelado", async () => {
    const fake = setupSupabase("mercadopago");
    mocks.createPreference.mockRejectedValue(new Error("MP caído"));

    const response = await POST(orderRequest("mercadopago"));

    expect(response.status).toBe(502);
    const cancelUpdate = fake.queriesFor("orders").map((calls) => findCall(calls, "update")).find(Boolean);
    expect(cancelUpdate?.args[0]).toEqual({ status: "cancelled", payment_status: "cancelled" });
    expect(mocks.revalidateStorefront).not.toHaveBeenCalled();
  });

  it("éxito: 201 con link de pago, pedido diferido y sin revalidar la tienda", async () => {
    const fake = setupSupabase("mercadopago");

    const response = await POST(orderRequest("mercadopago"));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.payment).toEqual({
      provider: "mercadopago",
      initPoint: "https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=pref-1",
    });
    expect(body.paymentStatus).toBe("pending");
    expect(fake.rpcCalls[0].args).toMatchObject({ p_defer_payment: true, p_total_final: 100000 });
    expect(mocks.revalidateStorefront).not.toHaveBeenCalled();
  });

  it("calcula el total desde la base aunque el body intente mandar precios", async () => {
    const fake = setupSupabase("mercadopago");
    const request = new NextRequest("http://localhost/api/orders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        items: [{ productId: PRODUCT_ID, quantity: 1, price: 1 }],
        totalFinal: 1,
        customerName: "Juan",
        customerPhone: "123",
        paymentMethod: "mercadopago",
        deliveryMethod: "retiro",
      }),
    });

    await POST(request);

    expect(fake.rpcCalls[0].args).toMatchObject({ p_total_final: 100000 });
  });
});

describe("POST /api/orders con transferencia", () => {
  it("no difiere el pago, no toca Mercado Pago y revalida la tienda", async () => {
    const fake = setupSupabase("transferencia");

    const response = await POST(orderRequest("transferencia"));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.payment).toBeNull();
    expect(body.paymentStatus).toBeNull();
    expect(fake.rpcCalls[0].args).toMatchObject({ p_defer_payment: false, p_total_final: 90000 });
    expect(mocks.createPreference).not.toHaveBeenCalled();
    expect(mocks.revalidateStorefront).toHaveBeenCalledWith("order");
  });
});

describe("POST /api/orders rate limit", () => {
  it("responde 429 sin tocar la base cuando la IP excede el límite", async () => {
    const fake = setupSupabase("transferencia");
    mocks.isRateLimited.mockReturnValue(true);

    const response = await POST(orderRequest("transferencia"));

    expect(response.status).toBe(429);
    expect(fake.rpcCalls).toHaveLength(0);
    expect(mocks.isRateLimited).toHaveBeenCalledWith("create-order:1.2.3.4", 10, 60_000);
  });

  it("responde 429 sin tocar la base cuando el teléfono excede el límite aunque cambie la IP", async () => {
    const fake = setupSupabase("transferencia");
    mocks.isRateLimited.mockImplementation((key: string) => key.startsWith("create-order-phone:"));

    const response = await POST(orderRequest("transferencia", { customerPhone: "+54 9 11-5555-1234" }));

    expect(response.status).toBe(429);
    expect(fake.rpcCalls).toHaveLength(0);
    expect(mocks.isRateLimited).toHaveBeenCalledWith("create-order-phone:5491155551234", 5, 600_000);
  });

  it("responde 429 cuando el email (sin distinguir mayúsculas) excede el límite", async () => {
    const fake = setupSupabase("transferencia");
    mocks.isRateLimited.mockImplementation((key: string) => key.startsWith("create-order-email:"));

    const response = await POST(orderRequest("transferencia", { customerEmail: "Juan@Example.com" }));

    expect(response.status).toBe(429);
    expect(fake.rpcCalls).toHaveLength(0);
    expect(mocks.isRateLimited).toHaveBeenCalledWith("create-order-email:juan@example.com", 5, 600_000);
  });
});
