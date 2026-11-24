import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabase } from "../../test/fakeSupabase";

const mocks = vi.hoisted(() => ({ createPublicClient: vi.fn() }));
vi.mock("../supabase/public", () => ({ createPublicClient: mocks.createPublicClient }));

import { getProducts } from "./products.api";

type Variant = { name: string; image: null; stock: number };

async function publicStock(stock: number, variants: Variant[]) {
  const row = {
    id: "p1",
    name: "Whey",
    slug: "whey",
    description: null,
    price: 10,
    transfer_price: 9,
    stock,
    images: [],
    brand: null,
    category: null,
    attributes: null,
    product_variants: variants,
  };
  mocks.createPublicClient.mockReturnValue(
    createFakeSupabase({ tables: { products: { data: [row], error: null } } }).client
  );
  return (await getProducts())[0].stock;
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("stock público de un producto", () => {
  it("con sabores es la suma de los sabores, no el stock propio del producto", async () => {
    expect(
      await publicStock(3, [
        { name: "Chocolate", image: null, stock: 1 },
        { name: "Vainilla", image: null, stock: 1 },
      ])
    ).toBe(2);
  });

  it("con todos los sabores agotados es 0 aunque el producto tenga stock cargado", async () => {
    expect(await publicStock(3, [{ name: "Frutilla", image: null, stock: 0 }])).toBe(0);
  });

  it("sin sabores es el stock propio", async () => {
    expect(await publicStock(3, [])).toBe(3);
  });
});
