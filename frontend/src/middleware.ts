import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabasePublicEnv } from "./lib/supabase/env";

const LOGIN_PATH = "/panel/login";
const ADMIN_HOME_PATH = "/panel";
/** Portal del vendedor (ADR 0003): única zona de `/panel/**` habilitada para el rol `seller`. */
const SELLER_HOME_PATH = "/panel/vendedor";

/**
 * Refresca la sesión de Supabase (patrón oficial `@supabase/ssr` para
 * middleware) y protege `/panel/**` por rol (ADR 0003):
 *
 * - Sin sesión y no está en `/panel/login` → redirect a `/panel/login`.
 * - `admin` → todo `/panel/**` salvo el portal del vendedor (lo manda a
 *   `/panel/vendedores`, su vista de gestión).
 * - `seller` → solo `/panel/vendedor/**`; cualquier otra ruta del panel lo
 *   devuelve a su portal.
 * - Otro rol (o ninguno) → `/panel/login?error=forbidden`.
 * - En `/panel/login` con sesión válida de admin/seller → a su home (evita
 *   ver el form de nuevo). Con otro rol se deja ver el login (sin ping-pong).
 *
 * Esta es la primera barrera (UX). Cada Route Handler privado se re-verifica
 * server-side con `lib/auth/guards.ts` y RLS es la última línea de defensa
 * en la base de datos — no hay que confiar solo en este middleware.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, anonKey } = getSupabasePublicEnv();

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // `getUser()` (no `getSession()`): revalida el usuario contra Supabase Auth
  // en vez de confiar ciegamente en el JWT que trae la cookie.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const role = user?.app_metadata?.role;
  const homePath = role === "admin" ? ADMIN_HOME_PATH : role === "seller" ? SELLER_HOME_PATH : null;
  const { pathname } = request.nextUrl;

  if (pathname === LOGIN_PATH) {
    return homePath ? redirectTo(request, homePath) : response;
  }

  if (!user) {
    return redirectTo(request, LOGIN_PATH);
  }

  if (!homePath) {
    return redirectTo(request, LOGIN_PATH, "error=forbidden");
  }

  const isSellerArea = pathname === SELLER_HOME_PATH || pathname.startsWith(`${SELLER_HOME_PATH}/`);

  if (role === "seller" && !isSellerArea) {
    return redirectTo(request, SELLER_HOME_PATH);
  }

  if (role === "admin" && isSellerArea) {
    return redirectTo(request, "/panel/vendedores");
  }

  return response;
}

function redirectTo(request: NextRequest, pathname: string, search = ""): NextResponse {
  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = pathname;
  redirectUrl.search = search;
  return NextResponse.redirect(redirectUrl);
}

export const config = {
  matcher: ["/panel/:path*"],
};
