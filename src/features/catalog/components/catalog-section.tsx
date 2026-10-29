import { useNavigate } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight, SlidersHorizontal, X } from 'lucide-react'
import { useState } from 'react'
import { EmptyState, ErrorState } from '@/shared/components/feedback'
import { catalogTabs, collectionLabels, networkLabels, sortOptions, type CatalogTab, type SortOption } from '@/shared/contracts'
import { cn } from '@/shared/lib/utils'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/shared/ui/sheet'
import { useCatalog } from '../hooks'
import { toCatalogQuery, type CatalogSearch } from '../search'
import { CatalogFilters } from './catalog-filters'
import { NftCard, NftCardSkeleton } from './nft-card'
import { FeaturedSideCard } from './home-sections'

const TAB_LABELS: Record<CatalogTab, string> = {
  all: 'Todos os NFTs',
  new: 'Novos lançamentos',
  trending: 'Em alta',
}

const SORT_LABELS: Record<SortOption, string> = {
  recent: 'Listados recentemente',
  'price-asc': 'Menor preço',
  'price-desc': 'Maior preço',
  popular: 'Mais curtidos',
}

function pageList(current: number, total: number): (number | 'gap')[] {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1)
  const pages = new Set([1, total, current - 1, current, current + 1].filter((p) => p >= 1 && p <= total))
  const sorted = [...pages].sort((a, b) => a - b)
  return sorted.flatMap((p, i) => (i > 0 && p - sorted[i - 1]! > 1 ? ['gap' as const, p] : [p]))
}

