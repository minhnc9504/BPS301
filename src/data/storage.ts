import { answerReviewStates, type AcademicReview } from './academicReview.ts'
import type { Content, Exam, Material, Question, Save, Session, SourceLink, Study, Subject } from './model.ts'
import { examCategories, type ExamCategory } from './model.ts'
import { practiceReturn } from './review.ts'

export const storageKey = 'smart-exam-v1'

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Cần một đối tượng JSON')
  return value as Record<string, unknown>
}
function list(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error('Cần một danh sách JSON')
  return value
}
function str(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Thiếu nội dung văn bản')
  return value
}
function id(value: unknown) {
  const result = str(value)
  if (!/^[\p{L}\p{N}_.-]+$/u.test(result) || result in Object.prototype) throw new Error('ID không hợp lệ: ' + result)
  return result
}
function number(value: unknown, min = 0): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min) throw new Error('Số không hợp lệ')
  return value
}
function unique<T>(items: T[], key: (item: T) => string, label: string) {
  const seen = new Set<string>()
  for (const item of items) {
    const value = key(item)
    if (seen.has(value)) throw new Error('Trùng ' + label + ': ' + value)
    seen.add(value)
  }
  return items
}
export function content(value: unknown): Content {
  if (typeof value === 'string') return { format: 'text', value: str(value) }
  const entry = record(value)
  if (entry.format !== 'text' && entry.format !== 'html') throw new Error('Định dạng nội dung phải là text hoặc html')
  return { format: entry.format, value: str(entry.value) }
}
export function parseQuestion(value: unknown): Question {
  const q = record(value)
  const key = id(q.id)
  try {
    if (q.type !== 'single' && q.type !== 'multiple') throw new Error('Loại câu phải là single hoặc multiple')
    const options = unique(list(q.options).map((item) => {
      const option = record(item)
      return { id: id(option.id), content: content(option.content) }
    }), (option) => option.id, 'ID lựa chọn')
    const answers = unique(list(q.answers).map(id), (answer) => answer, 'đáp án')
    if (options.length < 2 || answers.length < 1 || (q.type === 'single' && answers.length !== 1) ||
      answers.some((answer) => !options.some((option) => option.id === answer))) {
      throw new Error('Đáp án phải khớp với lựa chọn và loại câu hỏi')
    }
    return {
      id: key, type: q.type, prompt: content(q.prompt), options, answers,
      code: q.code === undefined ? undefined : str(q.code),
      chapterId: q.chapterId === undefined ? undefined : id(q.chapterId),
      topics: q.topics === undefined ? undefined : list(q.topics).map(id),
      relatedSections: q.relatedSections === undefined ? undefined : list(q.relatedSections).map((item) => {
        if (typeof item === 'string') return str(item)
        const relation = record(item)
        return { lectureId: relation.lectureId === undefined ? undefined : id(String(relation.lectureId)),
          sectionId: id(String(relation.sectionId ?? '')), verified: relation.verified === true }
      }),
      explanation: q.explanation === undefined ? undefined : content(q.explanation),
      correctExplanation: q.correctExplanation === undefined ? undefined : content(q.correctExplanation),
      wrongAnswerExplanations: q.wrongAnswerExplanations === undefined ? undefined : Object.fromEntries(
        Object.entries(record(q.wrongAnswerExplanations)).map(([option, explanation]) => [id(option), content(explanation)])),
      answerVerification: q.answerVerification === 'verified' || q.answerVerification === 'unverified' ? q.answerVerification : undefined,
      sourceSlides: q.sourceSlides === undefined ? undefined : [...new Set(list(q.sourceSlides)
        .filter((value): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0))],
      tip: q.tip === undefined ? undefined : content(q.tip),
      formulas: q.formulas === undefined ? undefined : list(q.formulas).map(str),
      slides: q.slides === undefined ? undefined : list(q.slides).map((item) => {
        const slide = record(item)
        return { materialId: id(slide.materialId), page: number(slide.page, 1) }
      }),
    }
  } catch (error) {
    throw new Error(key + ' · ' + message(error))
  }
}
function parseExams(value: unknown): Exam[] {
  return unique(list(value).map((item) => {
    const exam = record(item)
    const questions = unique(list(exam.questions).map(parseQuestion), (q) => q.id, 'ID câu')
    if (!questions.length) throw new Error('Bộ đề phải có ít nhất một câu')
    const category = examCategories.find((item) => item === exam.category)
    if (exam.category !== undefined && !category) throw new Error('Phân loại đề không hợp lệ')
    return { id: id(exam.id), title: str(exam.title), note: exam.note === undefined ? undefined : str(exam.note), questions,
      uploaded: exam.uploaded === true ? true : undefined, category }
  }), (exam) => exam.id, 'ID bộ đề')
}
function legacyDocument(value: unknown, subjectId: string) {
  const items = Array.isArray(value) ? value : [value]
  const grouped = new Map<string, unknown[]>()
  for (const item of items) {
    const q = record(item)
    const examId = id(q.exam)
    const answers = Array.isArray(q.answer) ? q.answer : [q.answer]
    const options = list(q.options).map((item) => {
      const value = str(item)
      const prefix = /^([\p{L}\p{N}]+)[.)]\s/u.exec(value)?.[1]
      if (!prefix) throw new Error('Lựa chọn cũ cần tiền tố như A. hoặc B.')
      return { id: prefix, content: value }
    })
    const questions = grouped.get(examId) ?? []
    questions.push({
      id: q.id, type: answers.length > 1 ? 'multiple' : 'single',
      chapterId: q.chapter === undefined ? undefined : String(q.chapter),
      prompt: q.question, options, answers, explanation: q.explanation, tip: q.tip,
    })
    grouped.set(examId, questions)
  }
  return { version: 1, subjectId, exams: Array.from(grouped, ([id, questions]) => ({ id, title: id, questions })) }
}
export function normalizeExamId(value: string) {
  return value.trim().normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/gi, 'd')
    .toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}
