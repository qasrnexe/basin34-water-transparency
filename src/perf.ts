/** Phone / constrained-device heuristics for map load behavior. */

export function isPhoneViewport(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches
}

/**
 * Prefer a lighter map when the device is phone-sized or touch-primary with a
 * small screen. Desktop Explore can still opt into full density.
 */
export function preferLiteMap(): boolean {
  if (typeof window === 'undefined') return false
  if (isPhoneViewport()) return true
  const touch = navigator.maxTouchPoints > 0
  const narrow = window.matchMedia('(max-width: 1024px)').matches
  return touch && narrow
}
