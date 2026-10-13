import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { SIGNATURE_TOLERANCE_MS, verifyWebhookSignature } from "./signature";

// Secreto inventado solo para los tests: no es ninguna credencial real.
const SECRET = "test-webhook-secret";
const NOW_MS = Date.UTC(2026, 9, 13, 12, 0, 0);
const TS_SECONDS = String(Math.floor(NOW_MS / 1000));

function sign(manifest: string, secret = SECRET): string {
  return createHmac("sha256", secret).update(manifest).digest("hex");
}

function header(ts: string, v1: string): string {
  return `ts=${ts},v1=${v1}`;
}

const validInput = {
  signatureHeader: header(TS_SECONDS, sign(`id:123456;request-id:req-1;ts:${TS_SECONDS};`)),
  requestId: "req-1",
  dataId: "123456",
  secret: SECRET,
  nowMs: NOW_MS,
};

describe("verifyWebhookSignature", () => {
  it("acepta una firma válida", () => {
    expect(verifyWebhookSignature(validInput)).toBe(true);
  });

  it("rechaza un v1 alterado", () => {
    const tampered = validInput.signatureHeader.replace(/.$/, (char) => (char === "0" ? "1" : "0"));
    expect(verifyWebhookSignature({ ...validInput, signatureHeader: tampered })).toBe(false);
  });

  it("rechaza si cambia el ts firmado", () => {
    const otherTs = String(Number(TS_SECONDS) + 1);
    const forged = header(otherTs, sign(`id:123456;request-id:req-1;ts:${TS_SECONDS};`));
    expect(verifyWebhookSignature({ ...validInput, signatureHeader: forged })).toBe(false);
  });

  it("rechaza si cambia el data.id o el request-id", () => {
    expect(verifyWebhookSignature({ ...validInput, dataId: "999" })).toBe(false);
    expect(verifyWebhookSignature({ ...validInput, requestId: "req-2" })).toBe(false);
  });

  it("rechaza una firma hecha con otro secreto", () => {
    const forged = header(TS_SECONDS, sign(`id:123456;request-id:req-1;ts:${TS_SECONDS};`, "otro-secreto"));
    expect(verifyWebhookSignature({ ...validInput, signatureHeader: forged })).toBe(false);
  });

  it("pasa el data.id alfanumérico a minúsculas en el manifest", () => {
    const signatureHeader = header(TS_SECONDS, sign(`id:abc123;request-id:req-1;ts:${TS_SECONDS};`));
    expect(verifyWebhookSignature({ ...validInput, signatureHeader, dataId: "ABC123" })).toBe(true);
  });

  it("omite las partes que faltan del manifest", () => {
    const withoutRequestId = header(TS_SECONDS, sign(`id:123456;ts:${TS_SECONDS};`));
    expect(verifyWebhookSignature({ ...validInput, signatureHeader: withoutRequestId, requestId: null })).toBe(true);

    const withoutDataId = header(TS_SECONDS, sign(`request-id:req-1;ts:${TS_SECONDS};`));
    expect(verifyWebhookSignature({ ...validInput, signatureHeader: withoutDataId, dataId: null })).toBe(true);
  });

  describe("tolerancia del ts", () => {
    const signedAt = (tsMs: number, unit: "s" | "ms") => {
      const ts = unit === "s" ? String(Math.floor(tsMs / 1000)) : String(tsMs);
      return header(ts, sign(`id:123456;request-id:req-1;ts:${ts};`));
    };

    it("acepta un ts dentro de la ventana, en segundos y en milisegundos", () => {
      const recent = NOW_MS - SIGNATURE_TOLERANCE_MS + 60_000;
      expect(verifyWebhookSignature({ ...validInput, signatureHeader: signedAt(recent, "s") })).toBe(true);
      expect(verifyWebhookSignature({ ...validInput, signatureHeader: signedAt(recent, "ms") })).toBe(true);
    });

    it("rechaza un ts viejo o del futuro, en segundos y en milisegundos", () => {
      const stale = NOW_MS - SIGNATURE_TOLERANCE_MS - 60_000;
      const future = NOW_MS + SIGNATURE_TOLERANCE_MS + 60_000;
      expect(verifyWebhookSignature({ ...validInput, signatureHeader: signedAt(stale, "s") })).toBe(false);
      expect(verifyWebhookSignature({ ...validInput, signatureHeader: signedAt(stale, "ms") })).toBe(false);
      expect(verifyWebhookSignature({ ...validInput, signatureHeader: signedAt(future, "s") })).toBe(false);
    });
  });

  describe("headers mal formados (nunca lanzan)", () => {
    it.each([
      ["null", null],
      ["vacío", ""],
      ["sin v1", `ts=${TS_SECONDS}`],
      ["sin ts", `v1=${"a".repeat(64)}`],
      ["sin igual", "garbage"],
      ["v1 más corto", header(TS_SECONDS, "abcd")],
      ["v1 más largo", header(TS_SECONDS, "a".repeat(65))],
      ["v1 no hexadecimal", header(TS_SECONDS, "z".repeat(64))],
      ["ts no numérico", header("abc", "a".repeat(64))],
    ])("rechaza %s", (_label, signatureHeader) => {
      expect(verifyWebhookSignature({ ...validInput, signatureHeader })).toBe(false);
    });
  });
});
