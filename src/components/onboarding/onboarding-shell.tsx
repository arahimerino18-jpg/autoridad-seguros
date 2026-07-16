'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  onboardingStep1,
  onboardingStep2,
  onboardingSkipInterview,
  onboardingCompleteInterview,
  markFirstValueGenerated,
  completeOnboarding,
} from '@/lib/onboarding/actions'
import { InterviewChat } from '@/components/brand-builder/interview-chat'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OnboardingShellProps {
  initialStep: number
  initialData: {
    nombre: string | null
    especialidades: string[]
    hasInterview: boolean
    hasFirstValue: boolean
    sessionId: string
  }
}

type OnboardingStep = 1 | 2 | 3 | 4 | 5

// ─── Constants ────────────────────────────────────────────────────────────────

const US_STATES = [
  { value: 'FL', label: 'Florida' }, { value: 'TX', label: 'Texas' },
  { value: 'CA', label: 'California' }, { value: 'NY', label: 'New York' },
  { value: 'IL', label: 'Illinois' }, { value: 'AZ', label: 'Arizona' },
  { value: 'NJ', label: 'New Jersey' }, { value: 'GA', label: 'Georgia' },
  { value: 'NC', label: 'North Carolina' }, { value: 'NV', label: 'Nevada' },
  { value: 'CO', label: 'Colorado' }, { value: 'WA', label: 'Washington' },
  { value: 'OTHER', label: 'Otro estado' },
]

const PRODUCTOS = [
  { value: 'medicare',       label: 'Medicare Advantage', emoji: '🏥', desc: 'Planes de salud para mayores de 65' },
  { value: 'aca',            label: 'ACA / Salud',         emoji: '💊', desc: 'Seguros individuales y familiares' },
  { value: 'iul',            label: 'IUL / Vida indexada',  emoji: '📈', desc: 'Seguro de vida con acumulación' },
  { value: 'final_expense',  label: 'Gastos finales',       emoji: '🌿', desc: 'Protección para gastos funerarios' },
  { value: 'life',           label: 'Vida (término)',        emoji: '🛡️', desc: 'Protección familiar básica' },
  { value: 'mortgage',       label: 'Protección hipotecaria',emoji: '🏠', desc: 'Cubre la hipoteca si algo pasa' },
]

const STEP_LABELS = ['Identidad', 'Productos', 'Entrevista', 'Primera generación', 'Listo']

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-[#1B2E6B]">
          Paso {step} de {total}
        </span>
        <span className="text-xs text-gray-400">{STEP_LABELS[step - 1]}</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-[#1B2E6B] to-[#4A90D9] rounded-full transition-all duration-500"
          style={{ width: `${(step / total) * 100}%` }}
        />
      </div>
    </div>
  )
}

// ─── AI Learning feedback ─────────────────────────────────────────────────────

