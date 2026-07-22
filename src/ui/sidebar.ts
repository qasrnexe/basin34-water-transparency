import type { DataStore } from '../data'
import { state } from '../state'
import type { Basemap, FlowEra, HighlightMode } from '../types'
import { MODE_HINTS } from './legend'

export type UiMode = 'story' | 'explore'

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
  /** Dry-reach seniors ranked table + CSV. */
  showDryReach?: () => void
  /** Water moved farther ranked table + CSV. */
  showMovedFarther?: () => void
  /** Conjunctive / GW boom panel. */
  showConjunctive?: () => void
  /** Permalink / persistence hook when UI mode changes. */
  onUiMode?: (mode: UiMode) => void
  /** Mobile bottom-sheet expanded/collapsed (map should invalidateSize). */
  onSheetChange?: () => void
  /** Owner highlight (story presets). */
  setOwnerHighlight?: (owner: string | null) => void
  /** Zoom map to lower basin / Arco area. */
  focusArco?: () => void
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T | null

function input(id: string): HTMLInputElement | null {
  return $<HTMLInputElement>(id)
}

const MODE_KEY = 'basin34-ui-mode-v2'

export function getStoredUiMode(): UiMode {
  const v = localStorage.getItem(MODE_KEY)
  // Default Explore — the POD click → purple field lines workflow is the core map.
  if (v === 'story') return 'story'
  return 'explore'
}

export function applyUiMode(mode: UiMode) {
  const story = $('story-panel')
  const explore = $('explore-panel')
  story?.classList.toggle('hidden', mode !== 'story')
  explore?.classList.toggle('hidden', mode !== 'explore')
  document.querySelectorAll<HTMLButtonElement>('.mode-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode)
  })
  localStorage.setItem(MODE_KEY, mode)
  document.body.dataset.uiMode = mode
  // Explore needs room for controls; Story can stay collapsed on phones.
  if (mode === 'explore' && isMobileSheet()) setSheetExpanded(true)
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
    if (label) label.textContent = expanded ? 'Hide panel' : 'Story & tools'
  }
}

function wireMobileSheet(cb: SidebarCallbacks) {
  // Default: collapsed peek so the map dominates on phones.
  if (isMobileSheet()) {
    setSheetExpanded(document.body.dataset.uiMode === 'explore')
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
      setSheetExpanded(document.body.dataset.uiMode === 'explore')
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
  document.querySelectorAll<HTMLButtonElement>('.era-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.era === state.flowEra)
  })
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
  // Story / Explore mode
  const initialMode = getStoredUiMode()
  applyUiMode(initialMode)
  cb.onUiMode?.(initialMode)
  wireMobileSheet(cb)

  document.querySelectorAll<HTMLButtonElement>('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = (btn.dataset.mode as UiMode) || 'story'
      applyUiMode(mode)
      cb.onUiMode?.(mode)
    })
  })
  $('open-explore-btn')?.addEventListener('click', () => {
    applyUiMode('explore')
    cb.onUiMode?.('explore')
  })

  // Story presets
  document.querySelectorAll<HTMLButtonElement>('.preset-btn[data-preset]').forEach(btn => {
    btn.addEventListener('click', () => {
      const preset = btn.dataset.preset
      if (preset === 'river-shrink') {
        cb.showRiverShrink?.()
        return
      }
      if (preset === 'dry-reach') {
        cb.showDryReach?.()
        return
      }
      if (preset === 'senior') {
        setHighlightMode('senior-downstream', cb)
        return
      }
      if (preset === 'conjunctive') {
        setHighlightMode('conjunctive', cb)
        return
      }
      if (preset === 'transfers') {
        setHighlightMode('transfers', cb)
        cb.showMovedFarther?.()
        return
      }
      if (preset === 'then-now') {
        state.flowEra = 'recent'
        syncEraButtons()
        cb.setFlowEra('recent')
        return
      }
      if (preset === 'arco') {
        // Legacy preset — lower basin focus near Arco gage
        state.flowEra = 'recent'
        syncEraButtons()
        cb.setFlowEra('recent')
        setHighlightMode('senior-downstream', cb)
        cb.focusArco?.()
        return
      }
    })
  })

  document.querySelectorAll<HTMLButtonElement>('.era-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const era = btn.dataset.era as FlowEra
      state.flowEra = era
      syncEraButtons()
      cb.setFlowEra(era)
    })
  })

  // Layer toggles
  for (const key of ['boundary', 'riparian', 'hydro', 'pods', 'wells', 'gages', 'flowExtent', 'reaches', 'diversions']) {
    input(`layer-${key}`)?.addEventListener('change', e => {
      cb.setLayerEnabled(key, (e.target as HTMLInputElement).checked)
    })
  }

  // Analysis view
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

  // Flow extent era (explore radios)
  document.querySelectorAll<HTMLInputElement>('input[name="era"]').forEach(radio => {
    radio.addEventListener('change', () => {
      state.flowEra = radio.value as FlowEra
      syncEraButtons()
      cb.setFlowEra(state.flowEra)
    })
  })

  // Basemap (story + explore switchers)
  document.querySelectorAll<HTMLButtonElement>('.basemap-btn').forEach(btn => {
    btn.addEventListener('click', () => cb.setBasemap(btn.dataset.basemap as Basemap))
  })

  // Reset
  $('reset-all')?.addEventListener('click', cb.resetAll)

  // Share
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

  // About
  $('info-btn')?.addEventListener('click', () => {
    alert(
      'Basin 34 Water Transparency\n\n' +
      'Core move: tap a ★ POD (point of diversion). Purple dashed lines connect that takeout to its place-of-use fields, and the side panel shows the water right.\n\n' +
      'Explore is the default map. Story walks three receipts: dry channel, downstream seniors (CSV), and water moved farther (CSV). Advanced tools stay nested.\n\n' +
      'This is a community transparency tool, not legal advice. For rights, administration, or legal matters, use official IDWR and Water District 34 resources.\n\n' +
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
