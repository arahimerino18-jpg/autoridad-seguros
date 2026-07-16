import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Verificando tu cuenta' }

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; type?: string; error?: string; error_description?: string }>
}) {
  const params = await searchParams

  if (params.error) {
    return (
      <div className="animate-fade-in">
        <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mb-6">
          <svg className="h-7 w-7 text-red-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Enlace inválido</h1>
        <p className="text-gray-500 text-sm mb-4">
          {params.error_description?.includes('expired')
            ? 'El enlace de verificación ha expirado. Los enlaces son válidos por 24 horas.'
            : 'El enlace no es válido. Puede que ya lo hayas usado.'}
        </p>
        <a href="/register" className="text-sm font-medium text-brand-navy-500 hover:underline">
          Crear una nueva cuenta
        </a>
      </div>
    )
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('onboarding_done')
      .eq('id', user.id)
      .single()

    const done = profile ? (profile as { onboarding_done?: boolean }).onboarding_done : false
    redirect(done ? '/dashboard' : '/onboarding')
  }

  return (
    <div className="animate-fade-in">
      <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mb-6">
        <svg className="h-7 w-7 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">¡Email verificado!</h1>
      <p className="text-gray-500 text-sm mb-6">Tu cuenta está activa. Inicia sesión para continuar.</p>
      <a href="/login" className="inline-flex items-center justify-center w-full h-11 px-5 rounded-lg bg-brand-navy-500 text-white font-medium hover:bg-brand-navy-600 transition-colors">
        Iniciar sesión
      </a>
    </div>
  )
}
