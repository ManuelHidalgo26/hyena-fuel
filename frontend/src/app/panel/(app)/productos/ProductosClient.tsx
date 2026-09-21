"use client";

import { Fragment, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  AdminPageHeader,
  AdminButton,
  AdminTable,
  AdminField,
  AdminModal,
  AdminEmptyState,
  AdminBadge,
  ImageUploader,
} from "../../../../components/admin";
import styles from "../../../../components/admin/admin.module.css";
import type { AdminProduct } from "../../../../lib/products";
import type { AdminProductVariant } from "../../../../lib/productVariants";
import { readErrorMessage } from "../../../../lib/admin/http";
import { uploadProductImage } from "../../../../lib/storage/productImages";

type ProductFormFields = {
  name: string;
  slug: string;
  price: string;
  transferPrice: string;
  cost: string;
  stock: string;
  description: string;
  images: string[];
  brand: string;
  variants: VariantFormRow[];
};

/** Campos de texto/número del form (todo salvo `images`/`variants`, que manejan su propio editor). */
type ProductTextField = Exclude<keyof ProductFormFields, "images" | "variants">;

type CreateFormState = ProductFormFields & { active: boolean };

/**
 * Fila de sabor en el form (ADR 0008, Decisión 6). `id: null` = fila nueva,
 * todavía no persistida. `stock` es el stock DESEADO tipeado por el admin
 * (string, mismo patrón que el resto de los campos numéricos del form, para
 * poder vaciar el input al reescribirlo): nunca se manda como parte del
 * payload de `POST/PATCH /api/products` (ver `variantInputSchema`, que no
 * acepta `stock` a propósito). Se aplica DESPUÉS de guardar el producto, con
 * un `PATCH /api/products/[id]/variants/[variantId]` por cada sabor cuyo
 * stock deseado difiera del persistido — ver `applyVariantStock`.
 */
type VariantFormRow = {
  id: string | null;
  name: string;
  image: string | null;
  active: boolean;
  stock: string;
};

const EMPTY_CREATE_FORM: CreateFormState = {
  name: "",
  slug: "",
  price: "",
  transferPrice: "",
  cost: "",
  stock: "",
  description: "",
  images: [],
  brand: "",
  variants: [],
  active: true,
};

function toVariantFormRows(variants: AdminProductVariant[]): VariantFormRow[] {
  return variants
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((variant) => ({
      id: variant.id,
      name: variant.name,
      image: variant.image,
      active: variant.active,
      stock: String(variant.stock),
    }));
}

/** `Number(raw)` con fallback a `0` para drafts de stock intermedios no numéricos (ej. "" mientras se tipea). */
function toStockNumber(raw: string): number {
  const value = Number(raw);
  return Number.isFinite(value) ? value : 0;
}

function toEditForm(product: AdminProduct): ProductFormFields {
  return {
    name: product.name,
    slug: product.slug,
    price: String(product.price),
    transferPrice: product.transferPrice === null ? "" : String(product.transferPrice),
    cost: String(product.cost),
    stock: String(product.stock),
    description: product.description ?? "",
    images: product.images,
    brand: product.brand ?? "",
    variants: toVariantFormRows(product.variants),
  };
}

/**
 * Margen sobre un precio dado: `null` si no es calculable (cost/price <= 0,
 * o cualquiera de los dos no finito — ej. mientras el admin tipea un draft
 * intermedio como "" o "-" en el form de edición, QA-10), nunca "100%" ni
 * "NaN" falsos (spec §2.1).
 */
type Margin = { amount: number; pct: number } | null;

function computeMargin(price: number, cost: number): Margin {
  if (!Number.isFinite(price) || !Number.isFinite(cost) || price <= 0 || cost <= 0) return null;
  return { amount: price - cost, pct: ((price - cost) / price) * 100 };
}

function formatMargin(margin: Margin): string {
  if (margin === null) return "—";
  return `$${margin.amount.toLocaleString("es-AR")} (${Math.round(margin.pct)}%)`;
}

/** Igual al slugify que ya usaba `admin/pedidos/AdminProductos.jsx`: minúsculas, sin diacríticos, guiones. */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

type VariantPayload = {
  id?: string;
  name: string;
  image: string | null;
  active: boolean;
  position: number;
};

type ProductPayload = {
  name: string;
  slug: string;
  price: number;
  transferPrice: number | null;
  cost: number;
  stock: number;
  description: string | null;
  images: string[];
  brand: string | null;
  variants: VariantPayload[];
};

type ValidationResult = {
  payload: ProductPayload | null;
  errors: Record<string, string>;
  variantErrors: Record<number, string>;
  variantStockErrors: Record<number, string>;
};

