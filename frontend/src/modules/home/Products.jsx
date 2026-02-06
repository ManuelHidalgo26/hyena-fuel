import Link from "next/link";
import Image from "next/image";
import styles from "./Products.module.css";
import { getProducts } from "../../lib/api/products.api";
import AddToCartButton from "../../components/cart/AddToCartButton";

export default async function Products() {
  const products = await getProducts();

  return (
    <section id="products" className={styles.products}>
      <h2 className={styles.title}>Nuestros productos</h2>

      <div className={styles.grid}>
        {products.map((product) => {
          const hasTransferPrice =
            typeof product.transferPrice === "number" &&
            product.transferPrice < product.price;

          const saving = hasTransferPrice
            ? product.price - product.transferPrice
            : 0;

          return (
            <div key={product._id} className={styles.card}>
              {/* IMAGEN */}
              <Link
                href={`/producto/${product.slug}`}
                className={styles.cardLink}
              >
                <div className={styles.imageWrapper}>
                  {product.images?.[0] && (
                    <Image
                      src={product.images[0]}
                      alt={product.name}
                      width={260}
                      height={260}
                      className={styles.image}
                    />
                  )}
                </div>
              </Link>

              {/* NOMBRE */}
              <h3 className={styles.name}>{product.name}</h3>

              {/* PRECIOS */}
              <div className={styles.prices}>
                {hasTransferPrice && (
                  <>
                    <div className={styles.transferPrice}>
                      ${product.transferPrice.toLocaleString("es-AR")}
                    </div>

                    <div className={styles.saving}>
                      Ahorrás ${saving.toLocaleString("es-AR")} pagando por
                      transferencia
                    </div>

                    <div className={styles.listPrice}>
                      ${product.price.toLocaleString("es-AR")}
                    </div>
                  </>
                )}

                {!hasTransferPrice && (
                  <div className={styles.transferPrice}>
                    ${product.price.toLocaleString("es-AR")}
                  </div>
                )}
              </div>

              {/* CTA */}
              <div className={styles.cta}>
                <AddToCartButton product={product} />

                <Link
                  href={`/producto/${product.slug}`}
                  className={styles.detailLink}
                >
                  Ver detalle
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

