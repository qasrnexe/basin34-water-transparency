import { state } from '../state'
import type { FlowEra, HighlightMode } from '../types'
import { syncSidebarToState } from './sidebar'

export interface GuideStep {
  id: string
  kicker: string
  title: string
  body: string
  view?: { lat: number; lon: number; zoom: number }
  flowEra?: FlowEra
  highlightMode?: HighlightMode
  panel?: 'river-shrink' | 'dry-reach' | 'transfers' | null
  showPods?: boolean
  showWells?: boolean
}

/**
 * Geography-only guided walk. No private surnames.
 * Thin coach inside Explore — not a second app mode.
 */
export const GUIDE_STEPS: GuideStep[] = [
  {
    id: 'overview',
    kicker: 'Step 1 · Click a right',
    title: 'Every ★ is a point of diversion',
    body:
      'Zoom in and tap a star. The inspector opens that water right, and purple dashed lines connect the diversion to its place-of-use fields. That link — where water is taken vs where it is used — is the heart of this map.',
    view: { lat: 43.70, lon: -113.32, zoom: 11 },
    flowEra: 'recent',
    highlightMode: 'none',
    panel: null,
    showPods: true,
    showWells: false,
  },
  {
    id: 'then-now',
    kicker: 'Step 2 · Channel',
    title: 'Then the river reached the sinks. Now it often stops near Moore.',
    body:
      'Channel “Now” shows the mainstem dashed brown below Moore. USGS records show surface flow commonly ending long before Arco. Tap a gage for current CFS when the site still reports. Use Then vs now under Advanced to flip eras.',
    view: { lat: 43.72, lon: -113.28, zoom: 10 },
    flowEra: 'recent',
    highlightMode: 'none',
    panel: null,
    showPods: true,
    showWells: false,
  },
  {
    id: 'river-shrink',
    kicker: 'Step 3 · Gages',
    title: 'Mackay → Moore → Arco: where the water disappears',
    body:
      'Annual flow at three mainstem gages shows the step-down. Most of the loss happens before Arco. Open the receipt in the inspector for the full chart — the map stays visible.',
    view: { lat: 43.78, lon: -113.35, zoom: 10 },
    flowEra: 'recent',
    highlightMode: 'none',
    panel: 'river-shrink',
    showPods: false,
    showWells: false,
  },
  {
    id: 'dry-reach',
    kicker: 'Step 4 · Senior rights',
    title: 'Downstream seniors on a dry reach',
    body:
      'Pre-1950 surface rights on the corridor at or below Moore sit where the channel often goes dry. Open the ranked table + CSV in the inspector. Zoom any row to paint purple diversion↔field lines on the map.',
    view: { lat: 43.65, lon: -113.30, zoom: 11 },
    flowEra: 'recent',
    highlightMode: 'senior-downstream',
    panel: 'dry-reach',
    showPods: true,
    showWells: false,
  },
  {
    id: 'transfers',
    kicker: 'Step 5 · Moved farther',
    title: 'Water moved farther from the river corridor',
    body:
      'Some rights divert far from their authorized place of use; orange fills mark POUs off the natural corridor — a geometric proxy, not a liner inventory. On satellite, look for lined canals east or west of the river. Open the table + CSV in the inspector.',
    view: { lat: 43.85, lon: -113.45, zoom: 9 },
    flowEra: 'historical',
    highlightMode: 'transfers',
    panel: 'transfers',
    showPods: true,
    showWells: false,
  },
]

/** @deprecated Use GUIDE_STEPS */
export const STORY_STEPS = GUIDE_STEPS

export interface GuideCallbacks {
  refreshData: () => void
  setFlowEra: (era: FlowEra) => void
  setView: (lat: number, lon: number, zoom: number) => void
  setPodsEnabled: (on: boolean) => void
  setWellsEnabled: (on: boolean) => void
  showRiverShrink: () => void
  showDryReach: () => void
  showTransfers: () => void
  onStepChange?: (index: number | null) => void
  ensureCanalsVisible?: () => void
  onGuideActiveChange?: (active: boolean) => void
}

let currentIndex = 0
let guideActive = false
let cbs: GuideCallbacks | null = null

export function isGuideActive(): boolean {
  return guideActive
}

export function getGuideStepIndex(): number {
  return currentIndex
}

/** @deprecated */
export function getStoryStepIndex(): number {
  return getGuideStepIndex()
}

export function setGuideStepIndex(i: number) {
  currentIndex = Math.max(0, Math.min(GUIDE_STEPS.length - 1, i))
}

/** @deprecated */
export function setStoryStepIndex(i: number) {
  setGuideStepIndex(i)
}

const RECEIPT_BTN_LABEL: Record<string, string> = {
  'river-shrink': 'Open river-shrink chart',
  'dry-reach': 'Open seniors table + CSV',
  transfers: 'Open moved-farther table + CSV',
}

function coachEl(): HTMLElement | null {
  return document.getElementById('guide-coach')
}

