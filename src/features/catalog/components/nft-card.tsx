import { Link, useNavigate } from '@tanstack/react-router'
import { Eye, Heart, ShoppingCart } from 'lucide-react'
import { toast } from 'sonner'
import { useAddToCart } from '@/features/cart/hooks'
import { useIsFavorite, useToggleFavorite } from '@/features/favorites/hooks'
import { nftQueryOptions } from '@/features/catalog/hooks'
import { useQueryClient } from '@tanstack/react-query'
import { errorMessage } from '@/shared/api/errors'
import { NftImage } from '@/shared/components/nft-image'
import type { NftSummary } from '@/shared/contracts'
import { compareEth, formatEth } from '@/shared/lib/money'
import { cn } from '@/shared/lib/utils'
import { useSession } from '@/shared/session/session-store'
import { Skeleton } from '@/shared/ui/skeleton'
import { useSingleFlight } from '@/shared/hooks/use-locked-submit'

export function FavoriteButton({
  nft,
  className,
}: {
  nft: Pick<NftSummary, 'id' | 'name'>
  className?: string
}) {
  const session = useSession()
  const navigate = useNavigate()
  const isFavorite = useIsFavorite(nft.id)
  const toggle = useToggleFavorite()
  return (
    <button
      type="button"
      aria-pressed={isFavorite}
      aria-label={isFavorite ? `Remover ${nft.name} dos favoritos` : `Favoritar ${nft.name}`}
      onClick={() => {
        if (!session) {
          toast.message('Entre para salvar favoritos.')
          void navigate({ to: '/login', search: { redirect: `/nfts/${nft.id}` } })
          return
        }
        toggle.mutate({ nftId: nft.id, favorite: !isFavorite })
      }}
      className={cn(
        'flex size-[34px] items-center justify-center rounded-[6px] bg-background/90 text-foreground transition hover:text-highlight',
        className,
      )}
    >
      <Heart aria-hidden className={cn('size-5', isFavorite && 'fill-highlight text-highlight')} />
    </button>
  )
}

export function NftCard({
  nft,
  priority = false,
  index = 0,
}: {
  nft: NftSummary
  priority?: boolean
  /** Position in the grid: staggers the entrance animation (capped). */
  index?: number
}) {
  const addToCart = useAddToCart()
  const queryClient = useQueryClient()
  const exclusive = useSingleFlight()
  const soldOut = nft.available === 0

  const quickAdd = async () => {
    // Quick add uses the cheapest edition with stock, read from the detail.
    try {
      const detail = await queryClient.fetchQuery(nftQueryOptions(nft.id))
      const edition = detail.editions
        .filter((e) => e.available > 0)
        .sort((a, b) => compareEth(a.priceEth, b.priceEth))[0]
      if (!edition) {
        toast.error(`${nft.name} está esgotado.`)
        return
      }
      await addToCart.mutateAsync({ nftId: nft.id, editionId: edition.id, quantity: 1 })
      toast.success(`${nft.name} (edição ${edition.name}) adicionado ao carrinho.`)
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  return (
    <article
      data-vt-card
      aria-label={nft.name}
      style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
      className="group flex animate-in flex-col gap-3 duration-500 fade-in-0 slide-in-from-bottom-2 [animation-fill-mode:both]"
    >
      {/* Figma: 258×300 card surface, 250px artwork with radius 15. */}
      <div className="relative bg-card px-1 pt-6 pb-[26px] transition-[translate,box-shadow] duration-300 ease-out max-md:rounded-[18px] max-md:px-1.5 max-md:pt-1.5 max-md:pb-6 md:group-hover:-translate-y-1 md:group-hover:shadow-[0_14px_30px_rgba(0,0,0,0.35)]">
        {nft.rare && (
          <span className="absolute top-0 left-0 z-10 flex h-[29px] w-20 items-center justify-center bg-primary text-base leading-4 font-medium text-primary-foreground max-md:rounded-tl-[18px] max-md:h-8 max-md:w-[68px] max-md:text-sm">
            RARO
          </span>
        )}
        <Link
          to="/nfts/$nftId"
          params={{ nftId: nft.id }}
          tabIndex={-1}
          aria-hidden
          className="block overflow-hidden rounded-[15px]"
        >
          <NftImage
            src={nft.imageUrl}
            alt=""
            sizes="(min-width: 1024px) 236px, (min-width: 768px) 30vw, calc(50vw - 36px)"
            priority={priority}
            className={cn(
              'rounded-[15px] ease-out group-hover:scale-[1.04]',
              soldOut && 'opacity-60',
            )}
          />
        </Link>
        {soldOut && (
          <span className="absolute right-6 bottom-6 rounded-[4px] bg-background/90 px-2 py-1 text-xs font-bold text-destructive">
            ESGOTADO
          </span>
        )}
        {/* Mobile layout: heart in the artwork's top-right corner. */}
        <FavoriteButton
          nft={nft}
          className="absolute top-3 right-3 z-10 size-7 rounded-full bg-background/80 md:hidden [&_svg]:size-4"
        />
        <div className="absolute inset-x-0 bottom-1 hidden justify-center gap-2 transition md:flex md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
          <button
            type="button"
            onClick={() => exclusive(quickAdd)}
            disabled={soldOut || addToCart.isPending}
            aria-label={`Adicionar ${nft.name} ao carrinho`}
            className="flex size-[34px] items-center justify-center rounded-[6px] bg-background/90 hover:text-highlight disabled:opacity-50"
          >
            <ShoppingCart aria-hidden className="size-5" />
          </button>
          <FavoriteButton nft={nft} />
          <Link
            to="/nfts/$nftId"
            params={{ nftId: nft.id }}
            aria-label={`Ver detalhes de ${nft.name}`}
            className="flex size-[34px] items-center justify-center rounded-[6px] bg-background/90 hover:text-highlight"
          >
            <Eye aria-hidden className="size-5" />
          </Link>
        </div>
      </div>
      <div className="flex flex-col gap-3 max-md:gap-1 max-md:px-2">
        <h3 className="text-base leading-4">
          <Link
            to="/nfts/$nftId"
            params={{ nftId: nft.id }}
            className="hover:text-highlight focus-visible:text-highlight"
          >
            {nft.name}
          </Link>
        </h3>
        <p className="flex flex-wrap items-baseline gap-3 text-lg leading-4">
          <span className="font-bold text-highlight">
            <span className="sr-only">Preço: </span>
            {formatEth(nft.priceEth)}
          </span>
          {nft.compareAtPriceEth && (
            <s className="text-subtle">
              <span className="sr-only">Preço anterior: </span>
              {formatEth(nft.compareAtPriceEth)}
            </s>
          )}
        </p>
      </div>
    </article>
  )
}

export function NftCardSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-hidden>
      <div className="bg-card px-1 pt-6 pb-[26px]">
        <Skeleton className="aspect-square w-full rounded-[15px] bg-accent" />
      </div>
      <Skeleton className="h-4 w-3/4 bg-accent" />
      <Skeleton className="h-5 w-1/3 bg-accent" />
    </div>
  )
}
