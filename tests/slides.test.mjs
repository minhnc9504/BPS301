import assert from 'node:assert/strict'
import { test } from 'node:test'
import { combineSources, matchesSource, slideNumbers, slidePosition, sourceKey } from '../src/data/slides.ts'

test('PDF has consecutive pages and image groups use available positive page numbers', () => {
  assert.deepEqual(slideNumbers(3, [10]), [1, 2, 3])
  assert.deepEqual(slideNumbers(0, [8, 2, 2, 0, NaN, 2.5]), [2, 8])
  assert.equal(slidePosition([2, 8], 8), 8)
  assert.equal(slidePosition([2, 8], 5), 2)
  assert.equal(slidePosition([], 4), undefined)
})

const target = { courseId: 'bps301', lectureId: 'L2', sectionId: 'section' }
const suggestion = { ...target, documentId: 'doc', slideNumber: 2, matchingMethod: 'metadata', verificationStatus: 'suggested' }

test('saved verification and rejection override metadata, with verified links first', () => {
  const rejected = { ...suggestion, verificationStatus: 'rejected' }
  const verified = { ...suggestion, slideNumber: 3, verificationStatus: 'verified', matchingMethod: 'manual' }
  assert.deepEqual(combineSources([suggestion], [rejected, verified]), [verified, rejected])
  assert.equal(sourceKey(suggestion), sourceKey(rejected))
  assert.ok(matchesSource(suggestion, target))
  assert.ok(!matchesSource(suggestion, { ...target, lectureId: 'L3' }))
  assert.ok(!matchesSource({ ...suggestion, questionId: 'q' }, target))
})