function AIFeedback({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 bg-[#1B2E6B]/5 border border-[#1B2E6B]/15 rounded-xl p-4 mt-4">
      <div className="w-8 h-8 rounded-full bg-[#1B2E6B] flex items-center justify-center shrink-0 text-white text-sm">
        ✦
      </div>
      <p className="text-sm text-[#1B2E6B] leading-relaxed italic">{message}</p>
    </div>
  )
}

// ─── Step 1: Identity ─────────────────────────────────────────────────────────

function Step1Identity({
  initialNombre,
  onNext,
}: {
  initialNombre: string | null
  onNext: () => void
}) {
  const [nombre, setNombre] = useState(initialNombre ?? '')
  const [estado, setEstado] = useState('')
  const [especialidades, setEspecialidades] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggleEsp = (v: string) =>
    setEspecialidades(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v])

  const handleNext = async () => {
    if (!nombre.trim() || !estado || especialidades.length === 0) {
      setError('Completa todos los campos para continuar.')
      return
    }
    setSaving(true)
    const result = await onboardingStep1({ nombre_completo: nombre, estado_usa: estado, especialidades })
    if (!result.success) { setError(result.error ?? 'Error'); setSaving(false); return }
    onNext()
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-1">¿Cómo te llamas?</h2>
        <p className="text-gray-500 text-sm">Tu Director de Marketing IA usará tu nombre para personalizarte todo el contenido.</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Nombre completo</label>
          <input
            type="text"
            value={nombre}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNombre(e.target.value)}
            placeholder="Ej: Arahi Merino"
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#1B2E6B]/30 focus:border-[#1B2E6B]"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">¿En qué estado trabajas principalmente?</label>
          <select
            value={estado}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setEstado(e.target.value)}
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1B2E6B]/30"
          >
            <option value="">Selecciona un estado...</option>
            {US_STATES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">¿En qué categoría(s) tienes licencia?</label>
          <p className="text-xs text-gray-400 mb-3">Selecciona todas las que apliquen</p>
          <div className="grid grid-cols-2 gap-2">
            {PRODUCTOS.map(p => (
              <button
                key={p.value}
                type="button"
                onClick={() => toggleEsp(p.value)}
                className={cn(
                  'flex items-center gap-2 p-3 rounded-xl border-2 text-left transition-all',
                  especialidades.includes(p.value)
                    ? 'border-[#1B2E6B] bg-[#1B2E6B]/5 text-[#1B2E6B]'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                )}
              >
                <span className="text-lg">{p.emoji}</span>
                <span className="text-xs font-semibold">{p.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

      {nombre && estado && especialidades.length > 0 && (
        <AIFeedback message={`Perfecto, ${nombre}. Entiendo que trabajas en ${estado} con enfoque en ${especialidades.join(', ')}. Vamos a configurar tu Director de Marketing IA.`} />
      )}

      <button
        onClick={handleNext}
        disabled={saving}
        className="w-full py-3.5 rounded-xl bg-[#1B2E6B] text-white font-semibold hover:bg-[#16255a] transition-colors disabled:opacity-50"
      >
        {saving ? 'Guardando...' : 'Continuar →'}
      </button>
    </div>
  )
}

// ─── Step 2: Products ─────────────────────────────────────────────────────────

function Step2Products({
  initialProductos,
  agentName,
  onNext,
}: {
  initialProductos: string[]
  agentName: string
  onNext: () => void
}) {
  const [productos, setProductos] = useState<string[]>(initialProductos)
  const [saving, setSaving] = useState(false)

  const toggle = (v: string) =>
    setProductos(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v])

  const handleNext = async () => {
    if (productos.length === 0) return
    setSaving(true)
    await onboardingStep2({ productos })
    onNext()
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-1">¿Qué productos quieres posicionar?</h2>
        <p className="text-gray-500 text-sm">Esto calibra todo el contenido, las objeciones y las recomendaciones estratégicas hacia tus productos reales.</p>
      </div>

      <div className="space-y-3">
        {PRODUCTOS.map(p => (
          <button
            key={p.value}
            type="button"
            onClick={() => toggle(p.value)}
            className={cn(
              'w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all',
              productos.includes(p.value)
                ? 'border-[#1B2E6B] bg-[#1B2E6B]/5'
                : 'border-gray-200 hover:border-gray-300'
            )}
          >
            <span className="text-2xl">{p.emoji}</span>
            <div className="flex-1">
              <p className={cn('font-semibold text-sm', productos.includes(p.value) ? 'text-[#1B2E6B]' : 'text-gray-800')}>
                {p.label}
              </p>
              <p className="text-xs text-gray-500">{p.desc}</p>
            </div>
            {productos.includes(p.value) && (
              <span className="text-[#1B2E6B] font-bold text-lg">✓</span>
            )}
          </button>
        ))}
      </div>

      {productos.length > 0 && (
        <AIFeedback message={`Esta información ayudará a que tu contenido suene más como tú, ${agentName}. Ahora entiendo mejor qué productos quieres posicionar.`} />
      )}

      <button
        onClick={handleNext}
        disabled={saving || productos.length === 0}
        className="w-full py-3.5 rounded-xl bg-[#1B2E6B] text-white font-semibold hover:bg-[#16255a] transition-colors disabled:opacity-50"
      >
        {saving ? 'Guardando...' : `Continuar con ${productos.length} producto${productos.length !== 1 ? 's' : ''} →`}
      </button>
    </div>
  )
}

// ─── Step 3: Interview ────────────────────────────────────────────────────────

function Step3Interview({
  sessionId,
  onComplete,
  onSkip,
}: {
  sessionId: string
  agentName?: string
  onComplete: (sid: string) => void
  onSkip: () => void
}) {
  const [skipping, setSkipping] = useState(false)
  const [showInterview, setShowInterview] = useState(false)

  const handleSkip = async () => {
    setSkipping(true)
    await onboardingSkipInterview()
    onSkip()
  }

  if (!showInterview) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-1">La Entrevista Inteligente de Marca</h2>
          <p className="text-gray-500 text-sm">Marco, tu asistente de IA, hará 8–12 preguntas conversacionales para entender tu historia, tu voz y tu estilo.</p>
        </div>

        <div className="bg-gradient-to-br from-[#1B2E6B] to-[#2a4080] rounded-2xl p-5 text-white">
          <p className="text-sm font-semibold mb-3 text-blue-200">Con esta entrevista, la IA personaliza:</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              '✍️ Marketing Copilot', '📊 AI Growth Engine',
              '🎬 Content Studio', '🛡️ Objection AI',
              '🎯 Recomendaciones', '💡 Cliente Ideal',
            ].map(item => (
              <div key={item} className="text-xs text-blue-100">{item}</div>
            ))}
          </div>
          <p className="text-xs text-blue-300 mt-3">Duración estimada: 5–8 minutos</p>
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={() => setShowInterview(true)}
            className="w-full py-3.5 rounded-xl bg-[#1B2E6B] text-white font-semibold hover:bg-[#16255a] transition-colors"
          >
            🎙️ Comenzar entrevista ahora
          </button>
          <button
            onClick={handleSkip}
            disabled={skipping}
            className="w-full py-2.5 rounded-xl border border-gray-200 text-gray-500 text-sm hover:bg-gray-50 transition-colors"
          >
            {skipping ? 'Guardando...' : 'Completar después → (el contenido será menos personalizado)'}
          </button>
        </div>

        <p className="text-xs text-center text-gray-400">
          Puedes completar la entrevista en cualquier momento desde Brand Builder → Inteligencia IA
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">Entrevista con Marco</h2>
        <button
          onClick={handleSkip}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          Completar después
        </button>
      </div>
      <div className="h-[500px]">
        <InterviewChat
          initialSessionId={sessionId}
          onComplete={(sid?: string) => {
            void onboardingCompleteInterview(sid ?? sessionId).then(() => onComplete(sid ?? sessionId))
          }}
          onSkip={handleSkip}
        />
      </div>
    </div>
  )
}

