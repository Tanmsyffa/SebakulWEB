import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Routes that require authentication
const PROTECTED_PREFIXES = ["/warung", "/sentra", "/admin", "/guyub", "/dukungan", "/profil"];
const REGISTRATION_PATHS = ["/register", "/registrasi", "/regis", "/signup", "/sign-up", "/auth/register", "/auth/signup"];

function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isRegistrationRoute = REGISTRATION_PATHS.some(route => pathname === route || pathname.startsWith(`${route}/`));
  const isLoginRoute = pathname === "/login";

  // Public registration is deliberately disabled. Route every common signup
  // URL to login, where signed-in users are redirected to their dashboard.
  if (isRegistrationRoute) {
    const loginUrl = new URL("/login?error=registration_disabled", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Only private application routes need session refresh/validation. Avoid an
  // Auth network request for public pages, assets, and unrelated routes.
  if (!isProtectedRoute(pathname) && !isLoginRoute) {
    return NextResponse.next();
  }

  const { supabaseResponse, user } = await updateSession(request);

  // The server login page checks that the account is active and has an app
  // role before redirecting. This avoids redirect loops for roleless accounts.
  if (isLoginRoute) return supabaseResponse;

  // Protect dashboard routes: redirect to login if no session
  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (user.app_metadata?.must_change_password === true) {
    return NextResponse.redirect(new URL("/auth/change", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public assets (svg, png, jpg, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
