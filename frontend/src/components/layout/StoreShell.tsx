"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Navbar from "./Navbar/Navbar";
import Footer from "./Footer/Footer";
import ShippingBanner from "./ShippingBanner";
import CartDrawer from "../cart/CartDrawer";

const PANEL_PATH_PREFIX = "/panel";
const PANEL_BODY_CLASS = "panel-theme";

function isPanelRoute(pathname: string): boolean {
  return pathname === PANEL_PATH_PREFIX || pathname.startsWith(`${PANEL_PATH_PREFIX}/`);
}

/**
 * Gate de chrome de tienda por pathname (ADR 0004). En `/panel` y `/panel/**`
 * no renderiza Navbar/ShippingBanner/CartDrawer/Footer (el panel provee su
 * propia cromática desde `panel/layout.tsx`/`panel/(app)/layout.tsx`); en el
 * resto de la app renderiza exactamente el árbol que ya tenía `RootLayout`.
 *
 * `"use client"` porque los layouts de App Router no reciben el pathname —
 * es la única forma de leerlo sin mover archivos de la tienda a un route
 * group propio (diferido a Fase 2, ver ADR 0004).
 */
export default function StoreShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isPanel = isPanelRoute(pathname);

  // Fondo oscuro del propio `<body>` en rutas del panel (globals.css:
  // `body.panel-theme`), para que no se asome el fondo claro de la tienda
  // en zonas de overscroll/rebote de páginas más altas que el viewport.
  useEffect(() => {
    document.body.classList.toggle(PANEL_BODY_CLASS, isPanel);
    return () => document.body.classList.remove(PANEL_BODY_CLASS);
  }, [isPanel]);

  if (isPanel) {
    return <>{children}</>;
  }

  return (
    <>
      <Navbar />
      <ShippingBanner />
      <CartDrawer />
      <main className="main-content">{children}</main>
      <Footer />
    </>
  );
}
