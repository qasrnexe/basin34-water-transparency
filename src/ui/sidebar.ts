import type { DataStore } from '../data'
import { state } from '../state'
import type { Basemap, FlowEra, HighlightMode } from '../types'
import { MODE_HINTS } from './legend'

export interface SidebarCallbacks {
  refreshData: () => void
  setLayerEnabled: (key: string, on: boolean) => void
  setBasemap: (b: Basemap) => void
  setFlowEra: (era: FlowEra) => void
  resetAll: () => void
  /** Map emphasis changed — do not auto-open receipts. */
  onHighlightMode?: (mode: HighlightMode) => void
  showAppropriation?: () => void
  showRiverShrink?: () => void
  showDryReach?: () => void
  showMovedFarther?: () => void
  showConjunctive?: () => void
  onSheetChange?: () => void
  setOwnerHighlight?: (owner: string | null) => void
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T | null

function input(id: string): HTMLInputElement | null {
  return $<HTMLInputElement>(id)
}

function isMobileSheet(): boolean {
  return window.matchMedia('(max-width: 768px)').matches
}

export function setSheetExpanded(expanded: boolean) {
  document.body.classList.toggle('sheet-expanded', expanded)
  document.body.classList.toggle('sheet-collapsed', !expanded)
  const handle = $('sheet-handle')
  if (handle) {
    handle.setAttribute('aria-expanded', expanded ? 'true' : 'false')
    const label = handle.querySelector('.sheet-handle-label')
    if (label) label.textContent = expanded ? 'Hide panel' : 'Tools'
  }
}

function wireMobileSheet(cb: SidebarCallbacks) {
  if (isMobileSheet()) {
    setSheetExpanded(false)
  } else {
    document.body.classList.remove('sheet-expanded', 'sheet-collapsed')
  }

  $('sheet-handle')?.addEventListener('click', () => {
    if (!isMobileSheet()) return
    const next = !document.body.classList.contains('sheet-expanded')
    setSheetExpanded(next)
    cb.onSheetChange?.()
  })

  window.matchMedia('(max-width: 768px)').addEventListener('change', e => {
    if (e.matches) {
      setSheetExpanded(false)
    } else {
      document.body.classList.remove('sheet-expanded', 'sheet-collapsed')
    }
    cb.onSheetChange?.()
  })
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

function syncEraButtons() {
  document.querySelectorAll<HTMLInputElement>('input[name="era"]').forEach(r => {
    r.checked = r.value === state.flowEra
  })
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
  syncEraButtons()
}

function setHighlightMode(mode: HighlightMode, cb: SidebarCallbacks) {
  state.highlightMode = mode
  const modeSel = $<HTMLSelectElement>('highlight-mode')
  if (modeSel) modeSel.value = mode
  updateModeHint()
  cb.refreshData()
  cb.onHighlightMode?.(mode)
}

export function wireSidebar(cb: SidebarCallbacks) {
  wireMobileSheet(cb)
  document.body.dataset.uiMode = 'explore'

  // Layer toggles
  for (const key of ['boundary', 'riparian', 'hydro', 'pods', 'wells', 'gages', 'flowExtent', 'reaches', 'diversions']) {
    input(`layer-${key}`)?.addEventListener('change', e => {
      cb.setLayerEnabled(key, (e.target as HTMLInputElement).checked)
    })
  }

  // Map emphasis — map only; receipts open via Insight buttons
  $<HTMLSelectElement>('highlight-mode')?.addEventListener('change', e => {
    setHighlightMode((e.target as HTMLSelectElement).value as HighlightMode, cb)
  })
  input('high-rate-threshold')?.addEventListener('change', e => {
    const v = parseFloat((e.target as HTMLInputElement).value)
    if (isFinite(v)) state.highRateThreshold = v
    cb.refreshData()
  })
  $<HTMLSelectElement>('reach-select')?.addEventListener('change', e => {
    state.reachFilter = (e.target as HTMLSelectElement).value
    cb.refreshData()
  })
  input('place-of-use-mode')?.addEventListener('change', e => {
    state.placeOfUseMode = (e.target as HTMLInputElement).checked
    cb.refreshData()
  })

  $('appropriation-btn')?.addEventListener('click', () => cb.showAppropriation?.())
  $('river-shrink-btn')?.addEventListener('click', () => cb.showRiverShrink?.())
  $('dry-reach-btn')?.addEventListener('click', () => cb.showDryReach?.())
  $('moved-farther-btn')?.addEventListener('click', () => {
    setHighlightMode('transfers', cb)
    cb.showMovedFarther?.()
  })
  $('conjunctive-btn')?.addEventListener('click', () => {
    setHighlightMode('conjunctive', cb)
    cb.showConjunctive?.()
  })

  // POD filters
  $<HTMLSelectElement>('pod-color-mode')?.addEventListener('change', e => {
    state.podColorMode = (e.target as HTMLSelectElement).value as 'source' | 'priority'
    cb.refreshData()
  })
  for (const [id, apply] of [
    ['pod-filter-gw', (on: boolean) => { state.showGW = on }],
    ['pod-filter-surf', (on: boolean) => { state.showSurface = on }],
    ['era-pre1950', (on: boolean) => { state.eras.pre1950 = on }],
    ['era-mid', (on: boolean) => { state.eras.mid = on }],
    ['era-post2000', (on: boolean) => { state.eras.post2000 = on }],
    ['well-hide-domestic', (on: boolean) => { state.hideDomestic = on }],
    ['well-focus-irrigation', (on: boolean) => { state.focusIrrigation = on }],
  ] as const) {
    input(id)?.addEventListener('change', e => {
      apply((e.target as HTMLInputElement).checked)
      cb.refreshData()
    })
  }
  input('pod-min-year')?.addEventListener('change', e => {
    state.yearMin = parseInt((e.target as HTMLInputElement).value, 10) || 1800
    cb.refreshData()
  })
  input('pod-max-year')?.addEventListener('change', e => {
    state.yearMax = parseInt((e.target as HTMLInputElement).value, 10) || 2026
    cb.refreshData()
  })

  document.querySelectorAll<HTMLInputElement>('input[name="era"]').forEach(radio => {
    radio.addEventListener('change', () => {
      state.flowEra = radio.value as FlowEra
      syncEraButtons()
      cb.setFlowEra(state.flowEra)
    })
  })

  document.querySelectorAll<HTMLButtonElement>('.basemap-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll<HTMLButtonElement>('.basemap-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.basemap === btn.dataset.basemap)
      })
      cb.setBasemap(btn.dataset.basemap as Basemap)
    })
  })

  $('reset-all')?.addEventListener('click', cb.resetAll)

  const shareBtn = $('share-btn')
  shareBtn?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(location.href)
      const orig = shareBtn.textContent
      shareBtn.textContent = 'Link copied'
      setTimeout(() => { shareBtn.textContent = orig }, 1500)
    } catch {
      prompt('Copy this link:', location.href)
    }
  })

  $('info-btn')?.addEventListener('click', () => {
    alert(
      'Basin 34 Water Transparency\n\n' +
      'Core move: tap a ★ POD (point of diversion). Purple dashed lines connect that takeout to its place-of-use fields.\n\n' +
      'Walk the receipts (header) is a short guided tour. Explore is the workspace — insight receipts open in the side inspector so the map stays visible.\n\n' +
      'This is a community transparency tool, not legal advice.\n\n' +
      'Share view copies a permalink to the current map.',
    )
  })

  updateModeHint()
}

/** Fill the "Data as of" chip from public/data/manifest.json */
export async function loadDataAsOf() {
  const el = $('data-as-of')
  if (!el) return
  try {
    const res = await fetch('/data/manifest.json')
    const man = await res.json()
    const asOf = man.generated || man.layers?.['wd34-pods']?.asOf
    el.textContent = asOf ? `Data as of ${asOf}` : 'Data date unknown'
  } catch {
    el.textContent = 'Data date unavailable'
  }
}
