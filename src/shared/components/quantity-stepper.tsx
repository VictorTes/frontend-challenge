import { Minus, Plus } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

type Props = {
  value: number
  min?: number
  max: number
  onChange: (value: number) => void
  label: string
  disabled?: boolean
  size?: 'sm' | 'md'
}

/** − value + control matching the layout's copper pill buttons. */
export function QuantityStepper({ value, min = 1, max, onChange, label, disabled, size = 'md' }: Props) {
  const button = cn(
    'flex items-center justify-center rounded-full bg-primary text-primary-foreground transition hover:bg-highlight disabled:cursor-not-allowed disabled:bg-accent disabled:text-subtle',
    size === 'md' ? 'size-8' : 'size-6',
  )
  return (
    <div role="group" aria-label={label} className="flex items-center gap-3">
      <button
        type="button"
        className={button}
        onClick={() => onChange(value - 1)}
        disabled={disabled || value <= min}
        aria-label={`Diminuir ${label.toLowerCase()}`}
      >
        <Minus aria-hidden className="size-4" />
      </button>
      <output aria-live="polite" className="min-w-5 text-center text-lg">
        {value}
      </output>
      <button
        type="button"
        className={button}
        onClick={() => onChange(value + 1)}
        disabled={disabled || value >= max}
        aria-label={`Aumentar ${label.toLowerCase()}`}
      >
        <Plus aria-hidden className="size-4" />
      </button>
    </div>
  )
}
