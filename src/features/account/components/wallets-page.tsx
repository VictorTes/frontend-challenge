import { useRef, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { useWallets } from '@/features/checkout/hooks'
import { ApiError } from '@/shared/api/errors'
import { ErrorState } from '@/shared/components/feedback'
import { EnsInput, Field, focusFirstError, issuesToErrors, TextField } from '@/shared/components/form-field'
import {
  networkLabels,
  networks,
  providerLabels,
  walletInput,
  walletProviders,
  type Network,
  type Wallet,
  type WalletInput,
  type WalletProvider,
  type WalletSlot,
} from '@/shared/contracts'
import { useSession } from '@/shared/session/session-store'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Skeleton } from '@/shared/ui/skeleton'
import { useSaveWallet } from '../hooks'

type FormValues = Omit<WalletInput, 'network' | 'provider'> & { network: Network | ''; provider: WalletProvider | '' }

function emptyValues(slot: WalletSlot, defaults: Partial<FormValues>): FormValues {
  return {
    slot,
    displayName: '',
    nickname: '',
    network: '',
    profileName: '',
    address: '',
    ensOrSecondary: '',
    provider: '',
    referralCode: '',
    email: '',
    ensName: '',
    ...defaults,
  }
}

function fromWallet(wallet: Wallet): FormValues {
  const { id: _i, updatedAt: _u, ...rest } = wallet
  return rest
}

