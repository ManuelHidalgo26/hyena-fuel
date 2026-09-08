import { NextResponse } from "next/server";
import { requireSeller } from "../../../../lib/auth/guards";
import { roundMoney } from "../../../../lib/money";
import { CANCELLED_ORDER_STATUS, PAYABLE_ORDER_STATUSES } from "../../../../lib/orders";
import { SELLER_COLUMNS, mapSeller, type SellerRow } from "../../../../lib/sellers";
import { createClient } from "../../../../lib/supabase/server";

/** Base pública del sitio, misma convención que `sitemap.ts` / PDP para armar URLs absolutas. */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://hyenafuel.com";

type SellerOrderRow = {
  status: string;
  total_final: number | string;
  commission_total: number | string;
};

type CommissionPaymentRow = {
  id: string;
  period: string;
  amount: number | string;
  status: string;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
};

type SalesSummary = {
  ordersCount: number;
  totalRevenue: number;
  commissionAccumulated: number;
};

type Settlement = {
  id: string;
  period: string;
  amount: number;
  status: string;
  paidAt: string | null;
  notes: string | null;
  createdAt: string;
};

const PAYABLE_STATUSES: readonly string[] = PAYABLE_ORDER_STATUSES;

/**
 * Resumen del vendedor logueado (ADR 0003): su ficha, código, link de referido, ventas +
 * comisión acumulada y sus liquidaciones. Lee con el cliente de sesión (anon + cookies, no
 * la Admin API): RLS ya restringe cada tabla a `= auth.uid()`, así que el aislamiento entre
 * vendedores queda garantizado a nivel DB además del filtro explícito de acá (defensa en
 * profundidad, mismo criterio que el resto del ADR).
 */
export async function GET() {
  const guard = await requireSeller();
  if (!guard.authorized) return guard.response;

  const supabase = await createClient();
  const sellerId = guard.user.id;

  const { data: sellerRow, error: sellerError } = await supabase
    .from("sellers")
    .select(SELLER_COLUMNS)
    .eq("id", sellerId)
    .maybeSingle()
    .returns<SellerRow | null>();

  if (sellerError) {
    console.error("[GET /api/seller/me] sellers", sellerError);
    return NextResponse.json({ error: "No se pudo obtener tu ficha" }, { status: 500 });
  }
  if (!sellerRow) {
    return NextResponse.json({ error: "Vendedor no encontrado" }, { status: 404 });
  }

  const [ordersResult, settlementsResult] = await Promise.all([
    supabase
      .from("orders")
      .select("status, total_final, commission_total")
      .eq("seller_id", sellerId)
      .returns<SellerOrderRow[]>(),
    supabase
      .from("commission_payments")
      .select("id, period, amount, status, paid_at, notes, created_at")
      .eq("seller_id", sellerId)
      .order("created_at", { ascending: false })
      .returns<CommissionPaymentRow[]>(),
  ]);

  if (ordersResult.error) {
    console.error("[GET /api/seller/me] orders", ordersResult.error);
    return NextResponse.json({ error: "No se pudieron obtener tus ventas" }, { status: 500 });
  }
  if (settlementsResult.error) {
    console.error("[GET /api/seller/me] commission_payments", settlementsResult.error);
    return NextResponse.json({ error: "No se pudieron obtener tus liquidaciones" }, { status: 500 });
  }

  const seller = mapSeller(sellerRow);

  return NextResponse.json({
    seller: { ...seller, email: guard.user.email },
    referralLink: `${SITE_URL}/?ref=${seller.code}`,
    sales: summarizeSales(ordersResult.data ?? []),
    settlements: (settlementsResult.data ?? []).map(mapSettlement),
  });
}

/** Ventas = toda orden no cancelada; comisión acumulada = solo la de órdenes ya "ganadas" (ADR 0002 #5). */
function summarizeSales(orders: SellerOrderRow[]): SalesSummary {
  const summary = orders.reduce(
    (acc, order) => {
      if (order.status === CANCELLED_ORDER_STATUS) return acc;

      acc.ordersCount += 1;
      acc.totalRevenue += Number(order.total_final);
      if (PAYABLE_STATUSES.includes(order.status)) {
        acc.commissionAccumulated += Number(order.commission_total);
      }
      return acc;
    },
    { ordersCount: 0, totalRevenue: 0, commissionAccumulated: 0 }
  );

  return {
    ordersCount: summary.ordersCount,
    totalRevenue: roundMoney(summary.totalRevenue),
    commissionAccumulated: roundMoney(summary.commissionAccumulated),
  };
}

function mapSettlement(row: CommissionPaymentRow): Settlement {
  return {
    id: row.id,
    period: row.period,
    amount: roundMoney(Number(row.amount)),
    status: row.status,
    paidAt: row.paid_at,
    notes: row.notes,
    createdAt: row.created_at,
  };
}
