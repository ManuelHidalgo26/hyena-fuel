import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabase, findCall, hasCall } from "../../../../../test/fakeSupabase";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  requireAdmin: vi.fn(),
}));

vi.mock("../../../../../lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("../../../../../lib/auth/guards", () => ({ requireAdmin: mocks.requireAdmin }));

import { PATCH } from "./route";

const ORDER_ID = "a1b2c3d4-0000-4000-8000-000000000001";

function patch(status: string) {
  return PATCH(
    new NextRequest(`http://localhost/api/orders/${ORDER_ID}/status`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    }),
    { params: Promise.resolve({ id: ORDER_ID }) }
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  mocks.requireAdmin.mockResolvedValue({ authorized: true });
});

describe("PATCH /api/orders/[id]/status", () => {
  it.each(["confirmed", "dispatched", "paid"])(
    "%s sobre un pedido con tarjeta sin pago aprobado: 409",
    async (status) => {
      // El filtro del UPDATE no matchea (data null) pero el pedido existe.
      const fake = createFakeSupabase({
        tables: { orders: [{ data: null, error: null }, { data: { id: ORDER_ID }, error: null }] },
      });
      mocks.createAdminClient.mockReturnValue(fake.client);

      const response = await patch(status);

      expect(response.status).toBe(409);
      expect((await response.json()).error).toContain("todavía no está aprobado");
      const [update] = fake.queriesFor("orders");
      expect(findCall(update, "or")?.args[0]).toBe("payment_status.is.null,paid_at.not.is.null");
    }
  );

  it("pedido inexistente: 404", async () => {
    mocks.createAdminClient.mockReturnValue(
      createFakeSupabase({ tables: { orders: { data: null, error: null } } }).client
    );

    expect((await patch("confirmed")).status).toBe(404);
  });

  it("confirmar un pedido sin pago online o ya pagado: 200 y limpia la marca de revisión", async () => {
    const fake = createFakeSupabase({
      tables: { orders: { data: { id: ORDER_ID, status: "confirmed" }, error: null } },
    });
    mocks.createAdminClient.mockReturnValue(fake.client);

    const response = await patch("confirmed");

    expect(response.status).toBe(200);
    const [update] = fake.queriesFor("orders");
    expect(findCall(update, "update")?.args[0]).toEqual({ status: "confirmed", needs_review: false });
  });

  it("cancelar siempre está permitido: no agrega el filtro de pago", async () => {
    const fake = createFakeSupabase({
      tables: { orders: { data: { id: ORDER_ID, status: "cancelled" }, error: null } },
    });
    mocks.createAdminClient.mockReturnValue(fake.client);

    const response = await patch("cancelled");

    expect(response.status).toBe(200);
    const [update] = fake.queriesFor("orders");
    expect(hasCall(update, "or")).toBe(false);
  });
});
