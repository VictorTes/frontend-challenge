import { Link, useNavigate, useRouter } from '@tanstack/react-router'
import { ChevronLeft, Heart, Mail, Search, ShoppingCart, Star } from 'lucide-react'
import { LinkedinIcon, TwitterIcon } from '@/shared/components/brand-icons'
import { useState } from 'react'
import { toast } from 'sonner'
import { NotFoundPage } from '@/app/not-found'
import { useAddToCart, useCart } from '@/features/cart/hooks'
import { FavoriteButton } from '@/features/catalog/components/nft-card'
import { useIsFavorite, useToggleFavorite } from '@/features/favorites/hooks'
import { useNft } from '@/features/catalog/hooks'
import { ApiError, errorMessage } from '@/shared/api/errors'
import { ErrorState } from '@/shared/components/feedback'
import { NftImage } from '@/shared/components/nft-image'
import { QuantityStepper } from '@/shared/components/quantity-stepper'
import { networkLabels, type Edition, type NftDetail } from '@/shared/contracts'
import { compareEth, formatEth } from '@/shared/lib/money'
import { cn } from '@/shared/lib/utils'
import { useSession } from '@/shared/session/session-store'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/ui/dialog'
import { Skeleton } from '@/shared/ui/skeleton'
import { RelatedCarousel } from './related-carousel'

function Rating({ rating, count }: { rating: number; count: number }) {
  return (
    <p className="flex items-center gap-1 text-sm">
      <span className="sr-only">Nota {rating.toFixed(1)} de 5.</span>
      <span aria-hidden className="flex">
        {Array.from({ length: 5 }, (_, i) => (
          <Star key={i} className={cn('size-3.5', i < Math.round(rating) ? 'fill-star text-star' : 'text-subtle')} />
        ))}
      </span>
      <span className="ml-1">{count} avaliações de colecionadores</span>
    </p>
  )
}

