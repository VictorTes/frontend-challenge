import { Link, useNavigate } from '@tanstack/react-router'
import { AlertTriangle, ChevronLeft, Trash2 } from 'lucide-react'
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

function CartRow({ item, issues }: { item: CartItem; issues: QuoteIssue[] }) {
  const update = useUpdateCartItem()
  const remove = useRemoveCartItem()
  const busy = update.isPending || remove.isPending
  const priceChanged = compareEth(item.unitPriceEth, item.addedPriceEth) !== 0

  const setQuantity = (quantity: number) =>
    update.mutate({ itemId: item.id, quantity }, { onError: (err) => toast.error(ApiError.from(err).message) })

  return (
    <li
      data-testid="cart-item"
      data-item={item.nftId}
      aria-busy={busy}
      className="grid grid-cols-[100px_1fr] gap-x-3 gap-y-2 overflow-hidden rounded-2xl bg-card md:grid-cols-[minmax(0,2.4fr)_1fr_1fr_1fr_40px] md:items-center md:gap-4 md:rounded-none md:pr-4"
    >
      <div className="row-span-3 flex items-center gap-4 md:row-span-1">
        <img src={item.imageUrl.replace('-640', '-320')} alt="" width={100} height={100} className="size-[100px] object-cover md:size-[70px]" />
        <div className="hidden min-w-0 md:block">
          <p className="truncate font-bold">{item.nftName}</p>
          <p className="text-sm text-muted-foreground">
            ID do token: {item.tokenId} · Edição {item.editionName}
          </p>
        </div>
      </div>
      <div className="pt-3 md:hidden">
        <p className="font-bold">{item.nftName}</p>
        <p className="text-sm text-muted-foreground">Edição: {item.editionName}</p>
      </div>
      <p className="font-medium text-highlight md:text-lg">
        <span className="sr-only">Preço unitário: </span>
        {formatEth(item.unitPriceEth)}
        {priceChanged && (
          <s className="ml-2 text-xs text-subtle">
            <span className="sr-only">antes </span>
            {formatEth(item.addedPriceEth)}
          </s>
        )}
      </p>
      <div className="flex items-center justify-between gap-2 pr-3 pb-3 md:p-0">
        <QuantityStepper
          size="sm"
          label={`Quantidade de ${item.nftName}`}
          value={item.quantity}
          max={Math.max(item.quantity > itemMax(item) ? item.quantity : itemMax(item), 1)}
          onChange={setQuantity}
          disabled={busy}
        />
        <button
          type="button"
          aria-label={`Remover ${item.nftName} do carrinho`}
          onClick={() => remove.mutate(item.id, { onError: (err) => toast.error(ApiError.from(err).message) })}
          disabled={busy}
          className="text-highlight hover:text-destructive md:hidden"
        >
          <Trash2 aria-hidden className="size-5" />
        </button>
      </div>
      <p className="hidden font-bold text-highlight md:block md:text-lg">
        <span className="sr-only">Total do item: </span>
        {formatEth(mulEth(item.unitPriceEth, item.quantity))}
      </p>
      <button
        type="button"
        aria-label={`Remover ${item.nftName} do carrinho`}
        onClick={() => remove.mutate(item.id, { onError: (err) => toast.error(ApiError.from(err).message) })}
        disabled={busy}
        className="hidden justify-center text-highlight hover:text-destructive md:flex"
      >
        <Trash2 aria-hidden className="size-5" />
      </button>
      {issues.length > 0 && (
        <div className="col-span-2 px-3 pb-3 md:col-span-5 md:px-4">
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
  const quoteIsCurrent = quote.data && cart && quote.data.cartVersion === cart.version && !quote.isFetching
  const canCheckout = Boolean(quoteIsCurrent && issues.length === 0)

  return (
    <div className="container-page pt-6 md:pt-10">
      <div className="mb-6 flex items-center gap-4 md:hidden">
        <button type="button" aria-label="Voltar" onClick={() => window.history.back()} className="flex size-9 items-center justify-center rounded-full bg-card">
          <ChevronLeft aria-hidden className="size-5" />
        </button>
        <h1 className="flex-1 text-center text-xl font-bold">Carrinho de NFTs</h1>
        <span className="size-9" />
      </div>
      <nav aria-label="Trilha de navegação" className="mb-1 hidden text-sm font-bold md:block">
        <ol className="flex gap-2">
          <li>
            <Link to="/" className="hover:text-highlight">Início</Link>
          </li>
          <li aria-hidden>/</li>
          <li>
            <Link to="/" hash="mercado" className="hover:text-highlight">Mercado</Link>
          </li>
          <li aria-hidden>/</li>
          <li aria-current="page">Carrinho</li>
        </ol>
      </nav>
      <h1 className="sr-only max-md:hidden">Carrinho de NFTs</h1>

      {isPending ? (
        <div className="grid gap-8 lg:grid-cols-[1fr_332px]" aria-busy="true" aria-label="Carregando carrinho">
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-[70px] w-full bg-card" />
            ))}
          </div>
          <Skeleton className="h-72 w-full bg-card" />
        </div>
      ) : error ? (
        <ErrorState error={error} onRetry={() => refetch()} title="Não foi possível carregar o carrinho" />
      ) : !cart || cart.items.length === 0 ? (
        <EmptyState
          title="Seu carrinho está vazio"
          description="Explore o mercado e adicione NFTs ao carrinho."
          action={
            <Link to="/" hash="mercado" className="rounded-[4px] bg-primary px-5 py-2 font-bold text-primary-foreground hover:bg-highlight">
              Explorar NFTs
            </Link>
          }
        />
      ) : (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,782px)_332px] lg:justify-between">
          <section aria-label="Itens do carrinho">
            <div className="hidden grid-cols-[minmax(0,2.4fr)_1fr_1fr_1fr_40px] gap-4 border-b border-border pb-3 font-bold md:grid" aria-hidden>
              <span>NFTs</span>
              <span>Preço</span>
              <span>Edições</span>
              <span>Total</span>
              <span />
            </div>
            {priceIssues.length > 0 && (
              <div role="alert" className="mt-3 flex flex-col gap-2 rounded-[4px] border border-highlight bg-band p-3 text-sm md:flex-row md:items-center md:justify-between">
                <p>
                  <b>Preços atualizados.</b> {priceIssues.length === 1 ? 'Um item mudou' : `${priceIssues.length} itens mudaram`} de preço
                  desde que foram adicionados. Revise o resumo antes de continuar.
                </p>
                <button
                  type="button"
                  onClick={() => acknowledge.mutate(undefined, { onError: (err) => toast.error(ApiError.from(err).message) })}
                  disabled={acknowledge.isPending}
                  className="shrink-0 rounded-[4px] bg-primary px-3 py-1.5 font-bold text-primary-foreground hover:bg-highlight disabled:opacity-60"
                >
                  Aceitar novos preços
                </button>
              </div>
            )}
            <ul className="mt-3 flex flex-col gap-3">
              {cart.items.map((item) => (
                <CartRow key={item.id} item={item} issues={issues.filter((i) => i.itemId === item.id)} />
              ))}
            </ul>
          </section>

          <aside aria-labelledby="summary-title" className="flex flex-col gap-5 rounded-t-[28px] bg-card p-6 lg:rounded-none lg:bg-transparent lg:p-0">
            <h2 id="summary-title" className="hidden border-b border-border pb-3 text-lg font-bold lg:block">
              Resumo da carteira
            </h2>
            <CouponForm couponCode={cart.couponCode} />
            {quote.error && !quote.data ? (
              <ErrorState error={quote.error} onRetry={() => quote.refetch()} title="Não foi possível calcular o resumo" className="py-4" />
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
              className="h-12 rounded-full bg-gradient-to-r from-highlight to-primary font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50 lg:h-10 lg:rounded-[4px] lg:bg-primary lg:bg-none lg:font-medium"
            >
              Conectar e finalizar
            </button>
            <Link to="/" hash="mercado" className="text-center text-highlight hover:underline">
              Continuar explorando
            </Link>
          </aside>
        </div>
      )}

      {cart?.items[0] && <RelatedCarousel nftId={cart.items[0].nftId} title="Colecionadores também viram" />}
    </div>
  )
}
