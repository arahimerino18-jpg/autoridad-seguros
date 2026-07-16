/**
 * Autoridad Seguros AI™ — Database Types
 * Auto-generated from Supabase schema. Do not edit manually.
 * Re-generate with: supabase gen types typescript --local > src/types/database.ts
 */

// ─── ENUMS ────────────────────────────────────────────────────────────────────

export type PlanTier = 'starter' | 'pro' | 'elite'

export type SubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'incomplete_expired'
  | 'paused'

export type InsuranceProduct =
  | 'medicare'
  | 'aca'
  | 'iul'
  | 'final_expense'
  | 'life'
  | 'mortgage'
  | 'general'

export type SocialPlatform =
  | 'instagram'
  | 'facebook'
  | 'tiktok'
  | 'youtube'
  | 'linkedin'
  | 'whatsapp'

export type ContentType =
  | 'post'
  | 'carousel'
  | 'reel'
  | 'story'
  | 'email'
  | 'sms'
  | 'whatsapp'

export type ContentGoal =
  | 'educate'
  | 'connect'
  | 'convert'
  | 'retain'
  | 'referral'

export type ContentStatus =
  | 'draft'
  | 'scheduled'
  | 'published'
  | 'archived'

export type AppModule =
  | 'content_studio'
  | 'marketing_copilot'
  | 'video_studio'
  | 'objection_ai'
  | 'compliance_center'
  | 'lead_magnet'
  | 'analytics'
  | 'agent_video_ai'

// ─── BASE ROW TYPE ────────────────────────────────────────────────────────────

interface BaseRow {
  id: string
  created_at: string
}

interface SoftDeletable {
  deleted_at: string | null
}

interface Timestamped extends BaseRow {
  updated_at: string
}

// ─── DOMAIN 1: IDENTITY ───────────────────────────────────────────────────────

export interface Profile extends Timestamped, SoftDeletable {
  email: string
  nombre_completo: string
  foto_url: string | null
  telefono: string | null
  estado_usa: string
  especialidades: InsuranceProduct[]
  plan_tier: PlanTier
  score_autoridad: number | null
  onboarding_step: number
  onboarding_done: boolean
  referido_por: string | null
}

export interface BrandKit extends Timestamped {
  user_id: string
  logo_url: string | null
  color_primario: string
  color_secundario: string
  bio_instagram: string | null
  tagline: string | null
  tono_de_voz: string | null
  instagram_handle: string | null
  score_completitud: number
}

// ─── DOMAIN 3: CONTENT ────────────────────────────────────────────────────────

export interface Contenido extends Timestamped, SoftDeletable {
  user_id: string
  tipo: ContentType
  producto: InsuranceProduct
  plataforma: SocialPlatform
  objetivo: ContentGoal
  titulo: string
  cuerpo: string
  cuerpo_editado: string | null
  hashtags: string[] | null
  status: ContentStatus
  compliance_revisado: boolean
  compliance_log_id: string | null
  publicar_en: string | null
  buyer_persona_id: string | null
  tokens_total: number | null
  es_favorito: boolean
  // Content Studio extended fields
  slides_json: SlideItem[] | null
  segmentos_json: ScriptSegment[] | null
  subject_email: string | null
  preview_text_email: string | null
  caracteres_sms: number | null
  segmentos_sms: number | null
  tono_generacion: 'educativo' | 'emocional' | 'urgencia' | null
  instruccion_extra: string | null
}

export interface SlideItem {
  numero: number
  tipo: 'hook' | 'contenido' | 'cta'
  titulo: string
  cuerpo: string
  emoji_principal: string
}

export interface ScriptSegment {
  id: number
  tipo: 'hook' | 'desarrollo' | 'punto_1' | 'punto_2' | 'punto_3' | 'cta'
  tiempo_inicio: string
  tiempo_fin: string
  texto: string
  accion_fisica: string
  texto_overlay: string
  nota_produccion: string | null
}

// ─── DOMAIN 5: OPERATIONS ─────────────────────────────────────────────────────

export interface ComplianceLog extends BaseRow {
  user_id: string
  contenido_id: string | null
  texto_revisado: string
  producto: InsuranceProduct
  aprobado: boolean
  score_riesgo: number
  problemas: ComplianceProblem[] | null
  texto_corregido: string | null
  modelo_ia: string
  regulaciones_ref: string[] | null
}

export interface ComplianceProblem {
  tipo: string
  descripcion: string
  fragmento: string
  sugerencia: string
}

