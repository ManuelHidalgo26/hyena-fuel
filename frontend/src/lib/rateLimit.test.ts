import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getClientIp, isRateLimited } from "./rateLimit";

const requestWith = (headers: Record<string, string>) => new Request("http://localhost/", { headers });

describe("getClientIp", () => {
  it("usa solo x-vercel-forwarded-for", () => {
    expect(getClientIp(requestWith({ "x-vercel-forwarded-for": "9.9.9.9" }))).toBe("9.9.9.9");
    expect(getClientIp(requestWith({ "x-vercel-forwarded-for": "2001:db8::1" }))).toBe("2001:db8::1");
  });

  it("ignora x-real-ip y x-forwarded-for, que el cliente puede setear", () => {
    expect(getClientIp(requestWith({ "x-real-ip": "8.8.8.8", "x-forwarded-for": "6.6.6.6" }))).toBe("unknown");
  });

  it("no usa como key un valor que no es una IP", () => {
    expect(getClientIp(requestWith({ "x-vercel-forwarded-for": "no-soy-una-ip" }))).toBe("unknown");
  });

  it("sin headers devuelve unknown", () => {
    expect(getClientIp(requestWith({}))).toBe("unknown");
  });
});

describe("isRateLimited", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("la poda de un limiter con ventana corta no evicta buckets de ventana larga", () => {
    const longWindowMs = 10 * 60_000;
    expect(isRateLimited("long", 1, longWindowMs)).toBe(false);
    expect(isRateLimited("long", 1, longWindowMs)).toBe(true);

    for (let i = 0; i < 5001; i += 1) isRateLimited(`short-${i}`, 1, 1000);
    vi.advanceTimersByTime(2000);
    isRateLimited("trigger-prune", 1, 1000);

    expect(isRateLimited("long", 1, longWindowMs)).toBe(true);
  });
});
