import { emptyStudy, type Save } from './model'
import { parseSave, storageKey } from './storage'

export const customExamsKey = 'bps301_custom_exams_v1'
export const progressKey = 'bps301_user_progress_v1'
export const studyKeys = [customExamsKey, progressKey, storageKey]

export function readLocalStudy(storage: Storage = localStorage): Save {
  const progress = storage.getItem(progressKey)
  if (progress === null) {
    const legacy = storage.getItem(storageKey)
    if (legacy !== null) return parseSave(JSON.parse(legacy))
  }
  const saved: Save = progress === null ? { version: 1, subjects: {} } : parseSave(JSON.parse(progress))
  const raw = storage.getItem(customExamsKey)
  const custom: unknown = raw === null ? {} : JSON.parse(raw)
  if (!custom || typeof custom !== 'object' || Array.isArray(custom)) throw new Error('Kho bộ đề cục bộ không hợp lệ.')
  const subjects = { ...saved.subjects }
  for (const [id, exams] of Object.entries(custom)) {
    subjects[id] = { ...(saved.subjects[id] ?? emptyStudy), exams }
  }
  return parseSave({ version: 1, subjects })
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
