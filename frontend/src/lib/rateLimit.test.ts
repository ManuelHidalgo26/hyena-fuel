import { describe, expect, it } from "vitest";
import { getClientIp } from "./rateLimit";

const requestWith = (headers: Record<string, string>) => new Request("http://localhost/", { headers });

describe("getClientIp", () => {
  it("prioriza x-vercel-forwarded-for sobre un x-forwarded-for spoofeado", () => {
    const request = requestWith({ "x-vercel-forwarded-for": "9.9.9.9", "x-forwarded-for": "6.6.6.6, 9.9.9.9" });

    expect(getClientIp(request)).toBe("9.9.9.9");
  });

  it("usa x-real-ip si no hay header de Vercel", () => {
    expect(getClientIp(requestWith({ "x-real-ip": "8.8.8.8", "x-forwarded-for": "6.6.6.6" }))).toBe("8.8.8.8");
  });

  it("sin otros headers toma el último hop de x-forwarded-for, no el primero que controla el cliente", () => {
    expect(getClientIp(requestWith({ "x-forwarded-for": "6.6.6.6, 7.7.7.7" }))).toBe("7.7.7.7");
  });

  it("sin headers devuelve unknown", () => {
    expect(getClientIp(requestWith({}))).toBe("unknown");
  });
});