export function CatalogSection({ search }: { search: CatalogSearch }) {
  const navigate = useNavigate({ from: '/' })
  const query = toCatalogQuery(search)
  const { data, error, isPending, isFetching, isPlaceholderData, refetch } = useCatalog(query)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const tab = search.tab ?? 'all'
  const sort = search.sort ?? 'recent'
  const page = query.page ?? 1

  /** Any filter change resets pagination to page 1. */
  const updateFilters = (patch: Partial<CatalogSearch>) =>
    navigate({ search: (prev) => ({ ...prev, ...patch, page: undefined }), hash: 'mercado', resetScroll: false })

  const goToPage = (next: number) =>
    navigate({ search: (prev) => ({ ...prev, page: next > 1 ? next : undefined }), hash: 'mercado' })

  const activeChips = [
    ...(search.q ? [{ key: 'q', label: `Busca: "${search.q}"`, clear: { q: undefined } }] : []),
    ...(search.collection ?? []).map((c) => ({
      key: c,
      label: collectionLabels[c],
      clear: { collection: search.collection?.filter((x) => x !== c) },
    })),
    ...(search.network ?? []).map((n) => ({
      key: n,
      label: networkLabels[n],
      clear: { network: search.network?.filter((x) => x !== n) },
    })),
    ...(search.minPrice || search.maxPrice
      ? [{ key: 'price', label: `Preço: ${search.minPrice ?? '0'}–${search.maxPrice ?? '∞'} ETH`, clear: { minPrice: undefined, maxPrice: undefined } }]
      : []),
  ]

  const filters = (prefix: string) => (
    <CatalogFilters search={search} facets={data?.facets} onChange={updateFilters} idPrefix={prefix} />
  )

  return (
    <section id="mercado" aria-labelledby="catalog-title" className="container-page mt-10 scroll-mt-4 md:mt-[84px]">
      <h2 id="catalog-title" className="sr-only">
        Catálogo de NFTs
      </h2>
      <div className="grid gap-8 lg:grid-cols-[310px_1fr] lg:gap-[26px]">
        <aside aria-label="Filtros" className="hidden flex-col gap-8 lg:flex">
          {filters('desktop')}
          <FeaturedSideCard />
        </aside>

        <div className="flex min-w-0 flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div role="tablist" aria-label="Seleção do catálogo" className="flex gap-4 overflow-x-auto md:gap-4">
              {catalogTabs.map((t) => (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  aria-selected={tab === t}
                  onClick={() => updateFilters({ tab: t === 'all' ? undefined : t })}
                  className={cn(
                    'shrink-0 border-b-2 pb-1 text-[15px] font-medium transition',
                    tab === t ? 'border-highlight text-highlight' : 'border-transparent hover:text-highlight',
                  )}
                >
                  {TAB_LABELS[t]}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setFiltersOpen(true)}
                className="flex items-center gap-2 rounded-[4px] border border-primary px-3 py-1.5 text-sm text-highlight lg:hidden"
              >
                <SlidersHorizontal aria-hidden className="size-4" /> Filtros
                {activeChips.length > 0 && <span className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground">{activeChips.length}</span>}
              </button>
              <label htmlFor="catalog-sort" className="hidden text-[15px] sm:block">
                Ordenar por:
              </label>
              <Select value={sort} onValueChange={(value) => updateFilters({ sort: value === 'recent' ? undefined : (value as SortOption) })}>
                <SelectTrigger id="catalog-sort" aria-label="Ordenar por" className="h-9 w-[220px] border-none bg-transparent px-1 text-[15px] shadow-none">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-border bg-card">
                  {sortOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {SORT_LABELS[option]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {activeChips.length > 0 && (
            <ul aria-label="Filtros ativos" className="flex flex-wrap gap-2">
              {activeChips.map((chip) => (
                <li key={chip.key}>
                  <button
                    type="button"
                    onClick={() => updateFilters(chip.clear)}
                    className="flex items-center gap-1 rounded-full border border-primary px-3 py-1 text-xs text-highlight hover:bg-primary/10"
                    aria-label={`Remover filtro ${chip.label}`}
                  >
                    {chip.label} <X aria-hidden className="size-3" />
                  </button>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  onClick={() =>
                    navigate({ search: (prev) => ({ tab: prev.tab, sort: prev.sort }), hash: 'mercado', resetScroll: false })
                  }
                  className="px-2 py-1 text-xs underline hover:text-highlight"
                >
                  Limpar filtros
                </button>
              </li>
            </ul>
          )}

          <div aria-live="polite" className="sr-only">
            {data && !isPlaceholderData ? `${data.total} NFTs encontrados. Página ${data.page} de ${data.totalPages}.` : ''}
          </div>

          {error && !data ? (
            <ErrorState error={error} onRetry={() => refetch()} title="Não foi possível carregar o catálogo" />
          ) : isPending ? (
            <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 md:gap-x-6" aria-busy="true" aria-label="Carregando catálogo">
              {Array.from({ length: 9 }, (_, i) => (
                <NftCardSkeleton key={i} />
              ))}
            </div>
          ) : data && data.items.length === 0 ? (
            <EmptyState
              title="Nenhum NFT encontrado"
              description="Tente outros termos de busca ou remova alguns filtros."
            />
          ) : (
            <>
              {error && (
                <ErrorState error={error} onRetry={() => refetch()} title="Não foi possível atualizar os resultados" className="py-4" />
              )}
              <div
                data-testid="catalog-grid"
                aria-busy={isFetching}
                className={cn(
                  'grid grid-cols-2 gap-x-4 gap-y-10 transition-opacity sm:grid-cols-3 md:gap-x-6 md:gap-y-12',
                  isPlaceholderData && 'opacity-60',
                )}
              >
                {data?.items.map((nft, i) => <NftCard key={nft.id} nft={nft} priority={i < 3} />)}
              </div>
            </>
          )}

          {data && data.totalPages > 1 && (
            <nav aria-label="Paginação" className="flex justify-end">
              <ul className="flex items-center gap-2">
                <li>
                  <button
                    type="button"
                    aria-label="Página anterior"
                    disabled={page <= 1}
                    onClick={() => goToPage(page - 1)}
                    className="flex size-8 items-center justify-center rounded-[4px] bg-card hover:text-highlight disabled:opacity-40"
                  >
                    <ChevronLeft aria-hidden className="size-4" />
                  </button>
                </li>
                {pageList(page, data.totalPages).map((p, i) =>
                  p === 'gap' ? (
                    <li key={`gap-${i}`} aria-hidden className="px-1 text-subtle">
                      …
                    </li>
                  ) : (
                    <li key={p}>
                      <button
                        type="button"
                        aria-label={`Página ${p}`}
                        aria-current={p === page ? 'page' : undefined}
                        onClick={() => goToPage(p)}
                        className={cn(
                          'flex size-8 items-center justify-center rounded-[4px] text-sm',
                          p === page ? 'bg-primary font-bold text-primary-foreground' : 'bg-card hover:text-highlight',
                        )}
                      >
                        {p}
                      </button>
                    </li>
                  ),
                )}
                <li>
                  <button
                    type="button"
                    aria-label="Próxima página"
                    disabled={page >= data.totalPages}
                    onClick={() => goToPage(page + 1)}
                    className="flex size-8 items-center justify-center rounded-[4px] bg-card hover:text-highlight disabled:opacity-40"
                  >
                    <ChevronRight aria-hidden className="size-4" />
                  </button>
                </li>
              </ul>
            </nav>
          )}
        </div>
      </div>

      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="left" className="w-[320px] overflow-y-auto border-border bg-background p-0">
          <SheetTitle className="px-4 pt-5">Filtros</SheetTitle>
          <SheetDescription className="px-4 text-muted-foreground">
            {data ? `${data.total} resultados` : 'Carregando resultados'}
          </SheetDescription>
          {filters('mobile')}
        </SheetContent>
      </Sheet>
    </section>
  )
}
