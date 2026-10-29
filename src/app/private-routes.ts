/** Route prefixes behind the `_authed` guard (login required). */
export const PRIVATE_PREFIXES = ['/checkout', '/orders', '/account'] as const

export function isPrivatePath(path: string): boolean {
  const pathname = path.split(/[?#]/)[0] ?? path
  return PRIVATE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}
