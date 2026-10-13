import { MPNotFoundError } from "mercadopago";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("mercadopago", async (importOriginal) => {
  const original = await importOriginal<typeof import("mercadopago")>();
  return {
    ...original,
    Payment: vi.fn().mockImplementation(() => ({ get: mocks.get })),
  };
});

import type { MercadoPagoConfig } from "mercadopago";
import { fetchPayment, syncPayment, type PaymentSnapshot } from "./sync";

const ORDER_ID = "a1b2c3d4-0000-4000-8000-000000000001";
const client = {} as MercadoPagoConfig;

const snapshot: PaymentSnapshot = {
  id: "987654321",
  status: "approved",
  statusDetail: "accredited",
  externalReference: ORDER_ID,
  amount: 105000,
  currency: "ARS",
  dateApproved: "2026-10-13T12:00:00.000-03:00",
  dateLastUpdated: "2026-10-13T12:00:01.000-03:00",
};

function fakeSupabase(result: { data: { outcome: string } | null; error: { code: string; message: string } | null }) {
  const returns = vi.fn().mockResolvedValue(result);
  const single = vi.fn().mockReturnValue({ returns });
  const rpc = vi.fn().mockReturnValue({ single });
  return { rpc, client: { rpc } as unknown as Parameters<typeof syncPayment>[0] };
}

beforeEach(() => {
  mocks.get.mockReset();
});

describe("fetchPayment", () => {
  it("normaliza el pago consultado", async () => {
    mocks.get.mockResolvedValue({
      id: 987654321,
      status: "approved",
      status_detail: "accredited",
      external_reference: ORDER_ID,
      transaction_amount: 105000,
      currency_id: "ARS",
      date_approved: "2026-10-13T12:00:00.000-03:00",
      date_last_updated: "2026-10-13T12:00:01.000-03:00",
    });

    await expect(fetchPayment(client, "987654321")).resolves.toEqual(snapshot);
  });

  it("devuelve null si el pago no existe", async () => {
    mocks.get.mockRejectedValue(new MPNotFoundError({ status: 404, message: "Payment not found" }));

    await expect(fetchPayment(client, "1")).resolves.toBeNull();
  });

  it("propaga los errores transitorios", async () => {
    mocks.get.mockRejectedValue(new Error("timeout"));

    await expect(fetchPayment(client, "1")).rejects.toThrow("timeout");
  });
});

describe("syncPayment", () => {
  it("llama a la RPC con los datos del pago consultado", async () => {
    const { rpc, client: supabase } = fakeSupabase({ data: { outcome: "approved" }, error: null });

    await expect(syncPayment(supabase, snapshot)).resolves.toEqual({ kind: "applied", orderId: ORDER_ID, outcome: "approved" });
    expect(rpc).toHaveBeenCalledWith("apply_mercadopago_payment", {
      p_order_id: ORDER_ID,
      p_payment_id: "987654321",
      p_status: "approved",
      p_status_detail: "accredited",
      p_amount: 105000,
      p_currency: "ARS",
      p_date_approved: "2026-10-13T12:00:00.000-03:00",
      p_date_last_updated: "2026-10-13T12:00:01.000-03:00",
    });
  });

  it("ignora un pago sin external_reference válido sin llamar a la RPC", async () => {
    const { rpc, client: supabase } = fakeSupabase({ data: null, error: null });

    await expect(syncPayment(supabase, { ...snapshot, externalReference: "no-es-uuid" })).resolves.toEqual({
      kind: "ignored",
      reason: "invalid_external_reference",
    });
    await expect(syncPayment(supabase, { ...snapshot, externalReference: null })).resolves.toMatchObject({ kind: "ignored" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("ignora un estado de pago desconocido (SQLSTATE 22023)", async () => {
    const { client: supabase } = fakeSupabase({ data: null, error: { code: "22023", message: "Estado de pago desconocido" } });

    await expect(syncPayment(supabase, snapshot)).resolves.toEqual({ kind: "ignored", reason: "unknown_status" });
  });

  it("propaga cualquier otro error de la RPC", async () => {
    const { client: supabase } = fakeSupabase({ data: null, error: { code: "XX000", message: "boom" } });

    await expect(syncPayment(supabase, snapshot)).rejects.toThrow("boom");
  });
});
