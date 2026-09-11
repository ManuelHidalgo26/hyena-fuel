import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "../../../lib/supabase/admin";
import { createClient } from "../../../lib/supabase/server";
import { mapReview, REVIEW_COLUMNS, type ReviewRow } from "../../../lib/reviews";
import { isUuid } from "../../../lib/uuid";

const createReviewSchema = z.object({
  name: z.string().trim().min(1, "Falta el nombre").max(60),
  text: z.string().trim().min(1, "Falta el texto").max(300),
  rating: z.number().int().min(1).max(5),
  // ADR 0005 §4: opcional. Si viene, la reseña queda asociada a ese producto
  // (la PDP la filtra); si no, es una reseña global del sitio (como hasta hoy).
  productId: z.uuid("productId inválido").optional(),
});

/**
 * Reseñas aprobadas, público. Lee con la anon key: RLS ya filtra `approved = true`.
 * Con `?productId=<uuid>` devuelve solo las de ese producto (lo consume la PDP);
 * sin el param, todas las aprobadas (comportamiento actual, lo consume la home).
 */
export async function GET(request: NextRequest) {
  const productId = request.nextUrl.searchParams.get("productId");
  if (productId !== null && !isUuid(productId)) {
    return NextResponse.json({ error: "productId inválido" }, { status: 400 });
  }

  const supabase = await createClient();

  let query = supabase
    .from("reviews")
    .select(REVIEW_COLUMNS)
    .eq("approved", true)
    .order("created_at", { ascending: false });

  if (productId !== null) {
    query = query.eq("product_id", productId);
  }

  const { data, error } = await query.returns<ReviewRow[]>();

  if (error) {
    console.error("[GET /api/reviews]", error);
    return NextResponse.json({ error: "No se pudieron obtener las reseñas" }, { status: 500 });
  }

  return NextResponse.json((data ?? []).map(mapReview));
}

/** Alta de reseña pública: entra pendiente de moderación (`approved = false`). */
export async function POST(request: NextRequest) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = createReviewSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos de reseña inválidos", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  // Si la reseña apunta a un producto, exigir que exista y esté activo (ADR 0005 §4).
  if (parsed.data.productId) {
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id")
      .eq("id", parsed.data.productId)
      .eq("active", true)
      .maybeSingle();

    if (productError) {
      console.error("[POST /api/reviews] product check", productError);
      return NextResponse.json({ error: "No se pudo enviar la reseña" }, { status: 500 });
    }
    if (!product) {
      return NextResponse.json(
        { error: "El producto de la reseña no existe o no está disponible" },
        { status: 400 }
      );
    }
  }

  const { error } = await supabase.from("reviews").insert({
    name: parsed.data.name,
    text: parsed.data.text,
    rating: parsed.data.rating,
    product_id: parsed.data.productId ?? null,
    approved: false,
  });

  if (error) {
    console.error("[POST /api/reviews]", error);
    return NextResponse.json({ error: "No se pudo enviar la reseña" }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
