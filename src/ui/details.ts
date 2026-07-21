import { DISTRICT_POU_KM2, NEW_GROUND_KM, CONFLICT_CORRIDOR_KM, type DataStore } from '../data'
import type { GeoFeature, PodRecord, WellRecord } from '../types'
import { conflictJunior, conflictSenior } from '../filters'
import { state } from '../state'
import { fetchAnnualMeans, fetchGageFlowHistory, mergedYearSeries, type AnnualMean, type GageFlowHistory } from '../usgs'
import { enhanceCharts, seriesFromPointsWithGaps, svgChart } from './chart'
import { openModal } from './modal'
import {
  DRY_REACH_METHODOLOGY,
  DRY_REACH_SENIOR_YEAR,
  dryReachSeniorsToCsv,
  downloadCsv,
  listDryReachSeniors,
} from '../dryReach'

/** Width for charts rendered inside the lightbox modal. */
function modalChartW(): number {
  return Math.min(640, Math.max(280, window.innerWidth - 48))
}

/** Main-stem gages used in the Mackay → Moore → Arco step-down story (USGS NWIS coords). */
export const FLOW_STEP_GAGES = {
  mackay: { site: '13127000', name: 'Below Mackay Reservoir', lat: 43.93916667, lon: -113.6483333 },
  moore: { site: '13132100', name: 'Below Moore diversion', lat: 43.7843611, lon: -113.3608889 },
  mooreNear: { site: '13132000', name: 'Near Moore', lat: 43.78683056, lon: -113.35945 },
  arco: { site: '13132500', name: 'Near Arco', lat: 43.5822222, lon: -113.2705556 },
  sinks: { site: '13132565', name: 'Above Big Lost River Sinks', lat: 43.7233333, lon: -112.875 },
} as const

const EXTENT_CHAIN_SITES = new Set([
  FLOW_STEP_GAGES.mackay.site,
  FLOW_STEP_GAGES.moore.site,
  FLOW_STEP_GAGES.mooreNear.site,
  FLOW_STEP_GAGES.arco.site,
  FLOW_STEP_GAGES.sinks.site,
  '13132580',
])

const ZERO_CFS = 0.5

function open(html: string) {
  const panel = document.getElementById('details')!
  const content = document.getElementById('details-content')!
  content.innerHTML = html
  panel.classList.add('open')
  enhanceCharts(content)
}

export function closeDetails() {
  document.getElementById('details')?.classList.remove('open')
}

const FOOT = `<div style="margin-top:6px;font-size:0.7em;color:var(--text-muted)">`

export function showPodDetails(rec: PodRecord, store: DataStore) {
  const p = rec.feature.properties
  let html = `<h3 style="margin-top:0">Water Right ${rec.wr || p.OBJECTID || ''}</h3>`
  if (rec.year != null) html += priorityBadge(rec.year)
  if (store.transferDistKm.has(rec.wr)) html += transferBadge(store.transferDistKm.get(rec.wr)!)
  if (rec.corridorDistKm > CONFLICT_CORRIDOR_KM) {
    html += `<span class="badge" title="POD is ${rec.corridorDistKm.toFixed(1)} km from the NHD mainstem / NWI riparian corridor — excluded from Potential conflicts view">${rec.corridorDistKm.toFixed(1)} km off river corridor</span>`
  }
  html += `<div style="margin-top:6px">`
  if (rec.owner) html += `<div><strong>Owner:</strong> ${rec.owner}</div>`
  if (rec.source) html += `<div><strong>Source:</strong> ${rec.source}</div>`
  if (rec.year != null) html += `<div><strong>Priority year:</strong> ${rec.year}</div>`
  if (p.OverallMaxDiversionRate != null) html += `<div><strong>Max diversion rate:</strong> ${p.OverallMaxDiversionRate} cfs</div>`
  if (p.Uses) html += `<div><strong>Uses:</strong> ${p.Uses}</div>`
  if (p.Status) html += `<div><strong>Status:</strong> ${p.Status}</div>`
  html += `</div>`
  const pouCount = (store.pousByWR.get(rec.wr) || []).length
  if (pouCount > 0) {
    html += `<div style="margin-top:4px;font-size:0.85em">${pouCount} Place of Use polygon${pouCount > 1 ? 's' : ''} — purple outline + dashed line on map.</div>`
    html += `<button class="zoom-btn" data-zoom-wr="${rec.wr}">Zoom to right (POD + place of use)</button>`
  }
  if (p.WRReport) html += `<div style="margin-top:4px"><a href="${p.WRReport}" target="_blank" rel="noopener">Official Water Right Report →</a></div>`
  html += `${FOOT}Data: IDWR WaterRightPods (Basin 34 / WD34). PriorityDate is the authoritative seniority field.</div>`
  open(html)
}

export function showWellDetails(rec: WellRecord) {
  const p = rec.feature.properties
  let html = `<h3 style="margin-top:0">Well ${p.WellID || p.OBJECTID || ''}</h3>`
  if (p.Owner) html += `<div><strong>Owner:</strong> ${p.Owner}</div>`
  if (p.WellUse) html += `<div><strong>Use:</strong> ${p.WellUse}</div>`
  if (p.TotalDepth != null) html += `<div><strong>Total depth:</strong> ${p.TotalDepth} ft</div>`
  if (p.StaticWaterLevel != null) html += `<div><strong>Static water level:</strong> ${p.StaticWaterLevel} ft</div>`
  if (p.ProductionRate != null) html += `<div><strong>Production rate:</strong> ${p.ProductionRate} gpm</div>`
  if (p.CountyName) html += `<div><strong>County:</strong> ${p.CountyName}</div>`
  if (rec.year != null) html += `<div><strong>Constructed:</strong> ~${rec.year}</div>`
  if (p.WellDocs) html += `<div><a href="${p.WellDocs}" target="_blank" rel="noopener">View full Well Docs →</a></div>`
  html += `${FOOT}Data: IDWR Wells (Basin 34 / WD34 filtered). Wells carry construction dates; <strong>priority dates</strong> belong to water rights (PODs layer or <a href="https://research.idwr.idaho.gov/apps/shared/WrExtSearch/WaterRightsSearch" target="_blank" rel="noopener">IDWR Water Rights Search</a>).</div>`
  open(html)
}

