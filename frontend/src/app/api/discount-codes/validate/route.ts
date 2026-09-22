import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { resolveDiscountCode } from "../../../../lib/discountCodes";
import { roundMoney } from "../../../../lib/money";
import { getClientIp, isRateLimited } from "../../../../lib/rateLimit";
import {
  calculatePricingBreakdown,
  mergeLineItemsByProduct,
  orderItemSchema,
  MAX_ITEMS_PER_ORDER,
  type OrderLineItem,
  type PriceableLine,
} from "../../../../lib/orders";

type AdminClient = ReturnType<typeof createAdminClient>;

/** Rate-limit mínimo por IP (spec §9 / QA-4): freno a la enumeración de códigos, no una solución robusta. */
const RATE_LIMIT_MAX_REQUESTS = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MESSAGE = "Probá de nuevo en unos minutos";

const validateRequestSchema = z.object({
  code: z.string().trim().min(1, "Falta el código").max(32),
  items: z
    .array(orderItemSchema)
    .min(1, "El carrito está vacío")
    .max(MAX_ITEMS_PER_ORDER, `El carrito admite hasta ${MAX_ITEMS_PER_ORDER} productos distintos`),
  paymentMethod: z.enum(["transferencia", "mercadopago"]),
  deliveryMethod: z.enum(["envio", "retiro"]).default("envio"),
});

type ValidateInput = z.infer<typeof validateRequestSchema>;

type PricingProductRow = {
  id: string;
  price: number | string;
  transfer_price: number | string | null;
};

/**
 * Previsualización de un cupón sobre el carrito actual (ADR 0010 §5.1): recalcula el
 * descuento SERVER-SIDE (no confía en precios del cliente) y NO incrementa `uses_count` —
 * el canje real ocurre recién en `POST /api/orders`. Siempre responde 200 salvo error
 * inesperado o rate-limit: el `valid:false` con motivo genérico va en el body (spec §9,
 * evita filtrar por status code si un código existe o no).
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  if (isRateLimited(`discount-codes:validate:${ip}`, RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_MS)) {
    return NextResponse.json({ error: RATE_LIMIT_MESSAGE }, { status: 429 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = validateRequestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    return await buildValidationResponse(parsed.data);
  } catch (error) {
    console.error("[POST /api/discount-codes/validate]", error);
    return NextResponse.json({ error: "No se pudo validar el código" }, { status: 500 });
  }
}

async function buildValidationResponse(input: ValidateInput): Promise<NextResponse> {
  const supabase = createAdminClient();
  const mergedItems = mergeLineItemsByProduct(input.items);

  const productsById = await fetchPricingProducts(supabase, mergedItems);
  const missingProduct = mergedItems.find((item) => !productsById.has(item.productId));
  if (missingProduct) {
    return NextResponse.json(
      { error: `El producto ${missingProduct.productId} no existe` },
      { status: 400 }
    );
  }

  const lines: PriceableLine[] = mergedItems.map((item) => {
    // `missingProduct` ya descartó los `undefined`; el `!` es seguro acá.
    const product = productsById.get(item.productId)!;
    return { unitPrice: product.price, transferPrice: product.transferPrice, quantity: item.quantity };
  });

  const listSubtotal = roundMoney(lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0));

  const resolution = await resolveDiscountCode(supabase, input.code, listSubtotal);
  if (!resolution.ok) {
    return NextResponse.json({ valid: false, reason: resolution.reason });
  }

  const breakdown = calculatePricingBreakdown(
    lines,
    input.paymentMethod,
    input.deliveryMethod,
    resolution.coupon
  );

  return NextResponse.json({
    valid: true,
    code: resolution.coupon.code,
    discountType: resolution.coupon.type,
    discountValue: resolution.coupon.value,
    discountAmount: breakdown.couponDiscount,
    newTotal: breakdown.totalFinal,
  });
}

/** Precios de lista/transferencia de productos ACTIVOS (nunca `cost`/comisión: es un endpoint público). */
async function fetchPricingProducts(
  supabase: AdminClient,
  items: OrderLineItem[]
): Promise<Map<string, { price: number; transferPrice: number | null }>> {
  const productIds = Array.from(new Set(items.map((item) => item.productId)));

  const { data, error } = await supabase
    .from("products")
    .select("id, price, transfer_price")
    .in("id", productIds)
    .eq("active", true)
    .returns<PricingProductRow[]>();

  if (error) {
    throw new Error(`Error al obtener productos: ${error.message}`);
  }

  const productsById = new Map<string, { price: number; transferPrice: number | null }>();
  for (const row of data ?? []) {
    productsById.set(row.id, {
      price: roundMoney(Number(row.price)),
      transferPrice: row.transfer_price === null ? null : Number(row.transfer_price),
    });
  }

  return productsById;
}
