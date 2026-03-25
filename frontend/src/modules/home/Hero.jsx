"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import styles from "./Hero.module.css";

const slides = [
  { src: "/images/Foto1.jpeg", alt: "Hyena Fuel - Entrená con los mejores" },
  { src: "/images/Foto2.jpeg", alt: "Hyena Fuel - Combustible para tu entrenamiento" },
  { src: "/images/Foto3.jpeg", alt: "Hyena Fuel - Suplementos de calidad" },
];

export default function Hero() {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className={styles.hero}>
      <div className={styles.container}>

        <div className={styles.text}>
          <h1 className={styles.title}>
            HYENA FUEL <span>Combustible para tu entrenamiento.</span>
          </h1>
          <p className={styles.subtitle}>
            Suplementos diseñados para atletas que no negocian con la mediocridad.
          </p>
          <Link href="/#products" className={styles.cta}>
            Ver productos
          </Link>
        </div>

        <div className={styles.carouselWrapper}>
          {slides.map((slide, index) => (
            <div
              key={index}
              className={`${styles.slide} ${index === current ? styles.active : ""}`}
            >
              <Image
                src={slide.src}
                alt={slide.alt}
                fill
                className={styles.image}
                priority={index === 0}
              />
            </div>
          ))}

          <div className={styles.dots}>
            {slides.map((_, index) => (
              <button
                key={index}
                className={`${styles.dot} ${index === current ? styles.activeDot : ""}`}
                onClick={() => setCurrent(index)}
              />
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}