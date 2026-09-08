import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import styles from "./admin.module.css";

export type AdminButtonVariant = "primary" | "secondary" | "danger" | "ghost";
export type AdminButtonSize = "md" | "sm";

const VARIANT_CLASS: Record<AdminButtonVariant, string> = {
  primary: styles.buttonPrimary,
  secondary: styles.buttonSecondary,
  danger: styles.buttonDanger,
  ghost: styles.buttonGhost,
};

export type AdminButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** @default "primary" */
  variant?: AdminButtonVariant;
  /** @default "md" */
  size?: AdminButtonSize;
  /**
   * Deshabilita el botón y muestra un spinner inline antes del contenido.
   * No cambia el texto por vos: si querés "Guardando..." pasalo como
   * `children` condicional desde donde manejás el estado de la mutación.
   */
  loading?: boolean;
  children?: ReactNode;
};

/**
 * Botón base del sistema admin. 100% presentacional: sin fetch, sin
 * conocimiento de negocio. `type="button"` por defecto (evitá submits
 * accidentales); pasá `type="submit"` explícito cuando corresponda.
 *
 * Variantes: `primary` (acción principal, naranja), `secondary` (outline,
 * acción secundaria), `danger` (tintado rojo, para acciones destructivas
 * fuera de un modal — ej. disparar la confirmación de "limpiar
 * finalizados"), `ghost` (mínimo, para acciones terciarias / nav).
 *
 * Tamaño `sm` para botones dentro de filas de tabla.
 */
const AdminButton = forwardRef<HTMLButtonElement, AdminButtonProps>(function AdminButton(
  { variant = "primary", size = "md", loading = false, disabled, className, type = "button", children, ...rest },
  ref
) {
  const classes = [styles.button, VARIANT_CLASS[variant], size === "sm" ? styles.buttonSm : "", className]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      ref={ref}
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <span className={styles.buttonSpinner} aria-hidden="true" />}
      {children}
    </button>
  );
});

export default AdminButton;