export interface AiUsage extends BaseRow {
  user_id: string
  modulo: AppModule
  operacion: string
  tokens_total: number
  costo_usd: number
  fue_cacheado: boolean
  periodo_mes: string
  contenido_id: string | null
}

export interface ObjectionSession extends BaseRow {
  user_id: string
  objecion_ingresada: string
  categoria: string
  canal: 'llamada' | 'whatsapp' | 'presencial'
  respuestas_generadas: ObjectionResponse[] | null
  fue_cacheado: boolean
}

export interface ObjectionResponse {
  tipo: 'consultiva' | 'emocional' | 'logica' | 'corta' | 'whatsapp' | 'llamada'
  label: string
  texto: string
  por_que_funciona: string
}

// ─── DOMAIN 6: BILLING ────────────────────────────────────────────────────────

export interface Subscription extends Timestamped {
  user_id: string
  stripe_customer_id: string
  stripe_subscription_id: string | null
  plan: PlanTier
  status: SubscriptionStatus
  periodo_fin: string | null
  trial_fin: string | null
  ciclo: 'monthly' | 'annual' | null
  precio_usd: number | null
}

export interface PlanLimit extends BaseRow {
  plan: PlanTier
  max_contenidos_mes: number
  max_copilot_mes: number
  max_compliance_mes: number
  max_imagenes_mes: number
  tiene_video_studio: boolean
  tiene_publicacion_directa: boolean
  precio_mensual_usd: number
  precio_anual_usd: number
}

export interface AnalyticsEvent extends BaseRow {
  user_id: string
  tipo_evento: string
  modulo: AppModule | null
  contenido_id: string | null
  metadata: Record<string, unknown>
}

// ─── DOMAIN 7: AGENT INTELLIGENCE ────────────────────────────────────────────

export interface AgentIntelligenceProfile extends Timestamped {
  user_id: string
  // Writing style
  estilo_escritura: string | null
  tono_comunicacion: string | null
  nivel_formalidad: number | null
  usa_emojis: boolean
  longitud_preferida: string | null
  // Voice & personality
  frases_propias: string[] | null
  palabras_a_evitar: string[] | null
  historias_personales: Record<string, unknown>[] | null
  propuesta_de_valor: string | null
  // Identity (Phase 4)
  historia_profesional: string | null
  historia_personal: string | null
  mision: string | null
  vision: string | null
  valores: string[] | null
  diferenciadores: string[] | null
  // Voice expanded
  tipo_humor: string | null
  nivel_emocional: string | null
  usa_historias: boolean
  usa_estadisticas: boolean
  // Market
  productos_principales: InsuranceProduct[] | null
  mercado_objetivo: string | null
  ciudad_estado: string | null
  idiomas: string[]
  comunidades: string[] | null
  // Market expanded
  cliente_ideal_descripcion: string | null
  nichos_secundarios: string[] | null
  problemas_que_resuelve: string[] | null
  metas_negocio: Record<string, unknown> | null
  // Sales
  objeciones_frecuentes: Record<string, unknown>[] | null
  ctas_efectivos: string[] | null
  momentos_cierre: string[] | null
  fuente_leads_principal: string | null
  tasa_cierre_estimada: number | null
  ticket_promedio_usd: number | null
  // Content performance
  tipos_contenido_preferidos: ContentType[] | null
  horarios_optimos: Record<string, unknown> | null
  hashtags_recurrentes: string[] | null
  temas_de_alto_rendimiento: string[] | null
  // Brand
  color_primario: string | null
  color_secundario: string | null
  tagline: string | null
  instagram_handle: string | null
  // Interview
  entrevista_completada: boolean
  entrevista_fecha: string | null
  // Cross-module learning (Phases 5-13)
  aprendizaje_content_studio: Record<string, unknown> | null
  aprendizaje_objection_ai: Record<string, unknown> | null
  aprendizaje_copilot: Record<string, unknown> | null
  aprendizaje_analytics: Record<string, unknown> | null
  aprendizaje_lead_magnets: Record<string, unknown> | null
  aprendizaje_cliente_ideal: Record<string, unknown> | null
  aprendizaje_video_studio: Record<string, unknown> | null
  // Learning metadata
  total_contenidos_generados: number
  total_contenidos_publicados: number
  total_objections_handled: number
  patron_edicion_json: Record<string, unknown> | null
  score_perfil_completitud: number
  version: number
  ultima_actualizacion_ia: string | null
}

// ─── INTERVIEW SESSION ────────────────────────────────────────────────────────

export type InterviewStatus = 'en_progreso' | 'resumen_generado' | 'aprobado' | 'descartado'

export interface InterviewMessage {
  role: 'assistant' | 'user'
  content: string
  timestamp: string
}

