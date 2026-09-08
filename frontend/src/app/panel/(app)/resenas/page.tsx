import { redirect } from "next/navigation";
import { getSessionUser } from "../../../../lib/auth/guards";
import { createClient } from "../../../../lib/supabase/server";
import { REVIEW_COLUMNS, mapReview, type ReviewRow } from "../../../../lib/reviews";
import ResenasClient from "./ResenasClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Reseñas | Panel HYENA FUEL",
};

/**
 * Server Component: lista las reseñas pendientes (`approved=false`) leyendo
 * directo de Supabase con el cliente SSR (RLS `is_admin()` habilita ver las
 * no aprobadas, spec Admin UI §3.2). Aprobar/eliminar van por `ResenasClient`.
 */
export default async function ResenasPage() {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") {
    redirect("/panel/login");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reviews")
    .select(REVIEW_COLUMNS)
    .eq("approved", false)
    .order("created_at", { ascending: false })
    .returns<ReviewRow[]>();

  if (error) {
    throw new Error("No se pudieron cargar las reseñas");
  }

  const reviews = (data ?? []).map(mapReview);

  return <ResenasClient initialReviews={reviews} />;
}
