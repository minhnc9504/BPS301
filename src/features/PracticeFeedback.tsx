import { Rich } from '../components/Question'
import type { Question } from '../data/model'
import type { reviewRecord } from '../data/review'

const date = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' })
const format = (at: number) => Math.abs(at) <= 8_640_000_000_000_000 ? date.format(at) : 'Không rõ thời điểm'
export function PracticeFeedback({ question, selected, record, explanations }: {
  question: Question; selected: string[]; record?: ReturnType<typeof reviewRecord>; explanations: boolean
}) {
  const optionLabels = (ids: string[]) => ids.map((id) => {
    const index = question.options.findIndex((option) => option.id === id)
    return /^[A-Z]$/.test(id) ? id : index >= 0 && index < 26 ? String.fromCharCode(65 + index) : id
  }).join(', ')
  const wrong = selected.filter((id) => !question.answers.includes(id))
    .flatMap((id) => question.wrongAnswerExplanations?.[id] ? [{ id, content: question.wrongAnswerExplanations[id] }] : [])
  const detail = <>
    {question.correctExplanation && <div><strong>Vì sao đáp án đúng</strong><Rich content={question.correctExplanation} /></div>}
    {wrong.map(({ id, content }) => <div key={id}><strong>Vì sao phương án {optionLabels([id])} sai</strong><Rich content={content} /></div>)}
  </>
  return <div className="practice-answer task">
    <div className="row"><span className="tag">Bạn chọn: {optionLabels(selected)}</span><span className="tag">Đáp án tham khảo: {optionLabels(question.answers)}</span></div>
    <p className="muted">{question.answerVerification === 'verified' ? 'Đáp án được dữ liệu đánh dấu đã xác minh.' :
      question.answerVerification === 'unverified' ? 'Đáp án chưa được xác minh.' : 'Nguồn chưa ghi trạng thái xác minh đáp án.'}</p>
    {Boolean(question.sourceSlides?.length) && <p className="muted">Slide ghi trong dữ liệu: {question.sourceSlides?.join(', ')}.</p>}
    {(!question.explanation && !question.correctExplanation && !wrong.length) && <p className="muted">Nguồn hiện chưa có lời giải cho câu này.</p>}
    {(question.correctExplanation || wrong.length > 0) && (explanations ? detail : <details><summary>Giải thích theo phương án</summary>{detail}</details>)}
    {record && <div className="task practice-review-record">
      <strong>Sổ tay câu hỏi · Thành thạo {record.masteryLevel}/5</strong>
      <p>{record.correctCount} lượt đúng · {record.incorrectCount} lượt sai
        {record.nextReviewAt !== undefined && ' · Lịch ôn: ' + format(record.nextReviewAt)}</p>
      {record.lastIncorrectAt !== undefined && <p className="muted">Sai gần nhất: {format(record.lastIncorrectAt)}</p>}
      {record.lastCorrectAt !== undefined && <p className="muted">Đúng gần nhất: {format(record.lastCorrectAt)}</p>}
      {record.reviewHistory.length > 0 && <details><summary>Lịch sử của câu này</summary><ul>
        {record.reviewHistory.map((attempt, index) => <li key={index}>{format(attempt.at)} · {attempt.correct ? 'Đúng' : 'Sai'}</li>)}
      </ul></details>}
    </div>}
  </div>
}
