import type { CollectionSlug, Edition, Network, NftDetail } from '@/shared/contracts'
import { collections, networks } from '@/shared/contracts'
import { compareEth, fromWei, toWei } from '@/shared/lib/money'

/** Deterministic PRNG (mulberry32): the same seed always yields the same catalog. */
function prng(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Artwork = 'emerald' | 'sage' | 'ivory' | 'golden'
const ARTWORKS: Artwork[] = ['emerald', 'sage', 'ivory', 'golden']

export const artworkUrl = (art: Artwork, width = 640) => `/assets/nfts/${art}-${width}.webp`

/** The nine NFTs shown in the Figma file, with their exact names and prices. */
const FIGMA_NFTS: { name: string; number: number; art: Artwork; price: string; compareAt?: string; rare?: boolean }[] = [
  { name: 'Emerald Ape', number: 42, art: 'emerald', price: '1.19' },
  { name: 'Sage Nomad', number: 9, art: 'sage', price: '1.69' },
  { name: 'Neon Vessel', number: 552, art: 'ivory', price: '1.99', compareAt: '2.29', rare: true },
  { name: 'Cosmic Bloom', number: 118, art: 'sage', price: '1.29' },
  { name: 'Violet Nomad', number: 314, art: 'sage', price: '1.39' },
  { name: 'Ivory Baron', number: 88, art: 'ivory', price: '1.79' },
  { name: 'Golden Beat', number: 207, art: 'golden', price: '0.99' },
  { name: 'Golden Frequency', number: 71, art: 'golden', price: '0.59' },
  { name: 'Golden Signal', number: 160, art: 'golden', price: '0.39' },
]

const PREFIX: Record<Artwork, string[]> = {
  emerald: ['Emerald', 'Jade', 'Verdant', 'Forest'],
  sage: ['Sage', 'Violet', 'Cosmic', 'Lavender'],
  ivory: ['Ivory', 'Neon', 'Onyx', 'Midnight'],
  golden: ['Golden', 'Amber', 'Solar', 'Honey'],
}
const SUFFIX = ['Ape', 'Nomad', 'Baron', 'Beat', 'Signal', 'Vessel', 'Bloom', 'Frequency', 'Monk', 'Drifter']
const ATTRIBUTES: Record<Artwork, string[]> = {
  emerald: ['Óculos', 'Esmeralda', 'Jaqueta varsity'],
  sage: ['Chapéu bucket', 'Moletom', 'Calmo'],
  ivory: ['Gola alta', 'Blazer', 'Brinco'],
  golden: ['Fones', 'Jaqueta', 'Ouro'],
}

const EDITION_TEMPLATES: { name: string; supply: number | null; multiplier: number; maxPerOrder: number }[] = [
  { name: '1/1', supply: 1, multiplier: 400, maxPerOrder: 1 },
  { name: '1/10', supply: 10, multiplier: 200, maxPerOrder: 3 },
  { name: '1/50', supply: 50, multiplier: 100, maxPerOrder: 10 },
  { name: 'ABERTA', supply: null, multiplier: 50, maxPerOrder: 20 },
]

export const NFT_COUNT = 60

function pct(value: string, percent: number): string {
  return fromWei((toWei(value) * BigInt(percent)) / 100n)
}

function round2(value: string): string {
  // Keep prices at 2 decimals like the layout (e.g. 1.19 ETH).
  const wei = toWei(value)
  const unit = 10n ** 16n
  return fromWei((wei / unit) * unit)
}

export function seedNfts(): NftDetail[] {
  const rand = prng(20261029)
  const pick = <T,>(list: readonly T[]) => list[Math.floor(rand() * list.length)] as T
  const baseDate = Date.UTC(2026, 9, 1)
  const used = new Set<string>()

  return Array.from({ length: NFT_COUNT }, (_, index) => {
    const figma = FIGMA_NFTS[index]
    const art = figma?.art ?? ARTWORKS[index % ARTWORKS.length]!
    let number = figma?.number ?? 100 + Math.floor(rand() * 899)
    while (used.has(String(number))) number += 1
    used.add(String(number))
    const name = figma?.name ?? `${pick(PREFIX[art])} ${pick(SUFFIX)}`
    const tokenNumber = String(number).padStart(3, '0')
    const id = `${name.toLowerCase().replace(/\s+/g, '-')}-${tokenNumber}`
    // Base price for the "1/50" edition, between 0.02 and ~6 ETH.
    const basePrice = figma?.price ?? round2(fromWei(BigInt(Math.floor(20 + rand() * 5980)) * 10n ** 15n))

    // 1–4 editions; the layout's flagship NFT shows all four.
    const editionCount = index === 0 ? 4 : 1 + (index % 4)
    const templates = EDITION_TEMPLATES.slice(4 - editionCount).reverse()
    const editions: Edition[] = templates.map((t, e) => {
      const priceEth = t.name === '1/50' ? basePrice : round2(pct(basePrice, t.multiplier))
      const supply = t.supply
      // Deterministic stock: some sold out, some with a single unit left.
      let available = supply === null ? 100 : supply - ((index + e) % Math.max(1, Math.ceil(supply / 3)))
      if (index % 13 === 12) available = 0
      if (index === 5 && t.name === '1/50') available = 2
      return {
        id: `${id}-${t.name === 'ABERTA' ? 'open' : t.name.replace('/', 'of')}`,
        name: t.name,
        priceEth: priceEth === '0' ? '0.01' : priceEth,
        available: Math.max(0, available),
        supply,
        maxPerOrder: t.maxPerOrder,
      }
    })

    const inStock = editions.filter((e) => e.available > 0)
    const cheapest = (inStock.length ? inStock : editions).reduce((min, e) =>
      compareEth(e.priceEth, min.priceEth) < 0 ? e : min,
    )
    const gallery = [artworkUrl(art), ...ARTWORKS.filter((a) => a !== art).slice(0, 3).map((a) => artworkUrl(a))]
    const collection = collections[index % collections.length] as CollectionSlug
    const network = networks[index % 7 < 4 ? 0 : index % 7 < 6 ? 1 : 2] as Network
    const tokenId = `#${String(number).padStart(4, '0')}`

    return {
      id,
      tokenId,
      name: `${name} #${tokenNumber}`,
      collection,
      collectionName: art === 'emerald' ? 'Kurio Apes' : 'Kurio Editions',
      network,
      imageUrl: artworkUrl(art),
      priceEth: cheapest.priceEth,
      compareAtPriceEth: figma?.compareAt ?? null,
      available: editions.reduce((sum, e) => sum + e.available, 0),
      rare: figma?.rare ?? index % 9 === 4,
      featured: index < 3,
      likes: Math.floor(rand() * 500),
      listedAt: new Date(baseDate - index * 36e5 * 7).toISOString(),
      version: 1,
      description: `Um colecionável digital finalizado à mão da coleção ${art === 'emerald' ? 'Kurio Apes' : 'Kurio Editions'}, verificado na ${network === 'solana' ? 'Solana' : network === 'polygon' ? 'Polygon' : 'Ethereum'}, com arte desbloqueável e acesso para colecionadores.`,
      story: [
        `${name} #${tokenNumber} é uma obra digital finalizada à mão da coleção Kurio Editions. Cada atributo fica armazenado nos metadados do token e verificado na rede. A obra explora identidade, movimento e luz em um mundo digital sem fronteiras.`,
        'A propriedade inclui a arte em alta resolução, lançamentos exclusivos para colecionadores e um registro permanente de procedência registrada na rede. O criador recebe 5% de direitos autorais nas vendas secundárias, apoiando novos trabalhos e lançamentos da comunidade.',
      ],
      images: gallery,
      editions,
      attributes: [...ATTRIBUTES[art].slice(0, 2), (figma?.rare ?? index % 9 === 4) ? 'Raro' : 'Comum'],
      rating: 4 + ((index * 7) % 10) / 10,
      reviewCount: 5 + ((index * 11) % 40),
      contractAddress: `0x7A42${(index * 2654435761).toString(16).padStart(32, '0').slice(0, 32)}19E8`,
      royaltyPercent: 5,
    }
  })
}

export const SEED_PASSWORD = 'Kurio@2026'

export const SEED_USERS = [
  {
    id: 'user-alice',
    email: 'alice@kurio.test',
    name: 'Alice Collector',
    username: 'alice',
    ensName: 'alice',
    walletNickname: 'Principal',
    avatarUrl: null,
  },
  {
    id: 'user-bruno',
    email: 'bruno@kurio.test',
    name: 'Bruno Buyer',
    username: 'bruno',
    ensName: null,
    walletNickname: null,
    avatarUrl: null,
  },
] as const

export const SEED_WALLETS = [
  {
    id: 'wallet-alice-primary',
    userId: 'user-alice',
    slot: 'primary' as const,
    displayName: 'Alice Collector',
    nickname: 'Principal',
    network: 'ethereum' as const,
    profileName: 'alice',
    address: '0xA91F3c4D5e6F708192A3b4C5d6E7f8091a2BE82C',
    ensOrSecondary: '',
    provider: 'metamask' as const,
    referralCode: '',
    email: 'alice@kurio.test',
    ensName: 'alice',
  },
  {
    id: 'wallet-alice-secondary',
    userId: 'user-alice',
    slot: 'secondary' as const,
    displayName: 'Alice Collector',
    nickname: 'Reserva',
    network: 'polygon' as const,
    profileName: 'alice',
    address: '0x5b2C8d9E0f1A2b3C4d5E6f708192a3B4c5D6e7F8',
    ensOrSecondary: 'nova.kurio.eth',
    provider: 'coinbase' as const,
    referralCode: '',
    email: 'alice@kurio.test',
    ensName: '',
  },
]

export const SEED_FAVORITES: Record<string, string[]> = {
  'user-alice': ['sage-nomad-009', 'ivory-baron-088'],
  'user-bruno': ['golden-beat-207'],
}

/** Coupons: valid and expired. Anything else is invalid. */
export const COUPONS = [
  { code: 'KURIO10', percentOff: 10, expiresAt: '2099-01-01T00:00:00.000Z' },
  { code: 'GENESIS25', percentOff: 25, expiresAt: '2099-01-01T00:00:00.000Z' },
  { code: 'VERAO20', percentOff: 20, expiresAt: '2025-03-01T00:00:00.000Z' },
]

/** Estimated network fees per order (layout: 0.016 ETH on Ethereum). */
export const NETWORK_FEES: Record<Network, string> = {
  ethereum: '0.016',
  polygon: '0.002',
  solana: '0.0005',
}