function titledExamDocument(value: unknown, subjectId: string, filename: string, overrides?: { id: string; title: string; category?: ExamCategory }) {
  const document = record(value)
  const stem = filename.split('/').at(-1)?.replace(/\.json$/i, '') ?? ''
  const examId = id(overrides ? normalizeExamId(overrides.id || String(document.exam_id ?? stem)) : stem)
  const title = overrides?.title.trim() || document.exam_title || document.title || stem
  const questions = list(document.questions).map((item) => {
    const question = record(item)
    const questionId = examId + '_' + (typeof question.id === 'number' ? number(question.id, 1) : id(question.id))
    if (overrides) {
      if (typeof question.question !== 'string' || !question.question.trim()) throw new Error(questionId + ' · Thiếu nội dung question')
      if (!question.options || typeof question.options !== 'object' || Array.isArray(question.options)) throw new Error(questionId + ' · options phải là đối tượng lựa chọn')
      if (question.answer === undefined && question.answers_list === undefined) throw new Error(questionId + ' · Thiếu answer hoặc answers_list')
      if (question.chapter !== undefined && !/^(?:[1-9]|10|11)$/.test(String(question.chapter))) throw new Error(questionId + ' · chapter phải từ 1 đến 11')
    }
    if (question.type !== 'SINGLECHOICE' && question.type !== 'MULTIPLECHOICE') {
      throw new Error(questionId + ' · Loại câu hỏi không được hỗ trợ')
    }
    const fromAnswer = typeof question.answer === 'string' ? question.answer.split(',').map((part) => part.trim()) : question.answer
    const answers = question.answers_list ?? fromAnswer
    if (overrides) {
      const keys = list(answers).map(str)
      if (question.type === 'MULTIPLECHOICE' && keys.length < 2) throw new Error(questionId + ' · Câu chọn nhiều cần ít nhất hai đáp án')
      if (question.answers_list !== undefined && fromAnswer !== undefined) {
        const alternate = list(fromAnswer).map(str)
        if (alternate.length !== keys.length || [...alternate].sort().join(',') !== [...keys].sort().join(',')) {
          throw new Error(questionId + ' · answer và answers_list không khớp')
        }
      }
    }
    return {
      id: questionId,
      code: question.code,
      chapterId: question.chapter === undefined && question.chapterId === undefined ? undefined :
        String(question.chapter ?? question.chapterId),
      type: question.type === 'SINGLECHOICE' ? 'single' : 'multiple',
      prompt: question.question,
      options: Object.entries(record(question.options)).map(([id, content]) => ({ id, content })),
      answers,
      explanation: question.explanation,
      correctExplanation: question.correctExplanation ?? question.correct_explanation,
      wrongAnswerExplanations: question.wrongAnswerExplanations ?? question.wrong_answer_explanations,
      answerVerification: question.answerVerification ?? question.answer_verification,
      sourceSlides: question.sourceSlides ?? question.source_slides,
      tip: question.tip,
      relatedSections: question.relatedSections,
      slides: question.slides,
    }
  })
  return { version: 1, subjectId, exams: [{ id: examId, title, note: document.note, questions,
    uploaded: overrides ? true : undefined, category: overrides?.category }] }
}
export function parseUploadedExam(value: unknown, subjectId: string, filename: string, overrides: { id: string; title: string; category?: ExamCategory }) {
  const doc = titledExamDocument(value, subjectId, filename, overrides)
  return parseBank(doc, subjectId)[0]
}
export function parseBank(value: unknown, subjectId: string, allowLegacy = false, filename = '') {
  const supported = filename && value && typeof value === 'object' && 'exam_title' in value
    ? titledExamDocument(value, subjectId, filename) : value
  const input = allowLegacy && (Array.isArray(supported) || (supported && typeof supported === 'object' && 'question' in supported))
    ? legacyDocument(supported, subjectId) : supported
  const doc = record(input)
  if (doc.version !== 1 || doc.subjectId !== subjectId) throw new Error('Sai phiên bản JSON hoặc môn học')
  const exams = parseExams(doc.exams)
  if (!exams.length) throw new Error('Thiếu bộ đề')
  unique(exams.flatMap((exam) => exam.questions), (question) => question.id, 'ID câu trong file')
  return exams
}
export function asset(path: string) {
  if (/^data:(application\/(pdf|vnd\.openxmlformats-officedocument\.presentationml\.presentation)|image\/(png|jpeg|webp|gif));base64,[\w+/=]+$/i.test(path)) return path
  if (!/^(?:data|materials)\/[\p{L}\p{N}_./ -]+$/u.test(path) || path.split('/').includes('..')) {
    throw new Error('Đường dẫn tài nguyên không hợp lệ')
  }
  return import.meta.env.BASE_URL + path
}
async function read(path: string): Promise<unknown> {
  const response = await fetch(asset(path))
  if (!response.ok) throw new Error('Không đọc được ' + path + ' (' + response.status + ')')
  try { return await response.json() }
  catch { throw new Error('JSON không hợp lệ tại ' + path) }
}
function materialPath(value: unknown) {
  const path = str(value)
  asset(path)
  if (!path.startsWith('materials/') && !path.startsWith('data:')) throw new Error('Tệp phải nằm trong materials/')
  return path
}
export function parseMaterial(value: unknown): Material {
  const entry = record(value)
  const kind = entry.kind
  if (kind !== 'pdf' && kind !== 'pptx' && kind !== 'images') throw new Error('Loại giáo trình không hợp lệ')
  const file = entry.file === undefined ? undefined : materialPath(entry.file)
  const preview = entry.preview === undefined ? undefined : materialPath(entry.preview)
  const localFile = entry.localFile === undefined ? undefined : id(entry.localFile)
  const localPreview = entry.localPreview === undefined ? undefined : id(entry.localPreview)
  const localFingerprints = entry.localFingerprints === undefined ? undefined : Object.fromEntries(
    Object.entries(record(entry.localFingerprints)).map(([key, fingerprint]) => {
      if (typeof fingerprint !== 'string' || !/^[0-9a-f]{64}$/.test(fingerprint)) throw new Error('Mã đối chiếu tệp không hợp lệ')
      return [id(key), fingerprint]
    }),
  )
  const pages = entry.pages === undefined ? undefined : unique(list(entry.pages).map((item) => {
    const page = record(item)
    return { page: number(page.page, 1), image: page.image === undefined ? undefined : materialPath(page.image),
      localImage: page.localImage === undefined ? undefined : id(page.localImage), text: page.text === undefined ? undefined : str(page.text) }
  }), (page) => String(page.page), 'số trang')
  if (!file && !preview && !localFile && !localPreview && !pages?.some((page) => page.image || page.localImage)) throw new Error('Thiếu tệp giáo trình')
  return { id: id(entry.id), title: str(entry.title), kind, file, preview, localFile, localPreview, localFingerprints, pages }
}

