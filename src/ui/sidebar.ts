import type { DataStore } from '../data'
import { state } from '../state'
import type { Basemap, FlowEra, HighlightMode } from '../types'
import { MODE_HINTS } from './legend'

export interface SidebarCallbacks {
  /** Filters changed: rebuild layers and legend. */
  refreshData: () => void
  setLayerEnabled: (key: string, on: boolean) => void
  setBasemap: (b: Basemap) => void
  setFlowEra: (era: FlowEra) => void
  resetAll: () => void
  /** Analysis view changed (called after refreshData). */
  onHighlightMode?: (mode: HighlightMode) => void
  /** "Appropriation vs. supply" button. */
  showAppropriation?: () => void
  /** "River shrink: Mackay → Moore → Arco" button. */
  showRiverShrink?: () => void
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T | null

function input(id: string): HTMLInputElement | null {
  return $<HTMLInputElement>(id)
}

export function populateReachSelect(store: DataStore) {
  const sel = $<HTMLSelectElement>('reach-select')
  if (!sel) return
  while (sel.options.length > 1) sel.remove(1)
  for (const f of store.reaches) {
    const p = f.properties || {}
    const opt = document.createElement('option')
    opt.value = p.reach_id || ''
    opt.textContent = p.name || p.reach_id || 'Reach'
    sel.appendChild(opt)
  }
}

export function syncReachSelect() {
  const sel = $<HTMLSelectElement>('reach-select')
  if (sel) sel.value = state.reachFilter
}

function updateModeHint() {
  const hint = $('mode-hint')
  if (hint) hint.innerHTML = MODE_HINTS[state.highlightMode] || ''
}

/** Reflect current state into all sidebar inputs (used on init and reset). */
export function syncSidebarToState() {
  const set = (id: string, checked: boolean) => { const el = input(id); if (el) el.checked = checked }
  const setVal = (id: string, v: string) => { const el = input(id); if (el) el.value = v }

  const modeSel = $<HTMLSelectElement>('highlight-mode')
  if (modeSel) modeSel.value = state.highlightMode
  updateModeHint()
  setVal('high-rate-threshold', String(state.highRateThreshold))
  syncReachSelect()
  set('place-of-use-mode', state.placeOfUseMode)
  const colorSel = $<HTMLSelectElement>('pod-color-mode')
  if (colorSel) colorSel.value = state.podColorMode
  set('pod-filter-gw', state.showGW)
  set('pod-filter-surf', state.showSurface)
  set('era-pre1950', state.eras.pre1950)
  set('era-mid', state.eras.mid)
  set('era-post2000', state.eras.post2000)
  setVal('pod-min-year', String(state.yearMin))
  setVal('pod-max-year', String(state.yearMax))
  set('well-hide-domestic', state.hideDomestic)
  set('well-focus-irrigation', state.focusIrrigation)
  document.querySelectorAll<HTMLInputElement>('input[name="era"]').forEach(r => {
    r.checked = r.value === state.flowEra
  })
}

export function wireSidebar(cb: SidebarCallbacks) {
  // Layer toggles
  for (const key of ['boundary', 'riparian', 'hydro', 'pods', 'wells', 'gages', 'flowExtent', 'reaches', 'diversions']) {
    input(`layer-${key}`)?.addEventListener('change', e => {
      cb.setLayerEnabled(key, (e.target as HTMLInputElement).checked)
    })
  }

  // Analysis view
  const modeSel = $<HTMLSelectElement>('highlight-mode')
  modeSel?.addEventListener('change', () => {
    state.highlightMode = modeSel.value as HighlightMode
    state.selectedWRs = new Set()
    updateModeHint()
    cb.refreshData()
    cb.onHighlightMode?.(state.highlightMode)
  })

  $('appropriation-btn')?.addEventListener('click', () => cb.showAppropriation?.())
  $('river-shrink-btn')?.addEventListener('click', () => cb.showRiverShrink?.())

  input('high-rate-threshold')?.addEventListener('change', e => {
    state.highRateThreshold = parseFloat((e.target as HTMLInputElement).value) || 5
    cb.refreshData()
  })

  const reachSel = $<HTMLSelectElement>('reach-select')
  reachSel?.addEventListener('change', () => {
    state.reachFilter = reachSel.value
    state.selectedWRs = new Set()
    cb.refreshData()
  })

  input('place-of-use-mode')?.addEventListener('change', e => {
    state.placeOfUseMode = (e.target as HTMLInputElement).checked
    if (!state.placeOfUseMode) state.selectedWRs = new Set()
    cb.refreshData()
  })

  // POD filters
  const colorSel = $<HTMLSelectElement>('pod-color-mode')
  colorSel?.addEventListener('change', () => {
    state.podColorMode = colorSel.value as 'source' | 'priority'
    cb.refreshData()
  })
  input('pod-filter-gw')?.addEventListener('change', e => {
    state.showGW = (e.target as HTMLInputElement).checked
    cb.refreshData()
  })
  input('pod-filter-surf')?.addEventListener('change', e => {
    state.showSurface = (e.target as HTMLInputElement).checked
    cb.refreshData()
  })
  input('era-pre1950')?.addEventListener('change', e => {
    state.eras.pre1950 = (e.target as HTMLInputElement).checked
    cb.refreshData()
  })
  input('era-mid')?.addEventListener('change', e => {
    state.eras.mid = (e.target as HTMLInputElement).checked
    cb.refreshData()
  })
  input('era-post2000')?.addEventListener('change', e => {
    state.eras.post2000 = (e.target as HTMLInputElement).checked
    cb.refreshData()
  })
  input('pod-min-year')?.addEventListener('change', e => {
    state.yearMin = parseInt((e.target as HTMLInputElement).value, 10) || 1800
    cb.refreshData()
  })
  input('pod-max-year')?.addEventListener('change', e => {
    state.yearMax = parseInt((e.target as HTMLInputElement).value, 10) || 2026
    cb.refreshData()
  })

  // Well filters
  input('well-hide-domestic')?.addEventListener('change', e => {
    state.hideDomestic = (e.target as HTMLInputElement).checked
    cb.refreshData()
  })
  input('well-focus-irrigation')?.addEventListener('change', e => {
    state.focusIrrigation = (e.target as HTMLInputElement).checked
    cb.refreshData()
  })

  // Flow extent era
  document.querySelectorAll<HTMLInputElement>('input[name="era"]').forEach(radio => {
    radio.addEventListener('change', () => {
      state.flowEra = radio.value as FlowEra
      cb.setFlowEra(state.flowEra)
    })
  })

  // Basemap
  document.querySelectorAll<HTMLButtonElement>('#basemap-switcher .basemap-btn').forEach(btn => {
    btn.addEventListener('click', () => cb.setBasemap(btn.dataset.basemap as Basemap))
  })

  // Reset
  $('reset-all')?.addEventListener('click', cb.resetAll)

  // Share (the hash is kept up to date by main.ts; just copy the URL)
  const shareBtn = $('share-btn')
  shareBtn?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(location.href)
      const orig = shareBtn.textContent
      shareBtn.textContent = '✓ Link copied'
      setTimeout(() => { shareBtn.textContent = orig }, 1500)
    } catch {
      prompt('Copy this link:', location.href)
    }
  })

  // Info
  $('info-btn')?.addEventListener('click', () => {
    alert(
      'Basin 34 Water Transparency\n\n' +
      'Public viewer for WD34 / Big Lost River Basin: IDWR PODs (7k+), wells (4k+), Place of Use polygons, ' +
      'USGS gages and a historical-vs-recent surface flow extent proxy.\n\n' +
      'Use the Analysis views to investigate patterns: senior downstream rights, post-1980 development, ' +
      'potential transfers (POD far from place of use), potential conflicts, and the conjunctive view ' +
      '(post-1950 groundwater boom vs. senior surface rights).\n\n' +
      'The ▶ timeline animates development through time; 🔗 Share view copies a link to the exact current view.\n\n' +
      'All neutral, sourced visualizations of public data. See footer and details panels for attribution.',
    )
  })

  updateModeHint()
}
