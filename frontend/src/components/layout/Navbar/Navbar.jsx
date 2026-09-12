"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { FaShoppingCart } from "react-icons/fa";
import logo from "../../../../public/images/hyena-fuel-logo.png";
import { useCart } from "../../../context/CartContext";
import styles from "./Navbar.module.css";

const NAV_LINKS = [
  { href: "/", label: "Inicio" },
  { href: "/#products", label: "Productos" },
  { href: "/como-comprar", label: "Cómo comprar" },
  { href: "/about", label: "Nosotros" },
];

export default function Navbar() {
  const { openCart, getTotalItems } = useCart();
  const [open, setOpen] = useState(false);

  // Evita el mismatch de hidratación: el badge del carrito depende de
  // localStorage, que no existe en el render del servidor.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const burgerRef = useRef(null);
  const closeButtonRef = useRef(null);

  const closeMenu = () => {
    setOpen(false);
    burgerRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return undefined;

    closeButtonRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      burgerRef.current?.focus();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const cartCount = mounted ? getTotalItems() : 0;

  return (
    <header className={styles.navbar}>
      <div className={styles.inner}>
        <Link href="/" className={styles.logo}>
          <Image src={logo} alt="HYENA FUEL" width={140} height={35} priority />
        </Link>

        <nav className={styles.navLinks} aria-label="Navegación principal">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={openCart}
            aria-label={
              cartCount > 0 ? `Abrir carrito, ${cartCount} productos` : "Abrir carrito"
            }
          >
            <FaShoppingCart />
            {cartCount > 0 && (
              <span className={styles.cartCount} aria-hidden="true">
                {cartCount}
              </span>
            )}
          </button>

          <button
            ref={burgerRef}
            type="button"
            className={styles.burger}
            onClick={() => setOpen(true)}
            aria-haspopup="true"
            aria-controls="navPanel"
            aria-expanded={open}
            aria-label="Abrir menú"
          >
            ☰
          </button>
        </div>
      </div>

      <div
        id="navPanel"
        className={`${styles.navPanel} ${open ? styles.navPanelOpen : ""}`}
        onClick={closeMenu}
      >
        <div
          className={styles.navPanelSheet}
          role="dialog"
          aria-modal="true"
          aria-label="Menú de navegación"
          onClick={(event) => event.stopPropagation()}
        >
          <button
            ref={closeButtonRef}
            type="button"
            className={styles.navPanelClose}
            onClick={closeMenu}
            aria-label="Cerrar menú"
          >
            ✕
          </button>
          <nav className={styles.navPanelLinks}>
            {NAV_LINKS.map((link) => (
              <Link key={link.href} href={link.href} onClick={closeMenu}>
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}
