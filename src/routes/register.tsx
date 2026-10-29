import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { RegisterCard } from '@/features/auth/components/auth-card'

export const Route = createFileRoute('/register')({
  validateSearch: z.object({ redirect: z.string().optional().catch(undefined) }),
  component: RegisterPage,
})

function RegisterPage() {
  const { redirect } = Route.useSearch()
  return <RegisterCard redirect={redirect} />
}
