import type { GeoFeature, PodRecord, PouRecord, WellRecord } from './types'

/** POD-to-POU distance (km) beyond which a right is flagged as a potential transfer. */
export const TRANSFER_DIST_KM = 8

/**
 * "New ground" proxy: a transfer right whose POU center sits farther than this
 * from the river's natural corridor (every NHD mainstem vertex + every NWI
 * riparian polygon centroid) is irrigating land outside the corridor —
 * historically dry bench/desert ground rather than bottomland. Purely
 * geometric; no land-use history is claimed.
 */
export const NEW_GROUND_KM = 1.5

/**
 * Potential-conflicts view: POD must sit within this distance of the NHD
 * mainstem + NWI riparian corridor. Filters mountain springs and tributary
 * PODs that share a basin number but are not on the valley floor river path
 * (e.g. 34-12491 at ~29 km vs 34-13725 at ~0 km on the Big Lost River).
 */
export const CONFLICT_CORRIDOR_KM = 3

/**
 * POU polygons at/above this area are treated as district/service areas rather
 * than individual fields (Basin 34 data: fields top out ~16 km²; the next sizes
 * up are 100–234 km² irrigation-district and federal service areas).
 */
export const DISTRICT_POU_KM2 = 20

export interface DataStore {
  pods: PodRecord[]
  wells: WellRecord[]
  pous: PouRecord[]
  podsByWR: Map<string, PodRecord[]>
  pousByWR: Map<string, PouRecord[]>
  /** Geometry key -> set of rights sharing (approximately) the same POU polygon. */
  geomKeyToWRs: Map<string, Set<string>>
  /** wr -> POD-to-POU distance in km (only for rights flagged as transfers). */
  transferDistKm: Map<string, number>
  /** wr -> distance (km) from POU center to the natural river corridor (transfers only). */
  corridorDistKm: Map<string, number>
  /** Transfer rights whose POU lies > NEW_GROUND_KM outside the natural corridor. */
  newGroundWRs: Set<string>
  /** wr -> [lat, lon] approximate center (bbox) of the right's first POU polygon. */
  pouCenter: Map<string, [number, number]>
  reaches: GeoFeature[]
  /** reach_id -> southernmost latitude of the reach line. */
  reachSouthLat: Map<string, number>
  /** Unique owner names (from PODs) for search. */
  owners: string[]
}

/**
 * Parse IDWR PriorityDate / ConstructionDate (epoch milliseconds).
 * NOTE: pre-1970 dates are NEGATIVE epoch values — 86% of Basin 34 rights.
 * (A previous version required `pd > 1e8`, silently dropping every senior right.)
 */
export function epochMsToYear(pd: unknown): number | null {
  if (typeof pd !== 'number' || !isFinite(pd)) return null
  const y = new Date(pd).getFullYear()
  return y >= 1800 && y <= 2100 ? y : null
}

function isGroundwaterSource(src: string): boolean {
  return /GROUND/i.test(src)
}

function isSurfaceLikeSource(src: string): boolean {
  const s = src.toUpperCase()
  if (isGroundwaterSource(s)) return false
  return (
    s.includes('SURFACE') || s.includes('RIVER') || s.includes('CREEK') ||
    s.includes('SPRING') || s.includes('STREAM') || s.includes('POND') ||
    s.length > 5 // named sources (e.g. "ANTELOPE CREEK") are surface-like
  )
}

/** Stable-ish key for grouping the "same" POU polygon shared by multiple rights. */
export function pouGeomKey(geom: any): string {
  if (!geom?.coordinates?.length) return ''
  let ring: number[][] = []
  if (geom.type === 'Polygon') ring = geom.coordinates[0] || []
  else if (geom.type === 'MultiPolygon') ring = geom.coordinates[0]?.[0] || []
  if (!ring.length) return ''
  const [lon, lat] = ring[0]
  // ~1 m rounding so identical polygons digitized per-right group together
  return `${geom.type}:${Math.round(lon * 1e5) / 1e5},${Math.round(lat * 1e5) / 1e5}`
}

/** Approximate geodesic area (km²) via equirectangular shoelace; outer rings only. */
export function polygonAreaKm2(geom: any): number {
  if (!geom?.coordinates) return 0
  const outerRings: number[][][] =
    geom.type === 'Polygon' ? [geom.coordinates[0]] :
    geom.type === 'MultiPolygon' ? geom.coordinates.map((p: number[][][]) => p[0]) : []
  const R = 6371
  let total = 0
  for (const ring of outerRings) {
    if (!ring?.length) continue
    const k = Math.cos((ring[0][1] * Math.PI) / 180)
    let a = 0
    for (let i = 0; i < ring.length - 1; i++) {
      const [x1, y1] = ring[i]
      const [x2, y2] = ring[i + 1]
      a += (x1 * k * y2 - x2 * k * y1)
    }
    total += Math.abs(a) / 2 * (Math.PI / 180) ** 2 * R * R
  }
  return total
}

