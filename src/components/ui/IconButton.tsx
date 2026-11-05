import type { LucideIcon } from 'lucide-react'
import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon
  label: string
  /** `filled` sits on a tinted circle; `plain` only tints on hover. */
  variant?: 'plain' | 'filled'
}

export function IconButton({ icon: Icon, label, variant = 'plain', className, ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'flex size-9 shrink-0 items-center justify-center rounded-full text-muted transition-[background-color,color,transform] duration-150 hover:text-ink active:scale-95',
        variant === 'filled' ? 'bg-fill hover:bg-fill-strong' : 'hover:bg-fill',
        className,
      )}
      {...rest}
    >
      <Icon aria-hidden className="size-[18px]" strokeWidth={2} />
    </button>
  )
}
