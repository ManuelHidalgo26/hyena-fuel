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
  AdminBadge,
} from "../../../../components/admin";
import styles from "../../../../components/admin/admin.module.css";
import type { AdminSeller } from "../../../../lib/admin/sellers";
import { readErrorMessage } from "../../../../lib/admin/http";
import { buildWhatsAppLink } from "../../../../lib/whatsapp";
import { buildReferralLink } from "../../../../lib/sellers";
import { isValidPasswordLength, PASSWORD_LENGTH_MESSAGE } from "../../../../lib/auth/passwordRules";

/** Comisión con la que arranca el form de alta (editable): solo UI, no toca el default de la DB. */
const DEFAULT_COMMISSION_PCT = "7";

type SellerFormState = {
  name: string;
  email: string;
  phone: string;
  code: string;
  commissionPct: string;
};

type SellerTextField = keyof SellerFormState;

const EMPTY_FORM: SellerFormState = {
  name: "",
  email: "",
  phone: "",
  code: "",
  commissionPct: DEFAULT_COMMISSION_PCT,
};

/** Credenciales a entregar una única vez (alta o reseteo de contraseña). */
type Credentials = {
  kind: "created" | "reset";
  seller: Pick<AdminSeller, "name" | "code" | "phone"> & { email: string | null };
  password: string;
};

type PasswordMode = "generate" | "choose";

type ValidationResult<T> = { payload: T | null; errors: Record<string, string> };

type CreatePayload = {
  name: string;
  email: string;
  phone?: string;
  code: string;
  defaultCommissionPct: number;
};

type UpdatePayload = {
  name?: string;
  phone?: string | null;
  code?: string;
  defaultCommissionPct?: number;
};

function validateCommonFields(form: SellerFormState, errors: Record<string, string>) {
  if (!form.name.trim()) errors.name = "Falta el nombre";

  const code = form.code.trim();
  if (!code) {
    errors.code = "Falta el código";
  } else if (!/^[A-Za-z0-9]+$/.test(code)) {
    errors.code = "Solo letras y números, sin espacios";
  }

  const commission = Number(form.commissionPct);
  if (form.commissionPct.trim() === "" || !Number.isFinite(commission) || commission < 0 || commission > 100) {
    errors.commissionPct = "Ingresá un porcentaje entre 0 y 100";
  }
}

function validateCreateForm(form: SellerFormState): ValidationResult<CreatePayload> {
  const errors: Record<string, string> = {};
  validateCommonFields(form, errors);

  const email = form.email.trim();
  if (!email) {
    errors.email = "Falta el email";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = "Email inválido";
  }

  if (Object.keys(errors).length > 0) return { payload: null, errors };

  const phone = form.phone.trim();
  return {
    payload: {
      name: form.name.trim(),
      email,
      ...(phone ? { phone } : {}),
      code: form.code.trim().toUpperCase(),
      defaultCommissionPct: Number(form.commissionPct),
    },
    errors: {},
  };
}

/** Solo manda los campos que cambiaron respecto del vendedor original. */
function validateEditForm(form: SellerFormState, original: AdminSeller): ValidationResult<UpdatePayload> {
  const errors: Record<string, string> = {};
  validateCommonFields(form, errors);
  if (Object.keys(errors).length > 0) return { payload: null, errors };

  const payload: UpdatePayload = {};
  const name = form.name.trim();
  const phone = form.phone.trim() || null;
  const code = form.code.trim().toUpperCase();
  const commission = Number(form.commissionPct);

  if (name !== original.name) payload.name = name;
  if (phone !== original.phone) payload.phone = phone;
  if (code !== original.code) payload.code = code;
  if (commission !== original.defaultCommissionPct) payload.defaultCommissionPct = commission;

  return { payload, errors: {} };
}

function formatMoney(value: number): string {
  return `$${value.toLocaleString("es-AR")}`;
}

function loginUrl(): string {
  return `${window.location.origin}/panel/login`;
}

function credentialsText(credentials: Credentials): string {
  const { seller, password } = credentials;
  return [
    `Panel de vendedores: ${loginUrl()}`,
    `Email: ${seller.email ?? "(sin email)"}`,
    `Contraseña: ${password}`,
    `Tu código de vendedor: ${seller.code}`,
    `Tu link para compartir: ${buildReferralLink(seller.code)}`,
  ].join("\n");
}

function whatsappMessage(credentials: Credentials): string {
  const intro =
    credentials.kind === "created"
      ? `¡Hola ${credentials.seller.name}! Ya tenés tu acceso como vendedor de HYENA FUEL.`
      : `¡Hola ${credentials.seller.name}! Te dejo tu nueva contraseña del panel de vendedores de HYENA FUEL.`;

  return `${intro}\n\n${credentialsText(credentials)}\n\nCuando entres, cambiá la contraseña por una tuya.`;
}

