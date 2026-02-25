"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import styles from "./Products.module.css";
import AddToCartButton from "../../components/cart/AddToCartButton";

export default function ProductsClient({ products }) {
    const [search, setSearch] = useState("");
    const [sortOrder, setSortOrder] = useState("default");

    const filtered = useMemo(() => {
    let result = [...products];

    // BÚSQUEDA
    if (search.trim() !== "") {
        result = result.filter((p) =>
        p.name.toLowerCase().includes(search.toLowerCase())
        );
    }

    // ORDENAMIENTO
    if (sortOrder === "asc") {
        result.sort((a, b) => a.price - b.price);
    } else if (sortOrder === "desc") {
        result.sort((a, b) => b.price - a.price);
    }

    return result;
    }, [products, search, sortOrder]);

    return (
    <>
        {/* BARRA DE BÚSQUEDA Y FILTROS */}
        <div className={styles.toolbar}>
        <input
            type="text"
            placeholder="Buscar productos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={styles.searchInput}
        />

        <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className={styles.sortSelect}
        >
            <option value="default">Ordenar por precio</option>
            <option value="asc">Menor a mayor</option>
            <option value="desc">Mayor a menor</option>
        </select>
        </div>

      {/* SIN RESULTADOS */}
        {filtered.length === 0 && (
        <p className={styles.noResults}>
            No encontramos productos para "{search}"
        </p>
        )}

        {/* GRILLA */}
        <div className={styles.grid}>
        {filtered.map((product) => {
            const hasTransferPrice =
            typeof product.transferPrice === "number" &&
            product.transferPrice < product.price;

            const saving = hasTransferPrice
            ? product.price - product.transferPrice
            : 0;

            return (
            <div key={product._id} className={styles.card}>
                <Link
                href={`/producto/${product.slug}`}
                className={styles.cardLink}
                >
                <div className={styles.imageWrapper}>
                    {product.images?.[0] && (
                    <Image
                        src={product.images[0]}
                        alt={product.name}
                        width={260}
                        height={260}
                        className={styles.image}
                    />
                    )}
                </div>
                </Link>

                <h3 className={styles.name}>{product.name}</h3>

                <div className={styles.prices}>
                {hasTransferPrice && (
                    <>
                    <div className={styles.transferPrice}>
                        ${product.transferPrice.toLocaleString("es-AR")}
                    </div>
                    <div className={styles.saving}>
                        Ahorrás ${saving.toLocaleString("es-AR")} pagando por transferencia
                    </div>
                    <div className={styles.listPrice}>
                        ${product.price.toLocaleString("es-AR")}
                    </div>
                    </>
                )}

                {!hasTransferPrice && (
                    <div className={styles.transferPrice}>
                    ${product.price.toLocaleString("es-AR")}
                    </div>
                )}
                </div>

                <div className={styles.cta}>
                <AddToCartButton product={product} />
                <Link
                    href={`/producto/${product.slug}`}
                    className={styles.detailLink}
                >
                    Ver detalle
                </Link>
                </div>
            </div>
            );
        })}
        </div>
    </>
    );
}