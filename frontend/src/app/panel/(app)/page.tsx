import { redirect } from "next/navigation";

/** `/panel` no tiene vista propia: redirige a la primera sección (Pedidos). */
export default function PanelIndexPage() {
  redirect("/panel/pedidos");
}
