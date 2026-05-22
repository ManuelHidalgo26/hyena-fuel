import type { ReactNode } from "react";
import Script from "next/script";
import "../styles/globals.css";
import Navbar from "../components/layout/Navbar/Navbar";
import Footer from "../components/layout/Footer/Footer";
import { CartProvider } from "../context/CartContext";
import CartDrawer from "../components/cart/CartDrawer";
import ShippingBanner from "../components/layout/ShippingBanner";

export const metadata = {
  title: "HYENA FUEL | Suplementos deportivos en Córdoba",
  description:
    "Suplementos deportivos de calidad para atletas que no negocian con la mediocridad. Whey Protein, Creatina, Pre-Entreno y más. Envío gratis en Córdoba.",
  keywords: "suplementos deportivos córdoba, proteína whey, creatina, pre-entreno, BCAA",
  icons: { icon: "/favicon.ico" },
  openGraph: {
    title: "HYENA FUEL | Suplementos deportivos en Córdoba",
    description:
      "Suplementos deportivos de calidad para atletas que no negocian con la mediocridad.",
    type: "website",
    locale: "es_AR",
    images: [
      {
        url: "/images/hyena-fuel-logo.png",
        width: 400,
        height: 180,
        alt: "HYENA FUEL Logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "HYENA FUEL | Suplementos deportivos",
    description: "Combustible para tu entrenamiento. Suplementos de calidad en Córdoba.",
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
          <ShippingBanner />
          <CartDrawer />
          <main className="main-content">{children}</main>
          <Footer />
        </CartProvider>
      </body>
    </html>
  );
}
