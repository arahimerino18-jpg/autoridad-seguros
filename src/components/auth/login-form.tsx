'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Link from 'next/link'
import { loginSchema, type LoginFormData } from '@/lib/validations'
import { loginAction } from '@/lib/auth/actions'
import { Button, Input, Alert } from '@/components/ui'

export function LoginForm() {
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginFormData) => {
    setServerError(null)
    const result = await loginAction(data)
    // loginAction redirects on success — if we're here, it failed
    if (!result.success) {
      setServerError(result.error)
    }
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Bienvenida de nuevo</h1>
        <p className="text-gray-500 text-sm mt-1">Ingresa a tu cuenta de Autoridad Seguros AI™</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {serverError && (
          <Alert variant="danger" className="animate-fade-in">
            {serverError}
          </Alert>
        )}

        <Input
          label="Email"
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

        <div>
          <Input
            label="Contraseña"
            type="password"
            placeholder="Tu contraseña"
            autoComplete="current-password"
            required
            error={errors.password?.message}
            leftIcon={
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z"
                  clipRule="evenodd"
                />
              </svg>
            }
            {...register('password')}
          />
          <div className="flex justify-end mt-1.5">
            <Link
              href="/reset-password"
              className="text-xs text-brand-sky-500 hover:text-brand-navy-500 transition-colors"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
        </div>

        <Button
          type="submit"
          className="w-full"
          size="lg"
          isLoading={isSubmitting}
          loadingText="Ingresando..."
        >
          Iniciar sesión
        </Button>
      </form>

      <p className="text-center text-sm text-gray-500 mt-6">
        ¿No tienes cuenta?{' '}
        <Link
          href="/register"
          className="font-medium text-brand-navy-500 hover:text-brand-sky-500 transition-colors"
        >
          Crear cuenta gratis
        </Link>
      </p>
    </div>
  )
}
