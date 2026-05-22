import Image from "next/image";
import { getProductBySlug } from "../../../lib/api/products.api";
import styles from "./ProductDetail.module.css";
import AddToCart from "./AddToCart";
import TrackViewItem from "./TrackViewItem";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) {
    return { title: "Producto no encontrado | HYENA FUEL" };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";
  const imageUrl = product.images?.[0]
    ? product.images[0].startsWith("http")
      ? product.images[0]
      : `${siteUrl}${product.images[0]}`
    : null;

  return {
    title: `${product.name} | HYENA FUEL`,
    description: product.description,
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
    return <h2 style={{ padding: "2rem" }}>Producto no encontrado</h2>;
  }

  const isLowStock = product.stock > 0 && product.stock <= 5;
  const isMediumStock = product.stock > 5 && product.stock <= 10;
  const isOutOfStock = product.stock === 0;

  return (
    <section className={styles.container}>
      <div className={styles.imageWrapper}>
        {product.images?.[0] && (
          <Image
            src={product.images[0]}
            alt={product.name}
            width={400}
            height={400}
            priority
          />
        )}
      </div>

      <div className={styles.info}>
        <TrackViewItem product={product} />
        <h1>{product.name}</h1>

        {/* STOCK BADGE */}
        {isOutOfStock && (
          <div className={styles.stockBadge + " " + styles.outOfStock}>
            ✕ Sin stock
          </div>
        )}
        {isLowStock && (
          <div className={styles.stockBadge + " " + styles.lowStock}>
            🔥 ¡Últimas {product.stock} unidades!
          </div>
        )}
        {isMediumStock && (
          <div className={styles.stockBadge + " " + styles.mediumStock}>
            ⚠️ Pocas unidades disponibles
          </div>
        )}

        {product.description && (
          <p className={styles.description}>{product.description}</p>
        )}

        {/* PRECIOS */}
        <div className={styles.prices}>
          {typeof product.transferPrice === "number" &&
          product.transferPrice < product.price ? (
            <>
              <div className={styles.transferPrice}>
                ${product.transferPrice.toLocaleString("es-AR")}
              </div>

              <div className={styles.saving}>
                Ahorrás $
                {(product.price - product.transferPrice).toLocaleString("es-AR")} pagando
                por transferencia
              </div>

              <div className={styles.listPrice}>
                ${product.price.toLocaleString("es-AR")}
              </div>
            </>
          ) : (
            <div className={styles.transferPrice}>
              ${product.price.toLocaleString("es-AR")}
            </div>
          )}
        </div>

        <div className={styles.ctaGroup}>
          <AddToCart product={product} disabled={isOutOfStock} />

          <a
            className={styles.instagram}
            href="https://www.instagram.com/hyenafuel"
            target="_blank"
            rel="noopener noreferrer"
          >
            Seguinos en Instagram
          </a>
        </div>
      </div>
    </section>
  );
}
