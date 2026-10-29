import { createFileRoute } from '@tanstack/react-router'
import { nftQueryOptions } from '@/features/catalog/hooks'
import { NftDetailPage } from '@/features/nft/components/nft-detail'

export const Route = createFileRoute('/nfts/$nftId')({
  // Start fetching during navigation without blocking it; the page renders
  // skeleton, error and 404 states itself.
  loader: ({ context, params }) => {
    void context.queryClient.prefetchQuery(nftQueryOptions(params.nftId))
  },
  component: NftRoute,
})

function NftRoute() {
  const { nftId } = Route.useParams()
  return <NftDetailPage key={nftId} nftId={nftId} />
}
