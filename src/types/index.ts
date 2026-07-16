/**
 * Autoridad Seguros AI™ — Application Types
 * Shared types for API responses, UI state, and cross-module contracts.
 */

import type { Profile, BrandKit, PlanTier, ContentType, InsuranceProduct } from './database'

// ─── API RESPONSE ENVELOPE ────────────────────────────────────────────────────

export interface ApiSuccess<T> {
  success: true
  data: T
}

export interface ApiError {
  success: false
  error: {
    code: string
    message: string
    details?: Record<string, string[]> // field-level validation errors
  }
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError

// ─── AUTH TYPES ───────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string
  email: string
  profile: Profile | null
  brandKit: BrandKit | null
  planTier: PlanTier
}

export interface SessionContext {
  user: AuthUser | null
  isLoading: boolean
}

// ─── ONBOARDING ───────────────────────────────────────────────────────────────

export interface OnboardingStep {
  step: 1 | 2 | 3
  completed: boolean
}

export interface OnboardingData {
  // Step 1 — Identity
  nombre_completo: string
  estado_usa: string
  especialidades: InsuranceProduct[]
  comunidad: string
  // Step 2 — Brand Kit
  color_primario: string
  color_secundario: string
  tono_de_voz: string
  tagline: string
  instagram_handle: string
  // Step 3 — Product focus (optional)
  producto_principal?: InsuranceProduct
}

// ─── CONTENT GENERATION ───────────────────────────────────────────────────────

export interface ContentGenerationParams {
  tipo: ContentType
  producto: InsuranceProduct
  plataforma: string
  tono: 'educativo' | 'emocional' | 'urgencia'
  instruccion_extra?: string
  buyer_persona_id?: string
}

export interface ContentGenerationResult {
  id: string
  contenido: string
  hashtags?: string[]
  compliance: ComplianceBadgeResult
  tokens_used: number
}

export interface ComplianceBadgeResult {
  nivel: 'verde' | 'amarillo' | 'rojo'
  aprobado: boolean
  score_riesgo: number
  problemas_count: number
}

// ─── OBJECTION AI ─────────────────────────────────────────────────────────────

export interface ObjectionParams {
  objecion: string
  producto: InsuranceProduct
  canal: 'llamada' | 'whatsapp' | 'presencial'
}

export interface ObjectionResult {
  categoria: string
  objecion_oculta: string | null
  variantes: ObjectionVariant[]
  recomendacion: string
}

export interface ObjectionVariant {
  tipo: 'consultiva' | 'emocional' | 'logica' | 'corta' | 'whatsapp' | 'llamada'
  label: string
  texto: string
  por_que_funciona: string
}

// ─── PLAN MANAGEMENT ──────────────────────────────────────────────────────────

export interface UsageStats {
  contenidos_mes: number
  max_contenidos_mes: number
  copilot_mes: number
  max_copilot_mes: number
  compliance_mes: number
  max_compliance_mes: number
  periodo_actual: string // ISO date 'YYYY-MM-01'
}

export interface PlanFeatures {
  max_contenidos_mes: number
  max_copilot_mes: number
  max_compliance_mes: number
  tiene_video_studio: boolean
  tiene_publicacion_directa: boolean
  precio_mensual_usd: number
}

// ─── UI STATE ─────────────────────────────────────────────────────────────────

export type StreamingStatus = 'idle' | 'streaming' | 'complete' | 'error'

export interface StreamingState {
  status: StreamingStatus
  content: string
  error: string | null
}

export interface ToastMessage {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  description?: string
  duration?: number
}

// ─── NAVIGATION ───────────────────────────────────────────────────────────────

export interface NavItem {
  label: string
  href: string
  icon: string
  badge?: string | number
  requiredPlan?: PlanTier
  isNew?: boolean
}

// ─── FORM TYPES ───────────────────────────────────────────────────────────────

export interface LoginFormData {
  email: string
  password: string
}

export interface RegisterFormData {
  email: string
  password: string
  confirmPassword: string
  nombre_completo: string
}

export interface ResetPasswordFormData {
  email: string
}

export interface UpdatePasswordFormData {
  password: string
  confirmPassword: string
}

// ─── UTILITY TYPES ────────────────────────────────────────────────────────────

// Makes specific keys required in a Partial type
export type RequiredKeys<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>

// Removes null from a type
export type NonNullable<T> = T extends null | undefined ? never : T

// Server Action result
export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string }
