import { describe, expect, it } from "vitest";
import { canonicalPhone, contactRateLimitKeys } from "./contactRateLimit";

describe("canonicalPhone", () => {
  it.each([
    "11 5555-1234",
    "011 5555-1234",
    "+54 9 11 5555-1234",
    "0054 9 11 5555 1234",
    "54 11 5555 1234",
    "011 15 5555-1234",
    "(011) 15-5555-1234",
  ])("%s -> 1155551234", (raw) => {
    expect(canonicalPhone(raw)).toBe("1155551234");
  });

  it("devuelve null si no llega al largo nacional", () => {
    expect(canonicalPhone("123")).toBeNull();
    expect(canonicalPhone("abc")).toBeNull();
  });
});

describe("contactRateLimitKeys", () => {
  it("combina teléfono e email con la IP y los normaliza", () => {
    expect(
      contactRateLimitKeys(
        { customerPhone: "011 5555-1234", customerEmail: " Juan@Example.COM " },
        "1.2.3.4",
      ),
    ).toEqual([
      "create-order-phone:1155551234:1.2.3.4",
      "create-order-email:juan@example.com:1.2.3.4",
    ]);
  });

  it("sin teléfono canonicalizable ni email no arma claves", () => {
    expect(contactRateLimitKeys({ customerPhone: "123" }, "1.2.3.4")).toEqual(
      [],
    );
  });
});
