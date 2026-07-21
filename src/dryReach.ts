import { CONFLICT_CORRIDOR_KM, type DataStore } from './data'
import type { PodRecord } from './types'

/** Moore diversion — surface flow often ends near here in recent years (USGS 13132100). */
export const MOORE_LAT = 43.7843611

/** Senior cutoff for the dry-reach lens (exclusive). */
export const DRY_REACH_SENIOR_YEAR = 1950

/**
 * Downstream seniors on a dry reach — public-data proxy, not a legal finding.
 *
 * - Surface / Big Lost–like source on corridor
 * - Priority year < 1950
 * - POD within CONFLICT_CORRIDOR_KM of NHD/NWI corridor
 * - At or below Moore diversion (POD latitude ≤ Moore gage lat)
 */
export interface DryReachSeniorRow {
  wr: string
  owner: string
  year: number
  rate: number
  source: string
  lat: number
  lon: number
  corridorKm: number
}

export const DRY_REACH_METHODOLOGY =
  'Proxy only (not a legal determination): Big Lost / surface rights with priority before 1950, ' +
  'POD within 3 km of the NHD corridor, and at or below the Moore diversion (USGS 13132100). ' +
  'Sources: IDWR PODs + NHD mainstem. Sorted by diversion rate (cfs).'

function isBigLostSurface(rec: PodRecord): boolean {
  if (rec.isGW) return false
  const s = rec.source.toUpperCase()
  if (s.includes('BIG LOST')) return true
  return rec.isSurf && rec.corridorDistKm <= CONFLICT_CORRIDOR_KM
}

/** One row per water right (highest rate among matching PODs). */
export function listDryReachSeniors(store: DataStore): DryReachSeniorRow[] {
  const best = new Map<string, DryReachSeniorRow>()
  for (const rec of store.pods) {
    if (rec.year == null || rec.year >= DRY_REACH_SENIOR_YEAR) continue
    if (!isBigLostSurface(rec)) continue
    if (rec.corridorDistKm > CONFLICT_CORRIDOR_KM) continue
    if (rec.lat > MOORE_LAT) continue
    if (!rec.wr) continue

    const prev = best.get(rec.wr)
    if (!prev || rec.rate > prev.rate) {
      best.set(rec.wr, {
        wr: rec.wr,
        owner: rec.owner,
        year: rec.year,
        rate: rec.rate,
        source: rec.source,
        lat: rec.lat,
        lon: rec.lon,
        corridorKm: rec.corridorDistKm,
      })
    }
  }
  return [...best.values()].sort((a, b) => b.rate - a.rate || a.year - b.year)
}

export function dryReachSeniorsToCsv(rows: DryReachSeniorRow[]): string {
  const esc = (v: string | number) => {
    const s = String(v)
    return /["',\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const header = ['water_right', 'owner', 'priority_year', 'max_diversion_cfs', 'source', 'lat', 'lon', 'corridor_km']
  const lines = [header.join(',')]
  for (const r of rows) {
    lines.push([
      esc(r.wr), esc(r.owner), r.year, r.rate, esc(r.source),
      r.lat.toFixed(5), r.lon.toFixed(5), r.corridorKm.toFixed(2),
    ].join(','))
  }
  return lines.join('\n')
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
