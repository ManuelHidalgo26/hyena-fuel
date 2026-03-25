"use client";

import { FaCartPlus } from "react-icons/fa";
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
        <FaCartPlus /> Agregar al carrito
    </button>
    );
}
