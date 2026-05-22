"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import styles from "./Lightbox.module.css";

export function LightboxImage({ src, alt, width, height, className }) {
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, close]);

  return (
    <>
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        className={`${className} ${styles.trigger}`}
        onClick={() => setOpen(true)}
        title="Clic para ampliar"
      />
      {open && (
        <div className={styles.overlay} onClick={close}>
          <div className={styles.box} onClick={(e) => e.stopPropagation()}>
            <button className={styles.close} onClick={close} aria-label="Cerrar">✕</button>
            <img src={src} alt={alt} className={styles.fullImg} />
          </div>
        </div>
      )}
    </>
  );
}
