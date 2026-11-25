import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Verify the signed JWT locally via JWKS and refresh expired tokens when needed.
  const { data: verified, error } = await supabase.auth.getClaims();

  const claims = error ? null : verified?.claims;
  const user =
    claims && typeof claims.sub === 'string'
      ? {
          id: claims.sub,
          email: typeof claims.email === 'string' ? claims.email : undefined,
          app_metadata: (claims.app_metadata as Record<string, unknown> | undefined) ?? {},
          user_metadata: (claims.user_metadata as Record<string, unknown> | undefined) ?? {},
        }
      : null;

  supabaseResponse.headers.set('Cache-Control', 'private, no-store');

  return { supabaseResponse, user };
}
