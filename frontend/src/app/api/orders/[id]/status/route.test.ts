import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabase, findCall } from "../../../../../test/fakeSupabase";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  requireAdmin: vi.fn(),
  revalidateStorefront: vi.fn(),
}));

vi.mock("../../../../../lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("../../../../../lib/auth/guards", () => ({ requireAdmin: mocks.requireAdmin }));

vi.mock("../../../../../lib/revalidate", () => ({ revalidateStorefront: mocks.revalidateStorefront }));

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
      expect(findCall(update, "or")?.args[0]).toBe("payment_status.is.null,payment_status.eq.approved");
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
    expect(findCall(update, "update")?.args[0]).toEqual({ status: "confirmed" });
    const clear = fake.queriesFor("orders")[1];
    expect(findCall(clear, "update")?.args[0]).toEqual({ needs_review: false });
  });

  it("un pedido cancelado no se puede reabrir (su stock ya se repuso): 409", async () => {
    const fake = createFakeSupabase({
      tables: {
        orders: [
          { data: null, error: null },
          { data: { id: ORDER_ID, status: "cancelled" }, error: null },
        ],
      },
    });
    mocks.createAdminClient.mockReturnValue(fake.client);

    const response = await patch("confirmed");

    expect(response.status).toBe(409);
    expect((await response.json()).error).toContain("cancelado");
    expect(findCall(fake.queriesFor("orders")[0], "neq")?.args).toEqual(["status", "cancelled"]);
  });

  describe("cancelar", () => {
    function fakeCancel(data: unknown, error: { message: string } | null = null) {
      const fake = createFakeSupabase({ rpc: { data, error } });
      mocks.createAdminClient.mockReturnValue(fake.client);
      return fake;
    }

    it("cancela y repone el stock en una sola operación, y actualiza la vitrina", async () => {
      const fake = fakeCancel({ outcome: "cancelled", restocked_items: 2, skipped_items: 0 });

      const response = await patch("cancelled");

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ _id: ORDER_ID, status: "cancelled", skippedItems: 0 });
      expect(fake.rpcCalls).toEqual([{ fn: "cancel_order", args: { p_order_id: ORDER_ID } }]);
      expect(mocks.revalidateStorefront).toHaveBeenCalledWith("order-cancel");
    });

    it("informa los productos cuyo stock no se pudo reponer", async () => {
      fakeCancel({ outcome: "cancelled", restocked_items: 1, skipped_items: 1 });

      expect((await (await patch("cancelled")).json()).skippedItems).toBe(1);
    });

    it("pedido inexistente: 404", async () => {
      fakeCancel({ outcome: "not_found", restocked_items: 0, skipped_items: 0 });

      expect((await patch("cancelled")).status).toBe(404);
      expect(mocks.revalidateStorefront).not.toHaveBeenCalled();
    });

    it("error de la base: 500", async () => {
      fakeCancel(null, { message: "boom" });

      expect((await patch("cancelled")).status).toBe(500);
    });

    it("no limpia la revisión de un pago revertido o en disputa", async () => {
      const fake = fakeCancel({ outcome: "cancelled", restocked_items: 0, skipped_items: 0 });

      await patch("cancelled");

      expect(findCall(fake.queriesFor("orders")[0], "not")?.args).toEqual([
        "review_reason",
        "in",
        "(pago_refunded,pago_charged_back,pago_in_mediation,pago_cancelled)",
      ]);
    });
  });
});
