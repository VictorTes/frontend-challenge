import { keepPreviousData, queryOptions, useQuery } from '@tanstack/react-query'
import { api } from '@/shared/api/endpoints'
import { qk } from '@/shared/api/query-keys'
import type { CatalogQuery } from '@/shared/contracts'

export const CATALOG_PAGE_SIZE = 9

export const catalogQueryOptions = (params: CatalogQuery) =>
  queryOptions({
    queryKey: qk.catalog(params),
    // The AbortSignal cancels superseded requests; the key isolates each
    // parameter set, so a late response can never overwrite a newer one.
    queryFn: ({ signal }) =>
      api.catalog.list({ ...params, pageSize: CATALOG_PAGE_SIZE }, { signal }),
  })

export function useCatalog(params: CatalogQuery) {
  return useQuery({ ...catalogQueryOptions(params), placeholderData: keepPreviousData })
}

export function useFeatured() {
  return useQuery({
    queryKey: qk.featured,
    queryFn: ({ signal }) => api.catalog.featured({ signal }),
    staleTime: 60_000,
  })
}

export const nftQueryOptions = (id: string) =>
  queryOptions({
    queryKey: qk.nft(id),
    queryFn: ({ signal }) => api.catalog.detail(id, { signal }),
  })

export function useNft(id: string) {
  return useQuery(nftQueryOptions(id))
}

export function useRelated(id: string) {
  return useQuery({
    queryKey: qk.related(id),
    queryFn: ({ signal }) => api.catalog.related(id, { signal }),
    staleTime: 60_000,
  })
}
