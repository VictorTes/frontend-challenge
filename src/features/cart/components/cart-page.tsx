import { Link, useNavigate } from '@tanstack/react-router'
import { AlertTriangle, ChevronLeft, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useQuote } from '@/features/checkout/hooks'
import { RelatedCarousel } from '@/features/nft/components/related-carousel'
import { ApiError } from '@/shared/api/errors'
import { EmptyState, ErrorState } from '@/shared/components/feedback'
import { QuantityStepper } from '@/shared/components/quantity-stepper'
import type { CartItem, QuoteIssue } from '@/shared/contracts'
import { compareEth, formatEth, mulEth } from '@/shared/lib/money'
import { Skeleton } from '@/shared/ui/skeleton'
import { useAcknowledgePrices, useCart, useRemoveCartItem, useUpdateCartItem } from '../hooks'
import { CouponForm, QuoteTotals } from './summary'
import { useSingleFlight } from '@/shared/hooks/use-locked-submit'

function itemMax(item: CartItem) {
  return Math.max(1, Math.min(item.available, item.maxPerOrder))
}

function ItemIssues({ issues }: { issues: QuoteIssue[] }) {
  if (!issues.length) return null
  return (
    <ul className="flex flex-col gap-1">
      {issues.map((issue) => (
        <li key={issue.kind} className="flex items-start gap-1 text-xs text-destructive">
          <AlertTriangle aria-hidden className="mt-0.5 size-3 shrink-0" /> {issue.message}
        </li>
      ))}
    </ul>
  )
}

const QUANTITY_DEBOUNCE_MS = 350

/**
 * Optimistic quantity: every click updates the number at once and a single
 * PATCH goes out once the clicks stop (rapid "+ + +" is not swallowed by a
 * disabled button). The server response is authoritative; a pending change is
 * flushed if the row unmounts (e.g. the user heads to checkout).
 */
function useQuantityDraft(item: CartItem) {
  const update = useUpdateCartItem()
  const [draft, setDraft] = useState<number | null>(null)
  const pending = useRef<{ quantity: number; timer: number } | null>(null)

  const commit = (quantity: number) => {
    pending.current = null
    update.mutate(
      { itemId: item.id, quantity },
      {
        onError: (err) => toast.error(ApiError.from(err).message),
        // Drop the draft unless the user already moved on to another value.
        onSettled: () => setDraft((current) => (current === quantity ? null : current)),
      },
    )
  }

  // Clicks dispatched before a re-render all see the same rendered value, so
  // each one is applied as a delta on top of the latest requested quantity.
  const rendered = draft ?? item.quantity
  const latest = useRef(rendered)
  useEffect(() => {
    latest.current = rendered
  })
  const change = (next: number) => {
    const upper = Math.max(itemMax(item), item.quantity)
    const quantity = Math.min(upper, Math.max(1, latest.current + (next - rendered)))
    latest.current = quantity
    setDraft(quantity)
    if (pending.current) window.clearTimeout(pending.current.timer)
    pending.current = {
      quantity,
      timer: window.setTimeout(() => commit(quantity), QUANTITY_DEBOUNCE_MS),
    }
  }

  // Latest commit for the unmount flush below.
  const commitRef = useRef(commit)
  useEffect(() => {
    commitRef.current = commit
  })
  useEffect(
    () => () => {
      if (!pending.current) return
      window.clearTimeout(pending.current.timer)
      commitRef.current(pending.current.quantity)
    },
    [],
  )

  return { quantity: rendered, change, saving: update.isPending || draft !== null }
}

