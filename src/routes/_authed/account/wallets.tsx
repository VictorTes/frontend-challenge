import { createFileRoute } from '@tanstack/react-router'
import { WalletsPage } from '@/features/account/components/wallets-page'

export const Route = createFileRoute('/_authed/account/wallets')({
  component: WalletsPage,
})
