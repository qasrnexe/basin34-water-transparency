/** Tiny dependency-free SVG charts for the details panel / modal, with an
 * optional hover crosshair + value readout (see enhanceCharts). */

export interface XY {
  x: number
  y: number
}

export interface Series {
  points: XY[]
  color: string
  label: string
  /** 'line' (default), 'area' (filled to baseline), or 'step' (cumulative look) */
  kind?: 'line' | 'area' | 'step'
  width?: number
}

export interface RefLine {
  y: number
  color: string
  label: string
  dash?: boolean
}

/** A single emphasized data point (e.g. a zero-flow year on a gage record). */
export interface DotMarker {
  x: number
  y: number
  color: string
  title?: string
}

interface ChartOpts {
  width?: number
  height?: number
  series: Series[]
  refLines?: RefLine[]
  /** Emphasized individual points, drawn on top of all series. */
  markers?: DotMarker[]
  yLabel?: string
  /** Clamp the y-axis (e.g. to keep one huge series from flattening the rest). */
  yMax?: number
  /** Attach hover crosshair/readout data (wired by enhanceCharts). Default true. */
  interactive?: boolean
}

const M = { top: 8, right: 6, bottom: 18, left: 38 }

/** Split a point series at calendar-year gaps so lines/areas do not bridge dry decades. */
export function seriesFromPointsWithGaps(
  points: XY[],
  base: Omit<Series, 'points'>,
  maxGapYears = 1,
): Series[] {
  const sorted = [...points].sort((a, b) => a.x - b.x)
  if (!sorted.length) return []
  const segments: XY[][] = []
  let seg: XY[] = []
  for (const p of sorted) {
    if (seg.length && p.x - seg[seg.length - 1].x > maxGapYears) {
      segments.push(seg)
      seg = []
    }
    seg.push(p)
  }
  if (seg.length) segments.push(seg)
  return segments.map((pts, i) => ({
    ...base,
    points: pts,
    label: i === 0 ? (base.label || '') : '',
  }))
}

export function svgChart(opts: ChartOpts): string {
  const W = opts.width ?? 296
  const H = opts.height ?? 150
  const iw = W - M.left - M.right
  const ih = H - M.top - M.bottom

  const allPts = opts.series.flatMap(s => s.points)
  if (!allPts.length) return ''
  let xMin = Infinity, xMax = -Infinity, yMaxData = 0
  for (const p of allPts) {
    if (p.x < xMin) xMin = p.x
    if (p.x > xMax) xMax = p.x
    if (p.y > yMaxData) yMaxData = p.y
  }
  for (const r of opts.refLines || []) yMaxData = Math.max(yMaxData, r.y)
  const yTop = opts.yMax ?? yMaxData * 1.05
  if (xMax === xMin) xMax = xMin + 1

  const sx = (x: number) => M.left + ((x - xMin) / (xMax - xMin)) * iw
  const sy = (y: number) => M.top + ih - (Math.min(y, yTop) / yTop) * ih

  let body = ''

  // Y grid + labels (3 ticks)
  for (const f of [0, 0.5, 1]) {
    const v = yTop * f
    const y = sy(v)
    body += `<line x1="${M.left}" y1="${y}" x2="${W - M.right}" y2="${y}" stroke="currentColor" stroke-opacity="0.15"/>`
    body += `<text x="${M.left - 4}" y="${y + 3}" text-anchor="end" font-size="8" fill="currentColor" fill-opacity="0.7">${fmt(v)}</text>`
  }
  // X labels (first / middle / last year)
  for (const f of [0, 0.5, 1]) {
    const v = Math.round(xMin + (xMax - xMin) * f)
    body += `<text x="${sx(v)}" y="${H - 5}" text-anchor="middle" font-size="8" fill="currentColor" fill-opacity="0.7">${v}</text>`
  }

  for (const s of opts.series) {
    if (!s.points.length) continue
    const pts = [...s.points].sort((a, b) => a.x - b.x)
    let d = ''
    if (s.kind === 'step') {
      d = `M${sx(pts[0].x)},${sy(pts[0].y)}`
      for (let i = 1; i < pts.length; i++) {
        d += ` H${sx(pts[i].x)} V${sy(pts[i].y)}`
      }
    } else {
      d = pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x)},${sy(p.y)}`).join(' ')
    }
    if (s.kind === 'area') {
      const areaD = `${d} L${sx(pts[pts.length - 1].x)},${sy(0)} L${sx(pts[0].x)},${sy(0)} Z`
      body += `<path d="${areaD}" fill="${s.color}" fill-opacity="0.25" stroke="none"/>`
    }
    body += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="${s.width ?? 1.5}"/>`
  }

  for (const mk of opts.markers || []) {
    body += `<circle cx="${sx(mk.x)}" cy="${sy(mk.y)}" r="3" fill="${mk.color}" stroke="#fff" stroke-width="0.8">` +
      (mk.title ? `<title>${esc(mk.title)}</title>` : '') + `</circle>`
  }

  for (const r of opts.refLines || []) {
    const y = sy(r.y)
    body += `<line x1="${M.left}" y1="${y}" x2="${W - M.right}" y2="${y}" stroke="${r.color}" stroke-width="1.2"${r.dash === false ? '' : ' stroke-dasharray="4,3"'}/>`
    body += `<text x="${W - M.right}" y="${y - 2}" text-anchor="end" font-size="8" fill="${r.color}" font-weight="600">${esc(r.label)}</text>`
  }

  if (opts.yLabel) {
    body += `<text x="${M.left}" y="${M.top - 1}" font-size="8" fill="currentColor" fill-opacity="0.7">${esc(opts.yLabel)}</text>`
  }

  const legend = opts.series
    .filter(s => s.label)
    .map(s => `<span style="color:${s.color};font-weight:600">— ${esc(s.label)}</span>`)
    .join(' &nbsp; ')

  // Hover payload consumed by enhanceCharts (sorted points, layout, scales)
  let dataAttr = ''
  if (opts.interactive !== false) {
    const payload: HoverPayload = {
      W, H, m: M, xMin, xMax, yTop,
      series: opts.series
        .filter(s => s.points.length)
        .map(s => ({
          label: s.label,
          color: s.color,
          pts: [...s.points].sort((a, b) => a.x - b.x).map(p => [p.x, Math.round(p.y * 100) / 100]),
        })),
    }
    dataAttr = ` data-chart="${esc(JSON.stringify(payload)).replace(/"/g, '&quot;')}"`
  }

  return (
    `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"${dataAttr} style="display:block;max-width:100%;height:auto">${body}</svg>` +
    (legend ? `<div style="font-size:0.65rem;margin-top:2px">${legend}</div>` : '')
  )
}

