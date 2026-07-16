'use client'

import { useState } from 'react'
import Link from 'next/link'
import { RegisterForm } from './register-form'

/**
 * RegisterPage handles the two states of the registration flow:
 *   1. The form (pre-submission)
 *   2. The verification prompt (post-submission, pre-email click)
 *
 * This component lives in components/auth/ and is a thin orchestrator —
 * business logic stays in the Server Action, UI state stays here.
 */
export function RegisterPage() {
  const [emailSent, setEmailSent] = useState(false)

  if (emailSent) {
    return (
      <div className="animate-fade-in">
        <div className="w-14 h-14 rounded-2xl bg-brand-navy-50 flex items-center justify-center mb-6">
          <svg
            className="h-7 w-7 text-brand-navy-500"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">¡Cuenta creada!</h1>
        <p className="text-gray-500 text-sm mb-6 leading-relaxed">
          Te enviamos un email de verificación. Haz clic en el enlace del email para activar tu
          cuenta y comenzar a usar Autoridad Seguros AI™.
        </p>

        <div className="bg-brand-navy-50 rounded-xl p-4 mb-6 space-y-2">
          <p className="text-sm font-medium text-brand-navy-600">Próximos pasos:</p>
          <ol className="text-sm text-brand-navy-500 space-y-1">
            <li className="flex items-start gap-2">
              <span className="font-bold shrink-0">1.</span>
              <span>Abre tu email y busca un mensaje de Autoridad Seguros AI™</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold shrink-0">2.</span>
              <span>Haz clic en &ldquo;Verificar mi email&rdquo;</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold shrink-0">3.</span>
              <span>Completa tu perfil en 3 pasos rápidos</span>
            </li>
          </ol>
        </div>

        <p className="text-xs text-gray-400 text-center">
          ¿No recibiste el email?{' '}
          <button
            onClick={() => setEmailSent(false)}
            className="text-brand-sky-500 hover:underline"
          >
            Volver a intentarlo
          </button>
          {' '}o revisa tu carpeta de spam.
        </p>

        <div className="mt-6 text-center">
          <Link
            href="/login"
            className="text-sm font-medium text-brand-navy-500 hover:text-brand-sky-500 transition-colors"
          >
            Ya verifiqué mi email → Iniciar sesión
          </Link>
        </div>
      </div>
    )
  }

  return <RegisterForm onSuccess={() => setEmailSent(true)} />
}
