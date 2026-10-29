import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/shared/api/endpoints'
import { qk } from '@/shared/api/query-keys'
import type { AvatarInput, PasswordChangeInput, ProfileInput, User, Wallet, WalletInput } from '@/shared/contracts'
import { sessionStore, useSession } from '@/shared/session/session-store'

export function useProfile() {
  const userId = useSession()?.user.id
  return useQuery({
    queryKey: qk.profile(userId ?? 'anonymous'),
    queryFn: ({ signal }) => api.account.profile({ signal }),
    enabled: Boolean(userId),
  })
}

function useApplyUser() {
  const queryClient = useQueryClient()
  return (user: User) => {
    queryClient.setQueryData(qk.profile(user.id), user)
    sessionStore.updateUser(user)
  }
}

export function useUpdateProfile() {
  const applyUser = useApplyUser()
  return useMutation({ mutationFn: (input: ProfileInput) => api.account.updateProfile(input), onSuccess: applyUser })
}

export function useUpdateAvatar() {
  const applyUser = useApplyUser()
  return useMutation({ mutationFn: (input: AvatarInput) => api.account.updateAvatar(input), onSuccess: applyUser })
}

export function useChangePassword() {
  return useMutation({ mutationFn: (input: PasswordChangeInput) => api.account.changePassword(input) })
}

export function useSaveWallet() {
  const queryClient = useQueryClient()
  const userId = useSession()?.user.id ?? 'anonymous'
  return useMutation({
    mutationFn: ({ id, input }: { id: string | null; input: WalletInput }) =>
      id ? api.account.updateWallet(id, input) : api.account.createWallet(input),
    onSuccess: (wallet: Wallet) => {
      queryClient.setQueryData<{ items: Wallet[] }>(qk.wallets(userId), (current) => {
        const items = (current?.items ?? []).filter((w) => w.id !== wallet.id)
        return { items: [...items, wallet].sort((a, b) => a.slot.localeCompare(b.slot)) }
      })
      void queryClient.invalidateQueries({ queryKey: qk.wallets(userId) })
    },
  })
}
