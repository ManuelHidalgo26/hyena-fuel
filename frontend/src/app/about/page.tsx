import styles from "./About.module.css";

export const metadata = {
    title: "Sobre HYENA FUEL",
};

export default function AboutPage() {
    return (
    <section className={styles.about}>
        <div className={styles.container}>
        <h1 className={styles.title}>HYENA FUEL</h1>
        <p className={styles.subtitle}>
            Rendimiento real. Disciplina. Comunidad.
        </p>

        <div className={styles.block}>
            <h3>Nuestra misión</h3>
            <p>
            En HYENA FUEL buscamos potenciar entrenamientos reales con
            suplementación seleccionada y una mentalidad enfocada en resultados.
            </p>
        </div>

        <div className={styles.values}>
            <div className={styles.valueCard}>
            <h4>Disciplina</h4>
            <p>No hay atajos. Hay constancia.</p>
            </div>

            <div className={styles.valueCard}>
            <h4>Rendimiento</h4>
            <p>Productos pensados para entrenar en serio.</p>
            </div>

            <div className={styles.valueCard}>
            <h4>Comunidad</h4>
            <p>HYENA no es solo una tienda, es un equipo.</p>
            </div>
        </div>
        </div>
    </section>
    );
}
