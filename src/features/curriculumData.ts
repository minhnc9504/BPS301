import DOMPurify from 'dompurify'
import type { Content, Material, Question, Subject, Theory } from '../data/model'

const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value)
  ? value as Record<string, unknown> : {}
const array = (value: unknown): unknown[] => Array.isArray(value) ? value : []
const text = (value: unknown) => typeof value === 'string' ? value : ''
const strings = (value: unknown) => array(value).map(text).filter(Boolean)
export const slug = (value: string) => value.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
  .replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const plain = (value: string) => DOMPurify.sanitize(value, { RETURN_DOM_FRAGMENT: true }).textContent ?? ''

export type Slide = { page: number; file: string; title: string; materialId?: string; verified: boolean }
export type Lesson = {
  id: string; title: string; content: Content; keywords: string[]; slides: Slide[]
  tips: string[]; examples: string[]; excerpts: string[]; objectives: string[]; formulas: string[]
  tables: { title: string; headers: string[]; rows: string[][] }[]
  note?: string; summary?: string; search: string
}
export type Lecture = Theory & { lessons: Lesson[]; objectives: string[]; terms: { term: string; meaning: string }[]; tips: string[] }

function asContent(value: unknown, fallback: string): Content {
  const entry = object(value)
  return entry.format === 'html' || entry.format === 'text'
    ? { format: entry.format, value: text(entry.value) }
    : { format: 'text', value: text(value) || fallback }
}

function legacySections(chapter: Theory): Record<string, unknown>[] {
  if (chapter.content.format !== 'html') return [{ id: 'content', title: chapter.title, content: chapter.content }]
  const fragment = DOMPurify.sanitize(chapter.content.value, { RETURN_DOM_FRAGMENT: true })
  const sections: Record<string, unknown>[] = []
  const holder = document.createElement('div')
  let title = chapter.title
  function flush() {
    if (!holder.innerHTML.trim()) return
    sections.push({ title, content: { format: 'html', value: holder.innerHTML } })
    holder.replaceChildren()
  }
  for (const node of Array.from(fragment.childNodes)) {
    if (node instanceof Element && /^H[2-4]$/.test(node.tagName)) {
      flush()
      title = node.textContent || chapter.title
    } else holder.append(node)
  }
  flush()
  return sections.length ? sections : [{ id: 'content', title: chapter.title, content: chapter.content }]
}

