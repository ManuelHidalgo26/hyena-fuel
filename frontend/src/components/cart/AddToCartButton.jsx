"use client";

import Link from "next/link";
import { useCart } from "../../context/CartContext";
import styles from "./AddToCartButton.module.css";

export default function AddToCartButton({ product }) {
    const { addItem } = useCart();

    if (product.stock === 0) {
        return (
            <a
                href="https://www.instagram.com/hyenafuel/"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.pedidoBtn}
            >
                Consultar a pedido →
            </a>
        );
    }

    // Producto con sabores (ADR 0008): el pedido exige un sabor, que solo se
    // elige en la PDP. Agregarlo desde la grilla dejaba un ítem sin sabor que
    // el server rechaza al finalizar la compra.
    if (product.variants?.length > 0) {
        return (
            <Link href={`/producto/${product.slug}`} className={`${styles.button} ${styles.linkButton}`}>
                Elegir sabor
            </Link>
        );
    }

    return (
        <button
            className={styles.button}
            onClick={() => addItem(product)}
        >
            Agregar al carrito
        </button>
    );
}

