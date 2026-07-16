'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

// ─── Input ────────────────────────────────────────────────────────────────────

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  isLoading?: boolean
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      isLoading,
      id,
      required,
      disabled,
      type = 'text',
      ...props
    },
    ref
  ) => {
    const inputId = id ?? React.useId()
    const errorId = `${inputId}-error`
    const helperId = `${inputId}-helper`

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className={cn(
              'block text-sm font-medium mb-1.5',
              error ? 'text-danger' : 'text-gray-700'
            )}
          >
            {label}
            {required && (
              <span className="text-danger ml-0.5" aria-hidden="true">
                *
              </span>
            )}
          </label>
        )}

        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
              {leftIcon}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            type={type}
            disabled={disabled || isLoading}
            required={required}
            aria-invalid={!!error}
            aria-describedby={
              [error && errorId, helperText && helperId]
                .filter(Boolean)
                .join(' ') || undefined
            }
            className={cn(
              // Base
              'w-full h-10 rounded-lg border bg-white text-sm text-gray-900',
              'transition-colors duration-150',
              'placeholder:text-gray-400',
              // Focus
              'focus:outline-none focus:ring-2 focus:ring-brand-navy-500 focus:ring-offset-0',
              'focus:border-brand-navy-500',
              // Normal state
              !error && 'border-gray-300 hover:border-gray-400',
              // Error state
              error && 'border-danger focus:ring-danger focus:border-danger',
              // Disabled state
              (disabled || isLoading) && 'bg-gray-50 text-gray-400 cursor-not-allowed',
              // Icon padding
              leftIcon ? 'pl-10' : 'pl-3',
              rightIcon ? 'pr-10' : 'pr-3',
              className
            )}
            {...props}
          />

          {(rightIcon || isLoading) && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
              {isLoading ? (
                <svg
                  className="animate-spin h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
              ) : (
                rightIcon
              )}
            </div>
          )}
        </div>

        {error && (
          <p id={errorId} role="alert" className="mt-1.5 text-xs text-danger flex items-center gap-1">
            <svg
              className="h-3 w-3 shrink-0"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            {error}
          </p>
        )}

        {helperText && !error && (
          <p id={helperId} className="mt-1.5 text-xs text-gray-500">
            {helperText}
          </p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'

// ─── Textarea ─────────────────────────────────────────────────────────────────

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  helperText?: string
  characterCount?: boolean
  maxLength?: number
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, helperText, characterCount, maxLength, id, required, ...props }, ref) => {
    const textareaId = id ?? React.useId()
    const currentLength = String(props.value ?? '').length

    return (
      <div className="w-full">
        {label && (
          <div className="flex justify-between items-baseline mb-1.5">
            <label
              htmlFor={textareaId}
              className={cn('block text-sm font-medium', error ? 'text-danger' : 'text-gray-700')}
            >
              {label}
              {required && <span className="text-danger ml-0.5">*</span>}
            </label>
            {characterCount && maxLength && (
              <span
                className={cn(
                  'text-xs',
                  currentLength > maxLength * 0.9 ? 'text-warning' : 'text-gray-400'
                )}
              >
                {currentLength}/{maxLength}
              </span>
            )}
          </div>
        )}

        <textarea
          ref={ref}
          id={textareaId}
          maxLength={maxLength}
          required={required}
          aria-invalid={!!error}
          className={cn(
            'w-full rounded-lg border bg-white text-sm text-gray-900 resize-none',
            'transition-colors duration-150 placeholder:text-gray-400 px-3 py-2.5',
            'focus:outline-none focus:ring-2 focus:ring-brand-navy-500 focus:border-brand-navy-500',
            !error && 'border-gray-300 hover:border-gray-400',
            error && 'border-danger focus:ring-danger focus:border-danger',
            className
          )}
          {...props}
        />

        {error && (
          <p role="alert" className="mt-1.5 text-xs text-danger">
            {error}
          </p>
        )}
        {helperText && !error && (
          <p className="mt-1.5 text-xs text-gray-500">{helperText}</p>
        )}
      </div>
    )
  }
)

Textarea.displayName = 'Textarea'

export { Input, Textarea }
