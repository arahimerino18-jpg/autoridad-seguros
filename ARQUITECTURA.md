# Autoridad Seguros AI™ — Documentación Técnica
**Versión:** Fase 16 | **Stack:** Next.js 15 · TypeScript · Supabase · Stripe · Anthropic

---

## ARQUITECTURA GENERAL

```
Browser / Mobile
    ↓ HTTPS
Next.js 15 App Router (Vercel)
    ├── Pages (RSC)           — /dashboard, /brand-builder, /content-studio, etc.
    ├── API Routes            — /api/ai/*, /api/stripe/*, /api/cron/*, /api/export/*
    └── Server Actions        — 'use server' functions in src/lib/*/actions.ts

External Services
    ├── Supabase              — PostgreSQL + Auth + RLS
    ├── Anthropic (Claude)    — claude-sonnet-4-6 for all AI generation
    ├── Stripe                — Payments, subscriptions, webhooks
    └── Vercel Cron           — 3 weekly jobs (Monday 7am, 9am, 10am UTC)
```

---

## MAPA DE TABLAS (14 migraciones)

### Tablas de usuario
| Tabla | Propósito | RLS |
|---|---|---|
| `profiles` | Perfil básico, plan_tier, onboarding state | ✓ |
| `brand_kits` | Identidad visual, social handles | ✓ |
| `agent_intelligence_profiles` | Perfil IA completo, inferencias, rejection_log | ✓ |
| `agent_intel_profile_history` | Historial inmutable de cambios al perfil IA | ✓ |
| `inference_lifecycle_log` | Ciclo de vida de inferencias (pendiente→aprobada→aplicada) | ✓ |
| `interview_sessions` | Sesiones de entrevista con Marco | ✓ |
| `agent_goals` | Objetivos del agente por período | ✓ |
| `contenidos` | Contenido generado (output_json, compliance_log_id) | ✓ |
| `compliance_logs` | Resultados de compliance review | ✓ |
| `objection_responses` | Sesiones de Objection AI con señales de aprendizaje | ✓ |
| `weekly_briefings` | Briefings de lunes (1 por usuario/semana) | ✓ |
| `export_events` | Audit log de exportaciones de datos | ✓ |

### Tablas de sistema
| Tabla | Propósito | RLS |
|---|---|---|
| `subscriptions` | Estado de suscripción Stripe | ✓ (owner) |
| `plan_limits` | Límites por plan (fuente única de verdad) | Read public |
| `ai_usage` | Log de uso de IA por módulo/período | ✓ |
| `analytics_events` | Eventos de activación y comportamiento | ✓ |
| `copilot_sessions` | Sesiones de Marketing Copilot | ✓ |
| `insurance_calendar` | Eventos estacionales del sector | Public read |
| `compliance_rules` | Reglas determinísticas de compliance (DB-cached) | Public read |
| `aggregator_config` | Umbrales del Evidence Aggregator por usuario | ✓ |
| `aggregator_rules` | Configuración de reglas del aggregator | ✓ |
| `evidence_aggregator_runs` | Audit log de ejecuciones del aggregator | ✓ (read) |
| `stripe_webhook_events` | Idempotency log de webhooks Stripe | Service role |
| `stripe_price_catalog` | Catálogo de precios Stripe | Public read |
| `cron_job_runs` | Audit log de jobs programados | Service role |

### Funciones PostgreSQL
| Función | Propósito |
|---|---|
| `build_agent_context(user_id)` | Construye contexto del agente para prompts IA |
| `activate_subscription(...)` | Activa suscripción vía webhook Stripe |
| `set_subscription_grace_period(user_id, days)` | Aplica período de gracia por pago fallido |
| `cancel_subscription(user_id, immediately)` | Cancela suscripción |
| `cleanup_archived_rejections(user_id)` | Limpia rejection_log según política Decisión C |
| `record_intel_profile_change(...)` | Registra cambio en historial de perfil IA |
| `backfill_intel_profile_history(user_id?)` | Backfill de datos pre-Fase14 |
| `get_iso_week_key(ts)` | Devuelve clave ISO week para idempotencia de briefings |
| `handle_contenido_publicado()` | Trigger: incrementa total_contenidos_publicados |

### Triggers
| Trigger | Tabla | Evento |
|---|---|---|
| `on_contenido_publicado` | `contenidos` | UPDATE fue_publicado → true |

---

## INVENTARIO DE API ROUTES

