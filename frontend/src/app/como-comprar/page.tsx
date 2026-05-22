import Image from "next/image";
import Link from "next/link";
import styles from "./ComoComprar.module.css";

export const metadata = {
  title: "Cómo comprar — HYENA FUEL",
  description:
    "Guía paso a paso para realizar tu primer pedido en HYENA FUEL. Elige tu producto, completá tus datos y pagá como quieras.",
};

const steps = [
  {
    number: 1,
    title: "Explorá nuestros productos",
    desc: (
      <>
        Usá el buscador o filtrá por precio para encontrar lo que necesitás.
        Cada producto muestra el stock disponible para que sepas si hay unidades.
      </>
    ),
    img: "/images/como-comprar/paso1-productos.png",
    alt: "Grilla de productos HYENA FUEL",
  },
  {
    number: 2,
    title: "Elegí tu producto",
    desc: (
      <>
        Hacé click en cualquier producto para ver la descripción completa, precio
        y beneficios. Cuando estés listo, hacé click en{" "}
        <strong>Agregar al carrito</strong>.
      </>
    ),
    img: "/images/como-comprar/paso2-detalle.png",
    alt: "Página de detalle de producto",
  },
  {
    number: 3,
    title: "Revisá tu carrito",
    desc: (
      <>
        El ícono del carrito en el nav muestra cuántos productos tenés. Hacé
        click para abrirlo, ajustá cantidades y revisá el resumen antes de
        continuar.
      </>
    ),
    img: "/images/como-comprar/paso3-carrito.png",
    alt: "Carrito de compras abierto",
  },
  {
    number: 4,
    title: "Completá tus datos",
    desc: (
      <>
        Ingresá tu nombre, email y teléfono. Luego elegí cómo querés recibir tu
        pedido:
        <ul>
          <li>🚚 <strong>Envío a domicilio</strong> — ingresá tu dirección</li>
          <li>
            🏪 <strong>Retiro en persona</strong> — gratis en{" "}
            <strong>Junín 5393, Córdoba</strong> (L–V 8–12 hs / 16–20 hs)
          </li>
        </ul>
      </>
    ),
    img: "/images/como-comprar/paso4-entrega.png",
    alt: "Selección de método de entrega",
  },
  {
    number: 5,
    title: "Elegí cómo pagar",
    desc: (
      <>
        Tenés dos opciones:
        <ul>
          <li>
            💳 <strong>MercadoPago</strong> — débito o crédito, te redirigimos a
            la plataforma segura
          </li>
          <li>
            🏦 <strong>Transferencia bancaria</strong> — al alias{" "}
            <strong>hyena.fuel</strong> y obtenés{" "}
            <strong>10% de descuento</strong> automático
          </li>
        </ul>
      </>
    ),
    img: "/images/como-comprar/paso5-pago.png",
    alt: "Selección de método de pago",
  },
  {
    number: 6,
    title: "¡Listo! Tu pedido está registrado",
    desc: (
      <>
        Una vez confirmado el pedido:
        <ul>
          <li>
            Si pagás por <strong>transferencia</strong>, envianos el comprobante
            por WhatsApp o Instagram al alias <strong>hyena.fuel</strong>
          </li>
          <li>
            Si pagás por <strong>MercadoPago</strong>, completás el pago en la
            plataforma y coordinamos el envío
          </li>
        </ul>
        Coordinamos la entrega o el retiro en el horario que mejor te quede.
      </>
    ),
    img: "/images/como-comprar/paso6-confirmacion.png",
    alt: "Confirmación de pedido",
  },
];

export default function ComoComprarPage() {
  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <h1 className={styles.title}>
          Cómo <span>comprar</span>
        </h1>
        <p className={styles.subtitle}>
          Seguí estos 6 pasos y tu pedido estará listo en minutos.
        </p>

        <div className={styles.steps}>
          {steps.map((step, i) => (
            <div
              key={step.number}
              className={`${styles.step}${i % 2 !== 0 ? ` ${styles.reverse}` : ""}`}
            >
              <div className={styles.stepContent}>
                <span className={styles.stepNumber}>{step.number}</span>
                <h2 className={styles.stepTitle}>{step.title}</h2>
                <p className={styles.stepDesc}>{step.desc}</p>
              </div>
              <Image
                src={step.img}
                alt={step.alt}
                width={480}
                height={300}
                className={styles.screenshot}
              />
            </div>
          ))}
        </div>

        <div className={styles.cta}>
          <h2 className={styles.ctaTitle}>¿Todo claro? ¡Empezá a comprar!</h2>
          <p className={styles.ctaText}>
            Explorá nuestro catálogo y encontrá la suplementación que necesitás.
          </p>
          <Link href="/#products" className={styles.ctaBtn}>
            Ver productos
          </Link>
        </div>
      </div>
    </main>
  );
}
