import { describe, expect, it } from 'vitest'
import { detectTtsLanguage, splitTtsSegments } from '../tts-language'

describe('detectTtsLanguage', () => {
  it('returns en for Latin text', () => {
    expect(detectTtsLanguage('Hello world')).toBe('en')
    expect(detectTtsLanguage('')).toBe('en')
  })

  it('returns zh for Han text without kana', () => {
    expect(detectTtsLanguage('你好世界')).toBe('zh')
    expect(detectTtsLanguage('Mixed 中文 with latin')).toBe('zh')
  })

  it('returns ja when kana is present', () => {
    expect(detectTtsLanguage('こんにちは世界')).toBe('ja')
    expect(detectTtsLanguage('カタカナ text')).toBe('ja')
  })
})

describe('splitTtsSegments', () => {
  it('returns a single segment for one-language text', () => {
    expect(splitTtsSegments('Hello world')).toEqual([{ text: 'Hello world', lang: 'en' }])
    expect(splitTtsSegments('你好世界\n明天见')).toEqual([{ text: '你好世界明天见', lang: 'zh' }])
    expect(splitTtsSegments('こんにちは世界')).toEqual([{ text: 'こんにちは世界', lang: 'ja' }])
  })

  it('splits mixed-language lines into per-language segments', () => {
    const segments = splitTtsSegments('Hello world\n你好世界\nこんにちは\nGoodbye')
    expect(segments).toEqual([
      { text: 'Hello world', lang: 'en' },
      { text: '你好世界', lang: 'zh' },
      { text: 'こんにちは', lang: 'ja' },
      { text: 'Goodbye', lang: 'en' },
    ])
  })

  it('keeps consecutive same-language lines in one segment', () => {
    const segments = splitTtsSegments('Hello world\nHow are you\n你好世界\nこんにちは\nカタカナ')
    expect(segments).toEqual([
      { text: 'Hello world\nHow are you', lang: 'en' },
      { text: '你好世界', lang: 'zh' },
      { text: 'こんにちはカタカナ', lang: 'ja' },
    ])
  })

  it('splits paragraphs on blank lines and strips cjk newlines', () => {
    expect(splitTtsSegments('Hello\n\nWorld')).toEqual([
      { text: 'Hello', lang: 'en' },
      { text: 'World', lang: 'en' },
    ])
    expect(splitTtsSegments('你好世界\n\n明天见')).toEqual([
      { text: '你好世界', lang: 'zh' },
      { text: '明天见', lang: 'zh' },
    ])
    expect(splitTtsSegments('Hello\n  \nWorld')).toEqual([
      { text: 'Hello', lang: 'en' },
      { text: 'World', lang: 'en' },
    ])
    expect(splitTtsSegments('')).toEqual([])
  })

  it('groups a mixed-language line into separate language runs', () => {
    const segments = splitTtsSegments('Hello 你好世界')
    expect(segments).toEqual([
      { text: 'Hello', lang: 'en' },
      { text: '你好世界', lang: 'zh' },
    ])
  })

  it('splits an unspaced latin-cjk run into its language parts', () => {
    expect(splitTtsSegments('Hello你好世界')).toEqual([
      { text: 'Hello', lang: 'en' },
      { text: '你好世界', lang: 'zh' },
    ])
  })

  it('keeps mixed kana+han runs as Japanese', () => {
    expect(splitTtsSegments('こんにちは世界')).toEqual([{ text: 'こんにちは世界', lang: 'ja' }])
  })

  it('folds short tokens into the dominant surrounding language', () => {
    const segments = splitTtsSegments('Hello OK 你好世界')
    expect(segments).toEqual([
      { text: 'Hello OK', lang: 'en' },
      { text: '你好世界', lang: 'zh' },
    ])
  })

  it('folds a short cjk token into surrounding English', () => {
    const segments = splitTtsSegments('Good morning 早')
    expect(segments).toEqual([{ text: 'Good morning 早', lang: 'en' }])
  })

  it('keeps an English sentence after a CJK run intact', () => {
    const segments = splitTtsSegments('Hello你好世界\nI am doing well. How are you?')
    expect(segments).toEqual([
      { text: 'Hello', lang: 'en' },
      { text: '你好世界', lang: 'zh' },
      { text: 'I am doing well. How are you?', lang: 'en' },
    ])
  })

  it('reads digits in the surrounding language', () => {
    expect(splitTtsSegments('I am doing well. 125000222 is small.')).toEqual([
      { text: 'I am doing well. 125000222 is small.', lang: 'en' },
    ])
    expect(splitTtsSegments('即便周星馳已經有想配合採訪了125000222')).toEqual([
      { text: '即便周星馳已經有想配合採訪了125000222', lang: 'zh' },
    ])
    expect(splitTtsSegments('I have 3 apples')).toEqual([{ text: 'I have 3 apples', lang: 'en' }])
    expect(splitTtsSegments('文件100個')).toEqual([{ text: '文件100個', lang: 'zh' }])
  })

  it('joins multi-line cjk into one continuous segment', () => {
    const segments = splitTtsSegments('即便周星馳已經有想配合採訪了125000222\n但感覺依然還是個有夠難採訪的對象\n不得不說這個主持人真的很厲害')
    expect(segments).toEqual([
      {
        text: '即便周星馳已經有想配合採訪了125000222但感覺依然還是個有夠難採訪的對象不得不說這個主持人真的很厲害',
        lang: 'zh',
      },
    ])
  })

  it('folds short runs into a neighboring longer run', () => {
    expect(splitTtsSegments('ABC 中 DEF')).toEqual([{ text: 'ABC 中 DEF', lang: 'zh' }])
    expect(splitTtsSegments('Hello 你 world')).toEqual([{ text: 'Hello 你 world', lang: 'en' }])
  })

  it('splits an oversized paragraph on sentence boundaries', () => {
    const paragraph =
      'This is a long paragraph meant to exceed the maximum segment length so that the backstop ' +
      'splits it on sentence boundaries. '.repeat(30)
    const segments = splitTtsSegments(paragraph)
    expect(segments.length).toBeGreaterThan(1)
    for (const segment of segments) {
      expect(segment.lang).toBe('en')
      expect(segment.text.length).toBeLessThanOrEqual(500)
      expect(segment.text).not.toContain('\n\n')
    }
    expect(segments.map(s => s.text).join('').replace(/\s+/g, ' ').trim()).toBe(
      paragraph.replace(/\s+/g, ' ').trim(),
    )
  })

  it('keeps a paragraph under the limit as a single segment', () => {
    const paragraph = 'A reasonably sized paragraph. '.repeat(10)
    expect(paragraph.length).toBeLessThanOrEqual(500)
    expect(splitTtsSegments(paragraph)).toEqual([{ text: paragraph.trim(), lang: 'en' }])
  })
})