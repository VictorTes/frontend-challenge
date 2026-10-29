import { Link, useRouterState } from '@tanstack/react-router'
import { Heart, Home, ScanSearch, ShoppingCart, User } from 'lucide-react'
import { useRef, useState } from 'react'
import { useCartCount } from '@/features/cart/hooks'
import { cn } from '@/shared/lib/utils'
import { useSession } from '@/shared/session/session-store'
import { SearchDialog } from './header'

/** Bottom tab bar from the mobile frames (home, favorites, search, cart, profile). */
export function MobileNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const session = useSession()
  const count = useCartCount()
  const [searchOpen, setSearchOpen] = useState(false)
  const searchButton = useRef<HTMLButtonElement>(null)
  // Like the mobile frames: detail, cart, payment and auth screens have their own
  // back button / bottom bar instead of the tab bar.
  const hidden = ['/nfts/', '/cart', '/checkout', '/login', '/register'].some((p) =>
    pathname.startsWith(p),
  )
  if (hidden) return null
  const item = (active: boolean) =>
    cn(
      'flex size-12 items-center justify-center rounded-full',
      active ? 'text-highlight' : 'text-muted-foreground',
    )

  return (
    <>
      <nav
        aria-label="Navegação inferior"
        className="fixed inset-x-0 bottom-0 z-40 rounded-t-[28px] bg-card pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(0,0,0,0.4)] md:hidden"
      >
        <ul className="flex h-[72px] items-center justify-around px-4">
          <li>
            <Link
              to="/"
              aria-label="Início"
              aria-current={pathname === '/' ? 'page' : undefined}
              className={item(pathname === '/')}
            >
              <Home aria-hidden className="size-6" />
            </Link>
          </li>
          <li>
            <Link
              to="/account/favorites"
              aria-label="Favoritos"
              className={item(pathname.startsWith('/account/favorites'))}
            >
              <Heart aria-hidden className="size-6" />
            </Link>
          </li>
          <li className="-mt-12">
            <button
              ref={searchButton}
              type="button"
              aria-label="Buscar NFTs"
              onClick={() => setSearchOpen(true)}
              className="flex size-16 items-center justify-center rounded-full bg-gradient-to-br from-highlight to-primary text-primary-foreground shadow-lg ring-8 ring-background"
            >
              <ScanSearch aria-hidden className="size-7" />
            </button>
          </li>
          <li>
            <Link
              to="/cart"
              aria-label={`Carrinho, ${count} ${count === 1 ? 'item' : 'itens'}`}
              className={cn(item(pathname === '/cart'), 'relative')}
            >
              <ShoppingCart aria-hidden className="size-6" />
              {count > 0 && (
                <span
                  key={count}
                  aria-hidden
                  className="absolute top-1 right-0.5 animate-in duration-300 zoom-in-50 flex size-[18px] items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground"
                >
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </Link>
          </li>
          <li>
            <Link
              to={session ? '/account/profile' : '/login'}
              aria-label={session ? 'Meu perfil' : 'Entrar'}
              className={item(
                pathname.startsWith('/account') && !pathname.startsWith('/account/favorites'),
              )}
            >
              <User aria-hidden className="size-6" />
            </Link>
          </li>
        </ul>
      </nav>
      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} returnFocusRef={searchButton} />
    </>
  )
}
