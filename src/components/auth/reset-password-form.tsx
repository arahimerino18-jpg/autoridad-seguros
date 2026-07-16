'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Link from 'next/link'
import { resetPasswordSchema, type ResetPasswordFormData } from '@/lib/validations'
import { resetPasswordAction } from '@/lib/auth/actions'
import { Button, Input, Alert } from '@/components/ui'

export function ResetPasswordForm() {
  const [submitted, setSubmitted] = useState(false)
  const [submittedEmail, setSubmittedEmail] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
  })

  const onSubmit = async (data: ResetPasswordFormData) => {
    // Always succeeds — prevents email enumeration
    await resetPasswordAction(data)
    setSubmittedEmail(data.email)
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="animate-fade-in">
        <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mb-6">
          <svg
            className="h-7 w-7 text-emerald-600"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Revisa tu email</h1>
        <p className="text-gray-500 text-sm mb-6">
          Si existe una cuenta con{' '}
          <span className="font-medium text-gray-700">{submittedEmail}</span>, recibirás un
          enlace para restablecer tu contraseña en los próximos minutos.
        </p>
        <Alert variant="info">
          Revisa también tu carpeta de spam si no lo ves en tu bandeja principal.
        </Alert>
        <div className="mt-6">
          <Link
            href="/login"
            className="text-sm font-medium text-brand-navy-500 hover:text-brand-sky-500 transition-colors"
          >
            ← Volver al inicio de sesión
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Recuperar contraseña</h1>
        <p className="text-gray-500 text-sm mt-1">
          Te enviamos un enlace para crear una nueva contraseña.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <Input
          label="Email de tu cuenta"
          type="email"
          placeholder="tu@email.com"
          autoComplete="email"
          required
          error={errors.email?.message}
          leftIcon={
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M3 4a2 2 0 00-2 2v1.161l8.441 4.221a1.25 1.25 0 001.118 0L19 7.162V6a2 2 0 00-2-2H3z" />
              <path d="M19 8.839l-7.77 3.885a2.75 2.75 0 01-2.46 0L1 8.839V14a2 2 0 002 2h14a2 2 0 002-2V8.839z" />
            </svg>
          }
          {...register('email')}
        />

        <Button
          type="submit"
          className="w-full"
          size="lg"
          isLoading={isSubmitting}
          loadingText="Enviando enlace..."
        >
          Enviar enlace de recuperación
        </Button>
      </form>

      <p className="text-center text-sm text-gray-500 mt-6">
        <Link
          href="/login"
          className="font-medium text-brand-navy-500 hover:text-brand-sky-500 transition-colors"
        >
          ← Volver al inicio de sesión
        </Link>
      </p>
    </div>
  )
}
