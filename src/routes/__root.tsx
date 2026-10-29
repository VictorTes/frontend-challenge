import type { QueryClient } from '@tanstack/react-query'
import {
  createRootRouteWithContext,
  Outlet,
  useRouter,
  useRouterState,
} from '@tanstack/react-router'
import { lazy, Suspense, useEffect } from 'react'
import { toast } from 'sonner'
import { useSessionRevalidation } from '@/features/auth/hooks'
import { PendingCartReplay } from '@/features/cart/components/pending-replay'
import { Footer } from '@/app/layout/footer'
import { Header } from '@/app/layout/header'
import { MobileNav } from '@/app/layout/mobile-nav'
import { sessionStore } from '@/shared/session/session-store'
import { Toaster } from '@/shared/ui/sonner'

const MockPanel =
  import.meta.env.VITE_ENABLE_MOCKS === 'true' ? lazy(() => import('@/app/mock-panel')) : null

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootLayout,
})

const PRIVATE_PREFIXES = ['/checkout', '/orders', '/account']

/**
 * When the session expires mid-navigation, private screens send the user to
 * login with a redirect back to where they were (checkout keeps its draft).
 */
function SessionWatcher() {
  const router = useRouter()
  useSessionRevalidation()
  useEffect(
    () =>
      sessionStore.onEnd((_previous, reason) => {
        if (reason !== 'expired') return
        const { pathname, searchStr } = router.state.location
        toast.warning('Sua sessão expirou. Entre novamente para continuar.', {
          id: 'session-expired',
        })
        if (PRIVATE_PREFIXES.some((p) => pathname.startsWith(p))) {
          void router.navigate({
            to: '/login',
            search: { redirect: `${pathname}${searchStr}`, reason: 'expired' },
          })
        }
      }),
    [router],
  )
  return null
}

/**
 * Soft fade between pages. Keyed by pathname, so moving between two NFTs also
 * resets per-page state (edition, quantity, gallery); search-param changes such
 * as catalog filters keep the page mounted.
 */
function RouteTransition() {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  return (
    <div key={pathname} className="animate-in duration-300 fade-in-0">
      <Outlet />
    </div>
  )
}

function RootLayout() {
  return (
    <>
      <a
        href="#conteudo"
        className="sr-only z-50 rounded bg-primary px-4 py-2 font-bold text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Pular para o conteúdo
      </a>
      <SessionWatcher />
      <PendingCartReplay />
      <Header />
      {/* Min height keeps the footer below the fold while content loads (CLS). */}
      <main id="conteudo" tabIndex={-1} className="min-h-dvh outline-none">
        <RouteTransition />
      </main>
      <Footer />
      <MobileNav />
      <Toaster />
      {MockPanel && (
        <Suspense fallback={null}>
          <MockPanel />
        </Suspense>
      )}
    </>
  )
}
