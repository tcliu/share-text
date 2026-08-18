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

const MAX_SEGMENT_LENGTH = 500
const BLANK_LINE_RE = /\n\s*\n/
const SENTENCE_TERMINATOR_RE = /[.!?。！？]+\s*/g

function splitParagraphs(text: string): string[] {
  return text
    .split(BLANK_LINE_RE)
    .map(part => part.trim())
    .filter(part => part !== '')
}

function splitIntoSentences(text: string): string[] {
  const sentences: string[] = []
  let last = 0
  SENTENCE_TERMINATOR_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = SENTENCE_TERMINATOR_RE.exec(text)) !== null) {
    sentences.push(text.slice(last, match.index + match[0].length))
    last = match.index + match[0].length
  }
  if (last < text.length) {
    sentences.push(text.slice(last))
  }
  return sentences
}

function hardSplit(text: string, maxLength: number): string[] {
  const parts: string[] = []
  let i = 0
  while (i < text.length) {
    parts.push(text.slice(i, i + maxLength))
    i += maxLength
  }
  return parts
}

function splitLongText(text: string, maxLength: number): string[] {
  const sentences = splitIntoSentences(text)
  const chunks: string[] = []
  let current = ''
  for (const sentence of sentences) {
    if (sentence.length > maxLength) {
      if (current) {
        chunks.push(current)
        current = ''
      }
      chunks.push(...hardSplit(sentence, maxLength))
      continue
    }
    if (current && current.length + sentence.length > maxLength) {
      chunks.push(current)
      current = sentence
    } else {
      current += sentence
    }
  }
  if (current) {
    chunks.push(current)
  }
  return chunks.filter(chunk => chunk.trim() !== '')
}

export function splitTtsSegments(text: string): TtsSegment[] {
  const runs = foldShortRuns(mergeAdjacentRuns(splitTtsRuns(text)))
  return runs.flatMap(run =>
    splitParagraphs(run.text).flatMap(paragraph => {
      const clean = run.lang === 'en' ? paragraph : paragraph.replace(/\r?\n/g, '')
      if (clean.length <= MAX_SEGMENT_LENGTH) {
        return clean ? [{ text: clean, lang: run.lang }] : []
      }
      return splitLongText(clean, MAX_SEGMENT_LENGTH).map(text => ({ text, lang: run.lang }))
    }),
  )
}
