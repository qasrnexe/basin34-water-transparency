import L from 'leaflet'
import type { Basemap } from '../types'

const BASIN_CENTER: [number, number] = [43.78, -113.65]
const BASIN_ZOOM = 9

/**
 * Pane layout (z-order is handled here ONCE, via panes — no bringToFront juggling).
 * Everything is SVG, so only the shapes themselves capture clicks: a well/gage
 * dot wins the click on the dot, and a click just beside it falls through to
 * the POU polygon underneath.
 *   overlayPane      400  (default vector overlays: boundary, canals, reaches…)
 *   pouPane          450  base POU polygons
 *   wellPane         470  wells (clickable above POU)
 *   gagePane         480  stream gages (clickable above wells)
 *   markerPane       600  POD stars, cluster icons, diversion labels
 *   pouSelectedPane  650  selected-POU outline (non-interactive)
 *   pouLinePane      660  POD↔POU connector lines (non-interactive)
 */
export function createMap(): L.Map {
  const map = L.map('map', { zoomControl: true }).setView(BASIN_CENTER, BASIN_ZOOM)
  map.createPane('pouPane').style.zIndex = '450'
  map.createPane('wellPane').style.zIndex = '470'
  map.createPane('gagePane').style.zIndex = '480'
  const sel = map.createPane('pouSelectedPane')
  sel.style.zIndex = '650'
  sel.style.pointerEvents = 'none'
  const line = map.createPane('pouLinePane')
  line.style.zIndex = '660'
  line.style.pointerEvents = 'none'
  return map
}

export class BasemapControl {
  private current: L.TileLayer | null = null
  private labels: L.TileLayer | null = null
  private map: L.Map

  constructor(map: L.Map) {
    this.map = map
  }

  set(type: Basemap) {
    if (this.current) this.map.removeLayer(this.current)
    if (this.labels) { this.map.removeLayer(this.labels); this.labels = null }

    const attribution = '© Basin 34 Transparency (IDWR + USGS public data)'
    if (type === 'osm') {
      this.current = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors | ' + attribution,
        maxZoom: 18,
      })
    } else {
      this.current = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { attribution: 'Tiles © Esri — Esri, USDA, USGS et al. | ' + attribution, maxZoom: 18 },
      )
      if (type === 'hybrid') {
        this.labels = L.tileLayer(
          'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
          { maxZoom: 18, opacity: 0.9 },
        ).addTo(this.map)
      }
    }
    this.current.addTo(this.map)

    document.querySelectorAll<HTMLButtonElement>('.basemap-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.basemap === type)
    })
  }
}
