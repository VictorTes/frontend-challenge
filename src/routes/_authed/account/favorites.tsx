import { createFileRoute } from '@tanstack/react-router'
import { FavoritesPage } from '@/features/account/components/favorites-page'

export const Route = createFileRoute('/_authed/account/favorites')({
  component: FavoritesPage,
})
