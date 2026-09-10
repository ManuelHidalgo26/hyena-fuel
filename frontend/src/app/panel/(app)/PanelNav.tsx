"use client";

import { usePathname } from "next/navigation";
import { AdminNav, AdminButton, type AdminNavItem } from "../../../components/admin";
import { signOutAction } from "../actions";

const NAV_ITEMS: Array<Pick<AdminNavItem, "href" | "label">> = [
  { href: "/panel", label: "Inicio" },
  { href: "/panel/pedidos", label: "Pedidos" },
  { href: "/panel/productos", label: "Productos" },
  { href: "/panel/resenas", label: "Reseñas" },
  { href: "/panel/suscriptores", label: "Suscriptores" },
];

type PanelNavProps = {
  userEmail: string;
};

/**
 * Client Component chico que solo existe para leer `usePathname()` (`AdminNav`
 * es presentacional y no puede hacerlo). El guard de sesión sigue viviendo en
 * `(app)/layout.tsx` (Server Component).
 */
export default function PanelNav({ userEmail }: PanelNavProps) {
  const pathname = usePathname();
  const items: AdminNavItem[] = NAV_ITEMS.map((item) => ({
    ...item,
    // "/panel" es prefijo de todas las rutas del panel: match exacto para que
    // "Inicio" no quede siempre activo (spec-panel-admin-mejoras.md §3.1).
    active: item.href === "/panel" ? pathname === "/panel" : pathname.startsWith(item.href),
  }));

  return (
    <AdminNav
      items={items}
      userEmail={userEmail}
      signOutSlot={
        <form action={signOutAction}>
          <AdminButton type="submit" variant="secondary" size="sm">
            Cerrar sesión
          </AdminButton>
        </form>
      }
    />
  );
}
