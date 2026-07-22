import L from 'leaflet'
import 'leaflet.markercluster'
import type { DataStore } from '../data'
import { resolvePodEmphasis } from '../emphasis'
import { podVisible } from '../filters'
import { state } from '../state'
import { podBaseColor, podIconSpec, podStarIcon } from '../symbology'
import type { PodRecord } from '../types'

function clusterIcon(cluster: any): L.DivIcon {
  const count = cluster.getChildCount()
  const size = count > 100 ? 34 : count > 25 ? 30 : 26
  return L.divIcon({
    html: `<div style="background:#334155;color:#e0e7ff;border:1px solid #1e2937;border-radius:50%;width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;">${count}</div>`,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

function podPopupHtml(rec: PodRecord): string {
  const p = rec.feature.properties
  let html = `<strong>POD / Water Right ${rec.wr}</strong><br>Source: ${rec.source}`
  if (rec.year != null) html += `<br>Priority year: ${rec.year} (seniority)`
  if (rec.owner) html += `<br>Owner: ${rec.owner}`
  if (p.OverallMaxDiversionRate != null) html += `<br>Max rate: ${p.OverallMaxDiversionRate} cfs`
  if (p.WRReport) html += `<br><a href="${p.WRReport}" target="_blank" rel="noopener">Full report →</a>`
  return html
}

/**
 * Manages the clustered POD layer.
 * - `rebuild()` re-filters and re-creates markers (only on filter changes).
 * - `restyle(wrs)` updates icons in place for the given rights (selection
 *   changes never trigger a full 7k-marker rebuild).
 */
export class PodLayer {
  private cluster: L.MarkerClusterGroup
  private markersByWR = new Map<string, L.Marker[]>()
  private recordByMarker = new Map<L.Marker, PodRecord>()
  private lastVisibleWRs = new Set<string>()
  enabled = true

  private map: L.Map
  private store: DataStore
  private onPodClick: (rec: PodRecord) => void

  constructor(
    map: L.Map,
    store: DataStore,
    onPodClick: (rec: PodRecord) => void,
    opts: { lite?: boolean } = {},
  ) {
    this.map = map
    this.store = store
    this.onPodClick = onPodClick
    const lite = !!opts.lite
    this.cluster = L.markerClusterGroup({
      // Keep clusters longer on phones; unclustering 7k DivIcons kills scroll FPS.
      disableClusteringAtZoom: lite ? 14 : 11,
      spiderfyOnMaxZoom: true,
      maxClusterRadius: lite ? 90 : 45,
      chunkedLoading: true,
      chunkInterval: lite ? 100 : 200,
      chunkDelay: 20,
      removeOutsideVisibleBounds: true,
      iconCreateFunction: clusterIcon,
    })
  }

  /** Rights visible after the last rebuild (drives which POU polygons show). */
  visibleWRs(): Set<string> {
    return this.lastVisibleWRs
  }

  visibleCount(): number {
    return this.recordByMarker.size
  }

  rebuild() {
    this.cluster.clearLayers()
    this.markersByWR.clear()
    this.recordByMarker.clear()
    this.lastVisibleWRs = new Set()
    if (!this.enabled) {
      if (this.map.hasLayer(this.cluster)) this.map.removeLayer(this.cluster)
      return
    }

    const markers: L.Marker[] = []
    for (const rec of this.store.pods) {
      if (!podVisible(rec, state, this.store)) continue
      const marker = L.marker([rec.lat, rec.lon], {
        icon: this.iconFor(rec),
        riseOnHover: true,
      })
      marker.bindPopup(podPopupHtml(rec))
      marker.on('click', (e: any) => {
        L.DomEvent.stop(e) // keep the map background-click from clearing the new selection
        this.onPodClick(rec)
      })
      markers.push(marker)
      this.recordByMarker.set(marker, rec)
      if (rec.wr) {
        const list = this.markersByWR.get(rec.wr)
        if (list) list.push(marker)
        else this.markersByWR.set(rec.wr, [marker])
        this.lastVisibleWRs.add(rec.wr)
      }
    }
    this.cluster.addLayers(markers)
    if (!this.map.hasLayer(this.cluster)) this.map.addLayer(this.cluster)
  }

  /** Restyle only the markers for the given rights (cheap selection updates). */
  restyle(wrs: Iterable<string>) {
    for (const wr of wrs) {
      const markers = this.markersByWR.get(wr)
      if (!markers) continue
      for (const m of markers) {
        const rec = this.recordByMarker.get(m)
        if (rec) m.setIcon(this.iconFor(rec))
      }
    }
  }

  setEnabled(on: boolean) {
    this.enabled = on
    this.rebuild()
  }

  private iconFor(rec: PodRecord): L.DivIcon {
    const emphasis = resolvePodEmphasis(rec, state, this.store)
    return podStarIcon(podIconSpec(rec, podBaseColor(rec, state.podColorMode), emphasis))
  }
}
