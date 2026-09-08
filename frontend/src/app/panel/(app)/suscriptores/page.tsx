import { redirect } from "next/navigation";
import { getSessionUser } from "../../../../lib/auth/guards";
import { createClient } from "../../../../lib/supabase/server";
import { AdminPageHeader, AdminTable, AdminEmptyState } from "../../../../components/admin";
import styles from "../../../../components/admin/admin.module.css";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Suscriptores | Panel HYENA FUEL",
};

type NewsletterRow = {
  id: string;
  email: string;
  created_at: string;
};

/**
 * Tabla de solo lectura (spec Admin UI §1.1): sin mutaciones, así que no
 * hace falta Client Component — todo el listado vive en este Server
 * Component, leyendo directo de Supabase con el cliente SSR.
 */
export default async function SuscriptoresPage() {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") {
    redirect("/panel/login");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("newsletter")
    .select("id, email, created_at")
    .order("created_at", { ascending: false })
    .returns<NewsletterRow[]>();

  if (error) {
    throw new Error("No se pudieron cargar los suscriptores");
  }

  const subscribers = data ?? [];

  return (
    <>
      <AdminPageHeader title="Suscriptores" description="Lista del newsletter, solo lectura." />

      {subscribers.length === 0 ? (
        <AdminEmptyState
          title="Todavía no hay suscriptores"
          description="Cuando alguien se suscriba desde el newsletter, va a aparecer acá."
        />
      ) : (
        <AdminTable caption="Listado de suscriptores">
          <thead>
            <tr>
              <th>Email</th>
              <th>Fecha</th>
            </tr>
          </thead>
          <tbody>
            {subscribers.map((subscriber) => (
              <tr key={subscriber.id}>
                <td>{subscriber.email}</td>
                <td className={styles.cellMuted}>{new Date(subscriber.created_at).toLocaleDateString("es-AR")}</td>
              </tr>
            ))}
          </tbody>
        </AdminTable>
      )}
    </>
  );
}
