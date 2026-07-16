'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import { ContentPreview } from '@/components/content-studio/preview-components'
import type { ContentOutput } from '@/lib/content-studio/channel-registry'

// ─── Channel config ───────────────────────────────────────────────────────────

const CHANNEL_CONFIG: Record<string, { emoji: string; label: string; color: string }> = {
  instagram_post: { emoji: '📸', label: 'Instagram', color: 'bg-pink-50 text-pink-700' },
  facebook_post: { emoji: '👍', label: 'Facebook', color: 'bg-blue-50 text-blue-700' },
  linkedin_post: { emoji: '💼', label: 'LinkedIn', color: 'bg-sky-50 text-sky-700' },
  nextdoor_post: { emoji: '🏘️', label: 'Nextdoor', color: 'bg-green-50 text-green-700' },
  carousel: { emoji: '📊', label: 'Carrusel', color: 'bg-purple-50 text-purple-700' },
  story: { emoji: '⬛', label: 'Historia', color: 'bg-amber-50 text-amber-700' },
  reel_script: { emoji: '🎬', label: 'Reel', color: 'bg-red-50 text-red-700' },
  tiktok_script: { emoji: '🎵', label: 'TikTok', color: 'bg-gray-100 text-gray-700' },
  video_educativo: { emoji: '🎓', label: 'Video', color: 'bg-orange-50 text-orange-700' },
  whatsapp: { emoji: '💬', label: 'WhatsApp', color: 'bg-emerald-50 text-emerald-700' },
  post: { emoji: '📝', label: 'Post', color: 'bg-brand-navy-50 text-brand-navy-600' },
}

const PRODUCT_LABELS: Record<string, string> = {
  medicare: 'Medicare', aca: 'ACA', iul: 'IUL',
  final_expense: 'Gastos Finales', life: 'Vida', mortgage: 'Hipotecario', general: 'General',
}

// ─── Content Card ─────────────────────────────────────────────────────────────

function ContentCard({
  item,
  isSelected,
  onSelect,
}: {
  item: Record<string, unknown>
  isSelected: boolean
  onSelect: () => void
}) {
  const channelId = (item.plataforma as string === 'instagram' && item.tipo === 'post')
    ? 'instagram_post'
    : item.tipo as string

  const channelCfg = CHANNEL_CONFIG[channelId] ?? CHANNEL_CONFIG.post
  const titulo = item.titulo as string
  const produto = item.produto as string || item.producto as string
  const createdAt = new Date(item.created_at as string).toLocaleDateString('es', {
    day: 'numeric', month: 'short',
  })
  const publicado = item.fue_publicado as boolean
  const compliance = item.compliance_revisado as boolean

  return (
    <button
      onClick={onSelect}
      className={cn(
        'w-full text-left p-4 rounded-xl border transition-all duration-150',
        isSelected
          ? 'border-brand-navy-400 bg-brand-navy-50 shadow-card'
          : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-card'
      )}
    >
      {/* Channel + product badges */}
      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
        <span className={cn('text-2xs font-medium px-1.5 py-0.5 rounded', channelCfg.color)}>
          {channelCfg.emoji} {channelCfg.label}
        </span>
        {produto && (
          <span className="text-2xs text-gray-400">
            {PRODUCT_LABELS[produto] ?? produto}
          </span>
        )}
        {publicado && (
          <span className="text-2xs bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded">
            ✓ Publicado
          </span>
        )}
        {compliance && <span title="Compliance revisado">🟢</span>}
      </div>

      {/* Title */}
      <p className="text-sm font-medium text-gray-800 line-clamp-2 leading-tight">
        {titulo || 'Sin título'}
      </p>

      {/* Date */}
      <p className="text-2xs text-gray-400 mt-1.5">{createdAt}</p>
    </button>
  )
}

// ─── Filter bar ───────────────────────────────────────────────────────────────

