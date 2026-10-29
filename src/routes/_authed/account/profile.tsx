import { createFileRoute } from '@tanstack/react-router'
import { ProfilePage } from '@/features/account/components/profile-page'

export const Route = createFileRoute('/_authed/account/profile')({
  component: ProfilePage,
})
