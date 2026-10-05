"use client";

import { useSyncExternalStore } from "react";

// No hay ningún store externo al que suscribirse: solo usamos
// useSyncExternalStore para distinguir el snapshot de servidor del de
// cliente, así que el listener nunca se dispara.
const subscribeNever = () => () => {};

/**
 * Evita el mismatch de hidratación cuando un componente depende de
 * localStorage (que no existe en el render del servidor). useSyncExternalStore
 * es el patrón recomendado para esto: no se suscribe a nada (no hay updates
 * que escuchar), pero React sabe que debe re-renderizar tras hidratar para
 * reconciliar getServerSnapshot (false) con getClientSnapshot (true), sin
 * pasar por un setState dentro de un efecto.
 */
export function useHydrated() {
  return useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false
  );
}
