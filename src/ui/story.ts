import { state } from '../state'
import type { FlowEra, HighlightMode } from '../types'
import { syncSidebarToState } from './sidebar'

export interface StoryStep {
  id: string
  kicker: string
  title: string
  body: string
  /** Map center [lat, lon] + zoom when entering the step. */
  view?: { lat: number; lon: number; zoom: number }
  flowEra?: FlowEra
  highlightMode?: HighlightMode
  /** Optional panel to open after map state applies. */
  panel?: 'river-shrink' | 'dry-reach' | 'transfers' | 'conjunctive' | null
  /** Paint POD markers for this step (default: only when an analysis lens is on). */
  showPods?: boolean
  /** Paint wells for this step (default: false — wells are heavy on phones). */
  showWells?: boolean
}

/**
 * Geography-only guided story. No private surnames.
 * Three receipts: dry channel → seniors CSV → water moved farther CSV.
 * Order: overview → then/now → river shrink → dry-reach → moved farther.
 */
export const STORY_STEPS: StoryStep[] = [
  {
    id: 'overview',
    kicker: 'Step 1 · Click a right',
    title: 'Every ★ is a point of diversion',
    body:
      'Zoom in and tap a star. The details panel opens that water right, and purple dashed lines connect the diversion to its place-of-use fields. That link — where water is taken vs where it is used — is the heart of this map.',
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
      'Switch the channel to “Now”: below the Moore diversion the mainstem is dashed brown. USGS records and district accounting show surface flow commonly ending long before Arco or the historic sinks near Howe. Tap a gage for current CFS when the site still reports.',
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
      'Annual flow at three mainstem gages shows the step-down. Most of the loss happens before Arco; the Arco gage often reads near zero in recent years. Open the chart for the full record.',
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
      'Pre-1950 surface rights on the corridor at or below Moore sit where the channel often goes dry — including the lower river near Arco. The ranked table (and CSV) is a public-data proxy — not a legal finding. Zoom any row to its point of diversion. Groundwater expansion vs seniors lives in Explore.',
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
      'Some rights divert far from their authorized place of use; orange fills mark POUs off the natural corridor. That is a geometric proxy from IDWR layers — not a transfer filing, not a liner inventory, and not a count of canals built in the last decade. On satellite, look for lined canals carrying water east or west of the river onto newer ground. Open the table + CSV for the ranked list.',
    view: { lat: 43.85, lon: -113.45, zoom: 9 },
    flowEra: 'historical',
    highlightMode: 'transfers',
    panel: 'transfers',
    showPods: true,
    showWells: false,
  },
]

export interface StoryCallbacks {
  refreshData: () => void
  setFlowEra: (era: FlowEra) => void
  setView: (lat: number, lon: number, zoom: number) => void
  setPodsEnabled: (on: boolean) => void
  setWellsEnabled: (on: boolean) => void
  showRiverShrink: () => void
  showDryReach: () => void
  showTransfers: () => void
  showConjunctive: () => void
  /** Persist story step in the URL hash. */
  onStepChange?: (index: number) => void
  /** Ensure NHD canals are visible (moved-farther step). */
  ensureCanalsVisible?: () => void
}

let currentIndex = 0
let cbs: StoryCallbacks | null = null

export function getStoryStepIndex(): number {
  return currentIndex
}

export function setStoryStepIndex(i: number) {
  currentIndex = Math.max(0, Math.min(STORY_STEPS.length - 1, i))
}

const PANEL_BTN_LABEL: Record<string, string> = {
  'river-shrink': 'Open Mackay → Moore → Arco chart',
  'dry-reach': 'Open seniors table + CSV',
  transfers: 'Open moved-farther table + CSV',
  conjunctive: 'Open GW vs seniors overview',
}

function renderStepChrome(index: number) {
  const step = STORY_STEPS[index]
  const kicker = document.getElementById('story-kicker')
  const title = document.getElementById('story-title')
  const body = document.getElementById('story-body')
  const counter = document.getElementById('story-step-counter')
  const prev = document.getElementById('story-prev') as HTMLButtonElement | null
  const next = document.getElementById('story-next') as HTMLButtonElement | null
  const dots = document.getElementById('story-dots')
  const panelBtn = document.getElementById('story-panel-btn') as HTMLButtonElement | null

  if (kicker) kicker.textContent = step.kicker
  if (title) title.textContent = step.title
  if (body) body.textContent = step.body
  if (counter) counter.textContent = `${index + 1} / ${STORY_STEPS.length}`
  if (prev) prev.disabled = index <= 0
  if (next) {
    next.disabled = index >= STORY_STEPS.length - 1
    next.textContent = index >= STORY_STEPS.length - 1 ? 'Done' : 'Next →'
  }
  if (dots) {
    dots.innerHTML = STORY_STEPS.map((_, i) =>
      `<button type="button" class="story-dot${i === index ? ' active' : ''}" data-story-step="${i}" aria-label="Go to step ${i + 1}"></button>`,
    ).join('')
  }
  if (panelBtn) {
    if (step.panel) {
      panelBtn.classList.remove('hidden')
      panelBtn.textContent = PANEL_BTN_LABEL[step.panel] || 'Open details'
    } else {
      panelBtn.classList.add('hidden')
    }
  }
}

function openStepPanel(step: StoryStep) {
  if (!cbs || !step.panel) return
  if (step.panel === 'river-shrink') cbs.showRiverShrink()
  else if (step.panel === 'dry-reach') cbs.showDryReach()
  else if (step.panel === 'transfers') cbs.showTransfers()
  else if (step.panel === 'conjunctive') cbs.showConjunctive()
}

/** Apply map + caption for a story step. */
export function goToStoryStep(index: number, options: { openPanel?: boolean } = {}) {
  if (!cbs) return
  // Default: do not auto-open heavy modals (blocks phones + traps Story nav).
  const openPanel = options.openPanel === true
  currentIndex = Math.max(0, Math.min(STORY_STEPS.length - 1, index))
  const step = STORY_STEPS[currentIndex]

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
  const showWells = !!step.showWells
  cbs.setPodsEnabled(showPods)
  cbs.setWellsEnabled(showWells)

  if (step.highlightMode === 'transfers') {
    cbs.ensureCanalsVisible?.()
  }

  syncSidebarToState()
  cbs.refreshData()
  renderStepChrome(currentIndex)

  if (step.view) {
    cbs.setView(step.view.lat, step.view.lon, step.view.zoom)
  }

  if (openPanel) openStepPanel(step)

  cbs.onStepChange?.(currentIndex)
}

export function wireStory(callbacks: StoryCallbacks) {
  cbs = callbacks
  renderStepChrome(currentIndex)

  document.getElementById('story-prev')?.addEventListener('click', () => {
    if (currentIndex > 0) goToStoryStep(currentIndex - 1)
  })
  document.getElementById('story-next')?.addEventListener('click', () => {
    if (currentIndex < STORY_STEPS.length - 1) goToStoryStep(currentIndex + 1)
  })
  document.getElementById('story-dots')?.addEventListener('click', e => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-story-step]')
    if (!btn) return
    const i = parseInt(btn.dataset.storyStep || '', 10)
    if (isFinite(i)) goToStoryStep(i)
  })
  document.getElementById('story-restart')?.addEventListener('click', () => {
    goToStoryStep(0)
  })
  document.getElementById('story-panel-btn')?.addEventListener('click', () => {
    openStepPanel(STORY_STEPS[currentIndex])
  })
}
