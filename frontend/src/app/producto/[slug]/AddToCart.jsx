"use client";

import { FaCartPlus } from "react-icons/fa";
import { useCart } from "../../../context/CartContext";
import styles from "./ProductDetail.module.css";

export default function AddToCart({ product, disabled = false }) {
    const { addItem, openCart } = useCart();

    if (disabled) {
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
            onClick={() => { addItem(product); openCart(); }}
        >
            <FaCartPlus /> Agregar al carrito
        </button>
    );
}
