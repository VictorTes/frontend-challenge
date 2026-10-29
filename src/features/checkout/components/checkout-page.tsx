import { Link, useNavigate } from '@tanstack/react-router'
import { AlertTriangle, ChevronLeft, Loader2, Unplug } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAcknowledgePrices, useCart } from '@/features/cart/hooks'
import { CouponForm, QuoteTotals } from '@/features/cart/components/summary'
import { WalletsBadge } from '@/app/layout/footer'
import { api } from '@/shared/api/endpoints'
import { ApiError } from '@/shared/api/errors'
import { qk } from '@/shared/api/query-keys'
import { EmptyState, ErrorState, Spinner } from '@/shared/components/feedback'
import { EnsInput, Field, focusFirstError, issuesToErrors, TextField } from '@/shared/components/form-field'
import {
  buyerInfo,
  networkLabels,
  networks,
  providerLabels,
  walletProviders,
  type BuyerInfo,
  type Network,
  type Quote,
  type Wallet,
  type WalletProvider,
} from '@/shared/contracts'
import { formatEth } from '@/shared/lib/money'
import { session as sessionStorageArea, storageKeys } from '@/shared/lib/storage'
import { cn } from '@/shared/lib/utils'
import { useMediaQuery } from '@/shared/hooks/use-media-query'
import { useSession } from '@/shared/session/session-store'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@/shared/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Skeleton } from '@/shared/ui/skeleton'
import { Textarea } from '@/shared/ui/textarea'
import { staleQuoteFrom, useConnectWallet, useDisconnectWallet, useOrder, usePlaceOrder, useQuote, useWallets } from '../hooks'
import { orderAttempts } from '../order-attempt'

type Draft = BuyerInfo & { network: Network; provider: WalletProvider; walletId: string | null }

/** Quotes are compared by what the buyer pays, not by id (every re-quote has a new id). */
function sameTerms(a: Quote, b: Quote) {
  const terms = (q: Quote) =>
    JSON.stringify([q.lines.map((l) => [l.editionId, l.quantity, l.unitPriceEth]), q.coupon?.code, q.networkFeeEth, q.totalEth, q.issues.length])
  return terms(a) === terms(b)
}

function shortAddress(address: string) {
  return address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address
}

function QuoteLines({ quote }: { quote: Quote | undefined }) {
  if (!quote) return <Skeleton className="h-40 w-full bg-card" />
  return (
    <ul className="flex flex-col gap-3" data-testid="checkout-lines">
      {quote.lines.map((line) => (
        <li key={line.itemId} className="flex min-h-[70px] items-center gap-2 bg-card pr-4 pl-1">
          <img src={line.imageUrl.replace('-640', '-320')} alt="" width={70} height={70} className="size-[70px] shrink-0 rounded-[8px] object-cover" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <p className="truncate text-[15px] leading-4 font-bold">{line.nftName}</p>
            <p className="truncate text-sm leading-4 text-muted-foreground">
              ID do token: {line.tokenId} · {line.editionName}
            </p>
          </div>
          <p className="flex shrink-0 items-baseline gap-5 text-right">
            <span className="text-sm leading-4">(x {line.quantity})</span>
            <span className="text-lg leading-4 font-bold text-highlight">{formatEth(line.lineTotalEth)}</span>
          </p>
        </li>
      ))}
    </ul>
  )
}

