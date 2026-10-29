/**
 * REST endpoints, one function per operation. Every response is validated
 * against its contract in `request()`. Components never call these directly;
 * they go through the TanStack Query hooks in each feature.
 */
import { z } from 'zod'
import {
  cart,
  catalogPage,
  favorites,
  nftDetail,
  nftSummary,
  order,
  quote,
  session,
  user,
  wallet,
  walletConnection,
  type AddCartItemInput,
  type AvatarInput,
  type CatalogQuery,
  type CreateOrderInput,
  type LoginInput,
  type Network,
  type PasswordChangeInput,
  type ProfileInput,
  type RegisterInput,
  type WalletInput,
  type WalletProvider,
} from '@/shared/contracts'
import { request, requestVoid } from './client'

type Signal = { signal?: AbortSignal }

/** Serializes array params as repeated keys: collection=a&collection=b. */
function catalogParams(query: CatalogQuery): URLSearchParams {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === '') continue
    if (Array.isArray(value)) value.forEach((v) => params.append(key, String(v)))
    else params.set(key, String(value))
  }
  return params
}

export const api = {
  auth: {
    login: (input: LoginInput) => request(session, { method: 'POST', url: '/auth/login', data: input }),
    register: (input: RegisterInput) => request(session, { method: 'POST', url: '/auth/register', data: input }),
    session: ({ signal }: Signal = {}) => request(session, { url: '/auth/session', signal }),
    logout: () => requestVoid({ method: 'POST', url: '/auth/logout' }),
  },

  catalog: {
    list: (query: CatalogQuery, { signal }: Signal = {}) =>
      request(catalogPage, { url: '/nfts', params: catalogParams(query), signal }),
    featured: ({ signal }: Signal = {}) =>
      request(z.object({ items: z.array(nftSummary) }), { url: '/nfts/featured', signal }),
    detail: (id: string, { signal }: Signal = {}) =>
      request(nftDetail, { url: `/nfts/${encodeURIComponent(id)}`, signal }),
    related: (id: string, { signal }: Signal = {}) =>
      request(z.object({ items: z.array(nftSummary) }), { url: `/nfts/${encodeURIComponent(id)}/related`, signal }),
  },

  favorites: {
    list: ({ signal }: Signal = {}) => request(favorites, { url: '/me/favorites', signal }),
    add: (nftId: string) => request(favorites, { method: 'PUT', url: `/me/favorites/${encodeURIComponent(nftId)}` }),
    remove: (nftId: string) =>
      request(favorites, { method: 'DELETE', url: `/me/favorites/${encodeURIComponent(nftId)}` }),
  },

  cart: {
    get: ({ signal }: Signal = {}) => request(cart, { url: '/cart', signal }),
    addItem: (input: AddCartItemInput) => request(cart, { method: 'POST', url: '/cart/items', data: input }),
    updateItem: (itemId: string, quantity: number) =>
      request(cart, { method: 'PATCH', url: `/cart/items/${itemId}`, data: { quantity } }),
    removeItem: (itemId: string) => request(cart, { method: 'DELETE', url: `/cart/items/${itemId}` }),
    applyCoupon: (code: string) => request(cart, { method: 'PUT', url: '/cart/coupon', data: { code } }),
    removeCoupon: () => request(cart, { method: 'DELETE', url: '/cart/coupon' }),
    acknowledgePrices: () => request(cart, { method: 'POST', url: '/cart/acknowledge-prices' }),
    /** Runs before the session is activated, so the new token is passed explicitly. */
    merge: (guestCartId: string, token: string) =>
      request(cart, {
        method: 'POST',
        url: '/cart/merge',
        data: { guestCartId },
        headers: { Authorization: `Bearer ${token}` },
      }),
  },

  checkout: {
    quote: (network: Network) => request(quote, { method: 'POST', url: '/quotes', data: { network } }),
    connectWallet: (walletId: string, provider: WalletProvider, network: Network) =>
      request(walletConnection, { method: 'POST', url: `/wallets/${walletId}/connect`, data: { provider, network } }),
    disconnectWallet: (walletId: string) =>
      request(walletConnection, { method: 'POST', url: `/wallets/${walletId}/disconnect` }),
    createOrder: (input: CreateOrderInput, idempotencyKey: string) =>
      request(order, {
        method: 'POST',
        url: '/orders',
        data: input,
        headers: { 'Idempotency-Key': idempotencyKey },
      }),
    order: (orderId: string, { signal }: Signal = {}) => request(order, { url: `/orders/${orderId}`, signal }),
  },

  account: {
    profile: ({ signal }: Signal = {}) => request(user, { url: '/me/profile', signal }),
    updateProfile: (input: ProfileInput) => request(user, { method: 'PATCH', url: '/me/profile', data: input }),
    updateAvatar: (input: AvatarInput) => request(user, { method: 'PUT', url: '/me/avatar', data: input }),
    changePassword: (input: PasswordChangeInput) =>
      requestVoid({ method: 'POST', url: '/me/password', data: input }),
    wallets: ({ signal }: Signal = {}) =>
      request(z.object({ items: z.array(wallet) }), { url: '/me/wallets', signal }),
    createWallet: (input: WalletInput) => request(wallet, { method: 'POST', url: '/me/wallets', data: input }),
    updateWallet: (walletId: string, input: WalletInput) =>
      request(wallet, { method: 'PUT', url: `/me/wallets/${walletId}`, data: input }),
  },
}
