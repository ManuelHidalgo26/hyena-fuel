import styles from "./admin.module.css";

export type AdminFilterOption = {
  value: string;
  label: string;
};

export type AdminFilterTabsProps<T extends string> = {
  /** Etiqueta accesible del grupo, ej. "Filtrar por medio de pago". */
  label: string;
  options: AdminFilterOption[];
  value: T;
  onChange: (value: T) => void;
};

/**
 * Filtro segmentado (ej. Pedidos: todos / transferencia / mercadopago).
 * No son tabs de navegación (no cambian de vista, filtran una lista que
 * sigue en la misma página) — por eso usa semántica de grupo de botones
 * (`role="group"` + `aria-pressed`), no `role="tablist"`.
 *
 * Requiere estado en el componente padre (Client Component): es
 * controlado, no maneja su propio estado.
 */
export default function AdminFilterTabs<T extends string>({
  label,
  options,
  value,
  onChange,
}: AdminFilterTabsProps<T>) {
  return (
    <div className={styles.filterGroup} role="group" aria-label={label}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            className={active ? `${styles.filterTab} ${styles.filterTabActive}` : styles.filterTab}
            aria-pressed={active}
            onClick={() => onChange(option.value as T)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
