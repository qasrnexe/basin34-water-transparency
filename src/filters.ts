import type { DataStore } from './data'
import { CONFLICT_CORRIDOR_KM } from './data'
import type { AppState, PodRecord, WellRecord } from './types'

/** Approximate "at or downstream of" test (river flows roughly south in WD34). */
export function isDownstream(lat: number, reachId: string, store: DataStore): boolean {
  if (reachId) {
    const south = store.reachSouthLat.get(reachId)
    if (south != null) return lat <= south + 0.015
  }
  return lat < 43.62 // global lower-basin approximation
}

/** POD sits on/near the Big Lost mainstem valley corridor (not a mountain spring). */
export function onRiverCorridor(rec: PodRecord): boolean {
  return rec.corridorDistKm <= CONFLICT_CORRIDOR_KM
}

export function conflictSenior(rec: PodRecord, state: AppState, store: DataStore): boolean {
  return rec.year != null && rec.year < 1970 &&
    onRiverCorridor(rec) && isDownstream(rec.lat, state.reachFilter, store)
}

export function conflictJunior(rec: PodRecord, state: AppState, store: DataStore): boolean {
  return rec.year != null && rec.year >= 1980 &&
    onRiverCorridor(rec) && !isDownstream(rec.lat, state.reachFilter, store)
}

function inEraBuckets(year: number | null, state: AppState): boolean {
  if (year == null) return true
  if (year < 1950) return state.eras.pre1950
  if (year < 2000) return state.eras.mid
  return state.eras.post2000
}

function inYearRange(year: number | null, state: AppState): boolean {
  return year == null || (year >= state.yearMin && year <= state.yearMax)
}

/** Does the record match the active analysis view? (used for emphasis AND force-include) */
export function podMatchesMode(rec: PodRecord, state: AppState, store: DataStore): boolean {
  const down = () => isDownstream(rec.lat, state.reachFilter, store)
  switch (state.highlightMode) {
    case 'senior-downstream':
      return rec.year != null && rec.year < 1950 && down()
    case 'junior-dev':
      return rec.year != null && rec.year >= 1980 && rec.rate > state.highRateThreshold
    case 'transfers':
      return rec.isTransfer
    case 'conflict':
      return conflictSenior(rec, state, store) || conflictJunior(rec, state, store)
    case 'conjunctive':
      // Post-1950 groundwater development vs. the senior surface rights below it
      return rec.year != null &&
        ((rec.isGW && rec.year >= 1950) || (rec.isSurf && rec.year < 1950 && down()))
    case 'high-rate':
      return rec.rate > state.highRateThreshold
    default:
      return false
  }
}

/** Conjunctive view: irrigation wells from the post-1950 groundwater boom. */
export function wellMatchesConjunctive(rec: WellRecord, state: AppState): boolean {
  return state.highlightMode === 'conjunctive' &&
    rec.year != null && rec.year >= 1950 && rec.use.includes('IRRIG')
}

export function podOwnerMatch(rec: PodRecord, state: AppState): boolean {
  return !!state.ownerHighlight && rec.ownerLc.includes(state.ownerHighlight.toLowerCase())
}

export function podVisible(rec: PodRecord, state: AppState, store: DataStore): boolean {
  // Force-includes: selection and owner match stay visible.
  if (state.selectedWRs.has(rec.wr)) return true
  if (podOwnerMatch(rec, state)) return true

  const modeMatch = state.highlightMode !== 'none' && podMatchesMode(rec, state, store)
  if (modeMatch) return true

  // Phone / story lite: when an analysis lens is on, do not paint thousands of
  // dimmed non-matches — they dominate CPU and make the map feel broken.
  if (state.hideNonMatches && state.highlightMode !== 'none') return false

  // Base filters
  const catOk = rec.isGW ? state.showGW
    : rec.isSurf ? state.showSurface
    : (state.showGW || state.showSurface)
  if (!catOk) return false
  if (!inYearRange(rec.year, state) || !inEraBuckets(rec.year, state)) return false
  if (state.reachFilter && !isDownstream(rec.lat, state.reachFilter, store)) return false
  return true
}

export function wellVisible(rec: WellRecord, state: AppState, store: DataStore): boolean {
  if (state.hideDomestic && (!rec.use || rec.use.includes('DOMESTIC'))) return false
  if (state.focusIrrigation) {
    if (!rec.use || rec.use.includes('DOMESTIC') || rec.use.includes('MONITOR')) return false
  }

  const analysisMatch =
    (state.highlightMode === 'junior-dev' &&
      rec.year != null && rec.year >= 1980 && rec.rate > state.highRateThreshold) ||
    wellMatchesConjunctive(rec, state)

  if (state.hideNonMatches && state.highlightMode !== 'none') {
    return analysisMatch
  }

  if (rec.year != null) {
    if (!analysisMatch && (!inYearRange(rec.year, state) || !inEraBuckets(rec.year, state))) {
      return false
    }
  }
  if (state.ownerHighlight && !rec.ownerLc.includes(state.ownerHighlight.toLowerCase())) {
    return false
  }
  if (state.reachFilter && !isDownstream(rec.lat, state.reachFilter, store)) return false
  return true
}
