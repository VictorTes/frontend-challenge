import { Link, useNavigate } from '@tanstack/react-router'
import { ExternalLink, Loader2, X, XCircle } from 'lucide-react'
import { useEffect } from 'react'
import { NotFoundPage } from '@/app/not-found'
import { useOrder } from '@/features/checkout/hooks'
import { orderAttempts } from '@/features/checkout/order-attempt'
import { ApiError } from '@/shared/api/errors'
import { ErrorState } from '@/shared/components/feedback'
import { networkLabels, providerLabels, type Order } from '@/shared/contracts'
import { formatEth } from '@/shared/lib/money'
import { useRealtimeStatus } from '@/shared/realtime/realtime-provider'
import { useSession } from '@/shared/session/session-store'
import { Skeleton } from '@/shared/ui/skeleton'

function ThankYouIcon() {
  return (
    <svg aria-hidden viewBox="0 0 64 80" className="h-20 w-16 text-primary" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M6 34 L32 14 L58 34 V74 H6 Z" strokeLinejoin="round" />
      <path d="M6 34 L32 54 L58 34" strokeLinejoin="round" />
      <path d="M6 74 L26 54 M58 74 L38 54" />
      <rect x="14" y="4" width="36" height="34" rx="2" fill="var(--card)" />
      <text x="32" y="18" textAnchor="middle" fontSize="10" fontWeight="700" fill="currentColor" stroke="none" fontFamily="Roboto Mono, monospace">
        THANK
      </text>
      <text x="32" y="30" textAnchor="middle" fontSize="10" fontWeight="700" fill="currentColor" stroke="none" fontFamily="Roboto Mono, monospace">
        YOU
      </text>
    </svg>
  )
}

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