/** Details for a clicked POU polygon: every right sharing it, as compact cards. */
export function showPouGroupDetails(wrs: Set<string>, clicked: GeoFeature, store: DataStore) {
  let html = `<h3 style="margin-top:0">Place of Use</h3>`
  const props = clicked.properties || {}
  const areaKm2: number = props.__areaKm2 ?? 0
  if (areaKm2 >= DISTRICT_POU_KM2) {
    html += `<div class="badge">district / service area — ${Math.round(areaKm2 * 247.1).toLocaleString()} acres</div>` +
      `<div style="font-size:0.8em;color:var(--text-muted);margin:4px 0">This right's authorized place of use is an entire service area, not an individual field. It is drawn as an outline so the fields inside stay visible.</div>`
  } else if (props.TotalAcres == null && areaKm2 > 0) {
    html += `<div><strong>Area:</strong> ~${Math.round(areaKm2 * 247.1).toLocaleString()} acres</div>`
  }
  if (props.TotalAcres != null) html += `<div><strong>Total acres:</strong> ${props.TotalAcres}</div>`
  if (props.WaterUse) html += `<div><strong>Water use:</strong> ${props.WaterUse}</div>`
  html += `<div style="margin:6px 0"><strong>${wrs.size} associated water right${wrs.size > 1 ? 's' : ''}:</strong></div>`

  // Sort by priority year so the most senior right leads the list
  const sorted = Array.from(wrs).sort((a, b) => {
    const ya = store.podsByWR.get(a)?.[0]?.year ?? 9999
    const yb = store.podsByWR.get(b)?.[0]?.year ?? 9999
    return ya - yb
  })

  for (const wr of sorted) {
    const pods = store.podsByWR.get(wr) || []
    if (!pods.length) {
      html += `<div class="wr-card">${wr} <span style="opacity:0.7">(no POD in current data)</span></div>`
      continue
    }
    const rec = pods[0]
    const p = rec.feature.properties
    html += `<div class="wr-card">`
    html += `<div class="wr-card-head"><strong>${wr}</strong>${pods.length > 1 ? ` <span style="font-size:0.8em;opacity:0.7">(${pods.length} PODs)</span>` : ''}`
    if (rec.year != null) html += priorityBadge(rec.year)
    html += `</div>`
    if (rec.owner) html += `Owner: ${rec.owner}<br>`
    if (rec.source) html += `Source: ${rec.source}<br>`
    if (p.OverallMaxDiversionRate != null) html += `Max rate: ${p.OverallMaxDiversionRate} cfs<br>`
    const dist = store.transferDistKm.get(wr)
    if (dist != null) html += transferBadge(dist)
    html += `<div style="margin-top:2px">`
    html += `<button class="zoom-btn" data-zoom-wr="${wr}">Zoom to POD</button>`
    if (p.WRReport) html += ` <a href="${p.WRReport}" target="_blank" rel="noopener">Full report →</a>`
    html += `</div></div>`
  }
  html += `${FOOT}Dashed purple lines connect this field to its point(s) of diversion. Click the map background or press Esc to clear.</div>`
  open(html)
}

/** Gage details: lightbox modal with a large live flow-history chart (USGS NWIS). */
export function showGageDetails(feature: GeoFeature) {
  const p = feature.properties || {}
  let html = `<h3 style="margin-top:0">${p.name || 'Stream gage'}</h3>`
  if (p.site_no) html += `<div class="badge">USGS ${p.site_no}</div>`
  if (p.notes) html += `<div style="margin:6px 0;font-size:0.85em">${p.notes}</div>`
  if (p.historical_summary) html += `<div style="margin:6px 0;font-size:0.85em"><em>${p.historical_summary}</em></div>`
  html += `<div id="gage-chart" style="margin:8px 0;font-size:0.8em;color:var(--text-muted)">Loading flow history from USGS NWIS…</div>`
  if (p.site_no && EXTENT_CHAIN_SITES.has(p.site_no)) {
    html += `<button class="zoom-btn" data-show-shrink style="margin:4px 0">📉 View step-down: Mackay → Moore → Arco</button><br>`
  }
  if (p.url) html += `<a href="${p.url}" target="_blank" rel="noopener">Open full USGS page →</a>`
  html += `${FOOT}Annual mean discharge per calendar year, live from the USGS NWIS statistics service (approved daily data). Hover the chart for per-year values. Neutral visualization only.</div>`
  openModal(html)

  if (!p.site_no) return
  fetchGageFlowHistory(p.site_no)
    .then(history => renderGageChart(p.site_no, history, p))
    .catch(() => {
      const el = document.getElementById('gage-chart')
      if (el) el.innerHTML = `Could not load NWIS statistics right now — <a href="${p.url || `https://waterdata.usgs.gov/nwis/uv?site_no=${p.site_no}`}" target="_blank" rel="noopener">view on USGS</a>.`
    })
}

