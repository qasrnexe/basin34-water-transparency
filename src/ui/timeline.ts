import type { DataStore } from '../data'
import { state } from '../state'
import { svgChart } from './chart'

const YEAR_START = 1880
const YEAR_END = 2026
const PLAY_STEP_YEARS = 2
const PLAY_TICK_MS = 220

// Must match the margins/width used for the context chart below (chart.ts M)
const CHART_W = 360
const CHART_ML = 38
const CHART_MR = 6

export interface TimelineCallbacks {
  /** Filters changed (state.yearMax was set): rebuild layers + legend. */
  refreshData: () => void
  /** Suspend/resume POU polygon rebuilds during playback (5.8k-polygon cost). */
  setPouSuspended: (on: boolean) => void
  /** Reflect state back into the sidebar inputs (year fields). */
  syncSidebar: () => void
}

export interface TimelineControl {
  open: () => void
  close: () => void
  isOpen: () => boolean
}

/**
 * "Development through time": a bar over the bottom of the map with a year
 * slider + play button that drives state.yearMax, so PODs (priority year) and
 * wells (construction year) accumulate on the map — the one-glance story of
 * how the basin filled up with rights.
 */
export function setupTimeline(store: DataStore, cb: TimelineCallbacks): TimelineControl {
  const bar = document.getElementById('timeline-bar')!
  const slider = document.getElementById('timeline-slider') as HTMLInputElement
  const yearEl = document.getElementById('timeline-year')!
  const statsEl = document.getElementById('timeline-stats')!
  const playBtn = document.getElementById('timeline-play')!
  const chartWrap = document.getElementById('timeline-chart-wrap')!

  // Cumulative authorized cfs / right count by priority year (one rate per right)
  const rights: Array<{ year: number; rate: number }> = []
  store.podsByWR.forEach(pods => {
    const r = pods[0]
    if (r.year != null) rights.push({ year: r.year, rate: r.rate })
  })
  rights.sort((a, b) => a.year - b.year)
  const years = rights.map(r => r.year)
  const cumCfs: number[] = []
  let tot = 0
  for (const r of rights) cumCfs.push(tot += r.rate)

  // Cumulative irrigation-well count by construction year — the second series
  // makes the post-1950 groundwater boom visible while scrubbing.
  const wellYears = store.wells
    .filter(w => w.year != null && w.use.includes('IRRIG'))
    .map(w => w.year as number)
    .sort((a, b) => a - b)

  /** Rights established up to & including `year` → [count, cumulative cfs]. */
  function cumAt(year: number): [number, number] {
    let lo = 0, hi = years.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (years[mid] <= year) lo = mid + 1
      else hi = mid
    }
    return lo === 0 ? [0, 0] : [lo, cumCfs[lo - 1]]
  }

  /** Irrigation wells constructed up to & including `year`. */
  function wellsAt(year: number): number {
    let lo = 0, hi = wellYears.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (wellYears[mid] <= year) lo = mid + 1
      else hi = mid
    }
    return lo
  }

  // Context chart rendered once; only the year cursor moves afterwards.
  const xMin = Math.min(YEAR_START, years[0] ?? YEAR_START)
  const xMax = YEAR_END
  // Wells are plotted scaled onto the cfs axis (a 64px context strip has no
  // room for a second axis) — the shape of the curve is the story here.
  const maxCfs = cumCfs[cumCfs.length - 1] || 1
  const wellScale = maxCfs / (wellYears.length || 1)
  chartWrap.innerHTML =
    `<div style="position:relative">` +
    svgChart({
      width: CHART_W,
      height: 64,
      series: [{
        points: rights.map((r, i) => ({ x: r.year, y: cumCfs[i] })),
        color: '#0ea5e9',
        label: '',
        kind: 'step',
        width: 1.5,
      }, {
        points: wellYears.map((y, i) => ({ x: y, y: (i + 1) * wellScale })),
        color: '#b45309',
        label: '',
        kind: 'step',
        width: 1.2,
      }],
      yLabel: 'cum. cfs (blue) · irrigation wells (brown, scaled)',
      interactive: false, // the timeline has its own year cursor
    }) +
    `<div id="timeline-cursor"></div></div>`
  const cursor = document.getElementById('timeline-cursor')!

  let playing: number | null = null

  function setYear(year: number, fromSlider = false) {
    const y = Math.max(YEAR_START, Math.min(YEAR_END, Math.round(year)))
    state.yearMax = y
    if (!fromSlider) slider.value = String(y)
    yearEl.textContent = String(y)
    const [count, cfs] = cumAt(y)
    statsEl.textContent = `${count.toLocaleString()} rights · ${Math.round(cfs).toLocaleString()} cfs authorized · ${wellsAt(y).toLocaleString()} irrigation wells`
    const frac = (y - xMin) / (xMax - xMin)
    cursor.style.left = `${CHART_ML + frac * (CHART_W - CHART_ML - CHART_MR)}px`
    cb.refreshData()
  }

  function stopPlay() {
    if (playing != null) {
      clearInterval(playing)
      playing = null
      playBtn.textContent = '▶'
      cb.setPouSuspended(false)
      cb.refreshData() // redraw POU polygons for the final year
    }
  }

  function startPlay() {
    if (playing != null) return
    if (state.yearMax >= YEAR_END) setYear(YEAR_START) // restart from the beginning
    playBtn.textContent = '❚❚'
    cb.setPouSuspended(true)
    playing = window.setInterval(() => {
      if (state.yearMax >= YEAR_END) {
        stopPlay()
        return
      }
      setYear(state.yearMax + PLAY_STEP_YEARS)
    }, PLAY_TICK_MS)
  }

  function open() {
    bar.classList.remove('hidden')
    setYear(Math.min(state.yearMax, YEAR_END))
  }

  function close() {
    stopPlay()
    bar.classList.add('hidden')
    state.yearMax = YEAR_END
    cb.syncSidebar()
    cb.refreshData()
  }

  playBtn.addEventListener('click', () => (playing != null ? stopPlay() : startPlay()))
  slider.addEventListener('input', () => {
    stopPlay()
    setYear(parseInt(slider.value, 10), true)
  })
  document.getElementById('timeline-close')?.addEventListener('click', close)

  return { open, close, isOpen: () => !bar.classList.contains('hidden') }
}
