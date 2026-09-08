import type { ReactNode } from "react";
import styles from "./admin.module.css";

export type AdminFieldProps = {
  /** Debe matchear el `id` del control que pasás en `children`. */
  htmlFor: string;
  label: string;
  required?: boolean;
  /** Texto de ayuda, se oculta si hay `error`. */
  hint?: string;
  error?: string;
  /** Ocupa las columnas del `formGrid` completas (para textarea/descripción/imágenes). */
  wide?: boolean;
  /** El control real: `<input id="..." className={styles.input} />`, etc. */
  children: ReactNode;
};

/**
 * Wrapper de label + control + error/hint para formularios del panel
 * (crear/editar producto, etc.). No renderiza el `<input>` por vos —
 * pasalo como children con el `id` que coincida con `htmlFor` y aplicá
 * `styles.input` / `styles.textarea` / `styles.select` de `admin.module.css`.
 *
 * Contrato de accesibilidad que dev tiene que cablear en el control:
 * - `id={htmlFor}`
 * - si hay error: `aria-invalid` y `aria-describedby={`${htmlFor}-error`}`
 *   (el `<p>` de error de este componente ya tiene ese id).
 *
 * Ejemplo:
 * ```tsx
 * <AdminField htmlFor="name" label="Nombre" required error={errors.name}>
 *   <input
 *     id="name"
 *     className={styles.input}
 *     aria-invalid={Boolean(errors.name)}
 *     aria-describedby={errors.name ? "name-error" : undefined}
 *     value={name}
 *     onChange={(e) => setName(e.target.value)}
 *   />
 * </AdminField>
 * ```
 */
export default function AdminField({ htmlFor, label, required, hint, error, wide, children }: AdminFieldProps) {
  const fieldClasses = [styles.field, wide ? styles.fieldWide : ""].filter(Boolean).join(" ");

  return (
    <div className={fieldClasses}>
      <label className={styles.label} htmlFor={htmlFor}>
        {label}
        {required && (
          <span className={styles.requiredMark} aria-hidden="true">
            *
          </span>
        )}
      </label>

      {children}

      {error ? (
        <p className={styles.fieldError} id={`${htmlFor}-error`} role="alert">
          {error}
        </p>
      ) : (
        hint && <p className={styles.hint}>{hint}</p>
      )}
    </div>
  );
}
