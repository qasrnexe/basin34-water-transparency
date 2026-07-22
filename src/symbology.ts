import L from 'leaflet'
import type { PodEmphasis, WellEmphasis } from './emphasis'
import type { PodColorMode, PodRecord, WellRecord } from './types'

// ---------- Color scales ----------

export const POD_COLORS = {
  gw: '#6d28d9',      // violet — groundwater PODs
  surface: '#0ea5e9', // sky blue — surface PODs
  other: '#854d0e',   // brown — unknown sources
}

export const PRIORITY_COLORS: Array<{ before: number; color: string; label: string }> = [
  { before: 1900, color: '#166534', label: '<1900 (very senior)' },
  { before: 1950, color: '#15803d', label: '1900–1950 (senior)' },
  { before: 2000, color: '#ca8a04', label: '1950–2000' },
  { before: Infinity, color: '#b45309', label: '>2000 (junior)' },
]

export function podBaseColor(rec: PodRecord, mode: PodColorMode): string {
  if (mode === 'priority') {
    if (rec.year == null) return '#6b7280'
    for (const s of PRIORITY_COLORS) if (rec.year < s.before) return s.color
  }
  if (rec.isGW) return POD_COLORS.gw
  if (rec.isSurf) return POD_COLORS.surface
  return POD_COLORS.other
}

export const WELL_USE_COLORS: Array<{ match: RegExp; color: string; label: string }> = [
  { match: /IRRIG/, color: '#0f766e', label: 'Irrigation' },
  { match: /DOMESTIC|HOUSEHOLD/, color: '#475569', label: 'Domestic' },
  { match: /STOCK/, color: '#c2410c', label: 'Stock' },
  { match: /MUNICIP|PUBLIC|COMMUNITY/, color: '#6366f1', label: 'Municipal' },
  { match: /INDUST|COMMERCIAL/, color: '#dc2626', label: 'Industrial' },
  { match: /MONITOR|OBSERV/, color: '#64748b', label: 'Monitoring' },
]

export function wellColor(use: string): string {
  for (const c of WELL_USE_COLORS) if (c.match.test(use)) return c.color
  return '#475569'
}

// Emphasis accent colors (also used by the legend, so the two never drift)
export const EMPHASIS_COLORS: Record<string, { stroke: string; fill: string; label: string }> = {
  selected: { stroke: '#a855f7', fill: '#e9d5ff', label: 'Selected right(s)' },
  owner: { stroke: '#f59e0b', fill: '#f59e0b', label: 'Owner match' },
  senior: { stroke: '#eab308', fill: '#fef08c', label: 'Senior (pre-1950) downstream' },
  junior: { stroke: '#f97316', fill: '#fed7aa', label: 'Post-1980 high-rate development' },
  transfer: { stroke: '#a855f7', fill: '#e9d5ff', label: 'Potential transfer (POD far from POU)' },
  'conflict-senior': { stroke: '#eab308', fill: '#fef08c', label: 'Senior (pre-1970) downstream' },
  'conflict-junior': { stroke: '#f97316', fill: '#fed7aa', label: 'Newer (post-1980) upstream' },
  'conjunctive-gw': { stroke: '#7c3aed', fill: '#ddd6fe', label: 'Post-1950 groundwater development' },
  'high-rate': { stroke: '#dc2626', fill: '#fca5a5', label: 'High diversion rate' },
}

// ---------- Sizes ----------

function podRadius(rate: number): number {
  // Keep default markers modest so satellite texture stays readable at basin zoom.
  return Math.max(1.6, Math.min(5, Math.sqrt(rate || 0) * 1.35))
}

export function wellRadius(rate: number): number {
  if (!rate || rate <= 0) return 2.5
  return Math.max(2, Math.min(5.5, Math.sqrt(rate) * 0.6))
}

// ---------- POD star icons (cached) ----------

export interface PodIconSpec {
  size: number
  stroke: string
  fill: string
  fillOpacity: number
  strokeWidth: number
  /** Kept for cache keys; glow is intentionally unused (too noisy on satellite). */
  glow: 'none'
}

/**
 * Compute the icon spec for a POD from its base color + emphasis.
 * Quiet by default; selection / analysis use stroke + size, not glow.
 */
