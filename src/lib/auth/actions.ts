'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  updatePasswordSchema,
  type LoginFormData,
  type RegisterFormData,
  type ResetPasswordFormData,
  type UpdatePasswordFormData,
} from '@/lib/validations'
import type { ActionResult } from '@/types'

export async function loginAction(data: LoginFormData): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })

  if (error) {
    return { success: false, error: mapAuthError(error.code ?? error.message) }
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('onboarding_done')
      .eq('id', user.id)
      .single()

    const p = profile as { onboarding_done?: boolean } | null
    if (p && !p.onboarding_done) redirect('/onboarding')
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

export async function registerAction(data: RegisterFormData): Promise<ActionResult> {
  const parsed = registerSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { nombre_completo: parsed.data.nombre_completo },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/verify`,
    },
  })

  if (error) {
    return { success: false, error: mapAuthError(error.code ?? error.message) }
  }

  return { success: true, data: undefined }
}

export async function logoutAction(): Promise<never> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}

export async function resetPasswordAction(data: ResetPasswordFormData): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Email inválido' }
  }

  const supabase = await createClient()
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password/confirm`,
  })

  // Always success — prevents email enumeration
  return { success: true, data: undefined }
}

export async function updatePasswordAction(data: UpdatePasswordFormData): Promise<ActionResult> {
  const parsed = updatePasswordSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })

  if (error) {
    return { success: false, error: mapAuthError(error.code ?? error.message) }
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

function mapAuthError(codeOrMessage: string): string {
  const map: Record<string, string> = {
    invalid_credentials: 'El email o la contraseña son incorrectos.',
    email_not_confirmed: 'Debes verificar tu email antes de iniciar sesión.',
    user_not_found: 'El email o la contraseña son incorrectos.',
    wrong_password: 'El email o la contraseña son incorrectos.',
    user_already_exists: 'Ya existe una cuenta con ese email. ¿Quieres iniciar sesión?',
    email_address_invalid: 'El email ingresado no es válido.',
    weak_password: 'La contraseña es muy débil. Mínimo 8 caracteres, una mayúscula y un número.',
    over_email_send_rate_limit: 'Demasiados emails enviados. Espera unos minutos.',
    too_many_requests: 'Demasiados intentos. Espera unos minutos.',
    invalid_grant: 'El enlace de recuperación expiró. Solicita uno nuevo.',
    refresh_token_not_found: 'Tu sesión expiró. Por favor inicia sesión de nuevo.',
  }
  if (map[codeOrMessage]) return map[codeOrMessage]
  for (const [key, value] of Object.entries(map)) {
    if (codeOrMessage.toLowerCase().includes(key)) return value
  }
  return 'Ocurrió un error inesperado. Por favor intenta de nuevo.'
}
