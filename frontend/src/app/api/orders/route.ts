import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "../../../lib/auth/guards";
import { createAdminClient } from "../../../lib/supabase/admin";
import {
  calculateOrderTotals,
  freezeOrderItems,
  mergeLineItemsByProduct,
  type DeliveryMethod,
  type FrozenOrderItem,
  type OrderLineItem,
  type OrderProductInput,
  type OrderSellerInput,
  type PaymentMethod,
} from "../../../lib/orders";

type AdminClient = ReturnType<typeof createAdminClient>;

/** Cotas anti-abuso (QA-3): un carrito legítimo nunca necesita más que esto. */
const MAX_QUANTITY_PER_ITEM = 100;
const MAX_ITEMS_PER_ORDER = 50;

/** SQLSTATE que usa la RPC `create_order` para el único error de negocio que debe volver 400. */
const INSUFFICIENT_STOCK_ERROR_CODE = "HY001";

const orderItemSchema = z.object({
  productId: z.uuid("productId inválido"),
  quantity: z
    .number()
    .int("La cantidad debe ser un número entero")
    .positive("La cantidad debe ser mayor a 0")
    .max(MAX_QUANTITY_PER_ITEM, `La cantidad máxima por producto es ${MAX_QUANTITY_PER_ITEM}`),
});

const createOrderSchema = z
  .object({
    items: z
      .array(orderItemSchema)
      .min(1, "El carrito está vacío")
      .max(MAX_ITEMS_PER_ORDER, `El carrito admite hasta ${MAX_ITEMS_PER_ORDER} productos distintos`),
    customerName: z.string().trim().min(1, "Falta el nombre"),
    customerEmail: z.email("Email inválido").optional(),
    customerPhone: z.string().trim().min(1).optional(),
    customerAddress: z.string().trim().min(1).optional(),
    paymentMethod: z.enum(["transferencia", "mercadopago"]),
    deliveryMethod: z.enum(["envio", "retiro"]).default("envio"),
    sellerCode: z.string().trim().min(1).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.deliveryMethod === "envio" && !data.customerAddress) {
      ctx.addIssue({
        code: "custom",
        path: ["customerAddress"],
        message: "Falta la dirección de envío",
      });
    }
    if (!data.customerEmail && !data.customerPhone) {
      ctx.addIssue({
        code: "custom",
        path: ["customerPhone"],
        message: "Dejá un email o un teléfono de contacto",
      });
    }
  });

type CreateOrderInput = z.infer<typeof createOrderSchema>;

type ProductRow = {
  id: string;
  name: string;
  price: number | string;
  transfer_price: number | string | null;
  cost: number | string;
  stock: number;
  active: boolean;
  commission_override_pct: number | string | null;
  commission_override_amount: number | string | null;
};

type ValidatedProduct = OrderProductInput & { stock: number; active: boolean };

type SellerRow = {
  id: string;
  default_commission_pct: number | string;
};

type OrderRow = {
  id: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  payment_method: string;
  delivery_method: string;
  status: string;
  subtotal: number | string;
  discount: number | string;
  shipping_cost: number | string;
  total_final: number | string;
  seller_id: string | null;
  commission_total: number | string;
  created_at: string;
};

export async function POST(request: NextRequest) {
  const parsed = await parseCreateOrderBody(request);
  if (!parsed.ok) return parsed.response;

  try {
    return await createOrder(parsed.data);
  } catch (error) {
    console.error("[POST /api/orders]", error);
    return NextResponse.json({ error: "No se pudo crear el pedido" }, { status: 500 });
  }
}

/** Columnas de `orders` + `order_items` embebidos, para el listado admin (todos los campos de negocio). */
const ADMIN_ORDER_COLUMNS =
  "id, customer_name, customer_email, customer_phone, customer_address, payment_method, delivery_method, status, subtotal, discount, shipping_cost, total_final, seller_id, attribution_source, commission_total, created_at, order_items(id, product_id, name, quantity, unit_price, unit_cost, unit_commission)";

type AdminOrderItemRow = {
  id: string;
  product_id: string | null;
  name: string;
  quantity: number;
  unit_price: number | string;
  unit_cost: number | string;
  unit_commission: number | string;
};

type AdminOrderRow = {
  id: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  payment_method: string;
  delivery_method: string;
  status: string;
  subtotal: number | string;
  discount: number | string;
  shipping_cost: number | string;
  total_final: number | string;
  seller_id: string | null;
  attribution_source: string | null;
  commission_total: number | string;
  created_at: string;
  order_items: AdminOrderItemRow[];
};

