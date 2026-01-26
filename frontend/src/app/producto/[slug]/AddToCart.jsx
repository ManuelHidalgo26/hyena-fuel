"use client";

import { useCart } from "../../../context/CartContext";
import styles from "./ProductDetail.module.css";

export default function AddToCart({ product }) {
    const { addItem, openCart } = useCart();

    const handleAdd = () => {
    addItem(product);
    openCart(); // feedback inmediato
    };

    return (
    <button className={styles.addToCart} onClick={handleAdd}>
        Agregar al carrito
    </button>
    );
}