function parseSourceLink(value: unknown): SourceLink {
  const entry = record(value)
  const verificationStatus = entry.verificationStatus
  const matchingMethod = entry.matchingMethod
  if (verificationStatus !== 'verified' && verificationStatus !== 'suggested' && verificationStatus !== 'rejected' &&
    verificationStatus !== 'unavailable') throw new Error('Trạng thái xác minh slide không hợp lệ')
  if (matchingMethod !== 'manual' && matchingMethod !== 'keyword' && matchingMethod !== 'metadata') {
    throw new Error('Phương pháp liên kết slide không hợp lệ')
  }
  const questionId = entry.questionId === undefined ? undefined : id(entry.questionId)
  const lectureId = entry.lectureId === undefined ? undefined : id(entry.lectureId)
  const sectionId = entry.sectionId === undefined ? undefined : id(entry.sectionId)
  if (questionId ? sectionId !== undefined : !lectureId || !sectionId) throw new Error('Đích liên kết slide không hợp lệ')
  return { courseId: id(entry.courseId), questionId, lectureId, sectionId, documentId: str(entry.documentId),
    slideNumber: number(entry.slideNumber, 1), verificationStatus, matchingMethod }
}

function parseMaterialsManifest(value: unknown): Material[] {
  const manifest = record(value)
  if (manifest.version !== 1) throw new Error('Phiên bản danh mục giáo trình chưa được hỗ trợ')
  return list(manifest.materials).map((value) => {
    const item = record(value)
    const sourceFile = str(item.sourceFile)
    if (item.file === undefined) return { id: id(item.id), title: str(item.title), kind: 'pdf', sourceFile }
    return { ...parseMaterial(item), sourceFile }
  })
}

