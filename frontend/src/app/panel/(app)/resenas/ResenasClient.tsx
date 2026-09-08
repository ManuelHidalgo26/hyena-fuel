"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AdminPageHeader, AdminButton, AdminModal, AdminEmptyState } from "../../../../components/admin";
import styles from "../../../../components/admin/admin.module.css";
import type { Review } from "../../../../lib/reviews";
import { readErrorMessage } from "../../../../lib/admin/http";

type ResenasClientProps = {
  initialReviews: Review[];
};

/**
 * Mutaciones de Reseñas (spec Admin UI §1.1/§4): aprobar (no destructivo) y
 * eliminar (destructivo, con confirmación). Patrón de tarjeta, no tabla
 * (design-panel-admin.md §8: el texto de la reseña no entra en una celda).
 */
export default function ResenasClient({ initialReviews }: ResenasClientProps) {
  const router = useRouter();
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Review | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  async function handleApprove(review: Review) {
    setApprovingId(review._id);
    setMutationError(null);
    try {
      const response = await fetch(`/api/reviews/${review._id}/approve`, { method: "PATCH" });
      if (!response.ok) {
        setMutationError(await readErrorMessage(response, "No se pudo aprobar la reseña"));
        return;
      }
      router.refresh();
    } finally {
      setApprovingId(null);
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    setMutationError(null);
    try {
      const response = await fetch(`/api/reviews/${deleteTarget._id}`, { method: "DELETE" });
      if (!response.ok) {
        setMutationError(await readErrorMessage(response, "No se pudo eliminar la reseña"));
        return;
      }
      setDeleteTarget(null);
      router.refresh();
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <>
      <AdminPageHeader title="Reseñas" description="Reseñas pendientes de moderación." />

      {mutationError && (
        <p className={`${styles.banner} ${styles.bannerError}`} role="alert">
          {mutationError}
        </p>
      )}

      {initialReviews.length === 0 ? (
        <AdminEmptyState
          title="No hay reseñas pendientes"
          description="Las reseñas nuevas van a aparecer acá para aprobarlas o eliminarlas."
        />
      ) : (
        <div className={styles.cardList}>
          {initialReviews.map((review) => (
            <article className={styles.card} key={review._id}>
              <div className={styles.cardHeader}>
                <span className={styles.cardTitle}>{review.name}</span>
                <span className={styles.cardMeta} aria-label={`${review.rating} de 5 estrellas`}>
                  {"★".repeat(review.rating)}
                  {"☆".repeat(5 - review.rating)}
                </span>
              </div>
              <p className={styles.cardBody}>{review.text}</p>
              <div className={styles.cardActions}>
                <AdminButton size="sm" loading={approvingId === review._id} onClick={() => handleApprove(review)}>
                  Aprobar
                </AdminButton>
                <AdminButton size="sm" variant="danger" onClick={() => setDeleteTarget(review)}>
                  Eliminar
                </AdminButton>
              </div>
            </article>
          ))}
        </div>
      )}

      <AdminModal
        open={deleteTarget !== null}
        title="¿Eliminar esta reseña?"
        description={deleteTarget ? `Se borra la reseña de ${deleteTarget.name}. Esta acción no se puede deshacer.` : undefined}
        tone="danger"
        confirmLabel="Eliminar"
        confirmLoading={deleteLoading}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
      />
    </>
  );
}
