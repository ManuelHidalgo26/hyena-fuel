const API_URL = process.env.NEXT_PUBLIC_API_URL as string;

export async function getProducts() {
  const res = await fetch(`${API_URL}/api/products`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Error al obtener productos");
  }

  return res.json();
}

export async function getProductBySlug(slug: string) {
  const res = await fetch(`${API_URL}/api/products/${slug}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    return null;
  }

  return res.json();
}
