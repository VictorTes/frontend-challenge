import { Link } from '@tanstack/react-router'
import { useQueries } from '@tanstack/react-query'
import { NftCard, NftCardSkeleton } from '@/features/catalog/components/nft-card'
import { nftQueryOptions } from '@/features/catalog/hooks'
import { useFavorites } from '@/features/favorites/hooks'
import { EmptyState, ErrorState } from '@/shared/components/feedback'

export function FavoritesPage() {
  const favorites = useFavorites()
  const ids = favorites.data?.nftIds ?? []
  const nfts = useQueries({ queries: ids.map((id) => nftQueryOptions(id)) })

  return (
    <section aria-labelledby="favorites-title" className="flex flex-col gap-6">
      <h1 id="favorites-title" className="text-base font-bold">
        Lista de interesse
      </h1>
      {favorites.isPending ? (
        <div className="grid grid-cols-2 gap-6 md:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <NftCardSkeleton key={i} />
          ))}
        </div>
      ) : favorites.error ? (
        <ErrorState error={favorites.error} onRetry={() => favorites.refetch()} />
      ) : ids.length === 0 ? (
        <EmptyState
          title="Nenhum favorito ainda"
          description="Toque no coração de um NFT para salvá-lo aqui."
          action={
            <Link to="/" hash="mercado" className="rounded-[4px] bg-primary px-5 py-2 font-bold text-primary-foreground">
              Explorar NFTs
            </Link>
          }
        />
      ) : (
        <ul className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-3" data-testid="favorites-grid">
          {nfts.map((q, i) => (
            <li key={ids[i]}>{q.data ? <NftCard nft={q.data} /> : <NftCardSkeleton />}</li>
          ))}
        </ul>
      )}
    </section>
  )
}
