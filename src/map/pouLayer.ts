import L from 'leaflet'
import { DISTRICT_POU_KM2, type DataStore } from '../data'
import { state } from '../state'
import type { GeoFeature } from '../types'

const SELECTED_STYLE: L.PathOptions = {
  color: '#a855f7', weight: 2.5, fillColor: '#e9d5ff', fillOpacity: 0.12,
}

/**
 * Place-of-Use polygons:
 * - one SVG GeoJSON layer for all visible rights (instead of one L.geoJSON
 *   instance per polygon as before). SVG (not canvas) is required here: only
 *   the polygon shapes capture clicks, so gages/reaches/wells in lower panes
 *   stay clickable through the gaps,
 * - a thin outline overlay + dashed POD↔POU connector lines for the current
 *   selection (dedicated non-interactive panes, so no z-order juggling),
 * - selection changes restyle in place; the polygon set only rebuilds when the
 *   set of visible rights actually changes.
 */
export class PouLayer {
  private base: L.GeoJSON | null = null
  private overlay = L.layerGroup()
  private lines = L.layerGroup()
  private lastKey = ''
  /** While true (timeline playback) polygon rebuilds are skipped entirely. */
  private suspended = false

  private map: L.Map
  private store: DataStore
  private onPouClick: (feature: GeoFeature) => void

  constructor(map: L.Map, store: DataStore, onPouClick: (feature: GeoFeature) => void) {
    this.map = map
    this.store = store
    this.onPouClick = onPouClick
    this.overlay.addTo(map)
    this.lines.addTo(map)
  }

  /** Suspend/resume rebuilds (timeline playback rebuilds layers every tick). */
  setSuspended(on: boolean) {
    this.suspended = on
  }

  /** Show POU polygons for the given rights (no-op if the set is unchanged). */
  setVisibleWRs(wrs: Set<string>) {
    if (this.suspended) return
    if (!state.placeOfUseMode || wrs.size === 0) {
      this.clearBase()
      this.refreshSelection()
      return
    }
    const visible: Array<{ feature: GeoFeature; areaKm2: number }> = []
    // Order-independent content hash so we only rebuild when the set changes
    let hash = 0
    for (const rec of this.store.pous) {
      if (wrs.has(rec.wr)) {
        visible.push(rec)
        let h = 2166136261
        for (let i = 0; i < rec.wr.length; i++) h = (h ^ rec.wr.charCodeAt(i)) * 16777619 | 0
        hash = (hash + h) | 0
      }
    }
    // Paint large polygons first so small fields end up on top in the SVG and
    // always win the click over the district-scale POU that contains them.
    visible.sort((a, b) => b.areaKm2 - a.areaKm2)
    const features = visible.map(v => v.feature)
    const key = `${features.length}:${hash}`
    if (key === this.lastKey && this.base) {
      this.refreshSelection()
      return
    }
    this.lastKey = key
    this.clearBase()
    this.base = L.geoJSON({ type: 'FeatureCollection', features } as any, {
      pane: 'pouPane',
      style: (f: any) => this.styleFor(f as GeoFeature),
      onEachFeature: (feat: any, lyr: L.Layer) => {
        lyr.on('click', (e: any) => {
          L.DomEvent.stop(e) // don't let the map background-click clear this selection
          this.onPouClick(feat as GeoFeature)
        })
      },
    }).addTo(this.map)
    this.refreshSelection()
  }

  /** Restyle polygons + rebuild the selection outline and connector lines. */
  refreshSelection() {
    this.base?.setStyle(f => this.styleFor(f as GeoFeature))
    this.overlay.clearLayers()
    this.lines.clearLayers()
    if (state.selectedWRs.size === 0 && state.highlightMode !== 'transfers') return

    // Purple POD↔field graphics always work when a right is selected — even if
    // "show all Place of Use" is off (that toggle only controls the dense fill layer).
    for (const wr of state.selectedWRs) {
      for (const pou of this.store.pousByWR.get(wr) || []) {
        this.overlay.addLayer(L.geoJSON(pou.feature as any, {
          pane: 'pouSelectedPane',
          interactive: false,
          style: () => ({ color: '#a855f7', weight: 3, fillOpacity: 0.08, fillColor: '#e9d5ff', dashArray: undefined }),
        }))
      }
    }

    // Connector lines POD → POU center: always for the selection, and for all
    // visible transfer rights when the Transfers analysis view is active.
    const lineWRs = new Set<string>(state.selectedWRs)
    if (state.highlightMode === 'transfers') {
      this.store.transferDistKm.forEach((_d, wr) => lineWRs.add(wr))
    }
    for (const wr of lineWRs) {
      const center = this.store.pouCenter.get(wr)
      if (!center) continue
      const isSelected = state.selectedWRs.has(wr)
      for (const pod of this.store.podsByWR.get(wr) || []) {
        this.lines.addLayer(L.polyline([[pod.lat, pod.lon], center], {
          pane: 'pouLinePane',
          interactive: false, // decoration only — must not steal clicks from markers below
          color: '#a855f7',
          weight: isSelected ? 2.5 : 1.5,
          dashArray: '4,3',
          opacity: isSelected ? 0.9 : 0.55,
        }))
      }
    }
  }

  private clearBase() {
    if (this.base) {
      this.map.removeLayer(this.base)
      this.base = null
    }
    this.lastKey = ''
  }

  private styleFor(feature: GeoFeature): L.PathOptions {
    const wr = (feature.properties?.WaterRightNumber || '').trim()
    const selected = state.selectedWRs.has(wr)

    // District/service-area POUs (e.g. the ~234 km² Big Lost River Irrigation
    // District area shared by its storage rights) render as outline only: no
    // fill means no valley-wide tint and no stolen clicks — the unfilled
    // interior is click-transparent, so the fields inside stay interactive.
    if ((feature.properties?.__areaKm2 ?? 0) >= DISTRICT_POU_KM2) {
      if (selected) return { color: '#a855f7', weight: 2.5, fill: false, dashArray: '8,5' }
      return { color: '#0f766e', weight: 1.5, fill: false, dashArray: '8,5', opacity: 0.7 }
    }
    if (selected) return SELECTED_STYLE

    const hasSelection = state.selectedWRs.size > 0
    const transfersMode = state.highlightMode === 'transfers'
    const isTransfer = this.store.transferDistKm.has(wr)
    if (isTransfer) {
      // In the Transfers view, destinations outside the river's natural
      // corridor ("new ground") get a strong solid fill so water moved onto
      // desert ground is visible at a glance; other transfers read stronger
      // than usual, everything else dims (below).
      if (transfersMode && this.store.newGroundWRs.has(wr)) {
        return { color: '#c2410c', weight: 2, fillColor: '#f97316', fillOpacity: 0.45 }
      }
      return {
        color: '#f97316', weight: 1.5, fillColor: '#fed7aa',
        fillOpacity: transfersMode ? 0.2 : hasSelection ? 0.04 : 0.08, dashArray: '3,2',
      }
    }
    if (transfersMode) {
      return { color: '#15803d', weight: 0.5, fillColor: '#4ade80', fillOpacity: 0.01, opacity: 0.3, dashArray: '2,3' }
    }
    return {
      color: '#15803d', weight: 1, fillColor: '#4ade80',
      fillOpacity: hasSelection ? 0.02 : 0.04, dashArray: '2,3',
    }
  }
}