interface HoverPayload {
  W: number
  H: number
  m: typeof M
  xMin: number
  xMax: number
  yTop: number
  series: Array<{ label: string; color: string; pts: number[][] }>
}

const SVG_NS = 'http://www.w3.org/2000/svg'

/**
 * Wire hover interactivity (vertical crosshair + per-series dots + a value
 * tooltip) onto every chart inside `root`. Idempotent — call it after any
 * innerHTML that may contain charts.
 */
export function enhanceCharts(root: HTMLElement) {
  root.querySelectorAll<SVGSVGElement>('svg[data-chart]').forEach(svg => {
    if (svg.dataset.enhanced) return
    svg.dataset.enhanced = '1'
    let cfg: HoverPayload
    try {
      cfg = JSON.parse(svg.getAttribute('data-chart')!)
    } catch {
      return
    }
    const { W, H, m, xMin, xMax, yTop } = cfg
    const iw = W - m.left - m.right
    const ih = H - m.top - m.bottom
    const sx = (x: number) => m.left + ((x - xMin) / (xMax - xMin)) * iw
    const sy = (y: number) => m.top + ih - (Math.min(y, yTop) / yTop) * ih

    const hover = document.createElementNS(SVG_NS, 'g')
    hover.style.display = 'none'
    const cross = document.createElementNS(SVG_NS, 'line')
    cross.setAttribute('y1', String(m.top))
    cross.setAttribute('y2', String(H - m.bottom))
    cross.setAttribute('stroke', 'currentColor')
    cross.setAttribute('stroke-opacity', '0.45')
    cross.setAttribute('stroke-dasharray', '2,2')
    hover.appendChild(cross)
    const dots = cfg.series.map(s => {
      const c = document.createElementNS(SVG_NS, 'circle')
      c.setAttribute('r', '3')
      c.setAttribute('fill', s.color)
      c.setAttribute('stroke', '#fff')
      c.setAttribute('stroke-width', '1')
      hover.appendChild(c)
      return c
    })
    svg.appendChild(hover)

    const wrap = svg.parentElement!
    if (getComputedStyle(wrap).position === 'static') wrap.style.position = 'relative'
    const tip = document.createElement('div')
    tip.className = 'chart-tip'
    tip.style.display = 'none'
    wrap.appendChild(tip)

    const nearest = (pts: number[][], x: number): number[] => {
      let lo = 0, hi = pts.length - 1
      while (lo < hi) {
        const mid = (lo + hi) >> 1
        if (pts[mid][0] < x) lo = mid + 1
        else hi = mid
      }
      if (lo > 0 && Math.abs(pts[lo - 1][0] - x) <= Math.abs(pts[lo][0] - x)) lo--
      return pts[lo]
    }

    svg.addEventListener('mousemove', ev => {
      const rect = svg.getBoundingClientRect()
      const scale = rect.width / W
      const xVal = xMin + ((ev.clientX - rect.left) / scale - m.left) / iw * (xMax - xMin)
      const x = Math.max(xMin, Math.min(xMax, xVal))

      const rows: string[] = []
      let anchorPx = sx(x)
      cfg.series.forEach((s, i) => {
        const p = nearest(s.pts, x)
        dots[i].setAttribute('cx', String(sx(p[0])))
        dots[i].setAttribute('cy', String(sy(p[1])))
        if (i === 0) anchorPx = sx(p[0])
        rows.push(
          `<span style="color:${s.color};font-weight:600">●</span> ` +
          `${s.label ? `${escHtml(s.label)}: ` : ''}<strong>${fmt(p[1])}</strong>`,
        )
      })
      cross.setAttribute('x1', String(anchorPx))
      cross.setAttribute('x2', String(anchorPx))
      hover.style.display = ''

      const year = nearest(cfg.series[0].pts, x)[0]
      tip.innerHTML = `<strong>${Math.round(year)}</strong><br>${rows.join('<br>')}`
      tip.style.display = 'block'
      const wrapRect = wrap.getBoundingClientRect()
      const cssX = (anchorPx * scale) + (rect.left - wrapRect.left)
      const flip = cssX > wrapRect.width * 0.62
      tip.style.left = `${cssX + (flip ? -8 : 8)}px`
      tip.style.transform = flip ? 'translateX(-100%)' : ''
      tip.style.top = `${Math.max(0, ev.clientY - wrapRect.top - 28)}px`
    })
    svg.addEventListener('mouseleave', () => {
      hover.style.display = 'none'
      tip.style.display = 'none'
    })
  })
}

function fmt(v: number): string {
  if (v >= 10000) return `${Math.round(v / 1000)}k`
  if (v >= 1000) return `${Math.round(v / 100) / 10}k`
  if (v >= 100) return String(Math.round(v))
  return String(Math.round(v * 10) / 10)
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
