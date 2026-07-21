import type { DataStore } from './data'
import type { AppState, PodRecord, WellRecord } from './types'
import { isDownstream, podMatchesMode, podOwnerMatch, wellMatchesConjunctive } from './filters'

/**
 * Visual emphasis classes for PODs, resolved by a strict precedence:
 *   selected > owner match > analysis-view match > normal/subdued.
 * Because analysis views are exclusive, there is no combinatorial styling.
 */
export type PodEmphasis =
  | 'selected'
  | 'owner'
  | 'senior'
  | 'junior'
  | 'transfer'
  | 'conflict-senior'
  | 'conflict-junior'
  | 'conjunctive-gw'
  | 'high-rate'
  | 'normal'
  | 'subdued'

export function resolvePodEmphasis(rec: PodRecord, state: AppState, store: DataStore): PodEmphasis {
  if (state.selectedWRs.has(rec.wr)) return 'selected'
  if (podOwnerMatch(rec, state)) return 'owner'

  if (state.highlightMode !== 'none' && podMatchesMode(rec, state, store)) {
    switch (state.highlightMode) {
      case 'senior-downstream': return 'senior'
      case 'junior-dev': return 'junior'
      case 'transfers': return 'transfer'
      case 'high-rate': return 'high-rate'
      case 'conflict':
        return rec.year != null && rec.year < 1970 ? 'conflict-senior' : 'conflict-junior'
      case 'conjunctive':
        return rec.isGW ? 'conjunctive-gw' : 'senior'
    }
  }

  const anyHighlight = !!state.ownerHighlight || state.highlightMode !== 'none'
  return anyHighlight ? 'subdued' : 'normal'
}

export type WellEmphasis = 'junior' | 'conjunctive-gw' | 'normal' | 'subdued'

export function resolveWellEmphasis(rec: WellRecord, state: AppState, store: DataStore): WellEmphasis {
  const isJuniorDev = rec.year != null && rec.year >= 1980 && rec.rate > state.highRateThreshold
  if (state.highlightMode === 'junior-dev' && isJuniorDev) return 'junior'
  if (wellMatchesConjunctive(rec, state)) return 'conjunctive-gw'

  const anyHighlight = !!state.ownerHighlight || state.highlightMode !== 'none'
  if (!anyHighlight) return 'normal'

  // Keep contextually relevant wells visible alongside POD highlights
  if (state.ownerHighlight && rec.ownerLc.includes(state.ownerHighlight.toLowerCase())) return 'normal'
  if (state.highlightMode === 'high-rate' && rec.rate > state.highRateThreshold && rec.use.includes('IRRIG')) {
    return 'normal'
  }
  if (state.reachFilter && isDownstream(rec.lat, state.reachFilter, store)) return 'normal'
  return 'subdued'
}
