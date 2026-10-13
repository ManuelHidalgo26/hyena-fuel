import { describe, expect, it } from "vitest";
import { getSiteUrls } from "./siteUrl";

describe("getSiteUrls", () => {
  it("producción: NEXT_PUBLIC_SITE_URL o el dominio canónico, sin barra final", () => {
    expect(getSiteUrls({ VERCEL_ENV: "production" }).baseUrl).toBe("https://www.hyenafuel.com");
    expect(getSiteUrls({ VERCEL_ENV: "production", NEXT_PUBLIC_SITE_URL: "https://tienda.example/" })).toEqual({
      baseUrl: "https://tienda.example",
      webhookBypassQuery: "",
    });
  });

  it("preview: URL estable de la rama y bypass solo si hay secreto", () => {
    const env = { VERCEL_ENV: "preview", VERCEL_BRANCH_URL: "hyena-git-feat.vercel.app" };

    expect(getSiteUrls(env)).toEqual({ baseUrl: "https://hyena-git-feat.vercel.app", webhookBypassQuery: "" });
    expect(getSiteUrls({ ...env, VERCEL_AUTOMATION_BYPASS_SECRET: "s e" }).webhookBypassQuery).toBe(
      "&x-vercel-protection-bypass=s%20e"
    );
  });

  it("local: localhost", () => {
    expect(getSiteUrls({}).baseUrl).toBe("http://localhost:3000");
  });
});
