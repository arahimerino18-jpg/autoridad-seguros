'use server'

import { createClient } from '@/lib/supabase/server'
import { stripe, PLAN_PRICES } from './client'
import type { PlanTier } from '@/types/database'

export interface CheckoutParams {
  plan: PlanTier
  ciclo: 'monthly' | 'annual'
}

/**
 * Creates a Stripe Checkout Session and redirects the user to it.
 * Called from pricing page or upgrade modal.
 * Returns the checkout URL instead of redirecting when redirect=false.
 */
export async function createCheckoutSession(
  params: CheckoutParams,
  returnPath = '/dashboard'
): Promise<{ url: string } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  const priceId = PLAN_PRICES[params.plan][params.ciclo]
  if (!priceId) {
    return { error: `Precio no configurado para ${params.plan}/${params.ciclo}. Revisa tus variables de entorno.` }
  }

  // Get or use existing Stripe customer
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .single()

  const sub = subscription as { stripe_customer_id?: string } | null

  // Fetch profile for customer name/email
  const { data: profile } = await supabase
    .from('profiles')
    .select('nombre_completo')
    .eq('id', user.id)
    .single()

  const prof = profile as { nombre_completo?: string } | null

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],

      // Customer
      ...(sub?.stripe_customer_id
        ? { customer: sub.stripe_customer_id }
        : {
            customer_email: user.email,
            customer_creation: 'always',
          }),

      // Critical: pass user_id so webhook can identify the user
      client_reference_id: user.id,

      // Also pass in metadata for redundancy
      subscription_data: {
        metadata: {
          user_id: user.id,
          plan: params.plan,
          ciclo: params.ciclo,
          nombre: prof?.nombre_completo ?? 'Agente',
        },
      },

      // Redirect URLs
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/stripe/checkout-success?session_id={CHECKOUT_SESSION_ID}&return=${returnPath}`,
      cancel_url:  `${process.env.NEXT_PUBLIC_APP_URL}/precios?canceled=1`,

      // Allow promo codes
      allow_promotion_codes: true,

      // Locale
      locale: 'es',
    })

    if (!session.url) return { error: 'Stripe no generó una URL de pago' }
    return { url: session.url }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error al crear sesión de pago'
    console.error('[Stripe] createCheckoutSession error:', msg)
    return { error: msg }
  }
}

/**
 * Creates a Stripe Billing Portal session so the user can manage their subscription.
 */
export async function createBillingPortalSession(
  returnPath = '/dashboard'
): Promise<{ url: string } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .single()

  const sub = subscription as { stripe_customer_id?: string } | null
  if (!sub?.stripe_customer_id) {
    return { error: 'No tienes una suscripción activa para gestionar' }
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}${returnPath}`,
    })
    return { url: session.url }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error al abrir el portal de facturación'
    return { error: msg }
  }
}
