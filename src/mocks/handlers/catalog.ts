import { http, HttpResponse } from 'msw'
import {
  catalogTabs,
  collections,
  networks,
  sortOptions,
  type CatalogPage,
  type NftDetail,
  type NftSummary,
} from '@/shared/contracts'
import { compareEth, isEthString } from '@/shared/lib/money'
import { db } from '../db/store'
import { findNft } from '../domain'
import { API, apiError, simulateNetwork } from '../http'
import { has } from '../scenarios'

const DEFAULT_PAGE_SIZE = 9
const NEW_WINDOW_MS = 7 * 24 * 36e5

function toSummary(nft: NftDetail): NftSummary {
  const {
    description: _d,
    story: _s,
    images: _i,
    editions: _e,
    attributes: _a,
    rating: _r,
    reviewCount: _rc,
    contractAddress: _c,
    royaltyPercent: _rp,
    ...summary
  } = nft
  return summary
}

function oneOf<T extends string>(list: readonly T[], value: string | null): T | undefined {
  return value && (list as readonly string[]).includes(value) ? (value as T) : undefined
}

export const catalogHandlers = [
  http.get(`${API}/nfts`, async ({ request }) => {
    const failure = await simulateNetwork('catalog')
    if (failure) return failure

    const url = new URL(request.url)
    const params = url.searchParams
    const q = params.get('q')?.trim().toLowerCase() ?? ''
    const tab = oneOf(catalogTabs, params.get('tab')) ?? 'all'
    const selectedCollections = params.getAll('collection').filter((c) => oneOf(collections, c))
    const selectedNetworks = params.getAll('network').filter((n) => oneOf(networks, n))
    const minPrice = params.get('minPrice')
    const maxPrice = params.get('maxPrice')
    const sort = oneOf(sortOptions, params.get('sort')) ?? 'recent'
    const page = Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1)
    const pageSize = Math.min(48, Math.max(1, Number.parseInt(params.get('pageSize') ?? '', 10) || DEFAULT_PAGE_SIZE))

    if ((minPrice && !isEthString(minPrice)) || (maxPrice && !isEthString(maxPrice))) {
      return apiError(400, 'VALIDATION_ERROR', 'Faixa de preço inválida.')
    }

    const all = db().nfts
    const newest = Math.max(...all.map((n) => Date.parse(n.listedAt)))

    // Base set: search + tab + price. Facet counts are computed on it so each
    // facet shows how many results selecting it would add.
    const base = has('empty')
      ? []
      : all.filter((nft) => {
          if (q && !`${nft.name} ${nft.collectionName} ${nft.tokenId}`.toLowerCase().includes(q)) return false
          if (tab === 'new' && newest - Date.parse(nft.listedAt) > NEW_WINDOW_MS) return false
          if (tab === 'trending' && nft.likes < 250) return false
          if (minPrice && compareEth(nft.priceEth, minPrice) < 0) return false
          if (maxPrice && compareEth(nft.priceEth, maxPrice) > 0) return false
          return true
        })

    const byCollection = (nft: NftDetail) =>
      selectedCollections.length === 0 || selectedCollections.includes(nft.collection)
    const byNetwork = (nft: NftDetail) => selectedNetworks.length === 0 || selectedNetworks.includes(nft.network)

    const filtered = base.filter((n) => byCollection(n) && byNetwork(n))

    const sorted = [...filtered].sort((a, b) => {
      switch (sort) {
        case 'price-asc':
          return compareEth(a.priceEth, b.priceEth) || a.id.localeCompare(b.id)
        case 'price-desc':
          return compareEth(b.priceEth, a.priceEth) || a.id.localeCompare(b.id)
        case 'popular':
          return b.likes - a.likes || a.id.localeCompare(b.id)
        default:
          return Date.parse(b.listedAt) - Date.parse(a.listedAt) || a.id.localeCompare(b.id)
      }
    })

    const total = sorted.length
    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    const items = sorted.slice((page - 1) * pageSize, page * pageSize).map(toSummary)

    const prices = all.map((n) => n.priceEth).sort(compareEth)
    const body: CatalogPage = {
      items,
      page,
      pageSize,
      total,
      totalPages,
      facets: {
        collection: collections.map((value) => ({
          value,
          count: base.filter((n) => n.collection === value && byNetwork(n)).length,
        })),
        network: networks.map((value) => ({
          value,
          count: base.filter((n) => n.network === value && byCollection(n)).length,
        })),
        priceRange: { min: prices[0] ?? '0', max: prices[prices.length - 1] ?? '0' },
      },
    }
    return HttpResponse.json(body)
  }),

  http.get(`${API}/nfts/featured`, async () => {
    const failure = await simulateNetwork('featured')
    if (failure) return failure
    return HttpResponse.json({ items: db().nfts.filter((n) => n.featured).map(toSummary) })
  }),

  http.get(`${API}/nfts/:id`, async ({ params }) => {
    const failure = await simulateNetwork('nft-detail')
    if (failure) return failure
    const nft = findNft(String(params.id))
    if (!nft) return apiError(404, 'NOT_FOUND', 'NFT não encontrado.')
    return HttpResponse.json(nft)
  }),

  http.get(`${API}/nfts/:id/related`, async ({ params }) => {
    const failure = await simulateNetwork('related')
    if (failure) return failure
    const nft = findNft(String(params.id))
    if (!nft) return apiError(404, 'NOT_FOUND', 'NFT não encontrado.')
    const related = db()
      .nfts.filter((n) => n.id !== nft.id && n.collectionName === nft.collectionName)
      .slice(0, 10)
      .map(toSummary)
    return HttpResponse.json({ items: related })
  }),
]
