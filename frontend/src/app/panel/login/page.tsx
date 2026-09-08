import Image from "next/image";
import LoginForm from "./LoginForm";
import styles from "./login.module.css";

const FORBIDDEN_MESSAGE = "Tu cuenta no tiene acceso a este panel.";

export const metadata = {
  title: "Acceso privado | HYENA FUEL",
  robots: { index: false, follow: false },
};

type LoginPageProps = {
  searchParams: Promise<{ error?: string }>;
};

/**
 * Login oculto del panel privado (ADR 0003). No está enlazado desde ningún
 * lado de la tienda; solo se llega escribiendo la URL directamente.
 */
export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error } = await searchParams;

  return (
    <main className={styles.wrapper}>
      <div className={styles.card}>
        <Image
          src="/images/hyena-fuel-logo.png"
          alt="HYENA FUEL"
          width={200}
          height={90}
          className={styles.logo}
          priority
        />
        <h1 className={styles.title}>Acceso privado</h1>

        {error === "forbidden" && <p className={styles.forbidden}>{FORBIDDEN_MESSAGE}</p>}

        <LoginForm />
      </div>
    </main>
  );
}
