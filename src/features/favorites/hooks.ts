import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/shared/api/endpoints'
import { errorMessage } from '@/shared/api/errors'
import { qk } from '@/shared/api/query-keys'
import type { Favorites } from '@/shared/contracts'
import { useSession } from '@/shared/session/session-store'

export function useFavorites() {
  const session = useSession()
  const userId = session?.user.id
  return useQuery({
    queryKey: qk.favorites(userId ?? 'anonymous'),
    queryFn: ({ signal }) => api.favorites.list({ signal }),
    enabled: Boolean(userId),
  })
}

export function useIsFavorite(nftId: string) {
  const { data } = useFavorites()
  return data?.nftIds.includes(nftId) ?? false
}

/**
 * Optimistic toggle: the heart flips immediately, and rolls back with an
 * error toast if the server rejects the change.
 */
export function useToggleFavorite() {
  const queryClient = useQueryClient()
  const session = useSession()
  const userId = session?.user.id ?? 'anonymous'
  const key = qk.favorites(userId)

  return useMutation({
    mutationKey: ['toggle-favorite', userId],
    mutationFn: ({ nftId, favorite }: { nftId: string; favorite: boolean }) =>
      favorite ? api.favorites.add(nftId) : api.favorites.remove(nftId),
    onMutate: async ({ nftId, favorite }) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<Favorites>(key)
      queryClient.setQueryData<Favorites>(key, (current) => {
        const ids = new Set(current?.nftIds ?? [])
        if (favorite) ids.add(nftId)
        else ids.delete(nftId)
        return { nftIds: [...ids] }
      })
      return { previous }
    },
    onError: (error, { favorite }, context) => {
      queryClient.setQueryData(key, context?.previous)
      toast.error(
        `${favorite ? 'Não foi possível favoritar' : 'Não foi possível remover dos favoritos'}: ${errorMessage(error)}`,
      )
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  })
}
