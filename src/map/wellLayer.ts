import L from 'leaflet'
import type { DataStore } from '../data'
import { resolveWellEmphasis } from '../emphasis'
import { wellVisible } from '../filters'
import { state } from '../state'
import { wellStyle } from '../symbology'
import type { WellRecord } from '../types'

export function wellPopupHtml(p: Record<string, any>): string {
  let html = `<strong>Well ${p.WellID || p.OBJECTID || ''}</strong><br>`
  if (p.Owner) html += `Owner: ${p.Owner}<br>`
  if (p.WellUse) html += `Use: ${p.WellUse}<br>`
  if (p.TotalDepth != null) html += `Total Depth: ${p.TotalDepth} ft<br>`
  if (p.StaticWaterLevel != null) html += `Static WL: ${p.StaticWaterLevel} ft<br>`
  if (p.ProductionRate != null) html += `Prod. Rate: ${p.ProductionRate} gpm<br>`
  if (p.ConstructionDate != null) {
    const yr = new Date(p.ConstructionDate).getFullYear()
    html += `Constructed: ~${yr}<br>`
  }
  if (p.WellDocs) html += `<a href="${p.WellDocs}" target="_blank" rel="noopener">Well Docs →</a><br>`
  html += `<small>Data: IDWR Wells. Priority dates belong to water rights (PODs layer); wells show construction dates.</small>`
  return html
}

/**
 * Wells as SVG circle markers in a pane above the POU polygons, so a well dot
 * always wins the click over the field it sits in (canvas can't do this: a
 * canvas element swallows clicks even over empty pixels).
 */
export class WellLayer {
  private group = L.layerGroup()
  private count = 0
  enabled = true

  private map: L.Map
  private store: DataStore
  private onWellClick: (rec: WellRecord) => void

  constructor(map: L.Map, store: DataStore, onWellClick: (rec: WellRecord) => void) {
    this.map = map
    this.store = store
    this.onWellClick = onWellClick
  }

  visibleCount(): number {
    return this.count
  }

  rebuild() {
    this.group.clearLayers()
    this.count = 0
    if (!this.enabled) {
      if (this.map.hasLayer(this.group)) this.map.removeLayer(this.group)
      return
    }
    for (const rec of this.store.wells) {
      if (!wellVisible(rec, state, this.store)) continue
      const style = wellStyle(rec, resolveWellEmphasis(rec, state, this.store))
      const lon = rec.feature.geometry.coordinates[0]
      const marker = L.circleMarker([rec.lat, lon], { ...style, pane: 'wellPane' })
      marker.bindPopup(wellPopupHtml(rec.feature.properties))
      marker.on('click', () => this.onWellClick(rec))
      this.group.addLayer(marker)
      this.count++
    }
    if (!this.map.hasLayer(this.group)) this.map.addLayer(this.group)
  }

  setEnabled(on: boolean) {
    this.enabled = on
    this.rebuild()
  }
}
