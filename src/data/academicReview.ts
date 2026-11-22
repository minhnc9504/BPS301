import type { Question, SlideRef } from './model'

export const answerReviewStates = ['unreviewed', 'suggested', 'needs-review', 'verified', 'disputed'] as const
export type AnswerReviewState = typeof answerReviewStates[number]
export type Confidence = 'none' | 'low' | 'medium'
export type AcademicProposal = {
  chapterId?: string
  topics?: string[]
  tip?: string
  slide?: SlideRef
  evidence: string
  confidence: Confidence
  visualCheck?: boolean
  needsReview?: boolean
}
export type AcademicReview = Omit<AcademicProposal, 'confidence' | 'visualCheck' | 'needsReview' | 'evidence'> & {
  decision: 'pending' | 'accepted' | 'rejected'
  answer: AnswerReviewState
  note?: string
  answerKey?: string
}

export function checkedAnswerKey(question: Question) {
  return JSON.stringify([question.type, question.prompt, question.options, [...question.answers].sort()])
}

export function approvedAnswer(question: Question, review?: AcademicReview) {
  return review?.answer === 'verified' && review.answerKey === checkedAnswerKey(question) && !!review.note?.trim()
}

export function applyAcademicReview(question: Question, review?: AcademicReview): Question {
  if (review?.decision !== 'accepted') return question
  const slide = review.slide
  const slides = slide && !question.slides?.some((item) => item.materialId === slide.materialId && item.page === slide.page)
    ? [...(question.slides ?? []), slide] : question.slides
  return {
    ...question, chapterId: review.chapterId ?? question.chapterId, topics: review.topics ?? question.topics,
    tip: question.tip ?? (review.tip ? { format: 'text', value: review.tip } : undefined), slides,
  }
}

export function validateAcademicMetadata(review: AcademicReview, chapters: ReadonlySet<string>,
  topics: ReadonlySet<string>, pages: ReadonlyMap<string, number>) {
  if (review.chapterId && !chapters.has(review.chapterId)) return 'Lecture không thuộc danh mục.'
  if (review.topics?.some((topic) => !topics.has(topic)) || review.topics && new Set(review.topics).size !== review.topics.length) {
    return 'Chủ đề không thuộc danh mục hoặc bị trùng.'
  }
  if (review.slide && (!Number.isSafeInteger(review.slide.page) || review.slide.page < 1 ||
    review.slide.page > (pages.get(review.slide.materialId) ?? 0))) return 'Trang nguồn không hợp lệ.'
  if (review.answer === 'verified' && (!review.note?.trim() || !review.answerKey)) return 'Cần lưu căn cứ và bản đáp án đã kiểm định.'
  return undefined
}

export function academicCatalog(subject: Pick<import('./model').Subject, 'theory' | 'topics' | 'materials'>) {
  const chapters = new Set(subject.theory.map((item) => item.id))
  const labelByTopic = new Map(subject.topics.map((item) => [item.id, item.title]))
  const pages = new Map<string, number>()
  for (const chapter of subject.theory) {
    const metadata = chapter.metadata
    if (!metadata) continue
    for (const field of ['sections', 'supplementalTheory']) {
      const sections = metadata[field]
      if (!Array.isArray(sections)) continue
      for (const section of sections) {
        if (section && typeof section.id === 'string' && /^[\p{L}\p{N}_.-]+$/u.test(section.id) && typeof section.title === 'string') {
          labelByTopic.set(section.id, section.title)
        }
      }
    }
    const source = metadata.sourceFile
    if (typeof source === 'string' && typeof metadata.slideCount === 'number' && subject.materials.some((item) => item.id === source && item.file)) {
      pages.set(source, metadata.slideCount)
    }
  }
  return { chapters, labelByTopic, topics: new Set(labelByTopic.keys()), pages }
}
