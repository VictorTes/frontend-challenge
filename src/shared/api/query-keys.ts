import type { CatalogQuery, Network } from '@/shared/contracts'

/**
 * Query key factory. Private data lives under ['me', userId, ...] so it is
 * isolated per user and can be dropped in one call on logout/user switch.
 * The cart is keyed by owner ('guest' or the user id) for the same reason.
 */
export const qk = {
  catalog: (params: CatalogQuery) => ['catalog', params] as const,
  catalogAll: ['catalog'] as const,
  featured: ['featured'] as const,
  nft: (id: string) => ['nft', id] as const,
  related: (id: string) => ['related', id] as const,
  relatedAll: ['related'] as const,

  cart: (owner: string) => ['cart', owner] as const,
  cartAll: ['cart'] as const,

  me: (userId: string) => ['me', userId] as const,
  meAll: ['me'] as const,
  favorites: (userId: string) => ['me', userId, 'favorites'] as const,
  quote: (userId: string, network: Network, cartVersion: number) =>
    ['me', userId, 'quote', network, cartVersion] as const,
  quoteAll: (userId: string) => ['me', userId, 'quote'] as const,
  wallets: (userId: string) => ['me', userId, 'wallets'] as const,
  profile: (userId: string) => ['me', userId, 'profile'] as const,
  order: (userId: string, orderId: string) => ['me', userId, 'order', orderId] as const,
  orderAll: (userId: string) => ['me', userId, 'order'] as const,
}
