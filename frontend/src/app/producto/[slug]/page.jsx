import Image from "next/image";
import { getProductBySlug } from "../../../lib/api/products.api";
import styles from "./ProductDetail.module.css";
import AddToCart from "./AddToCart";

export default async function ProductDetail({ params }) {
  // ✅ NEXT APP ROUTER: params es una Promise
    const { slug } = await params;

    const product = await getProductBySlug(slug);

    if (!product) {
    return <h2 style={{ padding: "2rem" }}>Producto no encontrado</h2>;
    }

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
        <h1>{product.name}</h1>

        {product.description && (
            <p className={styles.description}>{product.description}</p>
        )}

        <div className={styles.price}>${product.price}</div>

        {/* Botón carrito */}
        <AddToCart product={product} />

        {/* WhatsApp */}
        <a
            className={styles.whatsapp}
            href={`https://wa.me/549XXXXXXXXXX?text=Hola, quiero el producto ${product.name}`}
            target="_blank"
            rel="noopener noreferrer"
        >
            Consultar por WhatsApp
        </a>

        {/* Instagram */}
        <a
            className={styles.instagram}
            href="https://www.instagram.com/hyenafuel"
            target="_blank"
            rel="noopener noreferrer"
        >
            Seguinos en Instagram
        </a>
        </div>
    </section>
    );
}
