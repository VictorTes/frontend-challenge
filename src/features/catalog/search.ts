import { z } from 'zod'
import {
  catalogTabs,
  collections,
  ethString,
  networks,
  sortOptions,
  type CatalogQuery,
} from '@/shared/contracts'

/**
 * Catalog state lives in the URL. Invalid values are dropped (`.catch`) instead
 * of breaking the page, so hand-edited or old links still load.
 */
export const catalogSearchSchema = z.object({
  q: z.string().trim().max(80).optional().catch(undefined),
  tab: z.enum(catalogTabs).optional().catch(undefined),
  collection: z.array(z.enum(collections)).optional().catch(undefined),
  network: z.array(z.enum(networks)).optional().catch(undefined),
  minPrice: ethString.optional().catch(undefined),
  maxPrice: ethString.optional().catch(undefined),
  sort: z.enum(sortOptions).optional().catch(undefined),
  page: z.coerce.number().int().positive().optional().catch(undefined),
})

export type CatalogSearch = z.infer<typeof catalogSearchSchema>

/** Normalized API params: empty arrays/strings removed, page defaults to 1. */
export function toCatalogQuery(search: CatalogSearch): CatalogQuery {
  return {
    q: search.q || undefined,
    tab: search.tab && search.tab !== 'all' ? search.tab : undefined,
    collection: search.collection?.length ? [...search.collection].sort() : undefined,
    network: search.network?.length ? [...search.network].sort() : undefined,
    minPrice: search.minPrice,
    maxPrice: search.maxPrice,
    sort: search.sort && search.sort !== 'recent' ? search.sort : undefined,
    page: search.page ?? 1,
  }
}
