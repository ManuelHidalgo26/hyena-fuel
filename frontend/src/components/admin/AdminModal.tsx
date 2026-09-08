"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import AdminButton from "./AdminButton";
import styles from "./admin.module.css";

export type AdminModalTone = "default" | "danger";

export type AdminModalProps = {
  open: boolean;
  title: string;
  description?: ReactNode;
  /** @default "Confirmar" */
  confirmLabel?: string;
  /** @default "Cancelar" */
  cancelLabel?: string;
  /**
   * `danger` pinta "Confirmar" en rojo (desactivar producto, eliminar
   * reseña, cancelar pedido, limpiar finalizados). @default "default"
   */
  tone?: AdminModalTone;
  /** Deshabilita ambos botones y muestra spinner en "Confirmar" mientras la mutación está en vuelo. */
  confirmLoading?: boolean;
  onConfirm: () => void;
  /** Se dispara al cancelar, tocar Escape o clickear fuera del panel. */
  onClose: () => void;
};

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Modal de confirmación para toda acción destructiva del panel (desactivar
 * producto, eliminar reseña, cancelar pedido, "limpiar finalizados").
 * Controlado por `open`; no maneja su propio estado de apertura — eso es
 * de quien lo usa (ej. un `useState` en `PedidosClient.tsx`).
 *
 * Accesibilidad ya resuelta acá (nada queda pendiente para dev):
 * - `role="dialog"` + `aria-modal="true"` + `aria-labelledby`/`aria-describedby`.
 * - Foco atrapado dentro del modal (Tab / Shift+Tab cicla).
 * - Foco inicial en "Cancelar" (default seguro para una acción destructiva).
 * - Devuelve el foco a quien abrió el modal al cerrarse.
 * - Escape cierra. Click fuera del panel (overlay) cierra.
 * - Bloquea el scroll del body mientras está abierto.
 */
export default function AdminModal({
  open,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  tone = "default",
  confirmLoading = false,
  onConfirm,
  onClose,
}: AdminModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      const panel = panelRef.current;
      if (event.key !== "Tab" || !panel) return;

      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className={styles.overlay}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
      >
        <h2 className={styles.modalTitle} id={titleId}>
          {title}
        </h2>
        {description && (
          <p className={styles.modalDescription} id={descriptionId}>
            {description}
          </p>
        )}

        <div className={styles.modalActions}>
          <AdminButton ref={cancelRef} variant="secondary" onClick={onClose} disabled={confirmLoading}>
            {cancelLabel}
          </AdminButton>
          <AdminButton variant={tone === "danger" ? "danger" : "primary"} onClick={onConfirm} loading={confirmLoading}>
            {confirmLabel}
          </AdminButton>
        </div>
      </div>
    </div>
  );
}
