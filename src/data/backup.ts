import { emptyStudy, type Save, type Study } from './model'
import { parsePreferences, type Preferences } from './preferences'
import { parseSave } from './storage'

export type BackupScope = 'full' | 'progress'
export type RestoreMode = 'replace' | 'merge'
export type Backup = { data: Save; scope: BackupScope; createdAt?: string; preferences?: Preferences }

function progressOnly(study: Study): Study {
  return { ...study, exams: [], edits: {}, materials: [] }
}

export function makeBackup(data: Save, scope: BackupScope, preferences: Preferences, date: Date) {
  return {
    ...data,
    subjects: scope === 'full' ? data.subjects : Object.fromEntries(
      Object.entries(data.subjects).map(([id, study]) => [id, progressOnly(study)]),
    ),
    backup: { scope, createdAt: date.toISOString(), ...(scope === 'full' ? { preferences } : {}) },
  }
}

export function readBackup(value: unknown): Backup {
  const data = parseSave(value)
  const meta = (value as { backup?: Record<string, unknown> }).backup
  if (meta !== undefined && (!meta || typeof meta !== 'object' || (meta.scope !== 'full' && meta.scope !== 'progress'))) {
    throw new Error('Phạm vi sao lưu không hợp lệ.')
  }
  const createdAt = typeof meta?.createdAt === 'string' && Number.isFinite(Date.parse(meta.createdAt)) ? meta.createdAt : undefined
  const scope = meta?.scope === 'progress' ? 'progress' : 'full'
  return {
    data, scope, createdAt,
    preferences: scope === 'full' && meta?.preferences !== undefined ? parsePreferences(meta.preferences) : undefined,
  }
}

function union<T>(current: T[], incoming: T[], key: (item: T) => string) {
  return [...new Map([...incoming, ...current].map((item) => [key(item), item])).values()]
}

function mergeStudy(current: Study, incoming: Study): Study {
  const history = union(current.history, incoming.history, (item) => item.id)
    .sort((a, b) => (a.ended ?? a.started) - (b.ended ?? b.started))
  const finished = new Set(history.map((item) => item.id))
  const examMap = new Map(current.exams.map((exam) => [exam.id, exam]))
  const known = new Set(current.exams.flatMap((exam) => exam.questions.map((q) => q.id)))
  for (const exam of incoming.exams) {
    const original = examMap.get(exam.id)
    const additions = exam.questions.filter((q) => !known.has(q.id))
    if (!additions.length) continue
    additions.forEach((q) => known.add(q.id))
    examMap.set(exam.id, { ...(original ?? exam), questions: [...(original?.questions ?? []), ...additions] })
  }
  return {
    ...current,
    attempts: union(current.attempts, incoming.attempts, (item) => JSON.stringify([item.questionId, item.at, item.correct]))
      .sort((a, b) => a.at - b.at),
    practice: { ...incoming.practice, ...current.practice },
    bookmarks: [...new Set([...current.bookmarks, ...incoming.bookmarks])],
    exams: [...examMap.values()],
    edits: { ...incoming.edits, ...current.edits },
    materials: union(current.materials, incoming.materials, (item) => item.id),
    sessions: union(current.sessions, incoming.sessions, (item) => item.id)
      .filter((item) => !finished.has(item.id)).sort((a, b) => b.started - a.started),
    history,
    resume: current.resume ?? incoming.resume,
    practiceFilters: current.practiceFilters ?? incoming.practiceFilters,
  }
}

export function restoreBackup(current: Save, backup: Backup, mode: RestoreMode, subjectId: string): Save {
  if (mode === 'replace' && backup.scope === 'full') return backup.data
  const subjects = { ...current.subjects }
  const incomingSubjects = { ...backup.data.subjects }
  if (mode === 'replace' && !incomingSubjects[subjectId]) incomingSubjects[subjectId] = emptyStudy
  for (const [id, incoming] of Object.entries(incomingSubjects)) {
    const previous = subjects[id] ?? emptyStudy
    subjects[id] = mode === 'merge'
      ? mergeStudy(previous, backup.scope === 'progress' ? progressOnly(incoming) : incoming)
      : { ...progressOnly(incoming), exams: previous.exams, edits: previous.edits, materials: previous.materials }
  }
  return { version: 1, subjects }
}

export function storageEstimate() {
  try {
    let bytes = 0
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index)
      if (key !== null) bytes += 2 * (key.length + (localStorage.getItem(key)?.length ?? 0))
    }
    return bytes
  } catch { return undefined }
}
