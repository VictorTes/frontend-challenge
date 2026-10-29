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
import { isPrivatePath } from '@/app/private-routes'
import { Header } from '@/app/layout/header'
import { MobileNav } from '@/app/layout/mobile-nav'
import { installSharedArtworkTransitions } from '@/shared/lib/motion'
import { sessionStore } from '@/shared/session/session-store'
import { Toaster } from '@/shared/ui/sonner'

const MockPanel =
  import.meta.env.VITE_ENABLE_MOCKS === 'true' ? lazy(() => import('@/app/mock-panel')) : null

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootLayout,
})

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
        if (isPrivatePath(pathname)) {
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
 * Keyed by pathname, so moving between two NFTs also resets per-page state
 * (edition, quantity, gallery); search-param changes such as catalog filters
 * keep the page mounted. The CSS fade is the fallback for browsers without
 * View Transitions (styles.css turns it off where those run).
 */
function RouteTransition() {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  useEffect(() => installSharedArtworkTransitions(), [])
  return (
    <div key={pathname} className="route-fade animate-in duration-300 fade-in-0">
      <Outlet />
    </div>
  )
}

/**
 * Thin progress bar while a navigation is loading (lazy route chunk, guards).
 * It only shows up after 150ms (CSS delay), so fast navigations stay clean.
 */
function NavigationProgress() {
  const pending = useRouterState({ select: (state) => state.status === 'pending' })
  if (!pending) return null
  return (
    <div
      role="progressbar"
      aria-label="Carregando página"
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5"
    >
      <div className="nav-progress h-full bg-highlight" />
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
      <NavigationProgress />
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
