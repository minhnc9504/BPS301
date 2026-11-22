import DOMPurify from 'dompurify'
import { BookOpen, CircleCheck, CircleX, Lightbulb } from 'lucide-react'
import { Fragment } from 'react'
import { isCorrect, type Content, type Question } from '../data/model'

function splitMatches(text: string, query: string) {
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return text.split(new RegExp('(' + escaped + ')', 'giu'))
}

export function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>
  return <>{splitMatches(text, query).map((part, index) =>
    index % 2 ? <mark key={index}>{part}</mark> : <Fragment key={index}>{part}</Fragment>,
  )}</>
}

function renderHtml(value: string, query: string, theory: boolean) {
  const body = document.createElement('div')
  body.append(DOMPurify.sanitize(value, {
    ALLOWED_TAGS: ['p','br','strong','em','b','i','ul','ol','li','table','thead','tbody','tr','th','td','code','pre','sub','sup','blockquote','img','h2','h3','h4','hr','section'],
    ALLOWED_ATTR: ['src', 'alt', 'title', 'colspan', 'rowspan'],
    RETURN_DOM_FRAGMENT: true,
  }))
  if (theory) {
    for (const paragraph of body.querySelectorAll('p')) {
      if (/^\s*(điểm dễ nhầm|lưu ý)\s*:/iu.test(paragraph.textContent ?? '')) paragraph.classList.add('theory-note')
    }
  }
  if (query) {
    const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT)
    const nodes: Text[] = []
    while (walker.nextNode()) nodes.push(walker.currentNode as Text)
    for (const node of nodes) {
      const parts = splitMatches(node.data, query)
      if (parts.length < 2) continue
      const replacement = document.createDocumentFragment()
      parts.forEach((part, index) => {
        if (index % 2) {
          const mark = document.createElement('mark')
          mark.textContent = part
          replacement.append(mark)
        } else replacement.append(part)
      })
      node.replaceWith(replacement)
    }
  }
  return body.innerHTML
}

export function Rich({ content, query = '', theory = false }: { content: Content; query?: string; theory?: boolean }) {
  return content.format === 'text'
    ? <div className="rich"><Highlight text={content.value} query={query} /></div>
    : <div className="rich" dangerouslySetInnerHTML={{
      __html: renderHtml(content.value, query, theory),
    }} />
}
export function Choices({ question, selected, reveal, change, disabled = false }: {
  question: Question; selected: string[]; reveal: boolean
  change: (answers: string[], optionId: string) => void
  disabled?: boolean
}) {
  return <fieldset className="choices" disabled={reveal || disabled}>
    <legend className="sr-only">Lựa chọn trả lời</legend>
    {question.options.map((option, index) => {
      const checked = selected.includes(option.id)
      const right = reveal && question.answers.includes(option.id)
      const hasLetterId = /^[A-Z]$/.test(option.id)
      const badge = hasLetterId ? option.id : index < 26 ? String.fromCharCode(65 + index) : index + 1
      return <label key={option.id} className={'option ' + (right ? 'right' : reveal && checked ? 'wrong' : checked ? 'picked' : '')}>
        <input type={question.type === 'single' ? 'radio' : 'checkbox'} name={'answer-' + question.id}
          checked={checked} onChange={() => change(question.type === 'single' ? [option.id] :
            checked ? selected.filter((id) => id !== option.id) : [...selected, option.id], option.id)} />
        <span className="option-badge">{badge}</span>
        <Rich content={hasLetterId && option.content.format === 'text' &&
          option.content.value.startsWith(option.id + '. ') ? { ...option.content, value: option.content.value.slice(3) } : option.content} />
        {right && <small>Đáp án đúng</small>}
        {reveal && checked && !right && <small>Bạn đã chọn</small>}
      </label>
    })}
  </fieldset>
}
export function Feedback({ question, selected, slide, correct, explanations = true, tips = true }: {
  question: Question; selected: string[]; slide?: (materialId: string, page: number) => void
  correct?: boolean
  explanations?: boolean
  tips?: boolean
}) {
  const right = correct ?? isCorrect(question, selected)
  return <div className={'feedback ' + (right ? 'right' : 'wrong')} aria-live="polite">
    <strong className="row">{right ? <CircleCheck size={20} /> : <CircleX size={20} />}{right ? 'Chính xác!' : selected.length ? 'Chưa chính xác' : 'Chưa trả lời'}</strong>
    {question.explanation && (explanations
      ? <div className="feedback-content"><b className="row"><BookOpen size={16} /> Giải thích</b><Rich content={question.explanation} /></div>
      : <details className="feedback-content"><summary>Giải thích</summary><Rich content={question.explanation} /></details>)}
    {question.tip && (tips
      ? <div className="feedback-content memory-tip"><b className="row"><Lightbulb size={16} /> Mẹo ghi nhớ</b><Rich content={question.tip} /></div>
      : <details className="feedback-content memory-tip"><summary>Mẹo ghi nhớ</summary><Rich content={question.tip} /></details>)}
    {question.formulas?.map((formula, index) => <code className="formula" key={index}>{formula}</code>)}
    {slide && question.slides?.map((ref, index) => <button type="button" key={index} onClick={() => slide(ref.materialId, ref.page)}>
      {ref.materialId} · Trang {ref.page}
    </button>)}
  </div>
}
