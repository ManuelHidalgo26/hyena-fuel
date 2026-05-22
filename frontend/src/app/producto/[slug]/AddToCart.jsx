"use client";

import { FaCartPlus } from "react-icons/fa";
import { useCart } from "../../../context/CartContext";
import styles from "./ProductDetail.module.css";

export default function AddToCart({ product, disabled = false }) {
    const { addItem, openCart } = useCart();

    const handleAdd = () => {
    if (disabled) return;
    addItem(product);
    openCart();
    };

    return (
    <button
        className={styles.addToCart}
        onClick={handleAdd}
        disabled={disabled}
        style={disabled ? { opacity: 0.5, cursor: "not-allowed", animation: "none" } : undefined}
    >
        <FaCartPlus /> {disabled ? "Sin stock" : "Agregar al carrito"}
    </button>
    );
}
