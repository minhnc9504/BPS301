import { isCorrect, type Session, type Question } from './model.ts'

export type Outcome = 'correct' | 'wrong' | 'blank' | 'unknown'
export type ExamRow = { question: Question; index: number; selected: string[]; outcome: Outcome; chapter: string; topics: string[]; flagged: boolean }
export const unclassified = '__unclassified'
export const smallSample = 3

function totals(rows: ExamRow[]) {
  const correct = rows.filter((row) => row.outcome === 'correct').length
  const wrong = rows.filter((row) => row.outcome === 'wrong').length
  const blank = rows.filter((row) => row.outcome === 'blank').length
  const unknown = rows.length - correct - wrong - blank
  const accuracy = rows.length && !unknown ? correct / rows.length * 100 : undefined
  return { rows, count: rows.length, correct, wrong, blank, unknown, accuracy }
}

function group(rows: ExamRow[], keys: (row: ExamRow) => string[]) {
  const buckets = new Map<string, ExamRow[]>()
  for (const row of rows) for (const key of keys(row)) {
    const bucket = buckets.get(key)
    if (bucket) bucket.push(row)
    else buckets.set(key, [row])
  }
  return new Map([...buckets].map(([key, values]) => [key, totals(values)]))
}

export function examAnalytics(session: Session, chapters: ReadonlySet<string>) {
  const rows: ExamRow[] = session.questions.map((question, index) => {
    const selected = session.selections[question.id] ?? []
    const known = question.answers?.length && question.answers.every((id) => question.options.some((option) => option.id === id))
    const outcome = !known ? 'unknown' : !selected.length ? 'blank' : isCorrect(question, selected) ? 'correct' : 'wrong'
    return { question, index, selected, outcome, chapter: chapters.has(question.chapterId ?? '') ? question.chapterId! : unclassified,
      topics: [...new Set(question.topics?.filter(Boolean))], flagged: session.flags.includes(question.id) }
  })
  const summary = totals(rows)
  const byChapter = group(rows, (row) => [row.chapter])
  return { ...summary, byChapter, byTopic: group(rows, (row) => row.topics),
    score: summary.accuracy === undefined ? undefined : summary.correct * 10 / summary.count,
    ended: session.ended, used: session.ended === undefined ? undefined : session.ended - session.started,
    limit: session.unlimited ? undefined : session.deadline - session.started,
    covered: byChapter.size - Number(byChapter.has(unclassified)),
  }
}

export function reviewIds(rows: ExamRow[], mode: string, key?: string) {
  const weak = mode === 'weak-chapters' || mode === 'weak-topics' ? new Set(
    weakGroups(group(rows, mode === 'weak-chapters' ? (row) => [row.chapter] : (row) => row.topics)).map(([id]) => id),
  ) : undefined
  return [...new Set(rows.filter((row) => {
    if (mode === 'wrong') return row.outcome === 'wrong'
    if (mode === 'missed') return row.outcome === 'wrong' || row.outcome === 'blank'
    if (mode === 'chapter') return row.chapter === key
    if (mode === 'topic') return row.topics.includes(key ?? '')
    if (mode === 'weak-chapters') return weak?.has(row.chapter)
    if (mode === 'weak-topics') return row.topics.some((id) => weak?.has(id))
    return false
  }).map((row) => row.question.id))]
}

export function weakGroups(groups: Map<string, ReturnType<typeof totals>>) {
  return [...groups].filter(([key, row]) => key !== unclassified && row.count >= smallSample && row.accuracy !== undefined && row.accuracy < 60)
    .sort(([, a], [, b]) => a.accuracy! - b.accuracy! || b.count - a.count)
}

export function scoreTrend(scores: (number | undefined)[], comparable: boolean) {
  const known = scores.filter((score): score is number => score !== undefined)
  if (!comparable || known.length < 2) return undefined
  return known.at(-1)! - known[0]
}

export const outcomeLabels: Record<Outcome, string> = { correct: 'Đúng', wrong: 'Sai', blank: 'Bỏ trống', unknown: 'Không có dữ liệu' }
export const formatDuration = (ms?: number) => ms === undefined ? 'Không có dữ liệu'
  : Math.floor(ms / 60000) + ' phút ' + Math.floor(ms / 1000) % 60 + ' giây'
export const formatAccuracy = (value?: number) => value === undefined ? 'Không có dữ liệu' : Math.round(value) + '%'
export const formatScore = (value?: number) => value === undefined ? 'Không có dữ liệu' : value.toFixed(1) + '/10'
