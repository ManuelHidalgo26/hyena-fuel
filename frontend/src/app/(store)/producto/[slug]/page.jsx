import { cache } from "react";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { getProductBySlug } from "../../../../lib/api/products.api";
import styles from "./ProductDetail.module.css";
import ProductPurchasePanel from "./ProductPurchasePanel";

const SITE_URL = "https://www.hyenafuel.com";

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

  // `generateMetadata` resuelve antes de que Next flushee el <head>/shell de
  // `loading.tsx`, así que este `notFound()` compromete el status 404 real
  // aunque la PDP sea dinámica y esté envuelta en el Suspense de `(store)`.
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
            ahí. La descripción se sigue resolviendo acá (Server Component) con
            `ReactMarkdown` server-side y se pasa como `children` para no bundlear
            markdown ni perder SSR del contenido más pesado de la página. */}
        <ProductPurchasePanel product={product}>
          {product.description && (
            <div className={styles.descriptionSection}>
              <h2 className={styles.descriptionHeading}>Descripción</h2>
              <div className={styles.description}>
                <ReactMarkdown>{product.description}</ReactMarkdown>
              </div>
            </div>
          )}
        </ProductPurchasePanel>
      </section>
    </>
  );
}
