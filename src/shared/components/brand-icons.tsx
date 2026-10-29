/** Minimal brand glyphs (lucide v1 no longer ships brand icons). */
type IconProps = { className?: string }

const base = { viewBox: '0 0 24 24', fill: 'currentColor', 'aria-hidden': true } as const

export function FacebookIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M14 8h3V4h-3c-2.8 0-4.5 1.8-4.5 4.6V11H7v4h2.5v9h4v-9h3l.5-4h-3.5V8.8c0-.5.3-.8.5-.8z" />
    </svg>
  )
}

export function InstagramIcon({ className }: IconProps) {
  return (
    <svg {...base} fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
    </svg>
  )
}

export function TwitterIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M22 5.9c-.7.3-1.5.6-2.3.7a4 4 0 0 0 1.8-2.2c-.8.5-1.7.8-2.6 1A4 4 0 0 0 12 9a11.4 11.4 0 0 1-8.3-4.2 4 4 0 0 0 1.2 5.4 4 4 0 0 1-1.8-.5 4 4 0 0 0 3.2 4 4 4 0 0 1-1.8.1 4 4 0 0 0 3.8 2.8A8 8 0 0 1 2 18.2 11.3 11.3 0 0 0 8.2 20c7.4 0 11.5-6.2 11.5-11.5v-.5c.9-.6 1.6-1.3 2.2-2.1z" />
    </svg>
  )
}

export function LinkedinIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4.5 8.5h3.6V20H4.5zM6.3 3a2.1 2.1 0 1 1 0 4.2 2.1 2.1 0 0 1 0-4.2zM10.3 8.5h3.4v1.6h.1c.5-.9 1.6-1.9 3.4-1.9 3.6 0 4.3 2.4 4.3 5.5V20h-3.6v-5.6c0-1.3 0-3-1.9-3s-2.1 1.4-2.1 2.9V20h-3.6z" />
    </svg>
  )
}

export function YoutubeIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M22.5 7.2a2.8 2.8 0 0 0-2-2C18.8 4.7 12 4.7 12 4.7s-6.8 0-8.5.5a2.8 2.8 0 0 0-2 2C1 8.9 1 12 1 12s0 3.1.5 4.8a2.8 2.8 0 0 0 2 2c1.7.5 8.5.5 8.5.5s6.8 0 8.5-.5a2.8 2.8 0 0 0 2-2c.5-1.7.5-4.8.5-4.8s0-3.1-.5-4.8zM9.8 15.1V8.9l5.7 3.1z" />
    </svg>
  )
}