function WalletForm({
  slot,
  wallet,
  initial,
  onDone,
}: {
  slot: WalletSlot
  wallet: Wallet | null
  initial: FormValues
  onDone?: () => void
}) {
  const save = useSaveWallet()
  const formRef = useRef<HTMLFormElement>(null)
  const [values, setValues] = useState<FormValues>(initial)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const set = (key: keyof FormValues) => (e: { target: { value: string } }) => setValues((v) => ({ ...v, [key]: e.target.value }))
  const prefix = `wallet-${slot}`

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setFormError(null)
    const parsed = walletInput.safeParse({ ...values, slot })
    if (!parsed.success) {
      setErrors(issuesToErrors(parsed.error.issues))
      focusFirstError(formRef.current)
      return
    }
    setErrors({})
    try {
      const saved = await save.mutateAsync({ id: wallet?.id ?? null, input: parsed.data })
      setValues(fromWallet(saved))
      toast.success(slot === 'primary' ? 'Carteira principal salva.' : 'Carteira secundária salva.')
      onDone?.()
    } catch (err) {
      const apiError = ApiError.from(err)
      setErrors(apiError.fieldErrors)
      setFormError(apiError.message)
      focusFirstError(formRef.current)
    }
  }

  return (
    <form ref={formRef} onSubmit={submit} noValidate aria-label={slot === 'primary' ? 'Carteira principal' : 'Carteira secundária'} className="flex flex-col gap-6" data-testid={`${prefix}-form`}>
      <div className="grid gap-5 md:grid-cols-2 md:gap-x-7">
        <TextField label="Nome de exibição" required value={values.displayName} onChange={set('displayName')} error={errors.displayName} />
        <TextField label="Apelido da carteira" required value={values.nickname} onChange={set('nickname')} error={errors.nickname} />
        <Field label="Rede" required error={errors.network}>
          {(a11y) => (
            <Select value={values.network} onValueChange={(v) => setValues((s) => ({ ...s, network: v as Network }))}>
              <SelectTrigger {...a11y} className="h-10 w-full rounded-[3px] border-border">
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
        <TextField label="Nome do perfil" required value={values.profileName} onChange={set('profileName')} error={errors.profileName} />
        <TextField
          label="Endereço da carteira"
          required
          placeholder={values.network === 'solana' ? 'Endereço Solana (base58)' : 'Endereço 0x da carteira'}
          value={values.address}
          onChange={set('address')}
          error={errors.address}
          spellCheck={false}
          autoComplete="off"
        />
        <TextField label="ENS ou carteira secundária (opcional)" value={values.ensOrSecondary} onChange={set('ensOrSecondary')} error={errors.ensOrSecondary} />
        <Field label="Tipo de carteira" required error={errors.provider}>
          {(a11y) => (
            <Select value={values.provider} onValueChange={(v) => setValues((s) => ({ ...s, provider: v as WalletProvider }))}>
              <SelectTrigger {...a11y} className="h-10 w-full rounded-[3px] border-border">
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
        <TextField label="Código de indicação" value={values.referralCode} onChange={(e) => setValues((v) => ({ ...v, referralCode: e.target.value.toUpperCase() }))} error={errors.referralCode} placeholder="Opcional" />
        <TextField label="E-mail" type="email" required value={values.email} onChange={set('email')} error={errors.email} />
        <Field label="Nome ENS" error={errors.ensName}>
          {(a11y) => <EnsInput a11y={a11y} value={values.ensName} onChange={(ensName) => setValues((v) => ({ ...v, ensName }))} />}
        </Field>
      </div>
      {formError && (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      )}
      <button type="submit" disabled={save.isPending} className="h-10 w-fit rounded-[2px] bg-primary px-2 text-sm font-bold text-primary-foreground hover:bg-highlight disabled:opacity-60">
        {save.isPending ? 'Salvando…' : 'Salvar carteira'}
      </button>
    </form>
  )
}

export function WalletsPage() {
  const session = useSession()!
  const wallets = useWallets()
  const [addingPrimary, setAddingPrimary] = useState(false)
  const [addingSecondary, setAddingSecondary] = useState(false)
  const [sameAsPrimary, setSameAsPrimary] = useState(false)

  if (wallets.isPending) return <Skeleton className="h-[500px] w-full bg-card" aria-label="Carregando carteiras" />
  if (wallets.error) return <ErrorState error={wallets.error} onRetry={() => wallets.refetch()} />

  const primary = wallets.data.items.find((w) => w.slot === 'primary') ?? null
  const secondary = wallets.data.items.find((w) => w.slot === 'secondary') ?? null
  const defaults = { email: session.user.email, displayName: session.user.name, profileName: session.user.username }

  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="primary-title" className="flex flex-col gap-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 id="primary-title" className="text-base font-bold">
              Carteira principal
            </h1>
            <p className="text-sm text-muted-foreground">Estas carteiras ficam disponíveis no pagamento e para receber NFTs comprados.</p>
          </div>
          {!primary && !addingPrimary && (
            <button type="button" onClick={() => setAddingPrimary(true)} className="font-bold text-highlight hover:underline">
              Adicionar
            </button>
          )}
        </div>
        {primary ? (
          <WalletForm key={primary.id} slot="primary" wallet={primary} initial={fromWallet(primary)} />
        ) : addingPrimary ? (
          <WalletForm slot="primary" wallet={null} initial={emptyValues('primary', defaults)} onDone={() => setAddingPrimary(false)} />
        ) : (
          <p className="text-sm text-muted-foreground">Você ainda não adicionou uma carteira principal.</p>
        )}
      </section>

      <section aria-labelledby="secondary-title" className="flex flex-col gap-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 id="secondary-title" className="text-lg font-bold">
              Carteira secundária
            </h2>
            {!secondary && !addingSecondary && (
              <p className="text-sm text-muted-foreground">Você ainda não adicionou uma carteira secundária.</p>
            )}
          </div>
          {!secondary && (
            <div className="flex items-center gap-3">
              {primary && (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={sameAsPrimary} onChange={(e) => setSameAsPrimary(e.target.checked)} />
                  Igual à carteira principal
                </label>
              )}
              {!addingSecondary && (
                <button type="button" onClick={() => setAddingSecondary(true)} className="font-bold text-highlight hover:underline">
                  Adicionar
                </button>
              )}
            </div>
          )}
        </div>
        {secondary ? (
          <WalletForm key={secondary.id} slot="secondary" wallet={secondary} initial={fromWallet(secondary)} />
        ) : addingSecondary ? (
          <WalletForm
            key={sameAsPrimary ? 'copy' : 'blank'}
            slot="secondary"
            wallet={null}
            // "Same as primary" copies the profile data; the address must differ.
            initial={emptyValues('secondary', sameAsPrimary && primary ? { ...fromWallet(primary), slot: 'secondary', address: '', nickname: '' } : defaults)}
            onDone={() => setAddingSecondary(false)}
          />
        ) : null}
      </section>
    </div>
  )
}
