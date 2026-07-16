'use client'

import { useState } from 'react'
import { Button, Alert } from '@/components/ui'
import { cn } from '@/lib/utils'
import {
  generateClienteIdealAction,
  saveClienteIdealAction,
  type IdealClientProfile,
  type ClienteIdealEvidenceType,
} from '@/lib/cliente-ideal/actions'
import { useToast } from '@/hooks/use-toast'

// ─── Evidence badge ───────────────────────────────────────────────────────────

function EvidenceBadge({ type }: { type: ClienteIdealEvidenceType }) {
  const config = {
    AGENT_DATA: { label: 'Dato del agente', style: 'bg-brand-navy-50 text-brand-navy-600' },
    INFERENCE: { label: 'Inferido', style: 'bg-amber-50 text-amber-700' },
    HYPOTHESIS: { label: 'Hipótesis', style: 'bg-gray-100 text-gray-600' },
  }[type]

  return (
    <span className={cn('text-2xs px-2 py-0.5 rounded-full font-medium', config.style)}>
      {config.label}
    </span>
  )
}

// ─── Profile section block ────────────────────────────────────────────────────

function ProfileSection({
  title,
  evidence,
  children,
}: {
  title: string
  evidence: ClienteIdealEvidenceType
  children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-gray-800">{title}</p>
        <EvidenceBadge type={evidence} />
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  )
}

