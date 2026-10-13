import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabase, findCall } from "../../../../test/fakeSupabase";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  requireAdmin: vi.fn(),
}));

vi.mock("../../../../lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("../../../../lib/auth/guards", () => ({ requireAdmin: mocks.requireAdmin }));

import { DELETE } from "./route";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.requireAdmin.mockResolvedValue({ authorized: true });
});

describe("DELETE /api/orders/completed", () => {
  it("borra finalizados y abandonados, nunca los que requieren revisión ni los cancelados ya cobrados", async () => {
    const fake = createFakeSupabase({ tables: { orders: { data: [{ id: "1" }, { id: "2" }], error: null } } });
    mocks.createAdminClient.mockReturnValue(fake.client);

    const response = await DELETE();

    expect(await response.json()).toEqual({ deleted: 2 });
    const [calls] = fake.queriesFor("orders");
    expect(findCall(calls, "eq")?.args).toEqual(["needs_review", false]);

    const filter = String(findCall(calls, "or")?.args[0]);
    expect(filter).toContain("status.in.(dispatched,paid)");
    expect(filter).toContain("and(status.eq.cancelled,paid_at.is.null)");
    expect(filter).toContain("payment_method.eq.mercadopago");
    expect(filter).toContain("payment_status.in.(pending,rejected,cancelled)");
    expect(filter).toContain("paid_at.is.null");
    expect(filter).toContain("status.eq.pending");
    expect(filter).toMatch(/created_at\.lt\.\d{4}-\d{2}-\d{2}T/);
  });

  it("el corte de abandonados es 24 h atrás", async () => {
    const fake = createFakeSupabase({ tables: { orders: { data: [], error: null } } });
    mocks.createAdminClient.mockReturnValue(fake.client);
    const before = Date.now();

    await DELETE();

    const [calls] = fake.queriesFor("orders");
    const cutoff = String(findCall(calls, "or")?.args[0]).match(/created_at\.lt\.([^,)]+)/)?.[1] ?? "";
    const ageHours = (before - new Date(cutoff).getTime()) / 3_600_000;
    expect(ageHours).toBeGreaterThanOrEqual(23.99);
    expect(ageHours).toBeLessThan(24.1);
  });

  it("devuelve el guard si no es admin", async () => {
    const denied = new Response(null, { status: 401 });
    mocks.requireAdmin.mockResolvedValue({ authorized: false, response: denied });

    expect(await DELETE()).toBe(denied);
  });

  it("error de base: 500", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.createAdminClient.mockReturnValue(
      createFakeSupabase({ tables: { orders: { data: null, error: { message: "boom" } } } }).client
    );

    expect((await DELETE()).status).toBe(500);
  });
});
