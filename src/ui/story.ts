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
}

/**
 * Geography-only guided story. No private surnames.
 * Order: overview → then/now → river shrink → dry-reach seniors → GW boom → transfers → Arco.
 */
export const STORY_STEPS: StoryStep[] = [
  {
    id: 'overview',
    kicker: 'Step 1 · Basin',
    title: 'A river that runs dry — and rights that remain',
    body:
      'Water District 34 covers the Big Lost River. This viewer uses public IDWR and USGS data so anyone can see how priority, place, and measured flow fit together — especially on the lower river near Arco.',
    view: { lat: 43.85, lon: -113.45, zoom: 9 },
    flowEra: 'historical',
    highlightMode: 'none',
    panel: null,
  },
  {
    id: 'then-now',
    kicker: 'Step 2 · Channel',
    title: 'Then the river reached the sinks. Now it often stops near Moore.',
    body:
      'Switch the channel to “Now”: below the Moore diversion the mainstem is dashed brown. USGS records and district accounting show surface flow commonly ending long before Arco or the historic sinks near Howe.',
    view: { lat: 43.72, lon: -113.28, zoom: 10 },
    flowEra: 'recent',
    highlightMode: 'none',
    panel: null,
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
  },
  {
    id: 'dry-reach',
    kicker: 'Step 4 · Senior rights',
    title: 'Downstream seniors on a dry reach',
    body:
      'Pre-1950 surface rights on the corridor at or below Moore sit where the channel often goes dry. The ranked table (and CSV) is a public-data proxy — not a legal finding. Zoom any row to its point of diversion.',
    view: { lat: 43.65, lon: -113.30, zoom: 11 },
    flowEra: 'recent',
    highlightMode: 'senior-downstream',
    panel: 'dry-reach',
  },
  {
    id: 'gw-boom',
    kicker: 'Step 5 · Groundwater',
    title: 'Groundwater expansion vs senior surface',
    body:
      'Later groundwater development shows up as wells and groundwater points of diversion. Compare that pattern with senior surface rights still mapped on the lower corridor.',
    view: { lat: 43.80, lon: -113.40, zoom: 9 },
    flowEra: 'recent',
    highlightMode: 'conjunctive',
    panel: 'conjunctive',
  },
  {
    id: 'transfers',
    kicker: 'Step 6 · Place of use',
    title: 'PODs far from their place of use',
    body:
      'Some rights show a point of diversion far from the irrigated polygon — a geometric “potential transfer” signal from IDWR POD/POU layers, not proof of an unauthorized move.',
    view: { lat: 43.85, lon: -113.45, zoom: 9 },
    flowEra: 'historical',
    highlightMode: 'transfers',
    panel: 'transfers',
  },
  {
    id: 'arco',
    kicker: 'Step 7 · Lower river',
    title: 'Focus: lower river near Arco',
    body:
      'Zoom to the Arco gage area. Senior surface emphasis + the modern dry channel make the lower-basin pattern readable in one view. Use Explore for filters, or Share view to send this map.',
    view: { lat: 43.635, lon: -113.30, zoom: 11 },
    flowEra: 'recent',
    highlightMode: 'senior-downstream',
    panel: null,
  },
]

export interface StoryCallbacks {
  refreshData: () => void
  setFlowEra: (era: FlowEra) => void
  setView: (lat: number, lon: number, zoom: number) => void
  showRiverShrink: () => void
  showDryReach: () => void
  showTransfers: () => void
  showConjunctive: () => void
  /** Persist story step in the URL hash. */
  onStepChange?: (index: number) => void
}

let currentIndex = 0
let cbs: StoryCallbacks | null = null

export function getStoryStepIndex(): number {
  return currentIndex
}

export function setStoryStepIndex(i: number) {
  currentIndex = Math.max(0, Math.min(STORY_STEPS.length - 1, i))
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
}

/** Apply map + caption for a story step. */
export function goToStoryStep(index: number, options: { openPanel?: boolean } = {}) {
  if (!cbs) return
  const openPanel = options.openPanel !== false
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

  syncSidebarToState()
  cbs.refreshData()
  renderStepChrome(currentIndex)

  if (step.view) {
    cbs.setView(step.view.lat, step.view.lon, step.view.zoom)
  }

  if (openPanel) {
    if (step.panel === 'river-shrink') cbs.showRiverShrink()
    else if (step.panel === 'dry-reach') cbs.showDryReach()
    else if (step.panel === 'transfers') cbs.showTransfers()
    else if (step.panel === 'conjunctive') cbs.showConjunctive()
  }

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
}
