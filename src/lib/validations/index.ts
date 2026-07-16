/**
 * Autoridad Seguros AI™ — Validation Schemas
 * All Zod schemas used for form validation and API input validation.
 * Centralizing them here prevents duplication and ensures consistency.
 */

import { z } from 'zod'

// ─── AUTH SCHEMAS ─────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'El email es requerido')
    .email('Ingresa un email válido'),
  password: z
    .string()
    .min(1, 'La contraseña es requerida'),
})

export const registerSchema = z
  .object({
    email: z
      .string()
      .min(1, 'El email es requerido')
      .email('Ingresa un email válido'),
    nombre_completo: z
      .string()
      .min(2, 'El nombre debe tener al menos 2 caracteres')
      .max(100, 'El nombre es demasiado largo'),
    password: z
      .string()
      .min(8, 'La contraseña debe tener al menos 8 caracteres')
      .regex(/[A-Z]/, 'Debe incluir al menos una letra mayúscula')
      .regex(/[0-9]/, 'Debe incluir al menos un número'),
    confirmPassword: z.string().min(1, 'Confirma tu contraseña'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  })

export const resetPasswordSchema = z.object({
  email: z
    .string()
    .min(1, 'El email es requerido')
    .email('Ingresa un email válido'),
})

export const updatePasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, 'La contraseña debe tener al menos 8 caracteres')
      .regex(/[A-Z]/, 'Debe incluir al menos una letra mayúscula')
      .regex(/[0-9]/, 'Debe incluir al menos un número'),
    confirmPassword: z.string().min(1, 'Confirma tu contraseña'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  })

// ─── ONBOARDING SCHEMAS ───────────────────────────────────────────────────────

export const onboardingStep1Schema = z.object({
  nombre_completo: z
    .string()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(100, 'El nombre es demasiado largo'),
  estado_usa: z
    .string()
    .min(2, 'Selecciona tu estado')
    .max(2, 'Estado inválido'),
  especialidades: z
    .array(z.enum(['medicare', 'aca', 'iul', 'final_expense', 'life', 'mortgage', 'general']))
    .min(1, 'Selecciona al menos una especialidad'),
  comunidad: z
    .string()
    .min(1, 'Selecciona la comunidad que atiendes'),
})

export const onboardingStep2Schema = z.object({
  color_primario: z
    .string()
    .regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Color inválido — usa formato hex (#1B2E6B)'),
  color_secundario: z
    .string()
    .regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Color inválido — usa formato hex (#D4A017)'),
  tono_de_voz: z
    .string()
    .min(1, 'Selecciona tu tono de voz'),
  tagline: z
    .string()
    .max(80, 'El tagline debe tener máximo 80 caracteres')
    .optional(),
  instagram_handle: z
    .string()
    .max(30, 'El handle es demasiado largo')
    .regex(/^@?[a-zA-Z0-9._]*$/, 'Handle inválido')
    .optional(),
})

export const onboardingStep3Schema = z.object({
  producto_principal: z
    .enum(['medicare', 'aca', 'iul', 'final_expense', 'life', 'mortgage', 'general'])
    .optional(),
})

// ─── CONTENT GENERATION SCHEMAS ───────────────────────────────────────────────

export const contentGenerationSchema = z.object({
  tipo: z.enum(['post', 'carousel', 'reel', 'story', 'email', 'sms', 'whatsapp']),
  producto: z.enum(['medicare', 'aca', 'iul', 'final_expense', 'life', 'mortgage', 'general']),
  plataforma: z.enum(['instagram', 'facebook', 'tiktok', 'youtube', 'linkedin', 'whatsapp']),
  tono: z.enum(['educativo', 'emocional', 'urgencia']),
  instruccion_extra: z
    .string()
    .max(500, 'La instrucción no puede exceder 500 caracteres')
    .optional(),
  buyer_persona_id: z.string().uuid().optional(),
})

// ─── OBJECTION AI SCHEMAS ─────────────────────────────────────────────────────

export const objectionSchema = z.object({
  objecion: z
    .string()
    .min(10, 'Escribe la objeción completa (mínimo 10 caracteres)')
    .max(1000, 'La objeción es demasiado larga'),
  producto: z.enum(['medicare', 'aca', 'iul', 'final_expense', 'life', 'mortgage', 'general']),
  canal: z.enum(['llamada', 'whatsapp', 'presencial']),
})

// ─── BRAND KIT SCHEMAS ────────────────────────────────────────────────────────

export const brandKitSchema = z.object({
  color_primario: z
    .string()
    .regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Color inválido'),
  color_secundario: z
    .string()
    .regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Color inválido'),
  tono_de_voz: z.string().min(1, 'Selecciona el tono de voz'),
  tagline: z.string().max(80, 'Máximo 80 caracteres').optional(),
  bio_instagram: z.string().max(150, 'La bio de Instagram tiene máximo 150 caracteres').optional(),
  instagram_handle: z
    .string()
    .regex(/^@?[a-zA-Z0-9._]+$/, 'Handle inválido')
    .optional()
    .transform((val) => val ? (val.startsWith('@') ? val : `@${val}`) : undefined),
})

// ─── PROFILE SCHEMAS ──────────────────────────────────────────────────────────

export const updateProfileSchema = z.object({
  nombre_completo: z
    .string()
    .min(2, 'Mínimo 2 caracteres')
    .max(100, 'Máximo 100 caracteres'),
  telefono: z
    .string()
    .regex(/^\+?[1-9]\d{9,14}$/, 'Teléfono inválido — incluye código de país')
    .optional()
    .nullable(),
  estado_usa: z.string().length(2, 'Selecciona un estado válido'),
  especialidades: z
    .array(z.enum(['medicare', 'aca', 'iul', 'final_expense', 'life', 'mortgage', 'general']))
    .min(1, 'Selecciona al menos una especialidad'),
})

// ─── EXPORTED TYPES (inferred from schemas) ───────────────────────────────────

export type LoginFormData = z.infer<typeof loginSchema>
export type RegisterFormData = z.infer<typeof registerSchema>
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>
export type UpdatePasswordFormData = z.infer<typeof updatePasswordSchema>
export type OnboardingStep1Data = z.infer<typeof onboardingStep1Schema>
export type OnboardingStep2Data = z.infer<typeof onboardingStep2Schema>
export type OnboardingStep3Data = z.infer<typeof onboardingStep3Schema>
export type ContentGenerationData = z.infer<typeof contentGenerationSchema>
export type ObjectionData = z.infer<typeof objectionSchema>
export type BrandKitData = z.infer<typeof brandKitSchema>
export type UpdateProfileData = z.infer<typeof updateProfileSchema>
