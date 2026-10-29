import { useState } from 'react'
import { cn } from '@/shared/lib/utils'

/**
 * Variants written by scripts/sync-figma-assets.mjs. Phones get a light set
 * (320/480 encoded at lower quality, capped at 640 even on 3× screens);
 * tablets and desktops get the high-quality set.
 */
const PHONE_WIDTHS = [320, 480, 640] as const
const LARGE_WIDTHS = [320, 640, 960] as const

/** Tailwind's `md` breakpoint (768px). */
const PHONE = '(max-width: 767.98px)'
const LARGE = '(min-width: 768px)'

/** 1×1 transparent GIF: what a hidden layout "downloads" instead of the artwork. */
const BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

/** Builds a srcset from `/assets/nfts/<art>-640.webp` style URLs. */
function srcSetFor(url: string, widths: readonly number[]): string | undefined {
  const match = url.match(/^(.*)-(\d+)\.webp$/)
  if (!match) return undefined
  return widths.map((w) => `${match[1]}-${w}.webp ${w}w`).join(', ')
}

type Props = {
  src: string
  alt: string
  sizes: string
  className?: string
  priority?: boolean
  /**
   * The layout this image belongs to when the page renders separate mobile and
   * desktop versions. `display: none` does not stop an eager image from
   * downloading, so the other breakpoint gets a blank source instead.
   */
  media?: 'mobile' | 'desktop'
}

export function NftImage({ src, alt, sizes, className, priority = false, media }: Props) {
  // Lazy images fade in once decoded instead of popping in. Priority (LCP)
  // images and images already in cache render at once.
  const [loaded, setLoaded] = useState(priority)
  const phoneSet = media === 'desktop' ? BLANK : srcSetFor(src, PHONE_WIDTHS)
  const largeSet = media === 'mobile' ? BLANK : srcSetFor(src, LARGE_WIDTHS)
  return (
    // `contents` keeps the <img> as the parent's flex/grid item; the <source>s are
    // hidden so they never become items themselves (they would add gaps or take
    // grid cells). Source selection works on attributes, not on rendering.
    <picture className="contents">
      {phoneSet && <source media={PHONE} srcSet={phoneSet} sizes={sizes} className="hidden" />}
      {largeSet && <source media={LARGE} srcSet={largeSet} sizes={sizes} className="hidden" />}
      <img
        ref={(el) => {
          if (el?.complete && el.naturalWidth > 0) setLoaded(true)
        }}
        onLoad={() => setLoaded(true)}
        data-loading={loaded ? undefined : ''}
        // React sets attributes before the <img> is attached to <picture>, and a
        // detached <img> starts fetching its src at once. With sources present,
        // leave src unset so only the breakpoint's own candidate is downloaded.
        src={phoneSet || largeSet ? undefined : src}
        sizes={sizes}
        alt={alt}
        width={640}
        height={640}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
        decoding="async"
        className={cn(
          'aspect-square w-full rounded-[18px] bg-card object-cover transition-[opacity,scale] duration-500 data-loading:opacity-0',
          className,
        )}
      />
    </picture>
  )
}
