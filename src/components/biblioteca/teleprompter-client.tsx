'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { ReelScriptOutput } from '@/lib/content-studio/channel-registry'

interface TeleprompterClientProps {
  titulo: string
  script: ReelScriptOutput
  backHref: string
}

const TEXT_SIZES = ['text-2xl', 'text-3xl', 'text-4xl', 'text-5xl'] as const
const SPEEDS = [
  { label: 'Lenta', ms: 0 },       // Manual only
  { label: 'Normal', ms: 4000 },   // 4s per segment
  { label: 'Rápida', ms: 2500 },
  { label: 'Muy rápida', ms: 1500 },
] as const

export function TeleprompterClient({ titulo: _titulo, script, backHref }: TeleprompterClientProps) {
  const [currentSegment, setCurrentSegment] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [textSizeIdx, setTextSizeIdx] = useState(1)      // Default: text-3xl
  const [speedIdx, setSpeedIdx] = useState(1)            // Default: Normal
  const [showControls, setShowControls] = useState(true) // Auto-hide controls when playing

  const segments = script.segmentos ?? []
  const total = segments.length
  const current = segments[currentSegment]
  const isLast = currentSegment === total - 1
  const isFirst = currentSegment === 0

  // Auto-advance when playing
  useEffect(() => {
    if (!isPlaying) return

    const speed = SPEEDS[speedIdx]?.ms ?? 4000
    if (speed === 0) { setIsPlaying(false); return }

    const timer = setTimeout(() => {
      if (isLast) {
        setIsPlaying(false)
        setShowControls(true)
      } else {
        setCurrentSegment((prev) => prev + 1)
      }
    }, speed)

    return () => clearTimeout(timer)
  }, [isPlaying, currentSegment, isLast, speedIdx])

  // Auto-hide controls after 3s when playing
  useEffect(() => {
    if (!isPlaying) { setShowControls(true); return }
    const timer = setTimeout(() => setShowControls(false), 3000)
    return () => clearTimeout(timer)
  }, [isPlaying, currentSegment])

  const next = useCallback(() => {
    if (!isLast) setCurrentSegment((p) => p + 1)
  }, [isLast])

  const prev = useCallback(() => {
    if (!isFirst) setCurrentSegment((p) => p - 1)
  }, [isFirst])

  const reset = useCallback(() => {
    setIsPlaying(false)
    setCurrentSegment(0)
    setShowControls(true)
  }, [])

  const togglePlay = useCallback(() => {
    setIsPlaying((p) => !p)
    setShowControls(true)
  }, [])

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); next() }
      if (e.key === 'ArrowLeft') { e.preventDefault(); prev() }
      if (e.key === 'Escape') reset()
      if (e.key === 'p') togglePlay()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [next, prev, reset, togglePlay])

  // Touch swipe for mobile
  const [touchStart, setTouchStart] = useState<number | null>(null)

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0]?.clientX ?? null)
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart) return
    const diff = touchStart - (e.changedTouches[0]?.clientX ?? 0)
    if (Math.abs(diff) > 50) {
      if (diff > 0) next()
      else prev()
    }
    setTouchStart(null)
    setShowControls(true)
  }

  const textSize = TEXT_SIZES[textSizeIdx] ?? 'text-3xl'
  const progress = total > 0 ? ((currentSegment + 1) / total) * 100 : 0

  return (
    <div
      className="fixed inset-0 bg-black flex flex-col overflow-hidden z-50"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onClick={() => setShowControls((p) => !p)}
    >
      {/* Progress bar */}
      <div className="h-1 bg-white/10 shrink-0">
        <div
          className="h-full bg-white/60 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Top bar */}
      <div
        className={cn(
          'flex items-center justify-between px-5 py-3 shrink-0 transition-opacity duration-300',
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
      >
        <Link href={backHref} className="text-white/60 text-sm">← Salir</Link>
        <p className="text-white/60 text-xs font-medium">{currentSegment + 1}/{total}</p>
        <div className="flex gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); setTextSizeIdx((i) => Math.min(TEXT_SIZES.length - 1, i + 1)) }}
            className="text-white/60 text-lg px-2 hover:text-white"
          >
            A+
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setTextSizeIdx((i) => Math.max(0, i - 1)) }}
            className="text-white/60 text-sm px-2 hover:text-white"
          >
            A-
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 py-4 text-center">
        {/* Segment type badge */}
        <div className="mb-6">
          {current?.tipo === 'hook' && (
            <span className="text-xs text-red-400 font-medium uppercase tracking-widest">🎣 Hook</span>
          )}
          {current?.tipo === 'cta' && (
            <span className="text-xs text-brand-gold-400 font-medium uppercase tracking-widest">📢 CTA</span>
          )}
          {current?.tipo === 'desarrollo' && (
            <span className="text-xs text-white/30 uppercase tracking-widest">{current.tiempo_inicio}–{current.tiempo_fin}</span>
          )}
          {current?.tipo !== 'hook' && current?.tipo !== 'cta' && current?.tipo !== 'desarrollo' && (
            <span className="text-xs text-white/30 uppercase tracking-widest">{current?.tiempo_inicio}–{current?.tiempo_fin}</span>
          )}
        </div>

        {/* Main text — the locator text */}
        <p className={cn(
          'text-white font-bold leading-snug max-w-lg transition-all duration-200',
          textSize
        )}>
          {current?.texto_locutor ?? ''}
        </p>
      </div>

      {/* Bottom info bar */}
      <div
        className={cn(
          'px-5 py-3 space-y-2 shrink-0 transition-opacity duration-300',
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Screen text */}
        {current?.texto_pantalla && (
          <div className="bg-white/10 rounded-xl px-4 py-2 text-center">
            <p className="text-2xs text-white/50 mb-0.5">📱 Texto en pantalla</p>
            <p className="text-sm text-white font-medium">{current.texto_pantalla}</p>
          </div>
        )}

        {/* Physical action */}
        {current?.accion_fisica && (
          <div className="text-center">
            <p className="text-xs text-white/40">🎬 {current.accion_fisica}</p>
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center justify-between pt-2">
          {/* Prev */}
          <button
            onClick={prev}
            disabled={isFirst}
            className="text-white/50 hover:text-white disabled:opacity-20 p-3 text-lg"
          >
            ←
          </button>

          <div className="flex items-center gap-3">
            {/* Play/Pause */}
            <button
              onClick={togglePlay}
              className="w-12 h-12 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white text-xl"
            >
              {isPlaying ? '⏸' : '▶'}
            </button>

            {/* Reset */}
            <button onClick={reset} className="text-white/40 hover:text-white text-sm">
              ↺
            </button>

            {/* Speed */}
            <button
              onClick={() => setSpeedIdx((i) => (i + 1) % SPEEDS.length)}
              className="text-xs text-white/40 hover:text-white px-2"
            >
              {SPEEDS[speedIdx]?.label}
            </button>
          </div>

          {/* Next */}
          <button
            onClick={next}
            disabled={isLast}
            className="text-white/50 hover:text-white disabled:opacity-20 p-3 text-lg"
          >
            →
          </button>
        </div>
      </div>
    </div>
  )
}