function renderGageChart(
  _siteNo: string,
  history: GageFlowHistory,
  props?: GeoFeature['properties'],
) {
  const el = document.getElementById('gage-chart')
  if (!el) return
  const series = mergedYearSeries(history)
  const currentYear = new Date().getFullYear()

  if (series.length === 0) {
    el.style.color = 'inherit'
    el.innerHTML =
      `<div style="font-size:0.85rem;padding:6px 10px;border-left:3px solid #d97706;background:rgba(217,119,6,0.08)">` +
      `<strong style="color:#b45309">No annual flow statistics in USGS NWIS for this site.</strong> ` +
      `The gage may report stage only, have a very short record, or use a different parameter. ` +
      (props?.notes ? `${props.notes} ` : '') +
      `</div>` +
      (props?.historical_summary
        ? `<div style="font-size:0.85rem;margin-top:6px"><em>${props.historical_summary}</em></div>`
        : '')
    return
  }

  const firstY = series[0].year
  const lastY = series[series.length - 1].year
  const discontinued = lastY < currentYear - 2
  const gapYears = series.some((d, i) => i > 0 && d.year - series[i - 1].year > 2)
  const sparse = series.length < 5

  const zeroYears = series.filter(d => d.cfs <= ZERO_CFS)
  const zeroPct = Math.round((zeroYears.length / series.length) * 100)
  const peak = series.reduce((best, d) => (d.cfs > best.cfs ? d : best), series[0])
  const lastPt = series[series.length - 1]
  const lossFromPeak = peak.cfs > 0 ? ((peak.cfs - lastPt.cfs) / peak.cfs) * 100 : 0

  // First vs final period of record (adapt window to short records).
  const n = Math.max(1, Math.min(5, Math.floor(series.length / 2), series.length))
  const earlySlice = series.slice(0, n)
  const lateSlice = series.slice(-n)
  const earlyYears = `${earlySlice[0].year}${earlySlice.length > 1 ? `–${earlySlice[earlySlice.length - 1].year}` : ''}`
  const lateYears = `${lateSlice[0].year}${lateSlice.length > 1 ? `–${lateSlice[lateSlice.length - 1].year}` : ''}`
  const mean = (xs: typeof series) => xs.reduce((s, d) => s + d.cfs, 0) / xs.length
  const earlyMean = mean(earlySlice)
  const lateMean = mean(lateSlice)
  const periodPct = earlyMean > 0 ? ((lateMean - earlyMean) / earlyMean) * 100 : 0

  let html = ''

  if (sparse) {
    html += `<div style="font-size:0.85rem;margin-bottom:4px;color:var(--text-muted)">` +
      `Short record — only <strong>${series.length}</strong> year${series.length === 1 ? '' : 's'} with flow statistics ` +
      `(${firstY}${series.length > 1 ? `–${lastY}` : ''}). Chart shows all available data.</div>`
  }

  if (discontinued || zeroPct >= 40 || lastPt.cfs <= ZERO_CFS) {
    html += `<div style="font-size:0.85rem;margin-bottom:4px;padding:4px 8px;border-left:3px solid #dc2626;background:rgba(220,38,38,0.08)">` +
      `<strong style="color:#dc2626">${zeroYears.length} of ${series.length} years (${zeroPct}%) had zero annual mean flow</strong>` +
      (discontinued ? ` — gage discontinued, record ends <strong>${lastY}</strong>.` : '.') +
      (peak.cfs > 0 && lastPt.cfs < peak.cfs
        ? ` Peak year ${peak.year} (${peak.cfs.toFixed(0)} cfs) → final year ${lastPt.cfs.toFixed(1)} cfs` +
          ` (<strong>${lossFromPeak.toFixed(0)}% loss</strong> from peak to end of record).`
        : '') +
      (lastPt.daysWithFlow != null && lastPt.daysWithData
        ? ` Final year ${lastY}: flow on <strong>${lastPt.daysWithFlow} of ${lastPt.daysWithData} days</strong> only` +
          ` (calendar mean ${lastPt.cfs.toFixed(1)} cfs — brief pulse, not sustained flow).`
        : '') +
      `</div>`
  } else if (series.length >= 2) {
    const declineColor = periodPct < 0 ? '#dc2626' : '#16a34a'
    html += `<div style="font-size:0.85rem;color:var(--text)"><strong style="color:${declineColor}">${periodPct < 0 ? '▼' : '▲'} ${Math.abs(periodPct).toFixed(0)}%</strong> ` +
      `mean ${lateYears} (${lateMean.toFixed(0)} cfs) vs ${earlyYears} (${earlyMean.toFixed(0)} cfs)</div>`
  } else {
    html += `<div style="font-size:0.85rem;color:var(--text)">Single year of record: <strong>${firstY}</strong> — ${series[0].cfs.toFixed(1)} cfs annual mean.</div>`
  }

  if (discontinued && series.length >= 2) {
    html += `<div style="font-size:0.85rem;margin:4px 0;padding:4px 8px;border-left:3px solid #d97706;background:rgba(217,119,6,0.08)">` +
      `<strong style="color:#b45309">Record ends ${lastY} — gage discontinued.</strong> ` +
      `Comparisons use the first and final ${n}-year period(s) of the record, not calendar "recent" years.</div>`
  }

  if (gapYears) {
    html += `<div style="font-size:0.85rem;margin:4px 0;color:var(--text-muted)">` +
      `Multi-year gaps in the record — lines break where years are missing (dry periods are not drawn as false ramps).</div>`
  }

  const chartSeries = seriesFromPointsWithGaps(
    series.map(d => ({ x: d.year, y: d.cfs })),
    {
      color: '#0ea5e9',
      label: `flow ${firstY}–${lastY}${discontinued ? ' (discontinued)' : ''}`,
      kind: 'line',
      width: 1.8,
    },
  )

  const refLines = series.length >= 2 && (earlyMean !== lateMean || earlySlice[0].year !== lateSlice[0].year)
    ? [
        { y: earlyMean, color: '#16a34a', label: `${earlyYears} mean ${earlyMean.toFixed(0)}` },
        { y: lateMean, color: '#dc2626', label: `${lateYears} mean ${lateMean.toFixed(0)}` },
      ]
    : peak.cfs > 0
      ? [{ y: peak.cfs, color: '#64748b', label: `peak ${peak.year} ${peak.cfs.toFixed(0)} cfs` }]
      : []

  html += svgChart({
    width: modalChartW(),
    height: 280,
    series: chartSeries,
    refLines,
    markers: [
      ...zeroYears.map(d => ({
        x: d.year,
        y: d.cfs,
        color: '#dc2626',
        title: `${d.year}: ${d.cfs} cfs${d.daysWithFlow != null ? ` — flow on ${d.daysWithFlow}/${d.daysWithData} days` : ''}`,
      })),
      ...(series.length === 1 ? [{ x: series[0].year, y: series[0].cfs, color: '#0ea5e9', title: `${series[0].year}: ${series[0].cfs} cfs` }] : []),
    ],
    yLabel: 'cfs (calendar-year mean)',
  })
  el.innerHTML = html
  el.style.color = 'inherit'
  enhanceCharts(el)
}

