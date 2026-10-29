import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { sessionStore } from '@/shared/session/session-store'

/** Pathless layout guarding checkout, orders and account screens. */
export const Route = createFileRoute('/_authed')({
  beforeLoad: ({ location }) => {
    if (!sessionStore.get()) {
      throw redirect({ to: '/login', search: { redirect: location.href } })
    }
  },
  component: Outlet,
})
