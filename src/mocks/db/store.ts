/**
 * In-memory mock database persisted to localStorage, so refreshes keep state.
 * `resetDb()` restores the deterministic seed. Only the mock layer imports this.
 */
import type { NftDetail, Network, Order, Quote, User, Wallet, WalletProvider } from '@/shared/contracts'
import {
  COUPONS,
  SEED_FAVORITES,
  SEED_PASSWORD,
  SEED_USERS,
  SEED_WALLETS,
  seedNfts,
} from './seed'

const STORAGE_KEY = 'nft-mock:db'
const SCHEMA_VERSION = 9

export interface UserRecord extends User {
  passwordHash: string
  salt: string
}

export interface SessionRecord {
  token: string
  userId: string
  expiresAt: string
}

export interface CartRecord {
  id: string
  ownerId: string | null
  items: { id: string; nftId: string; editionId: string; quantity: number; addedPriceEth: string }[]
  couponCode: string | null
  version: number
}

export interface QuoteRecord extends Quote {
  cartId: string
  userId: string | null
  usedByOrderId: string | null
}

export interface WalletRecord extends Wallet {
  userId: string
}

export interface OrderRecord extends Order {
  userId: string
  cartId: string
  idempotencyKey: string
  requestHash: string
  settleAt: number
  outcome: 'confirmed' | 'declined'
}

export interface DbState {
  schema: number
  nfts: NftDetail[]
  users: UserRecord[]
  sessions: SessionRecord[]
  favorites: Record<string, string[]>
  carts: Record<string, CartRecord>
  quotes: Record<string, QuoteRecord>
  wallets: WalletRecord[]
  /** `${userId}:${walletId}` → simulated wallet connection. */
  connections: Record<string, { provider: WalletProvider; network: Network }>
  orders: OrderRecord[]
  coupons: typeof COUPONS
  seq: number
  eventSeq: number
}

let state: DbState | null = null

export async function hashPassword(password: string, salt: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${salt}:${password}`)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

async function buildSeed(): Promise<DbState> {
  const now = new Date().toISOString()
  const users = await Promise.all(
    SEED_USERS.map(async (u) => {
      const salt = `salt-${u.id}`
      return { ...u, salt, passwordHash: await hashPassword(SEED_PASSWORD, salt) }
    }),
  )
  return {
    schema: SCHEMA_VERSION,
    nfts: seedNfts(),
    users,
    sessions: [],
    favorites: structuredClone(SEED_FAVORITES),
    carts: {},
    quotes: {},
    wallets: SEED_WALLETS.map((w) => ({ ...w, updatedAt: now })),
    connections: {},
    orders: [],
    coupons: structuredClone(COUPONS),
    seq: 1000,
    eventSeq: 0,
  }
}

export async function initDb(): Promise<void> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as DbState
      if (parsed.schema === SCHEMA_VERSION) {
        state = parsed
        return
      }
    }
  } catch {
    // Corrupt or unavailable storage: fall back to the seed.
  }
  state = await buildSeed()
  persist()
}

export async function resetDb(): Promise<void> {
  state = await buildSeed()
  persist()
}

export function db(): DbState {
  if (!state) throw new Error('Mock DB used before initDb()')
  return state
}

export function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Storage full/blocked: state stays in memory for this page.
  }
}

export function nextId(prefix: string): string {
  const s = db()
  s.seq += 1
  return `${prefix}-${s.seq.toString(36)}`
}

/** Random, unguessable tokens (not sequential) so sessions cannot be enumerated. */
export function randomToken(prefix: string): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return `${prefix}_${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`
}

export function publicUser(record: UserRecord): User {
  const { passwordHash: _p, salt: _s, ...user } = record
  return user
}
