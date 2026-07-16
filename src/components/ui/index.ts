/**
 * UI Component Library — Autoridad Seguros AI™
 * Single import point for all base UI components.
 *
 * Usage: import { Button, Input, Card } from '@/components/ui'
 */

export { Button, buttonVariants } from './button'
export type { ButtonProps } from './button'

export { Input, Textarea } from './input'
export type { InputProps, TextareaProps } from './input'

export { Select, Checkbox, RadioGroup } from './form-elements'
export type { SelectProps, CheckboxProps, RadioGroupProps, RadioOption } from './form-elements'

export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  StatCard,
} from './card'

export {
  Badge,
  badgeVariants,
  ComplianceBadge,
  PlanBadge,
  UsageProgress,
} from './badge'
export type { BadgeProps } from './badge'

export {
  Skeleton,
  CardSkeleton,
  ContentCardSkeleton,
  TableRowSkeleton,
  PageSkeleton,
} from './skeleton'

export { Alert, Toast, ToastContainer } from './alert'

export { Avatar } from './avatar'

export {
  Divider,
  Spinner,
  EmptyState,
  LoadingPage,
  ErrorState,
} from './misc'
