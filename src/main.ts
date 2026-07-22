import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import './style.css'
import L from 'leaflet'

import { loadDataStoreLight, enrichDataStoreWithPou, pouGeomKey, type DataStore } from './data'
import { applyHashToState, schedulePermalinkUpdate, setStoryStepForHash } from './permalink'
import { preferLiteMap } from './perf'
import { state, resetState } from './state'
import type { Basemap, GeoFeature, PodRecord } from './types'
import { BasemapControl, createMap } from './map/createMap'
import { PodLayer } from './map/podLayer'
import { WellLayer } from './map/wellLayer'
import { PouLayer } from './map/pouLayer'
import { DiversionLayer } from './map/diversionLayer'
import { loadStaticLayers, type StaticLayers } from './map/staticLayers'
import { renderShell } from './ui/shell'
import { wireSidebar, populateReachSelect, syncSidebarToState, syncReachSelect, loadDataAsOf, getStoredUiMode } from './ui/sidebar'
import { updateLegend } from './ui/legend'
import { setupTimeline, type TimelineControl } from './ui/timeline'
import { setupOwnerSearch, clearOwnerSearchUI } from './ui/ownerSearch'
import { isModalOpen } from './ui/modal'
import { goToStoryStep, setStoryStepIndex, wireStory } from './ui/story'
import {
  closeDetails, FLOW_STEP_GAGES, showAppropriationPanel, showConjunctivePanel, showConflictsOverview, showDiversionDetails, showDryReachSeniorsPanel, showGageDetails,
  showGenericDetails, showPodDetails, showPouGroupDetails, showReachLossPanel, showTransfersOverview,
  showWellDetails,
} from './ui/details'

// Fix default marker icons for Leaflet in bundlers
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
})

let map: L.Map
let store: DataStore
let podLayer: PodLayer
let wellLayer: WellLayer
let pouLayer: PouLayer
let diversionLayer: DiversionLayer
let staticLayers: StaticLayers
let basemap: BasemapControl
let timeline: TimelineControl
let currentBasemap: Basemap = 'satellite'

function updatePermalink() {
  if (map) schedulePermalinkUpdate(() => currentBasemap, map)
}

/** Selection forced filtered-out PODs into view → next change needs a rebuild. */
let selectionForcedRebuild = false

// ---------- Rendering ----------

/** Full data refresh: filters changed → rebuild layers and legend. */
function refreshData() {
  podLayer.rebuild()
  wellLayer.rebuild()
  pouLayer.setVisibleWRs(podLayer.visibleWRs())
  selectionForcedRebuild = false
  updateLegendNow()
  updateSelectionBanner()
  updatePermalink()
}

/** Cheap selection refresh: restyle affected markers + POU overlay only. */
function setSelection(wrs: Set<string>) {
  const affected = new Set([...state.selectedWRs, ...wrs])
  state.selectedWRs = wrs

  // If the selection includes rights currently filtered out, force-include them
  // (podVisible force-includes selected rights) via a one-off rebuild.
  const visible = podLayer.visibleWRs()
  const needsRebuild = selectionForcedRebuild || [...wrs].some(wr => !visible.has(wr))
  if (needsRebuild) {
    podLayer.rebuild()
    pouLayer.setVisibleWRs(podLayer.visibleWRs())
    selectionForcedRebuild = wrs.size > 0
  } else {
    podLayer.restyle(affected)
    pouLayer.refreshSelection()
  }
  updateSelectionBanner()
  updateLegendNow()
  updatePermalink()
}

function clearSelection() {
  if (state.selectedWRs.size === 0) return
  setSelection(new Set())
  closeDetails()
}

function updateLegendNow() {
  updateLegend(
    { pods: podLayer.visibleCount(), wells: wellLayer.visibleCount() },
    { pods: podLayer.enabled, wells: wellLayer.enabled },
  )
}

