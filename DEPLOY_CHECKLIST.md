# Autoridad Seguros AI™ — Checklist de Staging y Deploy
**Estado:** Preparación para staging (NO activar producción sin confirmación explícita)

---

## 1. PREPARACIÓN LOCAL

- [ ] `node --version` → debe ser Node.js 18+
- [ ] `npm install` → sin errores
- [ ] Copiar `.env.example` a `.env.local` y rellenar TODAS las variables
- [ ] `npx tsc --noEmit` → 0 errores de código
- [ ] `npm run build` → compilación exitosa
- [ ] Verificar que `/api/cron/*`, `/api/export/*`, `/api/briefing` aparecen en el build output
- [ ] Ejecutar `npm run dev` y navegar a `http://localhost:3000`
- [ ] Registrar un usuario de prueba y completar onboarding básico

---

## 2. SUPABASE — STAGING PROJECT

### 2a. Creación del proyecto
- [ ] Crear proyecto en supabase.com → nombre: `autoridad-seguros-staging`
- [ ] Región: US East (cercana a Vercel)
- [ ] Copiar `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] Copiar `SUPABASE_SERVICE_ROLE_KEY` (Settings → API → service_role)

### 2b. Auth
- [ ] Settings → Auth → Email → Enable "Confirm email"
- [ ] Agregar redirect URL: `https://[staging-domain]/auth/callback`
- [ ] Agregar redirect URL: `http://localhost:3000/auth/callback` (local)

### 2c. Migraciones (ejecutar EN ESTE ORDEN en SQL Editor)
```
001_initial_schema.sql
002_agent_intelligence_profile.sql
003_brand_builder.sql
004_growth_engine.sql
005_phase7_schema.sql
006_phase8_schema.sql
007_stripe_webhook.sql
008_phase9_onboarding.sql
009_phase10_compliance.sql
010_phase11_evidence_aggregator.sql
011_phase12_rejection_cleanup.sql
012_phase13_history_config.sql
013_phase15_performance.sql
014_phase16_briefing_export.sql
```

- [ ] Migración 001 ejecutada sin errores
- [ ] Migración 002 ejecutada
- [ ] Migración 003 ejecutada
- [ ] Migración 004 ejecutada
- [ ] Migración 005 ejecutada
- [ ] Migración 006 ejecutada
- [ ] Migración 007 ejecutada
- [ ] Migración 008 ejecutada
- [ ] Migración 009 ejecutada
- [ ] Migración 010 ejecutada
- [ ] Migración 011 ejecutada
- [ ] Migración 012 ejecutada
- [ ] Migración 013 ejecutada
- [ ] Migración 014 ejecutada

### 2d. Verificación post-migraciones
- [ ] Table Editor → verificar que existen las tablas principales: `profiles`, `contenidos`, `subscriptions`, `plan_limits`, `compliance_rules`, `weekly_briefings`, `export_events`
- [ ] Ejecutar backfill si hay usuarios previos: `SELECT public.backfill_intel_profile_history();`
- [ ] Verificar que `plan_limits` tiene 3 filas (starter, pro, elite)
- [ ] Verificar que `compliance_rules` tiene las 22 reglas seed
- [ ] Verificar que `aggregator_config` tiene 1 fila global (user_id = NULL)
- [ ] Verificar que `stripe_price_catalog` tiene 6 placeholders
- [ ] Verificar triggers: `handle_contenido_publicado` activo en `contenidos`
- [ ] Verificar funciones: `build_agent_context`, `activate_subscription`, `cleanup_archived_rejections`, `get_iso_week_key`
- [ ] Verificar RLS activo en todas las tablas de usuario (test: query sin auth → 0 rows)
- [ ] Verificar aislamiento por user_id: crear 2 usuarios de prueba y verificar que cada uno solo ve sus datos

---

## 3. STRIPE — TEST MODE

### 3a. Productos y precios
- [ ] Dashboard Stripe → Test Mode activo (toggle en header)
- [ ] Products → Create Product: "Starter" ($27/mes, $270/año)
- [ ] Products → Create Product: "Pro" ($57/mes, $570/año)
- [ ] Products → Create Product: "Elite" ($97/mes, $970/año)
- [ ] Copiar los 6 Price IDs → variables de entorno `STRIPE_PRICE_*`
- [ ] Actualizar `stripe_price_catalog` en Supabase con los Price IDs reales

### 3b. Customer Portal
- [ ] Stripe Dashboard → Customer Portal → Enable
- [ ] Configurar: cancel subscription, update payment method, view invoices
- [ ] Configurar return URL: `https://[staging-domain]/settings`

