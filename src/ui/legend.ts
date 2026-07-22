import { state } from '../state'
import { EMPHASIS_COLORS, POD_COLORS, PRIORITY_COLORS, WELL_USE_COLORS } from '../symbology'

const star = (color: string) => `<span class="lg-star" style="color:${color}">★</span>`
const dot = (color: string) => `<span class="lg-dot" style="background:${color}"></span>`
const swatch = (color: string, dashed = false) =>
  `<span class="lg-poly" style="border-color:${color};${dashed ? 'border-style:dashed;' : ''}"></span>`
const fillSwatch = (stroke: string, fill: string) =>
  `<span class="lg-poly" style="border-color:${stroke};background:${fill}"></span>`

const MODE_LEGEND: Record<string, string> = {
  'senior-downstream': `${star(EMPHASIS_COLORS.senior.stroke)} Pre-1950 rights at/below the focus reach (emphasized). Others dimmed.`,
  'junior-dev': `${star(EMPHASIS_COLORS.junior.stroke)} Post-1980 rights/wells above the rate threshold (orange). Others dimmed.`,
  transfers: `${star(EMPHASIS_COLORS.transfer.stroke)} Rights whose POD sits far (&gt;8 km) from their place of use; dashed lines connect POD ↔ POU. ` +
    `${fillSwatch('#c2410c', 'rgba(249,115,22,0.45)')} solid orange POU = "new ground" — moved outside the river's natural corridor. Others dimmed.`,
  conflict: `${star(EMPHASIS_COLORS['conflict-senior'].stroke)} senior (pre-1970) on river corridor, downstream &nbsp; ${star(EMPHASIS_COLORS['conflict-junior'].stroke)} newer (post-1980) on corridor, upstream. Mountain springs/tributaries off the channel are excluded. Others dimmed.`,
  conjunctive: `${star(EMPHASIS_COLORS['conjunctive-gw'].stroke)} post-1950 groundwater rights &amp; irrigation wells &nbsp; ${star(EMPHASIS_COLORS.senior.stroke)} senior (pre-1950) surface rights downstream. Others dimmed.`,
  'high-rate': `${star(EMPHASIS_COLORS['high-rate'].stroke)} Rights above the rate threshold (red). Others dimmed.`,
}

export interface LegendCounts {
  pods: number
  wells: number
}

export function updateLegend(counts: LegendCounts, layersOn: { pods: boolean; wells: boolean }) {
  const el = document.getElementById('main-legend')
  if (!el) return
  const rows: string[] = []

  if (state.highlightMode !== 'none') {
    const modeText = MODE_LEGEND[state.highlightMode] || ''
    rows.push(`<div class="lg-row lg-mode">${
      state.hideNonMatches
        ? modeText.replace(/Others dimmed\./g, 'Only matching rights shown (phone-friendly).')
        : modeText
    }</div>`)
  }
  if (state.ownerHighlight) {
    rows.push(`<div class="lg-row">${star(EMPHASIS_COLORS.owner.stroke)} Rights owned by “${state.ownerHighlight}”. Others dimmed.</div>`)
  }
  if (state.selectedWRs.size > 0) {
    rows.push(`<div class="lg-row">${star(EMPHASIS_COLORS.selected.stroke)} Selected right(s) — purple POU outline + dashed POD lines.</div>`)
  }

  if (layersOn.pods) {
    if (state.podColorMode === 'priority') {
      rows.push(
        `<div class="lg-row"><strong>★ PODs by priority year</strong> (${counts.pods.toLocaleString()} shown)<br>` +
        PRIORITY_COLORS.map(s => `${star(s.color)} ${s.label}`).join(' &nbsp; ') +
        `</div>`,
      )
    } else {
      rows.push(
        `<div class="lg-row"><strong>★ PODs by source</strong> (${counts.pods.toLocaleString()} shown)<br>` +
        `${star(POD_COLORS.gw)} groundwater &nbsp; ${star(POD_COLORS.surface)} surface &nbsp; ${star(POD_COLORS.other)} other</div>`,
      )
    }
  }
  if (layersOn.wells) {
    rows.push(
      `<div class="lg-row"><strong>● Wells by use</strong> (${counts.wells.toLocaleString()} shown)<br>` +
      WELL_USE_COLORS.slice(0, 4).map(c => `${dot(c.color)} ${c.label}`).join(' &nbsp; ') +
      `</div>`,
    )
  }
  if (state.placeOfUseMode) {
    rows.push(
      `<div class="lg-row">${swatch('#15803d', true)} place of use &nbsp; ${swatch('#f97316', true)} POU of potential transfer &nbsp; ${swatch('#0f766e', true)} district service area (outline only) &nbsp; ${swatch('#a855f7')} selected</div>`,
    )
  }
  rows.push(
    `<div class="lg-row"><span class="lg-dot" style="background:#dc2626"></span> stream gages (click for flow history)</div>`,
  )
  if (state.yearMin > 1800 || state.yearMax < 2026) {
    rows.push(`<div class="lg-row"><strong>Years:</strong> ${state.yearMin}–${state.yearMax} (POD priority / well construction)</div>`)
  }
  if (!rows.length) {
    rows.push(`<div class="lg-row text-[var(--text-muted)]">Toggle layers or pick an analysis view.</div>`)
  }
  rows.push(`<div class="lg-row" style="font-size:0.85em;color:var(--text-muted)">Marker size = diversion / production rate.</div>`)
  el.innerHTML = rows.join('')
}

/** Hint text under the Analysis view selector. */
export const MODE_HINTS: Record<string, string> = {
  none: 'Pick a view to emphasize an investigative pattern. Non-matching points are dimmed, never hidden.',
  'senior-downstream': 'Shows where the oldest (pre-1950) rights divert at/below the focus reach — the rights most exposed to upstream depletion.',
  'junior-dev': 'Shows large post-1980 rights and wells — where significant new development occurred after senior rights were established.',
  transfers: 'Flags rights whose point of diversion is more than 8 km from their authorized place of use — candidates for transfer/POU-change review. Solid orange fills mark places of use more than 1.5 km outside the river\'s natural corridor (NHD channel + NWI riparian) — water moved onto previously dry ground.',
  conflict: 'Contrasts senior (pre-1970) downstream rights with newer (post-1980) upstream development — but only for PODs within 3 km of the NHD mainstem / NWI riparian corridor (valley-floor river path). Opens a ranked overview panel.',
  conjunctive: 'Contrasts the post-1950 groundwater development (rights + irrigation wells) with the senior surface rights downstream that depend on the same connected water — the core conjunctive-management pattern. Opens a chart pairing GW growth with measured flow at Arco.',
  'high-rate': 'Emphasizes rights above the cfs threshold regardless of age.',
}
