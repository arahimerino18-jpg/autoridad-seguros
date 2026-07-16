import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe/client'

/**
 * GET /api/stripe/checkout-success
 *
 * Called by Stripe after successful checkout (success_url redirect).
 * Does NOT activate the subscription — that is done by the webhook.
 * Only validates the session exists and redirects to the correct page.
 *
 * Why not activate here?
 * - The redirect can fail (user closes tab)
 * - The webhook is the authoritative source (runs server-to-server)
 * - Activating in both places would require duplicate idempotency logic
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('session_id')
  const returnPath = searchParams.get('return') ?? '/dashboard'

  if (!sessionId) {
    return NextResponse.redirect(new URL('/dashboard?payment=error', request.url))
  }

  try {
    // Validate session exists in Stripe (not spoofed)
    const session = await stripe.checkout.sessions.retrieve(sessionId)

    if (session.payment_status === 'paid' || session.status === 'complete') {
      // Redirect with success indicator — dashboard shows a toast
      return NextResponse.redirect(
        new URL(`${returnPath}?payment=success&plan=${session.metadata?.plan ?? ''}`, request.url)
      )
    }

    return NextResponse.redirect(new URL(`${returnPath}?payment=pending`, request.url))
  } catch {
    // Session not found or expired
    return NextResponse.redirect(new URL('/dashboard?payment=error', request.url))
  }
}
