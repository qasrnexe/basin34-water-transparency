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
import { wireSidebar, populateReachSelect, syncSidebarToState, syncReachSelect, loadDataAsOf } from './ui/sidebar'
import { updateLegend } from './ui/legend'
import { setupTimeline, type TimelineControl } from './ui/timeline'
import { setupOwnerSearch, clearOwnerSearchUI } from './ui/ownerSearch'
import {
  closeDetails, FLOW_STEP_GAGES, getReceiptReopen, isDetailsOpen, isDetailsPinned,
  showAppropriationPanel, showConjunctivePanel, showConflictsOverview, showDiversionDetails,
  showDryReachSeniorsPanel, showGageDetails, showGenericDetails, showPodDetails, showPouGroupDetails,
  showReachLossPanel, showTransfersOverview, showWellDetails,
} from './ui/details'
import { dismissGuide, goToGuideStep, setGuideStepIndex, startGuide, wireGuide } from './ui/story'

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

function refreshData() {
  podLayer.rebuild()
  wellLayer.rebuild()
  pouLayer.setVisibleWRs(podLayer.visibleWRs())
  selectionForcedRebuild = false
  updateLegendNow()
  updateSelectionBanner()
  updatePermalink()
}

function setSelection(wrs: Set<string>) {
  const affected = new Set([...state.selectedWRs, ...wrs])
  state.selectedWRs = wrs

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
  // Pinned receipts (CSV/charts) stay open so Zoom-from-table keeps context
  if (!isDetailsPinned()) closeDetails()
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

function onPodClick(rec: PodRecord) {
  setSelection(rec.wr ? new Set([rec.wr]) : new Set())
  showPodDetails(rec, store)
}

function onPouClick(feature: GeoFeature) {
  const wr = (feature.properties?.WaterRightNumber || '').trim()
  if (!wr) return
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

/** Zoom + select + optional Back-to-list when coming from a receipt table. */
function focusWRFromReceipt(wr: string) {
  zoomToWR(wr)
  setSelection(new Set([wr]))
  const rec = store.podsByWR.get(wr)?.[0]
  if (rec) showPodDetails(rec, store, { fromReceipt: !!getReceiptReopen() })
}

const GAGE_COORDS: Record<string, [number, number]> = {
  ...Object.fromEntries(Object.values(FLOW_STEP_GAGES).map(g => [g.site, [g.lat, g.lon]])),
  '13132580': [43.7965727, -112.8502748],
}

function zoomToGage(site: string) {
  const c = GAGE_COORDS[site]
  if (c) map.setView(c, 12)
}

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

  const restored = applyHashToState()
  if (restored.basemap) {
    currentBasemap = restored.basemap
    basemap.set(restored.basemap)
  }
  if (restored.view && restored.storyStep == null) {
    map.setView([restored.view.lat, restored.view.lng], restored.view.zoom)
  }
  if (restored.storyStep != null) setGuideStepIndex(restored.storyStep)

  setLoadStatus('Loading water rights…', 20)
  store = await loadDataStoreLight(label => setLoadStatus(label, 35))

  setLoadStatus('Drawing channels & gages…', 50)
  podLayer = new PodLayer(map, store, onPodClick, { lite })
  wellLayer = new WellLayer(map, store, rec => showWellDetails(rec))
  pouLayer = new PouLayer(map, store, onPouClick)
  diversionLayer = new DiversionLayer(map, store, d => showDiversionDetails(d, store))
  diversionLayer.setEnabled(true)
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

  const ensureCanalsVisible = () => {
    syncLayerCheckbox('layer-hydro', true)
    void staticLayers.loadHeavy().then(() => {
      const group = staticLayers.groups.hydro
      if (group && !map.hasLayer(group)) map.addLayer(group)
      updateLegendNow()
    })
  }

  // Desktop: pull heavy layers; phones wait for toggles / Guide
  if (!lite) void staticLayers.loadHeavy()

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
    // Map emphasis — primary receipts open via Insight buttons only.
    // Conflict is Advanced-only and its ranked list is the point of that lens.
    onHighlightMode: mode => {
      if (mode === 'transfers') ensureCanalsVisible()
      if (mode === 'conflict') showConflictsOverview(store)
    },
    onSheetChange: () => {
      requestAnimationFrame(() => map.invalidateSize())
    },
    showAppropriation: () => showAppropriationPanel(store),
    showRiverShrink: () => showReachLossPanel(),
    showDryReach: () => showDryReachSeniorsPanel(store),
    showMovedFarther: () => {
      ensureCanalsVisible()
      showTransfersOverview(store)
    },
    showConjunctive: () => showConjunctivePanel(store),
    setOwnerHighlight: owner => {
      state.ownerHighlight = owner
      state.selectedWRs = new Set()
      refreshData()
    },
    resetAll: () => {
      if (timeline.isOpen()) timeline.close()
      dismissGuide()
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

  wireGuide({
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
    showTransfers: () => {
      ensureCanalsVisible()
      showTransfersOverview(store)
    },
    ensureCanalsVisible,
    onStepChange: i => {
      setStoryStepForHash(i)
      updatePermalink()
    },
    onGuideActiveChange: () => {
      requestAnimationFrame(() => map.invalidateSize())
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

  document.getElementById('selection-clear')?.addEventListener('click', clearSelection)
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return
    if (isDetailsOpen()) {
      closeDetails()
      return
    }
    clearSelection()
  })
  map.on('click', clearSelection)

  document.getElementById('close-details')?.addEventListener('click', closeDetails)
  document.getElementById('details-content')?.addEventListener('click', e => {
    const t = e.target as HTMLElement
    if (t.closest('[data-back-receipt]')) {
      getReceiptReopen()?.()
      return
    }
    const btn = t.closest<HTMLElement>('[data-zoom-wr]')
    if (btn?.dataset.zoomWr) {
      if (getReceiptReopen()) focusWRFromReceipt(btn.dataset.zoomWr)
      else zoomToWR(btn.dataset.zoomWr)
    }
  })
  document.addEventListener('click', e => {
    const t = e.target as HTMLElement
    const gageBtn = t.closest<HTMLElement>('[data-zoom-gage]')
    if (gageBtn?.dataset.zoomGage) zoomToGage(gageBtn.dataset.zoomGage)
    if (t.closest('[data-show-shrink]')) showReachLossPanel()
  })

  map.on('moveend', updatePermalink)

  refreshData()
  setLoadStatus(lite ? 'Map ready — tap a ★ for purple field lines' : 'Map ready — loading fields in background…', 70)
  hideLoadOverlay()
  requestAnimationFrame(() => map.invalidateSize())

  if (restored.storyStep != null) {
    startGuide(restored.storyStep)
  } else if (!restored.view) {
    map.setView([43.70, -113.32], 10)
  }

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

  // Debug handle
  ;(window as any).__basin34 = { map, store, state, lite, podLayer, wellLayer, pouLayer, goToGuideStep, startGuide }
}

bootstrap()
