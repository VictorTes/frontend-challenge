import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { Heart, LogIn, LogOut, Search, ShoppingCart, User, Wallet } from 'lucide-react'
import { useRef, useState, type FormEvent, type RefObject } from 'react'
import { useLogout } from '@/features/auth/hooks'
import { useCartCount } from '@/features/cart/hooks'
import { cn } from '@/shared/lib/utils'
import { useRealtimeStatus } from '@/shared/realtime/realtime-provider'
import { useSession } from '@/shared/session/session-store'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'
import { Input } from '@/shared/ui/input'
import { notAvailable } from './out-of-scope'

const MARKET_PATHS = ['/nfts', '/cart', '/checkout', '/orders']

export function Logo({ className }: { className?: string }) {
  return (
    <Link to="/" className={cn('text-sm font-bold tracking-[0.12em] text-foreground', className)} aria-label="Kurio, página inicial">
      KURIO
    </Link>
  )
}

function NavItem({ label, active, to, onClick }: { label: string; active?: boolean; to?: string; onClick?: () => void }) {
  const className = cn(
    'relative py-2 text-base transition-colors hover:text-highlight',
    active ? 'font-bold text-highlight after:absolute after:inset-x-0 after:-bottom-[14px] after:h-0.5 after:bg-highlight' : 'text-foreground',
  )
  if (to) {
    return (
      <Link to={to} hash={to === '/' && label === 'Mercado' ? 'mercado' : undefined} className={className} aria-current={active ? 'page' : undefined}>
        {label}
      </Link>
    )
  }
  return (
    <button type="button" className={className} onClick={onClick}>
      {label}
    </button>
  )
}

export function SearchDialog({
  open,
  onOpenChange,
  returnFocusRef,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Opened without a DialogTrigger, so focus is restored to this element on close. */
  returnFocusRef: RefObject<HTMLElement | null>
}) {
  const navigate = useNavigate()
  const [term, setTerm] = useState('')
  const submit = (event: FormEvent) => {
    event.preventDefault()
    onOpenChange(false)
    void navigate({ to: '/', search: { q: term.trim() || undefined }, hash: 'mercado' })
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="border-border bg-card"
        onCloseAutoFocus={(event) => {
          if (!returnFocusRef.current) return
          event.preventDefault()
          returnFocusRef.current.focus()
        }}
      >
        <DialogTitle>Buscar NFTs</DialogTitle>
        <DialogDescription className="text-muted-foreground">Pesquise por nome, coleção ou ID do token.</DialogDescription>
        <form onSubmit={submit} role="search" className="flex gap-2">
          <Input
            autoFocus
            type="search"
            aria-label="Termo de busca"
            placeholder="Explorar coleções"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
          />
          <button type="submit" className="rounded-[4px] bg-primary px-4 font-bold text-primary-foreground hover:bg-highlight">
            Buscar
          </button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ConnectionBadge() {
  const status = useRealtimeStatus()
  if (status !== 'reconnecting') return null
  return (
    <span role="status" className="rounded-full bg-band px-2 py-0.5 text-xs text-highlight">
      Reconectando…
    </span>
  )
}

export function Header() {
  const session = useSession()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const cartCount = useCartCount()
  const logout = useLogout()
  const navigate = useNavigate()
  const [searchOpen, setSearchOpen] = useState(false)
  const searchButton = useRef<HTMLButtonElement>(null)
  const isMarket = MARKET_PATHS.some((p) => pathname.startsWith(p))

  return (
    <header className="hidden md:block">
      <div className="container-page flex h-[68px] items-center justify-between border-b border-border">
        <Logo />
        <nav aria-label="Principal" className="flex items-center gap-9">
          <NavItem label="Início" to="/" active={pathname === '/'} />
          <NavItem label="Mercado" to="/" active={isMarket} />
          <NavItem label="Criadores" onClick={() => notAvailable('A página de criadores')} />
          <NavItem label="Aprenda" onClick={() => notAvailable('A área editorial')} />
        </nav>
        <div className="flex items-center gap-5">
          <ConnectionBadge />
          <button ref={searchButton} type="button" aria-label="Buscar" onClick={() => setSearchOpen(true)} className="rounded p-1 hover:text-highlight">
            <Search aria-hidden className="size-6" />
          </button>
          <Link to="/cart" aria-label={`Carrinho, ${cartCount} ${cartCount === 1 ? 'item' : 'itens'}`} className="relative rounded p-1 hover:text-highlight">
            <ShoppingCart aria-hidden className="size-6" />
            {cartCount > 0 && (
              <span aria-hidden className="absolute -top-1 -right-2 flex size-[18px] items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
                {cartCount > 99 ? '99+' : cartCount}
              </span>
            )}
          </Link>
          {session ? (
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-2 rounded-[4px] border border-primary px-3 py-1.5 text-highlight hover:bg-primary/10">
                {session.user.avatarUrl ? (
                  <img src={session.user.avatarUrl} alt="" className="size-6 rounded-full object-cover" />
                ) : (
                  <User aria-hidden className="size-5" />
                )}
                <span className="max-w-32 truncate">{session.user.username}</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 border-border bg-card">
                <DropdownMenuLabel className="truncate text-muted-foreground">{session.user.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => navigate({ to: '/account/profile' })}>
                  <User aria-hidden /> Meu perfil
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => navigate({ to: '/account/wallets' })}>
                  <Wallet aria-hidden /> Carteiras
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => navigate({ to: '/account/favorites' })}>
                  <Heart aria-hidden /> Lista de interesse
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() =>
                    logout.mutate(undefined, { onSettled: () => void navigate({ to: '/' }) })
                  }
                >
                  <LogOut aria-hidden /> Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link
              to="/login"
              search={{ redirect: pathname === '/login' ? undefined : pathname }}
              className="flex items-center gap-1.5 rounded-[4px] bg-primary px-3 py-1.5 font-medium text-primary-foreground hover:bg-highlight"
            >
              <LogIn aria-hidden className="size-5" /> Entrar
            </Link>
          )}
        </div>
      </div>
      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} returnFocusRef={searchButton} />
    </header>
  )
}
