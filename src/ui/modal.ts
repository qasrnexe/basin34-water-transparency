import { enhanceCharts } from './chart'

/** Lightbox modal for chart-heavy panels (gage history, basin analyses). */

let wired = false

function backdrop(): HTMLElement {
  return document.getElementById('modal-backdrop')!
}

export function isModalOpen(): boolean {
  return !backdrop().classList.contains('hidden')
}

export function openModal(html: string) {
  const content = document.getElementById('modal-content')!
  content.innerHTML = html
  backdrop().classList.remove('hidden')
  enhanceCharts(content)

  if (!wired) {
    wired = true
    backdrop().addEventListener('click', e => {
      if (e.target === backdrop()) closeModal()
    })
    document.getElementById('modal-close')?.addEventListener('click', closeModal)
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && isModalOpen()) closeModal()
    })
  }
}

export function closeModal() {
  backdrop().classList.add('hidden')
}
