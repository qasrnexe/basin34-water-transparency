import { NEW_GROUND_KM, TRANSFER_DIST_KM, type DataStore } from './data'
import { downloadCsv } from './dryReach'

/**
 * Water moved farther — geometric proxy (not a transfer filing or liner inventory).
 *
 * - POD → current POU size-adjusted distance > TRANSFER_DIST_KM
 * - Optional "off-corridor": POU center > NEW_GROUND_KM from NHD mainstem + NWI
 *
 * Priority years on flagged rights are often senior; do NOT treat off-corridor
 * counts as “new ground broken out in the last 10–15 years.”
 */
export interface MovedFartherRow {
  wr: string
  owner: string
  year: number | null
  rate: number
  source: string
  podPouKm: number
  corridorKm: number | null
  offCorridor: boolean
}

export const MOVED_FARTHER_METHODOLOGY =
  'Proxy only (not a legal determination or transfer filing): rights whose point of diversion ' +
  `is more than ${TRANSFER_DIST_KM} km from the current authorized place of use (size-adjusted), ` +
  'from IDWR POD + POU geometry. “Off corridor” means the POU center sits more than ' +
  `${NEW_GROUND_KM} km from both the NHD Big Lost mainstem and any NWI riparian polygon — ` +
  'a geometric signal that water is authorized away from the natural river corridor, not proof ' +
  'of a lined canal or of recent breakout. Lined canals / east–west-of-river new ground are ' +
  'visible on satellite; NHD does not mark liners. Sorted by POD↔POU distance.'

export function listMovedFarther(store: DataStore): MovedFartherRow[] {
  const rows: MovedFartherRow[] = []
  for (const [wr, podPouKm] of store.transferDistKm) {
    const rec = store.podsByWR.get(wr)?.[0]
    const corridorKm = store.corridorDistKm.get(wr) ?? null
    const offCorridor = store.newGroundWRs.has(wr)
    rows.push({
      wr,
      owner: rec?.owner || '',
      year: rec?.year ?? null,
      rate: rec?.rate ?? 0,
      source: rec?.source || '',
      podPouKm,
      corridorKm,
      offCorridor,
    })
  }
  return rows.sort((a, b) => b.podPouKm - a.podPouKm || (a.year ?? 9999) - (b.year ?? 9999))
}

export function movedFartherToCsv(rows: MovedFartherRow[]): string {
  const esc = (v: string | number) => {
    const s = String(v)
    return /["',\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const header = [
    'water_right', 'owner', 'priority_year', 'max_diversion_cfs', 'source',
    'pod_pou_km', 'corridor_km', 'off_corridor',
  ]
  const lines = [header.join(',')]
  for (const r of rows) {
    lines.push([
      esc(r.wr),
      esc(r.owner),
      r.year ?? '',
      r.rate,
      esc(r.source),
      r.podPouKm.toFixed(2),
      r.corridorKm != null ? r.corridorKm.toFixed(2) : '',
      r.offCorridor ? 'yes' : 'no',
    ].join(','))
  }
  return lines.join('\n')
}

export { downloadCsv }