/** Listado completo de órdenes para el panel admin, con totales, comisión y vendedor. */
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.authorized) return guard.response;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("orders")
    .select(ADMIN_ORDER_COLUMNS)
    .order("created_at", { ascending: false })
    .returns<AdminOrderRow[]>();

  if (error) {
    console.error("[GET /api/orders]", error);
    return NextResponse.json({ error: "No se pudieron obtener los pedidos" }, { status: 500 });
  }

  return NextResponse.json((data ?? []).map(mapAdminOrder));
}

function mapAdminOrder(order: AdminOrderRow) {
  return {
    _id: order.id,
    customerName: order.customer_name,
    customerEmail: order.customer_email,
    customerPhone: order.customer_phone,
    customerAddress: order.customer_address,
    paymentMethod: order.payment_method,
    deliveryMethod: order.delivery_method,
    status: order.status,
    subtotal: Number(order.subtotal),
    discount: Number(order.discount),
    shippingCost: Number(order.shipping_cost),
    totalFinal: Number(order.total_final),
    sellerId: order.seller_id,
    attributionSource: order.attribution_source,
    commissionTotal: Number(order.commission_total),
    createdAt: order.created_at,
    items: order.order_items.map((item) => ({
      productId: item.product_id,
      name: item.name,
      quantity: item.quantity,
      unitPrice: Number(item.unit_price),
      unitCost: Number(item.unit_cost),
      unitCommission: Number(item.unit_commission),
    })),
  };
}

async function createOrder(input: CreateOrderInput): Promise<NextResponse> {
  const supabase = createAdminClient();
  const { items, sellerCode, paymentMethod, deliveryMethod, ...customer } = input;
  const mergedItems = mergeLineItemsByProduct(items);

  const productsById = await fetchProducts(supabase, mergedItems);
  const validationError = validateStockAndActive(mergedItems, productsById);
  if (validationError) return validationError;

  const seller = sellerCode ? await findActiveSeller(supabase, sellerCode) : null;
  const frozenItems = freezeOrderItems(mergedItems, productsById, seller);
  const totals = calculateOrderTotals(frozenItems, productsById, paymentMethod, deliveryMethod);

  const persisted = await persistOrder(
    supabase,
    { customer, paymentMethod, deliveryMethod, seller, totals },
    frozenItems
  );
  if (!persisted.ok) return persisted.response;

  return NextResponse.json(mapOrderResponse(persisted.order, frozenItems), { status: 201 });
}

type ParsedBody =
  | { ok: true; data: CreateOrderInput }
  | { ok: false; response: NextResponse };

async function parseCreateOrderBody(request: NextRequest): Promise<ParsedBody> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return { ok: false, response: NextResponse.json({ error: "JSON inválido" }, { status: 400 }) };
  }

  const result = createOrderSchema.safeParse(json);
  if (!result.success) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Datos de pedido inválidos", details: result.error.flatten() },
        { status: 400 }
      ),
    };
  }

  return { ok: true, data: result.data };
}

async function fetchProducts(
  supabase: AdminClient,
  items: OrderLineItem[]
): Promise<Map<string, ValidatedProduct>> {
  const productIds = items.map((item) => item.productId);

  const { data, error } = await supabase
    .from("products")
    .select(
      "id, name, price, transfer_price, cost, stock, active, commission_override_pct, commission_override_amount"
    )
    .in("id", productIds)
    .returns<ProductRow[]>();

  if (error) {
    throw new Error(`Error al obtener productos: ${error.message}`);
  }

  const productsById = new Map<string, ValidatedProduct>();
  for (const row of data ?? []) {
    productsById.set(row.id, {
      id: row.id,
      name: row.name,
      price: Number(row.price),
      transferPrice: row.transfer_price === null ? null : Number(row.transfer_price),
      cost: Number(row.cost),
      stock: row.stock,
      active: row.active,
      commissionOverridePct:
        row.commission_override_pct === null ? null : Number(row.commission_override_pct),
      commissionOverrideAmount:
        row.commission_override_amount === null ? null : Number(row.commission_override_amount),
    });
  }

  return productsById;
}

