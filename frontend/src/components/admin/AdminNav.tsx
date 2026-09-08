import type { ReactNode } from "react";
import Link from "next/link";
import styles from "./admin.module.css";

export type AdminNavItem = {
  href: string;
  label: string;
  /**
   * Dev la calcula en `panel/(app)/layout.tsx` con `usePathname()` (ese
   * layout ya es el dueño de la lógica de ruteo/guard, ADR 0004) y la pasa
   * ya resuelta acá. Este componente no importa `next/navigation`: se
   * mantiene 100% presentacional/Server-Component-friendly.
   */
  active?: boolean;
};

export type AdminNavProps = {
  items: AdminNavItem[];
  userEmail: string;
  /**
   * El botón/form de "Cerrar sesión" lo arma dev (reusa `signOutAction`,
   * un server action — este componente no puede importarlo sin dejar de
   * ser presentacional). Ejemplo:
   * `<form action={signOutAction}><AdminButton type="submit" variant="secondary" size="sm">Cerrar sesión</AdminButton></form>`
   */
  signOutSlot: ReactNode;
  /** Override opcional del bloque de marca (por defecto: wordmark + caption "Panel"). */
  brand?: ReactNode;
};

/**
 * Nav superior del panel (`panel/(app)/layout.tsx`). Presentacional: no
 * hace fetch, no sabe de sesión — solo pinta lo que le pasan.
 */
export default function AdminNav({ items, userEmail, signOutSlot, brand }: AdminNavProps) {
  return (
    <nav className={styles.navBar} aria-label="Navegación del panel">
      <div className={styles.navInner}>
        {brand ?? (
          <div className={styles.navBrand}>
            <span className={styles.navBrandMark}>HYENA FUEL</span>
            <span className={styles.navBrandCaption}>Panel</span>
          </div>
        )}

        <ul className={styles.navLinks}>
          {items.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className={item.active ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink}
                aria-current={item.active ? "page" : undefined}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className={styles.navRight}>
          <span className={styles.navUserEmail} title={userEmail}>
            {userEmail}
          </span>
          {signOutSlot}
        </div>
      </div>
    </nav>
  );
}
