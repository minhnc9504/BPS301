import { createContext, useContext } from 'react'
import type { Exam, Question } from './data/model'

export const paths = {
  overview: '/home', practice: '/trainning', exam: '/mock_exam',
  library: '/curriculum', bank: '/question_bank', settings: '/settings',
} as const
export type Section = keyof typeof paths
const base = import.meta.env.BASE_URL.replace(/\/$/, '')

export function href(path: string) { return base + path }
export function readRoute() {
  const input = location.pathname
  const pathname = base && (input === base || input.startsWith(base + '/')) ? input.slice(base.length) : input
  const path = pathname.replace(/\/+$/, '').replace(/^\/training(?=\/|$)/, '/trainning') || paths.overview
  const section = (Object.keys(paths) as Section[]).find((key) => path === paths[key] || path.startsWith(paths[key] + '/'))
  const canonical = href(path) + location.search + location.hash
  if (input + location.search + location.hash !== canonical) history.replaceState(null, '', canonical)
  const segments = path.split('/').slice(2).map((part) => {
    try { return decodeURIComponent(part) } catch { return part }
  })
  return { section, segments, query: new URLSearchParams(location.search), hash: location.hash.slice(1) }
}
export type Route = ReturnType<typeof readRoute> & { go: (path: string, replace?: boolean) => void }
export const RouteContext = createContext<Route | null>(null)
export function useRoute() { return useContext(RouteContext)! }

const aliases: Record<string, string> = {
  BPS301_FA26_FE_805603: 'fa26_fe', SU26_FE: 'su26_fe', FA25: 'fa25_fe', FE_Mock: 'mock_set',
}
export function examSlug(id: string) { return aliases[id] ?? id }
export function findExam(exams: Exam[], slug?: string) {
  return exams.find((exam) => examSlug(exam.id).toLowerCase() === slug?.toLowerCase()) ??
    exams.find((exam) => exam.id === slug)
}
export function findQuestion(questions: Question[], key?: string) {
  return questions.find((q) => q.id === key) ?? questions.find((q) => {
    const match = /^BPS301_FA26_FE_(\d+)$/i.exec(key ?? '')
    return match && q.id === 'BPS301_FA26_FE_805603_' + Number(match[1])
  })
}
export function position(raw: string | null | undefined, total: number) {
  const index = Number(raw) - 1
  return Number.isSafeInteger(index) && index >= 0 && index < total ? index : undefined
}

export function examReportReturn(value?: string | null) {
  if (!value || /[\\\u0000-\u001f]/.test(value)) return undefined
  const path = value.split('?')[0]
  return /^\/mock_exam\/[\p{L}\p{N}_.%:-]+\/result$/u.test(path) && !/\.{2}|%2e/i.test(path) ? value : undefined
}
