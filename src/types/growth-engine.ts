/**
 * AI Growth Engine Types — Autoridad Seguros AI™
 *
 * Single type system for the evolutionary Growth Engine.
 * Phase 5: Intent Engine (current).
 * Phase 13: Performance Engine (extends these types, doesn't replace them).
 */

// ─── Evidence Types ───────────────────────────────────────────────────────────
// Every recommendation declares what data backs it.
// This prevents the system from presenting hypotheses as facts.

export type EvidenceType =
  | 'AGENT_DATA'    // Based on agent profile, history, or goals
  | 'SEASONALITY'   // Based on insurance calendar and time of year
  | 'HYPOTHESIS'    // Strategic recommendation to validate — not yet proven
  | 'PERFORMANCE'   // Phase 13: based on real engagement/conversion data

export interface EvidenceDeclaration {
  type: EvidenceType
  summary: string   // Brief, honest explanation of what data backs this
  confidence: 'alta' | 'media' | 'estimada'
  // Phase 13 extension:
  data_points?: number    // How many data points back this
  time_period?: string    // 'últimos 30 días', 'últimas 4 semanas'
}

// ─── Growth Engine Recommendation ────────────────────────────────────────────
// Structured format for every recommendation the engine generates.
// All 4 required fields + evidence transparency.

export interface GrowthRecommendation {
  id?: string               // DB id if saved
  titulo: string
  que_recomienda: string    // What to do
  por_que: string           // Why (reasoning)
  objetivo_estrategico: string  // Which business goal this serves
  accion_concreta: string   // Exact next step, specific and executable

  // Evidence transparency
  evidence: EvidenceDeclaration

  // Classification
  tipo: 'diario' | 'semanal' | 'mensual' | 'oportunidad' | 'alerta'
  prioridad: 'alta' | 'media' | 'baja'
  producto_relacionado?: string
  tipo_contenido_sugerido?: string

  // Quick action (connects to Content Studio)
  accion_rapida?: {
    label: string           // Button text
    href: string            // Pre-configured Content Studio URL
  }

  // Phase 13 extension points (null until Phase 13)
  performance_data?: null | {
    basado_en: string
    tasa_exito_historica?: number
    ejemplos_exitosos?: number
  }
}

// ─── Growth Engine Output (full brief) ───────────────────────────────────────

export interface GrowthEngineBrief {
  // Situational analysis
  situacion_actual: string

  // The recommendations
  recomendaciones: GrowthRecommendation[]

  // Upcoming opportunities from insurance_calendar
  oportunidades_proximas: CalendarEvent[]

  // Optional: weekly or monthly insights
  insight_destacado?: string

  // Context used (for transparency)
  capas_disponibles: EvidenceType[]
  generado_en: string
}

// ─── Copilot Mode Params ──────────────────────────────────────────────────────

export type CopilotMode =
  | 'estratega'
  | 'analista'
  | 'campana'
  | 'posicionamiento'
  | 'chat'

export interface EstrategaParams {
  modo: 'estratega'
  horizonte: 'hoy' | 'semana' | 'mes'
}

export interface AnalistaParams {
  modo: 'analista'
  periodo_dias: 7 | 14 | 30
}

export interface CampanaParams {
  modo: 'campana'
  producto: string
  duracion: '1_semana' | '2_semanas' | '1_mes'
  objetivo: 'leads' | 'educacion' | 'reconocimiento'
  tiempo_diario_min: 15 | 30 | 60
}

export interface PosicionamientoParams {
  modo: 'posicionamiento'
  nicho_objetivo: string
  plazo_semanas: 4 | 8 | 12
}

export interface ChatParams {
  modo: 'chat'
  pregunta_inicial?: string
  session_id?: string    // Resume existing session
}

export type CopilotParams =
  | EstrategaParams
  | AnalistaParams
  | CampanaParams
  | PosicionamientoParams
  | ChatParams

// ─── Copilot Response ─────────────────────────────────────────────────────────

export interface CopilotMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

export interface CampaignPiece {
  dia: number
  tipo: string           // content_type
  titulo: string
  descripcion: string
  objetivo: string
  cta: string
  config_studio?: {      // Pre-fill Content Studio
    tipo: string
    producto: string
    tono: string
  }
}

export interface CampaignPlan {
  nombre_campana: string
  objetivo: string
  metricas_exito: string[]
  mensaje_central: string
  piezas: CampaignPiece[]
  consejo_final: string
}

// ─── Calendar Event ───────────────────────────────────────────────────────────

export interface CalendarEvent {
  id: string
  nombre: string
  tipo: string
  fecha_inicio: string
  fecha_fin: string
  dias_hasta_inicio: number | null
  dias_restantes: number | null
  esta_activo: boolean
  importancia: number
  consejo_marketing: string | null
  productos_relevantes: string[]
}

// ─── Agent Goals ──────────────────────────────────────────────────────────────

export interface AgentGoals {
  id?: string
  mes: string
  meta_leads: number | null
  meta_clientes: number | null
  producto_prioritario: string | null
  objetivo_principal: 'leads' | 'awareness' | 'autoridad' | 'referidos'
  tiempo_disponible_min: number
  notas: string | null
  // Phase 13: progress tracking
  leads_obtenidos?: number
  clientes_cerrados?: number
}

// ─── Copilot Context (assembled by build_copilot_context()) ──────────────────

export interface CopilotContext {
  agent_context: string
  fecha_actual: string
  mes_actual: string
  dia_semana: string
  upcoming_events: CalendarEvent[]
  activity_summary: {
    total_generados: number
    por_modulo: Record<string, number>
    dias_activos: number
    ultimo_uso: string | null
  } | null
  goals: AgentGoals | null
  engine_version: string
  available_layers: EvidenceType[]
  // Phase 13 extension points (typed now, null until Phase 13):
  performance_summary?: null
  engagement_patterns?: null
  content_performance?: null
}

// ─── Growth Engine Session (for DB) ──────────────────────────────────────────

export interface GrowthEngineOutput {
  id: string
  user_id: string
  tipo: 'diario' | 'semanal' | 'mensual' | 'oportunidad' | 'alerta'
  modo_origen: string | null
  periodo: string
  titulo: string
  que_recomienda: string
  por_que: string
  objetivo_estrategico: string
  accion_concreta: string
  evidence_type: EvidenceType
  evidence_summary: string | null
  context_snapshot: Record<string, unknown> | null
  calendario_eventos: CalendarEvent[] | null
  fue_vista: boolean
  fue_ejecutada: boolean
  fue_descartada: boolean
  contenido_generado_id: string | null
  // Phase 13 fields (null now):
  outcome_leads: number | null
  outcome_engagement: Record<string, unknown> | null
  recommendation_score: number | null
  validacion_resultado: string | null
  created_at: string
}

export interface CopilotSession {
  id: string
  user_id: string
  modo: CopilotMode
  parametros_modo: Record<string, unknown> | null
  conversacion: CopilotMessage[]
  resumen_sesion: string | null
  tokens_usados: number
  growth_output_id: string | null
  created_at: string
  updated_at: string
}
