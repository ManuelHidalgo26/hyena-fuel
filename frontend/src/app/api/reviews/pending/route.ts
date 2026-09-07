import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../lib/auth/guards";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { mapReview, REVIEW_COLUMNS, type ReviewRow } from "../../../../lib/reviews";

/** Reseñas pendientes de moderación (admin). */
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.authorized) return guard.response;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("reviews")
    .select(REVIEW_COLUMNS)
    .eq("approved", false)
    .order("created_at", { ascending: false })
    .returns<ReviewRow[]>();

  if (error) {
    console.error("[GET /api/reviews/pending]", error);
    return NextResponse.json(
      { error: "No se pudieron obtener las reseñas pendientes" },
      { status: 500 }
    );
  }

  return NextResponse.json((data ?? []).map(mapReview));
}
