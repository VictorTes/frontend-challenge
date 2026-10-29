import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Search, SlidersHorizontal } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { CatalogSection } from '@/features/catalog/components/catalog-section'
import { Hero, Journal, PromoBanners } from '@/features/catalog/components/home-sections'
import { catalogSearchSchema } from '@/features/catalog/search'

export const Route = createFileRoute('/')({
  validateSearch: catalogSearchSchema,
  component: HomePage,
})

/** Mobile search bar from the mobile home frame. */
function MobileSearch({ initial }: { initial: string }) {
  const navigate = useNavigate({ from: '/' })
  const [term, setTerm] = useState(initial)
  const submit = (event: FormEvent) => {
    event.preventDefault()
    void navigate({ search: (prev) => ({ ...prev, q: term.trim() || undefined, page: undefined }), hash: 'mercado' })
  }
  return (
    <form role="search" onSubmit={submit} className="container-page flex gap-3 pt-10 md:hidden">
      <label className="flex h-[45px] flex-1 items-center gap-2 rounded-[10px] bg-card px-3">
        <Search aria-hidden className="size-5 text-muted-foreground" />
        <span className="sr-only">Buscar NFTs</span>
        <input
          type="search"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Explorar coleções"
          className="min-w-0 flex-1 bg-transparent placeholder:text-muted-foreground focus:outline-none"
        />
      </label>
      <a
        href="#mercado"
        aria-label="Ir para filtros"
        className="flex size-[45px] items-center justify-center rounded-[10px] bg-primary text-primary-foreground"
      >
        <SlidersHorizontal aria-hidden className="size-5" />
      </a>
    </form>
  )
}

function HomePage() {
  const search = Route.useSearch()
  return (
    <>
      {/* Remounts when the URL query changes (e.g. history navigation). */}
      <MobileSearch key={search.q ?? ''} initial={search.q ?? ''} />
      <Hero />
      <CatalogSection search={search} />
      <PromoBanners />
      <Journal />
    </>
  )
}
