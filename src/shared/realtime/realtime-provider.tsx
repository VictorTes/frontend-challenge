import { useQueryClient } from '@tanstack/react-query'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { useSession } from '@/shared/session/session-store'
import { RealtimeClient, type ConnectionStatus } from './realtime-client'

const RealtimeContext = createContext<ConnectionStatus>('connecting')

/**
 * One socket per session: when the user logs in, out or switches account the
 * previous socket and its listeners are disposed and a new one is created
 * with the new credentials.
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const session = useSession()
  const token = session?.token ?? null
  const userId = session?.user.id ?? null
  const [status, setStatus] = useState<ConnectionStatus>('connecting')

  useEffect(() => {
    let client: RealtimeClient | null = null
    let disposed = false
    // Loaded lazily: it keeps socket.io out of the critical path and makes sure
    // engine.io captures the WebSocket constructor after MSW patched it.
    void import('socket.io-client').then(({ io }) => {
      if (disposed) return
      client = new RealtimeClient(io, queryClient, userId, token)
      client.onStatus(setStatus)
      client.onNotice((notice) => {
        if (notice.inCart) {
          toast.info(`${notice.name} teve preço ou disponibilidade alterados. O resumo do carrinho foi atualizado.`, {
            id: `nft-changed-${notice.nftId}`,
          })
        }
      })
    })
    return () => {
      disposed = true
      client?.dispose()
    }
  }, [queryClient, token, userId])

  return <RealtimeContext.Provider value={status}>{children}</RealtimeContext.Provider>
}

export function useRealtimeStatus() {
  return useContext(RealtimeContext)
}
