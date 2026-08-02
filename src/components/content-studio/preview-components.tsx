'use client'

/**
 * Content Preview Components — Autoridad Seguros AI™
 *
 * Each component renders a channel's structured output as a visual mockup.
 * The previews are NOT pixel-perfect replicas — they're functional previews
 * that let the agent see how the content will look and copy each field.
 */

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type {
  StaticPostOutput,
  CarouselOutput,
  StoryOutput,
  ReelScriptOutput,
  WhatsAppOutput,
  ContentOutput,
} from '@/lib/content-studio/channel-registry'

// ─── Copy button ──────────────────────────────────────────────────────────────

function CopyButton({ text, label = 'Copiar' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className="text-2xs font-medium text-brand-sky-500 hover:text-brand-navy-500 transition-colors"
    >
      {copied ? '✓ Copiado' : label}
    </button>
  )
}

// ─── Field block ──────────────────────────────────────────────────────────────

function FieldBlock({
  label,
  value,
  variant = 'default',
  copyable = true,
}: {
  label: string
  value: string
  variant?: 'default' | 'hook' | 'cta' | 'hashtags' | 'muted'
  copyable?: boolean
}) {
  if (!value) return null

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-2xs font-semibold text-gray-400 uppercase tracking-wide">
          {label}
        </span>
        {copyable && <CopyButton text={value} />}
      </div>
      <div
        className={cn(
          'text-sm rounded-lg p-3 leading-relaxed whitespace-pre-wrap',
          variant === 'hook' && 'bg-brand-navy-50 text-brand-navy-800 font-medium border border-brand-navy-100',
          variant === 'cta' && 'bg-brand-gold-50 text-brand-gold-800 font-medium border border-brand-gold-100',
          variant === 'hashtags' && 'bg-gray-50 text-gray-600 font-mono text-xs',
          variant === 'muted' && 'bg-gray-50 text-gray-500 text-xs',
          variant === 'default' && 'bg-white border border-gray-100 text-gray-800'
        )}
      >
        {value}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// INSTAGRAM / FACEBOOK / LINKEDIN / NEXTDOOR POST PREVIEW
// ═══════════════════════════════════════════════════════════════════════════════

export function StaticPostPreview({
  output,
  channelLabel,
  agentHandle,
}: {
  output: StaticPostOutput
  channelLabel: string
  agentHandle?: string
}) {
  // ── Normalize text fields ────────────────────────────────────────────────────
  // Accepts both API schemas without crashing:
  //   Internal: { hook, cuerpo, cta, hashtags.{producto,audiencia,marca} }
  //   API real: { caption, texto_imagen, hashtags.{categoria_1_*,...} }
  // DIAG — remove after fix
  console.log('[CS:preview] StaticPostPreview received | keys:', Object.keys(output as unknown as object),
    '| hook:', output.hook, '| cuerpo:', (output as unknown as Record<string,unknown>).cuerpo?.toString().slice(0,40),
    '| caption:', (output as unknown as Record<string,unknown>).caption?.toString().slice(0,40),
    '| hashtags keys:', Object.keys((output.hashtags ?? {}) as object),
  )
  const outputAny = output as unknown as Record<string, unknown>
  const displayHook = typeof output.hook   === 'string' ? output.hook   : ''
  const displayBody = typeof output.cuerpo === 'string' ? output.cuerpo
    : typeof outputAny.caption === 'string' ? outputAny.caption as string : ''
  const displayCta  = typeof output.cta    === 'string' ? output.cta    : ''

  // ── Normalize hashtag arrays ─────────────────────────────────────────────────
  // Accepts { producto, audiencia, marca } (internal) or
  // { categoria_1_tema, categoria_2_comunidad, categoria_3_valor } (API real).
  // Never calls .join()/.slice() on a non-array value.
  const toStrArr = (v: unknown): string[] =>
    Array.isArray(v)
      ? (v as unknown[]).filter((s): s is string => typeof s === 'string')
      : []

  const rawHt = output.hashtags as Record<string, unknown> | null | undefined
  const ht: Record<string, unknown> =
    rawHt && typeof rawHt === 'object' && !Array.isArray(rawHt) ? rawHt : {}

  const allBuckets = Object.values(ht).filter(Array.isArray).map(toStrArr)
  const htProducto  = toStrArr(ht.producto).length  ? toStrArr(ht.producto)  : (allBuckets[0] ?? [])
  const htAudiencia = toStrArr(ht.audiencia).length ? toStrArr(ht.audiencia) : (allBuckets[1] ?? [])
  const htMarca     = toStrArr(ht.marca).length     ? toStrArr(ht.marca)     : (allBuckets[2] ?? [])

  // Deduplicated flat list for "Copiar todo" and the copy-hashtags button
  const seen = new Set<string>()
  const flatHt = [...htProducto, ...htAudiencia, ...htMarca].filter(h => {
    if (seen.has(h)) return false
    seen.add(h)
    return true
  })
  const allHashtags = flatHt.join(' ')

  // fullCaption uses only normalized local values — never undefined
  const fullCaption = [displayHook, displayBody, displayCta, allHashtags]
    .filter(Boolean)
    .join('\n\n')

  return (
    <div className="space-y-4">
      {/* Channel badge + copy all */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500">{channelLabel}</span>
        <CopyButton text={fullCaption} label="Copiar todo" />
      </div>

      {/* Image text.
          bg-[#1B2E6B] is required here: bg-brand-navy-500 does not exist in
          the Tailwind v4 compiled CSS, so the container would be transparent
          and the white text invisible. */}
      {output.texto_imagen && (
        <div className="bg-[#1B2E6B] rounded-xl p-4 text-center">
          <p className="text-white font-bold text-lg">{output.texto_imagen}</p>
          {agentHandle && (
            <p className="text-white/60 text-xs mt-1">{agentHandle}</p>
          )}
        </div>
      )}

      <FieldBlock label="Hook (primera línea)" value={displayHook} variant="hook" />
      <FieldBlock label="Cuerpo" value={displayBody} />
      <FieldBlock label="CTA" value={displayCta} variant="cta" />

      {/* Hashtags by category */}
      {flatHt.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-semibold text-gray-400 uppercase tracking-wide">
              Hashtags ({flatHt.length})
            </span>
            <CopyButton text={allHashtags} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {([
              { key: 'producto',  items: htProducto  },
              { key: 'audiencia', items: htAudiencia },
              { key: 'marca',     items: htMarca     },
            ] as const).map(({ key, items }) => (
              <div key={key} className="bg-gray-50 rounded-lg p-2">
                <p className="text-2xs text-gray-400 mb-1 capitalize">{key}</p>
                <p className="text-xs text-gray-600 leading-relaxed">
                  {items.slice(0, 5).join(' ')}
                  {items.length > 5 && (
                    <span className="text-gray-400"> +{items.length - 5}</span>
                  )}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════════════════════
// CAROUSEL PREVIEW
// ═══════════════════════════════════════════════════════════════════════════════

export function CarouselPreview({
  output,
  agentHandle,
}: {
  output: CarouselOutput
  agentHandle?: string
}) {
  const [activeSlide, setActiveSlide] = useState(0)

  const allSlides = [
    { type: 'hook', data: output.hook_slide },
    ...(output.slides ?? []).map((s) => ({ type: 'content', data: s })),
    { type: 'cta', data: output.cta_slide },
  ]

  const totalSlides = allSlides.length
  const current = allSlides[activeSlide]

  const allHashtags = [
    ...(output.hashtags?.producto ?? []),
    ...(output.hashtags?.audiencia ?? []),
    ...(output.hashtags?.marca ?? []),
  ].join(' ')

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500">
          Carrusel · {totalSlides} slides
        </span>
        <CopyButton text={output.caption} label="Copiar caption" />
      </div>

      {/* Slide navigator */}
      <div className="bg-brand-navy-500 rounded-2xl p-5 min-h-[160px] flex flex-col justify-between">
        <div className="flex gap-1 mb-3">
          {allSlides.map((_, i) => (
            <button
              key={i}
              onClick={() => setActiveSlide(i)}
              className={cn(
                'h-0.5 flex-1 rounded-full transition-all',
                i === activeSlide ? 'bg-white' : 'bg-white/30'
              )}
            />
          ))}
        </div>

        {/* Slide content */}
        {current.type === 'hook' && (
          <div className="text-center flex-1 flex flex-col justify-center">
            <p className="text-xl mb-1">{(current.data as CarouselOutput['hook_slide']).emoji_principal}</p>
            <p className="text-white font-bold text-base leading-tight">
              {(current.data as CarouselOutput['hook_slide']).titulo}
            </p>
            <p className="text-white/70 text-xs mt-1">
              {(current.data as CarouselOutput['hook_slide']).subtitulo}
            </p>
          </div>
        )}

        {current.type === 'content' && (
          <div className="flex-1 flex flex-col justify-center">
            <div className="flex items-start gap-2">
              <span className="text-lg shrink-0">{(current.data as CarouselOutput['slides'][0]).emoji}</span>
              <div>
                <p className="text-white font-semibold text-sm leading-tight">
                  {(current.data as CarouselOutput['slides'][0]).titulo}
                </p>
                <p className="text-white/75 text-xs mt-1 leading-relaxed">
                  {(current.data as CarouselOutput['slides'][0]).cuerpo}
                </p>
              </div>
            </div>
          </div>
        )}

        {current.type === 'cta' && (
          <div className="flex-1 flex flex-col justify-center text-center">
            <p className="text-white font-bold text-base">
              {(current.data as CarouselOutput['cta_slide']).titulo}
            </p>
            <p className="text-brand-gold-300 font-medium text-sm mt-1">
              {(current.data as CarouselOutput['cta_slide']).cta}
            </p>
            <p className="text-white/60 text-xs mt-2">
              {agentHandle ?? (current.data as CarouselOutput['cta_slide']).handle}
            </p>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-3">
          <button
            onClick={() => setActiveSlide(Math.max(0, activeSlide - 1))}
            disabled={activeSlide === 0}
            className="text-white/50 hover:text-white disabled:opacity-20 text-xs"
          >
            ← Anterior
          </button>
          <span className="text-white/50 text-xs">{activeSlide + 1}/{totalSlides}</span>
          <button
            onClick={() => setActiveSlide(Math.min(totalSlides - 1, activeSlide + 1))}
            disabled={activeSlide === totalSlides - 1}
            className="text-white/50 hover:text-white disabled:opacity-20 text-xs"
          >
            Siguiente →
          </button>
        </div>
      </div>

      {/* All slides text list for editing */}
      <div className="space-y-2">
        <p className="text-2xs font-semibold text-gray-400 uppercase tracking-wide">
          Todos los slides
        </p>
        {output.slides?.map((slide, i) => (
          <div key={i} className="flex gap-2 text-xs bg-gray-50 rounded-lg p-2">
            <span className="text-gray-400 shrink-0">Slide {slide.numero}</span>
            <span className="text-gray-700 truncate">{slide.titulo}</span>
          </div>
        ))}
      </div>

      <FieldBlock label="Caption" value={output.caption} variant="muted" />
      <FieldBlock label="Hashtags" value={allHashtags} variant="hashtags" />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// STORY PREVIEW
// ═══════════════════════════════════════════════════════════════════════════════

export function StoryPreview({ output }: { output: StoryOutput }) {
  const [activeSlide, setActiveSlide] = useState(0)
  const slide = output.slides?.[activeSlide]

  return (
    <div className="space-y-4">
      {/* 9:16 vertical frame */}
      <div className="mx-auto w-36 h-64 bg-gradient-to-br from-brand-navy-500 to-brand-sky-500 rounded-2xl relative overflow-hidden flex flex-col">
        {/* Progress bars */}
        <div className="flex gap-0.5 p-2">
          {output.slides?.map((_, i) => (
            <button
              key={i}
              onClick={() => setActiveSlide(i)}
              className={cn(
                'h-0.5 flex-1 rounded-full',
                i === activeSlide ? 'bg-white' : 'bg-white/40'
              )}
            />
          ))}
        </div>

        {/* Slide content */}
        <div className="flex-1 flex flex-col items-center justify-center p-3 text-center">
          {slide && (
            <>
              <p className="text-2xl mb-2">{slide.emoji}</p>
              <p className="text-white font-black text-base leading-tight">
                {slide.texto_principal}
              </p>
              {slide.texto_secundario && (
                <p className="text-white/80 text-xs mt-1">{slide.texto_secundario}</p>
              )}
              {slide.sticker_sugerido && (
                <div className="mt-2 bg-white/20 rounded-lg px-2 py-1">
                  <p className="text-white text-xs">📊 {slide.sticker_sugerido}</p>
                </div>
              )}
              {slide.cta_swipe_up && (
                <p className="text-brand-gold-300 text-xs mt-2 font-medium">
                  ↑ {slide.cta_swipe_up}
                </p>
              )}
            </>
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between p-2">
          <button
            onClick={() => setActiveSlide(Math.max(0, activeSlide - 1))}
            className="text-white/50 text-xs"
          >←</button>
          <span className="text-white/50 text-xs">
            {activeSlide + 1}/{output.slides?.length ?? 0}
          </span>
          <button
            onClick={() => setActiveSlide(Math.min((output.slides?.length ?? 1) - 1, activeSlide + 1))}
            className="text-white/50 text-xs"
          >→</button>
        </div>
      </div>

      <FieldBlock label="Post acompañante" value={output.caption_acompanante} variant="muted" />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// REEL SCRIPT PREVIEW
// ═══════════════════════════════════════════════════════════════════════════════

export function ReelScriptPreview({ output }: { output: ReelScriptOutput }) {
  const allHashtags = [
    ...(output.hashtags?.producto ?? []),
    ...(output.hashtags?.audiencia ?? []),
    ...(output.hashtags?.marca ?? []),
  ].join(' ')

  // Build full script for copy
  const fullScript = [
    `HOOK: ${output.hook}`,
    '',
    ...(output.segmentos ?? []).map(
      (s) => `[${s.tiempo_inicio}-${s.tiempo_fin}] ${s.texto_locutor}\n  📱 Pantalla: ${s.texto_pantalla}\n  🎬 Acción: ${s.accion_fisica}`
    ),
    '',
    `CTA: ${output.cta_final}`,
    '',
    `NOTA: ${output.nota_produccion}`,
  ].join('\n')

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500">
          Guion de Reel · {output.segmentos?.length ?? 0} segmentos
        </span>
        <CopyButton text={fullScript} label="Copiar guion" />
      </div>

      {/* Hook */}
      <FieldBlock label="Hook (primeros 3 segundos)" value={output.hook} variant="hook" />

      {/* Script segments */}
      <div className="space-y-2">
        <span className="text-2xs font-semibold text-gray-400 uppercase tracking-wide block">
          Guion por segmentos
        </span>
        {output.segmentos?.map((seg) => (
          <div
            key={seg.numero}
            className={cn(
              'rounded-xl p-3 border',
              seg.tipo === 'hook' && 'bg-red-50 border-red-100',
              seg.tipo === 'cta' && 'bg-brand-gold-50 border-brand-gold-100',
              seg.tipo !== 'hook' && seg.tipo !== 'cta' && 'bg-white border-gray-100'
            )}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xs font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
                {seg.tiempo_inicio}–{seg.tiempo_fin}
              </span>
              <span className="text-2xs text-gray-400 capitalize">{seg.tipo}</span>
            </div>
            <p className="text-sm font-medium text-gray-800 mb-1.5">{seg.texto_locutor}</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-gray-50 rounded-lg p-1.5">
                <p className="text-2xs text-gray-400 mb-0.5">📱 Texto en pantalla</p>
                <p className="text-xs text-gray-700 font-medium">{seg.texto_pantalla}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-1.5">
                <p className="text-2xs text-gray-400 mb-0.5">🎬 Acción física</p>
                <p className="text-xs text-gray-700">{seg.accion_fisica}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <FieldBlock label="CTA final" value={output.cta_final} variant="cta" />
      <FieldBlock label="Nota de producción" value={output.nota_produccion} variant="muted" />
      <FieldBlock label="Caption" value={output.caption} />
      <FieldBlock label="Hashtags" value={allHashtags} variant="hashtags" />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// WHATSAPP PREVIEW
// ═══════════════════════════════════════════════════════════════════════════════

export function WhatsAppPreview({ output }: { output: WhatsAppOutput }) {
  const [showLong, setShowLong] = useState(true)

  // Render WhatsApp markdown as HTML-like display
  const renderWA = (text: string) =>
    text
      .replace(/\*(.+?)\*/g, '<strong>$1</strong>')
      .replace(/_(.+?)_/g, '<em>$1</em>')
      .replace(/~(.+?)~/g, '<del>$1</del>')

  return (
    <div className="space-y-4">
      {/* Version toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setShowLong(true)}
          className={cn(
            'text-xs px-3 py-1 rounded-full border transition-all',
            showLong ? 'bg-brand-navy-500 text-white border-brand-navy-500' : 'border-gray-200 text-gray-600'
          )}
        >
          Mensaje largo
        </button>
        <button
          onClick={() => setShowLong(false)}
          className={cn(
            'text-xs px-3 py-1 rounded-full border transition-all',
            !showLong ? 'bg-brand-navy-500 text-white border-brand-navy-500' : 'border-gray-200 text-gray-600'
          )}
        >
          Mensaje corto
        </button>
      </div>

      {/* WhatsApp bubble mockup */}
      <div className="bg-[#ECE5DD] rounded-2xl p-4">
        <div className="bg-white rounded-xl rounded-tl-none shadow-sm p-3 max-w-[90%]">
          <div
            className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap"
            dangerouslySetInnerHTML={{
              __html: renderWA(showLong ? output.version_larga : output.version_corta),
            }}
          />
          <p className="text-[10px] text-gray-400 text-right mt-1">10:42 ✓✓</p>
        </div>
      </div>

      {/* Copy buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => navigator.clipboard.writeText(showLong ? output.version_larga : output.version_corta)}
          className="flex-1 py-2 text-xs font-medium bg-[#25D366] text-white rounded-lg hover:bg-[#1fa855] transition-colors"
        >
          📋 Copiar mensaje
        </button>
      </div>

      {/* Character count for short version */}
      {!showLong && (
        <p className="text-xs text-gray-400 text-right">
          {output.version_corta?.length ?? 0} caracteres
        </p>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// GENERIC PREVIEW (Nextdoor, fallback)
// ═══════════════════════════════════════════════════════════════════════════════

export function GenericPostPreview({
  output,
  channelLabel,
}: {
  output: StaticPostOutput
  channelLabel: string
}) {
  const text = [output.hook, output.cuerpo, output.cta].filter(Boolean).join('\n\n')

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500">{channelLabel}</span>
        <CopyButton text={text} label="Copiar todo" />
      </div>
      <FieldBlock label="Apertura" value={output.hook} variant="hook" />
      <FieldBlock label="Contenido" value={output.cuerpo} />
      <FieldBlock label="CTA" value={output.cta} variant="cta" />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPLIANCE BADGE
// ═══════════════════════════════════════════════════════════════════════════════

interface ComplianceBadgeProps {
  complianceResult: {
    risk_level?: 'LOW' | 'MEDIUM' | 'HIGH'
    overall_summary?: string
    detected_issues?: Array<{
      category: string
      risk_level: 'LOW' | 'MEDIUM' | 'HIGH'
      problematic_text: string
      explanation: string
      recommended_revision: string
      source: string
    }>
    requires_human_review?: boolean
    compliance_notes?: string[]
    disclaimer?: string
    // Legacy compat
    nivel?: 'verde' | 'amarillo' | 'rojo'
    score_riesgo?: number
    problemas?: Array<{ tipo: string; descripcion: string; sugerencia: string }>
    advertencias?: string[]
    nota_disclaimer?: string
  }
}

export function ComplianceBadge({ complianceResult: r }: ComplianceBadgeProps) {
  const [expanded, setExpanded] = useState(false)

  // Normalize: support Phase 10 (risk_level) and legacy (nivel) format
  const riskLevel = r.risk_level ?? (r.nivel === 'verde' ? 'LOW' : r.nivel === 'rojo' ? 'HIGH' : 'MEDIUM')
  const summary = r.overall_summary ?? (riskLevel === 'LOW' ? 'Sin problemas detectados' : 'Revisar contenido')
  const issues = r.detected_issues ?? (r.problemas ?? []).map(p => ({
    category: p.tipo,
    risk_level: 'MEDIUM' as const,
    problematic_text: p.tipo,
    explanation: p.descripcion,
    recommended_revision: p.sugerencia,
    source: 'legacy',
  }))
  const notes = r.compliance_notes ?? r.advertencias ?? []
  const disclaimer = r.disclaimer ?? r.nota_disclaimer ?? 'Compliance AI es una herramienta de apoyo. No reemplaza revisión legal profesional.'
  const requiresHuman = r.requires_human_review ?? riskLevel === 'HIGH'

  const config = {
    LOW:    { emoji: '🟢', label: 'Riesgo bajo', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700' },
    MEDIUM: { emoji: '🟡', label: 'Riesgo medio — revisar', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
    HIGH:   { emoji: '🔴', label: 'Riesgo alto — revisión requerida', bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700' },
  }[riskLevel]

  return (
    <div className={cn('rounded-xl border p-3 animate-fade-in', config.bg, config.border)}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <span>{config.emoji}</span>
          <span className={cn('text-xs font-semibold', config.text)}>{config.label}</span>
          {requiresHuman && <span className="text-2xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">Revisión humana</span>}
        </div>
        <span className={cn('text-2xs', config.text)}>{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="mt-3 space-y-2 animate-fade-in">
          {summary && <p className="text-xs text-gray-700 mb-2">{summary}</p>}
          {issues.map((issue, i) => (
            <div key={i} className="bg-white rounded-lg p-2.5 border border-white/60">
              <div className="flex items-center gap-1.5 mb-1">
                <span className={cn('text-2xs px-1.5 py-0.5 rounded font-semibold',
                  issue.risk_level === 'HIGH' ? 'bg-red-100 text-red-700' :
                  issue.risk_level === 'MEDIUM' ? 'bg-amber-100 text-amber-700' :
                  'bg-emerald-100 text-emerald-700'
                )}>{issue.risk_level}</span>
                <span className="text-2xs text-gray-500">{issue.category.replace(/_/g, ' ')}</span>
              </div>
              {issue.problematic_text && (
                <p className="text-xs text-gray-500 italic mb-1">"{issue.problematic_text}"</p>
              )}
              <p className="text-xs text-gray-700">{issue.explanation}</p>
              <p className="text-xs text-brand-sky-600 mt-1">✓ {issue.recommended_revision}</p>
            </div>
          ))}
          {notes.map((note, i) => (
            <p key={i} className="text-xs text-gray-600">⚠️ {note}</p>
          ))}
          <p className="text-2xs text-gray-400 italic border-t pt-2">{disclaimer}</p>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// PREVIEW ROUTER — selects the right component by channel
// ═══════════════════════════════════════════════════════════════════════════════

export function ContentPreview({
  channelId,
  channelLabel,
  output,
  agentHandle,
}: {
  channelId: string
  channelLabel: string
  output: ContentOutput
  agentHandle?: string
}) {
  switch (channelId) {
    case 'instagram_post':
    case 'facebook_post':
    case 'linkedin_post':
      return (
        <StaticPostPreview
          output={output as StaticPostOutput}
          channelLabel={channelLabel}
          agentHandle={agentHandle}
        />
      )
    case 'nextdoor_post':
      return (
        <GenericPostPreview
          output={output as StaticPostOutput}
          channelLabel={channelLabel}
        />
      )
    case 'carousel':
      return <CarouselPreview output={output as CarouselOutput} agentHandle={agentHandle} />
    case 'story':
      return <StoryPreview output={output as StoryOutput} />
    case 'reel_script':
    case 'tiktok_script':
      return <ReelScriptPreview output={output as ReelScriptOutput} />
    case 'whatsapp':
      return <WhatsAppPreview output={output as WhatsAppOutput} />
    default:
      return (
        <div className="bg-gray-50 rounded-xl p-4">
          <pre className="text-xs text-gray-600 whitespace-pre-wrap overflow-auto max-h-64">
            {JSON.stringify(output, null, 2)}
          </pre>
        </div>
      )
  }
}