type SellerFormFieldsProps = {
  values: SellerFormState;
  errors: Record<string, string>;
  onFieldChange: (field: SellerTextField, value: string) => void;
  idPrefix: string;
  /** El email es la cuenta de acceso: solo se carga en el alta. */
  showEmail: boolean;
};

function SellerFormFields({ values, errors, onFieldChange, idPrefix, showEmail }: SellerFormFieldsProps) {
  function textInput(field: SellerTextField, extra: { type?: string; className?: string; autoComplete?: string } = {}) {
    const id = `${idPrefix}-${field}`;
    return (
      <input
        id={id}
        type={extra.type ?? "text"}
        autoComplete={extra.autoComplete ?? "off"}
        className={[styles.input, extra.className].filter(Boolean).join(" ")}
        value={values[field]}
        onChange={(event) => onFieldChange(field, event.target.value)}
        aria-invalid={Boolean(errors[field])}
        aria-describedby={errors[field] ? `${id}-error` : undefined}
      />
    );
  }

  return (
    <div className={styles.formGrid}>
      <AdminField htmlFor={`${idPrefix}-name`} label="Nombre" required error={errors.name}>
        {textInput("name")}
      </AdminField>

      {showEmail && (
        <AdminField
          htmlFor={`${idPrefix}-email`}
          label="Email"
          required
          hint="Es el usuario con el que entra al panel."
          error={errors.email}
        >
          {textInput("email", { type: "email" })}
        </AdminField>
      )}

      <AdminField
        htmlFor={`${idPrefix}-phone`}
        label="Teléfono (opcional)"
        hint="Para mandarle el acceso por WhatsApp."
        error={errors.phone}
      >
        {textInput("phone", { type: "tel" })}
      </AdminField>

      <AdminField
        htmlFor={`${idPrefix}-code`}
        label="Código"
        required
        hint="Lo escribe el cliente en el carrito. Se guarda en mayúsculas (ej. JUAN10)."
        error={errors.code}
      >
        {textInput("code", { className: styles.uppercaseInput })}
      </AdminField>

      <AdminField
        htmlFor={`${idPrefix}-commissionPct`}
        label="Comisión (%)"
        required
        hint="Sobre el precio de cada producto vendido con su código."
        error={errors.commissionPct}
      >
        <input
          id={`${idPrefix}-commissionPct`}
          type="number"
          min={0}
          max={100}
          step="0.5"
          className={styles.input}
          value={values.commissionPct}
          onChange={(event) => onFieldChange("commissionPct", event.target.value)}
          aria-invalid={Boolean(errors.commissionPct)}
          aria-describedby={errors.commissionPct ? `${idPrefix}-commissionPct-error` : undefined}
        />
      </AdminField>
    </div>
  );
}

type VendedoresClientProps = {
  initialSellers: AdminSeller[];
};

/**
 * Gestión de vendedores (Tanda A): alta con contraseña temporal, edición, baja/reactivación
 * (también bloquea/habilita el login) y reseteo de contraseña. Las credenciales se muestran
 * una sola vez, con "Copiar" y "Enviar por WhatsApp"; nunca quedan guardadas en ningún lado.
 */