/** Ranked list of on-corridor senior-downstream vs junior-upstream rights. */
export function showConflictsOverview(store: DataStore) {
  const senior = new Map<string, PodRecord>()
  const junior = new Map<string, PodRecord>()
  let excluded = 0
  for (const rec of store.pods) {
    if (rec.year == null) continue
    const down = rec.lat < 43.62
    const wouldMatchOld =
      (rec.year < 1970 && down) || (rec.year >= 1980 && !down)
    if (wouldMatchOld && rec.corridorDistKm > CONFLICT_CORRIDOR_KM) excluded++
    if (conflictSenior(rec, state, store) && !senior.has(rec.wr)) senior.set(rec.wr, rec)
    if (conflictJunior(rec, state, store) && !junior.has(rec.wr)) junior.set(rec.wr, rec)
  }

  const byRate = (a: PodRecord, b: PodRecord) => b.rate - a.rate || (a.year ?? 9999) - (b.year ?? 9999)
  const seniorList = [...senior.values()].sort(byRate)
  const juniorList = [...junior.values()].sort(byRate)

  let html = `<h3 style="margin-top:0">Potential conflicts (river corridor)</h3>`
  html += `<div style="font-size:0.85em;margin-bottom:6px">` +
    `Senior (pre-1970) rights on the valley-floor river path downstream vs newer (post-1980) upstream development — ` +
    `POD within <strong>${CONFLICT_CORRIDOR_KM} km</strong> of the NHD Big Lost mainstem + NWI riparian corridor. ` +
    `Mountain springs and tributary PODs far from the channel are excluded (${excluded} PODs dropped from the old latitude-only rule).</div>`

  html += `<div style="font-size:0.85em;margin:8px 0"><strong style="color:#eab308">Senior downstream</strong> — ${seniorList.length} rights</div>`
  for (const rec of seniorList.slice(0, 15)) {
    html += conflictCard(rec)
  }
  if (seniorList.length > 15) {
    html += `<div style="font-size:0.75em;color:var(--text-muted)">Top 15 of ${seniorList.length} by max diversion rate.</div>`
  }

  html += `<div style="font-size:0.85em;margin:12px 0 8px"><strong style="color:#f97316">Newer upstream</strong> — ${juniorList.length} rights</div>`
  for (const rec of juniorList.slice(0, 15)) {
    html += conflictCard(rec)
  }
  if (juniorList.length > 15) {
    html += `<div style="font-size:0.75em;color:var(--text-muted)">Top 15 of ${juniorList.length} by max diversion rate.</div>`
  }

  html += `${FOOT}Geometric + priority-date proxy for rights that plausibly share the same connected surface-water path — not a legal injury finding. ` +
    `Springs and creeks in the Lost River Range may be hydrologically separate even when filed under Basin 34. Verify with IDWR reports and WD34 accounting.</div>`
  open(html)
}

function conflictCard(rec: PodRecord): string {
  let html = `<div class="wr-card"><div class="wr-card-head"><strong>${rec.wr}</strong>`
  if (rec.year != null) html += priorityBadge(rec.year)
  html += ` <span class="badge" title="Distance from POD to nearest mainstem / riparian point">${rec.corridorDistKm.toFixed(1)} km on corridor</span>`
  if (rec.rate > 0) html += ` <span class="badge">${rec.rate} cfs</span>`
  html += `</div>`
  if (rec.owner) html += `${rec.owner}<br>`
  if (rec.source) html += `<span style="color:var(--text-muted)">${rec.source}</span><br>`
  html += `<button class="zoom-btn" data-zoom-wr="${rec.wr}">Zoom to POD</button></div>`
  return html
}

/** Ranked list of potential transfers (largest POD↔POU separations). */
export function showTransfersOverview(store: DataStore) {
  const entries = [...store.transferDistKm.entries()].sort((a, b) => b[1] - a[1])
  const newGroundCount = store.newGroundWRs.size
  let html = `<h3 style="margin-top:0">Potential transfers</h3>`
  html += `<div style="font-size:0.85em;margin-bottom:6px">${entries.length} rights have a point of diversion more than 8 km from their authorized place of use — a proxy for moved use. ` +
    `<span style="color:var(--text-muted)">IDWR only serves the <em>current</em> POU geometry; original (pre-transfer) places of use require IDWR transfer records (linked in each right's report).</span></div>`
  if (newGroundCount > 0) {
    html += `<div style="font-size:0.85em;margin:6px 0;padding:4px 8px;border-left:3px solid #ea580c;background:rgba(234,88,12,0.08)">` +
      `<strong style="color:#c2410c">${newGroundCount} of ${entries.length} flagged transfers now irrigate land outside the river's natural corridor</strong> ` +
      `(POU more than ${NEW_GROUND_KM} km from both the NHD river channel and any NWI riparian area — solid orange fill on the map).</div>`
  }
  for (const [wr, dist] of entries.slice(0, 25)) {
    const rec = store.podsByWR.get(wr)?.[0]
    const corridorD = store.corridorDistKm.get(wr)
    html += `<div class="wr-card"><div class="wr-card-head"><strong>${wr}</strong>` +
      (rec?.year != null ? ` <span class="badge ${rec.year < 1950 ? 'badge-senior' : rec.year < 2000 ? 'badge-mid' : 'badge-junior'}">${rec.year}</span>` : '') +
      ` <span class="badge badge-transfer">${dist.toFixed(1)} km</span>` +
      (store.newGroundWRs.has(wr)
        ? ` <span class="badge badge-newground" title="POU is ${corridorD?.toFixed(1)} km from the natural river corridor">new ground · ${corridorD?.toFixed(1)} km off-corridor</span>`
        : '') +
      `</div>`
    if (rec?.owner) html += `${rec.owner}<br>`
    if (rec?.source) html += `<span style="color:var(--text-muted)">${rec.source}</span><br>`
    html += `<button class="zoom-btn" data-zoom-wr="${wr}">Zoom to POD + POU</button></div>`
  }
  if (entries.length > 25) html += `<div style="font-size:0.75em;color:var(--text-muted)">Top 25 of ${entries.length} shown (by distance). Click purple stars on the map for the rest.</div>`
  html += `${FOOT}Distance is from the POD to the right's first POU polygon, adjusted for the polygon's size (so a POD inside a large district service area is not flagged). ` +
    `"New ground" is a geometric proxy — the place of use sits outside the river's natural corridor (NHD channel + NWI riparian) — not a land-use history finding. Neutral data pattern only.</div>`
  open(html)
}

