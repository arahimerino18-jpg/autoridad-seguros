'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

// ─── Select ───────────────────────────────────────────────────────────────────

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  helperText?: string
  placeholder?: string
  options: { value: string; label: string; disabled?: boolean }[]
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, helperText, placeholder, options, id, required, ...props }, ref) => {
    const selectId = id ?? React.useId()

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={selectId}
            className={cn(
              'block text-sm font-medium mb-1.5',
              error ? 'text-danger' : 'text-gray-700'
            )}
          >
            {label}
            {required && <span className="text-danger ml-0.5">*</span>}
          </label>
        )}

        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            required={required}
            aria-invalid={!!error}
            className={cn(
              'w-full h-10 pl-3 pr-10 rounded-lg border bg-white text-sm text-gray-900',
              'transition-colors duration-150 appearance-none cursor-pointer',
              'focus:outline-none focus:ring-2 focus:ring-brand-navy-500 focus:border-brand-navy-500',
              !error && 'border-gray-300 hover:border-gray-400',
              error && 'border-danger focus:ring-danger',
              props.disabled && 'bg-gray-50 text-gray-400 cursor-not-allowed',
              className
            )}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((option) => (
              <option key={option.value} value={option.value} disabled={option.disabled}>
                {option.label}
              </option>
            ))}
          </select>

          {/* Chevron icon */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        </div>

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

Select.displayName = 'Select'

// ─── Checkbox ─────────────────────────────────────────────────────────────────

export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string
  description?: string
  error?: string
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, description, error, id, ...props }, ref) => {
    const checkboxId = id ?? React.useId()

    return (
      <div className={cn('flex gap-3', className)}>
        <div className="flex h-5 items-center">
          <input
            ref={ref}
            id={checkboxId}
            type="checkbox"
            aria-invalid={!!error}
            className={cn(
              'h-4 w-4 rounded border-gray-300 bg-white',
              'text-brand-navy-500',
              'focus:ring-2 focus:ring-brand-navy-500 focus:ring-offset-0',
              'transition-colors duration-150 cursor-pointer',
              error && 'border-danger'
            )}
            {...props}
          />
        </div>
        <div className="flex-1 min-w-0">
          <label
            htmlFor={checkboxId}
            className="block text-sm font-medium text-gray-700 cursor-pointer"
          >
            {label}
          </label>
          {description && (
            <p className="text-xs text-gray-500 mt-0.5">{description}</p>
          )}
          {error && (
            <p role="alert" className="text-xs text-danger mt-0.5">
              {error}
            </p>
          )}
        </div>
      </div>
    )
  }
)

Checkbox.displayName = 'Checkbox'

// ─── Radio Group ──────────────────────────────────────────────────────────────

export interface RadioOption {
  value: string
  label: string
  description?: string
  disabled?: boolean
}

export interface RadioGroupProps {
  name: string
  label?: string
  options: RadioOption[]
  value?: string
  onChange?: (value: string) => void
  error?: string
  orientation?: 'horizontal' | 'vertical'
  className?: string
}

function RadioGroup({
  name,
  label,
  options,
  value,
  onChange,
  error,
  orientation = 'vertical',
  className,
}: RadioGroupProps) {
  return (
    <fieldset className={cn('w-full', className)}>
      {label && (
        <legend className="block text-sm font-medium text-gray-700 mb-2">{label}</legend>
      )}
      <div
        className={cn(
          'gap-2',
          orientation === 'vertical' ? 'flex flex-col' : 'flex flex-wrap'
        )}
      >
        {options.map((option) => {
          const inputId = `${name}-${option.value}`
          return (
            <label
              key={option.value}
              htmlFor={inputId}
              className={cn(
                'flex items-start gap-3 p-3 rounded-lg border cursor-pointer',
                'transition-colors duration-150',
                value === option.value
                  ? 'border-brand-navy-400 bg-brand-navy-50'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50',
                option.disabled && 'opacity-50 cursor-not-allowed',
              )}
            >
              <input
                id={inputId}
                type="radio"
                name={name}
                value={option.value}
                checked={value === option.value}
                disabled={option.disabled}
                onChange={() => onChange?.(option.value)}
                className="mt-0.5 h-4 w-4 text-brand-navy-500 border-gray-300 focus:ring-brand-navy-500"
              />
              <div>
                <span className="block text-sm font-medium text-gray-700">
                  {option.label}
                </span>
                {option.description && (
                  <span className="block text-xs text-gray-500 mt-0.5">
                    {option.description}
                  </span>
                )}
              </div>
            </label>
          )
        })}
      </div>
      {error && (
        <p role="alert" className="mt-1.5 text-xs text-danger">
          {error}
        </p>
      )}
    </fieldset>
  )
}

export { Select, Checkbox, RadioGroup }