/** Validación mínima del lado del cliente antes de pegarle al server (que valida todo con Zod igual). */
function validateProductForm(form: ProductFormFields): ValidationResult {
  const errors: Record<string, string> = {};

  const name = form.name.trim();
  if (!name) errors.name = "Falta el nombre";

  const slug = form.slug.trim();
  if (!slug) {
    errors.slug = "Falta el slug";
  } else if (!/^[a-z0-9-]+$/.test(slug)) {
    errors.slug = "Solo minúsculas, números y guiones";
  }

  const price = Number(form.price);
  if (form.price.trim() === "" || !Number.isFinite(price) || price < 0) {
    errors.price = "Precio inválido";
  }

  const stock = Number(form.stock);
  if (form.stock.trim() === "" || !Number.isInteger(stock) || stock < 0) {
    errors.stock = "Stock inválido";
  }

  const costRaw = form.cost.trim();
  const cost = costRaw === "" ? 0 : Number(costRaw);
  if (!Number.isFinite(cost) || cost < 0) {
    errors.cost = "Costo inválido";
  }

  const transferPriceRaw = form.transferPrice.trim();
  const transferPrice = transferPriceRaw === "" ? null : Number(transferPriceRaw);
  if (transferPrice !== null && (!Number.isFinite(transferPrice) || transferPrice < 0)) {
    errors.transferPrice = "Precio de transferencia inválido";
  }

  const variantErrors: Record<number, string> = {};
  const variantStockErrors: Record<number, string> = {};
  const seenVariantNames = new Set<string>();
  form.variants.forEach((variant, index) => {
    const variantName = variant.name.trim();
    if (!variantName) {
      variantErrors[index] = "Falta el nombre del sabor";
    } else {
      const key = variantName.toLowerCase();
      if (seenVariantNames.has(key)) {
        variantErrors[index] = "Hay otro sabor con este nombre";
      } else {
        seenVariantNames.add(key);
      }
    }

    const stockRaw = variant.stock.trim();
    const stockValue = Number(stockRaw);
    if (stockRaw === "" || !Number.isInteger(stockValue) || stockValue < 0) {
      variantStockErrors[index] = "Stock inválido";
    }
  });

  if (
    Object.keys(errors).length > 0 ||
    Object.keys(variantErrors).length > 0 ||
    Object.keys(variantStockErrors).length > 0
  ) {
    return { payload: null, errors, variantErrors, variantStockErrors };
  }

  return {
    payload: {
      name,
      slug,
      price,
      transferPrice,
      cost,
      stock,
      description: form.description.trim() === "" ? null : form.description.trim(),
      images: form.images,
      brand: form.brand.trim() === "" ? null : form.brand.trim(),
      variants: form.variants.map((variant, index) => ({
        ...(variant.id ? { id: variant.id } : {}),
        name: variant.name.trim(),
        image: variant.image,
        active: variant.active,
        position: index,
      })),
    },
    errors: {},
    variantErrors: {},
    variantStockErrors: {},
  };
}

/**
 * Aplica el stock deseado (tipeado en el form) de cada sabor DESPUÉS de guardar
 * el producto (ADR 0008, Decisión 6): un `PATCH /api/products/[id]/variants/[id]`
 * por cada sabor cuyo stock deseado difiera del persistido, incluyendo sabores
 * nuevos con stock > 0. Nunca se manda `stock` en el `POST/PATCH /api/products`
 * (evita el lost-update, ver `replaceProductVariants`). Sabores nuevos (sin
 * `id` en el form) se matchean por nombre contra la respuesta del guardado
 * (único case-insensitive por producto, mismo criterio que el índice real
 * `product_variants(product_id, lower(name))`). Devuelve el mensaje del
 * primer `PATCH` que falla, o `null` si todos terminaron bien.
 */
