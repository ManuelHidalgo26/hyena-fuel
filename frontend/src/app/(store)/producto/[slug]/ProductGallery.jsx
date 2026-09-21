"use client";

import { useId } from "react";
import Image from "next/image";
import styles from "./ProductDetail.module.css";

/**
 * Galería de fotos de la PDP (C1, design-pdp-gallery.md). Client Component
 * 100% controlado/presentacional: NO tiene estado propio de "cuál imagen está
 * activa" (el único `useState`-like acá es `useId`, para el `name` del radio
 * group de miniaturas). El dueño de `selectedImage` es `ProductPurchasePanel`
 * (ADR 0008 Decisión 5, `displayedImage = variantImageOverride ??
 * gallerySelectedImage`) — esta galería solo pinta lo que recibe y avisa
 * `onSelect` al navegar, nunca sabe qué es un "sabor".
 *
 * Caso `selectedImage` fuera de `images[]` (override de sabor activo, §9 del
 * doc de ux): la imagen grande igual se muestra, ninguna miniatura queda
 * activa y las flechas arrancan desde un índice determinista (-1). Esperado,
 * no un bug.
 */
export default function ProductGallery({ images, selectedImage, productName, onSelect }) {
  const groupName = useId();
  const hasControls = images.length > 1;
  const currentIndex = images.indexOf(selectedImage);

  const goPrev = () => {
    const prevIndex = currentIndex <= 0 ? images.length - 1 : currentIndex - 1;
    onSelect(images[prevIndex]);
  };

  const goNext = () => {
    const nextIndex = currentIndex === -1 || currentIndex === images.length - 1 ? 0 : currentIndex + 1;
    onSelect(images[nextIndex]);
  };

  return (
    <div className={styles.gallery} role="group" aria-label={`Galería de ${productName}`}>
      <div className={styles.galleryMain}>
        {hasControls && (
          <button
            type="button"
            className={`${styles.galleryArrow} ${styles.galleryArrowPrev}`}
            aria-label="Foto anterior"
            onClick={goPrev}
          >
            ‹
          </button>
        )}

        <div className={styles.galleryFrame}>
          {selectedImage ? (
            <Image
              src={selectedImage}
              alt={productName}
              fill
              sizes="(min-width: 901px) 500px, 90vw"
              className={styles.galleryImage}
              priority
            />
          ) : (
            <div className={styles.galleryPlaceholder} />
          )}
        </div>

        {hasControls && (
          <button
            type="button"
            className={`${styles.galleryArrow} ${styles.galleryArrowNext}`}
            aria-label="Foto siguiente"
            onClick={goNext}
          >
            ›
          </button>
        )}
      </div>

      {hasControls && (
        <div className={styles.galleryThumbs}>
          {images.map((image, index) => {
            const isSelected = image === selectedImage;
            const thumbClassName = isSelected
              ? `${styles.galleryThumb} ${styles.galleryThumbActive}`
              : styles.galleryThumb;

            return (
              <label key={image} className={thumbClassName}>
                <input
                  type="radio"
                  name={groupName}
                  className={styles.galleryThumbInput}
                  checked={isSelected}
                  onChange={() => onSelect(image)}
                  aria-label={`Ver foto ${index + 1} de ${images.length}`}
                />
                <Image
                  src={image}
                  alt=""
                  width={56}
                  height={56}
                  className={styles.galleryThumbImage}
                />
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
