import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabasePublicEnv } from "./lib/supabase/env";

const LOGIN_PATH = "/panel/login";
const PANEL_HOME_PATH = "/panel";

/** Único rol con acceso hoy a `/panel/**` (ADR 0003). El portal de vendedor
 *  (`/panel/vendedor/**`, rol `seller`) es una parte siguiente: como esa
 *  subruta todavía no existe, un `seller` autenticado tampoco tiene a dónde
 *  entrar bajo `/panel` y se lo trata igual que a un rol no permitido. */
const ALLOWED_PANEL_ROLE = "admin";

/**
 * Refresca la sesión de Supabase (patrón oficial `@supabase/ssr` para
 * middleware) y protege `/panel/**` (ADR 0003):
 *
 * - Sin sesión y no está en `/panel/login` → redirect a `/panel/login`.
 * - Con sesión pero sin rol permitido (no `admin`) → redirect a
 *   `/panel/login?error=forbidden` (no se le da acceso).
 * - En `/panel/login` con sesión de `admin` ya válida → redirect a `/panel`
 *   (evita que un `admin` logueado vea el form de login de nuevo). Si la
 *   sesión no es de `admin`, se deja ver `/panel/login` igual (evita un
 *   ping-pong de redirects contra el caso anterior).
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

  const isAdmin = user?.app_metadata?.role === ALLOWED_PANEL_ROLE;
  const isLoginPath = request.nextUrl.pathname === LOGIN_PATH;

  if (isLoginPath) {
    return isAdmin ? redirectTo(request, PANEL_HOME_PATH) : response;
  }

  if (!user) {
    return redirectTo(request, LOGIN_PATH);
  }

  if (!isAdmin) {
    return redirectTo(request, LOGIN_PATH, "error=forbidden");
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
