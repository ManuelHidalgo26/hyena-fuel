import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "../../../../lib/auth/guards";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { isUuid } from "../../../../lib/uuid";

type RouteContext = { params: Promise<{ id: string }> };

/** Elimina una reseña, pendiente o ya aprobada (admin). */
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const guard = await requireAdmin();
  if (!guard.authorized) return guard.response;

  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Id de reseña inválido" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("reviews")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle()
    .returns<{ id: string } | null>();

  if (error) {
    console.error("[DELETE /api/reviews/[id]]", error);
    return NextResponse.json({ error: "No se pudo eliminar la reseña" }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Reseña no encontrada" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
