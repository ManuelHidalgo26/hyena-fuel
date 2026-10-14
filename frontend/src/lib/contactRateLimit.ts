const NATIONAL_NUMBER_LENGTH = 10;
const COUNTRY_CODE = "54";
const MOBILE_PREFIX = "15";
const AREA_CODE_LENGTHS = [2, 3, 4];

/**
 * Número nacional argentino canónico (10 dígitos: área + abonado) o `null` si no se puede
 * canonicalizar. Quita 00 internacional, 54, 9 de móvil, 0 troncal y el 15 de móvil, para que
 * variantes de formato del mismo teléfono den la misma clave.
 */
export function canonicalPhone(raw: string): string | null {
  let digits = raw.replace(/\D/g, "").replace(/^00/, "");
  if (digits.startsWith(COUNTRY_CODE) && digits.length > NATIONAL_NUMBER_LENGTH)
    digits = digits.slice(COUNTRY_CODE.length);
  if (digits.startsWith("9") && digits.length > NATIONAL_NUMBER_LENGTH)
    digits = digits.slice(1);
  if (digits.startsWith("0") && digits.length > NATIONAL_NUMBER_LENGTH)
    digits = digits.slice(1);
  if (digits.length === NATIONAL_NUMBER_LENGTH + MOBILE_PREFIX.length)
    digits = removeMobilePrefix(digits);

  return digits.length === NATIONAL_NUMBER_LENGTH ? digits : null;
}

function removeMobilePrefix(digits: string): string {
  const areaLength = AREA_CODE_LENGTHS.find(
    (length) =>
      digits.slice(length, length + MOBILE_PREFIX.length) === MOBILE_PREFIX,
  );
  return areaLength === undefined
    ? digits
    : digits.slice(0, areaLength) +
        digits.slice(areaLength + MOBILE_PREFIX.length);
}

/**
 * Claves de rate limit por contacto del pedido. Se combinan con la IP a propósito: una clave
 * solo por teléfono/email permitiría a un tercero bloquear a otra persona enviando pedidos con
 * sus datos. El tope fuerte contra IPs que rotan sigue siendo el de IP. El teléfono que no
 * canonicaliza no genera clave; el email se normaliza con trim + minúsculas.
 */
export function contactRateLimitKeys(
  customer: { customerPhone: string; customerEmail?: string },
  ip: string,
): string[] {
  const keys: string[] = [];
  const phone = canonicalPhone(customer.customerPhone);
  if (phone) keys.push(`create-order-phone:${phone}:${ip}`);
  const email = customer.customerEmail?.trim().toLowerCase();
  if (email) keys.push(`create-order-email:${email}:${ip}`);
  return keys;
}
