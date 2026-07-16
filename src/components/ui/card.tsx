import * as React from 'react'
import { cn } from '@/lib/utils'

// ─── Card ────────────────────────────────────────────────────────────────────

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'bordered' | 'elevated' | 'flat' | 'brand'
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'default', padding = 'md', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'rounded-xl bg-white',
          // Variants
          variant === 'default' && 'shadow-card border border-gray-100',
          variant === 'bordered' && 'border border-gray-200',
          variant === 'elevated' && 'shadow-card-md border border-gray-100',
          variant === 'flat' && 'bg-surface-subtle',
          variant === 'brand' && 'bg-brand-navy-500 text-white border-0',
          // Padding
          padding === 'none' && '',
          padding === 'sm' && 'p-4',
          padding === 'md' && 'p-5',
          padding === 'lg' && 'p-6',
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)

Card.displayName = 'Card'

// ─── Card sub-components ──────────────────────────────────────────────────────

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex flex-col gap-1 pb-4 border-b border-gray-100', className)}
      {...props}
    />
  )
)
CardHeader.displayName = 'CardHeader'

const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn('text-base font-semibold text-gray-900 leading-tight', className)}
      {...props}
    />
  )
)
CardTitle.displayName = 'CardTitle'

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn('text-sm text-gray-500', className)} {...props} />
))
CardDescription.displayName = 'CardDescription'

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('pt-4', className)} {...props} />
  )
)
CardContent.displayName = 'CardContent'

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex items-center pt-4 border-t border-gray-100', className)}
      {...props}
    />
  )
)
CardFooter.displayName = 'CardFooter'

// ─── Stat Card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string
  value: string | number
  delta?: string
  deltaPositive?: boolean
  icon?: React.ReactNode
  className?: string
}

function StatCard({ label, value, delta, deltaPositive, icon, className }: StatCardProps) {
  return (
    <Card className={cn('flex items-start gap-4', className)}>
      {icon && (
        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-brand-navy-50 flex items-center justify-center text-brand-navy-500">
          {icon}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
        <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
        {delta && (
          <p
            className={cn(
              'mt-0.5 text-xs font-medium',
              deltaPositive ? 'text-success' : 'text-danger'
            )}
          >
            {deltaPositive ? '↑' : '↓'} {delta}
          </p>
        )}
      </div>
    </Card>
  )
}

export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  StatCard,
}