export async function loadSubjects(reportExamError?: (error: string) => void): Promise<Subject[]> {
  const catalog = record(await read('data/catalog.json'))
  if (catalog.version !== 1) throw new Error('Phiên bản danh mục chưa được hỗ trợ')
  const subjects = await Promise.all(list(catalog.subjects).map(async (path) => {
    const subject = record(await read(str(path)))
    if (subject.version !== 1) throw new Error('Phiên bản môn học chưa được hỗ trợ')
    const subjectId = id(subject.id)
    const [theory, exams, manifest] = await Promise.all([
      subject.theory === undefined ? [] : read(str(subject.theory)),
      Promise.all(list(subject.exams).map(async (file) => {
        const path = str(file)
        try { return parseBank(await read(path), subjectId, false, path) }
        catch (error) {
          const detail = path + ' · ' + message(error)
          if (!reportExamError) throw new Error(detail)
          reportExamError(detail)
          return []
        }
      })),
      subject.materialsManifest === undefined ? undefined : read(str(subject.materialsManifest)),
    ])
    const discovered = manifest === undefined ? [] : parseMaterialsManifest(manifest)
    const bank = unique(exams.flat(), (exam) => exam.id, 'ID bộ đề')
    unique(bank.flatMap((exam) => exam.questions), (q) => q.id, 'ID câu trong môn')
    return {
      id: subjectId, code: str(subject.code), title: str(subject.title), exams: bank,
      theory: unique(list(theory).map((item) => {
        const chapter = record(item)
        return { id: id(typeof chapter.id === 'number' ? String(chapter.id) : chapter.id), title: str(chapter.title), summary: chapter.summary === undefined ? undefined : str(chapter.summary),
          content: chapter.content === undefined ? { format: 'text' as const, value: '' } : content(chapter.content), metadata: chapter }
      }), (chapter) => chapter.id, 'ID chương'),
      topics: unique(list(subject.topics ?? []).map((item) => {
        const topic = record(item)
        return { id: id(topic.id), title: str(topic.title) }
      }), (topic) => topic.id, 'ID chủ đề'),
      materials: unique([...list(subject.materials ?? []).map(parseMaterial), ...discovered], (material) => material.id, 'ID giáo trình'),
    }
  }))
  return unique(subjects, (subject) => subject.id, 'ID môn')
}
function parseSession(value: unknown): Session {
  const entry = record(value)
  const questions = unique(list(entry.questions).map(parseQuestion), (q) => q.id, 'ID câu trong phiên')
  const index = number(entry.index)
  const started = number(entry.started)
  const deadline = number(entry.deadline, started + 1)
  const completion = entry.completion
  if (completion !== undefined && completion !== 'manual' && completion !== 'timeout') throw new Error('Lý do kết thúc phiên thi không hợp lệ')
  const ended = entry.ended === undefined ? undefined : number(entry.ended, started)
  if (index >= questions.length || (ended !== undefined && ended > deadline)) throw new Error('Phiên thi không hợp lệ')
  const selections = Object.fromEntries(Object.entries(record(entry.selections)).map(([key, value]) => {
    const q = questions.find((item) => item.id === key)
    const selected = unique(list(value).map(id), (option) => option, 'lựa chọn trong phiên')
    if (!q || (q.type === 'single' && selected.length > 1) ||
        selected.some((option) => !q.options.some((item) => item.id === option))) throw new Error('Lựa chọn phiên thi không hợp lệ')
    return [key, selected]
  }))
  const flags = list(entry.flags).map(id)
  if (flags.some((key) => !questions.some((q) => q.id === key))) throw new Error('Cờ trong phiên thi không hợp lệ')
  const examId = entry.examId == null ? entry.examId : id(entry.examId)
  if ((entry.unlimited !== undefined && typeof entry.unlimited !== 'boolean') ||
      (entry.autoSubmit !== undefined && typeof entry.autoSubmit !== 'boolean')) throw new Error('Cấu hình phiên thi không hợp lệ')
  return { id: id(entry.id), title: str(entry.title), examId, questions, index, started, deadline, ended, completion, selections, flags,
    unlimited: entry.unlimited, autoSubmit: entry.autoSubmit }
}
function parseCurriculumProgress(value: unknown): NonNullable<Study['curriculum']> {
  const data = record(value)
  const last = data.last === undefined ? undefined : record(data.last)
  return {
    completed: Object.fromEntries(Object.entries(record(data.completed)).map(([lecture, sections]) =>
      [id(lecture), [...new Set(list(sections).map(id))]])),
    last: last && { lectureId: id(last.lectureId), sectionId: id(last.sectionId) },
  }
}
function parseAcademicReview(value: unknown): AcademicReview {
  const entry = record(value)
  const { decision, answer } = entry
  if (decision !== 'pending' && decision !== 'accepted' && decision !== 'rejected') throw new Error('Quyết định kiểm định không hợp lệ.')
  if (!answerReviewStates.some((value) => value === answer)) throw new Error('Trạng thái kiểm định không hợp lệ.')
  const slide = entry.slide === undefined ? undefined : record(entry.slide)
  const note = entry.note === undefined ? undefined : str(entry.note)
  const answerKey = entry.answerKey === undefined ? undefined : str(entry.answerKey)
  if (answer === 'verified' && (!note || !answerKey)) throw new Error('Thiếu căn cứ kiểm định thủ công.')
  return { decision, answer: answer as AcademicReview['answer'], note, answerKey,
    chapterId: entry.chapterId === undefined ? undefined : id(entry.chapterId),
    topics: entry.topics === undefined ? undefined : unique(list(entry.topics).map(id), (topic) => topic, 'chủ đề kiểm định'),
    tip: entry.tip === undefined ? undefined : str(entry.tip),
    slide: slide && { materialId: id(slide.materialId), page: number(slide.page, 1) },
  }
}

