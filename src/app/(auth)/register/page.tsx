import type { Metadata } from 'next'
import { RegisterPage } from '@/components/auth/register-page'

export const metadata: Metadata = {
  title: 'Crear cuenta',
}

export default function Page() {
  return <RegisterPage />
}
