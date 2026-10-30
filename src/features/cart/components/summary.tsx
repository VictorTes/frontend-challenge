import { useState } from 'react'
import { toast } from 'sonner'
import { ApiError } from '@/shared/api/errors'
import type { Quote } from '@/shared/contracts'
import { formatEth } from '@/shared/lib/money'
import { cn } from '@/shared/lib/utils'
import { Skeleton } from '@/shared/ui/skeleton'
import { useApplyCoupon, useRemoveCoupon } from '../hooks'
import { useLockedSubmit } from '@/shared/hooks/use-locked-submit'

/** Subtotal / discount / fee / total, always from the server quote. */
export function QuoteTotals({
  quote,
  isUpdating,
  className,
  divided,
}: {
  quote: Quote | undefined
  isUpdating?: boolean
  className?: string
  /** Payment layout: a divider above the total. */
  divided?: boolean
}) {
  if (!quote) {
    return (
      <div
        className={cn('flex flex-col gap-3', className)}
        aria-busy="true"
        aria-label="Calculando resumo"
      >
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-6 w-full bg-accent" />
        ))}
      </div>
    )
  }
  return (
    // Figma: labels 15/20, amounts 18/16, discount 15/20, total 16 bold + 18 bold #e89b55.
    <dl
      className={cn(
        'flex flex-col gap-3 text-[15px] leading-5 transition-opacity',
        isUpdating && 'opacity-60',
        className,
      )}
      aria-busy={isUpdating}
      data-testid="quote-totals"
    >
      <div className="flex items-center justify-between gap-4">
        <dt>Subtotal</dt>
        <dd className="text-lg leading-4 whitespace-nowrap" data-testid="quote-subtotal">
          {formatEth(quote.subtotalEth)}
        </dd>
      </div>
      <div className="flex items-center justify-between gap-4">
        {/* The label may wrap and the coupon goes on its own line: in narrow
            summary columns they would otherwise run under the amount. */}
        <dt className="min-w-0 flex-1">
          Desconto do lançamento
          {quote.coupon && (
            <span className="mt-1 block text-xs leading-4 text-highlight">
              {quote.coupon.code} −{quote.coupon.percentOff}%
            </span>
          )}
        </dt>
        <dd className="shrink-0 whitespace-nowrap" data-testid="quote-discount">
          (-) {formatEth(quote.discountEth)}
        </dd>
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-4">
          <dt>Taxa de rede</dt>
          <dd className="text-lg leading-4 whitespace-nowrap" data-testid="quote-fee">
            {formatEth(quote.networkFeeEth)}
          </dd>
        </div>
        <span className="mt-2 self-end text-xs leading-4 text-highlight">Taxa estimada</span>
      </div>
      <div
        className={cn(
          'flex items-center justify-between gap-4',
          divided ? 'border-t border-primary/30 pt-3' : 'mt-3',
        )}
      >
        <dt className="text-base leading-4 font-bold">Total</dt>
        <dd
          className="text-lg leading-4 font-bold whitespace-nowrap text-highlight"
          data-testid="quote-total"
        >
          {formatEth(quote.totalEth)}
        </dd>
      </div>
    </dl>
  )
}

export function CouponForm({ couponCode }: { couponCode: string | null }) {
  const apply = useApplyCoupon()
  const remove = useRemoveCoupon()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = useLockedSubmit(async () => {
    if (!code.trim()) {
      setError('Informe um código promocional.')
      return
    }
    setError(null)
    try {
      await apply.mutateAsync(code.trim())
      setCode('')
      toast.success('Código promocional aplicado.')
    } catch (err) {
      setError(ApiError.from(err).message)
    }
  })

  if (couponCode) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-[4px] border border-primary px-3 py-2">
        <p className="text-sm">
          Código <b className="text-highlight">{couponCode}</b> aplicado
        </p>
        <button
          type="button"
          onClick={() =>
            remove.mutate(undefined, { onError: (err) => toast.error(ApiError.from(err).message) })
          }
          disabled={remove.isPending}
          aria-label={`Remover código promocional ${couponCode}`}
          className="text-sm text-highlight underline disabled:opacity-50"
        >
          Remover
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-2">
      <label htmlFor="coupon" className="text-sm leading-4 font-bold max-md:sr-only">
        Código promocional
      </label>
      <div className="flex h-10 overflow-hidden rounded-[3px] border border-primary max-md:h-[50px] max-md:rounded-full max-md:border-[#3f2319] max-md:bg-[#2a1913]">
        <input
          id="coupon"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Digite o código promocional..."
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'coupon-error' : undefined}
          className="min-w-0 flex-1 bg-transparent px-2 text-xs placeholder:text-subtle focus:outline-none aria-invalid:text-destructive max-md:px-4 max-md:text-sm"
        />
        <button
          type="submit"
          disabled={apply.isPending}
          className="w-[102px] bg-primary text-[15px] font-bold text-primary-foreground hover:bg-highlight disabled:opacity-60 max-md:w-[97px] max-md:rounded-full max-md:bg-gradient-to-r max-md:from-highlight max-md:to-primary"
        >
          {apply.isPending ? 'Aplicando…' : 'Aplicar'}
        </button>
      </div>
      {error && (
        <p id="coupon-error" role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  )
}
