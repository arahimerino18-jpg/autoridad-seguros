'use client'

import { useState, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Link from 'next/link'
import { registerSchema, type RegisterFormData } from '@/lib/validations'
import { registerAction } from '@/lib/auth/actions'
import { Button, Input, Alert } from '@/components/ui'
import { cn } from '@/lib/utils'

// ─── Password strength calculator ────────────────────────────────────────────

function getPasswordStrength(password: string): {
  score: number
  label: string
  color: string
} {
  if (!password) return { score: 0, label: '', color: '' }

  let score = 0
  if (password.length >= 8) score++
  if (password.length >= 12) score++
  if (/[A-Z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++

  if (score <= 1) return { score, label: 'Muy débil', color: 'bg-red-500' }
  if (score === 2) return { score, label: 'Débil', color: 'bg-orange-500' }
  if (score === 3) return { score, label: 'Moderada', color: 'bg-yellow-500' }
  if (score === 4) return { score, label: 'Fuerte', color: 'bg-emerald-500' }
  return { score, label: 'Muy fuerte', color: 'bg-emerald-600' }
}

// ─── Component ────────────────────────────────────────────────────────────────

interface RegisterFormProps {
  onSuccess: () => void
}

export function RegisterForm({ onSuccess }: RegisterFormProps) {
  const [serverError, setServerError] = useState<string | null>(null)
  const [passwordValue, setPasswordValue] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  })

  const passwordStrength = useMemo(
    () => getPasswordStrength(passwordValue),
    [passwordValue]
  )

  const onSubmit = async (data: RegisterFormData) => {
    setServerError(null)
    const result = await registerAction(data)

    if (result.success) {
      onSuccess()
    } else {
      setServerError(result.error)
    }
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Crea tu cuenta</h1>
        <p className="text-gray-500 text-sm mt-1">
          Empieza a generar contenido profesional hoy — $27/mes
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {serverError && (
          <Alert variant="danger" className="animate-fade-in">
            {serverError}
          </Alert>
        )}

        <Input
          label="Nombre completo"
          type="text"
          placeholder="Arahi Merino"
          autoComplete="name"
          required
          error={errors.nombre_completo?.message}
          leftIcon={
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 8a3 3 0 100-6 3 3 0 000 6zM3.465 14.493a1.23 1.23 0 00.41 1.412A9.957 9.957 0 0010 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 00-13.074.003z" />
            </svg>
          }
          {...register('nombre_completo')}
        />

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

        <div className="space-y-1.5">
          <Input
            label="Contraseña"
            type="password"
            placeholder="Mínimo 8 caracteres"
            autoComplete="new-password"
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
            {...register('password', {
              onChange: (e) => setPasswordValue(e.target.value),
            })}
          />

          {/* Password strength indicator */}
          {passwordValue && (
            <div className="space-y-1 animate-fade-in">
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className={cn(
                      'h-1 flex-1 rounded-full transition-all duration-300',
                      i <= passwordStrength.score
                        ? passwordStrength.color
                        : 'bg-gray-200'
                    )}
                  />
                ))}
              </div>
              {passwordStrength.label && (
                <p className="text-xs text-gray-500">
                  Seguridad:{' '}
                  <span
                    className={cn(
                      'font-medium',
                      passwordStrength.score <= 2 ? 'text-red-500' : '',
                      passwordStrength.score === 3 ? 'text-yellow-600' : '',
                      passwordStrength.score >= 4 ? 'text-emerald-600' : ''
                    )}
                  >
                    {passwordStrength.label}
                  </span>
                </p>
              )}
            </div>
          )}
        </div>

        <Input
          label="Confirmar contraseña"
          type="password"
          placeholder="Repite tu contraseña"
          autoComplete="new-password"
          required
          error={errors.confirmPassword?.message}
          leftIcon={
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z"
                clipRule="evenodd"
              />
            </svg>
          }
          {...register('confirmPassword')}
        />

        <p className="text-xs text-gray-400 leading-relaxed">
          Al registrarte aceptas nuestros{' '}
          <Link href="/terms" className="text-brand-sky-500 hover:underline">
            Términos de Servicio
          </Link>{' '}
          y{' '}
          <Link href="/privacy" className="text-brand-sky-500 hover:underline">
            Política de Privacidad
          </Link>
          .
        </p>

        <Button
          type="submit"
          className="w-full"
          size="lg"
          isLoading={isSubmitting}
          loadingText="Creando cuenta..."
        >
          Crear cuenta gratis
        </Button>
      </form>

      <p className="text-center text-sm text-gray-500 mt-6">
        ¿Ya tienes cuenta?{' '}
        <Link
          href="/login"
          className="font-medium text-brand-navy-500 hover:text-brand-sky-500 transition-colors"
        >
          Iniciar sesión
        </Link>
      </p>
    </div>
  )
}
