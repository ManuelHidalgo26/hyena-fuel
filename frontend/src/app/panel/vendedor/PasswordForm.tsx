"use client";

import { useState, type FormEvent } from "react";
import { AdminButton, AdminField } from "../../../components/admin";
import styles from "../../../components/admin/admin.module.css";
import { readErrorMessage } from "../../../lib/admin/http";
import { isValidPasswordLength, PASSWORD_LENGTH_MESSAGE } from "../../../lib/auth/passwordRules";

/** Cambio de contraseña propia del vendedor (contra `POST /api/seller/change-password`). */
export default function PasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSuccess(false);

    if (!isValidPasswordLength(password)) {
      setError(PASSWORD_LENGTH_MESSAGE);
      return;
    }
    if (password !== confirmation) {
      setError("Las contraseñas no coinciden");
      return;
    }

    setError(null);
    setSaving(true);
    try {
      const response = await fetch("/api/seller/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!response.ok) {
        setError(await readErrorMessage(response, "No se pudo cambiar la contraseña. Probá de nuevo."));
        return;
      }
      setPassword("");
      setConfirmation("");
      setSuccess(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className={styles.narrowForm} onSubmit={handleSubmit} noValidate>
      <AdminField htmlFor="new-password" label="Contraseña nueva" hint={PASSWORD_LENGTH_MESSAGE}>
        <input
          id="new-password"
          type="password"
          autoComplete="new-password"
          className={styles.input}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </AdminField>
      <AdminField htmlFor="confirm-password" label="Repetí la contraseña">
        <input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          className={styles.input}
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
        />
      </AdminField>

      {error && (
        <p className={`${styles.banner} ${styles.bannerError}`} role="alert">
          {error}
        </p>
      )}
      {success && (
        <p className={`${styles.banner} ${styles.bannerSuccess}`} role="status">
          Listo, tu contraseña quedó actualizada.
        </p>
      )}

      <div>
        <AdminButton type="submit" loading={saving}>
          Cambiar contraseña
        </AdminButton>
      </div>
    </form>
  );
}
