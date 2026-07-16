'use client'

import { useState, useCallback } from 'react'

interface ToastMessage {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  description?: string
}

interface UseToastReturn {
  toasts: ToastMessage[]
  toast: {
    success: (title: string, description?: string) => void
    error: (title: string, description?: string) => void
    warning: (title: string, description?: string) => void
    info: (title: string, description?: string) => void
  }
  dismiss: (id: string) => void
  dismissAll: () => void
}

export function useToast(): UseToastReturn {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const addToast = useCallback(
    (type: ToastMessage['type'], title: string, description?: string) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`
      setToasts((prev) => [...prev.slice(-4), { id, type, title, description }])
    },
    []
  )

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const dismissAll = useCallback(() => setToasts([]), [])

  return {
    toasts,
    toast: {
      success: (title, desc) => addToast('success', title, desc),
      error: (title, desc) => addToast('error', title, desc),
      warning: (title, desc) => addToast('warning', title, desc),
      info: (title, desc) => addToast('info', title, desc),
    },
    dismiss,
    dismissAll,
  }
}
