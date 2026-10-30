import { useNavigate } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight, SlidersHorizontal, X } from 'lucide-react'
import { EmptyState, ErrorState } from '@/shared/components/feedback'
import {
  catalogTabs,
  collectionLabels,
  networkLabels,
  sortOptions,
  type CatalogTab,
  type SortOption,
} from '@/shared/contracts'
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

/** Window of up to 4 consecutive pages around the current one (layout: "1 2 3 4 >"). */
function pageList(current: number, total: number): (number | 'gap')[] {
  const size = Math.min(4, total)
  const start = Math.min(Math.max(1, current - 1), total - size + 1)
  return Array.from({ length: size }, (_, i) => start + i)
}

type Props = {
  search: CatalogSearch
  /** Controlled by the home page so the mobile search bar's filter icon can open it. */
  filtersOpen: boolean
  onFiltersOpenChange: (open: boolean) => void
}

export function CatalogSection({
  search,
  filtersOpen,
  onFiltersOpenChange: setFiltersOpen,
}: Props) {
  const navigate = useNavigate({ from: '/' })
  const query = toCatalogQuery(search)
  const { data, error, isPending, isFetching, isPlaceholderData, refetch } = useCatalog(query)
  const tab = search.tab ?? 'all'
  const sort = search.sort ?? 'recent'
  const page = query.page ?? 1

  /** Any filter change resets pagination to page 1. */
  const updateFilters = (patch: Partial<CatalogSearch>) =>
    navigate({
      search: (prev) => ({ ...prev, ...patch, page: undefined }),
      hash: 'mercado',
      resetScroll: false,
    })

  const goToPage = (next: number) =>
    navigate({
      search: (prev) => ({ ...prev, page: next > 1 ? next : undefined }),
      hash: 'mercado',
    })

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
      ? [
          {
            key: 'price',
            label: `Preço: ${search.minPrice ?? '0'}–${search.maxPrice ?? '∞'} ETH`,
            clear: { minPrice: undefined, maxPrice: undefined },
          },
        ]
      : []),
  ]

  const filters = (prefix: string) => (
    <CatalogFilters
      search={search}
      facets={data?.facets}
      onChange={updateFilters}
      idPrefix={prefix}
    />
  )

  return (
    <section
      id="mercado"
      aria-labelledby="catalog-title"
      className="container-page mt-6 scroll-mt-4 md:mt-24"
    >
      <h2 id="catalog-title" className="sr-only">
        Catálogo de NFTs
      </h2>
      <div className="grid gap-8 lg:grid-cols-[310px_minmax(0,1fr)] lg:gap-12">
        <aside aria-label="Filtros" className="hidden flex-col gap-6 lg:flex">
          {filters('desktop')}
          <FeaturedSideCard />
        </aside>

        <div className="flex min-w-0 flex-col gap-6 md:gap-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div
              role="tablist"
              aria-label="Seleção do catálogo"
              // WAI-ARIA tabs: arrows/Home/End move (and select) like the detail tabs.
              onKeyDown={(event) => {
                const index = catalogTabs.indexOf(tab)
                const next =
                  event.key === 'ArrowRight'
                    ? (index + 1) % catalogTabs.length
                    : event.key === 'ArrowLeft'
                      ? (index - 1 + catalogTabs.length) % catalogTabs.length
                      : event.key === 'Home'
                        ? 0
                        : event.key === 'End'
                          ? catalogTabs.length - 1
                          : -1
                if (next < 0) return
                event.preventDefault()
                const target = catalogTabs[next]!
                updateFilters({ tab: target === 'all' ? undefined : target })
                document.getElementById(`catalog-tab-${target}`)?.focus()
              }}
              className="flex gap-3.5 overflow-x-auto md:gap-5"
            >
              {catalogTabs.map((t) => (
                <button
                  key={t}
                  id={`catalog-tab-${t}`}
                  type="button"
                  role="tab"
                  aria-selected={tab === t}
                  tabIndex={tab === t ? 0 : -1}
                  onClick={() => updateFilters({ tab: t === 'all' ? undefined : t })}
                  className={cn(
                    // Figma: 15/16 medium (14px on phones so the three tabs fit, as in the mobile frame),
                    // active #e89b55 with a 2px #d28a4c underline 6px below.
                    'shrink-0 border-b-2 pb-[4px] text-sm leading-4 font-medium transition md:text-[15px]',
                    tab === t
                      ? 'border-primary text-highlight'
                      : 'border-transparent hover:text-highlight',
                  )}
                >
                  {TAB_LABELS[t]}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setFiltersOpen(true)}
                className="hidden items-center gap-2 rounded-[4px] border border-primary px-3 py-1.5 text-sm text-highlight md:flex lg:hidden"
              >
                <SlidersHorizontal aria-hidden className="size-4" /> Filtros
                {activeChips.length > 0 && (
                  <span className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
                    {activeChips.length}
                  </span>
                )}
              </button>
              <label htmlFor="catalog-sort" className="hidden text-[15px] leading-5 sm:block">
                Ordenar por:
              </label>
              <div className="hidden md:block">
                <Select
                  value={sort}
                  onValueChange={(value) =>
                    updateFilters({ sort: value === 'recent' ? undefined : (value as SortOption) })
                  }
                >
                  <SelectTrigger
                    id="catalog-sort"
                    aria-label="Ordenar por"
                    className="h-5 w-auto gap-2 border-none bg-transparent px-0 text-[15px] leading-5 shadow-none [&_svg]:text-foreground"
                  >
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
                    navigate({
                      search: (prev) => ({ tab: prev.tab, sort: prev.sort }),
                      hash: 'mercado',
                      resetScroll: false,
                    })
                  }
                  className="px-2 py-1 text-xs underline hover:text-highlight"
                >
                  Limpar filtros
                </button>
              </li>
            </ul>
          )}

          <div aria-live="polite" className="sr-only">
            {data && !isPlaceholderData
              ? `${data.total} NFTs encontrados. Página ${data.page} de ${data.totalPages}.`
              : ''}
          </div>

          {error && !data ? (
            <ErrorState
              error={error}
              onRetry={() => refetch()}
              title="Não foi possível carregar o catálogo"
            />
          ) : isPending ? (
            <div
              className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:gap-x-8 md:gap-y-[72px]"
              aria-busy="true"
              aria-label="Carregando catálogo"
            >
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
                <ErrorState
                  error={error}
                  onRetry={() => refetch()}
                  title="Não foi possível atualizar os resultados"
                  className="py-4"
                />
              )}
              <div
                data-testid="catalog-grid"
                aria-busy={isFetching}
                className={cn(
                  // Mobile layout staggers the second column (masonry look).
                  'grid grid-cols-2 gap-x-4 gap-y-6 transition-opacity sm:grid-cols-3 md:gap-x-8 md:gap-y-[72px]',
                  isPlaceholderData && 'opacity-60',
                )}
              >
                {data?.items.map((nft, i) => (
                  <NftCard key={nft.id} nft={nft} priority={i < 3} index={i} />
                ))}
              </div>
            </>
          )}

          {data && data.totalPages > 1 && (
            <nav aria-label="Paginação" className="flex justify-end md:mt-14">
              <ul className="flex items-center gap-2">
                {/* The layout shows only "next"; "previous" appears once there is a previous page. */}
                {page > 1 && (
                  <li>
                    <button
                      type="button"
                      aria-label="Página anterior"
                      onClick={() => goToPage(page - 1)}
                      className="flex size-[35px] items-center justify-center rounded-[4px] border border-border hover:text-highlight"
                    >
                      <ChevronLeft aria-hidden className="size-[18px]" />
                    </button>
                  </li>
                )}
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
                          'flex size-[35px] items-center justify-center rounded-[4px] text-lg leading-4',
                          p === page
                            ? 'bg-primary font-bold text-primary-foreground'
                            : 'border border-border hover:text-highlight',
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
                    className="flex size-[35px] items-center justify-center rounded-[4px] border border-border hover:text-highlight disabled:opacity-40"
                  >
                    <ChevronRight aria-hidden className="size-[18px]" />
                  </button>
                </li>
              </ul>
            </nav>
          )}
        </div>
      </div>

      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent
          side="left"
          className="w-[320px] overflow-y-auto border-border bg-background p-0"
        >
          <SheetTitle className="px-4 pt-5">Filtros</SheetTitle>
          <SheetDescription className="px-4 text-muted-foreground">
            {data ? `${data.total} resultados` : 'Carregando resultados'}
          </SheetDescription>
          {/* Mobile layout has no sort control on the page: it lives in the filter sheet. */}
          <div className="flex flex-col gap-2 px-5 pt-2 md:hidden">
            <label htmlFor="catalog-sort-mobile" className="text-lg leading-4 font-bold">
              Ordenar por
            </label>
            <Select
              value={sort}
              onValueChange={(value) =>
                updateFilters({ sort: value === 'recent' ? undefined : (value as SortOption) })
              }
            >
              <SelectTrigger
                id="catalog-sort-mobile"
                className="h-10 w-full rounded-[3px] border-border"
              >
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
          {filters('mobile')}
        </SheetContent>
      </Sheet>
    </section>
  )
}