### AI Routes
| Ruta | Método | Propósito |
|---|---|---|
| `/api/ai/content-studio` | POST | Generar/modificar/compliance de contenido (SSE stream) |
| `/api/ai/copilot` | POST | Marketing Copilot — 5 modos (SSE stream) |
| `/api/ai/interview` | POST | Entrevista con Marco (SSE stream) |
| `/api/ai/objection` | POST | Objection AI — análisis ético (SSE stream) |

### Stripe Routes
| Ruta | Método | Propósito |
|---|---|---|
| `/api/stripe/webhook` | POST | Webhook Stripe — 6 eventos, idempotente |
| `/api/stripe/checkout-success` | GET | Redirect post-checkout, valida session |

### Intelligence Routes
| Ruta | Método | Propósito |
|---|---|---|
| `/api/intelligence/aggregate` | POST | Trigger manual del Evidence Aggregator |
| `/api/intelligence/config` | POST | Guarda configuración del Aggregator |
| `/api/intelligence/simulate` | POST | Sandbox — simula sin escribir a DB |

### Briefing Routes
| Ruta | Método | Propósito |
|---|---|---|
| `/api/briefing` | GET | Devuelve briefing de semana actual o último |
| `/api/briefing` | POST | Genera briefing manualmente (idempotente, `force` opcional) |

### Export Routes
| Ruta | Método | Propósito |
|---|---|---|
| `/api/export/json` | GET | Descarga JSON completo del agente |
| `/api/export/pdf` | GET | Descarga resumen en texto formateado |

### Cron Routes
| Ruta | Schedule | Propósito |
|---|---|---|
| `/api/cron/briefing-lunes` | Lunes 7am UTC | Genera briefing para todos los usuarios activos |
| `/api/cron/cleanup-rejections` | Lunes 9am UTC | Limpia rejection_log archivados elegibles |
| `/api/cron/run-aggregator` | Lunes 10am UTC | Ejecuta Evidence Aggregator para todos los usuarios |

---

## INVENTARIO DE SERVER ACTIONS

| Archivo | Actions exportadas |
|---|---|
| `src/lib/auth/actions.ts` | `loginAction`, `registerAction`, `logoutAction`, `resetPasswordAction` |
| `src/lib/brand-builder/actions.ts` | `saveIdentidadAction`, `saveMarcaPersonalAction`, `savePublicoAction`, `saveVisualAction`, `saveRedesAction` |
| `src/lib/cliente-ideal/actions.ts` | `generateClienteIdealAction`, `saveClienteIdealAction` |
| `src/lib/content-studio/actions.ts` | `saveContentAction`, `markPublishedAction` |
| `src/lib/intelligence/actions.ts` | `runAggregatorAction`, `approveInferenceAction`, `rejectInferenceAction`, `getAggregatorStats`, `cleanupArchivedRejectionsAction`, `archiveRejectionAction` |
| `src/lib/intelligence/history.ts` | `recordIntelProfileChange`, `getIntelProfileHistory`, `getFieldHistory`, `revertIntelFieldAction`, `approveInferenceWithHistory`, `getAggregatorConfigAction` |
| `src/lib/intelligence/profile-service.ts` | `updateAgentProfile`, `updateAgentProfileDeclared`, `updateAgentProfileFromInference` |
| `src/lib/intelligence/lifecycle.ts` | `recordInferenceLifecycle`, `getInferenceLifecycle`, `getLifecycleStats` |
| `src/lib/objection-ai/actions.ts` | `saveObjectionAction`, `saveObjectionFeedback`, `getObjectionHistory` |
| `src/lib/onboarding/actions.ts` | `startOnboardingAction`, `onboardingStep1`, `onboardingStep2`, `onboardingSkipInterview`, `onboardingCompleteInterview`, `markFirstValueGenerated`, `completeOnboarding`, `getOnboardingState` |
| `src/lib/stripe/checkout.ts` | `createCheckoutSession`, `createBillingPortalSession` |
| `src/lib/export/data-export.ts` | `buildAgentDataExport`, `logExportEvent` |

---

## INVENTARIO DE VARIABLES DE ENTORNO

### Requeridas en producción

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://[project].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...          # Server-only, NUNCA al cliente

# Stripe (TEST MODE para staging)
STRIPE_SECRET_KEY=sk_test_...             # Server-only
STRIPE_WEBHOOK_SECRET=whsec_...           # Del Stripe Dashboard → Webhooks
STRIPE_PRICE_STARTER_MONTHLY=price_...
STRIPE_PRICE_STARTER_ANNUAL=price_...
STRIPE_PRICE_PRO_MONTHLY=price_...
STRIPE_PRICE_PRO_ANNUAL=price_...
STRIPE_PRICE_ELITE_MONTHLY=price_...
STRIPE_PRICE_ELITE_ANNUAL=price_...

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...              # Server-only

