"use client";

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

    return (
        <button
            className={styles.button}
            onClick={() => addItem(product)}
        >
            Agregar al carrito
        </button>
    );
}

