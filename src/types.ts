// Shared domain types for the Basin 34 viewer.

export type Basemap = 'osm' | 'satellite' | 'hybrid'
export type PodColorMode = 'source' | 'priority'
export type FlowEra = 'historical' | 'recent'

/**
 * Exclusive analysis views. Exactly one is active at a time, which keeps the
 * emphasis/subdue rules simple and the map readable (the old composable
 * checkboxes produced unreadable color soup and a 9-clause subdue condition).
 */
export type HighlightMode =
  | 'none'
  | 'senior-downstream'
  | 'junior-dev'
  | 'transfers'
  | 'conflict'
  | 'conjunctive'
  | 'high-rate'

export interface GeoFeature {
  type: 'Feature'
  geometry: any
  properties: Record<string, any>
}

/** POD feature + derived values precomputed once at load time. */
export interface PodRecord {
  feature: GeoFeature
  /** Trimmed WaterRightNumber (raw IDWR values have trailing spaces). */
  wr: string
  owner: string
  ownerLc: string
  source: string
  isGW: boolean
  isSurf: boolean
  year: number | null
  rate: number
  lat: number
  lon: number
  /** Set after POU load: POD-to-POU distance exceeds the transfer threshold. */
  isTransfer: boolean
  /** Distance (km) from this POD to the nearest NHD mainstem / NWI riparian point. */
  corridorDistKm: number
}

export interface WellRecord {
  feature: GeoFeature
  ownerLc: string
  /** Uppercased WellUse ('' when unlabeled). */
  use: string
  year: number | null
  rate: number
  lat: number
}

export interface PouRecord {
  feature: GeoFeature
  wr: string
  /** Approximate geometry key used to group rights sharing one polygon. */
  geomKey: string
  /** Approximate polygon area (km²). District-scale service areas are huge. */
  areaKm2: number
}

export interface AppState {
  podColorMode: PodColorMode
  eras: { pre1950: boolean; mid: boolean; post2000: boolean }
  yearMin: number
  yearMax: number
  showGW: boolean
  showSurface: boolean
  hideDomestic: boolean
  focusIrrigation: boolean
  highRateThreshold: number
  highlightMode: HighlightMode
  ownerHighlight: string | null
  reachFilter: string
  placeOfUseMode: boolean
  /** Rights selected by clicking a POD or POU polygon. */
  selectedWRs: Set<string>
  flowEra: FlowEra
}
