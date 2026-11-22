export type Content = { format: 'text' | 'html'; value: string }
export type SlideRef = { materialId: string; page: number }
export type Question = {
  id: string
  code?: string
  chapterId?: string
  topics?: string[]
  type: 'single' | 'multiple'
  prompt: Content
  options: { id: string; content: Content }[]
  answers: string[]
  explanation?: Content
  tip?: Content
  formulas?: string[]
  slides?: SlideRef[]
  sourceSlides?: number[]
  relatedSections?: Array<string | { lectureId?: string; sectionId: string; verified?: boolean }>
  correctExplanation?: Content
  wrongAnswerExplanations?: Record<string, Content>
  answerVerification?: 'verified' | 'unverified'
}
export const examCategories = ['FE', 'PT', 'MOCK', 'PRACTICE'] as const
export type ExamCategory = typeof examCategories[number]
export type Exam = { id: string; title: string; note?: string; uploaded?: boolean; category?: ExamCategory; questions: Question[] }
export type Theory = { id: string; title: string; summary?: string; content: Content; metadata?: Record<string, unknown> }
export type Material = {
  id: string
  title: string
  kind: 'pdf' | 'pptx' | 'images'
  sourceFile?: string
  file?: string
  preview?: string
  localFile?: string
  localPreview?: string
  localFingerprints?: Record<string, string>
  pages?: { page: number; image?: string; text?: string; localImage?: string }[]
}
export type SourceTarget = { courseId: string; lectureId?: string; sectionId?: string; questionId?: string }
export type SourceLink = SourceTarget & {
  documentId: string; slideNumber: number
  verificationStatus: 'verified' | 'suggested' | 'rejected' | 'unavailable'
  matchingMethod: 'manual' | 'keyword' | 'metadata'
}
export type Subject = {
  id: string; code: string; title: string
  theory: Theory[]
  exams: Exam[]
  topics: { id: string; title: string }[]
  materials: Material[]
}
export type Attempt = { questionId: string; correct: boolean; at: number }
export type PracticeResponse = { selected: string[]; correct?: boolean }
export type PracticeFilters = { exam: string; chapter: string; topic: string; onlyWrong: boolean }
export type Session = {
  id: string; title: string; started: number; deadline: number; index: number
  examId?: string | null
  unlimited?: boolean
  autoSubmit?: boolean
  questions: Question[]; selections: Record<string, string[]>; flags: string[]
  ended?: number
  completion?: 'manual' | 'timeout'
}
export type Study = {
  attempts: Attempt[]
  practice: Record<string, PracticeResponse>
  practiceFilters?: PracticeFilters
  bookmarks: string[]
  exams: Exam[]
  edits: Record<string, Question>
  materials: Material[]
  sourceLinks?: SourceLink[]
  history: Session[]
  sessions: Session[]
  resume?: string
  reviewLater?: Record<string, number>
  practiceRoute?: string
  curriculum?: { completed: Record<string, string[]>; last?: { lectureId: string; sectionId: string } }
}
export type Save = { version: 1; subjects: Record<string, Study> }

export const emptyStudy: Study = {
  attempts: [], practice: {}, bookmarks: [], exams: [], edits: {}, materials: [], history: [], sessions: [],
}

export const entireBank = 'Toàn bộ ngân hàng'

export function examScope(session: Session, exams: Exam[]): string | null {
  if (session.examId !== undefined) return session.examId
  if (session.title === entireBank) return null
  const matches = exams.filter((exam) => exam.title === session.title)
  return matches.length === 1 ? matches[0].id : ':' + session.title
}

export function isCorrect(question: Question, selected: string[] = []) {
  return selected.length === question.answers.length &&
    question.answers.every((id) => selected.includes(id))
}

export function uniqueQuestions(exams: Exam[]) {
  return [...new Map(exams.flatMap((exam) => exam.questions.map((question) =>
    [question.id, question] as const,
  ))).values()]
}

export function shuffle<T>(items: T[]) {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}