export function parseSave(value: unknown): Save {
  const root = record(value)
  if (root.version !== 1) throw new Error('Phiên bản sao lưu chưa được hỗ trợ')
  const subjects = Object.fromEntries(Object.entries(record(root.subjects)).map(([key, value]): [string, Study] => {
    const study = record(value)
    const history = unique(list(study.history).map(parseSession), (session) => session.id, 'ID bài thi')
    const sessions = study.sessions === undefined
      ? (study.session === undefined ? [] : [parseSession(study.session)])
      : list(study.sessions).map(parseSession)
    unique([...history, ...sessions], (session) => session.id, 'ID bài thi')
    if (sessions.some((item) => item.ended !== undefined || item.completion !== undefined)) {
      throw new Error('Trạng thái phiên thi không hợp lệ')
    }
    const practice = Object.fromEntries(Object.entries(record(study.practice ?? {})).map(([key, value]) => {
      const response = record(value)
      const selected = unique(list(response.selected).map(id), (option) => option, 'lựa chọn ôn tập')
      const correct = response.correct
      if (!selected.length || (correct !== undefined && typeof correct !== 'boolean')) {
        throw new Error('Đáp án ôn tập không hợp lệ')
      }
      return [id(key), { selected, correct }]
    }))
    const filters = study.practiceFilters === undefined ? undefined : record(study.practiceFilters)
    const filterId = (value: unknown) => value === '' ? '' : id(value)
    if (filters && typeof filters.onlyWrong !== 'boolean') throw new Error('Bộ lọc ôn tập không hợp lệ')
    const edits = Object.fromEntries(Object.entries(record(study.edits)).map(([key, value]) => {
      const question = parseQuestion(value)
      if (question.id !== key) throw new Error('ID bản chỉnh sửa không khớp')
      return [key, question]
    }))
    return [id(key), {
      exams: parseExams(study.exams), edits, history, sessions, practice,
      practiceFilters: filters && {
        exam: filterId(filters.exam), chapter: filterId(filters.chapter),
        topic: filterId(filters.topic), onlyWrong: filters.onlyWrong === true,
      },
      resume: study.resume === undefined ? undefined : id(study.resume),
      practiceRoute: typeof study.practiceRoute === 'string' ? practiceReturn(study.practiceRoute) : undefined,
      reviewLater: study.reviewLater === undefined ? undefined : Object.fromEntries(Object.entries(record(study.reviewLater))
        .map(([question, at]) => [id(question), number(at)])),
      curriculum: study.curriculum === undefined ? undefined : parseCurriculumProgress(study.curriculum),
      bookmarks: list(study.bookmarks).map(id),
      materials: unique(list(study.materials).map(parseMaterial), (material) => material.id, 'ID giáo trình'),
      academicReviews: study.academicReviews === undefined ? undefined : Object.fromEntries(
        Object.entries(record(study.academicReviews)).map(([key, review]) => [id(key), parseAcademicReview(review)])),
      sourceLinks: study.sourceLinks === undefined ? undefined : list(study.sourceLinks).map(parseSourceLink),
      attempts: list(study.attempts).map((value) => {
        const attempt = record(value)
        if (typeof attempt.correct !== 'boolean') throw new Error('Lượt ôn không hợp lệ')
        return { questionId: id(attempt.questionId), correct: attempt.correct, at: number(attempt.at) }
      }),
    }]
  }))
  return { version: 1, subjects }
}

export function message(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

export function downloadJson(filename: string, value: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