### 3c. Webhook
- [ ] Developers → Webhooks → Add Endpoint
- [ ] URL: `https://[staging-domain]/api/stripe/webhook`
- [ ] Eventos a escuchar:
  - [ ] `checkout.session.completed`
  - [ ] `customer.subscription.updated`
  - [ ] `customer.subscription.deleted`
  - [ ] `invoice.payment_failed`
  - [ ] `invoice.payment_succeeded`
  - [ ] `customer.subscription.trial_will_end`
- [ ] Copiar Signing Secret → `STRIPE_WEBHOOK_SECRET`

### 3d. Validación del flujo
- [ ] Ir a `/precios` → seleccionar plan Pro mensual → checkout
- [ ] Usar tarjeta de prueba: `4242 4242 4242 4242` | exp: 12/29 | CVC: 123
- [ ] Verificar redirect a `/dashboard?payment=success&plan=pro`
- [ ] Verificar en Stripe → Events: `checkout.session.completed` procesado
- [ ] Verificar en Supabase → `subscriptions`: registro creado
- [ ] Verificar en Supabase → `stripe_webhook_events`: evento registrado
- [ ] Verificar `profiles.plan_tier` actualizado a 'pro'
- [ ] Verificar `WelcomeBanner` visible en dashboard

### 3e. Escenarios adicionales
- [ ] Pago fallido: tarjeta `4000 0000 0000 0002` → verificar grace period en `subscriptions`
- [ ] Cambio de plan: Customer Portal → actualizar → verificar `subscriptions.plan`
- [ ] Cancelación: Customer Portal → cancel → verificar `cancel_at_period_end = true`
- [ ] Evento duplicado: reenviar el mismo evento desde Stripe → verificar que NO se procesa dos veces (idempotencia)
- [ ] Renovación: esperar o simular invoice.payment_succeeded

---

## 4. ANTHROPIC / IA

- [ ] Verificar `ANTHROPIC_API_KEY` válida: `curl https://api.anthropic.com/v1/messages -H "x-api-key: $KEY" -H "anthropic-version: 2023-06-01"` → 401 si inválida
- [ ] Verificar que la key es server-side only (nunca en `NEXT_PUBLIC_*`)
- [ ] Probar Content Studio: generar un post → verificar que streaming funciona
- [ ] Probar Marketing Copilot: modo Estratega → verificar respuesta
- [ ] Probar Objection AI: "Es muy caro" → verificar análisis de 5 ángulos
- [ ] Probar compliance check: verificar que `rules_source` aparece en resultado
- [ ] Verificar ai_usage: cada llamada registrada en `ai_usage` con `costo_usd`
- [ ] Probar JSON retry: en caso de respuesta malformada → verificar auto-fix
- [ ] Verificar límites por plan: con plan starter (30 contenidos) → intentar 31 → error 429

---

## 5. VERCEL — STAGING

### 5a. Proyecto
- [ ] vercel.com → New Project → Import desde GitHub
- [ ] Framework: Next.js (auto-detectado)
- [ ] Build command: `npm run build`
- [ ] Output directory: `.next`
- [ ] Root directory: `/`

### 5b. Variables de entorno
Agregar TODAS en Settings → Environment Variables:
- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `STRIPE_SECRET_KEY`
- [ ] `STRIPE_WEBHOOK_SECRET`
- [ ] `STRIPE_PRICE_STARTER_MONTHLY`
- [ ] `STRIPE_PRICE_STARTER_ANNUAL`
- [ ] `STRIPE_PRICE_PRO_MONTHLY`
- [ ] `STRIPE_PRICE_PRO_ANNUAL`
- [ ] `STRIPE_PRICE_ELITE_MONTHLY`
- [ ] `STRIPE_PRICE_ELITE_ANNUAL`
- [ ] `ANTHROPIC_API_KEY`
- [ ] `NEXT_PUBLIC_APP_URL` (URL de staging de Vercel)
- [ ] `CRON_SECRET`

### 5c. Deploy
- [ ] Primer deploy exitoso
- [ ] Verificar logs → sin errores críticos
- [ ] Verificar todas las rutas listadas compilan: /dashboard, /performance, /settings, /precios, /objection-ai, /onboarding
- [ ] Verificar headers de seguridad (Next.js defaults)

### 5d. Cron Jobs (requiere Vercel Pro)
- [ ] Settings → Cron Jobs → verificar 3 jobs registrados desde vercel.json
- [ ] Test manual: `curl -H "Authorization: Bearer $CRON_SECRET" https://[domain]/api/cron/briefing-lunes`
- [ ] Verificar `cron_job_runs` en Supabase: registro creado

---

## 6. PRUEBA END-TO-END DESDE USUARIO NUEVO

