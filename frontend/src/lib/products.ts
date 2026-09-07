/** Fila cruda de `products` con todas las columnas de negocio (solo admin, nunca al público). */
export type AdminProductRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number | string;
  transfer_price: number | string | null;
  cost: number | string;
  stock: number;
  images: string[] | null;
  brand: string | null;
  active: boolean;
  commission_override_pct: number | string | null;
  commission_override_amount: number | string | null;
  created_at: string;
};

/** Shape de producto para el panel admin: incluye `cost`, `active` y overrides de comisión. */
export type AdminProduct = {
  _id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  transferPrice: number | null;
  cost: number;
  stock: number;
  images: string[];
  brand: string | null;
  active: boolean;
  commissionOverridePct: number | null;
  commissionOverrideAmount: number | null;
  createdAt: string;
};

export const ADMIN_PRODUCT_COLUMNS =
  "id, name, slug, description, price, transfer_price, cost, stock, images, brand, active, commission_override_pct, commission_override_amount, created_at";

export function mapAdminProduct(row: AdminProductRow): AdminProduct {
  return {
    _id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    price: Number(row.price),
    transferPrice: row.transfer_price === null ? null : Number(row.transfer_price),
    cost: Number(row.cost),
    stock: row.stock,
    images: row.images ?? [],
    brand: row.brand,
    active: row.active,
    commissionOverridePct:
      row.commission_override_pct === null ? null : Number(row.commission_override_pct),
    commissionOverrideAmount:
      row.commission_override_amount === null ? null : Number(row.commission_override_amount),
    createdAt: row.created_at,
  };
}
