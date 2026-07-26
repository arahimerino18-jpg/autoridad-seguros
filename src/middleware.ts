/**
 * Autoridad Seguros AI™ — Route Protection Middleware
 *
 * Fixes applied (Phase 17 staging):
 *   1. Checks BOTH onboarding_done AND onboarding_completed (migration 008 compat)
 *   2. Matcher explicitly excludes /api/* to prevent interference with auth callbacks
 *   3. /onboarding excluded from PROTECTED_ROUTES (has its own auth check in page)
 *   4. Strict equality on AUTH_ROUTES to prevent over-matching
 */

import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

// Routes that require a valid session
const PROTECTED_PREFIXES = ['/dashboard', '/brand-builder', '/content-studio',
  '/marketing-copilot', '/objection-ai', '/performance', '/settings',
  '/contenidos', '/precios']

// Auth pages — redirect away if already logged in
const AUTH_EXACT = new Set(['/login', '/register'])

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // CRITICAL: getUser() refreshes the session token via cookies.
  // Never skip this call — it keeps the session alive.
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // ── Rule 1: Protected routes require session ───────────────────────────────
  const isProtected = PROTECTED_PREFIXES.some(p => pathname.startsWith(p))

  if (isProtected && !user) {
    const url = new URL('/login', request.url)
    url.searchParams.set('redirectTo', pathname)
    const res = NextResponse.redirect(url)
    // Copy cookies so session refresh is not lost
    supabaseResponse.cookies.getAll().forEach(cookie => {
      res.cookies.set(cookie.name, cookie.value)
    })
    return res
  }

  // ── Rule 2: Auth pages redirect logged-in users to dashboard ──────────────
  if (AUTH_EXACT.has(pathname) && user) {
    const res = NextResponse.redirect(new URL('/dashboard', request.url))
    supabaseResponse.cookies.getAll().forEach(cookie => {
      res.cookies.set(cookie.name, cookie.value)
    })
    return res
  }

  // ── Rule 3: Dashboard → check onboarding (supports both flag names) ────────
  if (user && pathname === '/dashboard') {
    const { data: profile } = await supabase
      .from('profiles')
      .select('onboarding_done, onboarding_completed')
      .eq('id', user.id)
      .single()

    // Accept either flag — migration 008 added onboarding_completed
    const isComplete = profile?.onboarding_completed || profile?.onboarding_done

    if (profile && !isComplete) {
      const res = NextResponse.redirect(new URL('/onboarding', request.url))
      supabaseResponse.cookies.getAll().forEach(cookie => {
        res.cookies.set(cookie.name, cookie.value)
      })
      return res
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all routes EXCEPT:
     * - _next/static, _next/image (Next.js internals)
     * - favicon.ico, public assets
     * - /api/* (API routes handle their own auth)
     * - /auth/* (Supabase auth callback routes)
     */
    '/((?!_next/static|_next/image|favicon\\.ico|api/|auth/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
