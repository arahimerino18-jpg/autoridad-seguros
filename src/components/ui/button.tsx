'use client'

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

// ─── Variant definitions ──────────────────────────────────────────────────────

const buttonVariants = cva(
  // Base classes — apply to every button
  [
    'inline-flex items-center justify-center gap-2',
    'font-medium rounded-lg',
    'transition-all duration-150',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1B2E6B] focus-visible:ring-offset-2',
    'disabled:pointer-events-none disabled:opacity-50',
    'select-none',
  ],
  {
    variants: {
      variant: {
        primary: [
          'bg-[#1B2E6B] text-white',
          'hover:bg-[#16255A] active:bg-[#111C42]',
          'shadow-brand hover:shadow-brand-lg',
        ],
        secondary: [
          'bg-white text-[#1B2E6B]',
          'border border-[#94A7D4]',
          'hover:bg-[#EEF1F8] hover:border-[#6B88C4]',
          'active:bg-[#D5DCF0]',
        ],
        gold: [
          'bg-[#D4A017] text-white',
          'hover:bg-[#B8880F] active:bg-[#9C720D]',
          'shadow-gold',
        ],
        ghost: [
          'bg-transparent text-[#1B2E6B]',
          'hover:bg-[#EEF1F8]',
          'active:bg-[#D5DCF0]',
        ],
        danger: [
          'bg-danger text-white',
          'hover:bg-danger-dark active:opacity-90',
        ],
        'danger-ghost': [
          'bg-transparent text-danger',
          'hover:bg-red-50',
        ],
        link: [
          'bg-transparent text-[#1B2E6B] underline-offset-4',
          'hover:underline',
          'p-0 h-auto',
        ],
      },
      size: {
        xs: 'h-7 px-2.5 text-xs rounded-md',
        sm: 'h-8 px-3 text-sm',
        md: 'h-10 px-4 text-sm',
        lg: 'h-11 px-5 text-base',
        xl: 'h-12 px-6 text-base',
        icon: 'h-10 w-10',
        'icon-sm': 'h-8 w-8',
        'icon-lg': 'h-12 w-12',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
)

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean
  loadingText?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  asChild?: boolean
}

// ─── Component ────────────────────────────────────────────────────────────────

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      isLoading = false,
      loadingText,
      leftIcon,
      rightIcon,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || isLoading}
        aria-busy={isLoading}
        {...props}
      >
        {isLoading ? (
          <>
            <svg
              className="animate-spin h-4 w-4 shrink-0"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
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
            {loadingText ?? children}
          </>
        ) : (
          <>
            {leftIcon && <span className="shrink-0">{leftIcon}</span>}
            {children}
            {rightIcon && <span className="shrink-0">{rightIcon}</span>}
          </>
        )}
      </button>
    )
  }
)

Button.displayName = 'Button'

export { Button, buttonVariants }
