export function createGridClipboard() {
  let clipboard = ''

  function copy(text: string) {
    clipboard = text
    navigator.clipboard
      ?.writeText(text)
      .then(() => {})
      .catch(err => console.warn('[GridClipboard] copy failed:', err))
  }

  function paste(
    ri: number,
    ci: number,
    applyText: (ri: number, ci: number, text: string) => void,
  ) {
    if (clipboard) {
      applyText(ri, ci, clipboard)
      return
    }
    if (navigator.clipboard?.readText) {
      navigator.clipboard
        .readText()
        .then(text => {
          if (text) applyText(ri, ci, text)
        })
          .catch(err => console.warn('[GridClipboard] paste read failed:', err))
    }
  }

  return { copy, paste, get buffer() { return clipboard } }
}
