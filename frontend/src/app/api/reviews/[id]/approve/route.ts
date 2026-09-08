import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "../../../../../lib/auth/guards";
import { createAdminClient } from "../../../../../lib/supabase/admin";
import { isUuid } from "../../../../../lib/uuid";

type RouteContext = { params: Promise<{ id: string }> };

/** Aprueba una reseña pendiente: a partir de acá aparece en el listado público (`GET /api/reviews`). */
export async function PATCH(_request: NextRequest, { params }: RouteContext) {
  const guard = await requireAdmin();
  if (!guard.authorized) return guard.response;

  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Id de reseña inválido" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("reviews")
    .update({ approved: true })
    .eq("id", id)
    .select("id")
    .maybeSingle()
    .returns<{ id: string } | null>();

  if (error) {
    console.error("[PATCH /api/reviews/[id]/approve]", error);
    return NextResponse.json({ error: "No se pudo aprobar la reseña" }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Reseña no encontrada" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
