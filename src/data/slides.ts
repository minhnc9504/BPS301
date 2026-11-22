import type { SourceLink, SourceTarget } from './model'

export function slideNumbers(pdfPages: number, images: number[]) {
  return pdfPages > 0 ? Array.from({ length: pdfPages }, (_, index) => index + 1)
    : [...new Set(images.filter((page) => Number.isSafeInteger(page) && page > 0))].sort((a, b) => a - b)
}
export function slidePosition(pages: number[], requested: number) {
  return pages.filter((value) => value <= requested).at(-1) ?? pages[0]
}
export function sourceKey(link: SourceLink) {
  return JSON.stringify([link.courseId, link.questionId ?? null, link.questionId ? null : link.lectureId,
    link.sectionId ?? null, link.documentId, link.slideNumber])
}
export function matchesSource(link: SourceLink, target: SourceTarget) {
  return link.courseId === target.courseId && (target.questionId
    ? link.questionId === target.questionId
    : !link.questionId && link.lectureId === target.lectureId && link.sectionId === target.sectionId)
}
export function combineSources(suggested: SourceLink[], saved: SourceLink[]) {
  const rank = { verified: 0, suggested: 1, unavailable: 2, rejected: 3 }
  return [...new Map([...suggested, ...saved].map((item) => [sourceKey(item), item])).values()]
    .sort((a, b) => rank[a.verificationStatus] - rank[b.verificationStatus])
}
