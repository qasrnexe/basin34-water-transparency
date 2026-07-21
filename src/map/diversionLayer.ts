import L from 'leaflet'
import type { DataStore } from '../data'
import type { PodRecord } from '../types'

export interface DiversionGroup {
  name: string
  lat: number
  lon: number
  totalRate: number
  rightWRs: string[]
  earliestYear: number | null
}

/** Only label diversions whose distinct rights sum to at least this rate. */
const MIN_TOTAL_CFS = 5

/**
 * Named surface diversions aggregated from IDWR POD `DiversionName` —
 * real per-right data grouped into the canal/ditch systems that deliver it
 * (Moore Canal, Burnett, Darlington Ditch, …). Complements the NHD
 * canal/pipeline geometry with authorized-rate totals per system.
 */
export function buildDiversionGroups(store: DataStore): DiversionGroup[] {
  const byName = new Map<string, { pods: PodRecord[]; wrs: Set<string> }>()
  for (const rec of store.pods) {
    if (rec.isGW) continue
    const name = (rec.feature.properties.DiversionName || '').trim()
    if (!name) continue
    let g = byName.get(name)
    if (!g) byName.set(name, (g = { pods: [], wrs: new Set() }))
    g.pods.push(rec)
    if (rec.wr) g.wrs.add(rec.wr)
  }

  const groups: DiversionGroup[] = []
  byName.forEach((g, name) => {
    // Rate per distinct right (multiple PODs share the right's rate)
    let totalRate = 0
    let earliest: number | null = null
    for (const wr of g.wrs) {
      const r = store.podsByWR.get(wr)?.[0]
      if (!r) continue
      totalRate += r.rate
      if (r.year != null && (earliest == null || r.year < earliest)) earliest = r.year
    }
    if (totalRate < MIN_TOTAL_CFS) return
    const lat = g.pods.reduce((s, p) => s + p.lat, 0) / g.pods.length
    const lon = g.pods.reduce((s, p) => s + p.lon, 0) / g.pods.length
    groups.push({ name, lat, lon, totalRate, rightWRs: [...g.wrs], earliestYear: earliest })
  })
  groups.sort((a, b) => b.totalRate - a.totalRate)
  return groups
}

export class DiversionLayer {
  readonly group = L.layerGroup()
  readonly groups: DiversionGroup[]
  enabled = false

  private map: L.Map
  private onClick: (d: DiversionGroup) => void

  constructor(map: L.Map, store: DataStore, onClick: (d: DiversionGroup) => void) {
    this.map = map
    this.onClick = onClick
    this.groups = buildDiversionGroups(store)
    for (const d of this.groups) {
      // Diamond marker, label revealed at zoom >= 11 (CSS class toggled below)
      const size = Math.max(10, Math.min(18, 8 + Math.sqrt(d.totalRate)))
      const icon = L.divIcon({
        className: 'diversion-marker',
        html:
          `<div class="diversion-diamond" style="width:${size}px;height:${size}px"></div>` +
          `<div class="diversion-label">${escapeHtml(d.name)}</div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      })
      const marker = L.marker([d.lat, d.lon], { icon, riseOnHover: true })
      marker.bindTooltip(
        `<strong>${escapeHtml(d.name)}</strong><br>${d.rightWRs.length} rights · ${d.totalRate.toFixed(1)} cfs authorized` +
        (d.earliestYear != null ? `<br>Earliest priority: ${d.earliestYear}` : ''),
        { direction: 'top', offset: [0, -6] },
      )
      marker.on('click', (e: any) => {
        L.DomEvent.stop(e)
        this.onClick(d)
      })
      this.group.addLayer(marker)
    }

    map.on('zoomend', () => this.updateLabelVisibility())
    this.updateLabelVisibility()
  }

  setEnabled(on: boolean) {
    this.enabled = on
    if (on && !this.map.hasLayer(this.group)) this.map.addLayer(this.group)
    if (!on && this.map.hasLayer(this.group)) this.map.removeLayer(this.group)
  }

  private updateLabelVisibility() {
    this.map.getContainer().classList.toggle('show-diversion-labels', this.map.getZoom() >= 11)
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
}
