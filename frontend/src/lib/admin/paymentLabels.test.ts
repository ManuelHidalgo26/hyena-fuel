import { describe, expect, it } from "vitest";
import { PAYMENT_STATUSES } from "../orders";
import { PAYMENT_STATUS_LABEL, PAYMENT_STATUS_TONE, REVIEW_REASON_LABEL } from "./paymentLabels";

const FORBIDDEN_WORDS = /devoluci|reembols|reintegr|sellad|vencimient|hyena gym|sin inter[eé]s/i;

describe("etiquetas de pago del panel", () => {
  it("cubre todos los estados de pago con label y tono", () => {
    for (const status of PAYMENT_STATUSES) {
      expect(PAYMENT_STATUS_LABEL[status]).toBeTruthy();
      expect(PAYMENT_STATUS_TONE[status]).toBeTruthy();
    }
  });

  it("usa los labels del diseño", () => {
    expect(PAYMENT_STATUS_LABEL.pending).toBe("Esperando pago");
    expect(PAYMENT_STATUS_LABEL.approved).toBe("Pagado");
    expect(PAYMENT_STATUS_LABEL.refunded).toBe("Revertido");
    expect(PAYMENT_STATUS_TONE.approved).toBe("success");
    expect(PAYMENT_STATUS_TONE.rejected).toBe("danger");
  });

  it("no usa palabras vedadas por la marca", () => {
    const texts = [...Object.values(PAYMENT_STATUS_LABEL), ...Object.values(REVIEW_REASON_LABEL)];
    for (const text of texts) {
      expect(text).not.toMatch(FORBIDDEN_WORDS);
    }
  });

  it("tiene un motivo legible para cada motivo de revisión", () => {
    expect(Object.keys(REVIEW_REASON_LABEL)).toHaveLength(8);
  });
});
