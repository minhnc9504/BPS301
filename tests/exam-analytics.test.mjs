import assert from 'node:assert/strict'
import { test } from 'node:test'
import { examAnalytics, reviewIds, scoreTrend, unclassified, weakGroups } from '../src/data/examAnalytics.ts'

const question = (id, chapterId, answers = ['A'], topics = []) => ({
  id, chapterId, topics, answers, options: ['A', 'B', 'C'].map((id) => ({ id })),
})
const session = {
  questions: [question('one', '1', ['A'], ['bpm', 'bpm']), question('two', '11', ['A', 'C'], ['bpm', 'mining']),
    question('three', '12', ['A']), question('four', '1', ['A', 'B'])],
  selections: { one: ['A'], two: ['C', 'A'], four: ['A'] }, flags: ['two'],
  started: 10, deadline: 60, ended: 40,
}
const chapters = new Set(['1', '11'])

test('snapshot scoring reuses exact multiple choice grading and separates skipped questions', () => {
  const data = examAnalytics(session, chapters)
  assert.equal(data.score, 5)
  assert.equal(data.accuracy, 50)
  assert.equal(data.used, 30)
  assert.equal(data.limit, 50)
  assert.deepEqual(data.rows.map((row) => row.outcome), ['correct', 'correct', 'blank', 'wrong'])
  assert.equal(data.rows[1].flagged, true)
  assert.equal(data.rows[1].selected.join(','), 'C,A')
})

test('Lecture 11 and uncategorized group count correctly and topics deduplicate within each group', () => {
  const data = examAnalytics(session, chapters)
  assert.equal(data.covered, 2)
  assert.equal(data.byChapter.get(unclassified).blank, 1)
  assert.equal(data.byChapter.get('11').correct, 1)
  assert.equal(data.byTopic.get('bpm').count, 2)
  assert.equal(data.byTopic.get('mining').count, 1)
  assert.deepEqual(weakGroups(data.byChapter), [])
})

test('legacy result without completion data and incomplete or empty snapshot use unknown fields', () => {
  assert.equal(examAnalytics({ ...session, ended: undefined }, chapters).used, undefined)
  assert.equal(examAnalytics({ ...session, unlimited: true }, chapters).limit, undefined)
  const partial = examAnalytics({ ...session, questions: [question('one', '1', [])] }, chapters)
  assert.equal(partial.unknown, 1)
  assert.equal(partial.score, undefined)
  assert.equal(examAnalytics({ ...session, questions: [] }, chapters).score, undefined)
})

test('review lists preserve order without duplicated question IDs', () => {
  const { rows } = examAnalytics(session, chapters)
  assert.deepEqual(reviewIds([...rows, rows[3]], 'wrong'), ['four'])
  assert.deepEqual(reviewIds(rows, 'missed'), ['three', 'four'])
  assert.deepEqual(reviewIds(rows, 'chapter', '1'), ['one', 'four'])
  assert.deepEqual(reviewIds(rows, 'topic', 'mining'), ['two'])
})

test('score trends require comparable attempts and at least two known scores', () => {
  assert.equal(scoreTrend([4, 5.5], true), 1.5)
  assert.equal(scoreTrend([10, 8], true), -2)
  assert.equal(scoreTrend([4, 8], false), undefined)
  assert.equal(scoreTrend([4, undefined], true), undefined)
})

test('weak group review includes qualifying groups and skips small or unclassified groups', () => {
  const questions = ['one', 'two', 'three'].map((id) => question(id, '11', ['A'], ['mining', 'common']))
  questions.push(question('four', '12', ['A'], ['isolated']))
  const { rows } = examAnalytics({ ...session, questions, selections: { one: ['A'] } }, chapters)
  assert.deepEqual(reviewIds(rows, 'weak-chapters'), ['one', 'two', 'three'])
  assert.deepEqual(reviewIds(rows, 'weak-topics'), ['one', 'two', 'three'])
})