function validateStockAndActive(
  items: OrderLineItem[],
  productsById: Map<string, ValidatedProduct>
): NextResponse | null {
  for (const item of items) {
    const product = productsById.get(item.productId);

    if (!product) {
      return NextResponse.json(
        { error: `El producto ${item.productId} no existe` },
        { status: 400 }
      );
    }
    if (!product.active) {
      return NextResponse.json(
        { error: `"${product.name}" ya no está disponible` },
        { status: 400 }
      );
    }
    if (product.stock < item.quantity) {
      return NextResponse.json(
        { error: `Stock insuficiente de "${product.name}"` },
        { status: 400 }
      );
    }
  }

  return null;
}

async function findActiveSeller(
  supabase: AdminClient,
  code: string
): Promise<OrderSellerInput | null> {
  const { data, error } = await supabase
    .from("sellers")
    .select("id, default_commission_pct")
    .eq("code", code)
    .eq("active", true)
    .maybeSingle()
    .returns<SellerRow | null>();

  if (error || !data) return null;

  return { id: data.id, defaultCommissionPct: Number(data.default_commission_pct) };
}

type InsertOrderArgs = {
  customer: {
    customerName: string;
    customerEmail?: string;
    customerPhone?: string;
    customerAddress?: string;
  };
  paymentMethod: PaymentMethod;
  deliveryMethod: DeliveryMethod;
  seller: OrderSellerInput | null;
  totals: ReturnType<typeof calculateOrderTotals>;
};

/** Shape del elemento de `p_items` que espera la RPC `create_order` (snake_case, columnas de `order_items`). */
type RpcOrderItem = {
  product_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  unit_cost: number;
  unit_commission: number;
};

type PersistOrderResult =
  | { ok: true; order: OrderRow }
  | { ok: false; response: NextResponse };

/**
 * Persiste la orden llamando a la RPC `create_order` (`supabase/migrations/0003_create_order_rpc.sql`).
 * La función descuenta stock de forma atómica (`update ... where stock >= qty`) e inserta
 * `orders` + `order_items` en una única transacción: sin condición de carrera (QA-1) y sin
 * necesidad de un rollback manual si algo falla a mitad de camino (QA-7).
 */
async function persistOrder(
  supabase: AdminClient,
  args: InsertOrderArgs,
  items: FrozenOrderItem[]
): Promise<PersistOrderResult> {
  const { customer, paymentMethod, deliveryMethod, seller, totals } = args;

  const rpcItems: RpcOrderItem[] = items.map((item) => ({
    product_id: item.productId,
    name: item.name,
    quantity: item.quantity,
    unit_price: item.unitPrice,
    unit_cost: item.unitCost,
    unit_commission: item.unitCommission,
  }));

  const { data, error } = await supabase
    .rpc("create_order", {
      p_customer_name: customer.customerName,
      p_customer_email: customer.customerEmail ?? null,
      p_customer_phone: customer.customerPhone ?? null,
      p_customer_address: customer.customerAddress ?? null,
      p_payment_method: paymentMethod,
      p_delivery_method: deliveryMethod,
      p_subtotal: totals.subtotal,
      p_discount: totals.discount,
      p_shipping_cost: totals.shippingCost,
      p_total_final: totals.totalFinal,
      p_seller_id: seller?.id ?? null,
      p_attribution_source: seller ? "manual" : null,
      p_commission_total: totals.commissionTotal,
      p_items: rpcItems,
    })
    .single()
    .returns<OrderRow>();

  if (error) {
    if (error.code === INSUFFICIENT_STOCK_ERROR_CODE) {
      return { ok: false, response: NextResponse.json({ error: error.message }, { status: 400 }) };
    }
    console.error("[POST /api/orders] rpc create_order", error);
    return {
      ok: false,
      response: NextResponse.json({ error: "No se pudo crear el pedido" }, { status: 500 }),
    };
  }

  if (!data) {
    return {
      ok: false,
      response: NextResponse.json({ error: "No se pudo crear el pedido" }, { status: 500 }),
    };
  }

  return { ok: true, order: data };
}

/** Shape de respuesta compatible con lo que hoy consume el front (`order._id`, totales numéricos). */
function mapOrderResponse(order: OrderRow, items: FrozenOrderItem[]) {
  return {
    _id: order.id,
    customerName: order.customer_name,
    customerEmail: order.customer_email,
    customerPhone: order.customer_phone,
    customerAddress: order.customer_address,
    paymentMethod: order.payment_method,
    deliveryMethod: order.delivery_method,
    status: order.status,
    subtotal: Number(order.subtotal),
    discount: Number(order.discount),
    shippingCost: Number(order.shipping_cost),
    totalFinal: Number(order.total_final),
    createdAt: order.created_at,
    items: items.map((item) => ({
      productId: item.productId,
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    })),
  };
}