function CartRow({ item, issues }: { item: CartItem; issues: QuoteIssue[] }) {
  const remove = useRemoveCartItem()
  const { quantity, change: setQuantity, saving } = useQuantityDraft(item)
  const busy = saving || remove.isPending
  const priceChanged = compareEth(item.unitPriceEth, item.addedPriceEth) !== 0

  const exclusive = useSingleFlight()
  const removeItem = () =>
    exclusive(() =>
      remove.mutateAsync(item.id).catch((err) => toast.error(ApiError.from(err).message)),
    )
  const max = Math.max(quantity > itemMax(item) ? quantity : itemMax(item), 1)
  const oldPrice = priceChanged && (
    <s className="ml-2 text-xs text-subtle">
      <span className="sr-only">antes </span>
      {formatEth(item.addedPriceEth)}
    </s>
  )

  return (
    <li data-testid="cart-item" data-item={item.nftId} aria-busy={busy}>
      {/* Mobile card (Figma: 358×100, radius 14, 100px artwork). */}
      <div className="relative flex min-h-[100px] overflow-hidden rounded-[14px] bg-card md:hidden">
        <img
          src={item.imageUrl.replace('-640', '-320')}
          alt=""
          width={100}
          height={100}
          className="size-[100px] shrink-0 rounded-[14px] object-cover"
        />
        <div className="flex min-w-0 flex-1 flex-col py-[13px] pl-[9px]">
          <p className="truncate pr-9 text-[15px] leading-4 font-bold">{item.nftName}</p>
          <p className="mt-1.5 text-sm leading-4 text-muted-foreground">
            Edição: {item.editionName}
          </p>
          <div className="mt-auto flex flex-wrap items-end justify-between gap-x-2 gap-y-1 pr-4">
            <p className="text-lg leading-4 font-bold text-highlight">
              <span className="sr-only">Total do item: </span>
              {formatEth(mulEth(item.unitPriceEth, quantity))}
              {oldPrice}
            </p>
            <QuantityStepper
              size="circle"
              label={`Quantidade de ${item.nftName}`}
              value={quantity}
              max={max}
              onChange={setQuantity}
              disabled={remove.isPending}
            />
          </div>
        </div>
        {/* The layout overlaps the trash icon with "+"; it sits in the corner here. */}
        <button
          type="button"
          aria-label={`Remover ${item.nftName} do carrinho`}
          onClick={removeItem}
          disabled={busy}
          className="absolute top-2 right-2 flex size-8 items-center justify-center text-highlight hover:text-destructive"
        >
          <Trash2 aria-hidden className="size-[18px]" />
        </button>
      </div>

      {/* Desktop row (Figma: 782×70; columns at 0, 311, 450, 586 and 734). */}
      <div className="hidden min-h-[70px] grid-cols-[minmax(0,311fr)_minmax(0,139fr)_minmax(0,136fr)_minmax(0,148fr)_24px] items-center bg-card pr-6 md:grid">
        <div className="flex min-w-0 items-center gap-4">
          <img
            src={item.imageUrl.replace('-640', '-320')}
            alt=""
            width={70}
            height={70}
            className="size-[70px] shrink-0 rounded-[6px] object-cover"
          />
          <div className="flex min-w-0 flex-col gap-1.5">
            <p className="truncate text-[15px] leading-4 font-bold">{item.nftName}</p>
            <p className="truncate text-sm leading-4 text-muted-foreground">
              ID do token: {item.tokenId} · {item.editionName}
            </p>
          </div>
        </div>
        <p className="text-base leading-4 font-bold text-muted-foreground">
          <span className="sr-only">Preço unitário: </span>
          {formatEth(item.unitPriceEth)}
          {oldPrice}
        </p>
        <QuantityStepper
          size="sm"
          label={`Quantidade de ${item.nftName}`}
          value={quantity}
          max={max}
          onChange={setQuantity}
          disabled={remove.isPending}
        />
        <p className="text-base leading-4 font-bold text-highlight">
          <span className="sr-only">Total do item: </span>
          {formatEth(mulEth(item.unitPriceEth, quantity))}
        </p>
        <button
          type="button"
          aria-label={`Remover ${item.nftName} do carrinho`}
          onClick={removeItem}
          disabled={busy}
          className="flex justify-center text-highlight hover:text-destructive"
        >
          <Trash2 aria-hidden className="size-6" strokeWidth={1.5} />
        </button>
      </div>
      {issues.length > 0 && (
        <div className="pt-2 md:bg-card md:px-4 md:pb-3">
          <ItemIssues issues={issues} />
        </div>
      )}
    </li>
  )
}

