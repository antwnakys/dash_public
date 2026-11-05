import type { ReactNode } from 'react'

/** Empty content: one sentence of direction and the action that fixes it. */
export function EmptyState({ message, children }: { message: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-9 text-center">
      <p className="max-w-xs text-body text-muted">{message}</p>
      {children && <div className="flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  )
}
