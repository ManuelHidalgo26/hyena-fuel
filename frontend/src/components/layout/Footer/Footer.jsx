import styles from "./Footer.module.css";
import Image from "next/image";
import Link from "next/link";
import logo from "../../../../public/images/hyena-fuel-logo.png";
import { FaInstagram, FaWhatsapp } from "react-icons/fa";
export default function Footer() {
    return (
    <footer className={styles.footer}>
        <div className={styles.container}>

        {/* Logo + tagline */}
        <div className={styles.brand}>
            <Image src={logo} alt="HYENA Fuel" width={100} height={45} />
            <p className={styles.tagline}>Combustible para tu entrenamiento.</p>
        </div>

        {/* Links */}
        <nav className={styles.links}>
            <span className={styles.colTitle}>Navegación</span>
            <Link href="/">Inicio</Link>
            <Link href="/about">Nosotros</Link>
            <Link href="/#products">Productos</Link>
        </nav>

        {/* Info */}
        <div className={styles.info}>
            <span className={styles.colTitle}>Información</span>

            <div className={styles.shipping}>
            <span className={styles.shippingIcon}>🚚</span>
            <span>Envío gratis a Córdoba Capital en compras de +$120.000</span>
            </div>

            <div className={styles.payment}>
            <span className={styles.colTitle}>Medios de pago</span>
            <div className={styles.paymentBadges}>
                <span className={styles.badge}>💵 Efectivo</span>
                <span className={styles.badge}>🏦 Transferencia</span>
                <span className={styles.badge}>💳 Débito</span>
                <span className={styles.badge}>💳 Crédito</span>
            </div>
            <p className={styles.paymentNote}>
                Pagando con transferencia o efectivo obtenés un descuento especial.
            </p>
            </div>
        </div>

        {/* Redes */}
        <div className={styles.social}>
            <span className={styles.colTitle}>Seguinos</span>
            <a href="https://www.instagram.com/hyenafuel/" target="_blank" rel="noopener noreferrer" className={styles.instaLink}>
                <FaInstagram />@hyenafuel
            </a>
            <a href="https://wa.me/549XXXXXXXXXX" target="_blank" rel="noopener noreferrer" className={styles.whatsappLink}>
                <FaWhatsapp />WhatsApp
            </a>
        </div>

        </div>

        {/* Bottom bar */}
        <div className={styles.bottomBar}>
        © {new Date().getFullYear()} HYENA — All rights reserved.
        </div>
    </footer>
    );
}