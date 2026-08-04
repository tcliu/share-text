export function measureHeaderMinWidth(header: HTMLElement): number {
  const clone = header.cloneNode(true) as HTMLElement
  clone.style.position = 'fixed'
  clone.style.visibility = 'hidden'
  clone.style.width = 'max-content'
  clone.style.left = '-9999px'
  document.body.appendChild(clone)
  const minWidth = Math.ceil(clone.getBoundingClientRect().width)
  clone.remove()
  return minWidth
}
