import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { LoginCard } from '@/features/auth/components/auth-card'

export const Route = createFileRoute('/login')({
  validateSearch: z.object({
    redirect: z.string().optional().catch(undefined),
    reason: z.enum(['expired']).optional().catch(undefined),
  }),
  component: LoginPage,
})

function LoginPage() {
  const { redirect, reason } = Route.useSearch()
  return <LoginCard redirect={redirect} expired={reason === 'expired'} />
}