/** All rights delivered through one named diversion (canal/ditch system). */
export function showDiversionDetails(
  d: { name: string; totalRate: number; rightWRs: string[]; earliestYear: number | null },
  store: DataStore,
) {
  let html = `<h3 style="margin-top:0">${d.name}</h3>`
  html += `<div style="font-size:0.85em;margin-bottom:6px"><strong>${d.rightWRs.length} water rights</strong> · ` +
    `<strong>${d.totalRate.toFixed(1)} cfs</strong> total authorized` +
    (d.earliestYear != null ? ` · earliest priority <strong>${d.earliestYear}</strong>` : '') + `</div>`

  const sorted = [...d.rightWRs].sort((a, b) => {
    const ya = store.podsByWR.get(a)?.[0]?.year ?? 9999
    const yb = store.podsByWR.get(b)?.[0]?.year ?? 9999
    return ya - yb
  })
  for (const wr of sorted.slice(0, 40)) {
    const rec = store.podsByWR.get(wr)?.[0]
    if (!rec) continue
    const p = rec.feature.properties
    html += `<div class="wr-card"><div class="wr-card-head"><strong>${wr}</strong>`
    if (rec.year != null) html += priorityBadge(rec.year)
    html += `</div>`
    if (rec.owner) html += `${rec.owner}<br>`
    if (p.OverallMaxDiversionRate != null) html += `Max rate: ${p.OverallMaxDiversionRate} cfs<br>`
    html += `<button class="zoom-btn" data-zoom-wr="${wr}">Zoom to right</button></div>`
  }
  if (sorted.length > 40) html += `<div style="font-size:0.75em;color:var(--text-muted)">First 40 of ${sorted.length} rights shown (sorted senior → junior).</div>`
  html += `${FOOT}Aggregated from the IDWR POD “DiversionName” field for surface-water rights. Rates are counted once per right.</div>`
  open(html)
}

/** Basin-wide cumulative appropriation vs. measured supply. */
export async function showAppropriationPanel(store: DataStore) {
  // One rate per right (multiple PODs share the right's authorized rate)
  const rights: Array<{ year: number; rate: number; isGW: boolean }> = []
  store.podsByWR.forEach(pods => {
    const r = pods[0]
    if (r.year != null) rights.push({ year: r.year, rate: r.rate, isGW: r.isGW })
  })
  rights.sort((a, b) => a.year - b.year)

  const cumAll: { x: number; y: number }[] = []
  const cumGW: { x: number; y: number }[] = []
  const cumSurf: { x: number; y: number }[] = []
  let tot = 0, gw = 0, surf = 0
  for (const r of rights) {
    tot += r.rate
    if (r.isGW) gw += r.rate
    else surf += r.rate
    cumAll.push({ x: r.year, y: tot })
    cumGW.push({ x: r.year, y: gw })
    cumSurf.push({ x: r.year, y: surf })
  }

  let html = `<h3 style="margin-top:0">Appropriation over time</h3>`
  html += `<div style="font-size:0.85em;margin-bottom:4px">Cumulative <strong>authorized</strong> maximum diversion rate of all ${rights.length.toLocaleString()} dated Basin 34 rights, by priority year — currently <strong>${Math.round(tot).toLocaleString()} cfs</strong> (${Math.round(surf).toLocaleString()} surface + ${Math.round(gw).toLocaleString()} groundwater).</div>`
  html += `<div id="appropriation-chart">`
  html += svgChart({
    width: modalChartW(),
    height: 240,
    series: [
      { points: cumAll, color: '#64748b', label: 'all rights (cumulative cfs)', kind: 'step', width: 2 },
      { points: cumSurf, color: '#0ea5e9', label: 'surface', kind: 'step' },
      { points: cumGW, color: '#6d28d9', label: 'groundwater', kind: 'step' },
    ],
    yLabel: 'authorized cfs (cumulative)',
  })
  html += `</div>`
  html += `<div id="appropriation-supply" style="font-size:0.8em;color:var(--text-muted);margin-top:6px">Loading measured supply at the Arco gage (USGS 13132500)…</div>`
  html += `${FOOT}Authorized maximum rates are not the same as actual use (rights are limited by supply, priority administration, and season), but the gap between paper rights and measured flow is the standard first-order view of overappropriation. Hover the charts for per-year values. Data: IDWR PriorityDate + OverallMaxDiversionRate; USGS NWIS.</div>`
  openModal(html)

  try {
    const flow = await fetchAnnualMeans('13132500')
    const el = document.getElementById('appropriation-supply')
    if (!el || flow.length === 0) return
    const meanFlow = flow.reduce((s, d) => s + d.cfs, 0) / flow.length
    const ratio = tot / meanFlow
    el.style.color = 'inherit'
    el.innerHTML =
      `<div style="font-size:0.85rem"><strong style="color:#dc2626">${ratio.toFixed(0)}×</strong> ` +
      `total authorized rights (${Math.round(tot).toLocaleString()} cfs) vs the long-term mean flow at Arco ` +
      `(${meanFlow.toFixed(0)} cfs, ${flow[0].year}–${flow[flow.length - 1].year}).</div>` +
      svgChart({
        width: modalChartW(),
        height: 170,
        series: [{
          points: flow.map(d => ({ x: d.year, y: d.cfs })),
          color: '#0ea5e9',
          label: 'annual mean flow at Arco (cfs)',
          kind: 'area',
        }],
        refLines: [{ y: meanFlow, color: '#64748b', label: `mean ${meanFlow.toFixed(0)} cfs` }],
        yLabel: 'cfs',
      })
    enhanceCharts(el)
  } catch {
    const el = document.getElementById('appropriation-supply')
    if (el) el.textContent = 'Could not load USGS flow statistics right now.'
  }
}

