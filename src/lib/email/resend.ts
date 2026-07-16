/**
 * Autoridad Seguros AI™ — Email Service (Resend)
 *
 * RESPONSIBILITIES:
 *   - Welcome email (post-registration + email verified)
 *   - Briefing ready notification (Monday, after generation)
 *   - Onboarding incomplete reminder (contextual, not aggressive)
 *
 * AUTH EMAILS (NOT handled here — managed by Supabase Auth):
 *   - Email verification/confirmation
 *   - Password reset
 *   These are configured in Supabase Dashboard → Auth → Email Templates.
 *
 * STAGING SAFETY:
 *   - Only sends to addresses in ALLOWED_TEST_EMAILS in non-production
 *   - Set NODE_ENV=production or RESEND_PRODUCTION=true to unlock all sending
 *   - Always logs send attempts (success and failure)
 */

import { Resend } from 'resend'

// ─── Client (lazy — avoids build-time errors if key is missing) ───────────────

let _resend: Resend | null = null

function getResend(): Resend {
  if (_resend) return _resend
  const key = process.env.RESEND_API_KEY
  if (!key) throw new Error('[Email] RESEND_API_KEY is not configured')
  _resend = new Resend(key)
  return _resend
}

// ─── Config ───────────────────────────────────────────────────────────────────

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? 'noreply@resend.dev'
const IS_PRODUCTION = process.env.NODE_ENV === 'production' || process.env.RESEND_PRODUCTION === 'true'

// During staging: only send to these addresses to prevent accidental bulk email
const ALLOWED_TEST_EMAILS = (process.env.RESEND_TEST_EMAILS ?? '').split(',').map(e => e.trim()).filter(Boolean)

// ─── Guard ────────────────────────────────────────────────────────────────────

function canSendTo(email: string): { allowed: boolean; reason?: string } {
  if (IS_PRODUCTION) return { allowed: true }
  if (ALLOWED_TEST_EMAILS.includes(email)) return { allowed: true }
  return {
    allowed: false,
    reason: `Staging mode: ${email} not in RESEND_TEST_EMAILS. Add it to send test emails.`
  }
}

// ─── Result type ──────────────────────────────────────────────────────────────

export interface EmailResult {
  success: boolean
  id?: string
  error?: string
  skipped?: boolean   // True when guarded by staging mode
}

// ─── Email 1: Welcome ─────────────────────────────────────────────────────────

export async function sendWelcomeEmail(params: {
  to: string
  nombre: string
}): Promise<EmailResult> {
  const guard = canSendTo(params.to)
  if (!guard.allowed) {
    console.log(`[Email] Welcome skipped for ${params.to}: ${guard.reason}`)
    return { success: true, skipped: true }
  }

  try {
    const resend = getResend()
    const firstName = params.nombre.split(' ')[0] ?? params.nombre

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: params.to,
      subject: `Bienvenido a Autoridad Seguros AI™, ${firstName}`,
      html: `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:system-ui,-apple-system,sans-serif">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">
    <div style="background:#1B2E6B;padding:32px 40px">
      <h1 style="margin:0;color:#fff;font-size:20px;font-weight:700">Autoridad Seguros AI™</h1>
      <p style="margin:4px 0 0;color:#93c5fd;font-size:13px">Tu Director de Marketing IA</p>
    </div>
    <div style="padding:32px 40px">
      <p style="margin:0 0 16px;font-size:16px;color:#111827">Buenos días, <strong>${firstName}</strong>.</p>
      <p style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.6">
        Tu cuenta en <strong>Autoridad Seguros AI™</strong> está lista. La plataforma está configurada
        para ayudarte a generar contenido, manejar objeciones y crecer tu autoridad en el mercado hispano.
      </p>
      <p style="margin:0 0 24px;font-size:14px;color:#374151;line-height:1.6">
        Comienza completando tu perfil en el <strong>Brand Builder</strong> para que la IA entienda
        quién eres, qué vendes y cómo te comunicas.
      </p>
      <a href="${process.env.NEXT_PUBLIC_APP_URL}/brand-builder"
         style="display:inline-block;background:#1B2E6B;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">
        Completar mi perfil →
      </a>
      <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;line-height:1.5">
        Este correo fue enviado a ${params.to} porque creaste una cuenta en Autoridad Seguros AI™.
        Si no fuiste tú, puedes ignorar este mensaje de forma segura.
      </p>
    </div>
  </div>
</body>
</html>`,
    })

    if (error) throw new Error(error.message)
    return { success: true, id: data?.id }

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Email send failed'
    console.error('[Email] Welcome send failed:', msg)
    return { success: false, error: msg }
  }
}

// ─── Email 2: Briefing ready ──────────────────────────────────────────────────

