import { createClient } from "../supabase/client";

const PRODUCT_IMAGES_BUCKET = "product-images";

/** Mapea el MIME type a una extensión de archivo válida cuando el nombre no trae una. */
const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Minúsculas, sin espacios, solo `[a-z0-9-_.]` (spec §1.2c). */
function sanitize(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-_.]/g, "");
}

function extensionFor(file: File): string {
  const fromName = file.name.split(".").pop();
  if (fromName && fromName !== file.name) {
    const sanitized = sanitize(fromName);
    if (sanitized) return sanitized;
  }
  return EXTENSION_BY_MIME[file.type] ?? "bin";
}

function baseNameFor(file: File): string {
  const withoutExtension = file.name.replace(/\.[^/.]+$/, "");
  const sanitized = sanitize(withoutExtension);
  return sanitized || "imagen";
}

function buildPath(file: File): string {
  const id = crypto.randomUUID();
  const base = baseNameFor(file);
  const ext = extensionFor(file);
  return `products/${id}-${base}.${ext}`;
}

/**
 * Sube una imagen de producto directo del browser a Supabase Storage (ADR
 * 0007): evita el límite ~4.5MB de las funciones de Vercel y deja la
 * validación de tipo/tamaño al bucket (RLS admin-only para escritura).
 * Devuelve la URL pública para guardar en `products.images[]`.
 */
export async function uploadProductImage(file: File): Promise<string> {
  const supabase = createClient();
  const path = buildPath(file);

  const { error } = await supabase.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (error) {
    throw new Error(`No se pudo subir la imagen: ${error.message}`);
  }

  const { data } = supabase.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
