import test from 'node:test'
import assert from 'node:assert/strict'
import { learningStats, practiceReturn, reviewRecord, spacing, tomorrow } from '../src/data/review.ts'

const day = 86_400_000
const now = Date.UTC(2026, 10, 22)
const attempt = (questionId, correct, at = now) => ({ questionId, correct, at })
const question = (id, chapterId) => ({ id, chapterId })

test('default spaced repetition intervals, streak cap, wrong answer reset and manual override', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map(spacing), [600000, day, 3*day, 7*day, 14*day, 30*day, 30*day])
  const history = [attempt('q', true, now - day), attempt('q', false), attempt('q', true, now + day)]
  const wrong = reviewRecord('bps301', 'q', history.slice(0, 2))
  assert.equal(wrong.nextReviewAt, now + 600000)
  assert.equal(wrong.masteryLevel, 0)
  const item = reviewRecord('bps301', 'q', history.slice().reverse())
  assert.equal(item.nextReviewAt, now + 2 * day)
  assert.equal(item.masteryLevel, 1)
  assert.equal(item.correctCount, 2)
  assert.equal(item.incorrectCount, 1)
  assert.equal(item.lastIncorrectAt, now)
  assert.equal(item.lastCorrectAt, now + day)
  assert.equal(item.lastAttemptAt, now + day)
  assert.equal(item.firstCorrect, true)
  assert.equal(history[0].at, now - day)
  assert.equal(reviewRecord('bps301', 'q', history, tomorrow(now + day)).nextReviewAt, now + 2 * day)
  assert.equal(reviewRecord('bps301', 'q', [], tomorrow(now)).nextReviewAt, now + day)
})

test('separates attempts, questions, first accuracy, mastery and weak chapters', () => {
  const items = [question('a', '1'), question('b', '1'), question('c', '1'), question('unmapped'), question('new', '2')]
  const attempts = [
    attempt('a', false, now - day), ...Array.from({length: 5}, (_, n) => attempt('a', true, now - 100 + n)),
    attempt('b', false, now - day), attempt('c', false, now - day), attempt('unmapped', true),
    attempt('removed', false),
  ]
  const stats = learningStats('bps301', items, [{id:'1'}, {id:'2'}], { attempts, bookmarks:['a'] }, now)
  const total = stats.forQuestions(items)
  assert.deepEqual(total, {attempts:9, correct:6, wrong:3, unique:4, firstCorrect:1, latestCorrect:2,
    due:2, needed:3, mastered:1, accuracy:67, firstAccuracy:25})
  assert.deepEqual([...stats.weak], ['1'])
  assert.equal(stats.byChapter.get('1').unique,3)
  assert.equal(stats.byChapter.get('2').accuracy,undefined)
  assert.equal(stats.matches(items[0], 'wrong'), true)
  assert.equal(stats.matches(items[0], 'bookmarked'), true)
  assert.equal(stats.matches(items[0], 'due'), false)
  assert.equal(stats.matches(items[1], 'due'), true)
  assert.equal(stats.matches(items[3], 'weak'), false)
  assert.equal(stats.matches(items[4], 'unseen'), true)
})

test('snooze overrides due time and filters change exactly at the deadline', () => {
  const q = question('a')
  const study = {attempts:[attempt('a', false, now - day)], bookmarks:[], reviewLater:{a:now+1}}
  assert.equal(learningStats('bps301',[q],[],study,now).matches(q,'due'),false)
  assert.equal(learningStats('bps301',[q],[],study,now+1).matches(q,'due'),true)
})

test('return links retain query filters but reject external and parent paths', () => {
  assert.equal(practiceReturn('/trainning?lesson=1%3A1.1&question=A'),'/trainning?lesson=1%3A1.1&question=A')
  for (const url of ['//example.com','/trainning/../settings','/trainning/%2e%2e/settings','/trainning\\evil','/trainningfake']) {
    assert.equal(practiceReturn(url),undefined)
  }
})
