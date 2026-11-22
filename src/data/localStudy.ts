import { emptyStudy, type Save } from './model.ts'
import { parseSave, storageKey } from './storage.ts'

export const customExamsKey = 'bps301_custom_exams_v1'
export const progressKey = 'bps301_user_progress_v1'
export const studyKeys = [customExamsKey, progressKey, storageKey]

export function readLocalStudy(storage: Storage = localStorage): Save {
  const progress = storage.getItem(progressKey)
  if (progress === null) {
    const legacy = storage.getItem(storageKey)
    if (legacy !== null) return parseSave(JSON.parse(legacy))
  }
  const saved = progress === null ? { version: 1, subjects: {} } : JSON.parse(progress)
  if (saved?.version !== 1 || !saved.subjects || typeof saved.subjects !== 'object' || Array.isArray(saved.subjects)) {
    throw new Error('Kho tiến độ cục bộ không hợp lệ.')
  }
  const raw = storage.getItem(customExamsKey)
  const custom: unknown = raw === null ? {} : JSON.parse(raw)
  if (!custom || typeof custom !== 'object' || Array.isArray(custom)) throw new Error('Kho bộ đề cục bộ không hợp lệ.')
  const subjects = new Map(Object.entries(saved.subjects))
  for (const [id, exams] of Object.entries(custom)) {
    const previous = subjects.get(id)
    if (subjects.has(id) && (!previous || typeof previous !== 'object' || Array.isArray(previous))) {
      throw new Error('Tiến độ môn học không hợp lệ.')
    }
    subjects.set(id, { ...(previous ?? emptyStudy), exams })
  }
  return parseSave({ version: 1, subjects: Object.fromEntries(subjects) })
}

export function writeLocalStudy(data: Save, storage: Storage = localStorage) {
  const entries = Object.entries(data.subjects)
  const custom = JSON.stringify(Object.fromEntries(entries.filter(([, study]) => study.exams.length)
    .map(([id, study]) => [id, study.exams])))
  const progress = JSON.stringify({
    ...data, subjects: Object.fromEntries(entries.map(([id, study]) => [id, { ...study, exams: [] }])),
  })
  const previous = storage.getItem(customExamsKey)
  const changed = previous !== custom
  if (changed) storage.setItem(customExamsKey, custom)
  try {
    storage.setItem(progressKey, progress)
  } catch (error) {
    if (changed) {
      if (previous === null) storage.removeItem(customExamsKey)
      else storage.setItem(customExamsKey, previous)
    }
    throw error
  }
  storage.removeItem(storageKey)
}

export function withStudyLock<T>(operation: () => T): Promise<T> {
  if (!navigator.locks) return Promise.reject(new Error('Trình duyệt cần Web Locks để lưu dữ liệu an toàn giữa các tab. Hãy mở BPMS qua localhost hoặc HTTPS.'))
  return navigator.locks.request('bpms-study-v1', () => operation())
}
