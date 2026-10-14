import { afterEach, describe, expect, it, vi } from "vitest";
import { isMercadoPagoSandbox } from "./client";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isMercadoPagoSandbox", () => {
  it("fuera de producción de Vercel es sandbox", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("MP_ACCESS_TOKEN", "APP_USR-real");

    expect(isMercadoPagoSandbox()).toBe(true);
  });

  it("en producción con un token de prueba es sandbox", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("MP_ACCESS_TOKEN", "TEST-123");

    expect(isMercadoPagoSandbox()).toBe(true);
  });

  it("en producción con un token real no es sandbox", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("MP_ACCESS_TOKEN", "APP_USR-real");

    expect(isMercadoPagoSandbox()).toBe(false);
  });
});