/** Field-by-field diff shown when the server re-quotes during confirmation. */
function QuoteChanges({ before, after }: { before: Quote; after: Quote }) {
  const rows: string[] = []
  for (const line of after.lines) {
    const old = before.lines.find((l) => l.itemId === line.itemId)
    if (!old) continue
    if (old.unitPriceEth !== line.unitPriceEth) {
      rows.push(`${line.nftName}: ${formatEth(old.unitPriceEth)} → ${formatEth(line.unitPriceEth)}`)
    }
  }
  for (const issue of after.issues) rows.push(issue.message)
  if (before.discountEth !== after.discountEth) rows.push(`Desconto: ${formatEth(before.discountEth)} → ${formatEth(after.discountEth)}`)
  if (before.networkFeeEth !== after.networkFeeEth) rows.push(`Taxa de rede: ${formatEth(before.networkFeeEth)} → ${formatEth(after.networkFeeEth)}`)
  if (before.totalEth !== after.totalEth) rows.push(`Total: ${formatEth(before.totalEth)} → ${formatEth(after.totalEth)}`)
  return (
    <div role="alert" className="rounded-[4px] border border-highlight bg-band p-3 text-sm">
      <p className="mb-1 flex items-center gap-2 font-bold text-highlight">
        <AlertTriangle aria-hidden className="size-4" /> Os valores do pedido mudaram
      </p>
      <ul className="list-disc pl-5">
        {(rows.length ? rows : ['A cotação anterior expirou.']).map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
      <p className="mt-2">Revise e confirme novamente para continuar.</p>
    </div>
  )
}

function WalletOption({ wallet, checked, onSelect }: { wallet: Wallet; checked: boolean; onSelect: () => void }) {
  return (
    <label
      className={cn(
        'relative flex min-h-[93px] cursor-pointer items-start gap-[19px] rounded-[14px] border bg-card py-[15px] pr-8 pl-[19px] transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring',
        checked ? 'border-primary/60' : 'border-transparent hover:border-border',
      )}
    >
      <input type="radio" name="wallet" className="mt-[24px] size-4 shrink-0 accent-[var(--primary)]" checked={checked} onChange={onSelect} />
      <span className="flex min-w-0 flex-col gap-2">
        <span className="text-base leading-4 font-bold">
          {wallet.nickname}
          <span className="sr-only"> ({wallet.slot === 'primary' ? 'carteira principal' : 'carteira secundária'})</span>
        </span>
        <span className="text-sm leading-[22px] text-muted-foreground">
          <span className="block truncate">{wallet.ensOrSecondary || shortAddress(wallet.address)}</span>
          {wallet.slot === 'primary' ? `Rede principal ${networkLabels[wallet.network]}` : `Rede ${networkLabels[wallet.network]}`}
        </span>
      </span>
      <span aria-hidden className="absolute top-1/2 right-[19px] flex -translate-y-1/2 flex-col gap-[3px]">
        <span className="size-[3px] rounded-full bg-subtle" />
        <span className="size-[3px] rounded-full bg-subtle" />
        <span className="size-[3px] rounded-full bg-subtle" />
      </span>
    </label>
  )
}

const PROVIDER_MARK: Record<WalletProvider, string> = { walletconnect: 'W', metamask: 'M', coinbase: 'C' }
/** Order used by the layout's "Carteira e rede" list. */
const PROVIDER_ORDER: WalletProvider[] = ['walletconnect', 'metamask', 'coinbase']

/** Provider choice. Desktop: 45px bordered rows; mobile: 65px cards with a mark (Figma). */
function ProviderOption({ provider, checked, onSelect }: { provider: WalletProvider; checked: boolean; onSelect: () => void }) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-center transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring',
        'min-h-[65px] gap-[11px] rounded-[15px] bg-card px-[14px] md:min-h-[45px] md:flex-row-reverse md:justify-end md:gap-2 md:rounded-[3px] md:border md:bg-transparent md:px-3',
        checked ? 'md:border-primary' : 'md:border-border md:hover:border-primary/60',
      )}
    >
      <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-[#2f1d15] text-sm font-bold text-highlight md:hidden">
        {PROVIDER_MARK[provider]}
      </span>
      {provider === 'walletconnect' ? (
        <span className="flex-1 text-sm leading-4 md:flex-none">
          <span className="md:hidden">WalletConnect</span>
          <span className="hidden md:inline-flex">
            <WalletsBadge />
            <span className="sr-only">WalletConnect</span>
          </span>
        </span>
      ) : (
        <span className="flex-1 text-sm leading-4 md:flex-none md:text-[15px] md:leading-5">{providerLabels[provider]}</span>
      )}
      <input type="radio" name="provider" className="size-4 shrink-0 accent-[var(--primary)]" checked={checked} onChange={onSelect} />
    </label>
  )
}

