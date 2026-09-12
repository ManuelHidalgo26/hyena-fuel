"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import styles from "./Products.module.css";
import AddToCartButton from "../../components/cart/AddToCartButton";

const ALL_CATEGORIES = "Todos";

/** Valores únicos y ordenados de un campo de producto (ignora null/""). */
function getFacetOptions(products, field) {
  const values = new Set();
  for (const product of products) {
    if (product[field]) values.add(product[field]);
  }
  return Array.from(values).sort((a, b) => a.localeCompare(b, "es"));
}

export default function ProductsClient({ products }) {
    const [search, setSearch] = useState("");
    const [sortOrder, setSortOrder] = useState("default");
    const [category, setCategory] = useState(ALL_CATEGORIES);
    const [selectedBrands, setSelectedBrands] = useState([]);

    const categoryOptions = useMemo(
      () => getFacetOptions(products, "category"),
      [products]
    );
    const brandOptions = useMemo(
      () => getFacetOptions(products, "brand"),
      [products]
    );

    const toggleBrand = (brand) => {
      setSelectedBrands((prev) =>
        prev.includes(brand)
          ? prev.filter((b) => b !== brand)
          : [...prev, brand]
      );
    };

    const filtered = useMemo(() => {
    let result = [...products];

    // BÚSQUEDA (nombre + marca)
    if (search.trim() !== "") {
        const query = search.toLowerCase();
        result = result.filter(
          (p) =>
            p.name.toLowerCase().includes(query) ||
            p.brand?.toLowerCase().includes(query)
        );
    }

    // FILTRO DE CATEGORÍA (single-select)
    if (category !== ALL_CATEGORIES) {
        result = result.filter((p) => p.category === category);
    }

    // FILTRO DE MARCA (multi-select)
    if (selectedBrands.length > 0) {
        result = result.filter((p) => p.brand && selectedBrands.includes(p.brand));
    }

    // ORDENAMIENTO
    if (sortOrder === "asc") {
        result.sort((a, b) => a.price - b.price);
    } else if (sortOrder === "desc") {
        result.sort((a, b) => b.price - a.price);
    }

    return result;
    }, [products, search, sortOrder, category, selectedBrands]);

    return (
    <>
      {/* BARRA DE BÚSQUEDA Y ORDEN */}
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
            <option value="default">Novedades</option>
            <option value="asc">Menor a mayor</option>
            <option value="desc">Mayor a menor</option>
        </select>
        </div>

      {/* FILTRO DE CATEGORÍA — oculto si ningún producto tiene categoría cargada */}
        {categoryOptions.length > 0 && (
        <fieldset className={styles.filterGroup}>
            <legend className={styles.filterLabel}>Categoría</legend>
            <div className={styles.chipsRow}>
            <label
                className={`${styles.chip} ${
                category === ALL_CATEGORIES ? styles.chipActive : ""
                }`}
            >
                <input
                type="radio"
                name="category"
                value={ALL_CATEGORIES}
                checked={category === ALL_CATEGORIES}
                onChange={() => setCategory(ALL_CATEGORIES)}
                className={styles.chipInput}
                />
                {ALL_CATEGORIES}
            </label>
            {categoryOptions.map((option) => (
                <label
                key={option}
                className={`${styles.chip} ${
                    category === option ? styles.chipActive : ""
                }`}
                >
                <input
                    type="radio"
                    name="category"
                    value={option}
                    checked={category === option}
                    onChange={() => setCategory(option)}
                    className={styles.chipInput}
                />
                {option}
                </label>
            ))}
            </div>
        </fieldset>
        )}

      {/* FILTRO DE MARCA — oculto si ningún producto tiene marca cargada */}
        {brandOptions.length > 0 && (
        <fieldset className={styles.filterGroup}>
            <legend className={styles.filterLabel}>Marca</legend>
            <div className={styles.chipsRow}>
            {brandOptions.map((brand) => (
                <label
                key={brand}
                className={`${styles.chip} ${
                    selectedBrands.includes(brand) ? styles.chipActive : ""
                }`}
                >
                <input
                    type="checkbox"
                    name="brand"
                    value={brand}
                    checked={selectedBrands.includes(brand)}
                    onChange={() => toggleBrand(brand)}
                    className={styles.chipInput}
                />
                {brand}
                </label>
            ))}
            </div>
        </fieldset>
        )}

      {/* CONTADOR DE RESULTADOS */}
        <p className={styles.resultsCount}>
        {filtered.length} producto{filtered.length === 1 ? "" : "s"}
        </p>

      {/* SIN RESULTADOS */}
        {filtered.length === 0 && (
        <p className={styles.noResults}>
            {search.trim() !== "" ? (
            <>No encontramos productos para &ldquo;{search}&rdquo;.</>
            ) : (
            "No encontramos productos con estos filtros."
            )}
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

                {product.brand && (
                <p className={styles.brandTag}>{product.brand}</p>
                )}

                <h3 className={styles.name}>{product.name}</h3>

                {/* STOCK BADGE */}
                {product.stock > 0 && product.stock <= 5 && (
                  <div className={styles.stockBadgeLow}>
                    🔥 Últimas {product.stock} unidades
                  </div>
                )}
                {product.stock > 5 && product.stock <= 10 && (
                  <div className={styles.stockBadgeMed}>
                    ⚠️ Pocas unidades
                  </div>
                )}
                {product.stock === 0 && (
                  <div className={styles.stockBadgeOut}>Sin stock</div>
                )}

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

        {/* BANNER A PEDIDO */}
        <div className={styles.pedidoBanner}>
          <p className={styles.pedidoTitle}>¿No encontrás lo que necesitás?</p>
          <p className={styles.pedidoText}>
            Trabajamos a pedido — consultanos por Instagram y lo conseguimos para vos.
          </p>
          <a
            href="https://www.instagram.com/hyenafuel/"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.pedidoLink}
          >
            Consultar por Instagram →
          </a>
        </div>
    </>
    );
}