export interface InterviewSession extends Timestamped {
  user_id: string
  status: InterviewStatus
  conversacion: InterviewMessage[]
  extractos_json: Record<string, string> | null
  resumen_visible: string | null
  datos_estructurados: Partial<AgentIntelligenceProfile> | null
  temas_cubiertos: string[]
  score_covertura: number
  es_activa: boolean
}

// ─── BRAND KIT EXTENDED ───────────────────────────────────────────────────────

export interface BrandKitExtended extends BrandKit {
  nombre_comercial: string | null
  nombre_agencia: string | null
  anos_experiencia: number | null
  certificaciones: string[] | null
  estados_licencia: string[] | null
  numero_licencia: string | null
  logo_variante_blanca_url: string | null
  logo_variante_oscura_url: string | null
  logo_icono_url: string | null
  tipografia_principal: string | null
  tipografia_secundaria: string | null
  color_acento: string | null
  estilo_grafico: string | null
  estilo_fotografico: string | null
  foto_perfil_url: string | null
  fotos_adicionales_urls: string[] | null
  facebook_url: string | null
  tiktok_handle: string | null
  linkedin_url: string | null
  youtube_url: string | null
  pinterest_url: string | null
  whatsapp_business: string | null
  calendly_url: string | null
  sitio_web: string | null
}

// ─── DATABASE SCHEMA TYPE ─────────────────────────────────────────────────────


export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Omit<Profile, 'created_at' | 'updated_at'>
        Update: Partial<Omit<Profile, 'id' | 'created_at'>>
      }
      brand_kits: {
        Row: BrandKit
        Insert: Omit<BrandKit, 'created_at' | 'updated_at'>
        Update: Partial<Omit<BrandKit, 'id' | 'created_at'>>
      }
      contenidos: {
        Row: Contenido
        Insert: Omit<Contenido, 'created_at' | 'updated_at'>
        Update: Partial<Omit<Contenido, 'id' | 'created_at'>>
      }
      compliance_logs: {
        Row: ComplianceLog
        Insert: Omit<ComplianceLog, 'created_at'>
        Update: never // Immutable
      }
      ai_usage: {
        Row: AiUsage
        Insert: Omit<AiUsage, 'created_at'>
        Update: never // Immutable
      }
      objection_sessions: {
        Row: ObjectionSession
        Insert: Omit<ObjectionSession, 'created_at'>
        Update: never // Immutable
      }
      subscriptions: {
        Row: Subscription
        Insert: Omit<Subscription, 'created_at' | 'updated_at'>
        Update: Partial<Omit<Subscription, 'id' | 'created_at'>>
      }
      plan_limits: {
        Row: PlanLimit
        Insert: Omit<PlanLimit, 'created_at'>
        Update: Partial<Omit<PlanLimit, 'id' | 'created_at'>>
      }
      analytics_events: {
        Row: AnalyticsEvent
        Insert: Omit<AnalyticsEvent, 'created_at'>
        Update: never // Immutable
      }
      agent_intelligence_profiles: {
        Row: AgentIntelligenceProfile
        Insert: Omit<AgentIntelligenceProfile, 'created_at' | 'updated_at'>
        Update: Partial<Omit<AgentIntelligenceProfile, 'id' | 'created_at'>>
      }
      interview_sessions: {
        Row: InterviewSession
        Insert: Omit<InterviewSession, 'created_at' | 'updated_at'>
        Update: Partial<Omit<InterviewSession, 'id' | 'created_at'>>
      }
    }
    Enums: {
      plan_tier: PlanTier
      subscription_status: SubscriptionStatus
      insurance_product: InsuranceProduct
      social_platform: SocialPlatform
      content_type: ContentType
      content_goal: ContentGoal
      content_status: ContentStatus
      app_module: AppModule
    }
  }
}

// ─── PHASE 8: INTEL SOURCE & OBJECTION AI ────────────────────────────────────

export type IntelSource =
  | 'declarado'
  | 'observado'
  | 'inferido'
  | 'hipotesis'
  | 'confirmado'

export interface InferenciaPendiente {
  campo: string
  valor_actual: unknown
  valor_inferido: unknown
  fuente: string
  fecha_inferencia: string
  descripcion: string
}

export type ObjecionTipo = 'precio' | 'tiempo' | 'confianza' | 'necesidad' | 'autoridad' | 'otro'
export type CanalObjecion = 'whatsapp' | 'en_persona' | 'llamada' | 'messenger' | 'otro'

