/**
 * Typed contracts shared by the HTTP client, the UI and the MSW mocks.
 * Responses are parsed with these schemas at the transport boundary, so a
 * mock drifting from the contract fails loudly instead of rendering garbage.
 */
import { z } from 'zod'
import { isEthString } from '@/shared/lib/money'

export const ethString = z.string().refine(isEthString, 'Valor em ETH inválido')

// ---------- Errors ----------
export const apiErrorCodes = [
  'VALIDATION_ERROR',
  'INVALID_CREDENTIALS',
  'UNAUTHENTICATED',
  'SESSION_EXPIRED',
  'FORBIDDEN',
  'NOT_FOUND',
  'EMAIL_TAKEN',
  'USERNAME_TAKEN',
  'OUT_OF_STOCK',
  'QUANTITY_LIMIT',
  'COUPON_INVALID',
  'COUPON_EXPIRED',
  'QUOTE_STALE',
  'IDEMPOTENCY_CONFLICT',
  'WALLET_REJECTED',
  'INTERNAL_ERROR',
  'SERVICE_UNAVAILABLE',
] as const
export type ApiErrorCode = (typeof apiErrorCodes)[number]

export const apiErrorBody = z.object({
  error: z.object({
    code: z.enum(apiErrorCodes),
    message: z.string(),
    fieldErrors: z.record(z.string(), z.string()).optional(),
    details: z.unknown().optional(),
  }),
})
export type ApiErrorBody = z.infer<typeof apiErrorBody>

// ---------- Shared field rules ----------
const email = z.email('Informe um e-mail válido')
const username = z
  .string()
  .trim()
  .regex(/^[a-z0-9_]{3,20}$/, 'Use de 3 a 20 letras minúsculas, números ou _')
const displayName = z.string().trim().min(2, 'Informe o nome de exibição').max(40, 'Máximo de 40 caracteres')
/** ENS label without the `.eth` suffix (the suffix is a fixed select in the layout). */
const ensLabel = z
  .string()
  .trim()
  .regex(/^[a-z0-9-]{3,32}$/, 'Use de 3 a 32 letras minúsculas, números ou hífen')

export const passwordRule = z
  .string()
  .min(8, 'Use pelo menos 8 caracteres')
  .regex(/[A-Za-z]/, 'Inclua pelo menos uma letra')
  .regex(/\d/, 'Inclua pelo menos um número')

// ---------- Users & session ----------
export const user = z.object({
  id: z.string(),
  email,
  name: z.string(),
  username: z.string(),
  ensName: z.string().nullable(),
  walletNickname: z.string().nullable(),
  avatarUrl: z.string().nullable(),
})
export type User = z.infer<typeof user>

export const session = z.object({
  token: z.string(),
  expiresAt: z.string(),
  user,
})
export type Session = z.infer<typeof session>

export const loginInput = z.object({
  email,
  password: z.string().min(1, 'Informe sua senha'),
})
export type LoginInput = z.infer<typeof loginInput>

export const registerInput = z.object({
  username,
  email,
  password: passwordRule,
})
export type RegisterInput = z.infer<typeof registerInput>

export const profileInput = z.object({
  name: displayName,
  username,
  email,
  ensName: z.union([ensLabel, z.literal('')]),
  walletNickname: z.string().trim().min(2, 'Informe o apelido da carteira').max(32, 'Máximo de 32 caracteres'),
})
export type ProfileInput = z.infer<typeof profileInput>

export const passwordChangeInput = z.object({
  currentPassword: z.string().min(1, 'Informe a senha atual'),
  newPassword: passwordRule,
})
export type PasswordChangeInput = z.infer<typeof passwordChangeInput>

export const MAX_AVATAR_BYTES = 1_000_000
export const avatarInput = z.object({
  /** data: URL (PNG/JPEG/WebP). `null` removes the avatar. */
  dataUrl: z
    .string()
    .regex(/^data:image\/(png|jpeg|webp);base64,/, 'Envie uma imagem PNG, JPEG ou WebP')
    .max(Math.ceil((MAX_AVATAR_BYTES * 4) / 3) + 64, 'A imagem deve ter no máximo 1 MB')
    .nullable(),
})
export type AvatarInput = z.infer<typeof avatarInput>

