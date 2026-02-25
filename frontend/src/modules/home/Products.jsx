import styles from "./Products.module.css";
import { getProducts } from "../../lib/api/products.api";
import ProductsClient from "./ProductsClient";

export default async function Products() {
  const products = await getProducts();

  return (
    <section id="products" className={styles.products}>
      <h2 className={styles.title}>Nuestros productos</h2>
      <ProductsClient products={products} />
    </section>
  );
}