function geomBBoxCenter(geom: any): [number, number] | null {
  if (!geom?.coordinates) return null
  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity
  const rings: number[][][] =
    geom.type === 'Polygon' ? geom.coordinates :
    geom.type === 'MultiPolygon' ? geom.coordinates.flat() : []
  for (const ring of rings) {
    for (const [lon, lat] of ring) {
      if (lon < minLon) minLon = lon
      if (lon > maxLon) maxLon = lon
      if (lat < minLat) minLat = lat
      if (lat > maxLat) maxLat = lat
    }
  }
  if (!isFinite(minLon)) return null
  return [(minLat + maxLat) / 2, (minLon + maxLon) / 2]
}

function distKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = Math.abs(lat1 - lat2) * 111
  const dLon = Math.abs(lon1 - lon2) * 111 * Math.cos(lat1 * Math.PI / 180)
  return Math.sqrt(dLat * dLat + dLon * dLon)
}

async function fetchFeatures(url: string): Promise<GeoFeature[]> {
  try {
    const res = await fetch(url)
    if (!res.ok) {
      console.warn(`[data] failed to load ${url}: ${res.status}`)
      return []
    }
    const data = await res.json()
    return data.features || []
  } catch (e) {
    console.warn(`[data] error loading ${url}`, e)
    return []
  }
}

function buildCorridorPts(mainstemFeats: GeoFeature[], riparianFeats: GeoFeature[]): Array<[number, number]> {
  const corridorPts: Array<[number, number]> = []
  for (const f of mainstemFeats) {
    const g = f.geometry
    if (!g?.coordinates) continue
    const lines: number[][][] =
      g.type === 'LineString' ? [g.coordinates] :
      g.type === 'MultiLineString' ? g.coordinates : []
    for (const line of lines) {
      for (const [lon, lat] of line) corridorPts.push([lat, lon])
    }
  }
  for (const f of riparianFeats) {
    const c = geomBBoxCenter(f.geometry)
    if (c) corridorPts.push(c)
  }
  return corridorPts
}

function applyCorridorDistances(pods: PodRecord[], corridorPts: Array<[number, number]>) {
  if (!corridorPts.length) return
  for (const pod of pods) {
    let best = Infinity
    for (const [lat, lon] of corridorPts) {
      if (Math.abs(lat - pod.lat) * 111 >= best) continue
      const d = distKm(pod.lat, pod.lon, lat, lon)
      if (d < best) best = d
    }
    pod.corridorDistKm = best
  }
}

function emptyStore(): DataStore {
  return {
    pods: [], wells: [], pous: [],
    podsByWR: new Map(), pousByWR: new Map(), geomKeyToWRs: new Map(),
    transferDistKm: new Map(), corridorDistKm: new Map(), newGroundWRs: new Set(),
    pouCenter: new Map(), reaches: [], reachSouthLat: new Map(), owners: [],
  }
}

/**
 * Stage 1+2: PODs, wells, reaches, mainstem corridor — enough for map points + dry-reach lens.
 * POU (large) loads later via {@link enrichDataStoreWithPou}.
 */