/** River shrink: step-down at Mackay, Moore, and Arco on the main stem (full historical record). */
export async function showReachLossPanel() {
  const { mackay, moore, arco } = FLOW_STEP_GAGES

  let html = `<h3 style="margin-top:0">River shrink: Mackay → Moore → Arco</h3>`
  html += `<div style="font-size:0.85em;margin-bottom:6px">Full historical records from USGS NWIS — calendar-year means from daily values where needed ` +
    `(Moore gage ${moore.site} daily data from 2019; published annual stats only from 2020). ` +
    `The step-down shows where flow disappears: most loss occurs before Arco; the Arco gage often reads zero in recent years.</div>`
  html += `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;font-size:0.75em">` +
    `<button class="zoom-btn" data-zoom-gage="${mackay.site}">Zoom: Mackay</button>` +
    `<button class="zoom-btn" data-zoom-gage="${moore.site}">Zoom: Moore div</button>` +
    `<button class="zoom-btn" data-zoom-gage="${arco.site}">Zoom: Arco</button>` +
    `<button class="zoom-btn" data-zoom-gage="${FLOW_STEP_GAGES.sinks.site}">Zoom: Sinks (Howe)</button>` +
    `</div>`
  html += `<div id="shrink-chart" style="font-size:0.8em;color:var(--text-muted)">Loading full gage histories from USGS NWIS (daily + annual)…</div>`
  html += `${FOOT}Calendar-year mean cfs (daily values averaged over all days, dry days = 0). ` +
    `Reach % = downstream ÷ Mackay that year. Lines break at multi-year gaps so missing years are not drawn as false ramps. Neutral mass-balance view.</div>`
  openModal(html)

  try {
    const [mackayH, mooreH, arcoH] = await Promise.all([
      fetchGageFlowHistory(mackay.site),
      fetchGageFlowHistory(moore.site),
      fetchGageFlowHistory(arco.site),
    ])
    const el = document.getElementById('shrink-chart')
    if (!el) return

    const mackayS = mergedYearSeries(mackayH)
    const mooreS = mergedYearSeries(mooreH)
    const arcoS = mergedYearSeries(arcoH)
    const mooreMap = new Map(mooreS.map(d => [d.year, d.cfs]))
    const arcoMap = new Map(arcoS.map(d => [d.year, d.cfs]))

    // Every year Mackay has data; attach Moore/Arco when available (full history, not truncated).
    const joined = mackayS.map(d => ({
      year: d.year,
      mackay: d.cfs,
      moore: mooreMap.get(d.year),
      arco: arcoMap.get(d.year),
    }))
    const mackayArco = joined.filter(d => d.arco != null)
    if (mackayArco.length < 6) {
      el.textContent = 'Not enough overlapping years between Mackay and Arco.'
      return
    }

    const n = Math.max(5, Math.min(15, Math.floor(mackayArco.length / 3)))
    const mean = (xs: number[]) => xs.reduce((s, v) => s + v, 0) / xs.length
    const reachArco = (d: typeof joined[0]) => d.mackay > 0 && d.arco != null ? (d.arco / d.mackay) * 100 : 0
    const earlySlice = mackayArco.slice(0, n)
    const lateSlice = mackayArco.slice(-n)
    const earlyArcoPct = mean(earlySlice.map(reachArco))
    const lateArcoPct = mean(lateSlice.map(reachArco))
    const earlyYears = `${earlySlice[0].year}–${earlySlice[earlySlice.length - 1].year}`
    const lateYears = `${lateSlice[0].year}–${lateSlice[lateSlice.length - 1].year}`
    const lateArcoZeros = lateSlice.filter(d => (d.arco ?? 0) <= ZERO_CFS).length

    const mooreYears = joined.filter(d => d.moore != null)
    let mooreTableHtml = ''
    if (mooreYears.length >= 1) {
      const avgMoorePct = mean(mooreYears.map(d => d.mackay > 0 ? (d.moore! / d.mackay) * 100 : 0))
      mooreTableHtml =
        `<div style="font-size:0.85rem;margin:8px 0;padding:6px 10px;border-left:3px solid #f97316;background:rgba(249,115,22,0.08)">` +
        `<strong style="color:#c2410c">Moore below diversion (${mooreYears[0].year}–${mooreYears[mooreYears.length - 1].year}, ${mooreYears.length} yrs from daily record):</strong> ` +
        `on average <strong>${avgMoorePct.toFixed(0)}%</strong> of Mackay release reaches Moore; ` +
        `${mooreYears.filter(d => (d.arco ?? 0) <= ZERO_CFS).length} of those years had zero flow at Arco.</div>` +
        `<details style="font-size:0.75rem;margin:6px 0"><summary style="cursor:pointer">Year-by-year table (all ${mooreYears.length} Moore years + full Mackay/Arco overlap)</summary>` +
        `<table style="width:100%;font-size:0.75rem;border-collapse:collapse;margin-top:4px">` +
        `<tr style="border-bottom:1px solid var(--border)"><th>Year</th><th>Mackay</th><th>Moore</th><th>Arco</th><th>%→Moore</th><th>%→Arco</th></tr>` +
        mooreYears.map(d => {
          const pctM = d.mackay > 0 ? (d.moore! / d.mackay * 100).toFixed(0) : '—'
          const pctA = d.arco != null && d.mackay > 0 ? (d.arco / d.mackay * 100).toFixed(0) : '—'
          const arcoZero = d.arco != null && d.arco <= ZERO_CFS ? ' style="color:#dc2626;font-weight:600"' : ''
          return `<tr style="border-bottom:1px solid var(--border)"><td>${d.year}</td>` +
            `<td>${d.mackay.toFixed(0)}</td><td>${d.moore!.toFixed(1)}</td>` +
            `<td${arcoZero}>${d.arco != null ? d.arco.toFixed(2) : '—'}</td><td>${pctM}%</td><td${arcoZero}>${pctA}${d.arco != null ? '%' : ''}</td></tr>`
        }).join('') +
        `</table></details>`
    }

    const arcoZeroMarkers = mackayArco
      .filter(d => (d.arco ?? 0) <= ZERO_CFS)
      .map(d => ({ x: d.year, y: d.arco!, color: '#dc2626', title: `${d.year}: Arco ${d.arco} cfs — zero annual mean` }))

    const pctSeries = [
      ...seriesFromPointsWithGaps(
        mackayArco.map(d => ({ x: d.year, y: reachArco(d) })),
        { color: '#16a34a', label: '% of Mackay reaching Arco', kind: 'line', width: 1.8 },
      ),
      ...seriesFromPointsWithGaps(
        mooreYears.map(d => ({ x: d.year, y: d.mackay > 0 ? (d.moore! / d.mackay) * 100 : 0 })),
        { color: '#f97316', label: '% of Mackay reaching Moore', kind: 'line', width: 1.8 },
      ),
    ]

    el.style.color = 'inherit'
    el.innerHTML =
      `<div style="font-size:0.85rem;margin-bottom:6px">` +
      `<strong>Mackay → Arco</strong> (${mackayArco[0].year}–${mackayArco[mackayArco.length - 1].year}, ${mackayArco.length} overlapping years): ` +
      `${earlyYears}: <strong>${earlyArcoPct.toFixed(0)}%</strong> of Mackay flow reached Arco; ` +
      `${lateYears}: <strong style="color:#dc2626">${lateArcoPct.toFixed(0)}%</strong> ` +
      `(${lateArcoZeros} of those ${n} years had zero at Arco).</div>` +
      mooreTableHtml +
      svgChart({
        width: modalChartW(),
        height: 300,
        series: [
          ...seriesFromPointsWithGaps(
            joined.map(d => ({ x: d.year, y: d.mackay })),
            { color: '#0ea5e9', label: 'Mackay (cfs)', kind: 'line', width: 2 },
          ),
          ...seriesFromPointsWithGaps(
            mooreYears.map(d => ({ x: d.year, y: d.moore! })),
            { color: '#f97316', label: 'Moore below div (cfs)', kind: 'line', width: 2 },
          ),
          ...seriesFromPointsWithGaps(
            mackayArco.map(d => ({ x: d.year, y: d.arco! })),
            { color: '#16a34a', label: 'Arco (cfs)', kind: 'line', width: 1.8 },
          ),
        ],
        markers: arcoZeroMarkers,
        yLabel: 'calendar-year mean cfs',
      }) +
      svgChart({
        width: modalChartW(),
        height: 200,
        series: pctSeries,
        yLabel: '% of Mackay flow',
        yMax: 100,
      }) +
      (mooreYears.length >= 2
        ? svgChart({
            width: modalChartW(),
            height: 160,
            series: [
              {
                points: mooreYears.map(d => ({ x: d.year, y: Math.max(0, d.mackay - (d.moore ?? 0)) })),
                color: '#f97316',
                label: 'Mackay − Moore (cfs)',
                kind: 'line',
              },
              {
                points: mooreYears.filter(d => d.arco != null).map(d => ({
                  x: d.year,
                  y: Math.max(0, (d.moore ?? 0) - d.arco!),
                })),
                color: '#dc2626',
                label: 'Moore − Arco (cfs)',
                kind: 'line',
              },
            ],
            yLabel: 'cfs lost between gages',
          })
        : '') +
      svgChart({
        width: modalChartW(),
        height: 160,
        series: seriesFromPointsWithGaps(
          mackayArco.map(d => ({ x: d.year, y: Math.max(0, d.mackay - d.arco!) })),
          { color: '#dc2626', label: 'Mackay − Arco (cfs)', kind: 'line', width: 1.8 },
        ),
        yLabel: 'cfs',
      }) +
      `<div style="font-size:0.75rem;color:var(--text-muted);margin-top:6px">` +
      `Historic terminus: USGS ${FLOW_STEP_GAGES.sinks.site} above the sinks near Howe (discontinued 2018). ` +
      `That gage was dry most years; its final published year (2018) had flow on only ~94 days (Apr–Jul) — see that gage for detail.</div>`
    enhanceCharts(el)
  } catch {
    const el = document.getElementById('shrink-chart')
    if (el) el.textContent = 'Could not load USGS flow statistics right now.'
  }
}

