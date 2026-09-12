import Hero from "../../modules/home/Hero";
import Products from "../../modules/home/Products";
import Testimonials from "../../modules/home/Testimonials";

const SITE_URL = "https://www.hyenafuel.com";

/** Organization + WebSite (JSON-LD, `@graph`) para que Google reconozca la marca en la home. */
const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: "Hyena Fuel",
      url: SITE_URL,
      logo: `${SITE_URL}/images/hyena-fuel-logo.png`,
      sameAs: ["https://www.instagram.com/hyenafuel/"],
    },
    {
      "@type": "WebSite",
      name: "Hyena Fuel",
      url: SITE_URL,
    },
  ],
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />
      <Hero />
      <Products />
      <Testimonials />
    </>
  );
}

