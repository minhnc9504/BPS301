import DOMPurify from 'dompurify'
import { isCorrect, type Content, type Question } from '../data/model'

export function Rich({ content }: { content: Content }) {
  return content.format === 'text'
    ? <div className="rich">{content.value}</div>
    : <div className="rich" dangerouslySetInnerHTML={{
      __html: DOMPurify.sanitize(content.value, {
        ALLOWED_TAGS: ['p','br','strong','em','b','i','ul','ol','li','table','thead','tbody','tr','th','td','code','pre','sub','sup','blockquote','img'],
        ALLOWED_ATTR: ['src', 'alt', 'title', 'colspan', 'rowspan'],
      }),
    }} />
}
export function Choices({ question, selected, reveal, change }: {
  question: Question; selected: string[]; reveal: boolean
  change: (answers: string[]) => void
}) {
  return <fieldset className="choices" disabled={reveal}>
    <legend className="sr-only">Lựa chọn trả lời</legend>
    {question.options.map((option) => {
      const checked = selected.includes(option.id)
      const right = reveal && question.answers.includes(option.id)
      return <label key={option.id} className={'option ' + (right ? 'right' : reveal && checked ? 'wrong' : checked ? 'picked' : '')}>
        <input type={question.type === 'single' ? 'radio' : 'checkbox'} name={'answer-' + question.id}
          checked={checked} onChange={() => change(question.type === 'single' ? [option.id] :
            checked ? selected.filter((id) => id !== option.id) : [...selected, option.id])} />
        <Rich content={option.content} />
        {right && <small>Đáp án đúng</small>}
        {reveal && checked && !right && <small>Bạn đã chọn</small>}
      </label>
    })}
  </fieldset>
}
export function Feedback({ question, selected, slide, correct }: {
  question: Question; selected: string[]; slide: (materialId: string, page: number) => void
  correct?: boolean
}) {
  const right = correct ?? isCorrect(question, selected)
  return <div className={'feedback ' + (right ? 'right' : 'wrong')} aria-live="polite">
    <strong>{right ? 'Chính xác!' : selected.length ? 'Chưa chính xác' : 'Chưa trả lời'}</strong>
    {question.explanation && <Rich content={question.explanation} />}
    {question.tip && <div><b>Mẹo ghi nhớ</b><Rich content={question.tip} /></div>}
    {question.formulas?.map((formula, index) => <code className="formula" key={index}>{formula}</code>)}
    {question.slides?.map((ref, index) => <button type="button" key={index} onClick={() => slide(ref.materialId, ref.page)}>
      {ref.materialId} · Trang {ref.page}
    </button>)}
  </div>
}
