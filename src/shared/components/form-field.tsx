import { ChevronDown, Eye, EyeOff } from 'lucide-react'
import { useId, useState, type ComponentProps, type ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'

type FieldProps = {
  label: string
  required?: boolean
  error?: string
  hint?: string
  className?: string
  children: (props: { id: string; 'aria-invalid'?: true; 'aria-describedby'?: string; required?: boolean }) => ReactNode
}

/** Label + control + error message wired for screen readers. */
export function Field({ label, required, error, hint, className, children }: FieldProps) {
  const id = useId()
  const errorId = `${id}-error`
  const hintId = `${id}-hint`
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined
  return (
    <div className={cn('flex flex-col gap-[13px]', className)}>
      {/* The asterisk is CSS-only: `required` on the control already conveys it. */}
      <Label
        htmlFor={id}
        className={cn('text-[15px] leading-4 font-normal text-foreground', required && "after:-ml-1 after:text-destructive after:content-['*']")}
      >
        {label}
      </Label>
      {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy, required })}
      {hint && !error && (
        <p id={hintId} className="text-xs text-subtle">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

export function TextField({
  label,
  required,
  error,
  hint,
  className,
  ...inputProps
}: Omit<FieldProps, 'children'> & Omit<ComponentProps<'input'>, 'className'>) {
  return (
    <Field label={label} required={required} error={error} hint={hint} className={className}>
      {(a11y) => <Input {...inputProps} {...a11y} />}
    </Field>
  )
}

export function PasswordField({
  label,
  required,
  error,
  hint,
  className,
  ...inputProps
}: Omit<FieldProps, 'children'> & Omit<ComponentProps<'input'>, 'className' | 'type'>) {
  const [visible, setVisible] = useState(false)
  return (
    <Field label={label} required={required} error={error} hint={hint} className={className}>
      {(a11y) => (
        <div className="relative">
          <Input {...inputProps} {...a11y} type={visible ? 'text' : 'password'} className="pr-11" />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
            aria-pressed={visible}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-subtle hover:text-foreground"
          >
            {visible ? <Eye aria-hidden className="size-4" /> : <EyeOff aria-hidden className="size-4" />}
          </button>
        </div>
      )}
    </Field>
  )
}

/** Maps zod issues to a field → first message record. */
export function issuesToErrors(issues: { path: PropertyKey[]; message: string }[]): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const issue of issues) {
    const key = issue.path.map(String).join('.')
    errors[key] ??= issue.message
  }
  return errors
}

/** Moves focus to the first invalid control after a failed submit. */
export function focusFirstError(form: HTMLFormElement | null) {
  requestAnimationFrame(() => {
    form?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
  })
}

/** "Nome ENS": fixed ".eth" chip (drawn as a select in the layout) + name input. */
export function EnsInput({
  a11y,
  value,
  onChange,
}: {
  a11y: { id: string; 'aria-invalid'?: true; 'aria-describedby'?: string }
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="flex gap-2.5">
      <span aria-hidden className="flex h-10 shrink-0 items-center gap-2 rounded-[3px] border border-border px-3 text-base">
        .eth <ChevronDown className="size-4" />
      </span>
      <input
        {...a11y}
        value={value}
        placeholder="Opcional"
        onChange={(e) => onChange(e.target.value.toLowerCase())}
        className="h-10 min-w-0 flex-1 rounded-[3px] border border-border bg-transparent px-3 text-sm placeholder:text-subtle focus-visible:border-ring focus-visible:outline-none aria-invalid:border-destructive"
      />
    </div>
  )
}
