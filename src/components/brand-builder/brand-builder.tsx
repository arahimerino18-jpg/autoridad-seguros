'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { InterviewChat } from './interview-chat'
import { TabIdentidad } from './tab-identidad'
import { TabMarcaPersonal, TabPublico, TabVisual, TabRedes } from './tabs'
import { TabInteligenciaIA } from './tab-inteligencia-ia'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BrandBuilderData {
  // From profiles
  nombre_completo: string
  especialidades: string[]
  // From brand_kits
  nombre_comercial: string | null
  nombre_agencia: string | null
  anos_experiencia: number | null
  certificaciones: string[] | null
  estados_licencia: string[] | null
  numero_licencia: string | null
  color_primario: string
  color_secundario: string
  color_acento: string | null
  tipografia_principal: string | null
  tipografia_secundaria: string | null
  estilo_grafico: string | null
  estilo_fotografico: string | null
  tagline: string | null
  logo_url: string | null
  logo_variante_blanca_url: string | null
  logo_icono_url: string | null
  instagram_handle: string | null
  facebook_url: string | null
  tiktok_handle: string | null
  linkedin_url: string | null
  youtube_url: string | null
  pinterest_url: string | null
  whatsapp_business: string | null
  calendly_url: string | null
  sitio_web: string | null
  // From agent_intelligence_profiles
  tono_comunicacion: string | null
  nivel_formalidad: number | null
  estilo_escritura: string | null
  tipo_humor: string | null
  nivel_emocional: string | null
  usa_emojis: boolean
  usa_historias: boolean
  usa_estadisticas: boolean
  frases_propias: string[] | null
  palabras_a_evitar: string[] | null
  ctas_efectivos: string[] | null
  propuesta_de_valor: string | null
  diferenciadores: string[] | null
  longitud_preferida: string | null
  historia_profesional: string | null
  historia_personal: string | null
  mision: string | null
  vision: string | null
  valores: string[] | null
  mercado_objetivo: string | null
  cliente_ideal_descripcion: string | null
  nichos_secundarios: string[] | null
  productos_principales: string[] | null
  problemas_que_resuelve: string[] | null
  objeciones_frecuentes: Array<{ objecion: string; respuesta: string; categoria: string }> | null
  metas_negocio: { corto_plazo: string; largo_plazo: string } | null
  fuente_leads_principal: string | null
  tasa_cierre_estimada: number | null
  score_perfil_completitud: number
  entrevista_completada: boolean
  idiomas: string[]
}

// ─── Tab definitions ──────────────────────────────────────────────────────────

interface TabDef {
  id: string
  label: string
  icon: string
  fieldsToCheck: (keyof BrandBuilderData)[]
}

const TABS: TabDef[] = [
  {
    id: 'identidad',
    label: 'Identidad',
    icon: '👤',
    fieldsToCheck: ['nombre_comercial', 'historia_personal', 'historia_profesional', 'mision', 'valores'],
  },
  {
    id: 'marca',
    label: 'Marca Personal',
    icon: '✍️',
    fieldsToCheck: ['tono_comunicacion', 'propuesta_de_valor', 'frases_propias', 'ctas_efectivos'],
  },
  {
    id: 'publico',
    label: 'Público',
    icon: '🎯',
    fieldsToCheck: ['mercado_objetivo', 'cliente_ideal_descripcion', 'objeciones_frecuentes'],
  },
  {
    id: 'visual',
    label: 'Visual',
    icon: '🎨',
    fieldsToCheck: ['color_primario', 'tagline', 'logo_url', 'estilo_grafico'],
  },
  {
    id: 'redes',
    label: 'Redes',
    icon: '🌐',
    fieldsToCheck: ['instagram_handle', 'whatsapp_business', 'sitio_web'],
  },
  {
    id: 'inteligencia',
    label: 'Inteligencia IA',
    icon: '🧠',
    fieldsToCheck: [],
  },
]

function getTabCompletion(tab: TabDef, data: BrandBuilderData): number {
  const filled = tab.fieldsToCheck.filter((f) => {
    const val = data[f]
    if (val === null || val === undefined) return false
    if (typeof val === 'string') return val.length > 0
    if (Array.isArray(val)) return val.length > 0
    return !!val
  }).length
  return Math.round((filled / tab.fieldsToCheck.length) * 100)
}

// ─── Score circle ─────────────────────────────────────────────────────────────

