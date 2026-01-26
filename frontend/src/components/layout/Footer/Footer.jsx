import styles from "./Footer.module.css";
import Image from "next/image";
import Link from "next/link";
import logo from "../../../../public/images/hyena-fuel-logo.png";

export default function Footer() {
    return (
    <footer className={styles.footer}>
        <div className={styles.container}>

        {/* Izquierda → Logo + nombre */}
        <div className={styles.brand}>
            <Image src={logo} alt="HYENA Fuel" width={100} height={45} />
        </div>

        {/* Centro → Links */}
        <nav className={styles.links}>
            <Link href="/">Inicio</Link>
            <Link href="/about">Nosotros</Link>
            <Link href="/#products">Productos</Link>
            
        </nav>

        {/* Derecha → Derechos */}
        <div className={styles.copy}>
            © {new Date().getFullYear()} HYENA —  All rights reserved.
        </div>

        </div>
    </footer>
    );
}
