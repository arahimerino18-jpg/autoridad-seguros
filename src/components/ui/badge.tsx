import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

// ─── Badge ────────────────────────────────────────────────────────────────────

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full font-medium transition-colors',
  {
    variants: {
      variant: {
        default:   'bg-gray-100 text-gray-700',
        primary:   'bg-brand-navy-50 text-brand-navy-600',
        gold:      'bg-brand-gold-50 text-brand-gold-500',
        success:   'bg-emerald-50 text-emerald-700',
        warning:   'bg-amber-50 text-amber-700',
        danger:    'bg-red-50 text-red-700',
        sky:       'bg-brand-sky-50 text-brand-sky-500',
        outline:   'border border-gray-300 text-gray-700 bg-transparent',
        new:       'bg-gradient-to-r from-brand-navy-500 to-brand-sky-400 text-white',
      },
      size: {
        sm: 'text-2xs px-1.5 py-0.5',
        md: 'text-xs px-2 py-0.5',
        lg: 'text-sm px-2.5 py-1',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean
}

function Badge({ className, variant, size, dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant, size }), className)} {...props}>
      {dot && (
        <span
          className={cn(
            'w-1.5 h-1.5 rounded-full',
            variant === 'success' && 'bg-emerald-500',
            variant === 'warning' && 'bg-amber-500',
            variant === 'danger' && 'bg-red-500',
            variant === 'primary' && 'bg-brand-navy-500',
            (!variant || variant === 'default') && 'bg-gray-500',
          )}
        />
      )}
      {children}
    </span>
  )
}

// ─── Compliance Badge ─────────────────────────────────────────────────────────

interface ComplianceBadgeProps {
  nivel: 'verde' | 'amarillo' | 'rojo'
  className?: string
  showLabel?: boolean
}

function ComplianceBadge({ nivel, className, showLabel = true }: ComplianceBadgeProps) {
  const config = {
    verde:    { emoji: '🟢', label: 'Compliance OK',    variant: 'success' as const },
    amarillo: { emoji: '🟡', label: 'Revisar',          variant: 'warning' as const },
    rojo:     { emoji: '🔴', label: 'Requiere cambios', variant: 'danger' as const },
  }

  const { emoji, label, variant } = config[nivel]

  return (
    <Badge variant={variant} className={className}>
      <span role="img" aria-label={label}>
        {emoji}
      </span>
      {showLabel && <span>{label}</span>}
    </Badge>
  )
}

// ─── Plan Badge ───────────────────────────────────────────────────────────────

interface PlanBadgeProps {
  plan: 'starter' | 'pro' | 'elite'
  className?: string
}

function PlanBadge({ plan, className }: PlanBadgeProps) {
  const config = {
    starter: { label: 'Starter', variant: 'default' as const },
    pro:     { label: 'Pro',     variant: 'primary' as const },
    elite:   { label: 'Elite',   variant: 'gold' as const },
  }

  const { label, variant } = config[plan]
  return (
    <Badge variant={variant} className={className}>
      {label}
    </Badge>
  )
}

// ─── Usage Progress ───────────────────────────────────────────────────────────

interface UsageProgressProps {
  used: number
  max: number
  label?: string
  showNumbers?: boolean
  className?: string
}

function UsageProgress({ used, max, label, showNumbers = true, className }: UsageProgressProps) {
  const isUnlimited = max === -1
  const percentage = isUnlimited ? 0 : Math.min(100, Math.round((used / max) * 100))

  const barColor =
    percentage < 60
      ? 'bg-emerald-500'
      : percentage < 80
        ? 'bg-amber-500'
        : 'bg-red-500'

  const textColor =
    percentage < 60
      ? 'text-emerald-600'
      : percentage < 80
        ? 'text-amber-600'
        : 'text-red-600'

  return (
    <div className={cn('w-full', className)}>
      {(label || showNumbers) && (
        <div className="flex justify-between items-center mb-1">
          {label && <span className="text-xs text-gray-500">{label}</span>}
          {showNumbers && (
            <span className={cn('text-xs font-medium', textColor)}>
              {isUnlimited ? (
                <span className="text-emerald-600">{used} / ∞</span>
              ) : (
                `${used} / ${max}`
              )}
            </span>
          )}
        </div>
      )}
      {!isUnlimited && (
        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-300', barColor)}
            style={{ width: `${percentage}%` }}
            role="progressbar"
            aria-valuenow={used}
            aria-valuemin={0}
            aria-valuemax={max}
          />
        </div>
      )}
    </div>
  )
}

export { Badge, badgeVariants, ComplianceBadge, PlanBadge, UsageProgress }