/** Layout format: "29 Jul, 2026". */
function formatDate(iso: string) {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]}, ${d.getFullYear()}`
}

function shortHash(hash: string) {
  return `${hash.slice(0, 6)}…${hash.slice(-4)}`.toUpperCase().replace('0X', '0x')
}

/** Receipt: renders only the order snapshot, never the live catalog. */
function Receipt({ order }: { order: Order }) {
  const navigate = useNavigate()
  return (
    <section
      aria-labelledby="receipt-title"
      className="relative mx-auto flex w-full max-w-[578px] flex-col border-b-[10px] border-primary bg-card"
      data-testid="order-confirmed"
    >
      {/* Figma "Confirmação de Pedido": 578px card, 10px copper bottom border. */}
      <button
        type="button"
        aria-label="Fechar e voltar ao início"
        onClick={() => navigate({ to: '/' })}
        className="absolute top-4 right-4 rounded p-1 text-highlight hover:bg-accent"
      >
        <X aria-hidden className="size-5" />
      </button>
      <div className="flex flex-col items-center gap-3 px-6 pt-6 pb-5">
        <ThankYouIcon />
        <h1 id="receipt-title" className="text-center font-bold text-muted-foreground">
          Seus NFTs agora estão na sua carteira
        </h1>
      </div>
      <dl className="grid grid-cols-2 gap-y-3 border-y border-primary px-9 py-4 text-sm leading-[19px] whitespace-nowrap sm:flex sm:justify-between sm:divide-x sm:divide-primary">
        <div className="sm:pr-4">
          <dt className="font-bold text-muted-foreground">ID da transação</dt>
          <dd className="text-muted-foreground" data-testid="tx-hash">{order.txHash ? shortHash(order.txHash) : '—'}</dd>
        </div>
        <div className="sm:px-4">
          <dt className="text-muted-foreground">Data</dt>
          <dd className="text-muted-foreground">{formatDate(order.updatedAt)}</dd>
        </div>
        <div className="sm:px-4">
          <dt className="text-muted-foreground">Total</dt>
          <dd className="text-muted-foreground">{formatEth(order.totalEth)}</dd>
        </div>
        <div className="sm:pl-4">
          <dt className="font-bold text-muted-foreground">Carteira</dt>
          <dd className="text-muted-foreground">{providerLabels[order.wallet.provider]}</dd>
        </div>
      </dl>
      <div className="flex flex-col gap-4 px-6 py-6 sm:px-11">
        <h2 className="font-bold">Detalhes da transação</h2>
        <table className="w-full text-left">
          <caption className="sr-only">Itens comprados</caption>
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className="pb-2 font-bold">NFTs</th>
              <th scope="col" className="pb-2 text-center font-bold">Edições</th>
              <th scope="col" className="pb-2 text-right font-bold">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {order.lines.map((line) => (
              <tr key={line.itemId} data-testid="receipt-line">
                <td className="py-2">
                  <div className="flex items-center gap-3">
                    <img src={line.imageUrl.replace('-640', '-320')} alt="" width={64} height={64} className="size-16 rounded object-cover" />
                    <div>
                      <p className="font-bold">{line.nftName}</p>
                      <p className="text-sm text-muted-foreground">
                        ID do token: {line.tokenId}
                        <span className="sr-only">, edição {line.editionName}, {formatEth(line.unitPriceEth)} cada</span>
                      </p>
                    </div>
                  </div>
                </td>
                <td className="py-2 text-center text-sm">(x {line.quantity})</td>
                <td className="py-2 text-right font-bold text-highlight">{formatEth(line.lineTotalEth)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="ml-auto flex w-full max-w-[320px] flex-col gap-2">
          {order.coupon && (
            <div className="flex justify-between">
              <dt>Desconto ({order.coupon.code})</dt>
              <dd>(-) {formatEth(order.discountEth)}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt>Taxa de rede</dt>
            <dd className="text-lg">{formatEth(order.networkFeeEth)}</dd>
          </div>
          <div className="flex justify-between border-b border-border pb-2">
            <dt className="font-bold">Total</dt>
            <dd className="text-lg font-bold text-highlight" data-testid="receipt-total">
              {formatEth(order.totalEth)}
            </dd>
          </div>
        </dl>
        <p className="text-center text-sm leading-[1.7] text-muted-foreground">
          Transação confirmada na {networkLabels[order.network]}. A propriedade foi transferida para sua carteira conectada e registrada
          na rede.<span className="sr-only"> Simulação: referência e link de exploração fictícios.</span>
        </p>
        {order.explorerUrl && (
          <a
            href={order.explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mx-auto inline-flex items-center gap-2 rounded-[4px] bg-primary px-4 py-3 font-bold text-primary-foreground hover:bg-highlight"
          >
            Ver no Etherscan <ExternalLink aria-hidden className="size-4" />
            <span className="sr-only">(abre em nova aba; link simulado)</span>
          </a>
        )}
      </div>
    </section>
  )
}

function Pending({ order }: { order: Order }) {
  const realtime = useRealtimeStatus()
  return (
    <section role="status" aria-live="polite" className="mx-auto flex max-w-[578px] flex-col items-center gap-4 bg-card px-6 py-12 text-center" data-testid="order-pending">
      <Loader2 aria-hidden className="size-10 animate-spin text-highlight" />
      <h1 className="text-xl font-bold">Aguardando confirmação do pagamento</h1>
      <p className="text-sm text-muted-foreground">
        Pedido <b>{order.id}</b> de {formatEth(order.totalEth)} enviado pela carteira {order.wallet.nickname}. Você pode recarregar ou
        fechar esta página: o pedido continua sendo processado e não será cobrado novamente.
      </p>
      {realtime === 'reconnecting' && (
        <p className="text-sm text-highlight">Conexão em tempo real interrompida. Tentando reconectar…</p>
      )}
    </section>
  )
}

function Declined({ order }: { order: Order }) {
  return (
    <section role="alert" className="mx-auto flex max-w-[578px] flex-col items-center gap-4 bg-card px-6 py-12 text-center" data-testid="order-declined">
      <XCircle aria-hidden className="size-10 text-destructive" />
      <h1 className="text-xl font-bold">Pagamento recusado</h1>
      <p className="text-sm text-muted-foreground">
        {order.declineReason ?? 'A transação não foi concluída.'} Nenhum valor foi cobrado e seus itens continuam no carrinho.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link to="/checkout" className="rounded-[4px] bg-primary px-5 py-2 font-bold text-primary-foreground hover:bg-highlight">
          Tentar novamente
        </Link>
        <Link to="/cart" className="rounded-[4px] border border-primary px-5 py-2 text-highlight">
          Ver carrinho
        </Link>
      </div>
    </section>
  )
}

export function OrderPage({ orderId }: { orderId: string }) {
  const userId = useSession()!.user.id
  const { data: order, error, isPending, refetch } = useOrder(orderId)

  // Terminal states end the checkout attempt bound to this order.
  useEffect(() => {
    if (order && order.status !== 'pending' && orderAttempts.get(userId)?.orderId === order.id) {
      orderAttempts.clear(userId)
    }
  }, [order, userId])

  if (isPending) {
    return (
      <div className="container-page py-16">
        <Skeleton className="mx-auto h-96 max-w-[578px] bg-card" aria-label="Carregando pedido" />
      </div>
    )
  }
  if (error) {
    const status = ApiError.from(error).status
    if (status === 404 || status === 403) {
      return <NotFoundPage title="Pedido não encontrado" description="Este pedido não existe ou não pertence à sua conta." />
    }
    return (
      <div className="container-page py-16">
        <ErrorState error={error} onRetry={() => refetch()} title="Não foi possível consultar o pedido" />
      </div>
    )
  }
  if (!order) return null

  if (order.status === 'confirmed') {
    // Like the Figma frame: the receipt covers the page (no header); the route
    // still supports direct access and refresh.
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-background px-4 pt-16 pb-10 md:pt-[166px]">
        <Receipt order={order} />
      </div>
    )
  }
  return (
    <div className="container-page py-10 md:py-24">
      {order.status === 'declined' ? <Declined order={order} /> : <Pending order={order} />}
    </div>
  )
}
