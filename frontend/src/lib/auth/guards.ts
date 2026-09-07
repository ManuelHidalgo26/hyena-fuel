import "server-only";
import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createClient } from "../supabase/server";

/** Roles válidos de la app (ADR 0003). Viven en `app_metadata.role`, no editable por el usuario. */
export type AppRole = "admin" | "seller";

export type SessionUser = {
  id: string;
  email: string;
  role: AppRole | null;
};

function toAppRole(value: unknown): AppRole | null {
  return value === "admin" || value === "seller" ? value : null;
}

function toSessionUser(user: User): SessionUser {
  return {
    id: user.id,
    email: user.email ?? "",
    role: toAppRole(user.app_metadata?.role),
  };
}

/**
 * Devuelve el usuario autenticado (id, email, rol de `app_metadata`) o `null`
 * si no hay sesión válida. Usa `getUser()` (no `getSession()`): revalida
 * contra el servidor de Supabase Auth en vez de confiar en el JWT de la
 * cookie sin verificar. Pensado para Server Components y Route Handlers.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;

  return toSessionUser(user);
}

export type AdminGuardResult =
  | { authorized: true; user: SessionUser }
  | { authorized: false; response: NextResponse };

/**
 * Guard para Route Handlers del panel admin (`src/app/api/admin/**`).
 * Re-verifica sesión + rol server-side (defensa en profundidad además del
 * middleware y de RLS, ADR 0003). Uso:
 *
 *   const guard = await requireAdmin();
 *   if (!guard.authorized) return guard.response;
 *   // guard.user.id / guard.user.email disponibles acá
 */
export async function requireAdmin(): Promise<AdminGuardResult> {
  const user = await getSessionUser();

  if (!user) {
    return {
      authorized: false,
      response: NextResponse.json({ error: "No autenticado" }, { status: 401 }),
    };
  }

  if (user.role !== "admin") {
    return {
      authorized: false,
      response: NextResponse.json({ error: "No autorizado" }, { status: 403 }),
    };
  }

  return { authorized: true, user };
}

export type SellerGuardResult =
  | { authorized: true; user: SessionUser }
  | { authorized: false; response: NextResponse };

/**
 * Guard para Route Handlers del portal vendedor (`src/app/api/seller/**`).
 * Mismo patrón que `requireAdmin()`: re-verifica sesión + rol server-side
 * (defensa en profundidad además del middleware y de RLS, ADR 0003).
 */
export async function requireSeller(): Promise<SellerGuardResult> {
  const user = await getSessionUser();

  if (!user) {
    return {
      authorized: false,
      response: NextResponse.json({ error: "No autenticado" }, { status: 401 }),
    };
  }

  if (user.role !== "seller") {
    return {
      authorized: false,
      response: NextResponse.json({ error: "No autorizado" }, { status: 403 }),
    };
  }

  return { authorized: true, user };
}