export function CheckoutPage() {
  const navigate = useNavigate()
  const session = useSession()!
  const userId = session.user.id
  const formRef = useRef<HTMLFormElement>(null)
  const { data: cart, isPending: cartPending, error: cartError, refetch: refetchCart } = useCart()
  const wallets = useWallets()
  const connect = useConnectWallet()
  const disconnect = useDisconnectWallet()
  const placeOrder = usePlaceOrder()

  const draftKey = storageKeys.checkoutDraft(userId)
  const [draft, setDraft] = useState<Draft>(
    () =>
      sessionStorageArea.get<Draft>(draftKey) ?? {
        displayName: session.user.name,
        username: session.user.username,
        profileName: session.user.username,
        email: session.user.email,
        ensName: session.user.ensName ?? '',
        referralCode: '',
        note: '',
        network: 'ethereum',
        provider: 'metamask',
        walletId: null,
      },
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewedQuote, setReviewedQuote] = useState<Quote | null>(null)
  const [changedFrom, setChangedFrom] = useState<Quote | null>(null)
  const [connected, setConnected] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<ApiError | null>(null)
  const [accepting, setAccepting] = useState(false)
  const [showCoupon, setShowCoupon] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const queryClient = useQueryClient()
  const acknowledge = useAcknowledgePrices()

  // Keep the draft so an expired session can resume checkout after login.
  useEffect(() => sessionStorageArea.set(draftKey, draft), [draftKey, draft])

  const walletList = useMemo(() => wallets.data?.items ?? [], [wallets.data])
  const selectedWallet = walletList.find((w) => w.id === draft.walletId) ?? walletList[0]

  const quote = useQuote(draft.network, cart?.version, Boolean(cart?.items.length))

  // Realtime price/stock changes produce a new quote while reviewing: the
  // buyer must explicitly accept it before confirming.
  const liveQuote = quote.data
  const reviewIsStale = Boolean(
    reviewOpen && reviewedQuote && liveQuote && !quote.isFetching && !sameTerms(liveQuote, reviewedQuote),
  )

  // Recover an attempt left by a refresh or a timed-out request.
  const [storedAttempt, setAttempt] = useState(() => orderAttempts.get(userId))
  const recoveredOrder = useOrder(storedAttempt?.orderId ?? '__none__')
  const recoveredTerminal = Boolean(storedAttempt?.orderId && recoveredOrder.data && recoveredOrder.data.status !== 'pending')
  const attempt = recoveredTerminal ? null : storedAttempt
  useEffect(() => {
    if (!storedAttempt?.orderId || !recoveredOrder.data) return
    if (recoveredOrder.data.status === 'pending') {
      void navigate({ to: '/orders/$orderId', params: { orderId: storedAttempt.orderId } })
    } else {
      orderAttempts.clear(userId)
    }
  }, [storedAttempt?.orderId, navigate, recoveredOrder.data, userId])

  const update = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }))

  // The reviewed terms changed (server rejection or realtime update): the
  // buyer must accept the new values before confirming again.
  const pendingTerms = changedFrom ? reviewedQuote : reviewIsStale ? liveQuote : null
  const needsAcceptance = Boolean(changedFrom || reviewIsStale || (reviewedQuote && reviewedQuote.issues.length > 0))
  const hasStockIssues = Boolean((pendingTerms ?? reviewedQuote)?.issues.some((i) => i.kind !== 'price-changed'))

  /** Accepts current prices on the server, then re-quotes the cart. */
  const acceptLatest = async () => {
    setAccepting(true)
    setSubmitError(null)
    try {
      const acknowledged = await acknowledge.mutateAsync()
      const fresh = await queryClient.fetchQuery({
        queryKey: qk.quote(userId, draft.network, acknowledged.version),
        queryFn: () => api.checkout.quote(draft.network),
      })
      setReviewedQuote(fresh)
      setChangedFrom(null)
    } catch (error) {
      setSubmitError(ApiError.from(error))
    } finally {
      setAccepting(false)
    }
  }

  const openReview = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitError(null)
    const { network: _n, provider: _p, walletId: _w, ...buyer } = draft
    const parsed = buyerInfo.safeParse(buyer)
    const nextErrors = parsed.success ? {} : issuesToErrors(parsed.error.issues)
    if (!selectedWallet) nextErrors.wallet = 'Cadastre uma carteira para continuar.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) {
      setDetailsOpen(true)
      focusFirstError(formRef.current)
      return
    }
    if (!liveQuote) return
    setChangedFrom(null)
    setReviewedQuote(liveQuote)
    setReviewOpen(true)
  }

  const connectWallet = async () => {
    if (!selectedWallet) return
    setSubmitError(null)
    try {
      await connect.mutateAsync({ walletId: selectedWallet.id, provider: draft.provider, network: draft.network })
      setConnected(selectedWallet.id)
    } catch (error) {
      setSubmitError(ApiError.from(error))
    }
  }

  const disconnectWallet = async () => {
    if (!selectedWallet) return
    await disconnect.mutateAsync(selectedWallet.id).catch(() => undefined)
    setConnected(null)
  }

  const confirm = async () => {
    if (!reviewedQuote || !selectedWallet) return
    setSubmitError(null)
    const { network, provider, walletId: _w, ...buyer } = draft
    try {
      const order = await placeOrder.submit({
        quoteId: reviewedQuote.id,
        walletId: selectedWallet.id,
        provider,
        network,
        buyer: buyerInfo.parse(buyer),
      })
      if (!order) return
      sessionStorageArea.remove(draftKey)
      void navigate({ to: '/orders/$orderId', params: { orderId: order.id } })
    } catch (error) {
      const fresh = staleQuoteFrom(error)
      if (fresh) {
        setChangedFrom(reviewedQuote)
        setReviewedQuote(fresh)
        void refetchCart()
        void quote.refetch()
      } else {
        const apiError = ApiError.from(error)
        if (apiError.code === 'WALLET_REJECTED') setConnected(null)
        setSubmitError(apiError)
      }
      setAttempt(orderAttempts.get(userId))
    }
  }

  /** Re-sends the exact payload with the same idempotency key. */
  const retryAttempt = async () => {
    if (!attempt) return
    setSubmitError(null)
    try {
      const order = await placeOrder.submit(attempt.payload)
      if (order) void navigate({ to: '/orders/$orderId', params: { orderId: order.id } })
    } catch (error) {
      setSubmitError(ApiError.from(error))
    }
  }

  if (cartPending) {
    return (
      <div className="container-page py-10" aria-busy="true" aria-label="Carregando pagamento">
        <Skeleton className="h-96 w-full bg-card" />
      </div>
    )
  }
  if (cartError) {
    return (
      <div className="container-page py-10">
        <ErrorState error={cartError} onRetry={() => refetchCart()} />
      </div>
    )
  }
  if (!cart?.items.length && !attempt) {
    return (
      <div className="container-page py-10">
        <EmptyState
          title="Nada para pagar"
          description="Seu carrinho está vazio."
          action={
            <Link to="/" hash="mercado" className="rounded-[4px] bg-primary px-5 py-2 font-bold text-primary-foreground">
              Explorar NFTs
            </Link>
          }
        />
      </div>
    )
  }

  const isConnected = connected === selectedWallet?.id
  const timedOut = submitError && (submitError.kind === 'timeout' || submitError.kind === 'network')
  const blockingIssues = liveQuote?.issues ?? []

  return (
    <div className="pt-8 max-md:px-7 md:container-page">
      {/* Mobile header (frame "Mobile / Pagamento") */}
      <div className="mb-4 flex h-11 items-start gap-6 md:hidden">
        <Link to="/cart" aria-label="Voltar ao carrinho" className="flex size-[35px] shrink-0 items-center justify-center rounded-full border border-border bg-[#2f1d15]">
          <ChevronLeft aria-hidden className="size-5" />
        </Link>
        <h1 className="mt-[9px] text-xl leading-4 font-bold">Pagamento com carteira</h1>
      </div>
      <nav aria-label="Trilha de navegação" className="mb-8 hidden text-[15px] leading-4 font-bold md:block">
        <ol className="flex gap-1.5">
          <li>
            <Link to="/" className="hover:text-highlight">Início</Link>
          </li>
          <li aria-hidden>/</li>
          <li>
            <Link to="/" hash="mercado" className="hover:text-highlight">Mercado</Link>
          </li>
          <li aria-hidden>/</li>
          <li aria-current="page">Pagamento</li>
        </ol>
      </nav>

      {attempt && !attempt.orderId && (
        <div role="status" className="mb-6 flex flex-col gap-3 rounded-[4px] border border-highlight bg-band p-4 md:flex-row md:items-center md:justify-between">
          <p className="text-sm">
            Uma tentativa de compra anterior não recebeu resposta do servidor. Verifique antes de tentar outra vez — a
            verificação reutiliza a mesma solicitação e não cria um pedido duplicado.
          </p>
          <button
            type="button"
            onClick={retryAttempt}
            disabled={placeOrder.isPending}
            className="shrink-0 rounded-[4px] bg-primary px-4 py-2 font-bold text-primary-foreground disabled:opacity-60"
          >
            {placeOrder.isPending ? 'Verificando…' : 'Verificar pedido'}
          </button>
        </div>
      )}

      <form ref={formRef} onSubmit={openReview} noValidate className="flex flex-col gap-8 lg:grid lg:grid-cols-[minmax(0,763fr)_minmax(0,405fr)] lg:gap-10 xl:grid-cols-[763px_405px] xl:justify-between xl:gap-0">
        {/* Collector data: visible on desktop; collapsible on mobile (the mobile frame omits it). */}
        <details
          open={detailsOpen || isDesktop}
          onToggle={(e) => !isDesktop && setDetailsOpen((e.target as HTMLDetailsElement).open)}
          className="group order-2 md:order-none md:contents"
        >
          <summary className="flex cursor-pointer items-center justify-between rounded-[14px] bg-card px-5 py-4 text-base leading-4 font-bold md:hidden">
            Dados do colecionador
            <span className="text-sm font-normal text-highlight group-open:hidden">Editar</span>
          </summary>
          <section aria-labelledby="buyer-title" className="flex flex-col gap-3 pt-4 md:pt-0">
            <h2 id="buyer-title" className="hidden text-[17px] leading-4 font-bold md:block">
              Perfil do colecionador
            </h2>
            {/* Figma: two 370px columns, gap 24; fields 40px tall, 12px apart. */}
            <div className="grid gap-y-3 md:grid-cols-2 md:gap-x-6">
              <TextField label="Nome de exibição" required value={draft.displayName} onChange={(e) => update('displayName', e.target.value)} error={errors.displayName} autoComplete="name" />
              <TextField label="Nome de usuário" required value={draft.username} onChange={(e) => update('username', e.target.value)} error={errors.username} autoComplete="username" />
              <Field label="Rede" required>
                {(a11y) => (
                  <Select value={draft.network} onValueChange={(value) => update('network', value as Network)}>
                    <SelectTrigger {...a11y} className="h-10 w-full rounded-[3px] border-border text-sm">
                      <SelectValue placeholder="Selecione uma rede" />
                    </SelectTrigger>
                    <SelectContent className="border-border bg-card">
                      {networks.map((n) => (
                        <SelectItem key={n} value={n}>
                          {networkLabels[n]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </Field>
              <TextField label="Nome do perfil" required value={draft.profileName} onChange={(e) => update('profileName', e.target.value)} error={errors.profileName} />
              <Field label="Endereço da carteira" required error={errors.wallet}>
                {(a11y) => (
                  <Select
                    value={selectedWallet?.id ?? ''}
                    onValueChange={(id) => {
                      const target = walletList.find((w) => w.id === id)
                      if (target) setDraft((d) => ({ ...d, walletId: target.id, network: target.network, provider: target.provider }))
                    }}
                  >
                    <SelectTrigger {...a11y} className="h-10 w-full rounded-[3px] border-border text-sm">
                      <SelectValue placeholder="Endereço 0x da carteira" />
                    </SelectTrigger>
                    <SelectContent className="border-border bg-card">
                      {walletList.map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          {shortAddress(w.address)} · {w.nickname}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </Field>
              <TextField label="ENS ou carteira secundária (opcional)" readOnly value={selectedWallet?.ensOrSecondary ?? ''} placeholder="ENS ou carteira secundária (opcional)" />
              <Field label="Tipo de carteira" required>
                {(a11y) => (
                  <Select value={draft.provider} onValueChange={(value) => update('provider', value as WalletProvider)}>
                    <SelectTrigger {...a11y} className="h-10 w-full rounded-[3px] border-border text-sm">
                      <SelectValue placeholder="Selecione uma carteira" />
                    </SelectTrigger>
                    <SelectContent className="border-border bg-card">
                      {walletProviders.map((p) => (
                        <SelectItem key={p} value={p}>
                          {providerLabels[p]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </Field>
              <TextField label="Código de indicação" value={draft.referralCode} onChange={(e) => update('referralCode', e.target.value.toUpperCase())} error={errors.referralCode} placeholder="Opcional" />
              <TextField label="E-mail" type="email" required value={draft.email} onChange={(e) => update('email', e.target.value)} error={errors.email} autoComplete="email" />
              <Field label="Nome ENS" error={errors.ensName}>
                {(a11y) => <EnsInput a11y={a11y} value={draft.ensName} onChange={(ensName) => update('ensName', ensName)} />}
              </Field>
            </div>
            {walletList.length > 1 && (
              <label className="mt-3 flex w-fit cursor-pointer items-center gap-2 text-[15px] leading-5">
                <input
                  type="checkbox"
                  className="size-[15px] appearance-none rounded-full border-2 border-primary checked:bg-primary checked:shadow-[inset_0_0_0_2px_var(--background)]"
                  checked={selectedWallet?.slot === 'secondary'}
                  onChange={(e) => {
                    const target = walletList.find((w) => w.slot === (e.target.checked ? 'secondary' : 'primary'))
                    if (target) setDraft((d) => ({ ...d, walletId: target.id, network: target.network, provider: target.provider }))
                  }}
                />
                Usar outra carteira?
              </label>
            )}
            <Field label="Observação do colecionador (opcional)" error={errors.note} className="mt-3">
              {(a11y) => (
                <Textarea {...a11y} value={draft.note} onChange={(e) => update('note', e.target.value)} className="h-[152px] max-w-[350px] resize-none rounded-[3px] border-border" />
              )}
            </Field>
          </section>
        </details>

        <aside aria-labelledby="order-title" className="order-1 flex flex-col gap-3 md:order-none">
          {/* Desktop: order lines and totals (mobile shows them in the review step). */}
          <div className="hidden flex-col gap-3 md:flex">
            <h2 id="order-title" className="text-[17px] leading-4 font-bold">
              Seus NFTs
            </h2>
            <div className="flex justify-between border-b border-primary/30 pb-3 text-base leading-4 font-bold">
              <span>NFTs</span>
              <span>Subtotal</span>
            </div>
            <QuoteLines quote={liveQuote} />
            {showCoupon || cart?.couponCode ? (
              <CouponForm couponCode={cart?.couponCode ?? null} />
            ) : (
              <button type="button" onClick={() => setShowCoupon(true)} className="text-center text-sm leading-4 hover:text-highlight">
                Tem um código promocional? Aplique aqui
              </button>
            )}
            {quote.error && !liveQuote ? (
              <ErrorState error={quote.error} onRetry={() => quote.refetch()} title="Não foi possível calcular o total" className="py-4" />
            ) : (
              <QuoteTotals quote={liveQuote} isUpdating={quote.isFetching} divided />
            )}
          </div>
          <h2 className="sr-only md:hidden">Seu pedido</h2>

          {blockingIssues.length > 0 && (
            <div role="alert" className="text-sm text-destructive">
              <p>Seu carrinho precisa de atenção antes do pagamento:</p>
              <ul className="list-disc pl-5">
                {blockingIssues.map((i) => (
                  <li key={`${i.itemId}-${i.kind}`}>{i.message}</li>
                ))}
              </ul>
              {blockingIssues.every((i) => i.kind === 'price-changed') ? (
                <button
                  type="button"
                  onClick={() => acknowledge.mutate(undefined, { onError: (err) => setSubmitError(ApiError.from(err)) })}
                  disabled={acknowledge.isPending}
                  className="mt-2 rounded-[4px] bg-primary px-3 py-1.5 font-bold text-primary-foreground disabled:opacity-60"
                >
                  Aceitar novos preços
                </button>
              ) : (
                <Link to="/cart" className="underline">
                  Revisar carrinho
                </Link>
              )}
            </div>
          )}

          {/* Mobile: registered wallets as cards ("Carteira conectada"). */}
          <fieldset className="flex flex-col gap-5 md:hidden">
            <legend className="mb-4 flex w-full items-center justify-between text-base leading-4 font-bold">
              Carteira conectada
              <Link to="/account/wallets" className="text-sm text-highlight">
                Trocar carteira
              </Link>
            </legend>
            {wallets.isPending ? (
              <Skeleton className="h-[93px] w-full rounded-[14px] bg-card" />
            ) : walletList.length === 0 ? (
              <p className="text-sm">
                Você ainda não cadastrou carteiras.{' '}
                <Link to="/account/wallets" className="text-highlight underline">
                  Cadastrar carteira
                </Link>
              </p>
            ) : (
              [...walletList].reverse().map((wallet) => (
                <WalletOption
                  key={wallet.id}
                  wallet={wallet}
                  checked={selectedWallet?.id === wallet.id}
                  onSelect={() => setDraft((d) => ({ ...d, walletId: wallet.id, network: wallet.network, provider: wallet.provider }))}
                />
              ))
            )}
          </fieldset>
          {walletList.length === 0 && !wallets.isPending && (
            <p className="hidden text-sm md:block">
              Você ainda não cadastrou carteiras.{' '}
              <Link to="/account/wallets" className="text-highlight underline">
                Cadastrar carteira
              </Link>
            </p>
          )}

          <fieldset className="mt-4 flex flex-col gap-4 md:mt-3">
            <legend className="mb-4 text-base leading-4 font-bold md:mb-5 md:w-full md:text-center md:text-[17px]">Carteira e rede</legend>
            {PROVIDER_ORDER.map((provider) => (
              <ProviderOption key={provider} provider={provider} checked={draft.provider === provider} onSelect={() => update('provider', provider)} />
            ))}
          </fieldset>

          <p className="mt-2 flex items-baseline justify-end gap-7 text-[17px] leading-4 font-bold md:hidden">
            Total: <span className="text-xl text-highlight">{liveQuote ? formatEth(liveQuote.totalEth) : '—'}</span>
          </p>
          <button
            type="submit"
            disabled={!liveQuote || quote.isFetching || blockingIssues.length > 0 || !selectedWallet}
            className="mt-6 h-[60px] rounded-[40px] bg-gradient-to-r from-highlight to-primary text-base font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50 md:mt-3 md:h-[45px] md:rounded-[8px] md:bg-primary md:bg-none md:text-[15px] md:leading-4"
          >
            Confirmar compra
          </button>
        </aside>
      </form>

      <Dialog open={reviewOpen} onOpenChange={(open) => !placeOrder.isPending && setReviewOpen(open)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto border-border bg-card sm:max-w-[560px]">
          <DialogTitle>Revise sua compra</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Confira os itens, a carteira e o total antes de confirmar. Os valores são revalidados pelo servidor.
          </DialogDescription>

          {needsAcceptance && reviewedQuote && (
            <div className="flex flex-col gap-2">
              <QuoteChanges
                before={changedFrom ?? reviewedQuote}
                after={changedFrom ? reviewedQuote : (liveQuote ?? reviewedQuote)}
              />
              {hasStockIssues ? (
                <Link to="/cart" className="self-start text-sm text-highlight underline">
                  Ajustar quantidades no carrinho
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={acceptLatest}
                  disabled={accepting}
                  className="self-start rounded-[4px] bg-primary px-3 py-1.5 font-bold text-primary-foreground disabled:opacity-60"
                >
                  {accepting ? 'Atualizando…' : 'Aceitar novos valores'}
                </button>
              )}
            </div>
          )}

          {reviewedQuote && (
            <>
              <QuoteLines quote={reviewedQuote} />
              <QuoteTotals quote={reviewedQuote} />
            </>
          )}

          {selectedWallet && (
            <div className="flex flex-col gap-2 rounded-[4px] border border-border p-3 text-sm">
              <p>
                Carteira: <b>{selectedWallet.nickname}</b> ({shortAddress(selectedWallet.address)}) via {providerLabels[draft.provider]} na rede{' '}
                {networkLabels[draft.network]}
              </p>
              {isConnected ? (
                <p className="flex items-center justify-between gap-2 text-success">
                  Carteira conectada
                  <button type="button" onClick={disconnectWallet} className="flex items-center gap-1 text-xs text-muted-foreground underline">
                    <Unplug aria-hidden className="size-3" /> Desconectar
                  </button>
                </p>
              ) : (
                <button
                  type="button"
                  onClick={connectWallet}
                  disabled={connect.isPending}
                  className="flex h-10 items-center justify-center gap-2 rounded-[4px] border border-primary text-highlight hover:bg-primary/10 disabled:opacity-60"
                >
                  {connect.isPending ? (
                    <>
                      <Loader2 aria-hidden className="size-4 animate-spin" /> Aguardando aprovação na carteira…
                    </>
                  ) : (
                    `Conectar ${providerLabels[draft.provider]}`
                  )}
                </button>
              )}
            </div>
          )}

          {submitError && (
            <div role="alert" className="flex flex-col gap-2 text-sm text-destructive">
              <p>{submitError.message}</p>
              {timedOut && (
                <p className="text-muted-foreground">
                  Seu pedido pode ter sido criado. Tentar novamente reutiliza a mesma solicitação e não gera cobrança duplicada.
                </p>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <button
              type="button"
              onClick={() => setReviewOpen(false)}
              disabled={placeOrder.isPending}
              className="h-11 rounded-[4px] border border-primary px-4 text-highlight disabled:opacity-50"
            >
              Voltar
            </button>
            <button
              type="button"
              onClick={confirm}
              disabled={!isConnected || placeOrder.isPending || needsAcceptance || !reviewedQuote}
              className="h-11 rounded-[4px] bg-primary px-6 font-bold text-primary-foreground hover:bg-highlight disabled:cursor-not-allowed disabled:opacity-50"
            >
              {placeOrder.isPending ? (
                <Spinner label="Enviando pedido…" className="text-primary-foreground" />
              ) : timedOut ? (
                'Tentar novamente'
              ) : (
                'Confirmar compra'
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