/** Conjunctive management: GW development growth vs. measured surface supply. */
export async function showConjunctivePanel(store: DataStore) {
  // Cumulative groundwater authorized cfs by priority year (one rate per right)
  const gwRights: Array<{ year: number; rate: number }> = []
  store.podsByWR.forEach(pods => {
    const r = pods[0]
    if (r.isGW && r.year != null) gwRights.push({ year: r.year, rate: r.rate })
  })
  gwRights.sort((a, b) => a.year - b.year)
  const cumGwCfs: { x: number; y: number }[] = []
  let gwTot = 0
  for (const r of gwRights) cumGwCfs.push({ x: r.year, y: gwTot += r.rate })

  // Cumulative irrigation wells by construction year
  const wellYears = store.wells
    .filter(w => w.year != null && w.use.includes('IRRIG'))
    .map(w => w.year!)
    .sort((a, b) => a - b)
  const cumWells = wellYears.map((y, i) => ({ x: y, y: i + 1 }))

  const post1950Rights = gwRights.filter(r => r.year >= 1950)
  const post1950Cfs = post1950Rights.reduce((s, r) => s + r.rate, 0)
  const post1950Wells = wellYears.filter(y => y >= 1950).length

  let html = `<h3 style="margin-top:0">Conjunctive management view</h3>`
  html += `<div style="font-size:0.85em;margin-bottom:4px">Groundwater and the river are one connected supply here. Since 1950, ` +
    `<strong>${post1950Rights.length.toLocaleString()} groundwater rights</strong> ` +
    `(${Math.round(post1950Cfs).toLocaleString()} cfs authorized) and ` +
    `<strong>${post1950Wells.toLocaleString()} irrigation wells</strong> were added in Basin 34 — ` +
    `shown in violet on the map, above the senior (pre-1950) surface rights downstream in yellow.</div>`
  html += svgChart({
    width: modalChartW(),
    height: 210,
    series: [
      { points: cumGwCfs, color: '#7c3aed', label: 'cumulative GW authorized cfs', kind: 'step', width: 2 },
      { points: cumWells, color: '#0f766e', label: 'cumulative irrigation wells (count)', kind: 'step' },
    ],
    yLabel: 'cumulative (cfs / well count)',
  })
  html += `<div id="conjunctive-supply" style="font-size:0.8em;color:var(--text-muted);margin-top:6px">Loading measured flow at the Arco gage (USGS 13132500)…</div>`
  html += `${FOOT}GW rights from IDWR PriorityDate + OverallMaxDiversionRate; well construction years from IDWR Wells. Hover the charts for per-year values. Correlation shown for context, not causation — see USGS SIR reports for the basin's groundwater/surface-water connection studies.</div>`
  openModal(html)

  try {
    const flow = await fetchAnnualMeans('13132500')
    const el = document.getElementById('conjunctive-supply')
    if (!el || flow.length < 6) return
    const n = Math.max(5, Math.min(15, Math.floor(flow.length / 3)))
    const mean = (xs: AnnualMean[]) => xs.reduce((s, d) => s + d.cfs, 0) / xs.length
    const early = mean(flow.slice(0, n))
    const recent = mean(flow.slice(-n))
    const pct = ((recent - early) / early) * 100
    el.style.color = 'inherit'
    el.innerHTML =
      `<div style="font-size:0.85rem">Meanwhile at Arco, downstream of the development: ` +
      `<strong style="color:${pct < 0 ? '#dc2626' : '#16a34a'}">${pct < 0 ? '▼' : '▲'} ${Math.abs(pct).toFixed(0)}%</strong> ` +
      `recent ${n}-yr mean (${recent.toFixed(0)} cfs) vs first ${n} yrs of record (${early.toFixed(0)} cfs).</div>` +
      svgChart({
        width: modalChartW(),
        height: 170,
        series: [{
          points: flow.map(d => ({ x: d.year, y: d.cfs })),
          color: '#0ea5e9',
          label: `annual mean flow at Arco ${flow[0].year}–${flow[flow.length - 1].year}`,
          kind: 'area',
        }],
        refLines: [
          { y: early, color: '#16a34a', label: `early mean ${early.toFixed(0)}` },
          { y: recent, color: '#dc2626', label: `recent mean ${recent.toFixed(0)}` },
        ],
        yLabel: 'cfs',
      })
    enhanceCharts(el)
  } catch {
    const el = document.getElementById('conjunctive-supply')
    if (el) el.textContent = 'Could not load USGS flow statistics right now.'
  }
}