// ─── Step 4: First Value Generation ──────────────────────────────────────────

function Step4FirstValue({
  agentName,
  especialidades,
}: {
  agentName: string
  especialidades: string[]
  onComplete: () => void
}) {
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const primaryProduct = especialidades[0] ?? 'general'

  const generate = async () => {
    setGenerating(true)
    setError(null)
    try {
      const response = await fetch('/api/ai/content-studio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'instagram_post',
          producto: primaryProduct,
          canal: 'instagram',
          objetivo: 'educacion',
          instrucciones_adicionales: 'Este es el primer contenido para establecer mi autoridad digital. Hazlo memorable, auténtico y específico para la comunidad hispana.',
          onboarding_mode: true,
        }),
      })

      if (!response.ok) {
        const data = await response.json() as { error?: string }
        throw new Error(data.error ?? 'Error al generar')
      }

      const reader = response.body!.getReader()
      const decoder = new TextDecoder()
      let fullText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        for (const line of chunk.split('\n').filter(l => l.startsWith('data: '))) {
          const raw = line.slice(6)
          if (raw === '[DONE]') break
          try {
            const msg = JSON.parse(raw) as { text?: string; done?: boolean; content?: string }
            if (msg.text) { fullText += msg.text; setResult(fullText) }
            if (msg.done && msg.content) { setResult(msg.content); fullText = msg.content }
          } catch { /* ignore */ }
        }
      }

      // Mark activation event
      await markFirstValueGenerated()

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al generar el contenido')
    } finally {
      setGenerating(false)
    }
  }

  const handleCopy = async () => {
    if (!result) return
    await navigator.clipboard.writeText(result)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleFinish = async () => {
    setSaving(true)
    await completeOnboarding()
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Tu primera recomendación personalizada</h2>
        <p className="text-gray-500 text-sm">
          Ya tengo suficiente contexto para crear tu primer contenido. Esto es lo que el Director de Marketing IA
          puede hacer por ti, todos los días.
        </p>
      </div>

      {!result && !generating && (
        <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl border border-gray-200 p-6 text-center">
          <div className="text-4xl mb-3">✨</div>
          <p className="text-sm font-semibold text-gray-700 mb-1">
            Generando un post de Instagram sobre {primaryProduct === 'medicare' ? 'Medicare' : primaryProduct === 'aca' ? 'ACA/Salud' : primaryProduct === 'iul' ? 'IUL' : 'seguros'} en tu voz
          </p>
          <p className="text-xs text-gray-400 mb-4">Personalizado para {agentName} y la comunidad hispana</p>
          <button
            onClick={generate}
            className="px-6 py-3 rounded-xl bg-[#1B2E6B] text-white font-semibold hover:bg-[#16255a] transition-colors"
          >
            ✦ Generar mi primer contenido
          </button>
        </div>
      )}

      {generating && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-[#1B2E6B] animate-pulse" />
            <span className="text-xs text-[#1B2E6B] font-medium">Tu Director de Marketing IA está escribiendo...</span>
          </div>
          {result && (
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{result}</p>
          )}
        </div>
      )}

      {result && !generating && (
        <div className="space-y-3">
          <div className="bg-white rounded-2xl border-2 border-[#1B2E6B]/20 p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-[#1B2E6B] bg-[#1B2E6B]/10 px-2 py-1 rounded-full">
                📱 Instagram Post · {primaryProduct}
              </span>
              <button
                onClick={handleCopy}
                className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
              >
                {copied ? '✓ Copiado' : '⎘ Copiar'}
              </button>
            </div>
            <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{result}</p>
          </div>

          <AIFeedback message="Este es solo el comienzo. Una vez en el dashboard, puedes generar cientos de variaciones, para todos tus productos, en todos los formatos y canales." />

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3">
            <button
              onClick={generate}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              ↺ Regenerar
            </button>
            <button
              onClick={handleFinish}
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-[#1B2E6B] text-white text-sm font-semibold hover:bg-[#16255a] transition-colors disabled:opacity-50"
            >
              {saving ? 'Entrando al dashboard...' : 'Ir a mi dashboard →'}
            </button>
          </div>
        </div>
      )}

      {!result && !generating && error && (
        <div className="space-y-3">
          <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</p>
          <button
            onClick={generate}
            className="w-full py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600"
          >
            ↺ Intentar de nuevo
          </button>
          <button
            onClick={handleFinish}
            disabled={saving}
            className="w-full py-2.5 rounded-xl bg-gray-100 text-gray-600 text-sm"
          >
            Continuar sin generar
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Main Shell ───────────────────────────────────────────────────────────────

export function OnboardingShell({ initialStep, initialData }: OnboardingShellProps) {
  const router = useRouter()
  const [step, setStep] = useState<OnboardingStep>(
    Math.min(Math.max(initialStep, 1), 4) as OnboardingStep
  )
  const [agentData] = useState({
    nombre: initialData.nombre ?? '',
    especialidades: initialData.especialidades,
  })

  const advanceTo = useCallback((next: OnboardingStep) => {
    setStep(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-6 py-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#1B2E6B] flex items-center justify-center text-white text-xs font-bold">
              A
            </div>
            <span className="text-sm font-semibold text-gray-800">Autoridad Seguros AI™</span>
          </div>
          <span className="text-xs text-gray-400">Configuración inicial</span>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto px-6 py-8">
        {/* AI Director context header */}
        <div className="mb-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#1B2E6B] to-[#4A90D9] flex items-center justify-center mx-auto mb-3 text-white text-2xl shadow-lg">
            ✦
          </div>
          <h1 className="text-base font-semibold text-gray-700">
            Configurando tu Director de Marketing IA
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Especializado en seguros · Comunidad hispana
          </p>
        </div>

        {/* Progress */}
        <div className="mb-8">
          <ProgressBar step={step} total={4} />
        </div>

        {/* Step content */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          {step === 1 && (
            <Step1Identity
              initialNombre={agentData.nombre || null}
              onNext={() => advanceTo(2)}
            />
          )}

          {step === 2 && (
            <Step2Products
              initialProductos={agentData.especialidades}
              agentName={agentData.nombre}
              onNext={() => advanceTo(3)}
            />
          )}

          {step === 3 && (
            <Step3Interview
              sessionId={initialData.sessionId}
              agentName={agentData.nombre}
              onComplete={(_sid) => advanceTo(4)}
              onSkip={() => advanceTo(4)}
            />
          )}

          {step === 4 && (
            <Step4FirstValue
              agentName={agentData.nombre}
              especialidades={agentData.especialidades}
              onComplete={() => router.push('/dashboard?welcome=1')}
            />
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 mt-6">
          Tu progreso se guarda automáticamente. Puedes continuar en cualquier momento.
        </p>
      </div>
    </div>
  )
}
