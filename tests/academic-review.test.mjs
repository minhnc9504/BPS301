import assert from 'node:assert/strict'
import { test } from 'node:test'
import { applyAcademicReview, approvedAnswer, checkedAnswerKey, validateAcademicMetadata } from '../src/data/academicReview.ts'
import { emptyStudy } from '../src/data/model.ts'
import { parseSave } from '../src/data/storage.ts'
import { makeBackup, readBackup, restoreBackup } from '../src/data/backup.ts'
import { defaultPreferences } from '../src/data/preferences.ts'

const text = (value) => ({ format: 'text', value })
const question = { id: 'q1', type: 'single', prompt: text('Original?'),
  options: [{ id: 'A', content: text('One') }, { id: 'B', content: text('Two') }], answers: ['A'], explanation: text('Original explanation') }
const slide = { materialId: 'Lecture1.pptx', page: 5 }
const base = { decision: 'pending', answer: 'suggested', chapterId: '1', topics: ['1.1'], tip: 'Gợi nhớ', slide }
const validate = (metadata) => validateAcademicMetadata(metadata, new Set(['1','11']), new Set(['1.1']), new Map([[slide.materialId, 10]]))

test('pending and rejected proposals are inert; acceptance protects question and answer', () => {
  assert.equal(applyAcademicReview(question, base), question)
  assert.equal(applyAcademicReview(question, { ...base, decision: 'rejected' }), question)
  const edited = applyAcademicReview(question, { ...base, decision: 'accepted' })
  assert.equal(edited.id, question.id)
  assert.equal(edited.prompt, question.prompt)
  assert.equal(edited.options, question.options)
  assert.equal(edited.answers, question.answers)
  assert.equal(edited.explanation, question.explanation)
  assert.equal(edited.chapterId, '1')
  assert.deepEqual(edited.topics, ['1.1'])
  assert.equal(edited.tip.value, 'Gợi nhớ')
  assert.equal(approvedAnswer(edited, base), false)
})

test('validation rejects Lecture 12, unknown or duplicate topic, and out of range pages', () => {
  assert.equal(validate(base), undefined)
  assert.match(validate({ ...base, chapterId: '12' }), /Lecture/)
  assert.match(validate({ ...base, topics: ['other'] }), /Chủ đề/)
  assert.match(validate({ ...base, topics: ['1.1','1.1'] }), /Chủ đề/)
  assert.match(validate({ ...base, slide: { ...slide, page: 0 } }), /Trang/)
  assert.match(validate({ ...base, slide: { ...slide, page: 11 } }), /Trang/)
})

test('accepted source never duplicates or replaces an existing tip', () => {
  const originalTip = text('Người học đã chỉnh')
  const result = applyAcademicReview({ ...question, slides: [slide], tip: originalTip }, { ...base, decision: 'accepted' })
  assert.equal(result.slides.length, 1)
  assert.equal(result.tip, originalTip)
})

test('manual answer review requires a matching question snapshot and evidence', () => {
  const verified = { ...base, answer: 'verified', note: 'Đối chiếu PDF trang 5.', answerKey: checkedAnswerKey(question) }
  assert.equal(approvedAnswer(question, verified), true)
  assert.equal(approvedAnswer({ ...question, answers: ['B'] }, verified), false)
  assert.equal(approvedAnswer({ ...question, prompt: text('Edited') }, verified), false)
  assert.equal(approvedAnswer(question, { ...verified, note: undefined }), false)
  assert.match(validate({ ...base, answer: 'verified' }), /căn cứ/)
})

test('academic metadata survives full backup and leaves historical snapshots unchanged', () => {
  const session = { id: 'x', title: 'Exam', index: 0, started: 1, ended: 2, deadline: 3,
    questions: [question], selections: { q1: ['A'] }, flags: [] }
  const saved = { version: 1, subjects: { bps301: { ...emptyStudy, history: [session], academicReviews: { q1: base } } } }
  const full = readBackup(makeBackup(saved, 'full', defaultPreferences, new Date()))
  const progress = readBackup(makeBackup(saved, 'progress', defaultPreferences, new Date()))
  assert.equal(full.data.subjects.bps301.academicReviews.q1.answer, 'suggested')
  assert.equal(progress.data.subjects.bps301.academicReviews, undefined)
  assert.equal(restoreBackup(saved, progress, 'replace', 'bps301').subjects.bps301.academicReviews.q1.answer, 'suggested')
  assert.equal(full.data.subjects.bps301.history[0].questions[0].chapterId, undefined)
  assert.throws(() => parseSave({ version: 1, subjects: { bps301: { ...emptyStudy, academicReviews: { q1: { ...base, answer: 'verified' } } } } }), /căn cứ/)
})
