"use client";

import { FaCartPlus } from "react-icons/fa";
import { useCart } from "../../../../context/CartContext";
import styles from "./ProductDetail.module.css";

export default function AddToCart({
    product,
    flavor = null,
    disabled = false,
    outOfStock = false,
    ariaDescribedBy,
}) {
    const { addItem, openCart } = useCart();

    if (outOfStock) {
        return (
            <a
                href="https://www.instagram.com/hyenafuel/"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.pedidoBtn}
            >
                Sin stock — Consultá a pedido por Instagram →
            </a>
        );
    }

    return (
        <button
            className={styles.addToCart}
            onClick={() => { addItem(product, flavor); openCart(); }}
            disabled={disabled}
            aria-describedby={ariaDescribedBy}
        >
            <FaCartPlus /> Agregar al carrito
        </button>
    );
}
