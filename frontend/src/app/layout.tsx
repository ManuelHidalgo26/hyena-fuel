import type { ReactNode } from "react";
import Script from "next/script";
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
        {/* Google Analytics 4 */}
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_ID}`}
          strategy="afterInteractive"
        />
        <Script id="ga4-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${process.env.NEXT_PUBLIC_GA_ID}');
          `}
        </Script>

        <CartProvider>
          <Navbar />
          <CartDrawer />
          <main className="main-content">{children}</main>
          <Footer />
        </CartProvider>
      </body>
    </html>
  );
}