export default function VendedoresClient({ initialSellers }: VendedoresClientProps) {
  const router = useRouter();
  const [mutationError, setMutationError] = useState<string | null>(null);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState<SellerFormState>(EMPTY_FORM);
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);

  const [editTarget, setEditTarget] = useState<AdminSeller | null>(null);
  const [editForm, setEditForm] = useState<SellerFormState>(EMPTY_FORM);
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [pendingCodeChange, setPendingCodeChange] = useState<UpdatePayload | null>(null);
  const [saving, setSaving] = useState(false);

  const [statusTarget, setStatusTarget] = useState<AdminSeller | null>(null);
  const [changingStatus, setChangingStatus] = useState(false);

  const [passwordTarget, setPasswordTarget] = useState<AdminSeller | null>(null);
  const [passwordMode, setPasswordMode] = useState<PasswordMode>("generate");
  const [chosenPassword, setChosenPassword] = useState("");
  const [showChosenPassword, setShowChosenPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [resettingPassword, setResettingPassword] = useState(false);

  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);

  async function handleCopyLink(seller: AdminSeller) {
    try {
      await navigator.clipboard.writeText(buildReferralLink(seller.code));
      setCopiedLinkId(seller.id);
    } catch {
      setMutationError(`No se pudo copiar. El link es: ${buildReferralLink(seller.code)}`);
    }
  }

  function openCreateForm() {
    setEditTarget(null);
    setCreateForm(EMPTY_FORM);
    setCreateErrors({});
    setShowCreateForm(true);
  }

  function openEditForm(seller: AdminSeller) {
    setShowCreateForm(false);
    setEditTarget(seller);
    setEditErrors({});
    setEditForm({
      name: seller.name,
      email: seller.email ?? "",
      phone: seller.phone ?? "",
      code: seller.code,
      commissionPct: String(seller.defaultCommissionPct),
    });
  }

  function openPasswordModal(seller: AdminSeller) {
    setPasswordTarget(seller);
    setPasswordMode("generate");
    setChosenPassword("");
    setShowChosenPassword(false);
    setPasswordError(null);
  }

  function closePasswordModal() {
    setPasswordTarget(null);
    setChosenPassword("");
  }

  function closeCredentials() {
    setCredentials(null);
    setCopied(false);
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
      const response = await fetch("/api/admin/sellers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        setMutationError(await readErrorMessage(response, "No se pudo crear el vendedor"));
        return;
      }

      const data = (await response.json()) as {
        seller: AdminSeller;
        temporaryPassword?: string;
      };
      setShowCreateForm(false);
      setCreateForm(EMPTY_FORM);
      if (data.temporaryPassword) {
        setCredentials({ kind: "created", seller: data.seller, password: data.temporaryPassword });
      }
      router.refresh();
    } finally {
      setCreating(false);
    }
  }

  async function saveEdit(seller: AdminSeller, payload: UpdatePayload) {
    setSaving(true);
    setMutationError(null);
    try {
      const response = await fetch(`/api/admin/sellers/${seller.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        setMutationError(await readErrorMessage(response, "No se pudo guardar el vendedor"));
        return;
      }
      setEditTarget(null);
      setPendingCodeChange(null);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  function handleEditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editTarget) return;

    const { payload, errors } = validateEditForm(editForm, editTarget);
    if (!payload) {
      setEditErrors(errors);
      return;
    }
    setEditErrors({});

    if (Object.keys(payload).length === 0) {
      setEditTarget(null);
      return;
    }

    // Cambiar el código rompe los links/códigos que el vendedor ya compartió: se confirma aparte.
    if (payload.code !== undefined) {
      setPendingCodeChange(payload);
      return;
    }

    void saveEdit(editTarget, payload);
  }

  async function handleStatusConfirm() {
    if (!statusTarget) return;
    setChangingStatus(true);
    setMutationError(null);
    try {
      const response = statusTarget.active
        ? await fetch(`/api/admin/sellers/${statusTarget.id}`, { method: "DELETE" })
        : await fetch(`/api/admin/sellers/${statusTarget.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ active: true }),
          });
      if (!response.ok) {
        setMutationError(
          await readErrorMessage(
            response,
            statusTarget.active ? "No se pudo dar de baja al vendedor" : "No se pudo reactivar al vendedor"
          )
        );
        return;
      }
      setStatusTarget(null);
      router.refresh();
    } finally {
      setChangingStatus(false);
    }
  }

  async function handlePasswordConfirm() {
    if (!passwordTarget) return;

    if (passwordMode === "choose" && !isValidPasswordLength(chosenPassword)) {
      setPasswordError(PASSWORD_LENGTH_MESSAGE);
      return;
    }

    setPasswordError(null);
    setResettingPassword(true);
    try {
      const response = await fetch(`/api/admin/sellers/${passwordTarget.id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(passwordMode === "choose" ? { password: chosenPassword } : {}),
      });

      if (response.status === 400) {
        // Error corregible (largo, contraseña débil): queda en el modal para reintentar.
        setPasswordError(await readErrorMessage(response, "Contraseña inválida"));
        return;
      }
      if (!response.ok) {
        setMutationError(await readErrorMessage(response, "No se pudo cambiar la contraseña"));
        closePasswordModal();
        return;
      }

      const data = (await response.json()) as { temporaryPassword?: string };
      const password = passwordMode === "choose" ? chosenPassword : data.temporaryPassword;
      if (password) {
        setCredentials({ kind: "reset", seller: passwordTarget, password });
      }
      closePasswordModal();
    } finally {
      setResettingPassword(false);
    }
  }

  async function handleCopyCredentials() {
    if (!credentials) return;
    try {
      await navigator.clipboard.writeText(credentialsText(credentials));
      setCopied(true);
    } catch {
      setMutationError("No se pudo copiar. Seleccioná el texto y copialo a mano.");
    }
  }

  return (
    <>
      <AdminPageHeader
        title="Vendedores"
        description="Cada vendedor tiene un código que el cliente escribe en el carrito. Las ventas con ese código le suman comisión."
        action={
          <AdminButton
            variant={showCreateForm ? "secondary" : "primary"}
            onClick={() => (showCreateForm ? setShowCreateForm(false) : openCreateForm())}
          >
            {showCreateForm ? "Cancelar" : "+ Nuevo vendedor"}
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
          <h2 className={styles.cardTitle}>Nuevo vendedor</h2>
          <form onSubmit={handleCreateSubmit} noValidate>
            <SellerFormFields
              values={createForm}
              errors={createErrors}
              onFieldChange={(field, value) => setCreateForm((prev) => ({ ...prev, [field]: value }))}
              idPrefix="create"
              showEmail
            />
            <p className={styles.hint}>
              Se genera una contraseña temporal que vas a ver una sola vez, para mandársela al vendedor.
            </p>
            <div className={styles.modalActions}>
              <AdminButton type="button" variant="secondary" onClick={() => setShowCreateForm(false)}>
                Cancelar
              </AdminButton>
              <AdminButton type="submit" loading={creating}>
                Crear vendedor
              </AdminButton>
            </div>
          </form>
        </div>
      )}

      {editTarget && (
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Editar a {editTarget.name}</h2>
          <form onSubmit={handleEditSubmit} noValidate>
            <SellerFormFields
              values={editForm}
              errors={editErrors}
              onFieldChange={(field, value) => setEditForm((prev) => ({ ...prev, [field]: value }))}
              idPrefix="edit"
              showEmail={false}
            />
            <div className={styles.modalActions}>
              <AdminButton type="button" variant="secondary" onClick={() => setEditTarget(null)}>
                Cancelar
              </AdminButton>
              <AdminButton type="submit" loading={saving}>
                Guardar cambios
              </AdminButton>
            </div>
          </form>
        </div>
      )}

      {initialSellers.length === 0 ? (
        <AdminEmptyState
          title="Todavía no hay vendedores"
          description="Cuando des de alta al primero, va a aparecer acá con sus ventas."
        />
      ) : (
        <AdminTable caption="Listado de vendedores">
          <thead>
            <tr>
              <th>Vendedor</th>
              <th>Código</th>
              <th>Teléfono</th>
              <th className={styles.cellNumeric}>Comisión</th>
              <th className={styles.cellNumeric}>Ventas</th>
              <th className={styles.cellNumeric}>Comisión ganada</th>
              <th>Estado</th>
              <th className={styles.cellActions}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {initialSellers.map((seller) => (
              <tr key={seller.id} className={!seller.active ? styles.rowInactive : undefined}>
                <td>
                  <div className={styles.rowTitle}>{seller.name}</div>
                  <div className={styles.rowSubtitle}>{seller.email ?? "Sin email"}</div>
                </td>
                <td>
                  <span className={styles.rowTitle}>{seller.code}</span>
                </td>
                <td className={styles.cellMuted}>{seller.phone ?? "—"}</td>
                <td className={styles.cellNumeric}>{seller.defaultCommissionPct}%</td>
                <td className={styles.cellNumeric}>{seller.sales.ordersCount}</td>
                <td className={styles.cellNumeric}>{formatMoney(seller.sales.commissionAccumulated)}</td>
                <td>
                  <AdminBadge tone={seller.active ? "success" : "danger"}>
                    {seller.active ? "Activo" : "Dado de baja"}
                  </AdminBadge>
                </td>
                <td className={styles.cellActions}>
                  <div className={styles.cellActionsInner}>
                    {seller.active && (
                      <AdminButton size="sm" variant="secondary" onClick={() => handleCopyLink(seller)}>
                        {copiedLinkId === seller.id ? "¡Copiado!" : "Copiar link"}
                      </AdminButton>
                    )}
                    <AdminButton size="sm" variant="secondary" onClick={() => openEditForm(seller)}>
                      Editar
                    </AdminButton>
                    {seller.active && (
                      <AdminButton size="sm" variant="secondary" onClick={() => openPasswordModal(seller)}>
                        Contraseña
                      </AdminButton>
                    )}
                    <AdminButton
                      size="sm"
                      variant={seller.active ? "danger" : "secondary"}
                      onClick={() => setStatusTarget(seller)}
                    >
                      {seller.active ? "Dar de baja" : "Reactivar"}
                    </AdminButton>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </AdminTable>
      )}

      <AdminModal
        open={pendingCodeChange !== null}
        title="¿Cambiar el código del vendedor?"
        description={`El código anterior (${editTarget?.code ?? ""}) deja de funcionar en el carrito. Avisale al vendedor para que comparta el nuevo.`}
        confirmLabel="Cambiar código"
        confirmLoading={saving}
        onClose={() => setPendingCodeChange(null)}
        onConfirm={() => {
          if (editTarget && pendingCodeChange) void saveEdit(editTarget, pendingCodeChange);
        }}
      />

      <AdminModal
        open={statusTarget !== null}
        title={statusTarget?.active ? `¿Dar de baja a ${statusTarget.name}?` : `¿Reactivar a ${statusTarget?.name ?? ""}?`}
        description={
          statusTarget?.active
            ? "No va a poder entrar al panel y su código deja de sumar comisión. Sus ventas anteriores se conservan."
            : "Vuelve a poder entrar al panel con su contraseña y su código vuelve a sumar comisión."
        }
        tone={statusTarget?.active ? "danger" : "default"}
        confirmLabel={statusTarget?.active ? "Dar de baja" : "Reactivar"}
        confirmLoading={changingStatus}
        onClose={() => setStatusTarget(null)}
        onConfirm={handleStatusConfirm}
      />

      <AdminModal
        open={passwordTarget !== null}
        title={`Nueva contraseña para ${passwordTarget?.name ?? ""}`}
        description="La contraseña actual deja de funcionar. Vas a ver la nueva una sola vez para mandársela."
        confirmLabel="Cambiar contraseña"
        confirmLoading={resettingPassword}
        onClose={closePasswordModal}
        onConfirm={handlePasswordConfirm}
      >
        <fieldset className={styles.radioFieldset}>
          <legend className={styles.srOnly}>Cómo definir la contraseña</legend>
          <div className={styles.radioGroup}>
            <label className={styles.radioOption}>
              <input
                type="radio"
                name="password-mode"
                className={styles.radio}
                checked={passwordMode === "generate"}
                onChange={() => setPasswordMode("generate")}
              />
              Generar una automática
            </label>
            <label className={styles.radioOption}>
              <input
                type="radio"
                name="password-mode"
                className={styles.radio}
                checked={passwordMode === "choose"}
                onChange={() => setPasswordMode("choose")}
              />
              Elegirla yo
            </label>
          </div>
        </fieldset>

        {passwordMode === "choose" && (
          <AdminField htmlFor="chosen-password" label="Contraseña" hint={PASSWORD_LENGTH_MESSAGE}>
            <input
              id="chosen-password"
              type={showChosenPassword ? "text" : "password"}
              autoComplete="new-password"
              className={styles.input}
              value={chosenPassword}
              onChange={(event) => setChosenPassword(event.target.value)}
            />
          </AdminField>
        )}
        {passwordMode === "choose" && (
          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              className={styles.checkbox}
              checked={showChosenPassword}
              onChange={(event) => setShowChosenPassword(event.target.checked)}
            />
            Mostrar contraseña
          </label>
        )}

        {passwordError && (
          <p className={styles.fieldError} role="alert">
            {passwordError}
          </p>
        )}
      </AdminModal>

      <AdminModal
        open={credentials !== null}
        title={credentials?.kind === "created" ? "Vendedor creado" : "Contraseña actualizada"}
        description="Mandale estos datos al vendedor. Por seguridad, la contraseña no se vuelve a mostrar."
        confirmLabel="Listo"
        hideCancel
        onClose={closeCredentials}
        onConfirm={closeCredentials}
      >
        {credentials && (
          <>
            <div className={styles.credentialBox}>
              <div className={styles.credentialRow}>
                <span className={styles.credentialLabel}>Email</span>
                <span className={styles.credentialValue}>{credentials.seller.email ?? "Sin email"}</span>
              </div>
              <div className={styles.credentialRow}>
                <span className={styles.credentialLabel}>Contraseña</span>
                <span className={styles.credentialValue}>{credentials.password}</span>
              </div>
              <div className={styles.credentialRow}>
                <span className={styles.credentialLabel}>Código</span>
                <span className={styles.credentialValue}>{credentials.seller.code}</span>
              </div>
            </div>
            <div className={styles.credentialActions}>
              <AdminButton size="sm" variant="secondary" onClick={handleCopyCredentials}>
                {copied ? "¡Copiado!" : "Copiar todo"}
              </AdminButton>
              <a
                className={`${styles.button} ${styles.buttonSecondary} ${styles.buttonSm}`}
                href={buildWhatsAppLink(whatsappMessage(credentials), credentials.seller.phone)}
                target="_blank"
                rel="noopener noreferrer"
              >
                Enviar por WhatsApp
              </a>
            </div>
          </>
        )}
      </AdminModal>
    </>
  );
}