export interface ObjecionAngulo {
  angulo: string
  etiqueta: string
  texto_whatsapp: string
  texto_verbal: string
  cuando_usar: string
}

export interface ObjecionAnalisis {
  significado_real: string
  tipo: ObjecionTipo
  nivel_resistencia: 'baja' | 'media' | 'alta'
  estrategia_recomendada: string
  respuestas: ObjecionAngulo[]
  pregunta_seguimiento: string
  que_evitar: string[]
  compliance_nota: string | null
}

export interface ObjectionResponse extends BaseRow {
  user_id: string
  objecion_texto: string
  objecion_tipo: ObjecionTipo | null
  producto: string | null
  canal: CanalObjecion | null
  contexto_prospecto: string | null
  respuesta_json: ObjecionAnalisis
  angulo_copiado: string | null
  accion: 'copiado' | 'regenerado' | 'descartado' | null
  fue_util: 'si' | 'no' | 'no_usada' | null
  notas_agente: string | null
  resultado_real: string | null
  tiempo_respuesta_seg: number | null
}

// ─── PHASE 11: EVIDENCE AGGREGATOR ───────────────────────────────────────────

/**
 * Extended InferenciaPendiente — Phase 11
 * Extends the base structure from Phase 8 with traceability fields.
 * Stored as JSONB array in agent_intelligence_profiles.inferencias_pendientes
 */
export interface InferenciaPendienteV2 extends InferenciaPendiente {
  // Traceability (required in Phase 11+)
  evidence_count: number       // How many signals support this inference
  evidence_sources: string[]   // Which tables/modules: 'objection_responses', 'analytics_events', etc.
  confidence: 'low' | 'medium' | 'high'
  signal_summary: string       // "3 objeciones de precio marcadas como útiles en 30 días"
  valor_hash: string           // Hash of valor_inferido for deduplication and rejection tracking

  // Status (for UI display — source of truth is inferencias_pendientes array membership)
  status: 'pending'            // Always 'pending' while in the array
}

export interface InferenciaRechazada {
  campo: string
  valor_hash: string           // Hash of the rejected inference value
  rechazado_en: string         // ISO timestamp
  evidence_count_at_rejection: number
  razon?: string               // Optional: why the agent rejected it
}

export interface EvidenceAggregatorRun {
  id: string
  user_id: string
  ran_at: string
  signals_analyzed: number
  sources_checked: string[]
  inferences_proposed: number
  inferences_skipped: number
  run_summary: Record<string, unknown>
  trigger_type: 'manual' | 'scheduled' | 'post_onboarding'
}

// ─── PHASE 12 EXTENSIONS ─────────────────────────────────────────────────────

// Extended InferenciaRechazada (adds 'estado' for cleanup policy)
export interface InferenciaRechazadaV2 extends InferenciaRechazada {
  estado: 'activo' | 'archivado'
}

// Inference edit session — used in the Review → Edit → Approve flow
export interface InferenceEditSession {
  inferencia: InferenciaPendienteV2
  valorEditado: unknown          // What the agent changed valor_inferido to
  edited: boolean                // Whether the agent changed the value
}

// ─── PHASE 13: HISTORY, CONFIG, CONFIDENCE SCORE ─────────────────────────────

export type IntelProfileChangeSource =
  | 'declarado'
  | 'inferencia_ia'
  | 'inferencia_editada'
  | 'reversion'
  | 'importado'

export interface IntelProfileHistoryEntry {
  id: string
  user_id: string
  campo: string
  valor_anterior: unknown
  valor_nuevo: unknown
  source_type: IntelProfileChangeSource
  origen: string | null
  motivo: string | null
  fuente_evidencia: string | null
  evidence_count: number | null
  created_at: string
}

/**
 * AggregatorConfig — configurable thresholds for the Evidence Aggregator.
 * Loaded from DB at runtime. Falls back to inline defaults if DB unavailable.
 */
export interface AggregatorConfig {
  user_id: string | null
  // Rule thresholds
  r1_min_signals: number
  r1_window_days: number
  r2_min_sessions: number
  r2_window_days: number
  r3_min_signals: number
  r3_min_per_product: number
  r3_window_days: number
  r4_min_useful_responses: number
  r5_min_prospects: number
  r5_min_pattern_count: number
  r5_window_days: number
  r6_min_useful_responses: number
  r6_min_phrase_repetitions: number
  r6_window_days: number
  r7_min_phrase_repetitions: number
  r7_max_existing_frases: number
  r7_max_interview_sessions: number
  // Confidence thresholds
  conf_high_min_signals: number
  conf_high_min_sources: number
  conf_high_min_days: number
  conf_medium_min_signals: number
  // Rejection guard
  rejection_reproposal_evidence_factor: number
  rejection_reproposal_min_days: number
  // Cleanup
  cleanup_max_evidence_for_removal: number
  cleanup_min_age_days: number
}

