const HAN_RE = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/
const JAPANESE_KANA_RE = /[\u3040-\u30ff]/

export function detectTtsLanguage(text: string): string {
  if (JAPANESE_KANA_RE.test(text)) return 'ja'
  if (HAN_RE.test(text)) return 'zh'
  return 'en'
}

export interface TtsSegment {
  text: string
  lang: string
}

function minimumLength(lang: string): number {
  return lang === 'en' ? 4 : 2
}

function splitTtsRuns(text: string): TtsSegment[] {
  const runs: TtsSegment[] = []
  let pendingWhitespace = ''
  let currentText = ''
  let currentCjk: boolean | null = null

  const flush = () => {
    if (!currentText) {
      return
    }
    const lang = currentCjk ? detectTtsLanguage(currentText) : 'en'
    runs.push({ text: pendingWhitespace + currentText, lang })
    pendingWhitespace = ''
    currentText = ''
  }

  for (const char of text) {
    if (/^\s$/.test(char)) {
      flush()
      pendingWhitespace += char
      continue
    }
    if (/\d/.test(char) && currentCjk !== null) {
      currentText += char
      continue
    }
    const cjk = HAN_RE.test(char) || JAPANESE_KANA_RE.test(char)
    if (currentCjk === null || currentCjk === cjk) {
      currentCjk = cjk
      currentText += char
    } else {
      flush()
      currentCjk = cjk
      currentText = char
    }
  }
  flush()
  if (pendingWhitespace && runs.length > 0) {
    runs[runs.length - 1].text += pendingWhitespace
  }
  return runs
}

function mergeAdjacentRuns(runs: TtsSegment[]): TtsSegment[] {
  const merged: TtsSegment[] = []
  for (const run of runs) {
    const last = merged[merged.length - 1]
    if (last && last.lang === run.lang) {
      last.text += run.text
    } else {
      merged.push({ text: run.text, lang: run.lang })
    }
  }
  return merged
}

function foldShortRuns(runs: TtsSegment[]): TtsSegment[] {
  const folded = [...runs]
  let changed = true
  while (changed) {
    changed = false
    for (let i = 0; i < folded.length; i++) {
      const run = folded[i]
      if (run.text.trim().length >= minimumLength(run.lang)) {
        continue
      }
      const prev = i > 0 ? folded[i - 1] : null
      const next = i < folded.length - 1 ? folded[i + 1] : null
      if (!prev && !next) {
        continue
      }
      const target = !next || (prev && prev.text.length >= next.text.length) ? i - 1 : i + 1
      if (target === i + 1) {
        folded[target].text = folded[i].text + folded[target].text
      } else {
        folded[target].text += folded[i].text
      }
      folded.splice(i, 1)
      changed = true
      break
    }
  }
  return mergeAdjacentRuns(folded)
}

export function splitTtsSegments(text: string): TtsSegment[] {
  const runs = foldShortRuns(mergeAdjacentRuns(splitTtsRuns(text)))
  return runs
    .map(run => {
      const trimmed = run.text.trim()
      return { text: run.lang === 'en' ? trimmed : trimmed.replace(/\r?\n/g, ''), lang: run.lang }
    })
    .filter(run => run.text !== '')
}
