/** Live USGS NWIS annual statistics (CORS-enabled public API). */

export interface AnnualMean {
  year: number
  cfs: number
}

/** Per-calendar-year stats derived from NWIS daily mean values (00060, stat 00003). */
export interface YearFlowStats {
  year: number
  /** Mean of all daily values that year (dry days = 0). Honest calendar-year mean. */
  calendarMeanCfs: number
  daysWithData: number
  daysWithFlow: number
  /** USGS published annual mean when the statistics service reports that year. */
  publishedMeanCfs?: number
  /** Fewer than 300 daily values — annual mean may not represent a full water year. */
  partialCoverage: boolean
}

export interface GageFlowHistory {
  published: AnnualMean[]
  dailyByYear: YearFlowStats[]
}

const cache = new Map<string, Promise<AnnualMean[]>>()
const historyCache = new Map<string, Promise<GageFlowHistory>>()

/**
 * Annual mean discharge (cfs) per calendar year for a gage, full period of
 * record. Parses the RDB (tab-separated) format of the NWIS statistics
 * service; columns: agency_cd site_no parameter_cd ts_id loc_web_ds year_nu mean_va.
 */
export function fetchAnnualMeans(siteNo: string): Promise<AnnualMean[]> {
  let p = cache.get(siteNo)
  if (!p) {
    p = doFetch(siteNo)
    cache.set(siteNo, p)
  }
  return p
}

async function doFetch(siteNo: string): Promise<AnnualMean[]> {
  // Deliberately NOT passing missingData=on: that would include partial years
  // (e.g. a gage installed/removed mid-season), whose "annual" means are
  // computed from only the wet or only the dry months and would distort the
  // record. Complete years only — so a record that ends early means the gage
  // was discontinued (labeled in the chart), and a 0.0 value is a real
  // measured zero-flow year, not a data gap.
  const url =
    'https://waterservices.usgs.gov/nwis/stat/?format=rdb' +
    `&sites=${encodeURIComponent(siteNo)}&statReportType=annual&statTypeCd=mean&parameterCd=00060`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`NWIS stat service: HTTP ${res.status}`)
  const text = await res.text()

  const out: AnnualMean[] = []
  let header: string[] | null = null
  for (const line of text.split('\n')) {
    if (!line || line.startsWith('#')) continue
    const cols = line.split('\t')
    if (!header) {
      header = cols
      continue
    }
    if (/^\d+[sn]$/.test(cols[0])) continue // column-width spec row
    const yearIdx = header.indexOf('year_nu')
    const meanIdx = header.indexOf('mean_va')
    if (yearIdx < 0 || meanIdx < 0) continue
    const year = parseInt(cols[yearIdx], 10)
    const cfs = parseFloat(cols[meanIdx])
    if (isFinite(year) && isFinite(cfs)) out.push({ year, cfs })
  }
  out.sort((a, b) => a.year - b.year)
  return out
}

/** Full gage history: published annual means + daily-derived calendar-year stats. */
export function fetchGageFlowHistory(siteNo: string): Promise<GageFlowHistory> {
  let p = historyCache.get(siteNo)
  if (!p) {
    p = Promise.all([fetchAnnualMeans(siteNo), fetchDailyYearSummaries(siteNo)]).then(
      ([published, dailyByYear]) => ({ published, dailyByYear }),
    )
    historyCache.set(siteNo, p)
  }
  return p
}

async function fetchDailyYearSummaries(siteNo: string): Promise<YearFlowStats[]> {
  const url =
    'https://waterservices.usgs.gov/nwis/dv/?format=rdb' +
    `&sites=${encodeURIComponent(siteNo)}&parameterCd=00060&statCd=00003` +
    '&startDT=1900-01-01&endDT=2026-12-31'
  const res = await fetch(url)
  if (!res.ok) return []
  const text = await res.text()

  const byYear = new Map<number, { sum: number; days: number; flowDays: number }>()
  let header: string[] | null = null
  for (const line of text.split('\n')) {
    if (!line || line.startsWith('#')) continue
    const cols = line.split('\t')
    if (!header) {
      header = cols
      continue
    }
    if (/^\d+[sn]$/.test(cols[0])) continue
    const dtIdx = header.indexOf('datetime')
    if (dtIdx < 0 || cols.length < dtIdx + 2) continue
    const dt = cols[dtIdx]
    const year = parseInt(dt.slice(0, 4), 10)
    if (!isFinite(year)) continue
    // Value column name varies by site (e.g. 246362_00060_00003); first numeric after datetime.
    let cfs: number | null = null
    for (let i = dtIdx + 1; i < cols.length; i++) {
      if (cols[i].endsWith('_cd')) continue
      const v = parseFloat(cols[i])
      if (isFinite(v)) { cfs = v; break }
    }
    if (cfs == null) continue
    let bucket = byYear.get(year)
    if (!bucket) byYear.set(year, (bucket = { sum: 0, days: 0, flowDays: 0 }))
    bucket.sum += Math.max(0, cfs)
    bucket.days++
    if (cfs > 0.01) bucket.flowDays++
  }

  const published = await fetchAnnualMeans(siteNo)
  const pubByYear = new Map(published.map(d => [d.year, d.cfs]))

  return [...byYear.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, b]) => ({
      year,
      calendarMeanCfs: b.days ? b.sum / b.days : 0,
      daysWithData: b.days,
      daysWithFlow: b.flowDays,
      publishedMeanCfs: pubByYear.get(year),
      partialCoverage: b.days < 300,
    }))
}

/** Merge published annual means with daily calendar means (prefer published when present). */
export function mergedYearSeries(
  history: GageFlowHistory,
): Array<{ year: number; cfs: number; daysWithFlow?: number; daysWithData?: number; partial?: boolean; source: 'published' | 'daily' }> {
  const byYear = new Map<number, ReturnType<typeof mergedYearSeries>[0]>()
  for (const d of history.dailyByYear) {
    byYear.set(d.year, {
      year: d.year,
      cfs: d.calendarMeanCfs,
      daysWithFlow: d.daysWithFlow,
      daysWithData: d.daysWithData,
      partial: d.partialCoverage,
      source: 'daily',
    })
  }
  for (const p of history.published) {
    byYear.set(p.year, {
      year: p.year,
      cfs: p.cfs,
      daysWithFlow: byYear.get(p.year)?.daysWithFlow,
      daysWithData: byYear.get(p.year)?.daysWithData,
      partial: byYear.get(p.year)?.partial,
      source: 'published',
    })
  }
  return [...byYear.values()].sort((a, b) => a.year - b.year)
}

/** Convert a mean annual flow in cfs to acre-feet per year. */
export function cfsToAfPerYear(cfs: number): number {
  return cfs * 724.46
}
