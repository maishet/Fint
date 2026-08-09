import type { TransactionType } from '../api/types'
import { emojiIndex } from './emojiIndex.generated'

const DIACRITICS_PATTERN = new RegExp(
  String.fromCharCode(0x5b, 0x5c, 0x75, 0x30, 0x33, 0x30, 0x30, 0x2d, 0x5c, 0x75, 0x30, 0x33, 0x36, 0x66, 0x5d),
  'g',
)

const MIN_QUERY_LENGTH = 2
const RESULT_CAP = 12
const SUBSTRING_FALLBACK_MIN_KEYWORD_LENGTH = 5

const INCOME_DEFAULTS = ['💰', '💼', '📈', '🎁', '🏦', '🧑‍💻']
const EXPENSE_DEFAULTS = ['🛒', '🍽️', '🚕', '🏠', '🧾', '💳']

const keywordToEmoji = new Map<string, number[]>()
for (let i = 0; i < emojiIndex.length; i++) {
  for (const keyword of emojiIndex[i]!.k) {
    const bucket = keywordToEmoji.get(keyword)
    if (bucket) bucket.push(i)
    else keywordToEmoji.set(keyword, [i])
  }
}
const sortedKeywords = Array.from(keywordToEmoji.keys()).sort()

function tokenize(normalized: string): string[] {
  return normalized.split(/[^a-z0-9]+/).filter(Boolean)
}

function normalize(name: string): string {
  return name.normalize('NFD').replace(DIACRITICS_PATTERN, '').toLowerCase().trim()
}

function lowerBound(prefix: string): number {
  let lo = 0
  let hi = sortedKeywords.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (sortedKeywords[mid]! < prefix) lo = mid + 1
    else hi = mid
  }
  return lo
}

function keywordsWithPrefix(prefix: string): string[] {
  const start = lowerBound(prefix)
  const matches: string[] = []
  for (let i = start; i < sortedKeywords.length; i++) {
    const keyword = sortedKeywords[i]!
    if (!keyword.startsWith(prefix)) break
    matches.push(keyword)
  }
  return matches
}

function bump(scores: Map<number, number>, index: number, score: number) {
  const current = scores.get(index) ?? 0
  if (score > current) scores.set(index, score)
}

function scoreTiers2And3(tokens: string[]): Map<number, number> {
  const scores = new Map<number, number>()

  for (const token of tokens) {
    // Exact keyword match.
    const exact = keywordToEmoji.get(token)
    if (exact) for (const index of exact) bump(scores, index, 3)

    if (token.length >= 3) {
      for (const keyword of keywordsWithPrefix(token)) {
        for (const index of keywordToEmoji.get(keyword)!) bump(scores, index, 2)
      }
    }

    for (let end = 3; end < token.length; end++) {
      const stem = token.slice(0, end)
      const stemMatches = keywordToEmoji.get(stem)
      if (stemMatches) for (const index of stemMatches) bump(scores, index, 2)
    }
  }

  return scores
}

function addSubstringFallback(tokens: string[], scores: Map<number, number>) {
  const longTokens = tokens.filter((token) => token.length >= 3)
  if (longTokens.length === 0) return
  for (const keyword of sortedKeywords) {
    if (keyword.length < SUBSTRING_FALLBACK_MIN_KEYWORD_LENGTH) continue
    if (!longTokens.some((token) => keyword.includes(token))) continue
    for (const index of keywordToEmoji.get(keyword)!) bump(scores, index, 1)
  }
}

export function suggestedCategoryIcons(name: string, type: TransactionType): string[] {
  const defaults = type === 'income' ? INCOME_DEFAULTS : EXPENSE_DEFAULTS
  const normalized = normalize(name)

  if (normalized.length < MIN_QUERY_LENGTH) return defaults.slice(0, RESULT_CAP)

  const tokens = tokenize(normalized)
  const scores = scoreTiers2And3(tokens)

  if (scores.size < RESULT_CAP) addSubstringFallback(tokens, scores)

  const ranked = Array.from(scores.entries())
    .sort((a, b) => (b[1] !== a[1] ? b[1] - a[1] : a[0] - b[0]))
    .map(([index]) => emojiIndex[index]!.e)

  const seen = new Set<string>()
  const deduped = ranked.filter((emoji) => (seen.has(emoji) ? false : (seen.add(emoji), true)))

  if (deduped.length >= 3) return deduped.slice(0, RESULT_CAP)

  const padded = [...deduped, ...defaults.filter((emoji) => !seen.has(emoji))]
  return padded.slice(0, RESULT_CAP)
}
