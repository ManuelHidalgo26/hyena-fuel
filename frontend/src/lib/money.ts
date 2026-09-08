/** Redondea a centavos, evitando arrastrar errores de punto flotante en los totales. */
export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
