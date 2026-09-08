import { createClient } from "../supabase/server";
import { isUuid } from "../uuid";

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
};

const PRODUCT_COLUMNS =
  "id, name, slug, description, price, transfer_price, stock, images, brand";

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
  };
}

/** Lista los productos activos, más nuevos primero. Lectura pública (RLS: active=true). */
export async function getProducts(): Promise<Product[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_COLUMNS)
    .eq("active", true)
    .order("created_at", { ascending: false })
    .returns<ProductRow[]>();

  if (error) {
    throw new Error(`Error al obtener productos: ${error.message}`);
  }

  return (data ?? []).map(mapProduct);
}

/** Busca un producto activo por slug. Devuelve null si no existe (no lanza 404). */
export async function getProductBySlug(slug: string): Promise<Product | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_COLUMNS)
    .eq("slug", slug)
    .eq("active", true)
    .maybeSingle()
    .returns<ProductRow | null>();

  if (error) {
    throw new Error(`Error al obtener el producto "${slug}": ${error.message}`);
  }

  return data ? mapProduct(data) : null;
}

/** Busca un producto activo por id (uuid). Devuelve null si no existe. */
export async function getProductById(id: string): Promise<Product | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_COLUMNS)
    .eq("id", id)
    .eq("active", true)
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
