import { describe, expect, it } from "vitest";
import {
  getResultView,
  getResultWhatsAppLink,
  parseReturnHint,
  shouldClearCart,
  type ResultData,
  type ResultViewKey,
} from "./paymentResult";

const VIEWS: ResultViewKey[] = ["loading", "approved", "processing", "pending", "failed", "unknown", "error"];
const FORBIDDEN_WORDS = /devoluci|reembols|reintegr|sellad|vencimient|hyena gym|sin inter[eé]s|hasta \d+ cuotas/i;
const DATA: ResultData = { shortId: "A1B2C3", totalFinal: 105000, deliveryMethod: "envio" };

describe("getResultView", () => {
  it("no usa palabras vedadas por la marca en ninguna vista", () => {
    for (const view of VIEWS) {
      const config = getResultView(view, DATA);
      const text = [config.title, ...config.body, ...config.actions.map((action) => action.label)].join(" ");
      expect(text).not.toMatch(FORBIDDEN_WORDS);
    }
  });

  it("pago aprobado: número de pedido, total y nota de entrega", () => {
    const config = getResultView("approved", DATA);

    expect(config.title).toBe("¡Pago aprobado!");
    expect(config.body[0]).toContain("#A1B2C3");
    expect(config.body[0]).toContain("$105.000");
    expect(config.body[1]).toContain("miércoles");
    expect(config.actions.map((action) => action.id)).toEqual(["whatsapp", "continue-shopping"]);
    expect(config.showDetails).toBe(true);
  });

  it("retiro: nota de retiro en Córdoba", () => {
    expect(getResultView("approved", { ...DATA, deliveryMethod: "retiro" }).body[1]).toContain("retiro en Córdoba");
  });

  it("pago no completado: vuelve al carrito sin prometer que no hubo cobro", () => {
    const config = getResultView("failed", DATA);

    expect(config.actions[0].id).toBe("open-cart");
    expect(config.body.join(" ")).not.toMatch(/ningún cobro/i);
  });

  it("el parámetro r solo elige el título provisional de la carga", () => {
    expect(getResultView("loading", {}, "pendiente").title).toBe("Estamos registrando tu pago");
    expect(getResultView("loading", {}, "error").title).toBe("Estamos revisando tu pago");
    expect(getResultView("loading", {}, null).title).toBe("Estamos confirmando tu pago");
    expect(getResultView("approved", DATA, "error").title).toBe("¡Pago aprobado!");
  });

  it("sin datos de pedido no inventa un número", () => {
    const config = getResultView("processing", {});

    expect(config.body.join(" ")).not.toContain("#");
    expect(config.showDetails).toBe(false);
  });
});

describe("parseReturnHint", () => {
  it("acepta solo los valores conocidos", () => {
    expect(parseReturnHint("ok")).toBe("ok");
    expect(parseReturnHint("pendiente")).toBe("pendiente");
    expect(parseReturnHint("approved")).toBeNull();
    expect(parseReturnHint(null)).toBeNull();
  });
});

describe("shouldClearCart", () => {
  it("vacía el carrito con pago aprobado", () => {
    expect(shouldClearCart("approved", false)).toBe(true);
  });

  it("con pago en proceso o pendiente solo si volvió con payment_id", () => {
    expect(shouldClearCart("processing", true)).toBe(true);
    expect(shouldClearCart("pending", true)).toBe(true);
    expect(shouldClearCart("processing", false)).toBe(false);
    expect(shouldClearCart("pending", false)).toBe(false);
  });

  it("conserva el carrito si el pago falló o no hay pedido", () => {
    expect(shouldClearCart("failed", true)).toBe(false);
    expect(shouldClearCart("unknown", true)).toBe(false);
    expect(shouldClearCart("error", true)).toBe(false);
  });
});

describe("getResultWhatsAppLink", () => {
  const decoded = (view: ResultViewKey, data: ResultData = DATA) => decodeURIComponent(getResultWhatsAppLink(view, data).split("?text=")[1]);

  it("apunta al número de la tienda", () => {
    expect(getResultWhatsAppLink("approved", DATA)).toMatch(/^https:\/\/wa\.me\/5493519152450\?text=/);
  });

  it("arma el mensaje según el estado", () => {
    expect(decoded("approved")).toBe("Hola! Pagué mi pedido #A1B2C3 con tarjeta en Hyena Fuel. Quiero coordinar la entrega.");
    expect(decoded("approved", { ...DATA, deliveryMethod: "retiro" })).toContain("coordinar el retiro");
    expect(decoded("processing")).toContain("pedido #A1B2C3");
    expect(decoded("unknown", {})).toContain("no veo mi pedido");
  });

  it("omite el número si no hay pedido", () => {
    expect(decoded("pending", {})).toBe(
      "Hola! Tengo el pedido en Hyena Fuel con el pago en proceso. ¿Me ayudan a confirmarlo?"
    );
  });
});
