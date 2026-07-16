-- ═══════════════════════════════════════════════════════════════════════════════
-- Autoridad Seguros AI™ — Migration 014: Phase 16
--
-- 1. weekly_briefings — stores generated Monday briefings (idempotent per user/week)
-- 2. export_events    — audit log of data exports (privacy + compliance)
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── TABLE: weekly_briefings ─────────────────────────────────────────────────
-- One row per user per ISO week (year + week_number).
-- Prevents duplicate briefings for the same user/week regardless of trigger.
-- Content is stored so agents can consult their latest briefing anytime.

create table if not exists public.weekly_briefings (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,

  -- Idempotency key: one briefing per user per calendar week
  year            smallint not null,
  week_number     smallint not null,  -- ISO week 1-53
  periodo_key     text not null,      -- e.g. '2025-W03' — composite unique key

  -- Content
  briefing_texto  text not null,      -- The generated briefing (plain text)
  modelo_ia       text not null default 'claude-sonnet-4-6',

  -- Metadata
  trigger_type    text not null check (trigger_type in ('cron','manual','api')),
  context_layers  text[],             -- Which context layers were used
  tokens_used     integer,
  costo_usd       numeric(10,6),

  -- Timestamps
  created_at      timestamptz not null default now(),

  -- One briefing per user per week
  constraint weekly_briefings_user_week unique (user_id, periodo_key)
);

create index if not exists idx_briefings_user_date
  on public.weekly_briefings(user_id, created_at desc);

alter table public.weekly_briefings enable row level security;

create policy "Users can view their own briefings"
  on public.weekly_briefings for select using (auth.uid() = user_id);

-- ─── TABLE: export_events ────────────────────────────────────────────────────
-- Audit log of every data export. Privacy + compliance record.
-- Never stores the exported data itself — only metadata.

create table if not exists public.export_events (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  export_format text not null check (export_format in ('json','pdf')),
  data_scope    text[] not null,  -- Which sections were exported
  record_count  integer,          -- Approximate rows exported
  ip_address    text,             -- Optional: request IP for audit
  created_at    timestamptz not null default now()
);

create index if not exists idx_exports_user_date
  on public.export_events(user_id, created_at desc);

alter table public.export_events enable row level security;

create policy "Users can view their own export history"
  on public.export_events for select using (auth.uid() = user_id);

-- ─── FUNCTION: get_current_iso_week ──────────────────────────────────────────
-- Returns the ISO year and week number for a given timestamp.
-- Used by the briefing system to compute the idempotency key.

create or replace function public.get_iso_week_key(p_ts timestamptz default now())
returns text
language sql immutable
as $$
  select
    extract(isoyear from p_ts)::text || '-W' ||
    lpad(extract(week from p_ts)::text, 2, '0')
$$;
