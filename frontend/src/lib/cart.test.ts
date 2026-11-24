import { describe, expect, it, vi } from "vitest";
import { applyCurrentPrices, fetchCurrentPrices, parseStoredCart, type CartItem } from "./cart";

const ITEM: CartItem = {
  _id: "p1",
  name: "Whey",
  price: 9000,
  transferPrice: 8000,
  image: "/whey.jpg",
  flavor: null,
  quantity: 2,
};

describe("parseStoredCart", () => {
  it("recupera un carrito válido", () => {
    expect(parseStoredCart(JSON.stringify([ITEM]))).toEqual([ITEM]);
  });

  it.each([null, "", "{roto", "null", "{}", "42", '"texto"'])("%s da un carrito vacío en vez de romper", (raw) => {
    expect(parseStoredCart(raw)).toEqual([]);
  });

  it.each([
    ["sin id", { ...ITEM, _id: undefined }],
    ["sin nombre", { ...ITEM, name: null }],
    ["precio no numérico", { ...ITEM, price: "9000" }],
    ["cantidad cero", { ...ITEM, quantity: 0 }],
    ["cantidad fraccionaria", { ...ITEM, quantity: 1.5 }],
    ["ítem nulo", null],
  ])("descarta solo el ítem dañado (%s) y conserva el resto", (_case, broken) => {
    expect(parseStoredCart(JSON.stringify([broken, ITEM]))).toEqual([ITEM]);
  });

  it("normaliza los campos opcionales ausentes", () => {
    const stored = { _id: "p1", name: "Whey", price: 9000, quantity: 1 };
    expect(parseStoredCart(JSON.stringify([stored]))).toEqual([
      { ...stored, transferPrice: null, image: null, flavor: null },
    ]);
  });
});

describe("applyCurrentPrices", () => {
  it("actualiza precio de lista y de transferencia", () => {
    const items = applyCurrentPrices([ITEM], new Map([["p1", { price: 14999, transferPrice: 12999 }]]));
    expect(items).toEqual([{ ...ITEM, price: 14999, transferPrice: 12999 }]);
  });

  it("actualiza todos los sabores del mismo producto", () => {
    const items = applyCurrentPrices(
      [
        { ...ITEM, flavor: "Frutilla" },
        { ...ITEM, flavor: "Vainilla" },
      ],
      new Map([["p1", { price: 100, transferPrice: null }]])
    );
    expect(items.map((item) => [item.flavor, item.price, item.transferPrice])).toEqual([
      ["Frutilla", 100, null],
      ["Vainilla", 100, null],
    ]);
  });

  it("sin cambios devuelve la misma referencia (no dispara renders)", () => {
    const items = [ITEM];
    expect(applyCurrentPrices(items, new Map([["p1", { price: 9000, transferPrice: 8000 }]]))).toBe(items);
  });

  it("deja intacto un producto del que no se pudo leer el precio", () => {
    const items = [ITEM];
    expect(applyCurrentPrices(items, new Map())).toBe(items);
  });
});

describe("fetchCurrentPrices", () => {
  it("pide cada producto una sola vez y sin caché", async () => {
    const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () =>
      Response.json({ price: 10, transferPrice: 9 })
    );

    const prices = await fetchCurrentPrices(
      [
        { ...ITEM, flavor: "Frutilla" },
        { ...ITEM, flavor: "Vainilla" },
      ],
      fetchMock
    );

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/products/p1");
    expect(init?.cache).toBe("no-store");
    // Con mala conexión no puede dejar trabado el botón de finalizar.
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(prices).toEqual(new Map([["p1", { price: 10, transferPrice: 9 }]]));
  });

  it("omite los productos que fallan sin perder los demás", async () => {
    const fetchMock = async (url: string) => {
      if (url.endsWith("p1")) throw new Error("sin red");
      if (url.endsWith("p2")) return Response.json({ error: "Producto no encontrado" }, { status: 404 });
      if (url.endsWith("p3")) return Response.json({ price: "gratis" });
      return Response.json({ price: 10, transferPrice: null });
    };

    const prices = await fetchCurrentPrices(
      ["p1", "p2", "p3", "p4"].map((_id) => ({ ...ITEM, _id })),
      fetchMock
    );

    expect(prices).toEqual(new Map([["p4", { price: 10, transferPrice: null }]]));
  });
});
