import type { Attempt, Question, Study } from './model'

const day = 86_400_000
export const reviewModes = [
  ['all', 'Tất cả câu hỏi'], ['wrong', 'Câu từng trả lời sai'], ['due', 'Đến hạn ôn lại'],
  ['bookmarked', 'Câu đánh dấu khó'], ['weak', 'Chương yếu'], ['unseen', 'Chưa từng làm'],
  ['needed', 'Cần ôn lại'],
] as const
export type ReviewMode = typeof reviewModes[number][0]

export function spacing(correctStreak: number) {
  return correctStreak === 0 ? 10 * 60_000 : [1, 3, 7, 14, 30][Math.min(correctStreak, 5) - 1] * day
}

export function reviewRecord(courseId: string, questionId: string, attempts: Attempt[], later?: number) {
  const reviewHistory = [...attempts].sort((a, b) => a.at - b.at)
  const last = reviewHistory.at(-1)
  const correctCount = reviewHistory.filter((item) => item.correct).length
  let streak = 0
  for (let index = reviewHistory.length - 1; index >= 0 && reviewHistory[index].correct; index--) streak++
  return {
    courseId, questionId, correctCount, incorrectCount: reviewHistory.length - correctCount,
    lastAttemptAt: last?.at, lastIncorrectAt: reviewHistory.filter((item) => !item.correct).at(-1)?.at,
    lastCorrectAt: reviewHistory.filter((item) => item.correct).at(-1)?.at,
    masteryLevel: Math.min(streak, 5), nextReviewAt: later ?? (last ? last.at + spacing(streak) : undefined),
    firstCorrect: reviewHistory[0]?.correct, lastCorrect: last?.correct, reviewHistory,
  }
}

export function summarize(records: ReturnType<typeof reviewRecord>[], bookmarks: Set<string>, now: number) {
  const attempted = records.filter((item) => item.lastAttemptAt !== undefined)
  const correct = records.reduce((total, item) => total + item.correctCount, 0)
  const wrong = records.reduce((total, item) => total + item.incorrectCount, 0)
  const firstCorrect = attempted.filter((item) => item.firstCorrect).length
  const latestCorrect = attempted.filter((item) => item.lastCorrect).length
  const due = records.filter((item) => item.nextReviewAt !== undefined && item.nextReviewAt <= now).length
  return {
    attempts: correct + wrong, correct, wrong, unique: attempted.length, firstCorrect, latestCorrect, due,
    needed: records.filter((item) => item.lastCorrect === false || bookmarks.has(item.questionId) ||
      (item.nextReviewAt !== undefined && item.nextReviewAt <= now)).length,
    mastered: attempted.filter((item) => item.masteryLevel === 5).length,
    accuracy: correct + wrong >= 2 ? Math.round(100 * correct / (correct + wrong)) : undefined,
    firstAccuracy: attempted.length >= 2 ? Math.round(100 * firstCorrect / attempted.length) : undefined,
  }
}

type ReviewStudy = Pick<Study, 'attempts' | 'bookmarks' | 'reviewLater'>
export function learningStats(courseId: string, questions: Question[], chapters: { id: string }[], study: ReviewStudy, now: number) {
  const histories = new Map<string, Attempt[]>()
  for (const attempt of study.attempts) {
    const items = histories.get(attempt.questionId) ?? []
    items.push(attempt)
    histories.set(attempt.questionId, items)
  }
  const bookmarks = new Set(study.bookmarks)
  const records = new Map(questions.map((q) => [q.id, reviewRecord(courseId, q.id, histories.get(q.id) ?? [], study.reviewLater?.[q.id])]))
  function forQuestions(items: Question[]) {
    return summarize([...new Set(items.map((q) => q.id))].flatMap((id) => {
      const record = records.get(id)
      return record ? [record] : []
    }), bookmarks, now)
  }
  const byChapter = new Map(chapters.map((chapter) =>
    [chapter.id, forQuestions(questions.filter((q) => q.chapterId === chapter.id))]))
  const weak = new Set([...byChapter].filter(([, item]) => item.unique >= 3 && item.latestCorrect / item.unique < .7).map(([id]) => id))
  function matches(question: Question, mode: ReviewMode) {
    const row = records.get(question.id)
    const due = row?.nextReviewAt !== undefined && row.nextReviewAt <= now
    switch (mode) {
      case 'wrong': return Boolean(row?.incorrectCount)
      case 'due': return due
      case 'bookmarked': return bookmarks.has(question.id)
      case 'weak': return question.chapterId !== undefined && weak.has(question.chapterId)
      case 'unseen': return row?.lastAttemptAt === undefined
      case 'needed': return row?.lastCorrect === false || bookmarks.has(question.id) || due
      default: return true
    }
  }
  return { records, byChapter, weak, forQuestions, matches }
}

export const tomorrow = (now: number) => now + day

export function practiceReturn(value?: string | null): string | undefined {
  if (!value || !/^\/trainning(?=\/|\?|$)/.test(value) || /[\\\u0000-\u001f]/.test(value)) return undefined
  const path = value.split('?')[0]
  return /\.{2}|%2e/i.test(path) ? undefined : value
}
