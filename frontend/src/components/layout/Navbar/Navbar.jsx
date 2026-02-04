"use client";

import styles from "./Navbar.module.css";
import Image from "next/image";
import Link from "next/link";
import logo from "../../../../public/images/hyena-fuel-logo.png";
import { useState, useEffect } from "react";
import { useCart } from "../../../context/CartContext";

export default function Navbar() {
  const { openCart, getTotalItems } = useCart();
  const [open, setOpen] = useState(false);

  // 🔧 FIX hydration
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <header className={styles.navbar}>
      <div className={styles.container}>
        {/* Logo */}
        <Link href="/" className={styles.logo}>
          <Image
            src={logo}
            alt="HYENA FUEL"
            width={160}
            height={40}
            priority
          />
        </Link>

        {/* Links desktop */}
        <nav className={styles.links}>
          <Link href="/">Inicio</Link>
          <Link href="/about">Nosotros</Link>
          <Link href="/#products">Productos</Link>
          
        </nav>

        {/* Carrito */}
        <button
          className={styles.cartButton}
          onClick={openCart}
          aria-label="Abrir carrito"
          data-count={getTotalItems() > 0 ? getTotalItems() : ""}
        >
        🛒
        </button>

        {/* Burger mobile */}
        <button
          className={styles.burger}
          onClick={() => setOpen(!open)}
          aria-label="Abrir menú"
        >
          ☰
        </button>
      </div>

      {/* Menú mobile */}
      {open && (
        <nav className={styles.mobileMenu}>
          <Link href="/" onClick={() => setOpen(false)}>Inicio</Link>
          <Link href="/about" onClick={() => setOpen(false)}>Nosotros</Link>
          <Link href="/#products">Productos</Link>
          
        </nav>
      )}
    </header>
  );
}
