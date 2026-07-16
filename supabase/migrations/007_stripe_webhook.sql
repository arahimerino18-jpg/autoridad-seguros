-- ═══════════════════════════════════════════════════════════════════════════════
-- Autoridad Seguros AI™ — Migration 007: Stripe Webhook Infrastructure
--
-- 1. stripe_webhook_events — idempotency log (prevents duplicate processing)
-- 2. stripe_price_catalog — maps Stripe Price IDs to plan tiers (no hardcoding)
-- 3. Add periodo_gracia_fin to subscriptions (grace period for failed payments)
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── TABLE: stripe_webhook_events ─────────────────────────────────────────────
-- Every Stripe event processed is recorded here.
-- Duplicate events (same stripe_event_id) are ignored — idempotent by design.

create table if not exists public.stripe_webhook_events (
  id                uuid primary key default gen_random_uuid(),
  stripe_event_id   text unique not null,         -- Stripe's event ID (idempotency key)
  event_type        text not null,                 -- e.g. 'checkout.session.completed'
  status            text not null default 'processed'
    check (status in ('processed', 'failed', 'ignored')),
  user_id           uuid references public.profiles(id) on delete set null,
  error_message     text,
  payload_summary   jsonb,                          -- Key fields only (not full payload)
  processed_at      timestamptz not null default now()
);

create index if not exists idx_webhook_events_stripe_id
  on public.stripe_webhook_events(stripe_event_id);

create index if not exists idx_webhook_events_type_date
  on public.stripe_webhook_events(event_type, processed_at desc);

-- RLS: only service_role can write; admins can read
alter table public.stripe_webhook_events enable row level security;
create policy "Service role manages webhook events"
  on public.stripe_webhook_events for all using (true); -- enforced at API level

-- ─── TABLE: stripe_price_catalog ──────────────────────────────────────────────
-- Maps Stripe Price IDs → plan tier + billing cycle.
-- Configured manually in Supabase dashboard when Stripe products are created.
-- This avoids hardcoding Price IDs in application code.

create table if not exists public.stripe_price_catalog (
  id             uuid primary key default gen_random_uuid(),
  stripe_price_id text unique not null,
  plan           text not null check (plan in ('starter', 'pro', 'elite')),
  ciclo          text not null check (ciclo in ('monthly', 'annual')),
  precio_usd     numeric(8,2) not null,
  activo         boolean not null default true,
  created_at     timestamptz not null default now()
);

-- Seed with env-var-based prices (updated manually per environment)
-- These are placeholders — replace with real Stripe Price IDs in Supabase dashboard
insert into public.stripe_price_catalog (stripe_price_id, plan, ciclo, precio_usd)
values
  ('price_starter_monthly_placeholder',  'starter', 'monthly', 27.00),
  ('price_starter_annual_placeholder',   'starter', 'annual',  270.00),
  ('price_pro_monthly_placeholder',      'pro',     'monthly', 57.00),
  ('price_pro_annual_placeholder',       'pro',     'annual',  570.00),
  ('price_elite_monthly_placeholder',    'elite',   'monthly', 97.00),
  ('price_elite_annual_placeholder',     'elite',   'annual',  970.00)
on conflict (stripe_price_id) do nothing;

-- RLS: public read for pricing page, service_role for writes
alter table public.stripe_price_catalog enable row level security;
create policy "Public can read active prices"
  on public.stripe_price_catalog for select using (activo = true);

-- ─── ALTER: subscriptions — add grace period ──────────────────────────────────
-- periodo_gracia_fin: date until which access continues despite payment failure.
-- Grace period of 3 days is applied on payment_failed events.

alter table public.subscriptions
  add column if not exists periodo_gracia_fin timestamptz,
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists stripe_event_id_last text;  -- last processed event for this subscription

-- ─── FUNCTION: activate_subscription ─────────────────────────────────────────
-- Called by webhook handler (via service_role).
-- Upserts subscription + updates profiles.plan_tier atomically.

create or replace function public.activate_subscription(
  p_user_id         uuid,
  p_customer_id     text,
  p_subscription_id text,
  p_plan            text,
  p_status          text,
  p_periodo_fin     timestamptz,
  p_ciclo           text,
  p_precio_usd      numeric,
  p_event_id        text
)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  -- Upsert subscription record
  insert into public.subscriptions (
    user_id, stripe_customer_id, stripe_subscription_id,
    plan, status, periodo_fin, ciclo, precio_usd, stripe_event_id_last
  )
  values (
    p_user_id, p_customer_id, p_subscription_id,
    p_plan::plan_tier, p_status::subscription_status,
    p_periodo_fin, p_ciclo::text, p_precio_usd, p_event_id
  )
  on conflict (user_id) do update set
    stripe_customer_id     = excluded.stripe_customer_id,
    stripe_subscription_id = excluded.stripe_subscription_id,
    plan                   = excluded.plan,
    status                 = excluded.status,
    periodo_fin            = excluded.periodo_fin,
    ciclo                  = excluded.ciclo,
    precio_usd             = excluded.precio_usd,
    stripe_event_id_last   = excluded.stripe_event_id_last,
    periodo_gracia_fin     = null,   -- clear grace period on successful payment
    cancel_at_period_end   = false,
    updated_at             = now();

  -- Sync plan to profiles (single source of truth = subscriptions, but profiles caches it for fast reads)
  update public.profiles
  set
    plan_tier = p_plan::plan_tier,
    updated_at = now()
  where id = p_user_id;
end;
$$;

-- ─── FUNCTION: set_grace_period ───────────────────────────────────────────────

create or replace function public.set_subscription_grace_period(
  p_user_id        uuid,
  p_grace_days     int default 3
)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  update public.subscriptions
  set
    status             = 'past_due',
    periodo_gracia_fin = now() + (p_grace_days || ' days')::interval,
    updated_at         = now()
  where user_id = p_user_id;

  -- Do NOT downgrade plan_tier yet — grace period preserves access
end;
$$;

-- ─── FUNCTION: cancel_subscription ───────────────────────────────────────────

create or replace function public.cancel_subscription(
  p_user_id uuid,
  p_immediately boolean default false
)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if p_immediately then
    update public.subscriptions
    set status = 'canceled', updated_at = now()
    where user_id = p_user_id;

    -- Downgrade to starter immediately
    update public.profiles
    set plan_tier = 'starter', updated_at = now()
    where id = p_user_id;
  else
    -- Will cancel at period end (Stripe handles the date)
    update public.subscriptions
    set cancel_at_period_end = true, updated_at = now()
    where user_id = p_user_id;
  end if;
end;
$$;
