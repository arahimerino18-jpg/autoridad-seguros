import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { stripe, getPlanFromPriceId, GRACE_PERIOD_DAYS } from '@/lib/stripe/client'
import { createAdminClient } from '@/lib/supabase/admin'
import type { PlanTier } from '@/types/database'

// ─── Types ────────────────────────────────────────────────────────────────────

interface WebhookContext {
  supabase: ReturnType<typeof createAdminClient>
  eventId: string
  eventType: string
}

// ─── Idempotency check ────────────────────────────────────────────────────────

async function isEventAlreadyProcessed(
  supabase: ReturnType<typeof createAdminClient>,
  eventId: string
): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('stripe_webhook_events')
    .select('id')
    .eq('stripe_event_id', eventId)
    .single()
  return !!data
}

async function logWebhookEvent(
  ctx: WebhookContext,
  status: 'processed' | 'failed' | 'ignored',
  userId: string | null,
  summary: Record<string, unknown>,
  errorMessage?: string
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (ctx.supabase as any)
    .from('stripe_webhook_events')
    .insert({
      stripe_event_id: ctx.eventId,
      event_type: ctx.eventType,
      status,
      user_id: userId ?? null,
      error_message: errorMessage ?? null,
      payload_summary: summary,
    })
}

// ─── User resolution ──────────────────────────────────────────────────────────
// Tries to find user_id from multiple places in the event payload.
// Order: client_reference_id > subscription.metadata > customer email lookup

async function resolveUserId(
  supabase: ReturnType<typeof createAdminClient>,
  session?: Stripe.Checkout.Session,
  subscription?: Stripe.Subscription,
  customerId?: string
): Promise<string | null> {
  // 1. client_reference_id set during checkout (most reliable)
  if (session?.client_reference_id) {
    return session.client_reference_id
  }

  // 2. Subscription metadata
  const meta = subscription?.metadata ?? session?.metadata
  if (meta?.user_id) return meta.user_id

  // 3. Look up by stripe_customer_id in subscriptions table
  if (customerId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from('subscriptions')
      .select('user_id')
      .eq('stripe_customer_id', customerId)
      .single()
    if (data?.user_id) return data.user_id
  }

  // 4. Look up by email in profiles
  const email = session?.customer_details?.email
  if (email) {
    const adminAuthClient = supabase.auth.admin
    const { data } = await adminAuthClient.listUsers()
    const user = data?.users?.find((u: { email?: string }) => u.email === email)
    if (user?.id) return user.id
  }

  return null
}

// ─── Event handlers ───────────────────────────────────────────────────────────

async function handleCheckoutCompleted(
  ctx: WebhookContext,
  session: Stripe.Checkout.Session
): Promise<void> {
  const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id ?? ''
  const subscriptionId = typeof session.subscription === 'string'
    ? session.subscription
    : session.subscription?.id ?? null

  const userId = await resolveUserId(ctx.supabase, session, undefined, customerId)
  if (!userId) {
    await logWebhookEvent(ctx, 'failed', null, { customerId, subscriptionId }, 'Could not resolve user_id from checkout session')
    await logWebhookEvent(ctx, 'processed', null, { reason: 'user_not_found' })
    return
  }

  // Fetch full subscription to get price and period
  let planInfo: { plan: PlanTier; ciclo: 'monthly' | 'annual' } = { plan: 'starter', ciclo: 'monthly' }
  let periodEnd: Date | null = null
  let priceUsd = 0

  if (subscriptionId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stripeSub = await stripe.subscriptions.retrieve(subscriptionId!) as any
    const priceId = stripeSub.items?.data?.[0]?.price?.id
    if (priceId) {
      planInfo = getPlanFromPriceId(priceId) ?? { plan: 'starter', ciclo: 'monthly' }
    }
    periodEnd = new Date((stripeSub.current_period_end ?? 0) * 1000)
    priceUsd = (stripeSub.items?.data?.[0]?.price?.unit_amount ?? 0) / 100
  }

  // Activate via DB function
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (ctx.supabase as any).rpc('activate_subscription', {
    p_user_id:         userId,
    p_customer_id:     customerId,
    p_subscription_id: subscriptionId,
    p_plan:            planInfo.plan,
    p_status:          'active',
    p_periodo_fin:     periodEnd?.toISOString() ?? null,
    p_ciclo:           planInfo.ciclo,
    p_precio_usd:      priceUsd,
    p_event_id:        ctx.eventId,
  })

  await logWebhookEvent(ctx, 'processed', userId, {
    plan: planInfo.plan,
    ciclo: planInfo.ciclo,
    subscriptionId,
    customerId,
  })
}

