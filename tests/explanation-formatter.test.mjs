import assert from 'node:assert/strict'
import { test } from 'node:test'
import { formatExplanation } from '../src/data/explanationFormatter.ts'

const text = (value) => ({ format: 'text', value })
const format = (value, extra = {}) => formatExplanation({
  options: ['A', 'B', 'C', 'D'].map((id) => ({ id, content: text('Nội dung ' + id) })),
  answers: ['C'], explanation: text(value), ...extra,
})

test('plain legacy text and Unicode stay intact', () => {
  const input = 'Quy trình và hiệu suất — tiếng Việt. Ví dụ A. Bước kế tiếp.'
  const result = format(input)
  assert.equal(result.primary.value, input)
  assert.deepEqual(result.alternatives, [])
})

test('separates all explicit labels and pipe alternatives', () => {
  const result = format('A conceptual distinction.\nLoại trừ: A. Không khớp | B. Thiếu điều kiện\nLý do: C thỏa đủ.\nMẹo: Nhớ C.\nNguồn: Lecture 2')
  assert.equal(result.primary.value, 'A conceptual distinction.')
  assert.deepEqual(result.alternatives.map(({ option }) => option.id), ['A', 'B'])
  assert.equal(result.reason.value, 'C thỏa đủ.')
  assert.equal(result.tips[0].value, 'Nhớ C.')
  assert.equal(result.source.value, 'Lecture 2')
})

test('quoted markers and pipes stay in their original sentences', () => {
  const result = format('Giữ “Nguồn: minh họa”.\nLoại trừ: A. Ví dụ "a | b" khác tình huống | D. Ví dụ khác.')
  assert.equal(result.primary.value, 'Giữ “Nguồn: minh họa”.')
  assert.equal(result.source, undefined)
  assert.equal(result.alternatives[0].detail.value, 'Ví dụ "a | b" khác tình huống')
})

test('inline option-specific reasons do not become the conclusion', () => {
  const result = format('Ý chính.\nLoại trừ: A. Thiếu điều kiện. Lý do: Ý chính. | B. Thiếu dữ kiện. Lý do: Phạm vi khác.')
  assert.equal(result.reason, undefined)
  assert.equal(result.alternatives[0].detail.value, 'Thiếu điều kiện.')
  assert.match(result.alternatives[1].detail.value, /Lý do: Phạm vi khác/)
})

test('partial labels and note do not require a source', () => {
  const result = format('Ý chính.\nMẹo: Nhớ điều kiện.\nLưu ý: Có ngoại lệ.')
  assert.equal(result.tips[0].value, 'Nhớ điều kiện.')
  assert.equal(result.note.value, 'Có ngoại lệ.')
  assert.equal(result.source, undefined)
})

test('deduplicates same reason and explicit tip', () => {
  const result = format('Nội dung chính.\nLý do: Nội dung chính\nMẹo: Nhớ điều kiện.', { tip: text('Nhớ điều kiện') })
  assert.equal(result.reason, undefined)
  assert.equal(result.tips.length, 1)
})

test('multiple choice shows only supplied explanations of incorrect options', () => {
  const result = format('Nội dung chính. Loại trừ: B. Khác bối cảnh | D. Không đúng loại.', {
    answers: ['A', 'C'], wrongAnswerExplanations: { A: text('not applicable'), B: text('Căn cứ riêng') },
  })
  assert.deepEqual(result.alternatives.map(({ option }) => option.id), ['B', 'D'])
  assert.equal(result.alternatives[0].detail.value, 'Căn cứ riêng')
  assert.equal(result.legacyAlternatives[0].value, 'B: Khác bối cảnh')
})

test('malformed options and unmatched quotes preserve original wording', () => {
  const input = 'Nội dung.\nLoại trừ: A, B và D có vẻ giống nhau.'
  assert.equal(format(input).legacyAlternatives[0].value, 'A, B và D có vẻ giống nhau.')
  const unclosed = 'Ví dụ "Mẹo: chưa đóng ngoặc. Nguồn: từ trích dẫn.'
  assert.equal(format(unclosed).primary.value, unclosed)
  assert.equal(format(unclosed).source, undefined)
  const malformed = 'Có dữ liệu.\nNguồn:'
  assert.equal(format(malformed).primary.value, malformed)
})

test('HTML stays whole for the sanitized renderer', () => {
  const explanation = { format: 'html', value: '<p>Nguồn: minh họa</p>' }
  const result = format('', { explanation })
  assert.equal(result.primary, explanation)
  assert.equal(result.source, undefined)
})

test('omits an exact repeated option heading from its supplied reason', () => {
  const result = format('Ý chính.\nLoại trừ: A. "Nội dung A" thiếu điều kiện.', {
    options: [{ id: 'A', content: text('A. Nội dung A') }, { id: 'C', content: text('C. Nội dung C') }],
  })
  assert.equal(result.alternatives[0].option.content.value, 'Nội dung A')
  assert.equal(result.alternatives[0].detail.value, 'thiếu điều kiện.')
})