export function showGenericDetails(feature: GeoFeature, group: string) {
  const p = feature.properties || {}
  let html = `<h3 style="margin-top:0">${p.name || p.site_no || group}</h3>`
  if (p.site_no) html += `<div class="badge">USGS ${p.site_no}</div> `
  if (p.era) html += `<div class="badge">${p.era} reference</div>`
  html += `<div style="margin:8px 0;font-size:0.85em">`
  for (const [k, v] of Object.entries(p)) {
    if (['name', 'site_no', 'era', 'source_urls', 'url'].includes(k)) continue
    let val = v
    if (typeof val === 'string' && val.length > 180) val = val.slice(0, 177) + '…'
    html += `<div><strong>${k}:</strong> ${val}</div>`
  }
  html += `</div>`
  if (p.url) html += `<a href="${p.url}" target="_blank" rel="noopener">Open full USGS page →</a><br>`
  if (Array.isArray(p.source_urls)) {
    html += p.source_urls.map((u: string) => `<a href="${u}" target="_blank" rel="noopener">Source data</a>`).join(' ')
  }
  html += `${FOOT}All data from public sources listed in the footer. Neutral visualization only.</div>`
  open(html)
}

function priorityBadge(year: number): string {
  const cls = year < 1950 ? 'badge-senior' : year < 2000 ? 'badge-mid' : 'badge-junior'
  const label = year < 1950 ? 'senior' : year < 2000 ? 'mid' : 'junior'
  return ` <span class="badge ${cls}">${year} · ${label}</span>`
}

function transferBadge(distKm: number): string {
  return ` <span class="badge badge-transfer">POD ${distKm.toFixed(1)} km from POU — potential transfer</span>`
}

/** Ranked table + CSV for downstream seniors on a dry-reach proxy. */
export function showDryReachSeniorsPanel(store: DataStore) {
  const rows = listDryReachSeniors(store)
  const totalCfs = rows.reduce((s, r) => s + r.rate, 0)
  let html =
    `<h2 style="margin-top:0">Downstream seniors on a dry reach</h2>` +
    `<p style="font-size:0.85em;line-height:1.45;color:var(--text-muted)">${DRY_REACH_METHODOLOGY}</p>` +
    `<p style="font-size:0.9em"><strong>${rows.length}</strong> rights · ` +
    `<strong>${totalCfs.toFixed(1)}</strong> cfs combined max diversion · priority before ${DRY_REACH_SENIOR_YEAR}</p>` +
    `<div style="display:flex;gap:8px;flex-wrap:wrap;margin:8px 0">` +
    `<button type="button" id="dry-reach-csv" class="zoom-btn">Download CSV</button>` +
    `</div>`

  if (!rows.length) {
    html += `<p>No matching rights with current corridor distances loaded yet. Wait for data finish, then retry.</p>`
    openModal(html)
    return
  }

  html += `<div style="overflow:auto;max-height:55vh"><table style="width:100%;border-collapse:collapse;font-size:0.8em">` +
    `<thead><tr>` +
    `<th style="text-align:left;padding:4px;border-bottom:1px solid var(--border)">Right</th>` +
    `<th style="text-align:left;padding:4px;border-bottom:1px solid var(--border)">Owner</th>` +
    `<th style="text-align:right;padding:4px;border-bottom:1px solid var(--border)">Year</th>` +
    `<th style="text-align:right;padding:4px;border-bottom:1px solid var(--border)">cfs</th>` +
    `<th style="text-align:left;padding:4px;border-bottom:1px solid var(--border)"></th>` +
    `</tr></thead><tbody>`

  for (const r of rows.slice(0, 200)) {
    html += `<tr>` +
      `<td style="padding:4px;border-bottom:1px solid var(--border)"><code>${r.wr}</code></td>` +
      `<td style="padding:4px;border-bottom:1px solid var(--border)">${r.owner || '—'}</td>` +
      `<td style="padding:4px;border-bottom:1px solid var(--border);text-align:right">${r.year}</td>` +
      `<td style="padding:4px;border-bottom:1px solid var(--border);text-align:right">${r.rate.toFixed(2)}</td>` +
      `<td style="padding:4px;border-bottom:1px solid var(--border)">` +
      `<button type="button" class="zoom-btn" data-zoom-wr="${r.wr}">Zoom</button></td>` +
      `</tr>`
  }
  html += `</tbody></table></div>`
  if (rows.length > 200) html += `<p style="font-size:0.8em;color:var(--text-muted)">Showing top 200 of ${rows.length}. CSV includes all.</p>`

  openModal(html)
  document.getElementById('dry-reach-csv')?.addEventListener('click', () => {
    downloadCsv('basin34-downstream-seniors-dry-reach.csv', dryReachSeniorsToCsv(rows))
  })
}
