import { notFound } from "next/navigation";

// Cualquier URL que no matchee otra ruta cae acá y dispara el `not-found.tsx`
// de (store): 404 con la marca, navbar y footer en vez de la página genérica
// de Next (el not-found de un route group solo aplica a `notFound()` explícito).
export default function CatchAllNotFound() {
  notFound();
}
