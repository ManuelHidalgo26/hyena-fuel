"use client";

import { useEffect } from "react";
import styles from "./Toast.module.css";

export default function Toast({ message, onClose, duration = 1400 }) {
    useEffect(() => {
    const t = setTimeout(onClose, duration);
    return () => clearTimeout(t);
    }, [onClose, duration]);

    return (
    <div className={styles.toast}>
        {message}
    </div>
    );
}
