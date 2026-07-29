'use client'

import { useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button, Alert } from '@/components/ui'
import {
  getChannelsByFamily,
  getChannel,
  type ChannelId,
  type ChannelFamily,
} from '@/lib/content-studio/channel-registry'
import { useContentGeneration } from '@/hooks/use-content-generation'
import { ContentPreview, ComplianceBadge } from './preview-components'
import { saveContentAction } from '@/lib/content-studio/actions'
import { useToast } from '@/hooks/use-toast'

// ─── Family labels ────────────────────────────────────────────────────────────

const FAMILY_LABELS: Record<ChannelFamily, string> = {
  static_post: 'Posts',
  visual_sequence: 'Visual',
  video_script: 'Video',
  direct_message: 'Mensajes',
  component: 'Componentes',
}

// ─── Products ─────────────────────────────────────────────────────────────────

const PRODUCTOS = [
  { value: 'medicare', label: 'Medicare', emoji: '🏥' },
  { value: 'aca', label: 'ACA / Salud', emoji: '💊' },
  { value: 'iul', label: 'IUL / Vida', emoji: '📈' },
  { value: 'final_expense', label: 'Gastos Finales', emoji: '🌿' },
  { value: 'life', label: 'Seguro de Vida', emoji: '🛡️' },
  { value: 'mortgage', label: 'Hipotecario', emoji: '🏠' },
  { value: 'general', label: 'General', emoji: '⭐' },
]

const OBJETIVOS = [
  { value: 'educar', label: 'Educar', desc: 'Enseña algo valioso' },
  { value: 'conectar', label: 'Conectar', desc: 'Crea confianza' },
  { value: 'convertir', label: 'Convertir', desc: 'Genera leads' },
  { value: 'retener', label: 'Retener', desc: 'Fideliza clientes' },
]

// ─── Modification buttons ─────────────────────────────────────────────────────

const MODIFICACIONES = [
  { id: 'mas_humano' as const, label: '❤️ Más humano' },
  { id: 'mas_profesional' as const, label: '💼 Más profesional' },
  { id: 'mas_emocional' as const, label: '🔥 Más emocional' },
  { id: 'mas_corto' as const, label: '✂️ Más corto' },
  { id: 'mas_directo' as const, label: '⚡ Más directo' },
  { id: 'regenerar' as const, label: '🔄 Regenerar' },
]

// ─── Channel selector grid ────────────────────────────────────────────────────

function ChannelGrid({
  selected,
  onSelect,
}: {
  selected: ChannelId | null
  onSelect: (id: ChannelId) => void
}) {
  const byFamily = getChannelsByFamily()

  return (
    <div className="space-y-4">
      {(Object.entries(byFamily) as [ChannelFamily, ReturnType<typeof getChannelsByFamily>[ChannelFamily]][]).map(
        ([family, channels]) => (
          <div key={family}>
            <p className="text-2xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              {FAMILY_LABELS[family]}
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {channels.map((channel) => (
                <button
                  key={channel.id}
                  onClick={() => onSelect(channel.id)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-xl border text-left transition-all',
                    selected === channel.id
                      ? 'bg-[#1B2E6B] text-white border-[#1B2E6B]'
                      : 'bg-white border-gray-200 hover:border-[#6B88C4] text-gray-700'
                  )}
                >
                  <span className="text-base">{channel.emoji}</span>
                  <span className="text-xs font-medium truncate">{channel.label}</span>
                </button>
              ))}
            </div>
          </div>
        )
      )}
    </div>
  )
}

// ─── Intent form ──────────────────────────────────────────────────────────────

interface IntentFormProps {
  channelId: ChannelId
  initialTema?: string
  initialProducto?: string
  initialObjetivo?: string
  growthOutputId?: string
  onGenerate: (params: {
    tema: string
    producto: string
    objetivo: string
    instruccion_extra?: string
    growth_output_id?: string
  }) => void
  isGenerating: boolean
  usageCount: number
  usageMax: number
}

