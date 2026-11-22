import assert from 'node:assert/strict'
import { test } from 'node:test'
import { customExamsKey, progressKey, readLocalStudy, writeLocalStudy } from '../src/data/localStudy.ts'
import { asset, storageKey } from '../src/data/storage.ts'
import { emptyStudy } from '../src/data/model.ts'
import { makeBackup, readBackup, restoreBackup } from '../src/data/backup.ts'
import { defaultPreferences } from '../src/data/preferences.ts'
import { maxJsonBytes, readJsonFile } from '../src/data/jsonFile.ts'

function memoryStorage() {
  const values = new Map()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  }
}
const answer = { format: 'text', value: 'Option' }
const question = { id: 'q', type: 'single', prompt: answer, options: [{ id: 'A', content: answer }, { id: 'B', content: answer }], answers: ['A'] }
const exam = { id: 'exam', title: 'Exam', questions: [question] }
const makeSave = (study) => ({ version: 1, subjects: { bps301: { ...emptyStudy, ...study } } })

test('migration reads legacy data and preserves the split storage format', () => {
  const storage = memoryStorage()
  const older = makeSave({ exams: [exam], bookmarks: ['q'] })
  storage.setItem(storageKey, JSON.stringify(older))
  writeLocalStudy(readLocalStudy(storage), storage)
  assert.equal(storage.getItem(storageKey), null)
  assert.equal(JSON.parse(storage.getItem(progressKey)).subjects.bps301.exams.length, 0)
  assert.equal(readLocalStudy(storage).subjects.bps301.exams[0].questions[0].id, 'q')
  assert.deepEqual(readLocalStudy(storage).subjects.bps301.bookmarks, ['q'])
})

test('failing progress write rolls back the accompanying change to custom exams', () => {
  const storage = memoryStorage()
  writeLocalStudy(makeSave({ bookmarks: ['q'] }), storage)
  const progress = storage.getItem(progressKey)
  const custom = storage.getItem(customExamsKey)
  const base = storage.setItem
  storage.setItem = (key, value) => {
    if (key === progressKey) throw new DOMException('quota', 'QuotaExceededError')
    base(key, value)
  }
  assert.throws(() => writeLocalStudy(makeSave({ exams: [exam] }), storage), /quota/)
  assert.equal(storage.getItem(progressKey), progress)
  assert.equal(storage.getItem(customExamsKey), custom)
})

test('corrupt storage and duplicate history IDs are rejected without a write', () => {
  const storage = memoryStorage()
  storage.setItem(progressKey, '{"version":1,"subjects":[]}')
  assert.throws(() => readLocalStudy(storage), /tiến độ/)
  const item = { id: 'run', title: 'Exam', index: 0, started: 10, deadline: 100, ended: 80, questions: [question], flags: [], selections: {} }
  assert.throws(() => readBackup(makeSave({ history: [item, item] })), /Trùng ID bài thi/)
  const { ended, ...old } = item
  assert.equal(readBackup(makeSave({ history: [old] })).data.subjects.bps301.history[0].ended, undefined)
})

test('progress restore keeps local materials and verified links, full merge deduplicates history', () => {
  const material = { id: 'doc', kind: 'pdf', title: 'PDF', localFile: 'blob' }
  const link = { courseId: 'bps301', questionId: 'q', documentId: 'doc', slideNumber: 2, matchingMethod: 'manual', verificationStatus: 'verified' }
  const item = { id: 'run', title: 'Exam', index: 0, started: 10, deadline: 100, ended: 80, questions: [question], flags: [], selections: {} }
  const current = makeSave({ materials: [material], sourceLinks: [link], history: [item] })
  const backup = readBackup(makeBackup(current, 'full', defaultPreferences, new Date()))
  const merged = restoreBackup(current, backup, 'merge', 'bps301')
  assert.equal(merged.subjects.bps301.history.length, 1)
  assert.equal(merged.subjects.bps301.sourceLinks[0].verificationStatus, 'verified')
  const progress = readBackup(makeBackup(makeSave({}), 'progress', defaultPreferences, new Date()))
  const replaced = restoreBackup(current, progress, 'replace', 'bps301')
  assert.deepEqual(replaced.subjects.bps301.materials, [material])
  assert.deepEqual(replaced.subjects.bps301.sourceLinks, [link])
})

test('JSON uploads reject oversized and malformed files and accept BOM', async () => {
  await assert.rejects(readJsonFile({ name: 'backup.json', size: maxJsonBytes + 1, text: async () => assert.fail('must reject before reading') }), /10 MB/)
  await assert.rejects(readJsonFile(new File(['{'], 'bad.json')), /sai cú pháp/)
  assert.deepEqual(await readJsonFile(new File(['\uFEFF{"version":1}'], 'ok.json')), { version: 1 })
})

test('material paths reject external URLs, script URLs and encoded traversal', () => {
  for (const path of ['https://example.com/a.pdf', 'javascript:alert(1)', 'materials/../data/x.pdf', 'materials/%2e%2e/a.pdf']) {
    assert.throws(() => asset(path), /không hợp lệ/)
  }
})