function updateSelectionBanner() {
  const banner = document.getElementById('selection-banner')!
  const text = document.getElementById('selection-text')!
  const hint = document.getElementById('map-hint')
  if (state.selectedWRs.size === 0) {
    banner.classList.add('hidden')
    hint?.classList.remove('hidden')
    return
  }
  hint?.classList.add('hidden')
  const wrs = [...state.selectedWRs]
  if (wrs.length === 1) {
    const owner = store.podsByWR.get(wrs[0])?.[0]?.owner
    text.textContent = `Right ${wrs[0]}${owner ? ` — ${owner}` : ''} · purple = diversion ↔ fields`
  } else {
    text.textContent = `${wrs.length} rights share this place of use · purple links diversions to fields`
  }
  banner.classList.remove('hidden')
}

// ---------- Interactions ----------

function onPodClick(rec: PodRecord) {
  setSelection(rec.wr ? new Set([rec.wr]) : new Set())
  showPodDetails(rec, store)
}

function onPouClick(feature: GeoFeature) {
  const wr = (feature.properties?.WaterRightNumber || '').trim()
  if (!wr) return
  // All rights sharing (approximately) this polygon are selected together
  const key = pouGeomKey(feature.geometry)
  const group = key && store.geomKeyToWRs.get(key)
  const wrs = group ? new Set(group) : new Set([wr])
  setSelection(wrs)
  showPouGroupDetails(wrs, feature, store)
}

function zoomToWR(wr: string) {
  const bounds = L.latLngBounds([])
  for (const pod of store.podsByWR.get(wr) || []) bounds.extend([pod.lat, pod.lon])
  for (const pou of store.pousByWR.get(wr) || []) {
    try { bounds.extend(L.geoJSON(pou.feature as any).getBounds()) } catch { /* skip bad geometry */ }
  }
  if (bounds.isValid()) map.fitBounds(bounds.pad(0.3), { maxZoom: 14 })
}

const GAGE_COORDS: Record<string, [number, number]> = {
  ...Object.fromEntries(Object.values(FLOW_STEP_GAGES).map(g => [g.site, [g.lat, g.lon]])),
  '13132580': [43.7965727, -112.8502748],
}

function zoomToGage(site: string) {
  const c = GAGE_COORDS[site]
  if (c) map.setView(c, 12)
}

// ---------- Bootstrap ----------

function setLoadStatus(label: string, pct: number) {
  const status = document.getElementById('load-status')
  const fill = document.getElementById('load-bar-fill')
  if (status) status.textContent = label
  if (fill) fill.style.width = `${Math.max(0, Math.min(100, pct))}%`
}

function hideLoadOverlay() {
  document.getElementById('load-overlay')?.classList.add('hidden')
}