function EditionPicker({
  editions,
  selected,
  onSelect,
}: {
  editions: Edition[]
  selected: string
  onSelect: (id: string) => void
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 font-bold">Edição:</legend>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Edição">
        {editions.map((edition) => {
          const soldOut = edition.available === 0
          const active = edition.id === selected
          return (
            <label
              key={edition.id}
              className={cn(
                'cursor-pointer rounded-full border px-3 py-1 text-sm transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring',
                active ? 'border-highlight text-highlight' : 'border-border text-muted-foreground hover:border-primary',
                soldOut && 'cursor-not-allowed line-through opacity-50',
              )}
            >
              <input
                type="radio"
                name="edition"
                value={edition.id}
                className="sr-only"
                checked={active}
                disabled={soldOut}
                onChange={() => onSelect(edition.id)}
              />
              {edition.name}
              {soldOut && <span className="sr-only"> (esgotada)</span>}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

function Gallery({ nft }: { nft: NftDetail }) {
  const [active, setActive] = useState(0)
  const [zoom, setZoom] = useState(false)
  const image = nft.images[active] ?? nft.imageUrl
  return (
    <div className="grid gap-6 md:grid-cols-[90px_1fr]">
      <ul aria-label="Galeria" className="order-2 flex gap-3 md:order-1 md:flex-col md:gap-4">
        {nft.images.map((src, i) => (
          <li key={src}>
            <button
              type="button"
              aria-label={`Imagem ${i + 1} de ${nft.images.length}`}
              aria-pressed={i === active}
              onClick={() => setActive(i)}
              className={cn('block size-[70px] overflow-hidden rounded md:size-[90px]', i === active ? 'ring-2 ring-highlight' : 'opacity-80 hover:opacity-100')}
            >
              <img src={src.replace('-640', '-320')} alt="" width={90} height={90} className="size-full object-cover" />
            </button>
          </li>
        ))}
      </ul>
      <div className="relative order-1 self-start rounded-lg bg-card p-4 md:order-2 md:p-5">
        <NftImage src={image} alt={nft.name} sizes="(min-width: 768px) 360px, 90vw" priority className="rounded-[18px]" />
        <button
          type="button"
          aria-label="Ampliar imagem"
          onClick={() => setZoom(true)}
          className="absolute top-2 right-2 flex size-9 items-center justify-center rounded-full bg-background/90 hover:text-highlight"
        >
          <Search aria-hidden className="size-5" />
        </button>
      </div>
      <Dialog open={zoom} onOpenChange={setZoom}>
        <DialogContent className="max-w-[min(92vw,720px)] border-border bg-card p-4">
          <DialogTitle className="sr-only">{nft.name}</DialogTitle>
          <DialogDescription className="sr-only">Imagem ampliada</DialogDescription>
          <img src={image.replace('-640', '-960')} alt={nft.name} width={960} height={960} className="w-full rounded-lg" />
        </DialogContent>
      </Dialog>
    </div>
  )
}

function DetailSkeleton() {
  return (
    <div className="container-page grid gap-8 py-8 md:grid-cols-[500px_1fr]" aria-busy="true" aria-label="Carregando NFT">
      <Skeleton className="aspect-square w-full bg-card" />
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-2/3 bg-card" />
        <Skeleton className="h-6 w-1/4 bg-card" />
        <Skeleton className="h-24 w-full bg-card" />
        <Skeleton className="h-10 w-1/2 bg-card" />
      </div>
    </div>
  )
}

export function NftDetailPage({ nftId }: { nftId: string }) {
  const { data: nft, error, isPending, refetch } = useNft(nftId)
  const { data: cart } = useCart()
  const addToCart = useAddToCart()
  const navigate = useNavigate()
  const router = useRouter()
  const session = useSession()
  const isFavorite = useIsFavorite(nftId)
  const toggleFavorite = useToggleFavorite()
  const [editionId, setEditionId] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [tab, setTab] = useState<'details' | 'reviews'>('details')

  // Default to the cheapest edition with stock (the price shown on the card);
  // re-pick automatically if the chosen one sells out.
  const edition = nft
    ? (nft.editions.find((e) => e.id === editionId && e.available > 0) ??
      nft.editions.filter((e) => e.available > 0).sort((a, b) => compareEth(a.priceEth, b.priceEth))[0] ??
      nft.editions[0]!)
    : undefined
  const inCart = cart?.items.find((i) => i.editionId === edition?.id)?.quantity ?? 0
  const maxQuantity = edition ? Math.max(0, Math.min(edition.available, edition.maxPerOrder) - inCart) : 0

  // Clamp to what can still be bought (stock or cart may change in realtime).
  const qty = Math.min(quantity, Math.max(1, maxQuantity))

  if (isPending) return <DetailSkeleton />
  if (error) {
    if (ApiError.from(error).status === 404) {
      return <NotFoundPage title="NFT não encontrado" description="Este NFT não existe ou foi removido do mercado." />
    }
    return (
      <div className="container-page py-10">
        <ErrorState error={error} onRetry={() => refetch()} title="Não foi possível carregar este NFT" />
      </div>
    )
  }
  if (!nft || !edition) return null

  const soldOut = edition.available === 0
  const limitReached = !soldOut && maxQuantity === 0

  const add = async (goToCart: boolean) => {
    try {
      await addToCart.mutateAsync({ nftId: nft.id, editionId: edition.id, quantity: qty })
      toast.success(`${nft.name} (edição ${edition.name}) × ${qty} adicionado ao carrinho.`)
      setQuantity(1)
      if (goToCart) void navigate({ to: '/cart' })
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  const shareUrl = typeof window !== 'undefined' ? window.location.href : ''
  const shareText = `${nft.name} na Kurio`

  return (
    <article className="pb-36 md:pb-0">
      {/* Mobile top bar */}
      <div className="container-page flex items-center justify-between pt-6 md:hidden">
        <button
          type="button"
          aria-label="Voltar"
          onClick={() => (window.history.length > 1 ? router.history.back() : navigate({ to: '/' }))}
          className="flex size-9 items-center justify-center rounded-full bg-card"
        >
          <ChevronLeft aria-hidden className="size-5" />
        </button>
        <FavoriteButton nft={nft} className="rounded-full bg-card" />
      </div>

      <div className="container-page pt-4 md:pt-7">
        <nav aria-label="Trilha de navegação" className="mb-3 hidden text-sm font-bold md:block">
          <ol className="flex gap-2">
            <li>
              <Link to="/" className="hover:text-highlight">
                Início
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li>
              <Link to="/" hash="mercado" className="hover:text-highlight">
                Mercado
              </Link>
            </li>
          </ol>
        </nav>

        <div className="grid gap-8 md:grid-cols-[minmax(0,500px)_1fr] lg:gap-8">
          <Gallery nft={nft} />

          <div className="flex flex-col gap-4 rounded-t-[28px] bg-card p-6 md:rounded-none md:bg-transparent md:p-0">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h1 className="text-2xl font-bold md:text-[28px]">{nft.name}</h1>
              <span className="flex items-center gap-1 rounded-full border border-primary px-2 py-0.5 text-sm md:hidden">
                <Star aria-hidden className="size-4 fill-star text-star" />
                <b>{nft.rating.toFixed(1)}</b>({nft.reviewCount})
              </span>
            </div>
            <div className="hidden items-center justify-between gap-4 border-b border-border pb-3 md:flex">
              <p className="text-xl font-bold text-highlight" data-testid="nft-price">
                {formatEth(edition.priceEth)}
              </p>
              <Rating rating={nft.rating} count={nft.reviewCount} />
            </div>
            <div className="flex flex-col gap-2">
              <h2 className="hidden font-bold md:block">Sobre este NFT:</h2>
              <p className="text-sm leading-[1.6] text-muted-foreground">{nft.description}</p>
            </div>

            <EditionPicker
              editions={nft.editions}
              selected={edition.id}
              onSelect={(id) => {
                setEditionId(id)
                setQuantity(1)
              }}
            />

            <p className="text-sm text-muted-foreground" data-testid="edition-availability">
              {soldOut
                ? 'Edição esgotada.'
                : `${edition.available} disponíve${edition.available === 1 ? 'l' : 'is'} · limite de ${edition.maxPerOrder} por pedido${inCart ? ` · ${inCart} no carrinho` : ''}`}
            </p>

            <div className="hidden flex-wrap items-center justify-between gap-4 md:flex">
              <QuantityStepper label="Quantidade" value={qty} max={Math.max(1, maxQuantity)} onChange={setQuantity} disabled={soldOut || limitReached} />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => add(true)}
                  disabled={soldOut || limitReached || addToCart.isPending}
                  className="h-9 min-w-[116px] rounded-[4px] bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-highlight disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {soldOut ? 'ESGOTADO' : limitReached ? 'LIMITE ATINGIDO' : addToCart.isPending ? 'ADICIONANDO…' : 'COMPRAR'}
                </button>
                <button
                  type="button"
                  aria-pressed={isFavorite}
                  onClick={() => {
                    if (!session) {
                      void navigate({ to: '/login', search: { redirect: `/nfts/${nft.id}` } })
                      return
                    }
                    toggleFavorite.mutate({ nftId: nft.id, favorite: !isFavorite })
                  }}
                  className="flex h-9 items-center gap-2 rounded-[4px] border border-primary px-3 text-sm text-highlight hover:bg-primary/10"
                >
                  <Heart aria-hidden className={cn('size-5', isFavorite && 'fill-highlight')} />
                  {isFavorite ? 'Favoritado' : 'Favoritar'}
                </button>
              </div>
            </div>
            {limitReached && (
              <p role="status" className="text-sm text-highlight">
                Você já tem o máximo permitido desta edição no carrinho.
              </p>
            )}

            <dl className="flex flex-col gap-2 text-sm text-muted-foreground md:text-[15px]">
              <div>
                <dt className="inline">ID do token: </dt>
                <dd className="inline">{nft.tokenId}</dd>
              </div>
              <div>
                <dt className="inline">Coleção: </dt>
                <dd className="inline">{nft.collectionName}</dd>
              </div>
              <div>
                <dt className="inline">Atributos: </dt>
                <dd className="inline">{nft.attributes.join(', ')}</dd>
              </div>
            </dl>
            <div className="hidden items-center gap-3 text-sm font-bold md:flex">
              Compartilhar este NFT:
              <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`} target="_blank" rel="noopener noreferrer" aria-label="Compartilhar no LinkedIn (abre em nova aba)" className="hover:text-highlight">
                <LinkedinIcon className="size-4" />
              </a>
              <a href={`mailto:?subject=${encodeURIComponent(shareText)}&body=${encodeURIComponent(shareUrl)}`} aria-label="Compartilhar por e-mail" className="hover:text-highlight">
                <Mail aria-hidden className="size-4" />
              </a>
              <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`} target="_blank" rel="noopener noreferrer" aria-label="Compartilhar no Twitter (abre em nova aba)" className="hover:text-highlight">
                <TwitterIcon className="size-4" />
              </a>
            </div>
          </div>
        </div>

        <section className="mt-16 hidden md:block" aria-label="Mais informações">
          <div role="tablist" aria-label="Informações do NFT" className="flex gap-8 border-b border-border">
            {(
              [
                ['details', 'Detalhes do NFT'],
                ['reviews', `Avaliações de colecionadores (${nft.reviewCount})`],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                id={`tab-${key}`}
                aria-selected={tab === key}
                aria-controls={`panel-${key}`}
                onClick={() => setTab(key)}
                className={cn('-mb-px border-b-2 pb-2 text-base', tab === key ? 'border-highlight font-bold text-highlight' : 'border-transparent hover:text-highlight')}
              >
                {label}
              </button>
            ))}
          </div>
          {tab === 'details' ? (
            <div id="panel-details" role="tabpanel" aria-labelledby="tab-details" className="flex flex-col gap-4 pt-4 text-sm leading-[1.7] text-muted-foreground">
              {nft.story.map((p) => (
                <p key={p}>{p}</p>
              ))}
              <div>
                <h3 className="font-bold text-foreground">Rede:</h3>
                <p>Cunhado na {networkLabels[nft.network]} com procedência imutável e metadados armazenados no IPFS.</p>
              </div>
              <div>
                <h3 className="font-bold text-foreground">Contrato:</h3>
                <p>Direitos autorais do criador: {nft.royaltyPercent}% nas vendas secundárias, pagos automaticamente pelos mercados compatíveis.</p>
              </div>
              <div>
                <h3 className="font-bold text-foreground">Direitos autorais:</h3>
                <p>
                  {nft.contractAddress.slice(0, 6)}...{nft.contractAddress.slice(-4)} • Contrato inteligente ERC-721 verificado.
                </p>
              </div>
            </div>
          ) : (
            <div id="panel-reviews" role="tabpanel" aria-labelledby="tab-reviews" className="flex flex-col gap-3 pt-4 text-sm text-muted-foreground">
              <Rating rating={nft.rating} count={nft.reviewCount} />
              <p>Os comentários de colecionadores não estão disponíveis nesta demonstração.</p>
            </div>
          )}
        </section>

        <RelatedCarousel nftId={nft.id} title="Mais desta coleção" />
      </div>

      {/* Mobile purchase bar */}
      <div className="fixed inset-x-0 bottom-[72px] z-30 flex flex-col gap-4 rounded-t-[28px] bg-card px-6 pt-5 pb-4 shadow-[0_-8px_24px_rgba(0,0,0,0.4)] md:hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Qtd.</span>
            <QuantityStepper size="sm" label="Quantidade" value={qty} max={Math.max(1, maxQuantity)} onChange={setQuantity} disabled={soldOut || limitReached} />
          </div>
          <p className="text-xl font-bold text-highlight">{formatEth(edition.priceEth)}</p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => add(true)}
            disabled={soldOut || limitReached || addToCart.isPending}
            className="h-14 flex-1 rounded-full bg-gradient-to-r from-highlight to-primary font-bold text-primary-foreground disabled:opacity-50"
          >
            {soldOut ? 'Esgotado' : 'Comprar NFT'}
          </button>
          <button
            type="button"
            aria-label="Adicionar ao carrinho"
            onClick={() => add(false)}
            disabled={soldOut || limitReached || addToCart.isPending}
            className="flex size-14 items-center justify-center rounded-full border border-border text-highlight disabled:opacity-50"
          >
            <ShoppingCart aria-hidden className="size-5" />
          </button>
        </div>
      </div>
    </article>
  )
}
