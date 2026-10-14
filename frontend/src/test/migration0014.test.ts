import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../../supabase/migrations/0014_mercadopago_checkout_pro.sql", import.meta.url),
  "utf8"
);

/** Cuerpo SQL de una función de la migración, hasta su `end; $$;`. */
function functionBody(name: string): string {
  const start = migration.indexOf(`function public.${name}(`);
  const end = migration.indexOf("end; $$;", start);
  return migration.slice(start, end);
}

describe("migración 0014 (guardas estáticas de SQL)", () => {
  it("create_order recorre los ítems en el mismo orden de locks que apply_mercadopago_payment", () => {
    expect(functionBody("create_order")).toMatch(
      /order by \(item ->> 'product_id'\)::uuid, lower\(nullif\(btrim\(item ->> 'flavor'\), ''\)\)/
    );
    expect(functionBody("apply_mercadopago_payment")).toMatch(/order by product_id, lower\(flavor\)/);
  });

  it("apply_mercadopago_payment captura deadlock y serialización y deja el pedido en revisión", () => {
    const body = functionBody("apply_mercadopago_payment");

    expect(body).toMatch(/when sqlstate '40P01' or sqlstate '40001' then/);
    expect(body).toMatch(/review_reason = 'conflicto_stock'/);
  });

  it("el motivo conflicto_stock está permitido por el check de review_reason", () => {
    expect(migration).toMatch(/review_reason text\s+check \(review_reason in \([^;]*'conflicto_stock'/);
  });

  it("un pago duplicado ya registrado no vuelve a marcar el pedido para revisión", () => {
    expect(functionBody("apply_mercadopago_payment")).toMatch(
      /provider_payment_id = p_payment_id\s+and outcome = 'duplicate_payment'/
    );
  });
});
