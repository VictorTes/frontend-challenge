import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { ApiError } from '@/shared/api/errors'
import type { Quote } from '@/shared/contracts'
import { formatEth } from '@/shared/lib/money'
import { cn } from '@/shared/lib/utils'
import { Skeleton } from '@/shared/ui/skeleton'
import { useApplyCoupon, useRemoveCoupon } from '../hooks'

/** Subtotal / discount / fee / total, always from the server quote. */
export function QuoteTotals({ quote, isUpdating, className }: { quote: Quote | undefined; isUpdating?: boolean; className?: string }) {
  if (!quote) {
    return (
      <div className={cn('flex flex-col gap-3', className)} aria-busy="true" aria-label="Calculando resumo">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-6 w-full bg-accent" />
        ))}
      </div>
    )
  }
  return (
    <dl className={cn('flex flex-col gap-3 transition-opacity', isUpdating && 'opacity-60', className)} aria-busy={isUpdating} data-testid="quote-totals">
      <div className="flex justify-between gap-4">
        <dt>Subtotal</dt>
        <dd className="text-lg md:text-xl" data-testid="quote-subtotal">
          {formatEth(quote.subtotalEth)}
        </dd>
      </div>
      <div className="flex justify-between gap-4">
        <dt>
          Desconto do lançamento
          {quote.coupon && <span className="ml-1 text-xs text-highlight">({quote.coupon.code} −{quote.coupon.percentOff}%)</span>}
        </dt>
        <dd data-testid="quote-discount">(-) {formatEth(quote.discountEth)}</dd>
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex justify-between gap-4">
          <dt>Taxa de rede</dt>
          <dd className="text-lg md:text-xl" data-testid="quote-fee">
            {formatEth(quote.networkFeeEth)}
          </dd>
        </div>
        <span className="self-end text-xs text-highlight">Taxa estimada</span>
      </div>
      <div className="flex justify-between gap-4 border-t border-border pt-4">
        <dt className="font-bold">Total</dt>
        <dd className="text-lg font-bold text-highlight md:text-xl" data-testid="quote-total">
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

  const submit = async (event: FormEvent) => {
    event.preventDefault()
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
  }

  if (couponCode) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-[4px] border border-primary px-3 py-2">
        <p className="text-sm">
          Código <b className="text-highlight">{couponCode}</b> aplicado
        </p>
        <button
          type="button"
          onClick={() => remove.mutate(undefined, { onError: (err) => toast.error(ApiError.from(err).message) })}
          disabled={remove.isPending}
          className="text-sm text-highlight underline disabled:opacity-50"
        >
          Remover
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-2">
      <label htmlFor="coupon" className="text-sm font-bold">
        Código promocional
      </label>
      <div className="flex">
        <input
          id="coupon"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Digite o código promocional..."
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'coupon-error' : undefined}
          className="h-10 min-w-0 flex-1 rounded-l-[2px] border border-primary bg-transparent px-2 text-sm placeholder:text-subtle aria-invalid:border-destructive"
        />
        <button
          type="submit"
          disabled={apply.isPending}
          className="h-10 rounded-r-[2px] bg-primary px-5 font-bold text-primary-foreground hover:bg-highlight disabled:opacity-60"
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
