import type { ReactNode } from "react";
import CartDrawer from "../../components/cart/CartDrawer";
import Footer from "../../components/layout/Footer/Footer";
import Navbar from "../../components/layout/Navbar/Navbar";
import ShippingBanner from "../../components/layout/ShippingBanner";
import WhatsAppFloat from "../../components/layout/WhatsAppFloat/WhatsAppFloat";
import { CartProvider } from "../../context/CartContext";

/**
 * Layout de tienda (route group `(store)`, spec Fase 2 §2). Reemplaza al
 * `StoreShell` de Fase 1 (ADR 0004): en vez de gatear el chrome por
 * pathname en un client component, ahora vive en su propio layout y solo
 * envuelve las rutas de tienda. `/panel/**` está en otra rama del árbol y
 * nunca lo ve.
 */
export default function StoreLayout({ children }: { children: ReactNode }) {
  return (
    <CartProvider>
      <Navbar />
      <ShippingBanner />
      <CartDrawer />
      <main className="main-content">{children}</main>
      <Footer />
      <WhatsAppFloat />
    </CartProvider>
  );
}