export async function loadDataStoreLight(
  onProgress?: (label: string) => void,
): Promise<DataStore> {
  onProgress?.('Loading water rights & wells…')
  const [podFeats, wellFeats, reachFeats, mainstemFeats] = await Promise.all([
    fetchFeatures('/data/wd34-pods.geojson'),
    fetchFeatures('/data/wd34-wells.geojson'),
    fetchFeatures('/data/wd34-admin-reaches.geojson'),
    fetchFeatures('/data/nhd-mainstem.geojson'),
  ])

  const pods: PodRecord[] = podFeats
    .filter(f => Array.isArray(f.geometry?.coordinates) && f.geometry.coordinates.length >= 2)
    .map(f => {
      const p = f.properties || {}
      const source = p.Source || ''
      const owner = (p.Owner || '').trim()
      return {
        feature: f,
        wr: (p.WaterRightNumber || '').trim(),
        owner,
        ownerLc: owner.toLowerCase(),
        source,
        isGW: isGroundwaterSource(source),
        isSurf: isSurfaceLikeSource(source),
        year: epochMsToYear(p.PriorityDate),
        rate: typeof p.OverallMaxDiversionRate === 'number' ? p.OverallMaxDiversionRate : 0,
        lat: f.geometry.coordinates[1],
        lon: f.geometry.coordinates[0],
        isTransfer: false,
        corridorDistKm: Infinity,
      }
    })

  const wells: WellRecord[] = wellFeats
    .filter(f => Array.isArray(f.geometry?.coordinates) && f.geometry.coordinates.length >= 2)
    .map(f => {
      const p = f.properties || {}
      return {
        feature: f,
        ownerLc: (p.Owner || '').toLowerCase(),
        use: (p.WellUse || '').toUpperCase().trim(),
        year: epochMsToYear(p.ConstructionDate),
        rate: typeof p.ProductionRate === 'number' ? p.ProductionRate : 0,
        lat: f.geometry.coordinates[1],
      }
    })

  const podsByWR = new Map<string, PodRecord[]>()
  for (const r of pods) {
    if (!r.wr) continue
    const list = podsByWR.get(r.wr)
    if (list) list.push(r)
    else podsByWR.set(r.wr, [r])
  }

  applyCorridorDistances(pods, buildCorridorPts(mainstemFeats, []))

  const reachSouthLat = new Map<string, number>()
  for (const f of reachFeats) {
    const id = f.properties?.reach_id
    const coords: number[][] = f.geometry?.coordinates || []
    if (id && coords.length) {
      reachSouthLat.set(id, Math.min(...coords.map(c => c[1])))
    }
  }

  const owners = Array.from(new Set(pods.map(r => r.owner).filter(Boolean))).sort()

  return {
    ...emptyStore(),
    pods, wells,
    podsByWR,
    reaches: reachFeats, reachSouthLat,
    owners,
  }
}

/** Stage 3: POU polygons + transfer / new-ground enrichment (+ optional riparian for corridor). */
export async function enrichDataStoreWithPou(
  store: DataStore,
  onProgress?: (label: string) => void,
): Promise<void> {
  onProgress?.('Loading places of use (large file)…')
  const [pouFeats, riparianFeats, mainstemFeats] = await Promise.all([
    fetchFeatures('/data/wd34-pou.geojson'),
    fetchFeatures('/data/nwi-riparian.geojson'),
    fetchFeatures('/data/nhd-mainstem.geojson'),
  ])

  const pous: PouRecord[] = pouFeats
    .map(f => {
      const areaKm2 = polygonAreaKm2(f.geometry)
      if (f.properties) f.properties.__areaKm2 = areaKm2
      return {
        feature: f,
        wr: (f.properties?.WaterRightNumber || '').trim(),
        geomKey: pouGeomKey(f.geometry),
        areaKm2,
      }
    })
    .filter(r => r.wr !== '')

  store.pous = pous
  store.pousByWR = new Map()
  store.geomKeyToWRs = new Map()
  for (const r of pous) {
    const list = store.pousByWR.get(r.wr)
    if (list) list.push(r)
    else store.pousByWR.set(r.wr, [r])
    if (r.geomKey) {
      let set = store.geomKeyToWRs.get(r.geomKey)
      if (!set) store.geomKeyToWRs.set(r.geomKey, (set = new Set()))
      set.add(r.wr)
    }
  }

  // Refresh corridor with riparian centroids too
  applyCorridorDistances(store.pods, buildCorridorPts(mainstemFeats, riparianFeats))

  store.pouCenter = new Map()
  store.transferDistKm = new Map()
  store.corridorDistKm = new Map()
  store.newGroundWRs = new Set()

  store.pousByWR.forEach((pouList, wr) => {
    const center = geomBBoxCenter(pouList[0].feature.geometry)
    if (!center) return
    store.pouCenter.set(wr, center)
    const podList = store.podsByWR.get(wr)
    if (!podList?.length) return
    const dCenter = distKm(center[0], center[1], podList[0].lat, podList[0].lon)
    const d = dCenter - Math.sqrt(pouList[0].areaKm2 / Math.PI)
    if (d > TRANSFER_DIST_KM) {
      store.transferDistKm.set(wr, d)
      for (const pod of podList) pod.isTransfer = true
    }
  })

  const corridorPts = buildCorridorPts(mainstemFeats, riparianFeats)
  if (corridorPts.length) {
    store.transferDistKm.forEach((_d, wr) => {
      const center = store.pouCenter.get(wr)
      if (!center) return
      let best = Infinity
      for (const [lat, lon] of corridorPts) {
        if (Math.abs(lat - center[0]) * 111 >= best) continue
        const d = distKm(center[0], center[1], lat, lon)
        if (d < best) best = d
      }
      store.corridorDistKm.set(wr, best)
      if (best > NEW_GROUND_KM) store.newGroundWRs.add(wr)
    })
  }
}

/** Full load (tests / simple callers). */
export async function loadDataStore(): Promise<DataStore> {
  const store = await loadDataStoreLight()
  await enrichDataStoreWithPou(store)
  return store
}