# App
NEXT_PUBLIC_APP_URL=https://staging.tu-dominio.com  # Sin slash final
CRON_SECRET=<random-secret-32chars>       # Compartido con Vercel Cron
```

### Variables públicas (safe to expose)
Solo `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL` son públicas. Todas las demás son server-only.

---

## INVENTARIO DE JOBS Y CRON

| Job | Schedule | Idempotente | Timeout estimado | Log |
|---|---|---|---|---|
| `briefing-lunes` | Lunes 07:00 UTC | ✓ (1/user/week) | ~30s para 100 usuarios | `cron_job_runs` |
| `cleanup-rejections` | Lunes 09:00 UTC | ✓ | ~5s | `cron_job_runs` |
| `run-aggregator` | Lunes 10:00 UTC | ✓ | ~60s para 100 usuarios | `cron_job_runs` |

**Nota:** Vercel Free Plan no soporta cron jobs. Se requiere Pro Plan ($20/mes).

---

## DEUDA TÉCNICA ACTUAL

| Item | Severidad | Fase destino |
|---|---|---|
| `as any` casts en ~20 archivos — se resuelven con `supabase gen types typescript` | Baja | Fase 17 (post-Supabase real) |
| Campos legacy opcionales en `ComplianceResult` (`nivel?`, `score_riesgo?`) | Baja | Fase 17 |
| Sandbox R7 (frases_propias) es aproximado — no ejecuta extracción de texto real | Media | Fase 17 |
| PDF export retorna texto plano, no PDF binario real | Media | Fase 17 (react-pdf) |
| `buildCopilotContext` usa RPC `build_copilot_context` que puede no existir en Supabase nuevo | Alta | Post-migración |
| Briefing solo genera para usuarios con `onboarding_completed=true` — `onboarding_done` (legacy) omitido | Baja | Fase 17 |
| `updateIntelProfile` en brand-builder/actions.ts es un wrapper — puede consolidarse | Baja | Fase 17 |
| Performance loader `.limit(500)` en contenidos — paginación pendiente para usuarios con mucho historial | Media | Fase 17 |

---

## INTEGRACIÓN CON MÓDULOS — MAPA DE FLUJO

```
Registro
  └─ /onboarding (5 pasos) → agent_intelligence_profiles poblado
       └─ /dashboard?welcome=1

Content Studio (/content-studio)
  └─ /api/ai/content-studio [generate → modify → compliance]
       ├─ contenidos (guardado)
       └─ compliance_logs (si compliance check)

Marketing Copilot (/marketing-copilot)
  └─ /api/ai/copilot [5 modos]
       └─ copilot_sessions, growth_engine_outputs

Objection AI (/objection-ai)
  └─ /api/ai/objection
       └─ objection_responses (con señales de aprendizaje)

Brand Builder (/brand-builder)
  └─ brand_kits + agent_intelligence_profiles
       └─ Tab Inteligencia IA → Evidence Aggregator → inferencias_pendientes

Evidence Aggregator
  └─ /api/intelligence/aggregate [manual] | /api/cron/run-aggregator [weekly]
       ├─ 7 reglas analizan objection_responses, ai_usage, contenidos, interview_sessions
       └─ propone inferencias → agent_intelligence_profiles.inferencias_pendientes

Stripe Flow
  └─ /precios → createCheckoutSession → Stripe Checkout
       └─ /api/stripe/webhook [checkout.session.completed]
            └─ activate_subscription() → profiles.plan_tier + subscriptions

Briefing de Lunes
  └─ /api/cron/briefing-lunes [weekly] | /api/briefing [POST manual]
       └─ weekly_briefings (1 por usuario/semana, idempotente)
```

---

## INTEGRACIONES EXTERNAS PENDIENTES

| Integración | Estado | Prioridad |
|---|---|---|
| Instagram API (publicación directa) | No iniciada | Fase 18+ |
| CMS Medicare guidance como fuente de compliance_rules | No iniciada | Fase 18+ |
| Carrier-specific guidelines en compliance_rules | No iniciada | Fase 18+ |
| Resend (emails transaccionales) | Referenciada, sin implementar | Fase 17 |
| Vercel Cron (requiere Plan Pro) | Configurado, pendiente de proyecto real | Pre-deploy |
| Supabase proyecto real (actualmente usando tipos manuales) | Pendiente | Pre-deploy |
