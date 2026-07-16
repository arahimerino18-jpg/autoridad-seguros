'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createBillingPortalSession } from '@/lib/stripe/checkout'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SettingsClientProps {
  user: { id: string; email: string }
  profile: Record<string, unknown>
  subscription: Record<string, unknown>
  planLimit: Record<string, unknown>
  usageByModule: Record<string, number>
  currentPlan: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PLAN_NAMES: Record<string, string> = {
  starter: 'Starter',
  pro: 'Pro',
  elite: 'Elite',
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active:             { label: 'Activa', color: 'text-green-600 bg-green-50' },
  trialing:           { label: 'Período de prueba', color: 'text-blue-600 bg-blue-50' },
  past_due:           { label: 'Pago pendiente', color: 'text-amber-600 bg-amber-50' },
  canceled:           { label: 'Cancelada', color: 'text-red-600 bg-red-50' },
  incomplete:         { label: 'Incompleta', color: 'text-gray-600 bg-gray-50' },
  incomplete_expired: { label: 'Expirada', color: 'text-gray-600 bg-gray-50' },
  paused:             { label: 'Pausada', color: 'text-gray-600 bg-gray-50' },
}

function UsageMeter({ used, max, label }: { used: number; max: number; label: string }) {
  const isUnlimited = max === -1
  const pct = isUnlimited ? 0 : Math.min((used / max) * 100, 100)
  const color = pct > 80 ? 'bg-red-400' : pct > 60 ? 'bg-amber-400' : 'bg-[#1B2E6B]'

  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs text-gray-600">{label}</span>
        <span className="text-xs font-semibold text-gray-700">
          {used} / {isUnlimited ? '∞' : max}
        </span>
      </div>
      {!isUnlimited && (
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
        </div>
      )}
      {/* Briefing de Lunes */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 mt-4">
        <h2 className="text-base font-bold text-gray-800 mb-1">📋 Briefing semanal</h2>
        <p className="text-sm text-gray-500 mb-4">Tu resumen estratégico de cada lunes, generado con tu contexto real.</p>
        <div className="flex gap-3">
          <a
            href="/api/briefing"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Ver briefing actual
          </a>
          <button
            onClick={async () => {
              const res = await fetch('/api/briefing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
              const data = await res.json() as { briefing?: { briefing_texto?: string }; already_existed?: boolean; error?: string }
              if (data.error) alert('Error: ' + data.error)
              else if (data.already_existed) alert('Ya existe un briefing para esta semana.')
              else alert('✓ Briefing generado correctamente.')
            }}
            className="px-4 py-2 rounded-lg bg-[#1B2E6B] text-white text-sm font-semibold hover:bg-[#16255a] transition-colors"
          >
            Generar ahora
          </button>
        </div>
      </div>

      {/* Exportación de datos */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 mt-4">
        <h2 className="text-base font-bold text-gray-800 mb-1">📦 Exportar mis datos</h2>
        <p className="text-sm text-gray-500 mb-1">
          Descarga una copia completa de tu información: perfil IA, contenidos, objeciones, historial y métricas.
        </p>
        <p className="text-xs text-gray-400 mb-4">
          No incluye contraseñas, tokens, claves API ni datos financieros sensibles.
          Aislamiento estricto por cuenta — solo tus datos.
        </p>
        <div className="flex gap-3">
          <a
            href="/api/export/json"
            download
            className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            ⬇ JSON completo
          </a>
          <a
            href="/api/export/pdf"
            download
            className="px-4 py-2 rounded-lg border border-[#1B2E6B]/30 text-[#1B2E6B] text-sm font-semibold hover:bg-[#1B2E6B]/5 transition-colors flex items-center gap-2"
          >
            ⬇ Resumen PDF
          </a>
        </div>
        <p className="text-xs text-gray-400 mt-3">
          Cada exportación queda registrada en tu historial de actividad.
        </p>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-4">
      <h2 className="text-base font-bold text-gray-800 mb-5 pb-3 border-b border-gray-100">{title}</h2>
      {children}
      {/* Briefing de Lunes */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 mt-4">
        <h2 className="text-base font-bold text-gray-800 mb-1">📋 Briefing semanal</h2>
        <p className="text-sm text-gray-500 mb-4">Tu resumen estratégico de cada lunes, generado con tu contexto real.</p>
        <div className="flex gap-3">
          <a
            href="/api/briefing"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Ver briefing actual
          </a>
          <button
            onClick={async () => {
              const res = await fetch('/api/briefing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
              const data = await res.json() as { briefing?: { briefing_texto?: string }; already_existed?: boolean; error?: string }
              if (data.error) alert('Error: ' + data.error)
              else if (data.already_existed) alert('Ya existe un briefing para esta semana.')
              else alert('✓ Briefing generado correctamente.')
            }}
            className="px-4 py-2 rounded-lg bg-[#1B2E6B] text-white text-sm font-semibold hover:bg-[#16255a] transition-colors"
          >
            Generar ahora
          </button>
        </div>
      </div>

      {/* Exportación de datos */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 mt-4">
        <h2 className="text-base font-bold text-gray-800 mb-1">📦 Exportar mis datos</h2>
        <p className="text-sm text-gray-500 mb-1">
          Descarga una copia completa de tu información: perfil IA, contenidos, objeciones, historial y métricas.
        </p>
        <p className="text-xs text-gray-400 mb-4">
          No incluye contraseñas, tokens, claves API ni datos financieros sensibles.
          Aislamiento estricto por cuenta — solo tus datos.
        </p>
        <div className="flex gap-3">
          <a
            href="/api/export/json"
            download
            className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            ⬇ JSON completo
          </a>
          <a
            href="/api/export/pdf"
            download
            className="px-4 py-2 rounded-lg border border-[#1B2E6B]/30 text-[#1B2E6B] text-sm font-semibold hover:bg-[#1B2E6B]/5 transition-colors flex items-center gap-2"
          >
            ⬇ Resumen PDF
          </a>
        </div>
        <p className="text-xs text-gray-400 mt-3">
          Cada exportación queda registrada en tu historial de actividad.
        </p>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function SettingsClient({
  user,
  profile,
  subscription,
  planLimit,
  usageByModule,
  currentPlan,
}: SettingsClientProps) {
  const [portalLoading, setPortalLoading] = useState(false)
  const [portalError, setPortalError] = useState<string | null>(null)
  const [passwordSent, setPasswordSent] = useState(false)

  const handleBillingPortal = async () => {
    setPortalLoading(true)
    setPortalError(null)
    const result = await createBillingPortalSession('/settings')
    if ('error' in result) {
      setPortalError(result.error)
      setPortalLoading(false)
      return
    }
    window.location.href = result.url
  }

  const handlePasswordReset = async () => {
    // Uses Supabase Auth password reset — sends email
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (!error) setPasswordSent(true)
  }

  const subStatus = (subscription.status as string) ?? 'active'
  const statusConfig = STATUS_LABELS[subStatus] ?? STATUS_LABELS.active
  const periodFin = subscription.periodo_fin as string | null
  const cancelAtEnd = subscription.cancel_at_period_end as boolean | null
  const hasStripeCustomer = !!(subscription.stripe_customer_id)

  const maxContenidos = (planLimit.max_contenidos_mes as number) ?? 30
  const maxCopilot = (planLimit.max_copilot_mes as number) ?? 10
  const maxCompliance = (planLimit.max_compliance_mes as number) ?? 15
  const maxObjection = (planLimit.max_objection_ai_mes as number) ?? 15

  return (
    <div className="space-y-4">

      {/* CUENTA */}
      <Section title="👤 Cuenta">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-400 mb-1">Nombre</p>
              <p className="text-sm font-medium text-gray-800">
                {(profile.nombre_completo as string) || '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Email</p>
              <p className="text-sm font-medium text-gray-800">{user.email}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-400 mb-1">Estado</p>
              <p className="text-sm font-medium text-gray-800">
                {(profile.estado_usa as string) || '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Plan actual</p>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                currentPlan === 'elite' ? 'bg-[#1B2E6B] text-white' :
                currentPlan === 'pro' ? 'bg-[#D4A017] text-white' :
                'bg-gray-100 text-gray-700'
              }`}>
                {PLAN_NAMES[currentPlan] ?? currentPlan}
              </span>
            </div>
          </div>
          <p className="text-xs text-gray-400">
            Para actualizar tu información profesional y perfil de IA, ve a{' '}
            <Link href="/brand-builder" className="text-[#1B2E6B] hover:underline">Brand Builder</Link>.
          </p>
        </div>
      </Section>

      {/* SEGURIDAD */}
      <Section title="🔒 Seguridad">
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-0.5">Contraseña</p>
              <p className="text-xs text-gray-400">
                Recibirás un email con un enlace para cambiar tu contraseña de forma segura.
              </p>
            </div>
            {!passwordSent ? (
              <button
                onClick={handlePasswordReset}
                className="shrink-0 px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cambiar contraseña
              </button>
            ) : (
              <span className="shrink-0 text-xs text-green-600 font-medium bg-green-50 px-3 py-2 rounded-lg">
                ✓ Email enviado
              </span>
            )}
          </div>
          <div className="rounded-lg bg-gray-50 border border-gray-100 p-3">
            <p className="text-xs text-gray-500">
              🔐 Tu contraseña está gestionada de forma segura por Supabase Auth.
              Nunca la almacenamos en texto plano.
            </p>
          </div>
        </div>
      </Section>

      {/* SUSCRIPCIÓN */}
      <Section title="💳 Suscripción">
        <div className="space-y-5">

          {/* Status + Plan */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <p className="text-sm font-bold text-gray-800">
                  Plan {PLAN_NAMES[currentPlan] ?? currentPlan}
                </p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${statusConfig.color}`}>
                  {statusConfig.label}
                </span>
              </div>
              {periodFin && (
                <p className="text-xs text-gray-400">
                  {cancelAtEnd ? 'Cancela el' : 'Próximo cobro:'}{' '}
                  {new Date(periodFin).toLocaleDateString('es-US', { dateStyle: 'long' })}
                </p>
              )}
              {subscription.precio_usd != null && (
                <p className="text-xs text-gray-400 mt-0.5">
                  ${Number(subscription.precio_usd).toFixed(2)}/{(subscription.ciclo as string) === 'annual' ? 'año' : 'mes'}
                </p>
              )}
              {cancelAtEnd && (
                <p className="text-xs text-amber-600 mt-1 font-medium">
                  ⚠️ Tu plan se cancela al final del período actual
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              {currentPlan !== 'elite' && (
                <Link
                  href="/precios"
                  className="shrink-0 px-4 py-2 rounded-lg bg-[#1B2E6B] text-white text-xs font-semibold hover:bg-[#16255a] transition-colors text-center"
                >
                  Mejorar plan
                </Link>
              )}
              {hasStripeCustomer && (
                <button
                  onClick={handleBillingPortal}
                  disabled={portalLoading}
                  className="shrink-0 px-4 py-2 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  {portalLoading ? 'Abriendo...' : 'Gestionar en Stripe →'}
                </button>
              )}
            </div>
          </div>

          {portalError && (
            <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{portalError}</p>
          )}

          {/* Usage this month */}
          <div>
            <p className="text-xs font-semibold text-gray-600 mb-3">Uso este mes</p>
            <div className="space-y-3">
              <UsageMeter
                used={usageByModule.content_studio ?? 0}
                max={maxContenidos}
                label="Piezas de contenido"
              />
              <UsageMeter
                used={usageByModule.marketing_copilot ?? 0}
                max={maxCopilot}
                label="Marketing Copilot"
              />
              <UsageMeter
                used={usageByModule.objection_ai ?? 0}
                max={maxObjection}
                label="Objection AI"
              />
              <UsageMeter
                used={usageByModule.compliance_center ?? 0}
                max={maxCompliance}
                label="Compliance Review"
              />
            </div>
          </div>

          {/* Plan features */}
          <div className="rounded-xl bg-gray-50 border border-gray-100 p-4">
            <p className="text-xs font-semibold text-gray-600 mb-2">Tu plan incluye</p>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { label: 'Contenidos/mes', value: maxContenidos === -1 ? 'Ilimitado' : String(maxContenidos) },
                { label: 'Copilot/mes', value: maxCopilot === -1 ? 'Ilimitado' : String(maxCopilot) },
                { label: 'Objection AI/mes', value: maxObjection === -1 ? 'Ilimitado' : String(maxObjection) },
                { label: 'Video Studio', value: planLimit.tiene_video_studio ? '✓' : '—' },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between py-1">
                  <span className="text-xs text-gray-500">{item.label}</span>
                  <span className="text-xs font-semibold text-gray-700">{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-gray-400">
            🔒 Los datos de pago son gestionados exclusivamente por Stripe.
            Esta aplicación no almacena datos de tarjeta.
          </p>
        </div>
      </Section>
      {/* Briefing de Lunes */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 mt-4">
        <h2 className="text-base font-bold text-gray-800 mb-1">📋 Briefing semanal</h2>
        <p className="text-sm text-gray-500 mb-4">Tu resumen estratégico de cada lunes, generado con tu contexto real.</p>
        <div className="flex gap-3">
          <a
            href="/api/briefing"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Ver briefing actual
          </a>
          <button
            onClick={async () => {
              const res = await fetch('/api/briefing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
              const data = await res.json() as { briefing?: { briefing_texto?: string }; already_existed?: boolean; error?: string }
              if (data.error) alert('Error: ' + data.error)
              else if (data.already_existed) alert('Ya existe un briefing para esta semana.')
              else alert('✓ Briefing generado correctamente.')
            }}
            className="px-4 py-2 rounded-lg bg-[#1B2E6B] text-white text-sm font-semibold hover:bg-[#16255a] transition-colors"
          >
            Generar ahora
          </button>
        </div>
      </div>

      {/* Exportación de datos */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 mt-4">
        <h2 className="text-base font-bold text-gray-800 mb-1">📦 Exportar mis datos</h2>
        <p className="text-sm text-gray-500 mb-1">
          Descarga una copia completa de tu información: perfil IA, contenidos, objeciones, historial y métricas.
        </p>
        <p className="text-xs text-gray-400 mb-4">
          No incluye contraseñas, tokens, claves API ni datos financieros sensibles.
          Aislamiento estricto por cuenta — solo tus datos.
        </p>
        <div className="flex gap-3">
          <a
            href="/api/export/json"
            download
            className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            ⬇ JSON completo
          </a>
          <a
            href="/api/export/pdf"
            download
            className="px-4 py-2 rounded-lg border border-[#1B2E6B]/30 text-[#1B2E6B] text-sm font-semibold hover:bg-[#1B2E6B]/5 transition-colors flex items-center gap-2"
          >
            ⬇ Resumen PDF
          </a>
        </div>
        <p className="text-xs text-gray-400 mt-3">
          Cada exportación queda registrada en tu historial de actividad.
        </p>
      </div>
    </div>
  )
}