function FilterBar({
  filters,
  onFilterChange,
}: {
  filters: { tipo?: string; producto?: string; publicado: boolean }
  onFilterChange: (key: string, value: string | boolean | undefined) => void
}) {
  const TIPOS = [
    { value: undefined, label: 'Todos' },
    { value: 'post', label: '📝 Posts' },
    { value: 'carousel', label: '📊 Carruseles' },
    { value: 'reel', label: '🎬 Reels' },
    { value: 'story', label: '⬛ Historias' },
    { value: 'whatsapp', label: '💬 WhatsApp' },
  ]

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="flex gap-1">
        {TIPOS.map((t) => (
          <button
            key={t.label}
            onClick={() => onFilterChange('tipo', t.value)}
            className={cn(
              'text-xs px-3 py-1.5 rounded-full border transition-all',
              filters.tipo === t.value || (!filters.tipo && !t.value)
                ? 'bg-brand-navy-500 text-white border-brand-navy-500'
                : 'border-gray-200 text-gray-600 hover:border-gray-300'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <button
        onClick={() => onFilterChange('publicado', !filters.publicado || undefined)}
        className={cn(
          'text-xs px-3 py-1.5 rounded-full border transition-all',
          filters.publicado
            ? 'bg-emerald-500 text-white border-emerald-500'
            : 'border-gray-200 text-gray-600 hover:border-gray-300'
        )}
      >
        ✓ Solo publicados
      </button>
    </div>
  )
}

// ─── Side panel ───────────────────────────────────────────────────────────────

function SidePanel({
  item,
  agentHandle,
  onClose,
  onMarkPublished,
}: {
  item: Record<string, unknown>
  agentHandle?: string
  onClose: () => void
  onMarkPublished: (id: string) => void
}) {
  const channelId = item.tipo as string === 'reel' ? 'reel_script'
    : item.tipo as string === 'carousel' ? 'carousel'
    : item.tipo as string === 'story' ? 'story'
    : item.tipo as string === 'whatsapp' ? 'whatsapp'
    : 'instagram_post'

  const output = item.output_json as ContentOutput | null
  const titulo = item.titulo as string
  const isPublicado = item.fue_publicado as boolean
  const id = item.id as string
  const isReel = channelId === 'reel_script'

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100">
        <p className="text-sm font-semibold text-gray-900 truncate max-w-[200px]">
          {titulo || 'Contenido'}
        </p>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
      </div>

      {/* Preview */}
      <div className="flex-1 overflow-y-auto p-4">
        {output ? (
          <ContentPreview
            channelId={channelId}
            channelLabel={CHANNEL_CONFIG[channelId]?.label ?? 'Contenido'}
            output={output}
            agentHandle={agentHandle}
          />
        ) : (
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-sm text-gray-600 whitespace-pre-wrap">
              {item.cuerpo as string}
            </p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-4 border-t border-gray-100 space-y-2">
        {isReel && output && (
          <Link
            href={`/contenidos/${id}/teleprompter`}
            className="flex items-center justify-center gap-2 w-full py-2.5 text-sm font-medium bg-brand-navy-500 text-white rounded-xl hover:bg-brand-navy-600 transition-colors"
          >
            🎬 Modo Teleprompter
          </Link>
        )}

        <div className="flex gap-2">
          <Link
            href={`/content-studio?tipo=${channelId}&contenido_origen_id=${id}`}
            className="flex-1 py-2 text-xs font-medium text-center border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            Adaptar canal
          </Link>

          {!isPublicado && (
            <button
              onClick={() => onMarkPublished(id)}
              className="flex-1 py-2 text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl hover:bg-emerald-100 transition-colors"
            >
              ✓ Marcar publicado
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Biblioteca component ────────────────────────────────────────────────

interface BibliotecaClientProps {
  items: Record<string, unknown>[]
  total: number
  pageSize: number
  currentPage: number
  agentHandle?: string
  filters: { tipo?: string; producto?: string; publicado: boolean }
}

export function BibliotecaClient({
  items,
  total,
  pageSize,
  currentPage,
  agentHandle,
  filters,
}: BibliotecaClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const selectedItem = items.find((i) => i.id === selectedId) ?? null
  const totalPages = Math.ceil(total / pageSize)

  const updateFilter = (key: string, value: string | boolean | undefined) => {
    const params = new URLSearchParams(searchParams.toString())
    if (!value) {
      params.delete(key)
    } else {
      params.set(key, String(value))
    }
    params.delete('page')
    startTransition(() => router.push(`/contenidos?${params.toString()}`))
  }

  const goToPage = (page: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', String(page))
    startTransition(() => router.push(`/contenidos?${params.toString()}`))
  }

  const markPublished = async (id: string) => {
    const { markContentPublishedAction } = await import('@/lib/content-studio/actions')
    await markContentPublishedAction(id)
    router.refresh()
  }

  return (
    <div className="flex h-full animate-fade-in">
      {/* Main area */}
      <div className={cn('flex-1 min-w-0 flex flex-col', selectedItem && 'hidden md:flex')}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Mis contenidos</h1>
            <p className="text-sm text-gray-500">{total} piezas generadas</p>
          </div>
          <Link
            href="/content-studio"
            className="flex items-center gap-2 px-4 py-2 bg-brand-navy-500 text-white text-sm font-medium rounded-xl hover:bg-brand-navy-600 transition-colors"
          >
            + Crear contenido
          </Link>
        </div>

        {/* Filters */}
        <FilterBar filters={filters} onFilterChange={updateFilter} />

        {/* Empty state */}
        {items.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center py-16 text-center">
            <p className="text-4xl mb-4">📭</p>
            <p className="text-base font-medium text-gray-700 mb-1">
              {filters.tipo || filters.publicado ? 'Sin resultados para este filtro' : 'Aún no tienes contenido'}
            </p>
            <p className="text-sm text-gray-400 mb-4">
              {filters.tipo || filters.publicado
                ? 'Prueba con otros filtros'
                : 'Genera tu primer contenido en el Content Studio'}
            </p>
            <Link
              href="/content-studio"
              className="text-sm font-medium text-brand-navy-500 hover:underline"
            >
              Ir al Content Studio →
            </Link>
          </div>
        )}

        {/* Grid — desktop: 3 cols, tablet: 2 cols, mobile: 1 col */}
        {items.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
            {items.map((item) => (
              <ContentCard
                key={item.id as string}
                item={item}
                isSelected={selectedId === item.id}
                onSelect={() => setSelectedId(
                  selectedId === item.id ? null : item.id as string
                )}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
            >
              ← Anterior
            </button>
            <span className="text-xs text-gray-500">
              Página {currentPage} de {totalPages}
            </span>
            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
            >
              Siguiente →
            </button>
          </div>
        )}
      </div>

      {/* Side panel */}
      {selectedItem && (
        <div className="w-full md:w-96 shrink-0 md:ml-4 bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
          <SidePanel
            item={selectedItem}
            agentHandle={agentHandle}
            onClose={() => setSelectedId(null)}
            onMarkPublished={(id) => void markPublished(id)}
          />
        </div>
      )}
    </div>
  )
}