export function curriculum(subject: Subject): Lecture[] {
  return subject.theory.map((chapter) => {
    const source = chapter.metadata ?? {}
    const sections = array(source.sections).map(object)
    const slides = [...array(source.slides), ...array(source.sources)].map(object)
    const ids = new Set<string>()
    const lessons = (sections.length ? [...sections, ...array(source.supplementalTheory).map(object)] : legacySections(chapter)).map((entry): Lesson => {
      const title = text(entry.title) || chapter.title
      const proposed = String(entry.id ?? '')
      const base = /^[\p{L}\p{N}_.-]+$/u.test(proposed) && !(proposed in Object.prototype) ? proposed : slug(title) || 'content'
      let id = base
      for (let n = 2; ids.has(id); n++) id = base + '-' + n
      ids.add(id)
      const content = asContent(entry.content, text(entry.explanationVi) || text(entry.explanation))
      const references = [...array(entry.sourceSlides), ...array(entry.slides), ...array(entry.sources)].flatMap((item): Slide[] => {
        const data = object(item)
        const page = Number(typeof item === 'number' || typeof item === 'string' ? item : data.page ?? data.slideNumber ?? data.slide)
        if (!Number.isSafeInteger(page) || page < 1) return []
        const meta = slides.find((slide) => Number(slide.slideNumber ?? slide.page) === page) ?? {}
        const file = text(data.file) || text(object(meta.source).file) || text(meta.file) || text(source.sourceFile)
        return [{ page, file, title: text(data.title) || text(meta.title),
          materialId: text(data.materialId) || text(meta.materialId) || undefined,
          verified: data.verified === true || data.verification === 'verified' || entry.sourceMappingMethod === 'verified' }]
      })
      const keywords = [...strings(entry.keywords), ...array(entry.keyTerms).map((item) => text(item) || text(object(item).term))].filter(Boolean)
      const tips = [...strings(entry.examTips), ...strings(entry.memoryTips)]
      const examples = [...array(entry.examples), ...array(entry.examplesFromSlides)]
        .map((item) => text(item) || text(object(item).originalText) || text(object(item).text)).filter(Boolean)
      const excerpts = array(entry.sourceExcerpts).map((item) => {
        const data = object(item)
        return text(data.originalText) ? 'Slide ' + String(data.slide ?? '') + ' · ' + text(data.originalText) : ''
      }).filter(Boolean)
      const objectives = [...strings(entry.learningObjectives), ...strings(entry.objectives)]
      const formulas = [...array(entry.formulas), ...(sections[0] === entry ? array(source.formulas) : [])].map((item) => {
        const data = object(item)
        return text(item) || [text(data.expression) || text(data.formula), text(data.explanation), text(data.units)].filter(Boolean).join('\n')
      }).filter(Boolean)
      const tables = [...array(entry.comparisonTables), ...(sections[0] === entry ? array(source.comparisonTables) : [])].map((item) => {
        const data = object(item)
        return { title: text(data.title), headers: strings(data.headers), rows: array(data.rows).map(strings) }
      }).filter((table) => table.headers.length && table.rows.length)
      const note = text(entry.examTipVi) || text(entry.pitfall)
      const summary = text(entry.summary)
      const body = content.format === 'html' ? plain(content.value) : content.value
      return { id, title, content, keywords, slides: [...new Map(references.map((item) => [item.file + ':' + item.page, item])).values()],
        tips, examples, excerpts, objectives, formulas, tables, note, summary,
        search: [body, note, summary, ...keywords, ...examples, ...excerpts, ...formulas, ...tips].filter(Boolean).join(' ').replace(/\s+/g, ' ') }
    })
    return { ...chapter, lessons, objectives: strings(source.learningObjectives), tips: [...strings(source.memoryTips), ...strings(source.examTips)],
      terms: array(source.keyTerms).map((item) => ({ term: text(item) || text(object(item).term), meaning: text(object(item).meaningVi) }))
        .filter((item) => item.term) }
  })
}
export function lessonPath(lectureId: string, sectionId: string) {
  return '/curriculum/chapter/' + encodeURIComponent(lectureId) + '?' + new URLSearchParams({ section: sectionId })
}
export function findMaterial(slide: Slide, materials: Material[]) {
  const file = slide.file.split(/[\\/]/).at(-1)?.toLowerCase()
  return materials.find((item) => item.id === slide.materialId) ?? (file
    ? materials.find((item) => [item.sourceFile, item.title, item.file?.split('/').at(-1)].some((name) => name?.toLowerCase() === file))
    : undefined)
}

export function relatedQuestions(lecture: Lecture, lesson: Lesson, questions: Question[], materials: Material[]) {
  const terms = [...new Set([lesson.title, ...lesson.keywords].map(slug))].filter((item) => item.length >= 4)
  return questions.flatMap((question) => {
    const sectionLinks = question.relatedSections?.filter((link) => typeof link === 'string'
      ? link === lecture.id + ':' + lesson.id || (link === lesson.id && question.chapterId === lecture.id)
      : link.sectionId === lesson.id && (link.lectureId ?? question.chapterId) === lecture.id)
    if (sectionLinks?.some((link) => typeof link !== 'string' && link.verified)) {
      return [{ question, rank: 4, label: 'Liên kết section đã xác minh' }]
    }
    if (lesson.slides.some((slide) => {
      const material = slide.verified ? findMaterial(slide, materials) : undefined
      return question.slides?.some((item) => slide.verified && (slide.materialId ?? material?.id) === item.materialId && slide.page === item.page)
    })) return [{ question, rank: 3, label: 'Liên kết slide đã xác minh' }]
    if (question.chapterId === lecture.id && question.topics?.some((topic) => topic === lesson.id || terms.includes(slug(topic)))) {
      return [{ question, rank: 2, label: 'Khớp chương và chủ đề' }]
    }
    if (sectionLinks?.length) return [{ question, rank: 1.9, label: 'Liên kết section · chưa xác minh' }]
    if (question.chapterId && question.chapterId !== lecture.id) return []
    const prompt = '-' + slug(question.prompt.format === 'html' ? plain(question.prompt.value) : question.prompt.value) + '-'
    const score = terms.filter((term) => prompt.includes('-' + term + '-')).length
    return score ? [{ question, rank: 1 + Math.min(score, 8) / 10, label: 'Gợi ý theo từ khóa' }] : []
  }).sort((a, b) => b.rank - a.rank).slice(0, 12)
}