/**
 * ConfidenceScore — per-field confidence display in the Inteligencia IA tab.
 * Shown for every field in the agent's intelligence profile.
 */
export interface FieldConfidenceScore {
  campo: string
  label: string
  source: IntelSource
  confidence: 'declarado' | 'low' | 'medium' | 'high' | 'confirmed'
  evidence_category: 'directa' | 'observada' | 'inferida' | 'hipotesis' | 'confirmada'
  explanation: string      // Human-readable: "Declarado por ti en la entrevista de marca"
  last_updated: string | null
}

export interface CronJobRun {
  id: string
  job_name: string
  trigger_type: 'scheduled' | 'manual' | 'api'
  status: 'running' | 'completed' | 'failed' | 'skipped'
  started_at: string
  completed_at: string | null
  users_processed: number | null
  records_affected: number | null
  error_message: string | null
  metadata: Record<string, unknown>
}

// ─── PHASE 15: PERFORMANCE + INFERENCE LIFECYCLE ─────────────────────────────

export type InferenceEstado =
  | 'pendiente'
  | 'aprobada'
  | 'aplicada'
  | 'revertida'
  | 'archivada'
  | 'rechazada'

export interface InferenceLifecycleEntry {
  id: string
  user_id: string
  campo: string
  valor_hash: string
  fuente: string | null
  evidence_count: number | null
  estado: InferenceEstado
  edited: boolean
  valor_propuesto: unknown
  valor_aplicado: unknown
  motivo: string | null
  action_by: 'agent' | 'system' | 'cron'
  created_at: string
}

// Performance Dashboard data structures
export interface PerformanceMetrics {
  // Content
  contenidos_total: number
  contenidos_mes: number
  contenidos_por_producto: Record<string, number>
  contenidos_por_canal: Record<string, number>
  // AI usage
  ai_calls_total: number
  ai_calls_mes: number
  ai_calls_por_modulo: Record<string, number>
  costo_usd_mes: number
  // Compliance
  compliance_checks: number
  compliance_risk_low: number
  compliance_risk_medium: number
  compliance_risk_high: number
  // Objections
  objections_total: number
  objections_por_tipo: Record<string, number>
  objections_util_rate: number  // % that were marked útil
  // Aggregator
  inferencias_propuestas: number
  inferencias_aprobadas: number
  inferencias_rechazadas: number
  // Profile
  perfil_score: number
  first_value_generated_at: string | null
  onboarding_completed_at: string | null
  // Phase 17: weekly comparison (null if insufficient data)
  weekly_comparison: WeeklyComparison | null
}

/**
 * Weekly comparison — only populated when minimum data requirements are met.
 * Prevents showing misleading trends from insufficient data.
 */
export interface WeeklyComparison {
  has_sufficient_data: boolean
  minimum_events_required: number
  current_period: string      // e.g. '2025-W03'
  previous_period: string     // e.g. '2025-W02'
  reason_if_insufficient?: string
  // Deltas (positive = improvement, shown only when has_sufficient_data = true)
  contenidos_delta?: number
  ai_calls_delta?: number
  objections_delta?: number
  compliance_delta?: number
}

// ─── PHASE 16: BRIEFING + EXPORT ─────────────────────────────────────────────

export interface WeeklyBriefing {
  id: string
  user_id: string
  year: number
  week_number: number
  periodo_key: string           // e.g. '2025-W03'
  briefing_texto: string
  modelo_ia: string
  trigger_type: 'cron' | 'manual' | 'api'
  context_layers: string[] | null
  tokens_used: number | null
  costo_usd: number | null
  created_at: string
}

export interface ExportEvent {
  id: string
  user_id: string
  export_format: 'json' | 'pdf'
  data_scope: string[]
  record_count: number | null
  ip_address: string | null
  created_at: string
}

// Structured export payload (JSON format)
export interface AgentDataExport {
  meta: {
    export_version: '1.0'
    exported_at: string
    user_id: string
    platform: 'Autoridad Seguros AI™'
  }
  perfil: Record<string, unknown> | null
  intelligence_profile: Record<string, unknown> | null
  inferencias_pendientes: unknown[]
  historial_cambios: unknown[]
  contenidos: unknown[]
  objeciones: unknown[]
  compliance_logs: unknown[]
  briefings: unknown[]
  metricas: PerformanceMetrics | null
}
