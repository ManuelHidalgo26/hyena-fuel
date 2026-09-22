"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  AdminPageHeader,
  AdminButton,
  AdminTable,
  AdminField,
  AdminModal,
  AdminEmptyState,
  DiscountCodeStatusBadge,
} from "../../../../components/admin";
import styles from "../../../../components/admin/admin.module.css";
import type { DiscountCode, DiscountCodeStatus, DiscountCodeType } from "../../../../lib/discountCodes";
import { readErrorMessage } from "../../../../lib/admin/http";

/** Shape que devuelve `GET/POST/PATCH /api/admin/discount-codes` (código + estado derivado). */
type AdminDiscountCode = DiscountCode & { status: DiscountCodeStatus; remainingUses: number | null };

type CreateCodeFormState = {
  code: string;
  type: DiscountCodeType;
  value: string;
  maxUses: string;
  minPurchase: string;
  startsAt: string;
  expiresAt: string;
};

/** Campos de texto/número del form (todo salvo `type`, que tiene su propio radio handler). */
type CreateCodeTextField = Exclude<keyof CreateCodeFormState, "type">;

const EMPTY_CREATE_FORM: CreateCodeFormState = {
  code: "",
  type: "pct",
  value: "",
  maxUses: "",
  minPurchase: "",
  startsAt: "",
  expiresAt: "",
};

type CreateCodePayload = {
  code: string;
  type: DiscountCodeType;
  value: number;
  maxUses?: number;
  minPurchase?: number;
  startsAt?: string;
  expiresAt?: string;
};

type CreateValidationResult = {
  payload: CreateCodePayload | null;
  errors: Record<string, string>;
};

