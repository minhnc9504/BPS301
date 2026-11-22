import { BookOpen, CircleCheck, CircleX, Lightbulb } from 'lucide-react'
import { Rich } from '../components/Question'
import type { formatExplanation } from '../data/explanationFormatter'
import type { Question } from '../data/model'

export function StructuredExplanation({ question, formatted, correct, explanations, tips }: {
  question: Question; formatted: ReturnType<typeof formatExplanation>; correct: boolean; explanations: boolean; tips: boolean
}) {
  const hasAnalysis = formatted.alternatives.length > 0 || formatted.legacyAlternatives.length > 0
  const details = <>
    {formatted.primary && <section className="task"><h4>Giải thích đáp án đúng</h4><Rich content={formatted.primary} /></section>}
    {formatted.additional && <Rich content={formatted.additional} />}
    {hasAnalysis && <section className="task"><h4>Phân tích các phương án sai</h4>
      {formatted.alternatives.map(({ option, detail }) => <div className="explanation-option" key={option.id}>
        <span className="option-badge">{option.id}</span><div><Rich content={option.content} /><Rich content={detail} /></div>
      </div>)}
      {formatted.legacyAlternatives.map((content, i) => <Rich content={content} key={i} />)}
    </section>}
    {formatted.reason && <section className="task"><h4>Lý do kết luận</h4><Rich content={formatted.reason} /></section>}
    {formatted.note && <section className="task"><h4>Lưu ý</h4><Rich content={formatted.note} /></section>}
    {question.formulas?.map((formula, i) => <code className="formula" key={i}>{formula}</code>)}
  </>
  const hasExplanation = formatted.primary || formatted.reason || formatted.note || hasAnalysis || question.formulas?.length
  return <section className="task practice-explanation">
    <strong className={'row practice-verdict ' + (correct ? 'right' : 'wrong')} aria-live="polite">
      {correct ? <CircleCheck size={19} /> : <CircleX size={19} />}{correct ? 'Chính xác!' : 'Chưa chính xác'}
    </strong>
    {hasExplanation ? explanations ? <section className="task"><h3 className="row"><BookOpen size={17} /> Giải thích</h3>{details}</section>
      : <details><summary>Giải thích</summary><div className="task">{details}</div></details>
      : <p className="muted">Nguồn hiện chưa có lời giải cho câu này.</p>}
    {formatted.tips.length > 0 && (tips
      ? <aside className="feedback-content memory-tip"><strong className="row"><Lightbulb size={17} /> Mẹo ghi nhớ</strong>
          {formatted.tips.map((content, index) => <Rich key={index} content={content} />)}</aside>
      : <details className="feedback-content memory-tip"><summary>Mẹo ghi nhớ</summary>
          {formatted.tips.map((content, index) => <Rich key={index} content={content} />)}</details>)}
  </section>
}
