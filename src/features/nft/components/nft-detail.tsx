import { Link, useNavigate, useRouter } from '@tanstack/react-router'
import { ChevronDown, ChevronLeft, Heart, Mail, Search, ShoppingCart, Star, X } from 'lucide-react'
import { useRef, useState, type KeyboardEvent } from 'react'
import { toast } from 'sonner'
import { NotFoundPage } from '@/app/not-found'
import { useAddToCart, useCart } from '@/features/cart/hooks'
import { useNft } from '@/features/catalog/hooks'
import { useIsFavorite, useToggleFavorite } from '@/features/favorites/hooks'
import { ApiError, errorMessage } from '@/shared/api/errors'
import { LinkedinIcon, TwitterIcon } from '@/shared/components/brand-icons'
import { ErrorState } from '@/shared/components/feedback'
import { NftImage } from '@/shared/components/nft-image'
import { QuantityStepper } from '@/shared/components/quantity-stepper'
import { networkLabels, type Edition, type NftDetail } from '@/shared/contracts'
import { compareEth, formatEth } from '@/shared/lib/money'
import { prefersReducedMotion } from '@/shared/lib/motion'
import { cn } from '@/shared/lib/utils'
import { useSession } from '@/shared/session/session-store'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/shared/ui/dialog'
import { Skeleton } from '@/shared/ui/skeleton'
import { RelatedCarousel } from './related-carousel'
import { useSingleFlight } from '@/shared/hooks/use-locked-submit'

function Stars({ rating, className }: { rating: number; className?: string }) {
  return (
    <span aria-hidden className={cn('flex gap-1', className)}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={cn(
            'size-[15px]',
            i < Math.round(rating) ? 'fill-star text-star' : 'text-subtle',
          )}
        />
      ))}
    </span>
  )
}

