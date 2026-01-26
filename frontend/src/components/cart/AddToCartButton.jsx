"use client";

import { useCart } from "../../context/CartContext";
import styles from "./AddToCartButton.module.css";

export default function AddToCartButton({ product }) {
    const { addItem } = useCart();

    return (
    <button
        className={styles.button}
        onClick={() => addItem(product)}
    >
        Agregar al carrito
    </button>
    );
}