function ScoreCircle({ score }: { score: number }) {
  const r = 28
  const c = 2 * Math.PI * r
  const dashOffset = c - (score / 100) * c

  const color = score < 40 ? '#EF4444' : score < 70 ? '#F59E0B' : '#10B981'
  const label = score < 40 ? 'Básico' : score < 70 ? 'En progreso' : score < 90 ? 'Avanzado' : 'Completo'

  return (
    <div className="flex items-center gap-3">
      <div className="relative w-16 h-16">
        <svg viewBox="0 0 64 64" className="transform -rotate-90">
          <circle cx="32" cy="32" r={r} fill="none" stroke="#F3F4F6" strokeWidth="6" />
          <circle
            cx="32"
            cy="32"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeDasharray={c}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold text-gray-800">{score}%</span>
        </div>
      </div>
      <div>
        <p className="text-sm font-semibold text-gray-800">Perfil de IA</p>
        <p className={cn(
          'text-xs font-medium',
          score < 40 ? 'text-red-500' : score < 70 ? 'text-amber-500' : 'text-emerald-600'
        )}>
          {label}
        </p>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

type BrandBuilderMode = 'choose' | 'interview' | 'tabs'

interface BrandBuilderProps {
  data: BrandBuilderData
  sessionId: string
  userId: string
  intelData?: Record<string, unknown>
}

export function BrandBuilder({ data, sessionId, userId, intelData }: BrandBuilderProps) {
  const [mode, setMode] = useState<BrandBuilderMode>(
    data.entrevista_completada ? 'tabs' : 'choose'
  )
  const [activeTab, setActiveTab] = useState('identidad')
  const [localData, setLocalData] = useState(data)

  const handleDataUpdate = (updates: Partial<BrandBuilderData>) => {
    setLocalData((prev) => ({ ...prev, ...updates }))
  }

  // ── Choose mode ─────────────────────────────────────────────────────────────
  if (mode === 'choose') {
    return (
      <div className="max-w-2xl mx-auto py-8 animate-fade-in">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-brand-navy-50 flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🏗️</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Centro de Identidad Profesional
          </h1>
          <p className="text-gray-500 text-sm max-w-md mx-auto">
            Cuanto más la IA sabe sobre ti, más el contenido generado suena exactamente como tú.
            ¿Cómo quieres empezar?
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={() => setMode('interview')}
            className="text-left p-6 rounded-2xl border-2 border-brand-navy-200 bg-brand-navy-50 hover:border-brand-navy-400 hover:bg-brand-navy-100 transition-all group"
          >
            <span className="text-3xl mb-3 block">🎙️</span>
            <h3 className="font-semibold text-brand-navy-700 mb-1 group-hover:text-brand-navy-900">
              Entrevista Inteligente
            </h3>
            <p className="text-xs text-brand-navy-500 leading-relaxed">
              Responde 8-15 preguntas conversacionales. La IA extrae tu perfil automáticamente.
              La forma más rápida y natural.
            </p>
            <div className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-brand-navy-600">
              Recomendado <span>→</span>
            </div>
          </button>

          <button
            onClick={() => setMode('tabs')}
            className="text-left p-6 rounded-2xl border-2 border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50 transition-all group"
          >
            <span className="text-3xl mb-3 block">📋</span>
            <h3 className="font-semibold text-gray-700 mb-1 group-hover:text-gray-900">
              Completar manualmente
            </h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              Rellena cada sección a tu ritmo. Puedes guardar parcialmente y volver después.
            </p>
            <div className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-gray-500">
              Ir a las secciones <span>→</span>
            </div>
          </button>
        </div>
      </div>
    )
  }

  // ── Interview mode ──────────────────────────────────────────────────────────
  if (mode === 'interview') {
    return (
      <div className="max-w-2xl mx-auto animate-fade-in">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-card-lg overflow-hidden h-[600px] flex flex-col">
          {/* Header */}
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-brand-navy-500 flex items-center justify-center">
                <span className="text-white font-bold text-sm">M</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Marco</p>
                <p className="text-xs text-gray-400">Consultor de Marca · Autoridad Seguros AI</p>
              </div>
            </div>
            <button
              onClick={() => setMode('tabs')}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              Completar manualmente
            </button>
          </div>

          {/* Chat */}
          <div className="flex-1 min-h-0">
            <InterviewChat
              initialSessionId={sessionId}
              onComplete={() => setMode('tabs')}
              onSkip={() => setMode('tabs')}
            />
          </div>
        </div>
      </div>
    )
  }

  // ── Tabs mode ───────────────────────────────────────────────────────────────
  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Centro de Identidad</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Cada campo que completas mejora la calidad del contenido generado por la IA
          </p>
        </div>
        <ScoreCircle score={localData.score_perfil_completitud} />
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
        {/* Tab nav */}
        <div className="flex border-b border-gray-100 overflow-x-auto">
          {TABS.map((tab) => {
            const completion = getTabCompletion(tab, localData)
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-5 py-3.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2',
                  isActive
                    ? 'border-brand-navy-500 text-brand-navy-600 bg-brand-navy-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                )}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
                {completion === 100 ? (
                  <span className="text-emerald-500 text-xs">✓</span>
                ) : completion > 0 ? (
                  <span className="text-xs bg-brand-gold-100 text-brand-gold-600 px-1.5 py-0.5 rounded-full font-medium">
                    {completion}%
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>

        {/* Tab content */}
        <div className="p-6">
          {activeTab === 'identidad' && (
            <TabIdentidad data={localData} onUpdate={handleDataUpdate} />
          )}
          {activeTab === 'marca' && (
            <TabMarcaPersonal data={localData} onUpdate={handleDataUpdate} />
          )}
          {activeTab === 'publico' && (
            <TabPublico data={localData} onUpdate={handleDataUpdate} />
          )}
          {activeTab === 'visual' && (
            <TabVisual data={localData} onUpdate={handleDataUpdate} />
          )}
          {activeTab === 'redes' && (
            <TabRedes data={localData} onUpdate={handleDataUpdate} />
          )}
          {activeTab === 'inteligencia' && (
            <TabInteligenciaIA userId={userId} intelData={intelData ?? {}} />
          )}
        </div>
      </div>

      {/* Interview CTA if not done */}
      {!localData.entrevista_completada && (
        <button
          onClick={() => setMode('interview')}
          className="mt-4 w-full py-3 text-sm font-medium text-brand-navy-500 bg-brand-navy-50 hover:bg-brand-navy-100 rounded-xl border border-brand-navy-100 transition-colors"
        >
          🎙️ O usa la Entrevista Inteligente para completar tu perfil más rápido
        </button>
      )}
    </div>
  )
}