// ---------- NFTs ----------
export const collections = [
  'arte-digital',
  'fotografia',
  'musica',
  'arte-3d',
  'colecionaveis',
  'generativa',
  'jogos',
  'assinaturas',
  'utilidade',
] as const
export type CollectionSlug = (typeof collections)[number]

export const networks = ['ethereum', 'polygon', 'solana'] as const
export type Network = (typeof networks)[number]

export const catalogTabs = ['all', 'new', 'trending'] as const
export type CatalogTab = (typeof catalogTabs)[number]

export const sortOptions = ['recent', 'price-asc', 'price-desc', 'popular'] as const
export type SortOption = (typeof sortOptions)[number]

export const edition = z.object({
  id: z.string(),
  /** Display label from the layout: "1/1", "1/10", "1/50", "ABERTA". */
  name: z.string(),
  priceEth: ethString,
  available: z.number().int().nonnegative(),
  /** null = open edition. */
  supply: z.number().int().positive().nullable(),
  maxPerOrder: z.number().int().positive(),
})
export type Edition = z.infer<typeof edition>

export const nftSummary = z.object({
  id: z.string(),
  tokenId: z.string(),
  name: z.string(),
  collection: z.enum(collections),
  collectionName: z.string(),
  network: z.enum(networks),
  imageUrl: z.string(),
  /** Lowest available edition price. */
  priceEth: ethString,
  /** Previous price shown struck-through when the NFT is on sale. */
  compareAtPriceEth: ethString.nullable(),
  available: z.number().int().nonnegative(),
  rare: z.boolean(),
  featured: z.boolean(),
  likes: z.number().int().nonnegative(),
  listedAt: z.string(),
  version: z.number().int(),
})
export type NftSummary = z.infer<typeof nftSummary>

export const nftDetail = nftSummary.extend({
  description: z.string(),
  story: z.array(z.string()),
  images: z.array(z.string()).min(1),
  editions: z.array(edition).min(1),
  attributes: z.array(z.string()),
  rating: z.number(),
  reviewCount: z.number().int(),
  contractAddress: z.string(),
  royaltyPercent: z.number().int(),
})
export type NftDetail = z.infer<typeof nftDetail>

export const catalogQuery = z.object({
  q: z.string().optional(),
  tab: z.enum(catalogTabs).optional(),
  collection: z.array(z.enum(collections)).optional(),
  network: z.array(z.enum(networks)).optional(),
  minPrice: ethString.optional(),
  maxPrice: ethString.optional(),
  sort: z.enum(sortOptions).optional(),
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().positive().max(48).optional(),
})
export type CatalogQuery = z.infer<typeof catalogQuery>

export const facetCount = z.object({ value: z.string(), count: z.number().int() })

export const catalogPage = z.object({
  items: z.array(nftSummary),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
  facets: z.object({
    collection: z.array(facetCount),
    network: z.array(facetCount),
    priceRange: z.object({ min: ethString, max: ethString }),
  }),
})
export type CatalogPage = z.infer<typeof catalogPage>

// ---------- Favorites ----------
export const favorites = z.object({ nftIds: z.array(z.string()) })
export type Favorites = z.infer<typeof favorites>

// ---------- Cart ----------
export const cartItem = z.object({
  id: z.string(),
  nftId: z.string(),
  editionId: z.string(),
  tokenId: z.string(),
  nftName: z.string(),
  editionName: z.string(),
  imageUrl: z.string(),
  quantity: z.number().int().positive(),
  /** Current catalog price. */
  unitPriceEth: ethString,
  /** Price when the item was added or last acknowledged; differs after a change. */
  addedPriceEth: ethString,
  available: z.number().int().nonnegative(),
  maxPerOrder: z.number().int().positive(),
})
export type CartItem = z.infer<typeof cartItem>

export const cart = z.object({
  id: z.string(),
  items: z.array(cartItem),
  couponCode: z.string().nullable(),
  version: z.number().int(),
})
export type Cart = z.infer<typeof cart>