async function applyVariantStock(
  productId: string,
  desiredVariants: VariantFormRow[],
  savedVariants: AdminProductVariant[]
): Promise<string | null> {
  for (const desired of desiredVariants) {
    const desiredName = desired.name.trim().toLowerCase();
    const saved = desired.id
      ? savedVariants.find((variant) => variant.id === desired.id)
      : savedVariants.find((variant) => variant.name.trim().toLowerCase() === desiredName);
    if (!saved) continue;

    const desiredStock = toStockNumber(desired.stock);
    if (desiredStock === saved.stock) continue;

    const response = await fetch(`/api/products/${productId}/variants/${saved.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stock: desiredStock }),
    });
    if (!response.ok) {
      return readErrorMessage(response, `No se pudo guardar el stock de "${desired.name}"`);
    }
  }
  return null;
}

type ProductFormFieldsGridProps = {
  values: ProductFormFields;
  errors: Record<string, string>;
  onChange: (field: ProductTextField, value: string) => void;
  onImagesChange: (images: string[]) => void;
  idPrefix: string;
  /** Solo el form de edición lo prende (spec §3.7): el aviso de que el stock de acá arriba dejó de ser autoritativo. */
  showVariantsStockBanner?: boolean;
};

/**
 * Grilla de campos compartida entre el form de "crear" y el form de "editar"
 * (mismo set de campos, spec Admin UI §1.1/§4): name, slug, brand, price,
 * transferPrice, cost, stock, description, images.
 */
function ProductFormFieldsGrid({
  values,
  errors,
  onChange,
  onImagesChange,
  idPrefix,
  showVariantsStockBanner,
}: ProductFormFieldsGridProps) {
  const nameId = `${idPrefix}-name`;
  const slugId = `${idPrefix}-slug`;
  const priceId = `${idPrefix}-price`;

  return (
    <div className={styles.formGrid}>
      <AdminField htmlFor={nameId} label="Nombre" required error={errors.name}>
        <input
          id={nameId}
          className={styles.input}
          value={values.name}
          onChange={(event) => onChange("name", event.target.value)}
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? `${nameId}-error` : undefined}
        />
      </AdminField>

      <AdminField htmlFor={slugId} label="Slug" required hint="Solo minúsculas, números y guiones." error={errors.slug}>
        <input
          id={slugId}
          className={styles.input}
          value={values.slug}
          onChange={(event) => onChange("slug", event.target.value)}
          aria-invalid={Boolean(errors.slug)}
          aria-describedby={errors.slug ? `${slugId}-error` : undefined}
        />
      </AdminField>

      <AdminField htmlFor={`${idPrefix}-brand`} label="Marca">
        <input
          id={`${idPrefix}-brand`}
          className={styles.input}
          value={values.brand}
          onChange={(event) => onChange("brand", event.target.value)}
        />
      </AdminField>

      <AdminField htmlFor={priceId} label="Precio lista ($)" required error={errors.price}>
        <input
          id={priceId}
          type="number"
          min={0}
          step="0.01"
          className={styles.input}
          value={values.price}
          onChange={(event) => onChange("price", event.target.value)}
          aria-invalid={Boolean(errors.price)}
          aria-describedby={errors.price ? `${priceId}-error` : undefined}
        />
      </AdminField>

      <AdminField
        htmlFor={`${idPrefix}-transferPrice`}
        label="Precio transferencia ($)"
        hint="Vacío = sin precio de transferencia."
        error={errors.transferPrice}
      >
        <input
          id={`${idPrefix}-transferPrice`}
          type="number"
          min={0}
          step="0.01"
          className={styles.input}
          value={values.transferPrice}
          onChange={(event) => onChange("transferPrice", event.target.value)}
        />
      </AdminField>

      <AdminField htmlFor={`${idPrefix}-cost`} label="Costo ($)" hint="No lo ve el cliente." error={errors.cost}>
        <input
          id={`${idPrefix}-cost`}
          type="number"
          min={0}
          step="0.01"
          className={styles.input}
          value={values.cost}
          onChange={(event) => onChange("cost", event.target.value)}
        />
      </AdminField>

      {showVariantsStockBanner && values.variants.length > 0 && (
        <div className={`${styles.field} ${styles.fieldWide}`}>
          <div className={`${styles.banner} ${styles.bannerWarning}`}>
            Este producto tiene sabores: el stock de acá arriba ya no es el que se
            descuenta en una venta. Cargá y editá el stock real en la sección
            Sabores, más abajo.
          </div>
        </div>
      )}

      <AdminField htmlFor={`${idPrefix}-stock`} label="Stock" required error={errors.stock}>
        <input
          id={`${idPrefix}-stock`}
          type="number"
          min={0}
          step="1"
          className={styles.input}
          value={values.stock}
          onChange={(event) => onChange("stock", event.target.value)}
        />
      </AdminField>

      <AdminField htmlFor={`${idPrefix}-description`} label="Descripción" wide>
        <textarea
          id={`${idPrefix}-description`}
          className={styles.textarea}
          value={values.description}
          onChange={(event) => onChange("description", event.target.value)}
        />
      </AdminField>

      <div className={`${styles.field} ${styles.fieldWide}`}>
        <span className={styles.label}>Imágenes</span>
        <ImageUploader value={values.images} onChange={onImagesChange} onUpload={uploadProductImage} />
        <p className={styles.hint}>La primera imagen es la principal en la tienda.</p>
      </div>
    </div>
  );
}

type VariantsEditorProps = {
  idPrefix: string;
  variants: VariantFormRow[];
  variantErrors: Record<number, string>;
  variantStockErrors: Record<number, string>;
  onChange: (next: VariantFormRow[]) => void;
  onRequestRemove: (index: number) => void;
};

/**
 * Sección "Sabores" del form de producto (ADR 0008, Decisión 6 + design-sabores-variantes.md §3):
 * lista repetible de filas (nombre/imagen/activo/orden/stock deseado). El
 * stock de cada fila se tipea acá mismo (nueva o ya persistida) pero se
 * aplica recién al guardar el producto, con sus propios `PATCH` por sabor —
 * ver `applyVariantStock` en el componente padre.
 */
function VariantsEditor({
  idPrefix,
  variants,
  variantErrors,
  variantStockErrors,
  onChange,
  onRequestRemove,
}: VariantsEditorProps) {
  function updateVariant(index: number, patch: Partial<VariantFormRow>) {
    onChange(variants.map((variant, i) => (i === index ? { ...variant, ...patch } : variant)));
  }

  function moveVariant(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= variants.length) return;
    const next = [...variants];
    const swap = next[index];
    next[index] = next[target];
    next[target] = swap;
    onChange(next);
  }

  function addVariant() {
    onChange([...variants, { id: null, name: "", image: null, active: true, stock: "0" }]);
  }

  return (
    <div className={`${styles.field} ${styles.fieldWide}`}>
      <span className={styles.label}>Sabores (opcional)</span>

      {variants.length === 0 && (
        <p className={styles.hint}>
          Este producto no tiene sabores. Si agregás uno, vas a poder controlar el
          stock de cada sabor por separado.
        </p>
      )}

      {variants.map((variant, index) => {
        const rowId = `${idPrefix}-variant-${index}`;
        return (
          <div className={styles.variantRow} key={variant.id ?? `${idPrefix}-new-${index}`}>
            <div className={styles.variantRowImage}>
              <span className={styles.label}>Imagen del sabor</span>
              <ImageUploader
                maxImages={1}
                value={variant.image ? [variant.image] : []}
                onChange={(images) => updateVariant(index, { image: images[0] ?? null })}
                onUpload={uploadProductImage}
              />
            </div>

            <div className={styles.variantRowFields}>
              <AdminField htmlFor={`${rowId}-name`} label="Nombre del sabor" required error={variantErrors[index]}>
                <input
                  id={`${rowId}-name`}
                  className={styles.input}
                  value={variant.name}
                  onChange={(event) => updateVariant(index, { name: event.target.value })}
                  aria-invalid={Boolean(variantErrors[index])}
                  aria-describedby={variantErrors[index] ? `${rowId}-name-error` : undefined}
                />
              </AdminField>

              <label className={styles.checkboxRow} htmlFor={`${rowId}-active`}>
                <input
                  id={`${rowId}-active`}
                  type="checkbox"
                  className={styles.checkbox}
                  checked={variant.active}
                  onChange={(event) => updateVariant(index, { active: event.target.checked })}
                />
                Activo (visible en la tienda)
              </label>

              <AdminField
                htmlFor={`${rowId}-stock`}
                label="Stock"
                required
                hint={variant.id ? undefined : "Se aplica al guardar el producto."}
                error={variantStockErrors[index]}
              >
                <div className={styles.stockStepper}>
                  <AdminButton
                    size="sm"
                    variant="secondary"
                    className={styles.stockStepButton}
                    aria-label={`Restar stock de ${variant.name || "sabor"}`}
                    onClick={() => updateVariant(index, { stock: String(Math.max(0, toStockNumber(variant.stock) - 1)) })}
                  >
                    −
                  </AdminButton>
                  <input
                    id={`${rowId}-stock`}
                    type="number"
                    min={0}
                    step="1"
                    className={`${styles.input} ${styles.stockInput}`}
                    value={variant.stock}
                    onChange={(event) => updateVariant(index, { stock: event.target.value })}
                    aria-invalid={Boolean(variantStockErrors[index])}
                    aria-describedby={variantStockErrors[index] ? `${rowId}-stock-error` : undefined}
                  />
                  <AdminButton
                    size="sm"
                    variant="secondary"
                    className={styles.stockStepButton}
                    aria-label={`Sumar stock de ${variant.name || "sabor"}`}
                    onClick={() => updateVariant(index, { stock: String(toStockNumber(variant.stock) + 1) })}
                  >
                    +
                  </AdminButton>
                </div>
              </AdminField>
            </div>

            <div className={styles.variantRowActions}>
              <AdminButton
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => moveVariant(index, -1)}
                disabled={index === 0}
                aria-label={`Subir ${variant.name || "sabor"} en el orden`}
              >
                ↑
              </AdminButton>
              <AdminButton
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => moveVariant(index, 1)}
                disabled={index === variants.length - 1}
                aria-label={`Bajar ${variant.name || "sabor"} en el orden`}
              >
                ↓
              </AdminButton>
              <AdminButton type="button" size="sm" variant="danger" onClick={() => onRequestRemove(index)}>
                Quitar
              </AdminButton>
            </div>
          </div>
        );
      })}

      <AdminButton type="button" variant="secondary" size="sm" onClick={addVariant}>
        + Agregar sabor
      </AdminButton>

      {variants.length > 0 && (
        <p className={styles.hint}>
          Stock total (todos los sabores): {variants.reduce((sum, variant) => sum + toStockNumber(variant.stock), 0)} unidades
        </p>
      )}
    </div>
  );
}

const PRODUCT_TABLE_COLUMN_COUNT = 9;

type ProductosClientProps = {
  initialProducts: AdminProduct[];
};

/**
 * Mutaciones de Productos (spec Admin UI §1.1/§4): crear, editar parcial,
 * stock rápido, activar/desactivar (destructivo, con confirmación), sabores
 * (ADR 0008: alta/edición/orden/baja lógica junto con el form + stock por
 * sabor aislado). Toda mutación exitosa dispara `router.refresh()`.
 */
export default function ProductosClient({ initialProducts }: ProductosClientProps) {
  const router = useRouter();
  const [mutationError, setMutationError] = useState<string | null>(null);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState<CreateFormState>(EMPTY_CREATE_FORM);
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});
  const [createVariantErrors, setCreateVariantErrors] = useState<Record<number, string>>({});
  const [createVariantStockErrors, setCreateVariantStockErrors] = useState<Record<number, string>>({});
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ProductFormFields | null>(null);
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [editVariantErrors, setEditVariantErrors] = useState<Record<number, string>>({});
  const [editVariantStockErrors, setEditVariantStockErrors] = useState<Record<number, string>>({});
  const [savingEdit, setSavingEdit] = useState(false);

  const [stockDrafts, setStockDrafts] = useState<Record<string, string>>({});
  const [savingStockId, setSavingStockId] = useState<string | null>(null);

  const [removeVariantIndex, setRemoveVariantIndex] = useState<number | null>(null);

  const [deactivateTarget, setDeactivateTarget] = useState<AdminProduct | null>(null);
  const [deactivating, setDeactivating] = useState(false);
  const [reactivatingId, setReactivatingId] = useState<string | null>(null);

  function openCreateForm() {
    setCreateForm(EMPTY_CREATE_FORM);
    setCreateErrors({});
    setCreateVariantErrors({});
    setCreateVariantStockErrors({});
    setShowCreateForm(true);
  }

  function closeCreateForm() {
    setShowCreateForm(false);
  }

  function handleCreateFieldChange(field: ProductTextField, value: string) {
    setCreateForm((prev) => {
      if (field === "name") {
        // Autocompleta el slug mientras el admin no lo haya tocado a mano (paridad con el admin viejo).
        return { ...prev, name: value, slug: prev.slug === "" ? slugify(value) : prev.slug };
      }
      return { ...prev, [field]: value };
    });
  }

  function handleCreateImagesChange(images: string[]) {
    setCreateForm((prev) => ({ ...prev, images }));
  }

  function handleCreateVariantsChange(variants: VariantFormRow[]) {
    setCreateForm((prev) => ({ ...prev, variants }));
  }

  function requestRemoveCreateVariant(index: number) {
    // Un producto nuevo nunca tiene sabores persistidos: se quita sin confirmar (§3.4.2).
    setCreateForm((prev) => ({ ...prev, variants: prev.variants.filter((_, i) => i !== index) }));
  }

  function handleEditFieldChange(field: ProductTextField, value: string) {
    setEditForm((prev) => (prev ? { ...prev, [field]: value } : prev));
  }

  function handleEditImagesChange(images: string[]) {
    setEditForm((prev) => (prev ? { ...prev, images } : prev));
  }

  function handleEditVariantsChange(variants: VariantFormRow[]) {
    setEditForm((prev) => (prev ? { ...prev, variants } : prev));
  }

  function requestRemoveEditVariant(index: number) {
    const variant = editForm?.variants[index];
    if (!variant) return;
    if (!variant.id) {
      // Fila agregada en esta misma sesión de edición, sin persistir: se quita sin confirmar (§3.4.2).
      setEditForm((prev) => (prev ? { ...prev, variants: prev.variants.filter((_, i) => i !== index) } : prev));
      return;
    }
    setRemoveVariantIndex(index);
  }

  function confirmRemoveEditVariant() {
    if (removeVariantIndex === null) return;
    setEditForm((prev) =>
      prev ? { ...prev, variants: prev.variants.filter((_, i) => i !== removeVariantIndex) } : prev
    );
    setRemoveVariantIndex(null);
  }

  async function handleCreateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const { payload, errors, variantErrors, variantStockErrors } = validateProductForm(createForm);
    if (!payload) {
      setCreateErrors(errors);
      setCreateVariantErrors(variantErrors);
      setCreateVariantStockErrors(variantStockErrors);
      return;
    }

    setCreateErrors({});
    setCreateVariantErrors({});
    setCreateVariantStockErrors({});
    setCreating(true);
    setMutationError(null);
    try {
      const response = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, active: createForm.active }),
      });
      if (!response.ok) {
        setMutationError(await readErrorMessage(response, "No se pudo crear el producto"));
        return;
      }
      const created = (await response.json()) as AdminProduct;
      const desiredVariants = createForm.variants;

      // El producto ya existe en el server (slug tomado): no hay forma segura de
      // "reintentar" un create, así que cerramos el form igual y, si el stock de
      // algún sabor falla, lo decimos explícito para que se termine de cargar
      // editando el producto recién creado (§ orquestación de dos pasos).
      setShowCreateForm(false);
      setCreateForm(EMPTY_CREATE_FORM);
      router.refresh();

      const stockError = await applyVariantStock(created._id, desiredVariants, created.variants);
      if (stockError) {
        setMutationError(
          `El producto "${created.name}" se creó, pero no se pudo guardar el stock de algún sabor (${stockError}). Abrí "Editar" para completarlo.`
        );
        return;
      }
      // El primer refresh (arriba) pudo mostrar stock 0 en sabores nuevos: una vez
      // aplicado, refrescamos de nuevo para que la tabla quede con el valor real.
      router.refresh();
    } finally {
      setCreating(false);
    }
  }

  function startEdit(product: AdminProduct) {
    setEditingId(product._id);
    setEditForm(toEditForm(product));
    setEditErrors({});
    setEditVariantErrors({});
    setEditVariantStockErrors({});
    setRemoveVariantIndex(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm(null);
    setEditErrors({});
    setEditVariantErrors({});
    setEditVariantStockErrors({});
    setRemoveVariantIndex(null);
  }

  async function handleEditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingId || !editForm) return;

    const { payload, errors, variantErrors, variantStockErrors } = validateProductForm(editForm);
    if (!payload) {
      setEditErrors(errors);
      setEditVariantErrors(variantErrors);
      setEditVariantStockErrors(variantStockErrors);
      return;
    }

    setEditErrors({});
    setEditVariantErrors({});
    setEditVariantStockErrors({});
    setSavingEdit(true);
    setMutationError(null);
    try {
      const response = await fetch(`/api/products/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        setMutationError(await readErrorMessage(response, "No se pudo actualizar el producto"));
        return;
      }
      const saved = (await response.json()) as AdminProduct;

      // Sincronizamos localmente el id real de los sabores nuevos (por nombre,
      // único case-insensitive) ANTES de tocar stock: si el paso de stock falla
      // abajo, dejamos el form abierto y un reintento debe reusar estos ids —
      // no reintentar un alta, que rompería por nombre duplicado.
      const syncedVariants = editForm.variants.map((variant) => {
        if (variant.id) return variant;
        const match = saved.variants.find(
          (savedVariant) => savedVariant.name.trim().toLowerCase() === variant.name.trim().toLowerCase()
        );
        return match ? { ...variant, id: match.id } : variant;
      });
      setEditForm((prev) => (prev ? { ...prev, variants: syncedVariants } : prev));

      const stockError = await applyVariantStock(editingId, syncedVariants, saved.variants);
      if (stockError) {
        setMutationError(stockError);
        return;
      }

      cancelEdit();
      router.refresh();
    } finally {
      setSavingEdit(false);
    }
  }

  function handleStockDraftChange(productId: string, value: string) {
    setStockDrafts((prev) => ({ ...prev, [productId]: value }));
  }

  async function handleStockSave(product: AdminProduct) {
    const raw = stockDrafts[product._id];
    const value = Number(raw);
    if (raw === undefined || !Number.isInteger(value) || value < 0) return;

    setSavingStockId(product._id);
    setMutationError(null);
    try {
      const response = await fetch(`/api/products/${product._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stock: value }),
      });
      if (!response.ok) {
        setMutationError(await readErrorMessage(response, "No se pudo actualizar el stock"));
        return;
      }
      setStockDrafts((prev) => {
        const next = { ...prev };
        delete next[product._id];
        return next;
      });
      router.refresh();
    } finally {
      setSavingStockId(null);
    }
  }

  async function handleDeactivateConfirm() {
    if (!deactivateTarget) return;
    setDeactivating(true);
    setMutationError(null);
    try {
      const response = await fetch(`/api/products/${deactivateTarget._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: false }),
      });
      if (!response.ok) {
        setMutationError(await readErrorMessage(response, "No se pudo desactivar el producto"));
        return;
      }
      setDeactivateTarget(null);
      router.refresh();
    } finally {
      setDeactivating(false);
    }
  }

  async function handleReactivate(product: AdminProduct) {
    setReactivatingId(product._id);
    setMutationError(null);
    try {
      const response = await fetch(`/api/products/${product._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: true }),
      });
      if (!response.ok) {
        setMutationError(await readErrorMessage(response, "No se pudo reactivar el producto"));
        return;
      }
      router.refresh();
    } finally {
      setReactivatingId(null);
    }
  }

  return (
    <>
      <AdminPageHeader
        title="Productos"
        description="Todos los productos, incluidos los inactivos."
        action={
          <AdminButton variant={showCreateForm ? "secondary" : "primary"} onClick={() => (showCreateForm ? closeCreateForm() : openCreateForm())}>
            {showCreateForm ? "Cancelar" : "+ Agregar producto"}
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
          <h2 className={styles.cardTitle}>Nuevo producto</h2>
          <form onSubmit={handleCreateSubmit}>
            <ProductFormFieldsGrid
              values={createForm}
              errors={createErrors}
              onChange={handleCreateFieldChange}
              onImagesChange={handleCreateImagesChange}
              idPrefix="create"
            />

            <VariantsEditor
              idPrefix="create"
              variants={createForm.variants}
              variantErrors={createVariantErrors}
              variantStockErrors={createVariantStockErrors}
              onChange={handleCreateVariantsChange}
              onRequestRemove={requestRemoveCreateVariant}
            />

            <label className={styles.checkboxRow} htmlFor="create-active">
              <input
                id="create-active"
                type="checkbox"
                className={styles.checkbox}
                checked={createForm.active}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, active: event.target.checked }))}
              />
              Activo (visible en la tienda)
            </label>

            <div className={styles.modalActions}>
              <AdminButton type="button" variant="secondary" onClick={closeCreateForm}>
                Cancelar
              </AdminButton>
              <AdminButton type="submit" loading={creating}>
                Crear producto
              </AdminButton>
            </div>
          </form>
        </div>
      )}

      {initialProducts.length === 0 ? (
        <AdminEmptyState title="No hay productos" description="Cuando cargues el primero, va a aparecer acá." />
      ) : (
        <AdminTable caption="Listado de productos">
          <thead>
            <tr>
              <th>Producto</th>
              <th>Marca</th>
              <th className={styles.cellNumeric}>Precio</th>
              <th className={styles.cellNumeric}>Transferencia</th>
              <th className={styles.cellNumeric}>Costo</th>
              <th className={styles.cellNumeric}>Margen</th>
              <th className={styles.cellNumeric}>Stock</th>
              <th>Estado</th>
              <th className={styles.cellActions}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {initialProducts.map((product) => {
              const isEditing = editingId === product._id;
              const stockDraft = stockDrafts[product._id];
              const stockChanged = stockDraft !== undefined && stockDraft !== String(product.stock);
              const stockDraftValue = stockDraft !== undefined ? Number(stockDraft) : product.stock;
              const currentStockValue = Number.isFinite(stockDraftValue) ? stockDraftValue : product.stock;
              const margin = computeMargin(product.price, product.cost);
              const activeVariants = product.variants.filter((variant) => variant.active);
              const hasActiveVariants = activeVariants.length > 0;

              const editCost = isEditing && editForm ? Number(editForm.cost) : null;
              const editListMargin = editCost !== null ? computeMargin(Number(editForm?.price), editCost) : null;
              const editTransferPriceRaw = editForm?.transferPrice.trim() ?? "";
              const editTransferMargin =
                editCost !== null && editTransferPriceRaw !== ""
                  ? computeMargin(Number(editTransferPriceRaw), editCost)
                  : null;

              return (
                <Fragment key={product._id}>
                  <tr className={!product.active ? styles.rowInactive : undefined}>
                    <td>
                      <div className={styles.rowMedia}>
                        {product.images[0] && (
                          // eslint-disable-next-line @next/next/no-img-element -- thumbnail admin, no vale el costo de next/image acá.
                          <img src={product.images[0]} alt={product.name} className={styles.rowThumb} />
                        )}
                        <div>
                          <p className={styles.rowTitle}>
                            {product.name}{" "}
                            {hasActiveVariants && (
                              <AdminBadge tone="neutral">{activeVariants.length} sabores</AdminBadge>
                            )}
                          </p>
                          <p className={styles.rowSubtitle}>{product.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className={styles.cellMuted}>{product.brand ?? "—"}</td>
                    <td className={styles.cellNumeric}>${product.price.toLocaleString("es-AR")}</td>
                    <td className={styles.cellNumeric}>
                      {product.transferPrice !== null ? `$${product.transferPrice.toLocaleString("es-AR")}` : "—"}
                    </td>
                    <td className={styles.cellNumeric}>${product.cost.toLocaleString("es-AR")}</td>
                    <td className={`${styles.cellNumeric} ${margin && margin.amount < 0 ? styles.marginNegative : ""}`}>
                      {formatMargin(margin)}
                    </td>
                    <td className={styles.cellNumeric}>
                      {hasActiveVariants ? (
                        <span className={styles.cellMuted}>
                          {activeVariants.reduce((sum, variant) => sum + variant.stock, 0)} ({activeVariants.length} sabores)
                        </span>
                      ) : (
                        <div className={styles.stockStepper}>
                          <AdminButton
                            size="sm"
                            variant="secondary"
                            className={styles.stockStepButton}
                            aria-label={`Restar stock de ${product.name}`}
                            onClick={() => handleStockDraftChange(product._id, String(Math.max(0, currentStockValue - 1)))}
                          >
                            −
                          </AdminButton>
                          <input
                            type="number"
                            min={0}
                            step="1"
                            className={`${styles.input} ${styles.stockInput}`}
                            value={stockDraft ?? String(product.stock)}
                            onChange={(event) => handleStockDraftChange(product._id, event.target.value)}
                            aria-label={`Stock de ${product.name}`}
                          />
                          <AdminButton
                            size="sm"
                            variant="secondary"
                            className={styles.stockStepButton}
                            aria-label={`Sumar stock de ${product.name}`}
                            onClick={() => handleStockDraftChange(product._id, String(currentStockValue + 1))}
                          >
                            +
                          </AdminButton>
                          {stockChanged && (
                            <AdminButton size="sm" loading={savingStockId === product._id} onClick={() => handleStockSave(product)}>
                              Guardar
                            </AdminButton>
                          )}
                        </div>
                      )}
                    </td>
                    <td>
                      <AdminBadge tone={product.active ? "success" : "neutral"}>
                        {product.active ? "Activo" : "Inactivo"}
                      </AdminBadge>
                    </td>
                    <td className={styles.cellActions}>
                      <div className={styles.cellActionsInner}>
                        <AdminButton size="sm" variant="secondary" onClick={() => (isEditing ? cancelEdit() : startEdit(product))}>
                          {isEditing ? "Cerrar" : "Editar"}
                        </AdminButton>
                        {product.active ? (
                          <AdminButton size="sm" variant="danger" onClick={() => setDeactivateTarget(product)}>
                            Desactivar
                          </AdminButton>
                        ) : (
                          <AdminButton size="sm" loading={reactivatingId === product._id} onClick={() => handleReactivate(product)}>
                            Activar
                          </AdminButton>
                        )}
                      </div>
                    </td>
                  </tr>

                  {isEditing && editForm && (
                    <tr>
                      <td colSpan={PRODUCT_TABLE_COLUMN_COUNT}>
                        <form onSubmit={handleEditSubmit}>
                          <ProductFormFieldsGrid
                            values={editForm}
                            errors={editErrors}
                            onChange={handleEditFieldChange}
                            onImagesChange={handleEditImagesChange}
                            idPrefix={`edit-${product._id}`}
                            showVariantsStockBanner
                          />

                          <VariantsEditor
                            idPrefix={`edit-${product._id}`}
                            variants={editForm.variants}
                            variantErrors={editVariantErrors}
                            variantStockErrors={editVariantStockErrors}
                            onChange={handleEditVariantsChange}
                            onRequestRemove={requestRemoveEditVariant}
                          />

                          <p className={styles.hint}>
                            {editListMargin === null
                              ? "Cargá el costo para ver el margen"
                              : `Margen sobre lista: ${formatMargin(editListMargin)}${
                                  editTransferMargin ? ` · Margen sobre transferencia: ${formatMargin(editTransferMargin)}` : ""
                                }`}
                          </p>
                          <div className={styles.modalActions}>
                            <AdminButton type="button" variant="secondary" onClick={cancelEdit}>
                              Cancelar
                            </AdminButton>
                            <AdminButton type="submit" loading={savingEdit}>
                              Guardar cambios
                            </AdminButton>
                          </div>
                        </form>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </AdminTable>
      )}

      <AdminModal
        open={deactivateTarget !== null}
        title="¿Desactivar este producto?"
        description="Deja de verse en la tienda. No se borra: se puede reactivar después."
        tone="danger"
        confirmLabel="Desactivar"
        confirmLoading={deactivating}
        onClose={() => setDeactivateTarget(null)}
        onConfirm={handleDeactivateConfirm}
      />

      <AdminModal
        open={removeVariantIndex !== null}
        title="¿Quitar este sabor?"
        description="Deja de verse en la tienda. No se borra: se puede reactivar después."
        tone="danger"
        confirmLabel="Quitar"
        onClose={() => setRemoveVariantIndex(null)}
        onConfirm={confirmRemoveEditVariant}
      />
    </>
  );
}
