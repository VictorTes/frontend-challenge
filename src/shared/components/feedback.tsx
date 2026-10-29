import { AlertTriangle, Loader2, SearchX } from 'lucide-react'
import type { ReactNode } from 'react'
import { ApiError } from '@/shared/api/errors'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'

export function ErrorState({
  error,
  onRetry,
  title = 'Não foi possível carregar',
  className,
}: {
  error: unknown
  onRetry?: () => void
  title?: string
  className?: string
}) {
  const apiError = ApiError.from(error)
  return (
    <div
      role="alert"
      className={cn('flex flex-col items-center gap-3 rounded-lg bg-card px-6 py-10 text-center', className)}
    >
      <AlertTriangle aria-hidden className="size-8 text-destructive" />
      <p className="text-lg font-bold">{title}</p>
      <p className="max-w-md text-sm text-muted-foreground">{apiError.message}</p>
      {onRetry && (
        <Button onClick={onRetry} className="mt-2">
          Tentar novamente
        </Button>
      )}
    </div>
  )
}

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string
  description?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center gap-3 rounded-lg bg-card px-6 py-10 text-center', className)}>
      <SearchX aria-hidden className="size-8 text-highlight" />
      <p className="text-lg font-bold">{title}</p>
      {description && <p className="max-w-md text-sm text-muted-foreground">{description}</p>}
      {action}
    </div>
  )
}

export function Spinner({ label, className }: { label: string; className?: string }) {
  return (
    <span role="status" className={cn('inline-flex items-center gap-2 text-sm text-muted-foreground', className)}>
      <Loader2 aria-hidden className="size-4 animate-spin" />
      {label}
    </span>
  )
}
