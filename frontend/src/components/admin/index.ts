/**
 * Barrel del sistema de componentes admin (Fase 1, tarea 8a). Todos son
 * presentacionales: sin fetch, sin Supabase, sin server actions. Import
 * relativo (el repo no usa el alias `@/*` en ningún lado todavía):
 *
 * `import { AdminButton, AdminTable, OrderStatusBadge } from "../../../components/admin";`
 *
 * Ver docs/design-panel-admin.md para el contrato completo de props +
 * clases CSS de `admin.module.css`.
 */

export { default as AdminPageHeader } from "./AdminPageHeader";
export type { AdminPageHeaderProps } from "./AdminPageHeader";

export { default as AdminNav } from "./AdminNav";
export type { AdminNavItem, AdminNavProps } from "./AdminNav";

export { default as AdminButton } from "./AdminButton";
export type { AdminButtonProps, AdminButtonVariant, AdminButtonSize } from "./AdminButton";

export {
  AdminBadge,
  OrderStatusBadge,
  PaymentMethodBadge,
  DeliveryMethodBadge,
} from "./AdminBadge";
export type {
  AdminBadgeProps,
  AdminBadgeTone,
  AdminBadgeVariant,
  OrderStatus,
  PaymentMethod,
  DeliveryMethod,
} from "./AdminBadge";

export { default as AdminFilterTabs } from "./AdminFilterTabs";
export type { AdminFilterTabsProps, AdminFilterOption } from "./AdminFilterTabs";

export { default as AdminTable } from "./AdminTable";
export type { AdminTableProps } from "./AdminTable";

export { default as AdminField } from "./AdminField";
export type { AdminFieldProps } from "./AdminField";

export { default as AdminModal } from "./AdminModal";
export type { AdminModalProps, AdminModalTone } from "./AdminModal";

export { default as AdminEmptyState } from "./AdminEmptyState";
export type { AdminEmptyStateProps } from "./AdminEmptyState";

export { default as AdminErrorState } from "./AdminErrorState";
export type { AdminErrorStateProps } from "./AdminErrorState";

export { default as AdminTableSkeleton } from "./AdminTableSkeleton";
export type { AdminTableSkeletonProps } from "./AdminTableSkeleton";
