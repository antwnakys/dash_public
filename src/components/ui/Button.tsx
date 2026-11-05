import { motion, type HTMLMotionProps } from 'framer-motion'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'secondary' | 'plain' | 'danger'
type Size = 'sm' | 'md'

const variants: Record<Variant, string> = {
  primary: 'bg-accent-fill text-accent-ink font-semibold hover:brightness-110',
  secondary: 'bg-fill text-ink font-medium hover:bg-fill-strong',
  plain: 'text-accent font-medium hover:bg-fill',
  danger: 'text-danger font-medium hover:bg-danger/10',
}

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-subhead',
  md: 'h-10 px-4 text-body',
}

/** Capsule button. Press feedback starts on pointer-down. */
export function Button({
  variant = 'secondary',
  size = 'md',
  className,
  ...rest
}: { variant?: Variant; size?: Size } & HTMLMotionProps<'button'>) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', bounce: 0, duration: 0.2 }}
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full whitespace-nowrap transition-[background-color,filter] disabled:pointer-events-none disabled:opacity-40',
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    />
  )
}
