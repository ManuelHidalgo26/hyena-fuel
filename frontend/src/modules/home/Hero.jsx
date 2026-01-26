import Image from "next/image";
import styles from "./Hero.module.css";
import placeholder from "@/public/images/proximamente.png";

export default function Hero() {
    return (
        <section className={styles.hero}>
            <div className={styles.container}>

                <div className={styles.text}>
                    <h1 className={styles.title}>
                        HYENA FUEL Combustible para tu entrenamiento.
                    </h1>

                    <p className={styles.subtitle}>
                        Suplementos diseñados para atletas que no negocian con la mediocridad.
                    </p>

                    <button className={styles.cta}>Ver productos</button>
                </div>

                <div className={styles.imageWrapper}>
                    <Image
                        src={placeholder}
                        alt="Hyena Fuel Hero"
                        className={styles.image}
                        priority
                    />
                </div>
            </div>
        </section>
    );
}
