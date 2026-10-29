import { useState } from 'react'
import {
  collectionLabels,
  collections,
  networkLabels,
  networks,
  type CatalogPage,
  type CollectionSlug,
  type Network,
} from '@/shared/contracts'
import { centiToEth, ethToCenti } from '@/shared/lib/money'
import { cn } from '@/shared/lib/utils'
import { Slider } from '@/shared/ui/slider'
import type { CatalogSearch } from '../search'

type Props = {
  search: CatalogSearch
  facets: CatalogPage['facets'] | undefined
  /** Applies a filter change; the caller resets pagination. */
  onChange: (patch: Partial<CatalogSearch>) => void
  idPrefix: string
}

function toggle<T>(list: T[] | undefined, value: T): T[] | undefined {
  const next = list?.includes(value) ? list.filter((v) => v !== value) : [...(list ?? []), value]
  return next.length ? next : undefined
}

function formatCenti(centi: number) {
  return (centi / 100).toFixed(2).replace('.', ',')
}

function FacetList<T extends string>({
  legend,
  values,
  labels,
  selected,
  counts,
  onToggle,
  boldCount,
}: {
  legend: string
  values: readonly T[]
  labels: Record<T, string>
  selected: T[] | undefined
  counts: Map<string, number>
  onToggle: (value: T) => void
  boldCount?: boolean
}) {
  return (
    <fieldset className={cn('flex flex-col', boldCount ? 'px-3' : 'pl-3')}>
      {/* Figma: 18/16 bold title, 12px gap, 40px rows of 15px text. */}
      <legend className="-ml-3 mb-3 text-lg leading-4 font-bold">{legend}</legend>
      {values.map((value) => {
        const checked = selected?.includes(value) ?? false
        return (
          <label
            key={value}
            className={cn(
              'flex h-10 cursor-pointer items-center justify-between rounded text-[15px] leading-10 transition hover:text-highlight has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring',
              checked ? 'text-highlight' : 'text-muted-foreground',
            )}
          >
            <input type="checkbox" className="sr-only" checked={checked} onChange={() => onToggle(value)} />
            <span>{labels[value]}</span>
            <span className={cn(boldCount && 'font-bold')} aria-label={`${counts.get(value) ?? 0} resultados`}>
              ({counts.get(value) ?? 0})
            </span>
          </label>
        )
      })}
    </fieldset>
  )
}

function PriceRange({
  idPrefix,
  minBound,
  maxBound,
  initial,
  onApply,
}: {
  idPrefix: string
  minBound: number
  maxBound: number
  initial: [number, number]
  onApply: (range: [number, number]) => void
}) {
  const [range, setRange] = useState<[number, number]>(initial)
  return (
    <div className="flex flex-col gap-3">
      <h3 id={`${idPrefix}-price`} className="text-lg leading-4 font-bold">
        Faixa de preço
      </h3>
      <Slider
        aria-labelledby={`${idPrefix}-price`}
        min={minBound}
        max={maxBound}
        step={1}
        minStepsBetweenThumbs={1}
        value={range}
        onValueChange={(value) => setRange([value[0] ?? minBound, value[1] ?? maxBound])}
        thumbLabels={['Preço mínimo', 'Preço máximo']}
        className="ml-3 h-[21px] w-[calc(100%-12px)]"
      />
      <p className="pl-3 text-[15px] leading-5" aria-live="polite">
        Preço: {formatCenti(range[0])} - {formatCenti(range[1])} ETH
      </p>
      <button
        type="button"
        onClick={() => onApply(range)}
        className="ml-3 flex h-9 w-[92px] items-center justify-center self-start rounded-[6px] bg-primary text-base leading-5 font-bold text-primary-foreground hover:bg-highlight"
      >
        Aplicar
      </button>
    </div>
  )
}

export function CatalogFilters({ search, facets, onChange, idPrefix }: Props) {
  const bounds = facets?.priceRange
  const minBound = bounds ? ethToCenti(bounds.min) : 0
  const maxBound = bounds ? Math.max(ethToCenti(bounds.max), minBound + 1) : 1500
  const initial: [number, number] = [
    search.minPrice ? ethToCenti(search.minPrice) : minBound,
    search.maxPrice ? ethToCenti(search.maxPrice) : maxBound,
  ]
  const collectionCounts = new Map((facets?.collection ?? []).map((f) => [f.value, f.count]))
  const networkCounts = new Map((facets?.network ?? []).map((f) => [f.value, f.count]))

  return (
    <div className="flex flex-col gap-10 bg-card p-5">
      <FacetList<CollectionSlug>
        legend="Coleções"
        values={collections}
        labels={collectionLabels}
        selected={search.collection}
        counts={collectionCounts}
        onToggle={(value) => onChange({ collection: toggle(search.collection, value) })}
        boldCount
      />

      {/* Remounts (resetting the draft range) when the URL or bounds change. */}
      <PriceRange
        key={`${initial[0]}-${initial[1]}-${minBound}-${maxBound}`}
        idPrefix={idPrefix}
        minBound={minBound}
        maxBound={maxBound}
        initial={initial}
        onApply={(range) =>
          onChange({
            minPrice: range[0] > minBound ? centiToEth(range[0]) : undefined,
            maxPrice: range[1] < maxBound ? centiToEth(range[1]) : undefined,
          })
        }
      />

      <FacetList<Network>
        legend="Rede"
        values={networks}
        labels={networkLabels}
        selected={search.network}
        counts={networkCounts}
        onToggle={(value) => onChange({ network: toggle(search.network, value) })}
      />
    </div>
  )
}