export const addCartItemInput = z.object({
  nftId: z.string(),
  editionId: z.string(),
  quantity: z.number().int().positive(),
})
export type AddCartItemInput = z.infer<typeof addCartItemInput>

// ---------- Quote ----------
export const quoteLine = z.object({
  itemId: z.string(),
  nftId: z.string(),
  editionId: z.string(),
  tokenId: z.string(),
  nftName: z.string(),
  editionName: z.string(),
  imageUrl: z.string(),
  quantity: z.number().int().positive(),
  unitPriceEth: ethString,
  lineTotalEth: ethString,
})
export type QuoteLine = z.infer<typeof quoteLine>

export const quoteIssue = z.object({
  itemId: z.string(),
  kind: z.enum(['price-changed', 'insufficient-stock', 'sold-out']),
  message: z.string(),
})
export type QuoteIssue = z.infer<typeof quoteIssue>

export const quote = z.object({
  id: z.string(),
  cartVersion: z.number().int(),
  network: z.enum(networks),
  lines: z.array(quoteLine),
  coupon: z.object({ code: z.string(), percentOff: z.number().int() }).nullable(),
  subtotalEth: ethString,
  discountEth: ethString,
  networkFeeEth: ethString,
  totalEth: ethString,
  expiresAt: z.string(),
  /** Lines the server cannot honour as they are; checkout is blocked while non-empty. */
  issues: z.array(quoteIssue),
})
export type Quote = z.infer<typeof quote>

export const quoteInput = z.object({ network: z.enum(networks) })

// ---------- Wallets ----------
export const walletProviders = ['metamask', 'walletconnect', 'coinbase'] as const
export type WalletProvider = (typeof walletProviders)[number]
export const walletSlots = ['primary', 'secondary'] as const
export type WalletSlot = (typeof walletSlots)[number]

const EVM_ADDRESS = /^0x[a-fA-F0-9]{40}$/
const SOLANA_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/

export function isValidAddress(network: Network, address: string): boolean {
  return network === 'solana' ? SOLANA_ADDRESS.test(address) : EVM_ADDRESS.test(address)
}

export const walletInput = z
  .object({
    slot: z.enum(walletSlots),
    displayName: displayName,
    nickname: z.string().trim().min(2, 'Informe o apelido da carteira').max(32, 'Máximo de 32 caracteres'),
    network: z.enum(networks, 'Selecione uma rede'),
    profileName: z.string().trim().min(2, 'Informe o nome do perfil').max(40, 'Máximo de 40 caracteres'),
    address: z.string().trim().min(1, 'Informe o endereço da carteira'),
    ensOrSecondary: z.string().trim().max(64, 'Máximo de 64 caracteres'),
    provider: z.enum(walletProviders, 'Selecione um tipo de carteira'),
    referralCode: z
      .string()
      .trim()
      .regex(/^[A-Z0-9]{4,12}$|^$/, 'Use de 4 a 12 letras maiúsculas ou números'),
    email,
    ensName: z.union([ensLabel, z.literal('')]),
  })
  .superRefine((value, ctx) => {
    if (value.address && !isValidAddress(value.network, value.address)) {
      ctx.addIssue({
        code: 'custom',
        path: ['address'],
        message:
          value.network === 'solana'
            ? 'Endereço Solana inválido (base58, 32 a 44 caracteres)'
            : 'Endereço inválido: use 0x seguido de 40 caracteres hexadecimais',
      })
    }
  })
export type WalletInput = z.infer<typeof walletInput>

export const wallet = z.object({
  id: z.string(),
  slot: z.enum(walletSlots),
  displayName: z.string(),
  nickname: z.string(),
  network: z.enum(networks),
  profileName: z.string(),
  address: z.string(),
  ensOrSecondary: z.string(),
  provider: z.enum(walletProviders),
  referralCode: z.string(),
  email: z.string(),
  ensName: z.string(),
  updatedAt: z.string(),
})
export type Wallet = z.infer<typeof wallet>

export const walletConnection = z.object({
  walletId: z.string(),
  provider: z.enum(walletProviders),
  network: z.enum(networks),
  status: z.enum(['connected', 'disconnected']),
})
export type WalletConnection = z.infer<typeof walletConnection>

