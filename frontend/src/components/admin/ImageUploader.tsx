"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent,
} from "react";
import AdminButton from "./AdminButton";
import styles from "./admin.module.css";

export type ImageUploaderProps = {
  /** URLs/paths actuales (orden = orden en la tienda; `value[0]` es la principal). */
  value: string[];
  /** El contenedor guarda el nuevo array (agregar/quitar/reordenar). */
  onChange: (next: string[]) => void;
  /** Dev inyecta `uploadProductImage` (Supabase Storage). Debe resolver con la URL pública o rechazar con un mensaje legible. */
  onUpload: (file: File) => Promise<string>;
  /** @default 6 */
  maxImages?: number;
  /** Solo para el fast-fail de UX; el bucket lo enforcea igual. @default 5 */
  maxSizeMB?: number;
  /** @default ["image/jpeg","image/png","image/webp"] */
  accept?: string[];
};

const DEFAULT_ACCEPT = ["image/jpeg", "image/png", "image/webp"];

const ACCEPT_LABEL: Record<string, string> = {
  "image/jpeg": "JPG",
  "image/png": "PNG",
  "image/webp": "WEBP",
};

function describeAccept(accept: string[]): string {
  const labels = accept.map((type) => ACCEPT_LABEL[type] ?? type);
  if (labels.length === 0) return "";
  if (labels.length === 1) return labels[0];
  return `${labels.slice(0, -1).join(", ")} o ${labels[labels.length - 1]}`;
}

type PendingUpload = { id: string; name: string };

/**
 * Uploader de imágenes de producto: zona de drag & drop + botón "Seleccionar
 * archivo" + preview con reordenar/quitar + fallback de pegar URL. 100%
 * presentacional (no importa Supabase): la subida real la inyecta el
 * contenedor vía `onUpload`. Ver spec-panel-admin-mejoras.md §1.3.
 */