function renderCoachChrome(index: number) {
  const step = GUIDE_STEPS[index]
  const kicker = document.getElementById('guide-kicker')
  const title = document.getElementById('guide-title')
  const body = document.getElementById('guide-body')
  const counter = document.getElementById('guide-step-counter')
  const prev = document.getElementById('guide-prev') as HTMLButtonElement | null
  const next = document.getElementById('guide-next') as HTMLButtonElement | null
  const dots = document.getElementById('guide-dots')
  const receiptBtn = document.getElementById('guide-receipt-btn') as HTMLButtonElement | null

  if (kicker) kicker.textContent = step.kicker
  if (title) title.textContent = step.title
  if (body) body.textContent = step.body
  if (counter) counter.textContent = `${index + 1} / ${GUIDE_STEPS.length}`
  if (prev) prev.disabled = index <= 0
  if (next) {
    next.disabled = false
    next.textContent = index >= GUIDE_STEPS.length - 1 ? 'Done' : 'Next →'
  }
  if (dots) {
    dots.innerHTML = GUIDE_STEPS.map((_, i) =>
      `<button type="button" class="story-dot${i === index ? ' active' : ''}" data-guide-step="${i}" aria-label="Go to step ${i + 1}"></button>`,
    ).join('')
  }
  if (receiptBtn) {
    if (step.panel) {
      receiptBtn.classList.remove('hidden')
      receiptBtn.textContent = RECEIPT_BTN_LABEL[step.panel] || 'Open receipt'
    } else {
      receiptBtn.classList.add('hidden')
    }
  }
}

function openStepReceipt(step: GuideStep) {
  if (!cbs || !step.panel) return
  if (step.panel === 'river-shrink') cbs.showRiverShrink()
  else if (step.panel === 'dry-reach') cbs.showDryReach()
  else if (step.panel === 'transfers') cbs.showTransfers()
}

function setCoachVisible(on: boolean) {
  const el = coachEl()
  el?.classList.toggle('hidden', !on)
  document.body.classList.toggle('guide-active', on)
  cbs?.onGuideActiveChange?.(on)
}

/** Apply map + caption for a guide step. */
export function goToGuideStep(index: number, options: { openReceipt?: boolean } = {}) {
  if (!cbs || !guideActive) return
  const openReceipt = options.openReceipt === true
  currentIndex = Math.max(0, Math.min(GUIDE_STEPS.length - 1, index))
  const step = GUIDE_STEPS[currentIndex]

  if (step.flowEra) {
    state.flowEra = step.flowEra
    cbs.setFlowEra(step.flowEra)
  }
  if (step.highlightMode != null) {
    state.highlightMode = step.highlightMode
  }
  state.ownerHighlight = null
  state.selectedWRs = new Set()

  const showPods = step.showPods ?? (step.highlightMode != null && step.highlightMode !== 'none')
  cbs.setPodsEnabled(showPods)
  cbs.setWellsEnabled(!!step.showWells)

  if (step.highlightMode === 'transfers') {
    cbs.ensureCanalsVisible?.()
  }

  syncSidebarToState()
  cbs.refreshData()
  renderCoachChrome(currentIndex)

  if (step.view) {
    cbs.setView(step.view.lat, step.view.lon, step.view.zoom)
  }

  if (openReceipt) openStepReceipt(step)

  cbs.onStepChange?.(currentIndex)
}

/** @deprecated */
export function goToStoryStep(index: number, options: { openPanel?: boolean } = {}) {
  if (!guideActive) startGuide(index)
  else goToGuideStep(index, { openReceipt: options.openPanel === true })
}

export function startGuide(index = 0) {
  if (!cbs) return
  guideActive = true
  setCoachVisible(true)
  goToGuideStep(index, { openReceipt: false })
}

export function dismissGuide() {
  guideActive = false
  setCoachVisible(false)
  cbs?.onStepChange?.(null)
}

export function wireGuide(callbacks: GuideCallbacks) {
  cbs = callbacks
  setCoachVisible(false)

  document.getElementById('guide-start-btn')?.addEventListener('click', () => {
    startGuide(0)
  })
  document.getElementById('guide-dismiss')?.addEventListener('click', () => {
    dismissGuide()
  })
  document.getElementById('guide-prev')?.addEventListener('click', () => {
    if (currentIndex > 0) goToGuideStep(currentIndex - 1)
  })
  document.getElementById('guide-next')?.addEventListener('click', () => {
    if (currentIndex >= GUIDE_STEPS.length - 1) {
      dismissGuide()
      return
    }
    goToGuideStep(currentIndex + 1)
  })
  document.getElementById('guide-dots')?.addEventListener('click', e => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-guide-step]')
    if (!btn) return
    const i = parseInt(btn.dataset.guideStep || '', 10)
    if (isFinite(i)) goToGuideStep(i)
  })
  document.getElementById('guide-receipt-btn')?.addEventListener('click', () => {
    openStepReceipt(GUIDE_STEPS[currentIndex])
  })
}

/** @deprecated */
export function wireStory(callbacks: GuideCallbacks & { showConjunctive?: () => void }) {
  wireGuide(callbacks)
}
