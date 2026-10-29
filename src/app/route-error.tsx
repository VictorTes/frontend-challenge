import { useRouter, type ErrorComponentProps } from '@tanstack/react-router'
import { ApiError } from '@/shared/api/errors'
import { ErrorState } from '@/shared/components/feedback'

/**
 * Fallback for unexpected render/loader errors in any route, in the app's own
 * language and style (instead of the router's default English panel), with a
 * retry that re-runs the route. Stale chunks after a redeploy are already
 * reloaded by the router's lazyRouteComponent.
 */
export function RouteError({ error, reset }: ErrorComponentProps) {
  const router = useRouter()
  return (
    <div className="container-page py-10">
      <ErrorState
        // API errors carry user-facing messages; anything else (a bug) gets a
        // friendly line instead of a technical one.
        error={error instanceof ApiError ? error : new Error('Ocorreu um erro inesperado ao exibir esta página.')}
        title="Algo deu errado nesta página"
        onRetry={() => {
          reset()
          void router.invalidate()
        }}
      />
    </div>
  )
}