### Registro y onboarding
| Paso | Resultado esperado | Estado |
|---|---|---|
| Ir a `/register` y crear cuenta | Email de verificación recibido | ⬜ |
| Clic en enlace de verificación | Redirect a `/onboarding` | ⬜ |
| Paso 1: nombre + estado + especialidades | Guardado en `profiles` + `agent_intelligence_profiles` | ⬜ |
| Paso 2: seleccionar productos | Guardado en `profiles.especialidades` + `intel.productos_principales` | ⬜ |
| Paso 3: entrevista Marco (o saltar) | `interview_sessions` con status completado, o `onboarding_entrevista_omitida` en analytics | ⬜ |
| Paso 4: primera generación | Contenido generado, `first_value_generated_at` poblado, `analytics_events.tipo_evento = first_value_generated` | ⬜ |
| Redirect a `/dashboard?welcome=1` | `WelcomeBanner` visible | ⬜ |

### Módulos principales
| Módulo | Acción | Resultado esperado | Estado |
|---|---|---|---|
| Content Studio | Generar post de Instagram | Streaming funciona, resultado guardable, compliance badge | ⬜ |
| Content Studio | Solicitar compliance check | `compliance_logs` creado, `risk_level` en resultado | ⬜ |
| Marketing Copilot | Modo Estratega | Recomendaciones personalizadas, botón → Content Studio | ⬜ |
| Objection AI | "Lo voy a pensar" | 5 ángulos de respuesta, feedback útil/no útil | ⬜ |
| Brand Builder | Completar tab Identidad | `brand_kits` + `agent_intelligence_profiles` actualizados | ⬜ |
| Brand Builder → Inteligencia IA | Ver inferencias | Tab carga, botón "Analizar señales" funciona | ⬜ |
| Performance | Ver métricas | Todas las secciones cargan sin errores | ⬜ |
| Settings | Ver configuración | Plan, uso, opciones de cambio de contraseña | ⬜ |
| Settings | Exportar JSON | Descarga iniciada, archivo válido, sin datos sensibles | ⬜ |
| Settings | Exportar texto | Descarga iniciada, formato legible | ⬜ |
| Settings | Generar briefing manual | Briefing generado, `weekly_briefings` creado | ⬜ |

### Stripe
| Flujo | Resultado esperado | Estado |
|---|---|---|
| Ir a `/precios` | Planes y precios cargan de DB | ⬜ |
| Checkout plan Pro | Redirect a Stripe, pago con tarjeta de prueba | ⬜ |
| Post-pago | `/dashboard?payment=success`, banner visible | ⬜ |
| Verificar plan | `profiles.plan_tier = 'pro'` | ⬜ |
| Customer Portal | Botón en Settings → portal Stripe | ⬜ |

---

## 7. PRODUCCIÓN (NO EJECUTAR SIN CONFIRMACIÓN EXPLÍCITA)

- ⛔ NO cambiar `STRIPE_SECRET_KEY` a clave live sin aprobación
- ⛔ NO activar Stripe live mode sin pruebas de staging completadas
- ⛔ NO ejecutar migraciones en proyecto Supabase de producción sin respaldo
- ⛔ NO configurar webhook de producción con URL de staging

### Cuando se apruebe:
- [ ] Crear proyecto Supabase **production** separado de staging
- [ ] Ejecutar las 14 migraciones en producción
- [ ] Crear productos en Stripe en LIVE mode
- [ ] Configurar webhook con URL de producción
- [ ] Cambiar variables de entorno en Vercel → ambiente Production
- [ ] Verificar que `NEXT_PUBLIC_APP_URL` apunta a dominio definitivo
- [ ] Prueba de smoke con tarjeta real (monto mínimo)
- [ ] Confirmar webhook recibido y procesado

---

## VARIABLES DE ENTORNO — ARCHIVO .env.example

```bash
# ─── Supabase ─────────────────────────────────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=https://[project-id].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# ─── Stripe (TEST MODE para staging) ─────────────────────────────────────────
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER_MONTHLY=price_...
STRIPE_PRICE_STARTER_ANNUAL=price_...
STRIPE_PRICE_PRO_MONTHLY=price_...
STRIPE_PRICE_PRO_ANNUAL=price_...
STRIPE_PRICE_ELITE_MONTHLY=price_...
STRIPE_PRICE_ELITE_ANNUAL=price_...

# ─── Anthropic ────────────────────────────────────────────────────────────────
ANTHROPIC_API_KEY=sk-ant-...

# ─── App ──────────────────────────────────────────────────────────────────────
NEXT_PUBLIC_APP_URL=http://localhost:3000
# Producción: https://tu-dominio.com

# ─── Jobs (Vercel Cron) ───────────────────────────────────────────────────────
CRON_SECRET=<random-string-32-chars-min>
# Generar con: openssl rand -hex 32
```
