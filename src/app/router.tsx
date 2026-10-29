import { createRouter } from '@tanstack/react-router'
import { routeTree } from '@/routeTree.gen'
import { NotFoundPage } from '@/app/not-found'
import { RouteError } from '@/app/route-error'
import { prefersReducedMotion } from '@/shared/lib/motion'
import { queryClient } from './query-client'

export const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
  // Query owns caching; the router only orchestrates loading.
  defaultPreloadStaleTime: 0,
  scrollRestoration: true,
  // Page changes animate with the View Transitions API (crossfade + shared NFT
  // artwork, styles.css); filters and pagination keep the page in place.
  // The first load (no previous page) renders at once, so it never delays the LCP.
  defaultViewTransition: {
    types: ({ fromLocation, pathChanged }) => (fromLocation && pathChanged ? ['page'] : false),
  },
  // "/#mercado" and other in-page anchors scroll smoothly (instant with reduced motion).
  defaultHashScrollIntoView: {
    behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    block: 'start',
  },
  defaultNotFoundComponent: () => <NotFoundPage />,
  defaultErrorComponent: RouteError,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
