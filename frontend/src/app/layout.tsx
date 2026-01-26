import type { ReactNode } from "react";

import "../styles/globals.css";
import Navbar from "../components/layout/Navbar/Navbar";
import Footer from "../components/layout/Footer/Footer";
import { CartProvider } from "../context/CartContext";
import CartDrawer from "../components/cart/CartDrawer";

export const metadata = {
  title: "HYENA FUEL",
  description: "HYENA FUEL — Combustible para tu entrenamiento",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="es">
      <body className="layout-body">
        <CartProvider>
          <Navbar />
          <CartDrawer />
          <main>{children}</main>
          <Footer />
        </CartProvider>
      </body>
    </html>
  );
}

