import type { DataStore } from '../data'
import { epochMsToYear } from '../data'

export interface OwnerSearchCallbacks {
  onSelect: (owner: string) => void
  onClear: () => void
}

export function setupOwnerSearch(store: DataStore, cb: OwnerSearchCallbacks) {
  const search = document.getElementById('search') as HTMLInputElement
  const resultsDiv = document.getElementById('owner-search-results')!
  const clearBtn = document.getElementById('clear-owner-highlight')!

  let debounce: ReturnType<typeof setTimeout>
  search.addEventListener('input', () => {
    clearTimeout(debounce)
    debounce = setTimeout(() => {
      const term = search.value.trim().toLowerCase()
      if (term.length < 2) {
        resultsDiv.innerHTML = ''
        resultsDiv.classList.add('hidden')
        return
      }
      const list = store.owners.filter(o => o.toLowerCase().includes(term)).slice(0, 8)
      if (!list.length) {
        resultsDiv.innerHTML = '<div class="text-[var(--text-muted)] p-0.5">No matching owners</div>'
        resultsDiv.classList.remove('hidden')
        return
      }
      resultsDiv.innerHTML = list
        .map(o => `<div class="owner-result cursor-pointer hover:bg-[var(--border)] p-0.5 rounded" data-owner="${o.replace(/"/g, '&quot;')}">${o}</div>`)
        .join('')
      resultsDiv.classList.remove('hidden')
      resultsDiv.querySelectorAll<HTMLElement>('.owner-result').forEach(el => {
        el.addEventListener('click', () => {
          const owner = el.dataset.owner || ''
          resultsDiv.innerHTML = ''
          resultsDiv.classList.add('hidden')
          search.value = owner
          updateOwnerSummary(owner, store)
          cb.onSelect(owner)
        })
      })
    }, 180)
  })

  clearBtn.addEventListener('click', () => {
    search.value = ''
    resultsDiv.innerHTML = ''
    resultsDiv.classList.add('hidden')
    document.getElementById('owner-summary')?.classList.add('hidden')
    cb.onClear()
  })
}

export function clearOwnerSearchUI() {
  const search = document.getElementById('search') as HTMLInputElement | null
  if (search) search.value = ''
  document.getElementById('owner-summary')?.classList.add('hidden')
  const res = document.getElementById('owner-search-results')
  if (res) { res.innerHTML = ''; res.classList.add('hidden') }
}

function updateOwnerSummary(term: string, store: DataStore) {
  const summaryDiv = document.getElementById('owner-summary')!
  const nameEl = document.getElementById('owner-name')!
  const statsEl = document.getElementById('owner-stats')!

  const matches = store.pods.filter(r => r.ownerLc.includes(term.toLowerCase()))
  if (!matches.length) {
    summaryDiv.classList.add('hidden')
    return
  }
  const totalRate = matches.reduce((s, r) => s + r.rate, 0)
  const bySource: Record<string, { count: number; rate: number }> = {}
  let minY = Infinity, maxY = -Infinity
  for (const r of matches) {
    const s = r.source || 'Unknown'
    bySource[s] ??= { count: 0, rate: 0 }
    bySource[s].count++
    bySource[s].rate += r.rate
    const y = r.year ?? epochMsToYear(r.feature.properties.PriorityDate)
    if (y != null) { minY = Math.min(minY, y); maxY = Math.max(maxY, y) }
  }

  let html = `<div><strong>${matches.length}</strong> rights • <strong>${totalRate.toFixed(1)}</strong> cfs total max rate</div>`
  if (minY < Infinity) html += `<div>Priority: ${minY}–${maxY}</div>`
  html += `<div class="mt-1">By source:</div><div class="pl-1 text-[9px]">`
  Object.entries(bySource)
    .sort((a, b) => b[1].rate - a[1].rate)
    .slice(0, 4)
    .forEach(([s, v]) => { html += `${s.slice(0, 24)}: ${v.count} / ${v.rate.toFixed(0)} cfs<br>` })
  html += `</div>`

  nameEl.textContent = term
  statsEl.innerHTML = html
  summaryDiv.classList.remove('hidden')
}