function IntentForm({
  channelId,
  initialTema = '',
  initialProducto = 'medicare',
  initialObjetivo = 'educar',
  growthOutputId,
  onGenerate,
  isGenerating,
  usageCount,
  usageMax,
}: IntentFormProps) {
  const [tema, setTema] = useState(initialTema)
  const [producto, setProducto] = useState(initialProducto)
  const [objetivo, setObjetivo] = useState(initialObjetivo)
  const [instruccion, setInstruccion] = useState('')

  const channel = getChannel(channelId)
  const atLimit = usageMax !== -1 && usageCount >= usageMax

  return (
    <div className="space-y-4">
      {/* Usage indicator */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-500">Generaciones este mes</span>
        <span className={cn('font-medium', atLimit ? 'text-danger' : 'text-gray-700')}>
          {usageCount}/{usageMax === -1 ? '∞' : usageMax}
        </span>
      </div>
      {usageMax !== -1 && (
        <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full', atLimit ? 'bg-danger' : 'bg-[#1B2E6B]')}
            style={{ width: `${Math.min(100, (usageCount / usageMax) * 100)}%` }}
          />
        </div>
      )}

      {/* Canal indicator */}
      <div className="flex items-center gap-2 bg-[#EEF1F8] rounded-xl px-3 py-2">
        <span className="text-lg">{channel.emoji}</span>
        <span className="text-sm font-medium text-brand-navy-700">{channel.label}</span>
      </div>

      {/* Tema */}
      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
          ¿De qué trata este contenido? *
        </label>
        <textarea
          value={tema}
          onChange={(e) => setTema(e.target.value)}
          rows={3}
          placeholder={`Ej: El AEP de Medicare empieza el 15 de octubre — familias cubanas en Miami que necesitan revisar su plan antes de que sea tarde`}
          className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2E6B] resize-none"
        />
      </div>

      {/* Producto */}
      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-2">Producto</label>
        <div className="grid grid-cols-4 gap-1.5">
          {PRODUCTOS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setProducto(p.value)}
              className={cn(
                'flex flex-col items-center gap-0.5 p-2 rounded-lg border transition-all',
                producto === p.value
                  ? 'bg-[#1B2E6B] text-white border-[#1B2E6B]'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              )}
            >
              <span className="text-base">{p.emoji}</span>
              <span className="text-2xs font-medium">{p.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Objetivo */}
      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-2">Objetivo</label>
        <div className="grid grid-cols-2 gap-2">
          {OBJETIVOS.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => setObjetivo(o.value)}
              className={cn(
                'text-left px-3 py-2 rounded-xl border transition-all',
                objetivo === o.value
                  ? 'bg-[#1B2E6B] text-white border-[#1B2E6B]'
                  : 'bg-white border-gray-200 hover:border-gray-300'
              )}
            >
              <p className={cn('text-xs font-semibold', objetivo === o.value ? 'text-white' : 'text-gray-800')}>
                {o.label}
              </p>
              <p className={cn('text-2xs', objetivo === o.value ? 'text-white/70' : 'text-gray-400')}>
                {o.desc}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Extra instruction */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">
          Instrucción especial (opcional)
        </label>
        <input
          value={instruccion}
          onChange={(e) => setInstruccion(e.target.value)}
          maxLength={200}
          placeholder="Ej: Menciona que hay planes sin costo mensual"
          className="w-full h-9 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2E6B]"
        />
      </div>

      <Button
        onClick={() =>
          onGenerate({
            tema,
            producto,
            objetivo,
            instruccion_extra: instruccion || undefined,
            growth_output_id: growthOutputId,
          })
        }
        className="w-full"
        size="lg"
        isLoading={isGenerating}
        loadingText="Generando..."
        disabled={!tema.trim() || atLimit}
      >
        {atLimit ? 'Límite alcanzado — Actualiza tu plan' : `Generar ${channel.label} →`}
      </Button>
    </div>
  )
}

// ─── Main Content Studio ──────────────────────────────────────────────────────

interface ContentStudioProps {
  agentHandle?: string
  usageCount: number
  usageMax: number
}

export function ContentStudio({ agentHandle, usageCount, usageMax }: ContentStudioProps) {
  const searchParams = useSearchParams()
  const { toast } = useToast()

  // Pre-fill from URL params (when coming from Copilot)
  const initialChannel = (searchParams.get('tipo') as ChannelId) ?? 'instagram_post'
  const initialTema = searchParams.get('tema') ?? ''
  const initialProducto = searchParams.get('producto') ?? 'medicare'
  const growthOutputId = searchParams.get('growth_output_id') ?? undefined

  const [selectedChannel, setSelectedChannel] = useState<ChannelId>(initialChannel)
  const [isSaving, setIsSaving] = useState(false)
  const [customInstruction, setCustomInstruction] = useState('')
  const [showCustomInput, setShowCustomInput] = useState(false)

  const {
    state,
    generate,
    modify,
    reset,
    isGenerating,
    isModifying,
    isComplete,
  } = useContentGeneration()

  const handleGenerate = useCallback(
    (params: {
      tema: string
      producto: string
      objetivo: string
      instruccion_extra?: string
      growth_output_id?: string
    }) => {
      void generate({ channelId: selectedChannel, ...params })
    },
    [selectedChannel, generate]
  )

  const handleChannelChange = (channelId: ChannelId) => {
    setSelectedChannel(channelId)
    reset()
  }

  const handleAdaptToChannel = (targetChannelId: ChannelId) => {
    if (!state.parsedOutput) return
    // Re-generate for the new channel preserving context
    const currentTema = searchParams.get('tema') ?? ''
    void generate({
      channelId: targetChannelId,
      tema: currentTema,
      producto: initialProducto,
      objetivo: 'educar',
      contenido_origen_id: undefined,
    })
    setSelectedChannel(targetChannelId)
  }

  const handleSave = async () => {
    if (!state.parsedOutput) return
    setIsSaving(true)

    const result = await saveContentAction({
      channelId: selectedChannel,
      producto: initialProducto,
      objetivo: 'educar',
      tema: initialTema || 'Contenido generado',
      output: state.parsedOutput,
      compliance_nivel: state.compliance?.risk_level === 'LOW' ? 'verde' : state.compliance?.risk_level === 'HIGH' ? 'rojo' : state.compliance?.nivel ?? 'amarillo',
      growth_output_id: growthOutputId,
    })

    if (result.success) {
      toast.success('¡Guardado!', 'El contenido se guardó en tu biblioteca.')
    } else {
      toast.error('Error', result.error)
    }
    setIsSaving(false)
  }

  const channel = getChannel(selectedChannel)
  const channelsByFamily = getChannelsByFamily()
  const activeChannelIds = Object.values(channelsByFamily)
    .flat()
    .map((c) => c.id)
    .filter((id) => id !== selectedChannel)

  return (
    <div className="flex h-full gap-0 animate-fade-in">
      {/* Left panel: channel selector */}
      <div className="w-64 shrink-0 bg-white border-r border-gray-100 overflow-y-auto p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
          Canal
        </p>
        <ChannelGrid selected={selectedChannel} onSelect={handleChannelChange} />
      </div>

      {/* Center panel: intent form or streaming */}
      <div className="w-80 shrink-0 border-r border-gray-100 bg-surface-subtle overflow-y-auto p-4">
        <IntentForm
          channelId={selectedChannel}
          initialTema={initialTema}
          initialProducto={initialProducto}
          initialObjetivo="educar"
          growthOutputId={growthOutputId}
          onGenerate={handleGenerate}
          isGenerating={isGenerating}
          usageCount={usageCount}
          usageMax={usageMax}
        />
      </div>

      {/* Right panel: preview + modification */}
      <div className="flex-1 flex flex-col min-w-0 bg-surface-subtle overflow-y-auto p-5">
        {/* Error */}
        {state.error && (
          <Alert variant="danger" className="mb-4">{state.error}</Alert>
        )}

        {/* Idle state */}
        {state.status === 'idle' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-16">
            <span className="text-5xl mb-4">{channel.emoji}</span>
            <p className="text-base font-semibold text-gray-700 mb-1">{channel.label}</p>
            <p className="text-sm text-gray-400">
              Completa el formulario y genera tu contenido
            </p>
          </div>
        )}

        {/* Streaming state */}
        {(isGenerating || isModifying) && !state.parsedOutput && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#EEF1F8] flex items-center justify-center">
              <span className="text-2xl animate-pulse">{channel.emoji}</span>
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-700">
                {isModifying ? 'Aplicando modificación...' : 'Generando contenido...'}
              </p>
              <p className="text-xs text-gray-400 mt-1">Usando tu perfil de agente</p>
            </div>
            {state.rawStream && (
              <div className="w-full max-w-sm bg-white rounded-xl border border-gray-100 p-3 font-mono text-xs text-gray-500 line-clamp-4 overflow-hidden">
                {state.rawStream.slice(-200)}
                <span className="animate-blink">▋</span>
              </div>
            )}
          </div>
        )}

        {/* Complete state */}
        {isComplete && state.parsedOutput && (
          <div className="space-y-4 animate-fade-in">
            {/* Preview */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-5">
              <ContentPreview
                channelId={selectedChannel}
                channelLabel={channel.label}
                output={state.parsedOutput}
                agentHandle={agentHandle}
              />
            </div>

            {/* Compliance badge — Phase 10 engine */}
            {state.compliance && (
              <ComplianceBadge
                complianceResult={state.compliance}
              />
            )}

            {/* Modification buttons */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Modificar
              </p>
              <div className="flex flex-wrap gap-2">
                {MODIFICACIONES.map((mod) => (
                  <button
                    key={mod.id}
                    onClick={() => void modify(mod.id)}
                    disabled={isModifying}
                    className="text-xs px-3 py-1.5 rounded-full border border-gray-200 bg-white hover:border-[#6B88C4] hover:bg-[#EEF1F8] transition-all disabled:opacity-50"
                  >
                    {mod.label}
                  </button>
                ))}
                <button
                  onClick={() => setShowCustomInput(!showCustomInput)}
                  className="text-xs px-3 py-1.5 rounded-full border border-brand-gold-200 bg-brand-gold-50 text-brand-gold-700 hover:bg-brand-gold-100 transition-all"
                >
                  ✏️ Instrucción propia
                </button>
              </div>

              {showCustomInput && (
                <div className="mt-3 flex gap-2 animate-fade-in">
                  <input
                    value={customInstruction}
                    onChange={(e) => setCustomInstruction(e.target.value)}
                    placeholder="Ej: Agrega una historia sobre una clienta de 67 años"
                    className="flex-1 h-9 text-sm rounded-lg border border-gray-300 px-3 focus:outline-none focus:ring-2 focus:ring-[#1B2E6B]"
                  />
                  <Button
                    size="sm"
                    onClick={() => { void modify('custom', customInstruction); setShowCustomInput(false) }}
                    disabled={!customInstruction.trim() || isModifying}
                  >
                    Aplicar
                  </Button>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={reset}
                className="flex-1"
              >
                ← Nuevo contenido
              </Button>
              <Button
                onClick={handleSave}
                isLoading={isSaving}
                loadingText="Guardando..."
                className="flex-1"
              >
                Guardar contenido
              </Button>
            </div>

            {/* Adapt to other channels */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Adaptar a otro canal
              </p>
              <div className="flex flex-wrap gap-2">
                {activeChannelIds.slice(0, 6).map((id) => {
                  const ch = getChannel(id)
                  return (
                    <button
                      key={id}
                      onClick={() => handleAdaptToChannel(id)}
                      disabled={isGenerating}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-gray-200 bg-white hover:border-[#6B88C4] hover:bg-[#EEF1F8] transition-all"
                    >
                      <span>{ch.emoji}</span>
                      <span>{ch.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