/** Edition chips (Figma: 28px pills, #3f2319 border; selected #d28a4c border, #e89b55 text). */
function EditionPicker({
  editions,
  selected,
  onSelect,
  idPrefix,
}: {
  editions: Edition[]
  selected: string
  onSelect: (id: string) => void
  idPrefix: string
}) {
  return (
    <fieldset className="flex flex-col gap-2 md:gap-3">
      <legend className="mb-2 text-[15px] leading-4 font-bold md:mb-3">Edição:</legend>
      <div className="flex flex-wrap gap-3 md:gap-1.5" role="radiogroup" aria-label="Edição">
        {editions.map((edition) => {
          const soldOut = edition.available === 0
          const active = edition.id === selected
          return (
            <label
              key={edition.id}
              className={cn(
                'flex h-7 min-w-9 cursor-pointer items-center justify-center rounded-full border px-1.5 text-sm leading-4 transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring',
                active
                  ? 'border-primary font-medium text-highlight'
                  : 'border-border text-muted-foreground hover:border-primary',
                soldOut && 'cursor-not-allowed line-through opacity-50',
              )}
            >
              <input
                type="radio"
                name={`${idPrefix}-edition`}
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

function ShareLinks({ nft }: { nft: NftDetail }) {
  const shareUrl = typeof window !== 'undefined' ? window.location.href : ''
  const shareText = `${nft.name} na Kurio`
  return (
    <div className="flex items-center gap-2 text-[15px] leading-4 font-bold">
      Compartilhar este NFT:
      <a
        href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Compartilhar no LinkedIn (abre em nova aba)"
        className="hover:text-highlight"
      >
        <LinkedinIcon className="size-[18px]" />
      </a>
      <a
        href={`mailto:?subject=${encodeURIComponent(shareText)}&body=${encodeURIComponent(shareUrl)}`}
        aria-label="Compartilhar por e-mail"
        className="hover:text-highlight"
      >
        <Mail aria-hidden className="size-[18px]" />
      </a>
      <a
        href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Compartilhar no Twitter (abre em nova aba)"
        className="hover:text-highlight"
      >
        <TwitterIcon className="size-[18px]" />
      </a>
    </div>
  )
}

/** "Detalhes do NFT" / "Avaliações" tabs; `idPrefix` keeps ids unique when both layouts render. */
function InfoTabs({
  nft,
  idPrefix,
  className,
}: {
  nft: NftDetail
  idPrefix: string
  className?: string
}) {
  const [tab, setTab] = useState<'details' | 'reviews'>('details')

  // WAI-ARIA tabs pattern: arrows/Home/End move selection and focus between tabs.
  const onTabKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const keys = ['details', 'reviews'] as const
    const current = keys.indexOf(tab)
    const next =
      event.key === 'ArrowRight'
        ? (current + 1) % keys.length
        : event.key === 'ArrowLeft'
          ? (current - 1 + keys.length) % keys.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? keys.length - 1
              : -1
    if (next < 0) return
    event.preventDefault()
    setTab(keys[next]!)
    document.getElementById(`${idPrefix}-tab-${keys[next]}`)?.focus()
  }

  return (
    <section className={className} aria-label="Mais informações">
      <div
        role="tablist"
        aria-label="Informações do NFT"
        onKeyDown={onTabKeyDown}
        className="flex gap-8 overflow-x-auto border-b border-primary/30 [scrollbar-width:none]"
      >
        {(
          [
            ['details', 'Detalhes do NFT'],
            [
              'reviews',
              <>
                {/* Short label on phones so the tab is not cut off. */}
                <span className="md:hidden">Avaliações ({nft.reviewCount})</span>
                <span className="hidden md:inline">
                  Avaliações de colecionadores ({nft.reviewCount})
                </span>
              </>,
            ],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            id={`${idPrefix}-tab-${key}`}
            aria-selected={tab === key}
            aria-controls={`${idPrefix}-panel-${key}`}
            tabIndex={tab === key ? 0 : -1}
            onClick={() => setTab(key)}
            className={cn(
              '-mb-px shrink-0 border-b-2 pb-[10px] text-[17px] leading-4 max-md:text-[15px]',
              tab === key
                ? 'border-primary font-bold text-highlight'
                : 'border-transparent hover:text-highlight',
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'details' ? (
        <div
          id={`${idPrefix}-panel-details`}
          role="tabpanel"
          aria-labelledby={`${idPrefix}-tab-details`}
          className="flex flex-col pt-3 text-sm leading-6 text-muted-foreground"
        >
          <p>{nft.story[0]}</p>
          <p className="mt-6">{nft.story[1]}</p>
          <h3 className="mt-3 font-bold text-foreground">Rede:</h3>
          <p>
            Cunhado na {networkLabels[nft.network]} com procedência imutável e metadados armazenados
            no IPFS.
          </p>
          <h3 className="mt-3 font-bold text-foreground">Contrato:</h3>
          <p>
            {nft.contractAddress.slice(0, 6)}...{nft.contractAddress.slice(-4)} • Contrato
            inteligente ERC-721 verificado.
          </p>
          <h3 className="mt-3 font-bold text-foreground">Direitos autorais:</h3>
          <p>
            Direitos autorais do criador: {nft.royaltyPercent}% nas vendas secundárias, pagos
            automaticamente pelos mercados compatíveis.
          </p>
        </div>
      ) : (
        <div
          id={`${idPrefix}-panel-reviews`}
          role="tabpanel"
          aria-labelledby={`${idPrefix}-tab-reviews`}
          className="flex flex-col gap-3 pt-3 text-sm leading-6 text-muted-foreground"
        >
          <p className="flex items-center gap-2">
            <Stars rating={nft.rating} /> {nft.rating.toFixed(1)} de 5 · {nft.reviewCount}{' '}
            avaliações
          </p>
          <p>Os comentários de colecionadores não estão disponíveis nesta demonstração.</p>
        </div>
      )}
    </section>
  )
}

/**
 * Mobile gallery: a native scroll-snap track, so the photo follows the finger
 * and settles on the nearest image; the dots follow the swipe and still jump
 * to an image when tapped.
 */
function MobileGallery({
  nft,
  active,
  onActive,
}: {
  nft: NftDetail
  active: number
  onActive: (i: number) => void
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const touching = useRef(false)
  const settleTimer = useRef<number | undefined>(undefined)
  // Photo a dot or arrow key is scrolling to. While it is set, the positions the
  // animation passes through must not change the active photo: two quick taps
  // would otherwise start the second move from the photo being left behind.
  const target = useRef<number | null>(null)
  const images = nft.images.length > 0 ? nft.images : [nft.imageUrl]

  const scrollToPhoto = (index: number) => {
    const track = trackRef.current
    track?.scrollTo({
      left: index * track.clientWidth,
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    })
  }

  // Native snapping can leave a short, slow drag resting between two photos.
  // Once the finger is up and scrolling stops, finish the move to the nearest one
  // (or to the photo a dot/arrow asked for, if that animation was cut short).
  const settle = () => {
    window.clearTimeout(settleTimer.current)
    settleTimer.current = window.setTimeout(() => {
      const track = trackRef.current
      if (!track || touching.current || track.clientWidth === 0) return
      const index = target.current ?? Math.round(track.scrollLeft / track.clientWidth)
      if (Math.abs(track.scrollLeft - index * track.clientWidth) > 1) scrollToPhoto(index)
    }, 150)
  }

  const onScroll = () => {
    const track = trackRef.current
    if (!track || track.clientWidth === 0) return
    if (target.current !== null) {
      if (Math.abs(track.scrollLeft - target.current * track.clientWidth) <= 1) target.current = null
    } else {
      const index = Math.round(track.scrollLeft / track.clientWidth)
      if (index !== active && index >= 0 && index < images.length) onActive(index)
    }
    settle()
  }

  const goTo = (index: number) => {
    target.current = index
    onActive(index)
    scrollToPhoto(index)
  }

  const startTouch = () => {
    touching.current = true
    target.current = null // the finger takes over from any dot/arrow animation
  }

  return (
    <>
      <div
        ref={trackRef}
        // A scrollable region must be reachable by keyboard; arrows change photo.
        tabIndex={0}
        role="region"
        aria-roledescription="carrossel"
        aria-label={`Fotos de ${nft.name}`}
        onKeyDown={(event) => {
          const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
          if (!step) return
          event.preventDefault()
          const from = target.current ?? active
          goTo(Math.min(images.length - 1, Math.max(0, from + step)))
        }}
        onScroll={onScroll}
        onTouchStart={startTouch}
        onTouchEnd={() => {
          touching.current = false
          settle()
        }}
        onTouchCancel={() => {
          touching.current = false
          settle()
        }}
        className="mt-2 flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain rounded-[24px] outline-none focus-visible:ring-2 focus-visible:ring-highlight focus-visible:ring-offset-2 focus-visible:ring-offset-background [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {images.map((src, i) => (
          <div key={src} className="w-full shrink-0 snap-center snap-always">
            <NftImage
              src={src}
              alt={i === 0 ? nft.name : `${nft.name}, imagem ${i + 1} de ${images.length}`}
              sizes="calc(100vw - 56px)"
              priority={i === 0}
              media="mobile"
              // Only the visible photo takes part in the shared artwork transition.
              className={cn('aspect-auto h-[356px] rounded-[24px]', i === active && 'vt-hero')}
            />
          </div>
        ))}
      </div>
      {images.length > 1 && (
        <div
          className="absolute bottom-[52px] left-1/2 flex -translate-x-1/2 items-center"
          role="group"
          aria-label="Galeria"
        >
          {images.map((src, i) => (
            <button
              key={src}
              type="button"
              aria-label={`Imagem ${i + 1} de ${images.length}`}
              aria-pressed={i === active}
              onClick={() => goTo(i)}
              // 24px hit area around the 7px dot (WCAG 2.5.8 target size).
              className="flex h-6 min-w-6 items-center justify-center"
            >
              <span
                className={cn(
                  'block h-[7px] rounded-full bg-primary transition-[width] duration-300',
                  i === active ? 'w-7' : 'w-[7px]',
                )}
              />
            </button>
          ))}
        </div>
      )}
    </>
  )
}

/** Desktop gallery: 100px thumbnails + 444px framed main image (Figma "Product Images"). */
function Gallery({
  nft,
  active,
  onActive,
}: {
  nft: NftDetail
  active: number
  onActive: (i: number) => void
}) {
  const [zoom, setZoom] = useState(false)
  const image = nft.images[active] ?? nft.imageUrl
  return (
    <div className="hidden gap-7 md:flex">
      <ul aria-label="Galeria" className="flex shrink-0 flex-col gap-4">
        {nft.images.map((src, i) => (
          <li key={src}>
            <button
              type="button"
              aria-label={`Imagem ${i + 1} de ${nft.images.length}`}
              aria-pressed={i === active}
              onClick={() => onActive(i)}
              className={cn(
                'block size-[100px] overflow-hidden rounded-[8px] border',
                i === active ? 'border-primary' : 'border-transparent opacity-85 hover:opacity-100',
              )}
            >
              <img
                src={src.replace('-640', '-320')}
                alt=""
                width={100}
                height={100}
                // Lazy: not fetched on phones, where the desktop gallery is hidden.
                loading="lazy"
                className="size-full object-cover"
              />
            </button>
          </li>
        ))}
      </ul>
      <div className="relative size-[444px] shrink-0 self-start rounded-[6px] bg-card p-4 max-lg:size-[340px]">
        <NftImage
          src={image}
          alt={nft.name}
          sizes="(min-width: 1024px) 412px, 308px"
          priority
          media="desktop"
          className="vt-hero size-full rounded-[18px]"
        />
        <button
          type="button"
          aria-label="Ampliar imagem"
          onClick={() => setZoom(true)}
          className="absolute top-[13px] right-3 flex size-[30px] items-center justify-center rounded-full border border-border bg-[#2f1d15] hover:text-highlight"
        >
          <Search aria-hidden className="size-4" />
        </button>
      </div>
      <Dialog open={zoom} onOpenChange={setZoom}>
        <DialogContent
          showCloseButton={false}
          className="max-w-[min(92vw,720px)] border-border bg-card p-4"
        >
          {/* The default X sat on the artwork's light background and disappeared:
              a light chip with a black X reads on any image. */}
          <DialogClose
            aria-label="Fechar imagem ampliada"
            className="absolute top-6 right-6 z-10 flex size-9 items-center justify-center rounded-full bg-white/90 text-black shadow-md transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <X aria-hidden className="size-5" strokeWidth={2.5} />
          </DialogClose>
          <DialogTitle className="sr-only">{nft.name}</DialogTitle>
          <DialogDescription className="sr-only">Imagem ampliada</DialogDescription>
          <img
            src={image.replace('-640', '-960')}
            alt={nft.name}
            width={960}
            height={960}
            className="w-full rounded-lg"
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}

function DetailSkeleton() {
  return (
    <div
      className="container-page grid gap-8 py-8 md:grid-cols-[573px_1fr]"
      aria-busy="true"
      aria-label="Carregando NFT"
    >
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
  const exclusive = useSingleFlight()
  const [editionId, setEditionId] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [moreOpen, setMoreOpen] = useState(false)
  const [activeImage, setActiveImage] = useState(0)

  // Default to the cheapest edition with stock (the price shown on the card);
  // re-pick automatically if the chosen one sells out.
  const edition = nft
    ? (nft.editions.find((e) => e.id === editionId && e.available > 0) ??
      nft.editions
        .filter((e) => e.available > 0)
        .sort((a, b) => compareEth(a.priceEth, b.priceEth))[0] ??
      nft.editions[0]!)
    : undefined
  const inCart = cart?.items.find((i) => i.editionId === edition?.id)?.quantity ?? 0
  const maxQuantity = edition
    ? Math.max(0, Math.min(edition.available, edition.maxPerOrder) - inCart)
    : 0

  // Clamp to what can still be bought (stock or cart may change in realtime).
  const qty = Math.min(quantity, Math.max(1, maxQuantity))

  if (isPending) return <DetailSkeleton />
  if (error) {
    if (ApiError.from(error).status === 404) {
      return (
        <NotFoundPage
          title="NFT não encontrado"
          description="Este NFT não existe ou foi removido do mercado."
        />
      )
    }
    return (
      <div className="container-page py-10">
        <ErrorState
          error={error}
          onRetry={() => refetch()}
          title="Não foi possível carregar este NFT"
        />
      </div>
    )
  }
  if (!nft || !edition) return null

  const soldOut = edition.available === 0
  const limitReached = !soldOut && maxQuantity === 0
  const buyDisabled = soldOut || limitReached || addToCart.isPending

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

  const favorite = () => {
    if (!session) {
      toast.message('Entre para salvar favoritos.')
      void navigate({ to: '/login', search: { redirect: `/nfts/${nft.id}` } })
      return
    }
    toggleFavorite.mutate({ nftId: nft.id, favorite: !isFavorite })
  }

  const selectEdition = (id: string) => {
    setEditionId(id)
    setQuantity(1)
  }

  const availability = soldOut
    ? 'Edição esgotada.'
    : `${edition.available} disponíve${edition.available === 1 ? 'l' : 'is'} · limite de ${edition.maxPerOrder} por pedido${inCart ? ` · ${inCart} no carrinho` : ''}`

  return (
    <article>
      {/* ---------- Mobile (frame "Mobile / Detalhes do NFT") ---------- */}
      <div className="md:hidden">
        <div className="relative px-7 pt-[23px]">
          <div className="flex items-center justify-between">
            <button
              type="button"
              aria-label="Voltar"
              onClick={() =>
                window.history.length > 1 ? router.history.back() : navigate({ to: '/' })
              }
              className="flex size-[35px] items-center justify-center rounded-full border border-border bg-[#2f1d15]"
            >
              <ChevronLeft aria-hidden className="size-5" />
            </button>
            <button
              type="button"
              aria-pressed={isFavorite}
              aria-label={
                isFavorite ? `Remover ${nft.name} dos favoritos` : `Favoritar ${nft.name}`
              }
              onClick={favorite}
              className="flex size-[35px] items-center justify-center rounded-full border border-border bg-[#2f1d15]"
            >
              <Heart
                aria-hidden
                className={cn('size-5', isFavorite && 'fill-highlight text-highlight')}
              />
            </button>
          </div>
          <MobileGallery nft={nft} active={activeImage} onActive={setActiveImage} />
        </div>
        <section
          aria-labelledby="nft-title-mobile"
          className="relative -mt-[30px] flex flex-col gap-3 rounded-t-[28px] bg-card px-6 pt-8 pb-6"
        >
          <div className="flex items-center justify-between gap-3">
            <h1 id="nft-title-mobile" className="text-xl leading-4 font-bold">
              {nft.name}
            </h1>
            <span className="flex h-[27px] items-center gap-1 rounded-[32px] border border-primary px-1.5 text-sm leading-4">
              <Star aria-hidden className="size-3.5 fill-star text-star" />
              <span className="font-medium">{nft.rating.toFixed(1)}</span>
              <span className="text-muted-foreground">({nft.reviewCount})</span>
              <span className="sr-only">avaliações</span>
            </span>
          </div>
          <p className={cn('text-sm leading-6 text-muted-foreground', !moreOpen && 'line-clamp-3')}>
            {nft.description}
          </p>
          <EditionPicker
            editions={nft.editions}
            selected={edition.id}
            onSelect={selectEdition}
            idPrefix="m"
          />
          <dl className="flex flex-col gap-3 text-[15px] leading-5 text-subtle">
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
          <p className="text-xs text-subtle">{availability}</p>
          {/* Not in the mobile frame: the details the desktop shows stay reachable on phones. */}
          <button
            type="button"
            aria-expanded={moreOpen}
            aria-controls="nft-more-mobile"
            onClick={() => setMoreOpen((open) => !open)}
            className="flex items-center gap-1 self-start text-sm font-bold text-highlight"
          >
            {moreOpen ? 'Ver menos detalhes' : 'Ver mais detalhes'}
            <ChevronDown
              aria-hidden
              className={cn('size-4 transition-transform', moreOpen && 'rotate-180')}
            />
          </button>
          {moreOpen && (
            <div
              id="nft-more-mobile"
              className="flex animate-in flex-col gap-5 duration-300 fade-in-0 slide-in-from-top-2"
            >
              <ShareLinks nft={nft} />
              <InfoTabs nft={nft} idPrefix="m" />
            </div>
          )}
        </section>
        {/* Buy bar (Figma: 164px at the bottom). Sticky, not fixed: it stays on screen
            while the NFT is in view and never covers the footer at the end of the page. */}
        <div className="sticky bottom-0 z-30 flex flex-col gap-5 rounded-t-[28px] bg-card px-6 pt-5 pb-[calc(36px+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(0,0,0,0.35)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[15px] leading-4 font-medium text-muted-foreground">Qtd.</span>
              <QuantityStepper
                size="sm"
                label="Quantidade"
                value={qty}
                max={Math.max(1, maxQuantity)}
                onChange={setQuantity}
                disabled={soldOut || limitReached}
              />
            </div>
            <p className="text-xl leading-4 font-bold text-highlight">
              {formatEth(edition.priceEth)}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => exclusive(() => add(true))}
              disabled={buyDisabled}
              className="h-[60px] w-[196px] rounded-[40px] bg-gradient-to-r from-highlight to-primary text-base leading-5 font-bold text-primary-foreground disabled:opacity-50"
            >
              {soldOut ? 'Esgotado' : 'Comprar NFT'}
            </button>
            <button
              type="button"
              aria-label="Adicionar ao carrinho"
              onClick={() => exclusive(() => add(false))}
              disabled={buyDisabled}
              className="flex size-[60px] items-center justify-center rounded-[40px] border border-border bg-[#2f1d15] text-highlight disabled:opacity-50"
            >
              <ShoppingCart aria-hidden className="size-5" />
            </button>
          </div>
        </div>
      </div>

      {/* ---------- Desktop (frame "Desktop / Detalhes do NFT") ---------- */}
      <div className="container-page hidden pt-8 md:block">
        <nav aria-label="Trilha de navegação" className="text-[15px] leading-4 font-bold">
          <ol className="flex gap-1.5">
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

        <div className="mt-3 flex gap-8">
          <Gallery nft={nft} active={activeImage} onActive={setActiveImage} />

          <div className="flex min-w-0 flex-1 flex-col gap-5">
            <div className="flex flex-col gap-3 border-b border-primary/30 pb-3">
              <h1 className="text-[28px] leading-[37px] font-bold">{nft.name}</h1>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p
                  className="text-[22px] leading-4 font-bold text-highlight"
                  data-testid="nft-price"
                >
                  {formatEth(edition.priceEth)}
                </p>
                <p className="flex items-center gap-1 text-[15px] leading-5">
                  <span className="sr-only">Nota {nft.rating.toFixed(1)} de 5.</span>
                  <Stars rating={nft.rating} />
                  {nft.reviewCount} avaliações de colecionadores
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <h2 className="text-[15px] leading-4 font-bold">Sobre este NFT:</h2>
              <p className="max-w-[574px] text-sm leading-6 text-muted-foreground">
                {nft.description}
              </p>
            </div>

            <EditionPicker
              editions={nft.editions}
              selected={edition.id}
              onSelect={selectEdition}
              idPrefix="d"
            />

            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <QuantityStepper
                  label="Quantidade"
                  value={qty}
                  max={Math.max(1, maxQuantity)}
                  onChange={setQuantity}
                  disabled={soldOut || limitReached}
                />
                <p
                  className="max-w-[150px] text-xs leading-4 text-subtle"
                  data-testid="edition-availability"
                >
                  {availability}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => exclusive(() => add(true))}
                  disabled={buyDisabled}
                  className="h-10 w-[130px] shrink-0 rounded-[6px] bg-primary px-3 whitespace-nowrap text-sm leading-5 font-bold text-primary-foreground hover:bg-highlight disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {soldOut
                    ? 'ESGOTADO'
                    : limitReached
                      ? 'LIMITE'
                      : addToCart.isPending
                        ? 'ADICIONANDO…'
                        : 'COMPRAR'}
                </button>
                <button
                  type="button"
                  aria-pressed={isFavorite}
                  onClick={favorite}
                  className="flex h-10 w-[130px] shrink-0 items-center justify-center gap-2 rounded-[6px] border border-primary px-3 text-sm leading-5 font-medium whitespace-nowrap text-highlight hover:bg-primary/10"
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

            <div className="flex flex-col gap-3">
              <dl className="flex flex-col gap-3 text-[15px] leading-5 text-subtle">
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
              <ShareLinks nft={nft} />
            </div>
          </div>
        </div>

        <InfoTabs nft={nft} idPrefix="d" className="mt-24" />
      </div>

      {/* Shared by both layouts (the mobile frame has none; kept so phones see it too). */}
      <div className="container-page">
        <RelatedCarousel nftId={nft.id} title="Mais desta coleção" />
      </div>
    </article>
  )
}