async function bootstrap() {
  renderShell()
  void loadDataAsOf()
  const lite = preferLiteMap()
  if (lite) {
    // Phones: skip painting every POU fill (heavy). Selection purple lines still work.
    state.placeOfUseMode = false
    state.hideNonMatches = true
    document.body.classList.add('lite-map')
  } else {
    state.placeOfUseMode = true
    state.hideNonMatches = true
  }
  setLoadStatus(lite ? 'Phone-friendly load…' : 'Building map…', 8)

  map = createMap()
  basemap = new BasemapControl(map)
  basemap.set('satellite')

  // Restore a shared view (URL hash) before the first render
  const restored = applyHashToState()
  if (restored.basemap) {
    currentBasemap = restored.basemap
    basemap.set(restored.basemap)
  }
  if (restored.view && restored.storyStep == null) {
    map.setView([restored.view.lat, restored.view.lng], restored.view.zoom)
  }
  if (restored.storyStep != null) setStoryStepIndex(restored.storyStep)

  setLoadStatus('Loading water rights…', 20)
  store = await loadDataStoreLight(label => setLoadStatus(label, 35))

  setLoadStatus('Drawing channels & gages…', 50)
  podLayer = new PodLayer(map, store, onPodClick, { lite })
  wellLayer = new WellLayer(map, store, rec => showWellDetails(rec))
  pouLayer = new PouLayer(map, store, onPouClick)
  diversionLayer = new DiversionLayer(map, store, d => showDiversionDetails(d, store))
  diversionLayer.setEnabled(true)
  // Core map: POD stars on; wells stay off until Explore asks for them.
  podLayer.setEnabled(true)
  wellLayer.setEnabled(false)

  staticLayers = await loadStaticLayers(map, store.reaches, {
    onFeatureClick: (feature, group) =>
      group === 'gages' ? showGageDetails(feature) : showGenericDetails(feature, group),
    onReachSelect: reachId => {
      state.reachFilter = reachId
      state.selectedWRs = new Set()
      syncReachSelect()
      refreshData()
    },
  }, { deferHeavy: true })
  staticLayers.setFlowEra(state.flowEra)

  const syncLayerCheckbox = (id: string, on: boolean) => {
    const el = document.getElementById(id) as HTMLInputElement | null
    if (el) el.checked = on
  }

  populateReachSelect(store)
  wireSidebar({
    refreshData,
    setLayerEnabled: (key, on) => {
      if (key === 'pods') {
        podLayer.setEnabled(on)
        pouLayer.setVisibleWRs(podLayer.visibleWRs())
      } else if (key === 'wells') {
        wellLayer.setEnabled(on)
      } else if (key === 'diversions') {
        diversionLayer.setEnabled(on)
      } else {
        if (on && (key === 'riparian' || key === 'hydro')) {
          void staticLayers.loadHeavy().then(() => {
            const group = staticLayers.groups[key]
            if (group) map.addLayer(group)
            updateLegendNow()
          })
          return
        }
        const group = staticLayers.groups[key]
        if (group) {
          if (on) map.addLayer(group)
          else map.removeLayer(group)
        }
      }
      updateLegendNow()
    },
    setBasemap: b => {
      currentBasemap = b
      basemap.set(b)
      updatePermalink()
    },
    setFlowEra: era => staticLayers.setFlowEra(era),
    onHighlightMode: mode => {
      if (mode === 'transfers') showTransfersOverview(store)
      else if (mode === 'conflict') showConflictsOverview(store)
      else if (mode === 'conjunctive') showConjunctivePanel(store)
    },
    onUiMode: mode => {
      state.hideNonMatches = lite || mode === 'story'
      if (mode === 'explore') {
        void staticLayers.loadHeavy()
        if (!podLayer.enabled) {
          podLayer.setEnabled(true)
          syncLayerCheckbox('layer-pods', true)
        }
        refreshData()
      }
      requestAnimationFrame(() => map.invalidateSize())
    },
    onSheetChange: () => {
      requestAnimationFrame(() => map.invalidateSize())
    },
    showAppropriation: () => showAppropriationPanel(store),
    showRiverShrink: () => showReachLossPanel(),
    showDryReach: () => showDryReachSeniorsPanel(store),
    setOwnerHighlight: owner => {
      state.ownerHighlight = owner
      state.selectedWRs = new Set()
      refreshData()
    },
    focusArco: () => {
      // USGS Arco gage vicinity — lower Big Lost
      map.setView([43.635, -113.30], 11)
    },
    resetAll: () => {
      if (timeline.isOpen()) timeline.close()
      resetState()
      if (lite) {
        state.placeOfUseMode = false
        state.hideNonMatches = true
      } else {
        state.placeOfUseMode = true
        state.hideNonMatches = true
      }
      syncSidebarToState()
      clearOwnerSearchUI()
      closeDetails()
      refreshData()
    },
  })
  syncSidebarToState()
  syncLayerCheckbox('layer-pods', podLayer.enabled)
  syncLayerCheckbox('layer-wells', wellLayer.enabled)
  syncLayerCheckbox('place-of-use-mode', state.placeOfUseMode)

  wireStory({
    refreshData,
    setFlowEra: era => staticLayers.setFlowEra(era),
    setView: (lat, lon, zoom) => map.setView([lat, lon], zoom),
    setPodsEnabled: on => {
      podLayer.setEnabled(on)
      syncLayerCheckbox('layer-pods', on)
    },
    setWellsEnabled: on => {
      wellLayer.setEnabled(on)
      syncLayerCheckbox('layer-wells', on)
    },
    showRiverShrink: () => showReachLossPanel(),
    showDryReach: () => showDryReachSeniorsPanel(store),
    showTransfers: () => showTransfersOverview(store),
    showConjunctive: () => showConjunctivePanel(store),
    onStepChange: i => {
      setStoryStepForHash(i)
      updatePermalink()
    },
  })

  setupOwnerSearch(store, {
    onSelect: owner => {
      state.ownerHighlight = owner
      state.selectedWRs = new Set()
      if (!podLayer.enabled) {
        podLayer.setEnabled(true)
        syncLayerCheckbox('layer-pods', true)
      }
      refreshData()
    },
    onClear: () => {
      state.ownerHighlight = null
      state.selectedWRs = new Set()
      refreshData()
    },
  })

  timeline = setupTimeline(store, {
    refreshData,
    setPouSuspended: on => pouLayer.setSuspended(on),
    syncSidebar: syncSidebarToState,
  })
  document.getElementById('timeline-btn')?.addEventListener('click', () => timeline.open())

  // Selection clearing: banner button, Esc, map background click
  document.getElementById('selection-clear')?.addEventListener('click', clearSelection)
  document.addEventListener('keydown', e => {
    // Esc closes the modal first (its own handler); only then clears selection
    if (e.key === 'Escape' && !isModalOpen()) clearSelection()
  })
  map.on('click', clearSelection)

  // Details panel: close button + zoom-to-right buttons (event delegation)
  document.getElementById('close-details')?.addEventListener('click', closeDetails)
  document.getElementById('details-content')?.addEventListener('click', e => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-zoom-wr]')
    if (btn?.dataset.zoomWr) zoomToWR(btn.dataset.zoomWr)
  })
  // Gage / WR zoom + step-down chart buttons (modal, gage popups, channel popups)
  document.addEventListener('click', e => {
    const t = e.target as HTMLElement
    const gageBtn = t.closest<HTMLElement>('[data-zoom-gage]')
    if (gageBtn?.dataset.zoomGage) zoomToGage(gageBtn.dataset.zoomGage)
    const wrBtn = t.closest<HTMLElement>('[data-zoom-wr]')
    if (wrBtn?.dataset.zoomWr && wrBtn.closest('#modal-content')) zoomToWR(wrBtn.dataset.zoomWr)
    if (t.closest('[data-show-shrink]')) showReachLossPanel()
  })

  map.on('moveend', updatePermalink)

  // First paint with POD stars available — purple field lines appear after POU loads.
  refreshData()
  setLoadStatus(lite ? 'Map ready — tap a ★ for purple field lines' : 'Map ready — loading fields in background…', 70)
  hideLoadOverlay()
  requestAnimationFrame(() => map.invalidateSize())

  // Story only when the user is in Story mode (or a shared story step link).
  const startInStory = getStoredUiMode() === 'story' || restored.storyStep != null
  if (startInStory) {
    goToStoryStep(restored.storyStep ?? 0, { openPanel: false })
  } else if (!restored.view) {
    // Bird's-eye default: lower basin where the dry-reach story is legible.
    map.setView([43.70, -113.32], 10)
  }

  // Stage 3: enrich POU in background; selection purple lines light up when ready.
  // Skip auto canals/NWI on phone — Explore / layer toggles pull them in.
  void (async () => {
    try {
      await enrichDataStoreWithPou(store, label => setLoadStatus(label, 85))
      if (state.placeOfUseMode) pouLayer.setVisibleWRs(podLayer.visibleWRs())
      else pouLayer.refreshSelection()
      if (!lite) await staticLayers.loadHeavy()
      setLoadStatus('Background data ready — click a ★ for purple links', 100)
    } catch (err) {
      console.error('Background layer load failed', err)
      setLoadStatus('Some layers failed to load', 100)
    }
  })()

  // A restored analysis view opens its overview panel like a user selection would
  if (state.highlightMode === 'transfers') showTransfersOverview(store)
  else if (state.highlightMode === 'conflict') showConflictsOverview(store)
  else if (state.highlightMode === 'conjunctive') showConjunctivePanel(store)

  // Debug handle
  ;(window as any).__basin34 = { map, store, state, lite, podLayer, wellLayer, pouLayer, goToStoryStep }
}

bootstrap()