export function CartPage() {
  const navigate = useNavigate()
  const { data: cart, error, isPending, refetch } = useCart()
  const quote = useQuote('ethereum', cart?.version, Boolean(cart?.items.length))
  const acknowledge = useAcknowledgePrices()

  const issues = quote.data?.issues ?? []
  const priceIssues = issues.filter((i) => i.kind === 'price-changed')
  const stockIssues = issues.filter((i) => i.kind !== 'price-changed')
  // The checkout is blocked until the quote is current and free of issues.
  const quoteIsCurrent =
    quote.data && cart && quote.data.cartVersion === cart.version && !quote.isFetching
  const canCheckout = Boolean(quoteIsCurrent && issues.length === 0)

  return (
    <div className="pt-8 max-md:px-7 md:container-page">
      <div className="mb-3 flex h-11 items-start gap-4 md:hidden">
        <button
          type="button"
          aria-label="Voltar"
          onClick={() => window.history.back()}
          className="flex size-[35px] items-center justify-center rounded-full border border-border bg-[#2f1d15]"
        >
          <ChevronLeft aria-hidden className="size-5" />
        </button>
        <h1 className="mt-[9px] flex-1 pr-[35px] text-center text-xl leading-4 font-bold">
          Carrinho de NFTs
        </h1>
      </div>
      <nav
        aria-label="Trilha de navegação"
        className="mb-3 hidden text-[15px] leading-4 font-bold md:block"
      >
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
          <li aria-hidden>/</li>
          <li aria-current="page">Carrinho</li>
        </ol>
      </nav>
      <h1 className="sr-only max-md:hidden">Carrinho de NFTs</h1>

      {isPending ? (
        <div
          className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_332px]"
          aria-busy="true"
          aria-label="Carregando carrinho"
        >
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-[70px] w-full bg-card" />
            ))}
          </div>
          <Skeleton className="h-72 w-full bg-card" />
        </div>
      ) : error ? (
        <ErrorState
          error={error}
          onRetry={() => refetch()}
          title="Não foi possível carregar o carrinho"
        />
      ) : !cart || cart.items.length === 0 ? (
        <EmptyState
          title="Seu carrinho está vazio"
          description="Explore o mercado e adicione NFTs ao carrinho."
          action={
            <Link
              to="/"
              hash="mercado"
              className="rounded-[4px] bg-primary px-5 py-2 font-bold text-primary-foreground hover:bg-highlight"
            >
              Explorar NFTs
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,782px)_332px] lg:justify-between lg:gap-0">
          <section aria-label="Itens do carrinho">
            <div
              className="hidden grid-cols-[minmax(0,311fr)_minmax(0,139fr)_minmax(0,136fr)_minmax(0,148fr)_24px] border-b border-primary/30 pr-6 pb-3 text-base leading-4 font-bold md:grid"
              aria-hidden
            >
              <span>NFTs</span>
              <span>Preço</span>
              <span>Edições</span>
              <span>Total</span>
              <span />
            </div>
            {priceIssues.length > 0 && (
              <div
                role="alert"
                className="mt-3 flex flex-col gap-2 rounded-[4px] border border-highlight bg-band p-3 text-sm md:flex-row md:items-center md:justify-between"
              >
                <p>
                  <b>Preços atualizados.</b>{' '}
                  {priceIssues.length === 1
                    ? 'Um item mudou'
                    : `${priceIssues.length} itens mudaram`}{' '}
                  de preço desde que foram adicionados. Revise o resumo antes de continuar.
                </p>
                <button
                  type="button"
                  onClick={() =>
                    acknowledge.mutate(undefined, {
                      onError: (err) => toast.error(ApiError.from(err).message),
                    })
                  }
                  disabled={acknowledge.isPending}
                  className="shrink-0 rounded-[4px] bg-primary px-3 py-1.5 font-bold text-primary-foreground hover:bg-highlight disabled:opacity-60"
                >
                  Aceitar novos preços
                </button>
              </div>
            )}
            <ul className="flex flex-col gap-5 md:mt-3 md:gap-3">
              {cart.items.map((item) => (
                <CartRow
                  key={item.id}
                  item={item}
                  issues={issues.filter((i) => i.itemId === item.id)}
                />
              ))}
            </ul>
          </section>

          {/* Mobile: bottom sheet that sticks while the item list scrolls (frame "Mobile / Carrinho"). */}
          <aside
            aria-labelledby="summary-title"
            className="sticky bottom-0 z-20 -mx-7 flex flex-col gap-6 rounded-t-[28px] bg-card px-6 pt-6 pb-[calc(24px+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(0,0,0,0.35)] md:static md:mx-0 lg:rounded-none lg:bg-transparent lg:p-0 lg:shadow-none"
          >
            <h2
              id="summary-title"
              className="hidden border-b border-primary/30 pb-3 text-lg leading-4 font-bold lg:block"
            >
              Resumo da carteira
            </h2>
            <CouponForm couponCode={cart.couponCode} />
            {quote.error && !quote.data ? (
              <ErrorState
                error={quote.error}
                onRetry={() => quote.refetch()}
                title="Não foi possível calcular o resumo"
                className="py-4"
              />
            ) : (
              <QuoteTotals quote={quote.data} isUpdating={quote.isFetching} />
            )}
            {stockIssues.length > 0 && (
              <p role="alert" className="text-sm text-destructive">
                Ajuste as quantidades destacadas para continuar.
              </p>
            )}
            <button
              type="button"
              disabled={!canCheckout}
              onClick={() => navigate({ to: '/checkout' })}
              className="h-[60px] rounded-[40px] bg-gradient-to-r from-highlight to-primary text-base font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50 lg:-mt-3 lg:h-10 lg:rounded-[3px] lg:bg-primary lg:bg-none lg:text-[15px]"
            >
              Conectar e finalizar
            </button>
            <Link
              to="/"
              hash="mercado"
              className="-mt-3 hidden text-center text-[15px] leading-5 text-highlight hover:underline lg:block"
            >
              Continuar explorando
            </Link>
          </aside>
        </div>
      )}

      {cart?.items[0] && (
        <RelatedCarousel nftId={cart.items[0].nftId} title="Colecionadores também viram" />
      )}
    </div>
  )
}
