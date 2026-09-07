import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "../../../lib/supabase/admin";
import { createClient } from "../../../lib/supabase/server";
import { mapReview, REVIEW_COLUMNS, type ReviewRow } from "../../../lib/reviews";

const createReviewSchema = z.object({
  name: z.string().trim().min(1, "Falta el nombre").max(60),
  text: z.string().trim().min(1, "Falta el texto").max(300),
  rating: z.number().int().min(1).max(5),
});

/** Reseñas aprobadas, público. Lee con la anon key: RLS ya filtra `approved = true`. */
export async function GET() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("reviews")
    .select(REVIEW_COLUMNS)
    .eq("approved", true)
    .order("created_at", { ascending: false })
    .returns<ReviewRow[]>();

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
  const { error } = await supabase.from("reviews").insert({
    name: parsed.data.name,
    text: parsed.data.text,
    rating: parsed.data.rating,
    approved: false,
  });

  if (error) {
    console.error("[POST /api/reviews]", error);
    return NextResponse.json({ error: "No se pudo enviar la reseña" }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
