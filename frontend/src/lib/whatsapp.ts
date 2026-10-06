/**
 * Normaliza un teléfono argentino cargado a mano al formato que espera `wa.me`
 * (solo dígitos, con código de país 54 y el 9 de celular). Devuelve `null` si no
 * se puede armar un número razonable — en ese caso se abre WhatsApp sin destinatario
 * y el admin elige el contacto.
 *
 * - "351 915-2450"        → "5493519152450"
 * - "0351 15 915-2450"    → "5493519152450" (saca el 0 de larga distancia y el 15)
 * - "+54 9 351 915 2450"  → "5493519152450"
 * - "123"                 → null
 */
export function toWhatsAppNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;

  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("54")) digits = digits.slice(2);
  if (digits.startsWith("9")) digits = digits.slice(1);
  if (digits.startsWith("0")) digits = digits.slice(1);

  // Área (2-4 dígitos) + "15" + número local: el 15 sobra en el formato internacional.
  const withFifteen = digits.match(/^(\d{2,4})15(\d{6,8})$/);
  if (withFifteen && withFifteen[1].length + withFifteen[2].length === 10) {
    digits = withFifteen[1] + withFifteen[2];
  }

  return digits.length === 10 ? `549${digits}` : null;
}

/** Link `wa.me` con el mensaje precargado, con o sin destinatario. */
export function buildWhatsAppLink(message: string, phone?: string | null): string {
  const number = toWhatsAppNumber(phone);
  const text = encodeURIComponent(message);
  return number ? `https://wa.me/${number}?text=${text}` : `https://wa.me/?text=${text}`;
}
