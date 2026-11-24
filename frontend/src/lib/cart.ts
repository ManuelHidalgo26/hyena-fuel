/** Línea del carrito tal como se guarda en el navegador. */
export type CartItem = {
  _id: string;
  name: string;
  /** Precio de lista. */
  price: number;
  /** Precio por transferencia/efectivo. `null` = se cobra el de lista. */
  transferPrice: number | null;
  image: string | null;
  flavor: string | null;
  quantity: number;
};

export type CurrentPrice = Pick<CartItem, "price" | "transferPrice">;

/** Tope de espera de los precios vigentes: con mala conexión no puede trabar la compra. */
const PRICE_TIMEOUT_MS = 5000;

type Fetcher =(url: string, init?: RequestInit) => Promise<Response>;

function isPrice(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function asText(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

function parseItem(value: unknown): CartItem | null {
  if (typeof value !== "object" || value === null) return null;

  const item = value as Record<string, unknown>;
  const _id = asText(item._id);
  const name = asText(item.name);
  if (!_id || !name || !isPrice(item.price)) return null;
  if (typeof item.quantity !== "number" || !Number.isInteger(item.quantity) || item.quantity < 1) return null;

  return {
    _id,
    name,
    price: item.price,
    transferPrice: isPrice(item.transferPrice) ? item.transferPrice : null,
    image: asText(item.image),
    flavor: asText(item.flavor),
    quantity: item.quantity,
  };
}

/** Lee el carrito guardado. Un dato dañado se descarta: nunca puede romper la tienda. */
export function parseStoredCart(raw: string | null): CartItem[] {
  if (!raw) return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(parseItem).filter((item) => item !== null);
  } catch {
    return [];
  }
}

/** Precios vigentes de los productos del carrito. Los que no se pudieron leer no aparecen en el mapa. */
export async function fetchCurrentPrices(
  items: CartItem[],
  fetcher: Fetcher = fetch
): Promise<Map<string, CurrentPrice>> {
  const ids = Array.from(new Set(items.map((item) => item._id)));
  const prices = new Map<string, CurrentPrice>();

  await Promise.all(
    ids.map(async (id) => {
      try {
        const response = await fetcher(`/api/products/${encodeURIComponent(id)}`, {
          cache: "no-store",
          signal: AbortSignal.timeout(PRICE_TIMEOUT_MS),
        });
        if (!response.ok) return;

        const { price, transferPrice } = await response.json();
        if (!isPrice(price)) return;
        prices.set(id, { price, transferPrice: isPrice(transferPrice) ? transferPrice : null });
      } catch {
        // Sin precio vigente: se conserva el guardado y el total definitivo lo fija el servidor.
      }
    })
  );

  return prices;
}

/** Aplica los precios vigentes. Si nada cambió devuelve el mismo array. */
export function applyCurrentPrices(items: CartItem[], prices: Map<string, CurrentPrice>): CartItem[] {
  let changed = false;

  const next = items.map((item) => {
    const current = prices.get(item._id);
    if (!current || (current.price === item.price && current.transferPrice === item.transferPrice)) return item;
    changed = true;
    return { ...item, price: current.price, transferPrice: current.transferPrice };
  });

  return changed ? next : items;
}
