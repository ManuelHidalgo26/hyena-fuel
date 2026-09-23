import { createPublicClient } from "../supabase/public";
import { isUuid } from "../uuid";

/** Specs de ficha de la PDP (ADR 0005 §2). Todas opcionales; la UI renderiza solo lo presente. */
export type ProductAttributes = {
  servingSize?: string;
  servingsPerContainer?: number;
  proteinPerServing?: string;
  netWeight?: string;
  flavors?: string[];
  highlights?: string[];
};

/** Shape público de un sabor (ADR 0008): nada sensible, sin `cost`. */
export type ProductVariant = {
  name: string;
  image: string | null;
  stock: number;
};

export type Product = {
  _id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  transferPrice: number | null;
  stock: number;
  images: string[];
  brand: string | null;
  category: string | null;
  attributes: ProductAttributes;
  /** Sabores activos (ADR 0008). Vacío = producto sin sabores, se comporta como hoy. */
  variants: ProductVariant[];
};

type ProductVariantRow = {
  name: string;
  image: string | null;
  stock: number;
};

type ProductRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number | string;
  transfer_price: number | string | null;
  stock: number;
  images: string[] | null;
  brand: string | null;
  category: string | null;
  attributes: ProductAttributes | null;
  product_variants: ProductVariantRow[] | null;
};

// Datos públicos del producto. NO incluye `cost` ni overrides de comisión (nunca al público).
// `category`/`attributes` (ADR 0005) sí son públicos: facet de filtro + specs de ficha.
// `product_variants` (ADR 0008) embebe solo `name/image/stock`; RLS ya filtra a variantes
// `active` de productos `active` (mismo patrón que `products_public_read`).
const PRODUCT_COLUMNS =
  "id, name, slug, description, price, transfer_price, stock, images, brand, category, attributes, product_variants(name, image, stock)";

function mapProduct(row: ProductRow): Product {
  return {
    _id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    price: Number(row.price),
    transferPrice: row.transfer_price === null ? null : Number(row.transfer_price),
    stock: row.stock,
    images: row.images ?? [],
    brand: row.brand,
    category: row.category,
    attributes: row.attributes ?? {},
    variants: (row.product_variants ?? []).map((variant) => ({
      name: variant.name,
      image: variant.image,
      stock: variant.stock,
    })),
  };
}

/** Lista los productos activos, más nuevos primero. Lectura pública (RLS: active=true). */
export async function getProducts(): Promise<Product[]> {
  const supabase = createPublicClient();

  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_COLUMNS)
    .eq("active", true)
    // QA (ADR 0008, gate runtime): filtro explícito de la relación embebida. Para
    // anon/authenticated no-admin la RLS ya alcanza (product_variants_public_read
    // exige active=true), pero un admin autenticado navegando la tienda pública cae
    // bajo product_variants_admin_all (is_admin() -> ALL sin filtro) y ese embed
    // devolvería también variantes inactivas. Verificado en runtime: con service_role
    // (mismo alcance efectivo que admin) el embed sin este filtro traía la variante
    // inactiva de prueba; con el filtro, no. Filtra la fila hija, no excluye el padre.
    .eq("product_variants.active", true)
    .order("created_at", { ascending: false })
    .order("position", { foreignTable: "product_variants", ascending: true })
    .returns<ProductRow[]>();

  if (error) {
    throw new Error(`Error al obtener productos: ${error.message}`);
  }

  return (data ?? []).map(mapProduct);
}

/** Busca un producto activo por slug. Devuelve null si no existe (no lanza 404). */
export async function getProductBySlug(slug: string): Promise<Product | null> {
  const supabase = createPublicClient();

  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_COLUMNS)
    .eq("slug", slug)
    .eq("active", true)
    // QA (ADR 0008, gate runtime): ver nota en `getProducts` — filtra la variante
    // embebida a `active=true` explícito, para no depender solo de RLS ante un
    // admin autenticado navegando la PDP pública.
    .eq("product_variants.active", true)
    .order("position", { foreignTable: "product_variants", ascending: true })
    .maybeSingle()
    .returns<ProductRow | null>();

  if (error) {
    throw new Error(`Error al obtener el producto "${slug}": ${error.message}`);
  }

  return data ? mapProduct(data) : null;
}

/** Busca un producto activo por id (uuid). Devuelve null si no existe. */
export async function getProductById(id: string): Promise<Product | null> {
  const supabase = createPublicClient();

  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_COLUMNS)
    .eq("id", id)
    .eq("active", true)
    // QA (ADR 0008, gate runtime): ver nota en `getProducts` — filtra la variante
    // embebida a `active=true` explícito, para no depender solo de RLS ante un
    // admin autenticado navegando la PDP pública.
    .eq("product_variants.active", true)
    .order("position", { foreignTable: "product_variants", ascending: true })
    .maybeSingle()
    .returns<ProductRow | null>();

  if (error) {
    throw new Error(`Error al obtener el producto "${id}": ${error.message}`);
  }

  return data ? mapProduct(data) : null;
}

/** Resuelve un producto activo por slug, o por id si `key` tiene formato de uuid (usado por `products/[key]`). */
export async function getProductByKey(key: string): Promise<Product | null> {
  return isUuid(key) ? getProductById(key) : getProductBySlug(key);
}

export type ProductSitemapEntry = {
  slug: string;
  updatedAt: string;
};

/** Slug + fecha de modificación de los productos activos, para `sitemap.ts`. Lectura pública (RLS: active=true). */
export async function getProductSitemapEntries(): Promise<ProductSitemapEntry[]> {
  const supabase = createPublicClient();

  const { data, error } = await supabase
    .from("products")
    .select("slug, updated_at")
    .eq("active", true)
    .returns<{ slug: string; updated_at: string }[]>();

  if (error) {
    throw new Error(`Error al obtener productos para el sitemap: ${error.message}`);
  }

  return (data ?? []).map((row) => ({ slug: row.slug, updatedAt: row.updated_at }));
}
