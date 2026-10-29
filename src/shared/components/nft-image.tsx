import { cn } from '@/shared/lib/utils'

const WIDTHS = [320, 640, 960] as const

/** Builds a srcset from `/assets/nfts/<art>-640.webp` style URLs. */
function srcSetFor(url: string): string | undefined {
  const match = url.match(/^(.*)-(\d+)\.webp$/)
  if (!match) return undefined
  return WIDTHS.map((w) => `${match[1]}-${w}.webp ${w}w`).join(', ')
}

type Props = {
  src: string
  alt: string
  sizes: string
  className?: string
  priority?: boolean
}

export function NftImage({ src, alt, sizes, className, priority = false }: Props) {
  return (
    <img
      src={src}
      srcSet={srcSetFor(src)}
      sizes={sizes}
      alt={alt}
      width={640}
      height={640}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      decoding="async"
      className={cn('aspect-square w-full rounded-[18px] object-cover', className)}
    />
  )
}