export async function sendBriefingReadyEmail(params: {
  to: string
  nombre: string
  periodoKey: string   // e.g. '2025-W03'
  preview: string      // First 120 chars of the briefing
}): Promise<EmailResult> {
  const guard = canSendTo(params.to)
  if (!guard.allowed) {
    console.log(`[Email] Briefing notification skipped for ${params.to}: ${guard.reason}`)
    return { success: true, skipped: true }
  }

  try {
    const resend = getResend()
    const firstName = params.nombre.split(' ')[0] ?? params.nombre
    const preview = params.preview.slice(0, 120) + (params.preview.length > 120 ? '...' : '')

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: params.to,
      subject: `✦ Tu briefing estratégico está listo — ${params.periodoKey}`,
      html: `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:system-ui,-apple-system,sans-serif">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">
    <div style="background:linear-gradient(135deg,#1B2E6B,#2a4080);padding:28px 40px">
      <p style="margin:0;color:#93c5fd;font-size:12px;text-transform:uppercase;letter-spacing:1px">Briefing semanal</p>
      <h1 style="margin:4px 0 0;color:#fff;font-size:18px;font-weight:700">${params.periodoKey}</h1>
    </div>
    <div style="padding:28px 40px">
      <p style="margin:0 0 12px;font-size:15px;color:#111827">Buenos días, <strong>${firstName}</strong>.</p>
      <p style="margin:0 0 16px;font-size:13px;color:#6b7280;font-style:italic;line-height:1.6;border-left:3px solid #e5e7eb;padding-left:12px">
        "${preview}"
      </p>
      <a href="${process.env.NEXT_PUBLIC_APP_URL}/settings"
         style="display:inline-block;background:#1B2E6B;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600">
        Ver mi briefing completo →
      </a>
    </div>
    <div style="padding:16px 40px;background:#f9fafb;border-top:1px solid #e5e7eb">
      <p style="margin:0;font-size:11px;color:#9ca3af">
        Autoridad Seguros AI™ · Enviado a ${params.to} · <a href="${process.env.NEXT_PUBLIC_APP_URL}/settings" style="color:#6b7280">Configurar notificaciones</a>
      </p>
    </div>
  </div>
</body>
</html>`,
    })

    if (error) throw new Error(error.message)
    return { success: true, id: data?.id }

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Email send failed'
    console.error('[Email] Briefing notification failed:', msg)
    return { success: false, error: msg }
  }
}

// ─── Email 3: Onboarding incomplete reminder ──────────────────────────────────
// Only sent once (7 days post-registration if onboarding_last_step < 3).
// Idempotency: checked before calling — analytics_events prevents duplicates.

export async function sendOnboardingReminderEmail(params: {
  to: string
  nombre: string
  lastStep: number
}): Promise<EmailResult> {
  const guard = canSendTo(params.to)
  if (!guard.allowed) {
    console.log(`[Email] Onboarding reminder skipped for ${params.to}: ${guard.reason}`)
    return { success: true, skipped: true }
  }

  try {
    const resend = getResend()
    const firstName = params.nombre.split(' ')[0] ?? params.nombre

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: params.to,
      subject: `${firstName}, tu Director de Marketing IA todavía puede conocerte mejor`,
      html: `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:system-ui,-apple-system,sans-serif">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">
    <div style="background:#1B2E6B;padding:28px 40px">
      <h1 style="margin:0;color:#fff;font-size:18px;font-weight:700">✦ Autoridad Seguros AI™</h1>
    </div>
    <div style="padding:28px 40px">
      <p style="margin:0 0 12px;font-size:15px;color:#111827">Hola, <strong>${firstName}</strong>.</p>
      <p style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.6">
        Tu perfil está al ${Math.round((params.lastStep / 5) * 100)}% completado.
        Completar la Entrevista Inteligente de Marca mejora significativamente la personalización de
        tu contenido, tus respuestas a objeciones y tus recomendaciones estratégicas.
      </p>
      <a href="${process.env.NEXT_PUBLIC_APP_URL}/onboarding"
         style="display:inline-block;background:#1B2E6B;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">
        Continuar donde lo dejé →
      </a>
      <p style="margin:20px 0 0;font-size:12px;color:#9ca3af;line-height:1.5">
        Si no quieres recibir recordatorios, puedes configurar tus preferencias en
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/settings" style="color:#6b7280">Configuración</a>.
      </p>
    </div>
  </div>
</body>
</html>`,
    })

    if (error) throw new Error(error.message)
    return { success: true, id: data?.id }

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Email send failed'
    console.error('[Email] Onboarding reminder failed:', msg)
    return { success: false, error: msg }
  }
}