export const connectWalletInput = z.object({
  provider: z.enum(walletProviders),
  network: z.enum(networks),
})

// ---------- Orders ----------
export const orderStatuses = ['pending', 'confirmed', 'declined'] as const
export type OrderStatus = (typeof orderStatuses)[number]

/** Collector data from the payment layout. */
export const buyerInfo = z.object({
  displayName,
  username,
  profileName: z.string().trim().min(2, 'Informe o nome do perfil'),
  email,
  ensName: z.union([ensLabel, z.literal('')]),
  referralCode: z
    .string()
    .trim()
    .regex(/^[A-Z0-9]{4,12}$|^$/, 'Use de 4 a 12 letras maiúsculas ou números'),
  note: z.string().max(500, 'Máximo de 500 caracteres'),
})
export type BuyerInfo = z.infer<typeof buyerInfo>

export const createOrderInput = z.object({
  quoteId: z.string(),
  walletId: z.string(),
  provider: z.enum(walletProviders),
  network: z.enum(networks),
  buyer: buyerInfo,
})
export type CreateOrderInput = z.infer<typeof createOrderInput>

export const order = z.object({
  id: z.string(),
  status: z.enum(orderStatuses),
  version: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
  network: z.enum(networks),
  wallet: z.object({
    id: z.string(),
    nickname: z.string(),
    address: z.string(),
    provider: z.enum(walletProviders),
  }),
  buyer: buyerInfo,
  lines: z.array(quoteLine),
  coupon: quote.shape.coupon,
  subtotalEth: ethString,
  discountEth: ethString,
  networkFeeEth: ethString,
  totalEth: ethString,
  txHash: z.string().nullable(),
  explorerUrl: z.string().nullable(),
  declineReason: z.string().nullable(),
})
export type Order = z.infer<typeof order>

// ---------- Realtime events ----------
export const nftUpdatedPayload = z.object({
  nftId: z.string(),
  priceEth: ethString,
  compareAtPriceEth: ethString.nullable(),
  available: z.number().int().nonnegative(),
  editions: z.array(edition.pick({ id: true, priceEth: true, available: true })),
})

const eventBase = z.object({
  /** Stable, unique id: redeliveries of the same event share it. */
  id: z.string(),
  occurredAt: z.string(),
  /** Monotonic per resource; lower or equal versions are stale. */
  version: z.number().int(),
})

export const nftUpdatedEvent = eventBase.extend({
  type: z.literal('nft.updated'),
  resource: z.object({ type: z.literal('nft'), id: z.string() }),
  payload: nftUpdatedPayload,
})

export const orderUpdatedEvent = eventBase.extend({
  type: z.literal('order.updated'),
  resource: z.object({ type: z.literal('order'), id: z.string() }),
  /** Owner of the order; the client discards events for another user. */
  userId: z.string(),
  payload: z.object({ order }),
})

export const realtimeEvent = z.discriminatedUnion('type', [nftUpdatedEvent, orderUpdatedEvent])
export type RealtimeEvent = z.infer<typeof realtimeEvent>
export type NftUpdatedEvent = z.infer<typeof nftUpdatedEvent>
export type OrderUpdatedEvent = z.infer<typeof orderUpdatedEvent>

// ---------- Labels (UI copy shared with mocks for facets) ----------
export const collectionLabels: Record<CollectionSlug, string> = {
  'arte-digital': 'Arte digital',
  fotografia: 'Fotografia',
  musica: 'Música',
  'arte-3d': 'Arte 3D',
  colecionaveis: 'Colecionáveis',
  generativa: 'Generativa',
  jogos: 'Jogos',
  assinaturas: 'Assinaturas',
  utilidade: 'Utilidade',
}

export const networkLabels: Record<Network, string> = {
  ethereum: 'Ethereum',
  polygon: 'Polygon',
  solana: 'Solana',
}

export const providerLabels: Record<WalletProvider, string> = {
  metamask: 'MetaMask',
  walletconnect: 'WalletConnect',
  coinbase: 'Coinbase Wallet',
}