async function handleSubscriptionUpdated(
  ctx: WebhookContext,
  subscription: Stripe.Subscription
) {
  const customerId = typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer.id

  const userId = await resolveUserId(ctx.supabase, undefined, subscription, customerId)
  if (!userId) {
    await logWebhookEvent(ctx, 'ignored', null, { customerId }, 'user_id not found — subscription may not be managed by this app')
    return
  }

  const priceId = subscription.items.data[0]?.price?.id
  const planInfo = priceId ? (getPlanFromPriceId(priceId) ?? { plan: 'starter' as PlanTier, ciclo: 'monthly' as const }) : { plan: 'starter' as PlanTier, ciclo: 'monthly' as const }
  const priceUsd = (subscription.items.data[0]?.price?.unit_amount ?? 0) / 100

  // Map Stripe status to our status type
  const statusMap: Record<string, string> = {
    active:    'active',
    trialing:  'trialing',
    past_due:  'past_due',
    canceled:  'canceled',
    incomplete: 'incomplete',
    incomplete_expired: 'incomplete_expired',
    paused:    'paused',
    unpaid:    'past_due',
  }
  const status = statusMap[subscription.status] ?? 'past_due'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (ctx.supabase as any).rpc('activate_subscription', {
    p_user_id:         userId,
    p_customer_id:     customerId,
    p_subscription_id: subscription.id,
    p_plan:            planInfo.plan,
    p_status:          status,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    p_periodo_fin:     new Date(((subscription as any).current_period_end ?? 0) * 1000).toISOString(),
    p_ciclo:           planInfo.ciclo,
    p_precio_usd:      priceUsd,
    p_event_id:        ctx.eventId,
  })

  // Handle cancel_at_period_end flag
  if (subscription.cancel_at_period_end) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (ctx.supabase as any)
      .from('subscriptions')
      .update({ cancel_at_period_end: true })
      .eq('user_id', userId)
  }

  await logWebhookEvent(ctx, 'processed', userId, {
    plan: planInfo.plan,
    status,
    subscriptionId: subscription.id,
  })
}

async function handlePaymentFailed(
  ctx: WebhookContext,
  invoice: Stripe.Invoice
) {
  const customerId = typeof invoice.customer === 'string'
    ? invoice.customer
    : (invoice.customer as Stripe.Customer | null)?.id ?? ''

  const userId = await resolveUserId(ctx.supabase, undefined, undefined, customerId)
  if (!userId) {
    await logWebhookEvent(ctx, 'ignored', null, { customerId }, 'user_id not found for failed payment')
    return
  }

  // Apply grace period — does NOT downgrade plan immediately
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (ctx.supabase as any).rpc('set_subscription_grace_period', {
    p_user_id:    userId,
    p_grace_days: GRACE_PERIOD_DAYS,
  })

  await logWebhookEvent(ctx, 'processed', userId, {
    invoiceId: invoice.id,
    amountDue: invoice.amount_due,
    gracePeriodDays: GRACE_PERIOD_DAYS,
  })
}

async function handleSubscriptionDeleted(
  ctx: WebhookContext,
  subscription: Stripe.Subscription
) {
  const customerId = typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer.id

  const userId = await resolveUserId(ctx.supabase, undefined, subscription, customerId)
  if (!userId) {
    await logWebhookEvent(ctx, 'ignored', null, { customerId }, 'user_id not found for deletion')
    return
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (ctx.supabase as any).rpc('cancel_subscription', {
    p_user_id:     userId,
    p_immediately: true,
  })

  await logWebhookEvent(ctx, 'processed', userId, {
    subscriptionId: subscription.id,
    reason: 'subscription_deleted',
  })
}

// ─── POST /api/stripe/webhook ─────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('[Stripe] STRIPE_WEBHOOK_SECRET not configured')
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  // Verify signature — prevents spoofed events
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Signature verification failed'
    console.error('[Stripe] Webhook signature verification failed:', msg)
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const supabase = createAdminClient()
  const ctx: WebhookContext = {
    supabase,
    eventId: event.id,
    eventType: event.type,
  }

  // ── Idempotency: skip already-processed events ────────────────────────────
  const alreadyProcessed = await isEventAlreadyProcessed(supabase, event.id)
  if (alreadyProcessed) {
    console.log(`[Stripe] Event ${event.id} already processed — skipping`)
    return NextResponse.json({ received: true, status: 'duplicate' })
  }

  // ── Route to handler ──────────────────────────────────────────────────────
  try {
    switch (event.type) {

      case 'checkout.session.completed':
        await handleCheckoutCompleted(ctx, event.data.object as Stripe.Checkout.Session)
        break

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(ctx, event.data.object as Stripe.Subscription)
        break

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(ctx, event.data.object as Stripe.Subscription)
        break

      case 'invoice.payment_failed':
        await handlePaymentFailed(ctx, event.data.object as Stripe.Invoice)
        break

      case 'invoice.payment_succeeded':
        // On renewal: subscription.updated fires too — handled there
        // Here we just log for audit trail
        await logWebhookEvent(ctx, 'processed', null, {
          invoiceId: (event.data.object as Stripe.Invoice).id,
          note: 'Renewal payment — handled via subscription.updated',
        })
        break

      case 'customer.subscription.trial_will_end':
        // Log for future email notifications (Phase 10+)
        await logWebhookEvent(ctx, 'processed', null, {
          subscriptionId: (event.data.object as Stripe.Subscription).id,
          note: 'Trial ending soon — email notification not yet implemented',
        })
        break

      default:
        // Log unhandled events but return 200 to prevent Stripe from retrying
        await logWebhookEvent(ctx, 'ignored', null, { eventType: event.type })
        console.log(`[Stripe] Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Webhook processing error'
    console.error(`[Stripe] Error processing ${event.type}:`, msg)

    // Log the failure but return 200 to prevent infinite retries for non-recoverable errors
    await logWebhookEvent(ctx, 'failed', null, { eventType: event.type }, msg).catch(() => {})
    return NextResponse.json({ received: true, error: msg }, { status: 200 })
  }
}
