import type { Question } from '../data/model'
import type { reviewRecord } from '../data/review'

const date = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' })
const format = (at: number) => Math.abs(at) <= 8_640_000_000_000_000 ? date.format(at) : 'Không rõ thời điểm'
export function PracticeFeedback({ question, selected, reviewed = false }: {
  question: Question; selected: string[]; reviewed?: boolean
}) {
  const optionLabels = (ids: string[]) => ids.map((id) => {
    const index = question.options.findIndex((option) => option.id === id)
    return /^[A-Z]$/.test(id) ? id : index >= 0 && index < 26 ? String.fromCharCode(65 + index) : id
  }).join(', ')
  return <div className="practice-answer task">
    <div className="row"><span className="tag">Bạn chọn: {optionLabels(selected)}</span><span className="tag">Đáp án tham khảo: {optionLabels(question.answers)}</span></div>
    <p className="muted">{reviewed ? 'Đáp án đã được kiểm định thủ công trên trình duyệt này.' : question.answerVerification === 'verified' ? 'Đáp án được dữ liệu đánh dấu đã xác minh.' :
      question.answerVerification === 'unverified' ? 'Đáp án chưa được xác minh.' : 'Nguồn chưa ghi trạng thái xác minh đáp án.'}</p>
  </div>
}

export function QuestionNotebook({ record }: { record?: ReturnType<typeof reviewRecord> }) {
  if (!record) return null
  return <section className="task practice-review-record">
      <strong>Sổ tay câu hỏi · Thành thạo {record.masteryLevel}/5</strong>
      <p>{record.correctCount} lượt đúng · {record.incorrectCount} lượt sai
        {record.nextReviewAt !== undefined && ' · Lịch ôn: ' + format(record.nextReviewAt)}</p>
      {record.lastIncorrectAt !== undefined && <p className="muted">Sai gần nhất: {format(record.lastIncorrectAt)}</p>}
      {record.lastCorrectAt !== undefined && <p className="muted">Đúng gần nhất: {format(record.lastCorrectAt)}</p>}
      {record.reviewHistory.length > 0 && <details><summary>Lịch sử của câu này</summary><ul>
        {record.reviewHistory.map((attempt, index) => <li key={index}>{format(attempt.at)} · {attempt.correct ? 'Đúng' : 'Sai'}</li>)}
      </ul></details>}
  </section>
}