function ProfileRow({ label, value }: { label: string; value: string | string[] }) {
  const text = Array.isArray(value) ? value.join(', ') : value
  if (!text) return null
  return (
    <div className="flex gap-2 text-xs">
      <span className="text-gray-400 shrink-0 w-28">{label}</span>
      <span className="text-gray-700">{text}</span>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

type Phase = 'questions' | 'generating' | 'review' | 'done'

interface ClienteIdealModalProps {
  onClose: () => void
  onSaved: () => void
  existingProfile?: IdealClientProfile | null
}

export function ClienteIdealModal({ onClose, onSaved, existingProfile }: ClienteIdealModalProps) {
  const { toast } = useToast()
  const [phase, setPhase] = useState<Phase>(existingProfile ? 'review' : 'questions')
  const [answers, setAnswers] = useState({ q1: '', q2: '', q3: '' })
  const [profile, setProfile] = useState<IdealClientProfile | null>(existingProfile ?? null)
  const [_profileText, setProfileText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [editedDescription, setEditedDescription] = useState('')

  const handleGenerate = async () => {
    if (!answers.q1.trim() || !answers.q2.trim() || !answers.q3.trim()) {
      setError('Por favor responde las tres preguntas.')
      return
    }

    setPhase('generating')
    setError(null)

    const result = await generateClienteIdealAction({
      pregunta1: answers.q1,
      pregunta2: answers.q2,
      pregunta3: answers.q3,
    })

    if (result.success) {
      setProfile(result.data.profile)
      setProfileText(result.data.profileText)
      setPhase('review')
    } else {
      setError('error' in result ? result.error : 'Error al generar el perfil')
      setPhase('questions')
    }
  }

  const handleSave = async () => {
    if (!profile) return
    setIsSaving(true)

    const result = await saveClienteIdealAction(
      profile,
      editedDescription || undefined
    )

    if (result.success) {
      toast.success('¡Cliente ideal guardado!', 'Tu perfil de IA se actualizó.')
      setPhase('done')
      onSaved()
    } else {
      toast.error('Error', result.error)
    }
    setIsSaving(false)
  }

  return (
    <div className="fixed inset-0 z-modal bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-card-xl w-full max-w-xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">Cliente Ideal AI</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {phase === 'questions' && 'Responde 3 preguntas — la IA construye el perfil'}
              {phase === 'generating' && 'Analizando tu contexto...'}
              {phase === 'review' && 'Revisa y aprueba el perfil generado'}
              {phase === 'done' && '¡Perfil guardado!'}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">

          {/* PHASE: Questions */}
          {phase === 'questions' && (
            <div className="space-y-5 animate-fade-in">
              {error && <Alert variant="danger">{error}</Alert>}

              {[
                {
                  key: 'q1' as const,
                  num: 1,
                  label: '¿Cuál es el mayor problema que resuelves para tus mejores clientes?',
                  placeholder: 'Ej: Llegan al Medicare sin saber qué plan elegir y tienen miedo de elegir mal y quedarse sin cobertura cuando más la necesitan...',
                },
                {
                  key: 'q2' as const,
                  num: 2,
                  label: '¿Cómo describirías a tu cliente más reciente que cerró bien?',
                  placeholder: 'Ej: Una señora cubana de 67 años que llegó por referido de su vecina, trabajó toda la vida en limpieza, habla poco inglés y buscaba alguien de confianza que le explicara en español sin apurarla...',
                },
                {
                  key: 'q3' as const,
                  num: 3,
                  label: '¿Qué tienen en común tus mejores clientes?',
                  placeholder: 'Ej: Siempre llegan referidos por alguien que conocen, tienen 60+ años, están llegando a Medicare por primera vez, desconfían de las aseguradoras pero confían en mí...',
                },
              ].map(({ key, num, label, placeholder }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-800 mb-1.5">
                    <span className="text-brand-navy-500 font-bold">{num}.</span> {label}
                  </label>
                  <textarea
                    value={answers[key]}
                    onChange={(e) => setAnswers((p) => ({ ...p, [key]: e.target.value }))}
                    rows={3}
                    placeholder={placeholder}
                    className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy-500 resize-none"
                  />
                </div>
              ))}

              <Button
                onClick={handleGenerate}
                className="w-full"
                disabled={!answers.q1.trim() || !answers.q2.trim() || !answers.q3.trim()}
              >
                Generar mi Cliente Ideal →
              </Button>
            </div>
          )}

          {/* PHASE: Generating */}
          {phase === 'generating' && (
            <div className="flex flex-col items-center justify-center py-12 gap-4 animate-fade-in">
              <div className="w-14 h-14 rounded-2xl bg-brand-navy-50 flex items-center justify-center">
                <span className="text-3xl animate-pulse">🎯</span>
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-gray-800">Construyendo tu perfil de cliente ideal...</p>
                <p className="text-xs text-gray-400 mt-1">Analizando tu contexto, productos y mercado</p>
              </div>
            </div>
          )}

          {/* PHASE: Review */}
          {phase === 'review' && profile && (
            <div className="space-y-4 animate-fade-in">
              {/* Hypotheses warning */}
              {profile.meta?.hipotesis_pendientes?.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <p className="text-xs font-semibold text-amber-700 mb-1.5">
                    ⚠️ {profile.meta.hipotesis_pendientes.length} hipótesis a validar
                  </p>
                  {profile.meta.hipotesis_pendientes.map((h, i) => (
                    <p key={i} className="text-xs text-amber-600">• {h}</p>
                  ))}
                </div>
              )}

              {/* Demographic section */}
              {profile.demografico && (
                <ProfileSection title="Perfil demográfico" evidence={profile.demografico.evidencia}>
                  <ProfileRow label="Edad" value={profile.demografico.edad_rango} />
                  <ProfileRow label="Origen" value={profile.demografico.origen} />
                  <ProfileRow label="Ubicación" value={profile.demografico.ubicacion} />
                  <ProfileRow label="Ingresos" value={profile.demografico.nivel_ingreso} />
                  <ProfileRow label="Educación" value={profile.demografico.nivel_educacion} />
                </ProfileSection>
              )}

              {/* Psychographic section */}
              {profile.psicografico && (
                <ProfileSection title="Perfil psicológico" evidence={profile.psicografico.evidencia}>
                  <ProfileRow label="Etapa de vida" value={profile.psicografico.etapa_vida} />
                  <ProfileRow label="Miedos" value={profile.psicografico.miedos} />
                  <ProfileRow label="Deseos" value={profile.psicografico.deseos} />
                  <ProfileRow label="Conocimiento" value={profile.psicografico.nivel_conocimiento_seguros} />
                </ProfileSection>
              )}

              {/* Behavior section */}
              {profile.comportamiento && (
                <ProfileSection title="Comportamiento" evidence={profile.comportamiento.evidencia}>
                  <ProfileRow label="Canales" value={profile.comportamiento.canales_preferidos} />
                  <ProfileRow label="Objeciones" value={profile.comportamiento.objeciones_principales} />
                  <ProfileRow label="Motivadores" value={profile.comportamiento.motivadores} />
                  <ProfileRow label="Momento decisión" value={profile.comportamiento.momento_decision} />
                </ProfileSection>
              )}

              {/* Messaging section */}
              {profile.mensajes && (
                <ProfileSection title="Mensajes efectivos" evidence={profile.mensajes.evidencia}>
                  <ProfileRow label="Tono" value={profile.mensajes.tono_efectivo} />
                  <ProfileRow label="Ángulo" value={profile.mensajes.angulo_confianza} />
                  <ProfileRow label="Frases clave" value={profile.mensajes.frases_resonantes} />
                  <ProfileRow label="Evitar" value={profile.mensajes.frases_a_evitar} />
                </ProfileSection>
              )}

              {/* Editable description */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Descripción corta del cliente ideal (editable)
                </label>
                <textarea
                  value={editedDescription}
                  onChange={(e) => setEditedDescription(e.target.value)}
                  placeholder={profile.demografico ? `${profile.demografico.origen}, ${profile.demografico.edad_rango} años, ${profile.demografico.ubicacion}` : 'Descripción del cliente ideal'}
                  rows={2}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy-500 resize-none"
                />
              </div>

              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  onClick={() => setPhase('questions')}
                  className="flex-1"
                >
                  Volver a preguntas
                </Button>
                <Button
                  onClick={handleSave}
                  isLoading={isSaving}
                  loadingText="Guardando..."
                  className="flex-1"
                >
                  Aprobar y guardar →
                </Button>
              </div>
            </div>
          )}

          {/* PHASE: Done */}
          {phase === 'done' && (
            <div className="flex flex-col items-center justify-center py-12 gap-3 animate-fade-in">
              <span className="text-5xl">🎯</span>
              <p className="text-base font-semibold text-gray-800">¡Perfil guardado!</p>
              <p className="text-sm text-gray-500 text-center">
                La IA ahora conoce mejor a tu cliente ideal. Todo el contenido generado será más relevante.
              </p>
              <Button onClick={onClose} variant="secondary">Cerrar</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
