const HAN_RE = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\u3000-\u303f\uff00-\uffef]/
const JAPANESE_KANA_RE = /[\u3040-\u30ff]/

// Cantonese-specific characters / markers: there's no unique Unicode block
// for Cantonese, so detect common Cantonese-only characters and particles
// that are not typically used in Mandarin-only text. This is heuristic and
// conservative: we check for a small set of high-frequency Cantonese particles
// like 嘅, 咗, 佢, 唔 (though 唔 and 佢 can appear in Mandarin contexts, the
// combination helps). If a kana character is present it's Japanese; if a
// Cantonese marker is present prefer 'yue'; otherwise Han characters map to
// 'zh'.
const CANTONESE_MARKER_RE = /[嘅咗唔啲佢嗰哋畀]/

export function detectTtsLanguage(text: string): string {
  if (JAPANESE_KANA_RE.test(text)) return 'ja'
  if (CANTONESE_MARKER_RE.test(text)) return 'yue'
  if (HAN_RE.test(text)) return 'zh'
  return 'en'
}

const TTS_LANGUAGE_LABELS: Record<string, string> = {
  en: 'English',
  en_gb: 'English (UK)',
  zh: '中文',
  ja: '日本語',
  yue: '粵語',
}

export function ttsLanguageLabel(lang: string): string {
  return TTS_LANGUAGE_LABELS[lang] ?? lang
}

export interface TtsSegment {
  text: string
  lang: string
  indexStart?: number
  indexEnd?: number
}

interface TtsRun {
  text: string
  lang: string
  start: number
  end: number
}

function minimumLength(lang: string): number {
  return lang === 'en' ? 4 : 2
}

function splitTtsRuns(text: string): TtsRun[] {
  const runs: TtsRun[] = []
  let pendingWhitespace = ''
  let currentText = ''
  let currentCjk: boolean | null = null

  const flush = (endIndex: number) => {
    if (!currentText) {
      return
    }
    const start = endIndex - pendingWhitespace.length - currentText.length
    const lang = currentCjk ? detectTtsLanguage(currentText) : 'en'
    runs.push({ text: pendingWhitespace + currentText, lang, start, end: endIndex })
    pendingWhitespace = ''
    currentText = ''
  }

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (/^\s$/.test(char)) {
      flush(i)
      pendingWhitespace += char
      continue
    }
    if (/\d/.test(char) && currentCjk !== null) {
      currentText += char
      continue
    }
    // Keep thousand separators and decimal points in the current run when
    // followed by a digit (e.g. "7,000" stays together instead of splitting).
    if (currentCjk && (char === ',' || char === '.') && i + 1 < text.length && /\d/.test(text[i + 1])) {
      currentText += char
      continue
    }
    const cjk = HAN_RE.test(char) || JAPANESE_KANA_RE.test(char)
    if (currentCjk === null || currentCjk === cjk) {
      currentCjk = cjk
      currentText += char
    } else {
      flush(i)
      currentCjk = cjk
      currentText = char
    }
  }
  flush(text.length)
  if (pendingWhitespace && runs.length > 0) {
    runs[runs.length - 1].text += pendingWhitespace
    runs[runs.length - 1].end = text.length
  }
  return runs
}

function mergeAdjacentRuns(runs: TtsRun[]): TtsRun[] {
  const merged: TtsRun[] = []
  for (const run of runs) {
    const last = merged[merged.length - 1]
    if (last && last.lang === run.lang) {
      last.text += run.text
      last.end = run.end
    } else {
      merged.push({ ...run })
    }
  }
  return merged
}

function foldShortRuns(runs: TtsRun[]): TtsRun[] {
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
        folded[target].start = folded[i].start
      } else {
        folded[target].text += folded[i].text
        folded[target].end = folded[i].end
      }
      folded.splice(i, 1)
      changed = true
      break
    }
  }
  return mergeAdjacentRuns(folded)
}

