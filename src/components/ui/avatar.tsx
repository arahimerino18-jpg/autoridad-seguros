import Image from 'next/image'
import { cn, getInitials } from '@/lib/utils'

interface AvatarProps {
  src?: string | null
  name?: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  shape?: 'circle' | 'rounded'
}

const sizeConfig = {
  xs: { container: 'h-6 w-6', text: 'text-2xs', image: 24 },
  sm: { container: 'h-8 w-8', text: 'text-xs',  image: 32 },
  md: { container: 'h-10 w-10', text: 'text-sm', image: 40 },
  lg: { container: 'h-12 w-12', text: 'text-base', image: 48 },
  xl: { container: 'h-16 w-16', text: 'text-xl', image: 64 },
}

function Avatar({ src, name = '', size = 'md', className, shape = 'circle' }: AvatarProps) {
  const { container, text, image } = sizeConfig[size]
  const initials = getInitials(name)
  const shapeClass = shape === 'circle' ? 'rounded-full' : 'rounded-lg'

  if (src) {
    return (
      <div className={cn('relative overflow-hidden shrink-0', container, shapeClass, className)}>
        <Image
          src={src}
          alt={name || 'Avatar'}
          width={image}
          height={image}
          className="object-cover"
        />
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex items-center justify-center shrink-0',
        'bg-brand-navy-500 text-white font-semibold select-none',
        container,
        shapeClass,
        text,
        className
      )}
      aria-label={name}
      role="img"
    >
      {initials || '?'}
    </div>
  )
}

export { Avatar }