/** `datetime-local` (hora local del admin) → ISO con offset, como espera el Zod del server. */
function toIsoDateTime(localValue: string): string | null {
  const date = new Date(localValue);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Validación mínima del lado del cliente antes de pegarle al server (que valida todo con Zod igual). */
function validateCreateForm(form: CreateCodeFormState): CreateValidationResult {
  const errors: Record<string, string> = {};

  const code = form.code.trim();
  if (!code) {
    errors.code = "Falta el código";
  } else if (!/^[A-Za-z0-9-]{3,32}$/.test(code)) {
    errors.code = "Solo letras, números y guiones (3 a 32 caracteres)";
  }

  const value = Number(form.value);
  if (form.value.trim() === "" || !Number.isFinite(value) || value <= 0) {
    errors.value = "Valor inválido";
  } else if (form.type === "pct" && value > 100) {
    errors.value = "El porcentaje no puede superar 100";
  }

  let maxUses: number | undefined;
  const maxUsesRaw = form.maxUses.trim();
  if (maxUsesRaw !== "") {
    maxUses = Number(maxUsesRaw);
    if (!Number.isInteger(maxUses) || maxUses <= 0) {
      errors.maxUses = "Los usos máximos deben ser un entero mayor a 0";
    }
  }

  let minPurchase: number | undefined;
  const minPurchaseRaw = form.minPurchase.trim();
  if (minPurchaseRaw !== "") {
    minPurchase = Number(minPurchaseRaw);
    if (!Number.isFinite(minPurchase) || minPurchase < 0) {
      errors.minPurchase = "La compra mínima no puede ser negativa";
    }
  }

  let startsAt: string | undefined;
  if (form.startsAt.trim() !== "") {
    const parsed = toIsoDateTime(form.startsAt);
    if (!parsed) {
      errors.startsAt = "Fecha de inicio inválida";
    } else {
      startsAt = parsed;
    }
  }

  let expiresAt: string | undefined;
  if (form.expiresAt.trim() !== "") {
    const parsed = toIsoDateTime(form.expiresAt);
    if (!parsed) {
      errors.expiresAt = "Fecha de fin inválida";
    } else {
      expiresAt = parsed;
    }
  }

  if (startsAt && expiresAt && new Date(expiresAt) <= new Date(startsAt)) {
    errors.expiresAt = "La fecha de fin debe ser posterior a la de inicio";
  }

  // D3 (ADR 0010): exigir al menos usos O vencimiento al crear.
  if (maxUses === undefined && expiresAt === undefined && !errors.maxUses && !errors.expiresAt) {
    errors.maxUses = "Definí una cantidad de usos, una fecha límite, o ambas";
  }

  if (Object.keys(errors).length > 0) {
    return { payload: null, errors };
  }

  return {
    payload: {
      code,
      type: form.type,
      value,
      ...(maxUses !== undefined ? { maxUses } : {}),
      ...(minPurchase !== undefined ? { minPurchase } : {}),
      ...(startsAt ? { startsAt } : {}),
      ...(expiresAt ? { expiresAt } : {}),
    },
    errors: {},
  };
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR");
}

/** Copy en positivo (spec §6.2): nada de "vencimiento". */
function formatVigencia(startsAt: string | null, expiresAt: string | null): string {
  if (startsAt && expiresAt) return `${formatDate(startsAt)} – ${formatDate(expiresAt)}`;
  if (expiresAt) return `Hasta ${formatDate(expiresAt)}`;
  if (startsAt) return `Desde ${formatDate(startsAt)}`;
  return "Sin límite";
}

function formatTypeAndValue(code: AdminDiscountCode): string {
  return code.type === "pct" ? `${code.value}%` : `$${code.value.toLocaleString("es-AR")}`;
}

type CreateCodeFormFieldsProps = {
  values: CreateCodeFormState;
  errors: Record<string, string>;
  onFieldChange: (field: CreateCodeTextField, value: string) => void;
  onTypeChange: (type: DiscountCodeType) => void;
  idPrefix: string;
};

/** Grilla de campos del form de alta (spec §6.2, 7 campos en orden exacto). */
function CreateCodeFormFields({ values, errors, onFieldChange, onTypeChange, idPrefix }: CreateCodeFormFieldsProps) {
  const codeId = `${idPrefix}-code`;
  const valueId = `${idPrefix}-value`;
  const valueLabel = values.type === "pct" ? "Valor (%)" : "Valor ($)";

  return (
    <>
      <div className={styles.formGrid}>
        <AdminField
          htmlFor={codeId}
          label="Código"
          required
          hint="Se guarda en mayúsculas (ej. HYENA15)."
          error={errors.code}
        >
          <input
            id={codeId}
            className={styles.input}
            value={values.code}
            onChange={(event) => onFieldChange("code", event.target.value)}
            aria-invalid={Boolean(errors.code)}
            aria-describedby={errors.code ? `${codeId}-error` : undefined}
          />
        </AdminField>

        <fieldset className={styles.radioFieldset}>
          <legend className={styles.legend}>
            Tipo<span className={styles.requiredMark}>*</span>
          </legend>
          <div className={styles.radioGroup}>
            <label className={styles.radioOption}>
              <input
                type="radio"
                name={`${idPrefix}-type`}
                className={styles.radio}
                checked={values.type === "pct"}
                onChange={() => onTypeChange("pct")}
              />
              Porcentaje
            </label>
            <label className={styles.radioOption}>
              <input
                type="radio"
                name={`${idPrefix}-type`}
                className={styles.radio}
                checked={values.type === "fixed"}
                onChange={() => onTypeChange("fixed")}
              />
              Monto fijo
            </label>
          </div>
        </fieldset>

        <AdminField htmlFor={valueId} label={valueLabel} required error={errors.value}>
          <input
            id={valueId}
            type="number"
            min={0}
            max={values.type === "pct" ? 100 : undefined}
            step="0.01"
            className={styles.input}
            value={values.value}
            onChange={(event) => onFieldChange("value", event.target.value)}
            aria-invalid={Boolean(errors.value)}
            aria-describedby={errors.value ? `${valueId}-error` : undefined}
          />
        </AdminField>

        <AdminField htmlFor={`${idPrefix}-maxUses`} label="Máx. usos (opcional)" error={errors.maxUses}>
          <input
            id={`${idPrefix}-maxUses`}
            type="number"
            min={1}
            step="1"
            className={styles.input}
            value={values.maxUses}
            onChange={(event) => onFieldChange("maxUses", event.target.value)}
          />
        </AdminField>

        <AdminField htmlFor={`${idPrefix}-minPurchase`} label="Compra mínima ($, opcional)" error={errors.minPurchase}>
          <input
            id={`${idPrefix}-minPurchase`}
            type="number"
            min={0}
            step="0.01"
            className={styles.input}
            value={values.minPurchase}
            onChange={(event) => onFieldChange("minPurchase", event.target.value)}
          />
        </AdminField>

        <AdminField htmlFor={`${idPrefix}-startsAt`} label="Desde (opcional)" error={errors.startsAt}>
          <input
            id={`${idPrefix}-startsAt`}
            type="datetime-local"
            className={styles.input}
            value={values.startsAt}
            onChange={(event) => onFieldChange("startsAt", event.target.value)}
          />
        </AdminField>

        <AdminField htmlFor={`${idPrefix}-expiresAt`} label="Hasta (opcional)" error={errors.expiresAt}>
          <input
            id={`${idPrefix}-expiresAt`}
            type="datetime-local"
            className={styles.input}
            value={values.expiresAt}
            onChange={(event) => onFieldChange("expiresAt", event.target.value)}
          />
        </AdminField>
      </div>

      <p className={styles.hint}>Definí una cantidad de usos, una fecha límite, o ambas.</p>
    </>
  );
}

type CodigosClientProps = {
  initialCodes: AdminDiscountCode[];
};

/**
 * Mutaciones de Códigos (spec §6.2/§8): crear y desactivar. Sin edición ni
 * borrado físico (soft-deactivation únicamente, ADR 0010 §3). Toda mutación
 * exitosa dispara `router.refresh()`.
 */
export default function CodigosClient({ initialCodes }: CodigosClientProps) {
  const router = useRouter();
  const [mutationError, setMutationError] = useState<string | null>(null);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState<CreateCodeFormState>(EMPTY_CREATE_FORM);
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);

  const [deactivateTarget, setDeactivateTarget] = useState<AdminDiscountCode | null>(null);
  const [deactivating, setDeactivating] = useState(false);

  function openCreateForm() {
    setCreateForm(EMPTY_CREATE_FORM);
    setCreateErrors({});
    setShowCreateForm(true);
  }

  function closeCreateForm() {
    setShowCreateForm(false);
  }

  function handleCreateFieldChange(field: CreateCodeTextField, value: string) {
    setCreateForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleCreateTypeChange(type: DiscountCodeType) {
    setCreateForm((prev) => ({ ...prev, type }));
  }

  async function handleCreateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const { payload, errors } = validateCreateForm(createForm);
    if (!payload) {
      setCreateErrors(errors);
      return;
    }

    setCreateErrors({});
    setCreating(true);
    setMutationError(null);
    try {
      const response = await fetch("/api/admin/discount-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        setMutationError(await readErrorMessage(response, "No se pudo crear el código"));
        return;
      }
      setShowCreateForm(false);
      setCreateForm(EMPTY_CREATE_FORM);
      router.refresh();
    } finally {
      setCreating(false);
    }
  }

  async function handleDeactivateConfirm() {
    if (!deactivateTarget) return;
    setDeactivating(true);
    setMutationError(null);
    try {
      const response = await fetch(`/api/admin/discount-codes/${deactivateTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: false }),
      });
      if (!response.ok) {
        setMutationError(await readErrorMessage(response, "No se pudo desactivar el código"));
        return;
      }
      setDeactivateTarget(null);
      router.refresh();
    } finally {
      setDeactivating(false);
    }
  }

  return (
    <>
      <AdminPageHeader
        title="Códigos"
        description="Códigos de descuento para redes sociales. Se desactivan solos al agotar usos o llegar a la fecha límite."
        action={
          <AdminButton
            variant={showCreateForm ? "secondary" : "primary"}
            onClick={() => (showCreateForm ? closeCreateForm() : openCreateForm())}
          >
            {showCreateForm ? "Cancelar" : "+ Nuevo código"}
          </AdminButton>
        }
      />

      {mutationError && (
        <p className={`${styles.banner} ${styles.bannerError}`} role="alert">
          {mutationError}
        </p>
      )}

      {showCreateForm && (
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Nuevo código</h2>
          <form onSubmit={handleCreateSubmit}>
            <CreateCodeFormFields
              values={createForm}
              errors={createErrors}
              onFieldChange={handleCreateFieldChange}
              onTypeChange={handleCreateTypeChange}
              idPrefix="create"
            />

            <div className={styles.modalActions}>
              <AdminButton type="button" variant="secondary" onClick={closeCreateForm}>
                Cancelar
              </AdminButton>
              <AdminButton type="submit" loading={creating}>
                Crear código
              </AdminButton>
            </div>
          </form>
        </div>
      )}

      {initialCodes.length === 0 ? (
        <AdminEmptyState title="No hay códigos todavía" description="Cuando crees el primero, va a aparecer acá." />
      ) : (
        <AdminTable caption="Listado de códigos de descuento">
          <thead>
            <tr>
              <th>Código</th>
              <th className={styles.cellNumeric}>Tipo y valor</th>
              <th className={styles.cellNumeric}>Usos</th>
              <th>Vigencia</th>
              <th>Estado</th>
              <th className={styles.cellActions}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {initialCodes.map((code) => (
              <tr key={code.id} className={!code.active ? styles.rowInactive : undefined}>
                <td>
                  <span className={styles.rowTitle}>{code.code}</span>
                </td>
                <td className={styles.cellNumeric}>{formatTypeAndValue(code)}</td>
                <td className={styles.cellNumeric}>
                  {code.usesCount} / {code.maxUses === null ? "∞" : code.maxUses}
                </td>
                <td className={styles.cellMuted}>{formatVigencia(code.startsAt, code.expiresAt)}</td>
                <td>
                  <DiscountCodeStatusBadge status={code.status} />
                </td>
                <td className={styles.cellActions}>
                  <div className={styles.cellActionsInner}>
                    {code.active ? (
                      <AdminButton size="sm" variant="danger" onClick={() => setDeactivateTarget(code)}>
                        Desactivar
                      </AdminButton>
                    ) : (
                      <span className={styles.cellMuted}>—</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </AdminTable>
      )}

      <AdminModal
        open={deactivateTarget !== null}
        title="¿Desactivar este código?"
        description="Deja de aplicarse en el carrito. No se borra: se conserva el historial de los pedidos que lo usaron."
        tone="danger"
        confirmLabel="Desactivar"
        confirmLoading={deactivating}
        onClose={() => setDeactivateTarget(null)}
        onConfirm={handleDeactivateConfirm}
      />
    </>
  );
}
