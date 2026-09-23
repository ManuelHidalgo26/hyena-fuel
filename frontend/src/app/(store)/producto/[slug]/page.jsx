import { cache } from "react";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { getProductBySlug, getProductSitemapEntries } from "../../../../lib/api/products.api";
import styles from "./ProductDetail.module.css";
import ProductPurchasePanel from "./ProductPurchasePanel";
import ProductSpecs from "./ProductSpecs";
import FlavorList from "./FlavorList";
import ProductReviews from "./ProductReviews";

// ISR (ADR 0009 D1/D2): PDP sin cookies vía `createPublicClient`, cacheada
// 5 min y regenerada al toque por `revalidateStorefront()`. Los slugs nuevos
// (no pre-generados) se resuelven on-demand en el primer hit y quedan
// cacheados (`dynamicParams` explícito).
export const revalidate = 300;
export const dynamicParams = true;

const SITE_URL = "https://www.hyenafuel.com";

/** Pre-genera todos los slugs activos en build (sin try/catch: si Supabase
 *  falla acá, el build falla y Vercel mantiene el deploy anterior — ADR 0009). */
export async function generateStaticParams() {
  const entries = await getProductSitemapEntries();
  return entries.map(({ slug }) => ({ slug }));
}

// Dedupe: `generateMetadata` y `ProductDetail` leen el mismo slug en el mismo
// request. `cache()` de React memoiza la promesa para que solo pegue a la DB
// una vez por render (no cambia `getProductBySlug` ni su filtro `active`).
const loadProduct = cache((slug) => getProductBySlug(slug));

function toAbsoluteImage(image) {
  return image.startsWith("http") ? image : `${SITE_URL}${image}`;
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const product = await loadProduct(slug);

  // Con ISR (ADR 0009 D7) la PDP se renderiza buffereada (`isSSG = true`), así
  // que este `notFound()` fija un 404 real cacheado para cualquier user-agent,
  // no solo un status parcial antes del shell de `loading.tsx`.
  if (!product) {
    notFound();
  }

  const imageUrl = product.images?.[0] ? toAbsoluteImage(product.images[0]) : null;

  return {
    title: `${product.name} | HYENA FUEL`,
    description: product.description,
    alternates: { canonical: `/producto/${slug}` },
    openGraph: {
      title: `${product.name} | HYENA FUEL`,
      description: product.description,
      images: imageUrl ? [{ url: imageUrl, width: 400, height: 400, alt: product.name }] : [],
      type: "website",
    },
  };
}

function buildProductJsonLd(product, slug) {
  const hasStock =
    product.variants.length > 0
      ? product.variants.some((variant) => variant.stock > 0)
      : product.stock > 0;

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    image: product.images.map(toAbsoluteImage),
    ...(product.description ? { description: product.description } : {}),
    ...(product.brand ? { brand: { "@type": "Brand", name: product.brand } } : {}),
    offers: {
      "@type": "Offer",
      priceCurrency: "ARS",
      price: product.price,
      availability: hasStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: `${SITE_URL}/producto/${slug}`,
    },
  };
}

export default async function ProductDetail({ params }) {
  const { slug } = await params;
  const product = await loadProduct(slug);

  // Defensa en profundidad: si por algún motivo `generateMetadata` no cortara
  // el request antes (p.ej. llamada directa al componente en un contexto que
  // no la ejecute), esto sigue evitando renderizar una PDP sin producto.
  if (!product) {
    notFound();
  }

  const productJsonLd = buildProductJsonLd(product, slug);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      <section className={styles.container}>
        {/* ProductPurchasePanel (Client Component) es dueño del estado de sabor/imagen
            (ADR 0008) — imagen, nombre, badge de stock, precios, selector y CTA viven
            ahí. La descripción, la ficha de specs y la lista de sabores legado se
            siguen resolviendo acá (Server Components) y se pasan como `children` para
            no bundlear markdown/render estático ni perder SSR del contenido. */}
        <ProductPurchasePanel product={product}>
          <ProductSpecs attributes={product.attributes} />
          <FlavorList flavors={product.attributes.flavors} hasVariants={product.variants.length > 0} />

          {product.description && (
            <div className={styles.descriptionSection}>
              <h2 className={styles.descriptionHeading}>Descripción</h2>
              <div className={styles.description}>
                <ReactMarkdown>{product.description}</ReactMarkdown>
              </div>
            </div>
          )}
        </ProductPurchasePanel>

        {/* Sibling full-width (spec-pdp-c1c3.md C3): `.container` es grid de 2
            columnas (imagen+info); `.reviewsSection` usa grid-column:1/-1 para
            ocupar todo el ancho debajo. */}
        <ProductReviews productId={product._id} />
      </section>
    </>
  );
}