function mergeBracketedCjkPrefixes(runs: TtsRun[]): TtsRun[] {
  const merged = [...runs]
  for (let i = 0; i < merged.length - 1; i++) {
    const current = merged[i]
    const next = merged[i + 1]
    if (
      current.lang === 'en' &&
      next.lang !== 'en' &&
      /^[\[(<{\u300c\u300e\u3010][\d\s]+$/.test(current.text.trimStart())
    ) {
      next.text = current.text + next.text
      next.start = current.start
      merged.splice(i, 1)
      i -= 1
    }
  }
  return merged
}

export const MAX_SEGMENT_LENGTH = 500
const BLANK_LINE_RE = /\n\s*\n/g
const SENTENCE_TERMINATOR_RE = /[.!?。！？]+\s*/g

interface TtsParagraph {
  text: string
  start: number
  end: number
}

function pushParagraph(run: TtsRun, startOffset: number, endOffset: number, out: TtsParagraph[]) {
  const part = run.text.slice(startOffset, endOffset)
  const trimmed = part.trim()
  if (!trimmed) {
    return
  }
  const leading = part.length - part.trimStart().length
  const start = run.start + startOffset + leading
  out.push({ text: trimmed, start, end: start + trimmed.length })
}

function splitParagraphRanges(run: TtsRun): TtsParagraph[] {
  const out: TtsParagraph[] = []
  let last = 0
  BLANK_LINE_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = BLANK_LINE_RE.exec(run.text)) !== null) {
    pushParagraph(run, last, match.index, out)
    last = match.index + match[0].length
  }
  pushParagraph(run, last, run.text.length, out)
  return out
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

function cleanParagraph(paragraph: TtsParagraph, lang: string): { text: string; offsets: number[] } {
  if (lang === 'en') {
    const offsets: number[] = []
    for (let i = 0; i < paragraph.text.length; i++) {
      offsets.push(paragraph.start + i)
    }
    return { text: paragraph.text, offsets }
  }
  const offsets: number[] = []
  let clean = ''
  let input = paragraph.start
  let i = 0
  while (i < paragraph.text.length) {
    const char = paragraph.text[i]
    if (char === '\r' && paragraph.text[i + 1] === '\n') {
      input += 2
      i += 2
      continue
    }
    if (char === '\n') {
      input += 1
      i += 1
      continue
    }
    clean += char
    offsets.push(input)
    input += 1
    i += 1
  }
  return { text: clean, offsets }
}

export function splitTtsSegments(text: string, maxSegmentLength = MAX_SEGMENT_LENGTH): TtsSegment[] {
  const runs = mergeBracketedCjkPrefixes(foldShortRuns(mergeAdjacentRuns(splitTtsRuns(text))))
  const segments: TtsSegment[] = []
  for (const run of runs) {
    for (const paragraph of splitParagraphRanges(run)) {
      const { text: clean, offsets } = cleanParagraph(paragraph, run.lang)
      if (clean.length === 0) {
        continue
      }
      if (clean.length <= maxSegmentLength) {
        segments.push({
          text: clean,
          lang: run.lang,
          indexStart: offsets[0],
          indexEnd: offsets[offsets.length - 1],
        })
        continue
      }
      const chunks = splitLongText(clean, maxSegmentLength)
      let searchFrom = 0
      for (const chunk of chunks) {
        const chunkStart = clean.indexOf(chunk, searchFrom)
        // preserve searchFrom based on the original chunk so subsequent
        // searches don't re-find this occurrence even after trimming
        searchFrom = chunkStart + chunk.length

        // Trim so segment text carries no leading/trailing whitespace; index
        // ranges map to the trimmed span so text and range always agree.
        const trimmed = chunk.trim()
        if (!trimmed) continue
        const trimmedStart = clean.indexOf(trimmed, chunkStart)
        const trimmedEnd = trimmedStart + trimmed.length

        segments.push({
          text: trimmed,
          lang: run.lang,
          indexStart: offsets[trimmedStart],
          indexEnd: offsets[trimmedEnd - 1],
        })
      }
    }
  }
  return segments
}
