// Shared header/body scroll synchronization for tables whose header lives in a
// fixed band outside the scrollport (the header wrapper clips with
// overflow-hidden): mirror the body wrapper's horizontal scroll into the header
// and forward wheel events so scrolling still works while the pointer is over
// the header. Optionally pad the header wrapper by the body's vertical
// scrollbar width so the header table keeps the body's visible width once
// columns overflow.
export interface TableScrollSyncOptions {
  getBody: () => HTMLElement | null
  getHeader: () => HTMLElement | null
  // DataTable only: keep the header table's right edge aligned with the body's
  // once columns overflow by padding the header wrapper with the body's
  // scrollbar width. Off by default; observes the body wrapper itself, so it
  // tracks the scrollbar appearing and disappearing.
  padHeaderForScrollbar?: boolean
}

export function createTableScrollSync(options: TableScrollSyncOptions): void {
  const { getBody, getHeader, padHeaderForScrollbar = false } = options

  $effect(() => {
    const body = getBody()
    const header = getHeader()
    if (!body || !header) return
    const onScroll = () => {
      header.scrollLeft = body.scrollLeft
    }
    const onWheel = (event: WheelEvent) => {
      if (event.deltaY !== 0) body.scrollTop += event.deltaY
      if (event.deltaX !== 0) body.scrollLeft += event.deltaX
    }
    body.addEventListener('scroll', onScroll, { passive: true })
    header.addEventListener('wheel', onWheel, { passive: true })
    return () => {
      body.removeEventListener('scroll', onScroll)
      header.removeEventListener('wheel', onWheel)
    }
  })

  if (padHeaderForScrollbar) {
    $effect(() => {
      const body = getBody()
      const header = getHeader()
      if (!body || !header) return
      if (typeof ResizeObserver === 'undefined') return
      const observer = new ResizeObserver(() => {
        const scrollbarWidth = body.offsetWidth - body.clientWidth
        header.style.paddingRight = scrollbarWidth > 0 ? `${scrollbarWidth}px` : ''
      })
      observer.observe(body)
      return () => observer.disconnect()
    })
  }
}