export default function ImageUploader({
  value,
  onChange,
  onUpload,
  maxImages = 6,
  maxSizeMB = 5,
  accept = DEFAULT_ACCEPT,
}: ImageUploaderProps) {
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [urlValue, setUrlValue] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const idCounterRef = useRef(0);
  // Los uploads son concurrentes (drop de varios archivos a la vez); un `onUpload`
  // que resuelve tarde no debe pisar el append de otro que resolvió antes que el
  // prop `value` se haya vuelto a renderizar. Este ref siempre tiene el último
  // array "efectivo" conocido para evitar perder entradas por carrera.
  const latestValueRef = useRef(value);
  useEffect(() => {
    latestValueRef.current = value;
  }, [value]);

  const urlInputId = useId();
  const dropzoneLabelId = useId();

  const atMax = value.length + pending.length >= maxImages;
  const remaining = Math.max(0, maxImages - value.length - pending.length);

  function nextId(): string {
    idCounterRef.current += 1;
    return `upload-${idCounterRef.current}`;
  }

  function validateFile(file: File): string | null {
    if (!accept.includes(file.type)) {
      return `${file.name}: formato no admitido (usá ${describeAccept(accept)}).`;
    }
    if (file.size > maxSizeMB * 1024 * 1024) {
      return `${file.name}: pesa más de ${maxSizeMB}MB.`;
    }
    return null;
  }

  function uploadOne(file: File) {
    const id = nextId();
    setPending((prev) => [...prev, { id, name: file.name }]);

    onUpload(file)
      .then((url) => {
        setPending((prev) => prev.filter((item) => item.id !== id));
        const next = [...latestValueRef.current, url];
        latestValueRef.current = next;
        onChange(next);
      })
      .catch((error: unknown) => {
        setPending((prev) => prev.filter((item) => item.id !== id));
        const message = error instanceof Error ? error.message : "No se pudo subir la imagen.";
        setFileErrors((prev) => [...prev, `${file.name}: ${message}`]);
      });
  }

  function processFiles(files: File[]) {
    if (files.length === 0) return;

    if (atMax) {
      setFileErrors([`Alcanzaste el máximo de ${maxImages} imágenes.`]);
      return;
    }

    const availableSlots = Math.max(0, maxImages - value.length - pending.length);
    const filesToProcess = files.slice(0, availableSlots);
    const overflow = files.length - filesToProcess.length;

    const errors: string[] = [];
    if (overflow > 0) {
      errors.push(`Se ignoraron ${overflow} archivo(s): alcanzaste el máximo de ${maxImages} imágenes.`);
    }

    const validFiles: File[] = [];
    filesToProcess.forEach((file) => {
      const error = validateFile(file);
      if (error) errors.push(error);
      else validFiles.push(file);
    });

    setFileErrors(errors);
    validFiles.forEach(uploadOne);
  }

  function openPicker() {
    fileInputRef.current?.click();
  }

  function handleFileInputChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    processFiles(files);
    // Reset: permite volver a elegir el mismo archivo (ej. tras corregirlo) y re-dispara onChange.
    event.target.value = "";
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    if (atMax) return;
    processFiles(Array.from(event.dataTransfer.files ?? []));
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (atMax) return;
    setIsDragging(true);
  }

  function handleDragLeave() {
    setIsDragging(false);
  }

  function handleDropzoneKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (atMax) return;
    if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
      event.preventDefault();
      openPicker();
    }
  }

  function removeImage(index: number) {
    const next = value.filter((_, i) => i !== index);
    latestValueRef.current = next;
    onChange(next);
  }

  function moveImage(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    const swap = next[index];
    next[index] = next[target];
    next[target] = swap;
    latestValueRef.current = next;
    onChange(next);
  }

  function handleAddUrl() {
    const trimmed = urlValue.trim();
    if (!trimmed) return;
    if (atMax) {
      setFileErrors([`Alcanzaste el máximo de ${maxImages} imágenes.`]);
      return;
    }
    const next = [...latestValueRef.current, trimmed];
    latestValueRef.current = next;
    onChange(next);
    setUrlValue("");
  }

  function handleUrlKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      handleAddUrl();
    }
  }

  const dropzoneClasses = [
    styles.uploaderDropzone,
    isDragging ? styles.uploaderDropzoneActive : "",
    atMax ? styles.uploaderDropzoneDisabled : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={styles.uploader}>
      {/* Zona de drag&drop, clickeable y operable por teclado (Enter/Espacio abre el picker). */}
      <div
        className={dropzoneClasses}
        role="button"
        tabIndex={atMax ? -1 : 0}
        aria-disabled={atMax || undefined}
        aria-labelledby={dropzoneLabelId}
        onClick={() => !atMax && openPicker()}
        onKeyDown={handleDropzoneKeyDown}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <p id={dropzoneLabelId} className={styles.uploaderDropzoneText}>
          {atMax ? `Alcanzaste el máximo de ${maxImages} imágenes.` : "Arrastrá imágenes acá, o"}
        </p>

        {!atMax && (
          <AdminButton
            type="button"
            variant="secondary"
            size="sm"
            onClick={(event) => {
              // Evita que el click también dispare el onClick de la zona (mismo picker, sin abrirlo dos veces).
              event.stopPropagation();
              openPicker();
            }}
          >
            Seleccionar archivo
          </AdminButton>
        )}

        <p className={styles.uploaderDropzoneHint}>
          {describeAccept(accept)} · hasta {maxSizeMB}MB · {remaining} de {maxImages} disponibles
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept={accept.join(",")}
          multiple
          className={styles.uploaderFileInput}
          onChange={handleFileInputChange}
          aria-hidden="true"
          tabIndex={-1}
        />
      </div>

      {fileErrors.length > 0 && (
        <div className={`${styles.banner} ${styles.bannerError}`} role="alert">
          <ul className={styles.uploaderErrorList}>
            {fileErrors.map((message, index) => (
              <li key={index}>{message}</li>
            ))}
          </ul>
        </div>
      )}

      {(value.length > 0 || pending.length > 0) && (
        <ul className={styles.uploaderGrid}>
          {value.map((url, index) => (
            <li className={styles.uploaderPreview} key={`${url}-${index}`}>
              {/* eslint-disable-next-line @next/next/no-img-element -- preview admin interna, igual criterio que rowThumb. */}
              <img
                src={url}
                alt={`Imagen ${index + 1}${index === 0 ? " (principal)" : ""} del producto`}
                className={styles.uploaderPreviewImg}
              />
              {index === 0 && <span className={styles.uploaderPrimaryBadge}>Principal</span>}
              <div className={styles.uploaderPreviewActions}>
                <button
                  type="button"
                  className={styles.uploaderIconButton}
                  onClick={() => moveImage(index, -1)}
                  disabled={index === 0}
                  aria-label={`Mover imagen ${index + 1} a la izquierda`}
                >
                  ←
                </button>
                <button
                  type="button"
                  className={styles.uploaderIconButton}
                  onClick={() => moveImage(index, 1)}
                  disabled={index === value.length - 1}
                  aria-label={`Mover imagen ${index + 1} a la derecha`}
                >
                  →
                </button>
                <button
                  type="button"
                  className={styles.uploaderIconButtonDanger}
                  onClick={() => removeImage(index)}
                  aria-label={`Quitar imagen ${index + 1}`}
                >
                  ✕
                </button>
              </div>
            </li>
          ))}

          {pending.map((item) => (
            <li className={`${styles.uploaderPreview} ${styles.uploaderPreviewPending}`} key={item.id} aria-label={`Subiendo ${item.name}`}>
              <span className={styles.uploaderSpinner} aria-hidden="true" />
              <span className={styles.uploaderPendingLabel}>Subiendo…</span>
            </li>
          ))}
        </ul>
      )}

      <div className={styles.uploaderUrlRow}>
        <label className={styles.uploaderUrlLabel} htmlFor={urlInputId}>
          o pegá una URL
        </label>
        <div className={styles.uploaderUrlInputGroup}>
          <input
            id={urlInputId}
            type="text"
            className={styles.input}
            placeholder="https://..."
            value={urlValue}
            onChange={(event) => setUrlValue(event.target.value)}
            onKeyDown={handleUrlKeyDown}
            disabled={atMax}
          />
          <AdminButton type="button" variant="secondary" size="sm" onClick={handleAddUrl} disabled={atMax || urlValue.trim() === ""}>
            Agregar
          </AdminButton>
        </div>
        <p className={styles.hint}>
          Solo rutas locales y el host de Storage se ven en la tienda (otros hosts pueden requerir configuración extra).
        </p>
      </div>
    </div>
  );
}