export function podIconSpec(rec: PodRecord, baseColor: string, emphasis: PodEmphasis): PodIconSpec {
  let radius = podRadius(rec.rate)
  let stroke = baseColor
  let fill = baseColor
  let fillOpacity = 0.45
  let strokeWidth = 0.8

  const accent = EMPHASIS_COLORS[emphasis]
  switch (emphasis) {
    case 'selected':
      radius = Math.max(radius * 1.55, 4.5)
      stroke = accent.stroke
      fill = accent.fill
      fillOpacity = 0.9
      strokeWidth = 2
      break
    case 'owner':
      radius *= 1.35
      stroke = accent.stroke
      fill = accent.fill
      fillOpacity = 0.85
      strokeWidth = 1.4
      break
    case 'senior':
    case 'conflict-senior':
      radius = Math.max(radius * 1.45, 4)
      stroke = accent.stroke
      fill = accent.fill
      fillOpacity = 0.8
      strokeWidth = 1.6
      break
    case 'junior':
    case 'conflict-junior':
    case 'conjunctive-gw':
      radius = Math.max(radius * 1.35, 3.8)
      stroke = accent.stroke
      fill = accent.fill
      fillOpacity = 0.8
      strokeWidth = 1.4
      break
    case 'transfer':
      radius = Math.max(radius * 1.3, 3.6)
      stroke = accent.stroke
      fill = accent.fill
      fillOpacity = 0.75
      strokeWidth = 1.4
      break
    case 'high-rate':
      radius = Math.max(radius, 3.2) * 1.2
      stroke = accent.stroke
      fill = accent.fill
      fillOpacity = 0.8
      strokeWidth = 1.2
      break
    case 'subdued':
      radius *= 0.55
      stroke = '#94a3b8'
      fill = '#94a3b8'
      fillOpacity = 0.12
      strokeWidth = 0.6
      break
    case 'normal':
      break
  }

  return {
    size: Math.max(8, Math.min(18, Math.round(radius * 2.6))),
    stroke,
    fill,
    fillOpacity: Math.round(fillOpacity * 100) / 100,
    strokeWidth: Math.max(0.75, Math.round(strokeWidth * 10) / 10),
    glow: 'none',
  }
}

const iconCache = new Map<string, L.DivIcon>()

/** Star-shaped divIcon, cached by style key (7k markers share a few dozen icons). */
export function podStarIcon(spec: PodIconSpec): L.DivIcon {
  const key = `${spec.size}|${spec.stroke}|${spec.fill}|${spec.fillOpacity}|${spec.strokeWidth}`
  const cached = iconCache.get(key)
  if (cached) return cached

  // Crisp edge only — no drop-shadow glow (was washing out satellite at basin zoom).
  const html =
    `<svg width="${spec.size}" height="${spec.size}" viewBox="0 0 24 24" style="display:block">` +
    `<path d="M12 2 L15.09 8.26 L22 9.27 L17 14.14 L18.18 21.02 L12 17.77 L5.82 21.02 L7 14.14 L2 9.27 L8.91 8.26 Z" ` +
    `fill="${spec.fill}" fill-opacity="${spec.fillOpacity}" stroke="${spec.stroke}" stroke-width="${spec.strokeWidth}" stroke-opacity="0.9"/></svg>`

  const icon = L.divIcon({
    className: 'basin-pod-star',
    html,
    iconSize: [spec.size, spec.size],
    iconAnchor: [spec.size / 2, spec.size / 2],
    popupAnchor: [0, -spec.size / 2 - 1],
  })
  iconCache.set(key, icon)
  return icon
}

// ---------- Well style ----------

export function wellStyle(rec: WellRecord, emphasis: WellEmphasis): L.CircleMarkerOptions {
  let radius = wellRadius(rec.rate)
  let color = wellColor(rec.use)
  let fillOpacity = 0.65
  if (emphasis === 'junior' || emphasis === 'conjunctive-gw') {
    radius *= 1.7
    color = EMPHASIS_COLORS[emphasis].stroke
    fillOpacity = 0.95
  } else if (emphasis === 'subdued') {
    color = '#64748b'
    fillOpacity = 0.18
  }
  return { radius, color, fillColor: color, fillOpacity, weight: 0.5 }
}
