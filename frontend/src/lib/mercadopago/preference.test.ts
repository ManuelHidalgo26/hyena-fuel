import { describe, expect, it } from "vitest";
import type { FrozenOrderItem } from "../orders";
import { buildPreferenceBody, toArgentinaIso, type PreferenceInput } from "./preference";

const ORDER_ID = "a1b2c3d4-0000-4000-8000-000000000001";
const PRODUCT_ID = "11111111-1111-4111-8111-111111111111";
const NOW = new Date("2026-10-13T15:00:00.000Z");

const item = (overrides: Partial<FrozenOrderItem> = {}): FrozenOrderItem => ({
  productId: PRODUCT_ID,
  name: "Whey Protein 2 lbs",
  quantity: 2,
  unitPrice: 50000,
  unitCost: 30000,
  unitCommission: 0,
  ...overrides,
});

const baseInput = (overrides: Partial<PreferenceInput> = {}): PreferenceInput => ({
  orderId: ORDER_ID,
  customerName: "Juan Pérez",
  customerEmail: "juan@example.com",
  items: [item()],
  shippingCost: 5000,
  couponDiscount: 0,
  totalFinal: 105000,
  urls: { baseUrl: "https://www.hyenafuel.com", webhookBypassQuery: "" },
  now: NOW,
  ...overrides,
});

const sumItemsInCents = (body: ReturnType<typeof buildPreferenceBody>) =>
  Math.round((body.items ?? []).reduce((sum, line) => sum + line.unit_price * line.quantity * 100, 0));

describe("buildPreferenceBody", () => {
  it("sin cupón: un ítem por línea más el envío, y la suma da el total", () => {
    const body = buildPreferenceBody(
      baseInput({
        items: [item(), item({ name: "Creatina", flavor: "Limón", quantity: 1, unitPrice: 20000 })],
        totalFinal: 125000,
      })
    );

    expect(body.items).toEqual([
      { id: PRODUCT_ID, title: "Whey Protein 2 lbs", quantity: 2, unit_price: 50000, currency_id: "ARS" },
      { id: PRODUCT_ID, title: "Creatina — Limón", quantity: 1, unit_price: 20000, currency_id: "ARS" },
      { id: "envio", title: "Envío a domicilio", quantity: 1, unit_price: 5000, currency_id: "ARS" },
    ]);
    expect(sumItemsInCents(body)).toBe(125000 * 100);
  });

  it("retiro o envío gratis: sin ítem de envío", () => {
    const body = buildPreferenceBody(baseInput({ shippingCost: 0, totalFinal: 100000 }));

    expect(body.items).toHaveLength(1);
    expect(sumItemsInCents(body)).toBe(100000 * 100);
  });

  it("con cupón: un único ítem por el total", () => {
    const body = buildPreferenceBody(baseInput({ couponDiscount: 10000, totalFinal: 95000 }));

    expect(body.items).toEqual([
      {
        id: ORDER_ID,
        title: "Pedido Hyena Fuel #A1B2C3",
        description: "2 productos",
        quantity: 1,
        unit_price: 95000,
        currency_id: "ARS",
      },
    ]);
  });

  it("si la suma detallada no coincide con el total, cae al ítem único", () => {
    const body = buildPreferenceBody(baseInput({ totalFinal: 99999.99 }));

    expect(body.items).toHaveLength(1);
    expect(body.items?.[0].unit_price).toBe(99999.99);
  });

  it("rechaza un total no positivo", () => {
    expect(() => buildPreferenceBody(baseInput({ totalFinal: 0 }))).toThrow();
    expect(() => buildPreferenceBody(baseInput({ totalFinal: Number.NaN }))).toThrow();
  });

  it("no limita las cuotas y excluye efectivo", () => {
    const body = buildPreferenceBody(baseInput());

    expect(body.payment_methods?.installments).toBeUndefined();
    expect(body.payment_methods?.excluded_payment_types).toEqual([{ id: "ticket" }, { id: "atm" }]);
    expect(body.binary_mode).toBe(false);
  });

  it("referencia el pedido y arma las URLs de retorno y del webhook", () => {
    const body = buildPreferenceBody(baseInput());

    expect(body.external_reference).toBe(ORDER_ID);
    expect(body.metadata).toEqual({ order_id: ORDER_ID });
    expect(body.auto_return).toBe("approved");
    expect(body.back_urls).toEqual({
      success: "https://www.hyenafuel.com/compra/resultado?r=ok",
      pending: "https://www.hyenafuel.com/compra/resultado?r=pendiente",
      failure: "https://www.hyenafuel.com/compra/resultado?r=error",
    });
    expect(body.notification_url).toBe("https://www.hyenafuel.com/api/webhooks/mercadopago?source_news=webhooks");
  });

  it("agrega el bypass de Vercel solo a la notification_url", () => {
    const body = buildPreferenceBody(
      baseInput({
        urls: { baseUrl: "https://hyena-git-feat.vercel.app", webhookBypassQuery: "&x-vercel-protection-bypass=abc" },
      })
    );

    expect(body.notification_url).toContain("&x-vercel-protection-bypass=abc");
    expect(JSON.stringify(body.back_urls)).not.toContain("bypass");
  });

  it("no manda auto_return con URLs que no son https", () => {
    const body = buildPreferenceBody(baseInput({ urls: { baseUrl: "http://localhost:3000", webhookBypassQuery: "" } }));

    expect(body.auto_return).toBeUndefined();
  });

  it("manda el email del pagador solo si existe", () => {
    expect(buildPreferenceBody(baseInput()).payer).toEqual({ name: "Juan Pérez", email: "juan@example.com" });
    expect(buildPreferenceBody(baseInput({ customerEmail: undefined })).payer).toEqual({ name: "Juan Pérez" });
  });

  it("vence a las 2 h con fechas en horario de Argentina", () => {
    const body = buildPreferenceBody(baseInput());

    expect(body.expires).toBe(true);
    expect(body.expiration_date_from).toBe("2026-10-13T11:59:00.000-03:00");
    expect(body.expiration_date_to).toBe("2026-10-13T14:00:00.000-03:00");
  });
});

describe("toArgentinaIso", () => {
  it("convierte UTC a -03:00", () => {
    expect(toArgentinaIso(new Date("2026-01-01T02:30:15.123Z"))).toBe("2025-12-31T23:30:15.123-03:00");
  });
});
