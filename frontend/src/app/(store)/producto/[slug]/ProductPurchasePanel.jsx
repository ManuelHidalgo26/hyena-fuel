"use client";

import { useState } from "react";
import Image from "next/image";
import AddToCart from "./AddToCart";
import TrackViewItem from "./TrackViewItem";
import styles from "./ProductDetail.module.css";

/**
 * Deriva qué badge de stock mostrar (ADR 0008, design-sabores-variantes.md §1.4).
 * Producto sin sabores: mismos 3 umbrales de siempre. Con sabores: agrega el
 * prompt neutro "Elegí un sabor" y el edge case de todos los sabores agotados.
 */
function getStockBadge({ hasVariants, selectedFlavor, allVariantsOutOfStock, activeStock }) {
  if (hasVariants && allVariantsOutOfStock) {
    return { tone: "outOfStock", text: "Sin stock por ahora" };
  }
  if (hasVariants && !selectedFlavor) {
    return { tone: "stockPrompt", text: "Elegí un sabor" };
  }
  if (activeStock === 0) {
    return { tone: "outOfStock", text: "✕ Sin stock" };
  }
  if (activeStock > 0 && activeStock <= 5) {
    return { tone: "lowStock", text: `🔥 ¡Últimas ${activeStock} unidades!` };
  }
  if (activeStock > 5 && activeStock <= 10) {
    return { tone: "mediumStock", text: "⚠️ Pocas unidades disponibles" };
  }
  return null;
}

function FlavorSelector({ variants, selectedFlavor, onSelect }) {
  return (
    <fieldset className={styles.flavorFieldset}>
      <legend className={styles.flavorLegend}>Elegí tu sabor</legend>
      <div className={styles.flavorList}>
        {variants.map((variant) => {
          const isVariantOutOfStock = variant.stock === 0;
          const isSelected = selectedFlavor?.name === variant.name;
          const chipClassName = isVariantOutOfStock
            ? `${styles.flavorChip} ${styles.flavorChipDisabled}`
            : isSelected
              ? `${styles.flavorChip} ${styles.flavorChipSelected}`
              : styles.flavorChip;

          return (
            <label key={variant.name} className={chipClassName}>
              <input
                type="radio"
                name="flavor"
                className={styles.flavorChipInput}
                value={variant.name}
                checked={isSelected}
                disabled={isVariantOutOfStock}
                onChange={() => onSelect(variant)}
              />
              {variant.name}
              {isVariantOutOfStock && <span className={styles.flavorChipTag}>Agotado</span>}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

const FLAVOR_HINT_ID = "flavor-required-hint";

/**
 * Client Component que envuelve imagen + nombre + stock + selector de sabor + CTA
 * de la PDP (ADR 0008 Decisión 4/5). Necesita `useState` para el sabor elegido y
 * el swap de imagen — por eso vive separado del Server Component `page.jsx`
 * (que sigue resolviendo `generateMetadata` y renderizando la descripción vía
 * `ReactMarkdown` server-side, pasada acá como `children`).
 *
 * Contrato de imagen (Decisión 5 del ADR): `displayedImage = variantImageOverride
 * ?? gallerySelectedImage`. Hoy no existe una galería (`ProductGallery`/C1 no está
 * construida), así que `gallerySelectedImage` es simplemente `images[0]` — la
 * fórmula queda lista para cuando la galería exista, sin tener que tocar este
 * componente de nuevo.
 */
export default function ProductPurchasePanel({ product, children }) {
  const hasVariants = product.variants.length > 0;
  const [selectedFlavor, setSelectedFlavor] = useState(null);
  const [variantImageOverride, setVariantImageOverride] = useState(null);

  const gallerySelectedImage = product.images?.[0] ?? null;
  const displayedImage = variantImageOverride ?? gallerySelectedImage;

  const handleSelectFlavor = (variant) => {
    setSelectedFlavor(variant);
    setVariantImageOverride(variant.image ?? product.images?.[0] ?? null);
  };

  const allVariantsOutOfStock = hasVariants && product.variants.every((variant) => variant.stock === 0);
  const activeStock = hasVariants ? (selectedFlavor ? selectedFlavor.stock : null) : product.stock;
  const badge = getStockBadge({ hasVariants, selectedFlavor, allVariantsOutOfStock, activeStock });

  const outOfStock = hasVariants ? allVariantsOutOfStock : product.stock === 0;
  const ctaDisabled = hasVariants
    ? selectedFlavor === null || selectedFlavor.stock === 0
    : product.stock === 0;
  // El hint solo tiene sentido cuando falta elegir un sabor CON stock disponible;
  // si todos están agotados, el CTA ya cae al link "a pedido" (outOfStock) y
  // pedir que "elija" sería contradictorio con ese mensaje.
  const showFlavorHint = hasVariants && selectedFlavor === null && !allVariantsOutOfStock;

  return (
    <>
      <div className={styles.imageWrapper}>
        {displayedImage && (
          <Image src={displayedImage} alt={product.name} width={400} height={400} priority />
        )}
      </div>

      <div className={styles.info}>
        <TrackViewItem product={product} />
        <h1>{product.name}</h1>

        {badge && (
          <div className={`${styles.stockBadge} ${styles[badge.tone]}`}>{badge.text}</div>
        )}

        <div className={styles.prices}>
          {typeof product.transferPrice === "number" && product.transferPrice < product.price ? (
            <>
              <div className={styles.transferPrice}>
                ${product.transferPrice.toLocaleString("es-AR")}
              </div>

              <div className={styles.saving}>
                Ahorrás ${(product.price - product.transferPrice).toLocaleString("es-AR")} pagando
                por transferencia
              </div>

              <div className={styles.listPrice}>
                ${product.price.toLocaleString("es-AR")}
              </div>
            </>
          ) : (
            <div className={styles.transferPrice}>
              ${product.price.toLocaleString("es-AR")}
            </div>
          )}
        </div>

        {hasVariants && (
          <FlavorSelector
            variants={product.variants}
            selectedFlavor={selectedFlavor}
            onSelect={handleSelectFlavor}
          />
        )}

        <div className={styles.ctaGroup}>
          <AddToCart
            product={product}
            flavor={selectedFlavor?.name ?? null}
            disabled={ctaDisabled}
            outOfStock={outOfStock}
            ariaDescribedBy={showFlavorHint ? FLAVOR_HINT_ID : undefined}
          />

          {showFlavorHint && (
            <p id={FLAVOR_HINT_ID} className={styles.flavorRequiredHint}>
              Elegí un sabor con stock para poder comprar.
            </p>
          )}

          <a
            className={styles.instagram}
            href="https://www.instagram.com/hyenafuel"
            target="_blank"
            rel="noopener noreferrer"
          >
            Seguinos en Instagram
          </a>
        </div>

        {children}
      </div>
    </>
  );
}
