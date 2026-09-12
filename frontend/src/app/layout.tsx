import type { ReactNode } from "react";
import { Anton, Plus_Jakarta_Sans } from "next/font/google";
import Script from "next/script";
import "../styles/globals.css";

// Sistema tipográfico de marca (design-fase-2.md §2): Anton para titulares,
// Plus Jakarta Sans para cuerpo/UI. Las variables alimentan los alias
// `--hyena-font-display`/`--hyena-font-body` de globals.css — ningún
// componente hardcodea el nombre de la fuente.
const anton = Anton({
  weight: "400",
  subsets: ["latin", "latin-ext"],
  variable: "--font-display",
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  weight: ["400", "500", "600", "700", "800"],
  subsets: ["latin", "latin-ext"],
  variable: "--font-body",
  display: "swap",
});

export const metadata = {
  metadataBase: new URL("https://www.hyenafuel.com"),
  title: "HYENA FUEL | Suplementos deportivos en Córdoba",
  description:
    "Suplementos deportivos de calidad para atletas que no negocian con la mediocridad. Whey Protein, Creatina, Pre-Entreno y más. Envío gratis en Córdoba.",
  keywords: "suplementos deportivos córdoba, proteína whey, creatina, pre-entreno, BCAA",
  alternates: { canonical: "/" },
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
    <html lang="es" className={`${anton.variable} ${jakarta.variable}`}>
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

        {/* Facebook Pixel */}
        <Script id="fb-pixel" strategy="afterInteractive">
          {`
            !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){
            n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;
            s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}
            (window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
            fbq('init','${process.env.NEXT_PUBLIC_FB_PIXEL_ID}');
            fbq('track','PageView');
          `}
        </Script>
        {children}
      </body>
    </html>
  );
}
