import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { getProductBySlug } from "../../../../lib/api/products.api";
import styles from "./ProductDetail.module.css";
import ProductPurchasePanel from "./ProductPurchasePanel";

const SITE_URL = "https://www.hyenafuel.com";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) {
    return { title: "Producto no encontrado | HYENA FUEL" };
  }

  const imageUrl = product.images?.[0]
    ? product.images[0].startsWith("http")
      ? product.images[0]
      : `${SITE_URL}${product.images[0]}`
    : null;

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

export default async function ProductDetail({ params }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) {
    notFound();
  }

  return (
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
  );
}
