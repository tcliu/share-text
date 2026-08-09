const AUTO_SCROLL_EDGE = 24
const AUTO_SCROLL_STEP = 16

export interface AutoScrollHooks {
  getContainer: () => HTMLElement | null
  isDragging: () => boolean
  onCellHover: (ri: number, ci: number) => void
  onRowHover: (ri: number) => void
  onColHover: (ci: number) => void
}

export function createAutoScroll(hooks: AutoScrollHooks) {
  let autoScrollTimer: ReturnType<typeof setInterval> | null = null
  let pointer = { x: 0, y: 0 }

  function onWindowMouseMove(event: MouseEvent) {
    if (!hooks.isDragging()) return
    pointer = { x: event.clientX, y: event.clientY }
    start()
  }

  function start() {
    if (autoScrollTimer !== null) return
    autoScrollTimer = setInterval(tick, 32)
  }

  function stop() {
    if (autoScrollTimer === null) return
    clearInterval(autoScrollTimer)
    autoScrollTimer = null
  }

  function tick() {
    const container = hooks.getContainer()
    if (!container || !hooks.isDragging()) {
      stop()
      return
    }
    const box = container.getBoundingClientRect()
    if (box.width === 0 && box.height === 0) return
    let dx = 0
    let dy = 0
    if (pointer.y < box.top + AUTO_SCROLL_EDGE) dy = -AUTO_SCROLL_STEP
    else if (pointer.y > box.bottom - AUTO_SCROLL_EDGE) dy = AUTO_SCROLL_STEP
    else if (pointer.x < box.left + AUTO_SCROLL_EDGE) dx = -AUTO_SCROLL_STEP
    else if (pointer.x > box.right - AUTO_SCROLL_EDGE) dx = AUTO_SCROLL_STEP
    if (dx !== 0 || dy !== 0) {
      container.scrollLeft += dx
      container.scrollTop += dy
      if (typeof document.elementFromPoint === 'function') {
        const el = document.elementFromPoint(pointer.x, pointer.y) as HTMLElement | null
        if (el) {
          const cell = el.closest<HTMLElement>('[data-row][data-col]')
          if (cell) {
            hooks.onCellHover(Number(cell.dataset.row), Number(cell.dataset.col))
            return
          }
          const rowSel = el.closest<HTMLElement>('[data-row-selector]')
          if (rowSel) {
            hooks.onRowHover(Number(rowSel.dataset.rowSelector))
            return
          }
          const colSel = el.closest<HTMLElement>('[data-col-selector]')
          if (colSel) {
            hooks.onColHover(Number(colSel.dataset.colSelector))
            return
          }
        }
      }
    }
  }

  return { onWindowMouseMove, stop }
}
