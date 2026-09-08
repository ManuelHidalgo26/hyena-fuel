"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";
import styles from "./login.module.css";

const INVALID_CREDENTIALS_MESSAGE = "Email o contraseña incorrectos";
const GENERIC_ERROR_MESSAGE = "No se pudo iniciar sesión. Probá de nuevo en unos minutos.";

/** Supabase devuelve siempre el mismo mensaje para no filtrar cuál dato está mal. */
function mapSignInError(message: string): string {
  return message === "Invalid login credentials" ? INVALID_CREDENTIALS_MESSAGE : GENERIC_ERROR_MESSAGE;
}

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError(null);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError(mapSignInError(signInError.message));
      setSubmitting(false);
      return;
    }

    // El cliente browser (@supabase/ssr) ya dejó la sesión en cookies:
    // el middleware la ve en la próxima navegación.
    router.push("/panel");
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <label className={styles.label} htmlFor="email">
        Email
      </label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="username"
        className={styles.input}
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        required
      />

      <label className={styles.label} htmlFor="password">
        Contraseña
      </label>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
        className={styles.input}
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        required
      />

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <button type="submit" className={styles.submit} disabled={submitting}>
        {submitting ? "Ingresando..." : "Ingresar"}
      </button>
    </form>
  );
}
