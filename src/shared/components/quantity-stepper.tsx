import { Minus, Plus } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { cn } from '@/shared/lib/utils'

type Props = {
  value: number
  min?: number
  max: number
  onChange: (value: number) => void
  label: string
  disabled?: boolean
  /** md: 33×50 pills (detail desktop); sm: 20×30 pills; circle: 24px dark circles (mobile cart). */
  size?: 'sm' | 'md' | 'circle'
}

/** − value + control with the layout's copper pill buttons. */
export function QuantityStepper({
  value,
  min = 1,
  max,
  onChange,
  label,
  disabled,
  size = 'md',
}: Props) {
  // Clicks dispatched before a re-render all see the same `value`; stepping
  // from the last emitted value makes each of them count.
  const latest = useRef(value)
  // Every render resyncs with the parent (which may clamp or reject a value).
  useEffect(() => {
    latest.current = value
  })
  const step = (delta: number) => {
    const next = Math.min(max, Math.max(min, latest.current + delta))
    if (next === latest.current) return
    latest.current = next
    onChange(next)
  }
  const button = cn(
    'flex items-center justify-center rounded-full border transition disabled:cursor-not-allowed',
    size === 'circle'
      ? 'size-6 border-border bg-[#2f1d15] text-foreground hover:border-primary disabled:text-input'
      : 'border-background bg-primary text-primary-foreground hover:bg-highlight disabled:bg-accent disabled:text-subtle',
    size === 'md' ? 'h-[50px] w-[33px]' : size === 'sm' ? 'h-[30px] w-5' : '',
  )
  const icon = size === 'md' ? 'size-5' : size === 'sm' ? 'size-4' : 'size-3.5'
  return (
    <div
      role="group"
      aria-label={label}
      className={cn('flex items-center', size === 'circle' ? 'gap-[13px]' : 'gap-3')}
    >
      <button
        type="button"
        className={button}
        onClick={() => step(-1)}
        disabled={disabled || value <= min}
        aria-label={`Diminuir ${label.toLowerCase()}`}
      >
        <Minus aria-hidden className={icon} strokeWidth={2.5} />
      </button>
      <output
        aria-live="polite"
        className={cn(
          'min-w-3 text-center',
          size === 'md'
            ? 'text-xl leading-7'
            : size === 'sm'
              ? 'text-lg leading-[25px] font-medium'
              : 'text-base leading-[22px]',
        )}
      >
        {value}
      </output>
      <button
        type="button"
        className={button}
        onClick={() => step(1)}
        disabled={disabled || value >= max}
        aria-label={`Aumentar ${label.toLowerCase()}`}
      >
        <Plus aria-hidden className={icon} strokeWidth={2.5} />
      </button>
    </div>
  )
}
