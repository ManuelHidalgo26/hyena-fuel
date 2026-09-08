import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "../../../lib/auth/guards";
import { createAdminClient } from "../../../lib/supabase/admin";

const subscribeSchema = z.object({
  email: z.email("Email inválido"),
});

type NewsletterRow = {
  id: string;
  email: string;
};

type NewsletterSubscriberRow = {
  id: string;
  email: string;
  created_at: string;
};

/** Listado de suscriptores (admin). */
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.authorized) return guard.response;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("newsletter")
    .select("id, email, created_at")
    .order("created_at", { ascending: false })
    .returns<NewsletterSubscriberRow[]>();

  if (error) {
    console.error("[GET /api/newsletter]", error);
    return NextResponse.json({ error: "No se pudieron obtener los suscriptores" }, { status: 500 });
  }

  return NextResponse.json(
    (data ?? []).map((row) => ({ _id: row.id, email: row.email, createdAt: row.created_at }))
  );
}

export async function POST(request: NextRequest) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = subscribeSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Email inválido", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  // on conflict (email) do nothing: si ya existe, no devuelve fila (data vacío) y no es error.
  const { data, error } = await supabase
    .from("newsletter")
    .upsert({ email: parsed.data.email }, { onConflict: "email", ignoreDuplicates: true })
    .select("id, email")
    .returns<NewsletterRow[]>();

  if (error) {
    console.error("[POST /api/newsletter]", error);
    return NextResponse.json({ error: "No se pudo suscribir" }, { status: 500 });
  }

  if (!data || data.length === 0) {
    return NextResponse.json({ error: "Ya estás suscripto" }, { status: 409 });
  }

  return NextResponse.json({ ok: true, id: data[0].id, email: data[0].email }, { status: 201 });
}
