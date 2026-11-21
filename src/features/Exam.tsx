import { useRef, useState } from 'react'
import { Check, ClipboardCheck, Flag, Timer } from 'lucide-react'
import { Progress } from '../components/Progress'
import { Choices, Feedback, Rich } from '../components/Question'
import { entireBank, examScope, isCorrect, shuffle, uniqueQuestions, type Exam as ExamData, type Session } from '../data/model'

export function Exam({ exams, sessions, history, now, save, submit, reset, slide }: {
  exams: ExamData[]; sessions: Session[]; history: Session[]; now: number
  save: (session: Session, starting?: boolean) => boolean; submit: (id: string) => boolean
  reset: (scope: string | null, kind: 'sessions' | 'history') => boolean
  slide: (id: string, page: number) => void
}) {
  const [source, setSource] = useState('')
  const [count, setCount] = useState<number | ''>('')
  const [minutes, setMinutes] = useState<number | ''>(30)
  const [mixQuestions, setMixQuestions] = useState(true)
  const [mixOptions, setMixOptions] = useState(true)
  const [active, setActive] = useState(sessions[0]?.id ?? '')
  const [review, setReview] = useState(sessions[0]?.id ?? '')
  const [matrixFilter, setMatrixFilter] = useState<'all' | 'unanswered' | 'flagged'>('all')
  const submitDialog = useRef<HTMLDialogElement>(null)
  const session = sessions.find((item) => item.id === active)
  const selectedExam = exams.find((item) => item.id === source)
  const pending = sessions.find((item) => examScope(item, exams) === (selectedExam?.id ?? null))
  const pool = uniqueQuestions(selectedExam ? [selectedExam] : exams)
  const result = history.find((item) => item.id === review)
  if (session) {
    const question = session.questions[session.index]
    const seconds = Math.max(0, Math.ceil((session.deadline - now) / 1000))
    const flagged = session.flags.includes(question.id)
    const answered = session.questions.filter((q) => session.selections[q.id]?.length).length
    const elapsed = seconds === 0
    const warning = seconds <= 300
    return <>
      <div className="row spread"><h1>Thi thử · {session.title}</h1>
        <button onClick={() => { setActive(''); setReview('') }}>Chọn bộ đề khác</button></div>
      <div className="exam-grid">
        <section className="panel task">
          <div className="row spread">
            <span className="tag">Câu {session.index + 1} / {session.questions.length}</span>
            <button disabled={elapsed} aria-pressed={flagged} onClick={() => save({ ...session, flags: flagged
              ? session.flags.filter((id) => id !== question.id) : [...session.flags, question.id] })}>
              <Flag size={16} /> {flagged ? 'Đã đánh dấu' : 'Xem lại'}
            </button>
          </div>
          <div className="prompt"><Rich content={question.prompt} /></div>
          <p className="muted">{question.type === 'single' ? 'Chọn một đáp án.' : 'Có thể chọn nhiều đáp án.'}</p>
          <Choices key={question.id} question={question} selected={session.selections[question.id] ?? []} reveal={false}
            change={(selection) => save({ ...session, selections: { ...session.selections, [question.id]: selection } })} />
          <div className="row spread">
            <button disabled={elapsed || session.index === 0} onClick={() => save({ ...session, index: session.index - 1 })}>Câu trước</button>
            <button disabled={elapsed || session.index + 1 === session.questions.length} onClick={() => save({ ...session, index: session.index + 1 })}>Câu tiếp</button>
          </div>
        </section>
        <aside className="panel exam-side">
          <div className={'timer-box' + (warning ? ' timer-warning' : '')}>
            <div className="row"><Timer size={18} /> <span>Thời gian còn lại</span></div>
            <strong className="timer">{String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}</strong>
            {warning && <span className="timer-message" role="status">{elapsed ? 'Đã hết giờ' : 'Sắp hết giờ'}</span>}
          </div>
          <p className="mono">{answered}/{session.questions.length} đã trả lời</p>
          <Progress value={answered} total={session.questions.length} label="Số câu đã trả lời" />
          <div className="matrix-filters" role="group" aria-label="Lọc bảng câu hỏi">
            <button aria-pressed={matrixFilter === 'all'} onClick={() => setMatrixFilter('all')}>Tất cả</button>
            <button aria-pressed={matrixFilter === 'unanswered'} onClick={() => setMatrixFilter('unanswered')}>Chưa làm</button>
            <button aria-pressed={matrixFilter === 'flagged'} onClick={() => setMatrixFilter('flagged')}>Gắn cờ</button>
          </div>
          <div className="palette">
            {session.questions.map((q, index) => {
              const marked = session.flags.includes(q.id)
              const done = Boolean(session.selections[q.id]?.length)
              if ((matrixFilter === 'unanswered' && done) || (matrixFilter === 'flagged' && !marked)) return null
              const state = [done ? 'Đã trả lời' : 'Chưa trả lời', marked && 'Đánh dấu xem lại'].filter(Boolean).join(' · ')
              return <button key={q.id} disabled={elapsed} aria-label={'Câu ' + (index + 1) + ' · ' + state} title={state}
                aria-current={index === session.index ? 'step' : undefined}
                className={[done && 'picked', marked && 'flagged'].filter(Boolean).join(' ')}
                onClick={() => save({ ...session, index })}>{index + 1}
                {done && <Check className="palette-check" size={11} aria-hidden="true" />}
                {marked && <Flag className="palette-flag" size={11} aria-hidden="true" />}
              </button>
            })}
          </div>
          {matrixFilter === 'unanswered' && answered === session.questions.length && <p className="muted">Đã trả lời tất cả các câu.</p>}
          {matrixFilter === 'flagged' && !session.flags.length && <p className="muted">Chưa có câu gắn cờ.</p>}
          <div className="palette-legend muted">
            <span><i className="legend-current" /> Đang xem</span><span><Check size={13} /> Đã trả lời</span>
            <span><Flag size={13} /> Xem lại</span><span><i /> Chưa trả lời</span>
          </div>
          <button className="primary full" onClick={() => {
            if (!elapsed) submitDialog.current?.showModal()
            else if (submit(session.id)) setReview(session.id)
          }}>Nộp bài</button>
        </aside>
      </div>
      <dialog ref={submitDialog} className="submit-dialog" aria-labelledby="submit-heading">
        <div className="task">
          <div className="row"><span className="stat-icon purple"><ClipboardCheck size={20} /></span><h2 id="submit-heading">Xác nhận nộp bài</h2></div>
          <p className="muted">Bạn đã trả lời {answered}/{session.questions.length} câu
            {session.flags.length > 0 ? ' và gắn cờ ' + session.flags.length + ' câu' : ''}.</p>
          <div className="row submit-actions">
            <button autoFocus onClick={() => submitDialog.current?.close()}>Tiếp tục làm bài</button>
            <button className="primary" onClick={() => {
              submitDialog.current?.close()
              if (submit(session.id)) setReview(session.id)
            }}>Nộp bài ngay</button>
          </div>
        </div>
      </dialog>
    </>
  }
  if (result) {
    const correct = result.questions.filter((q) => isCorrect(q, result.selections[q.id])).length
    return <>
      <h1>Kết quả thi thử</h1>
      <section className="panel row spread"><div><h2>{result.title}</h2><p>{(correct * 10 / result.questions.length).toFixed(1)} / 10 · {correct}/{result.questions.length} câu đúng</p></div>
        <button onClick={() => setReview('')}>Thi bài mới</button></section>
      {result.questions.map((q, index) => <section className="panel task" key={q.id}>
        <span className="tag">Câu {index + 1}</span>
        <div className="prompt"><Rich content={q.prompt} /></div>
        <Choices question={q} selected={result.selections[q.id] ?? []} reveal change={() => {}} />
        <Feedback question={q} selected={result.selections[q.id] ?? []} slide={slide} />
      </section>)}
    </>
  }
  function resume(item: Session) {
    if (save(item)) { setActive(item.id); setReview(item.id) }
  }
  function confirmReset(item: Session, kind: 'sessions' | 'history') {
    const what = kind === 'sessions' ? 'lượt thi đang làm' : 'lịch sử và kết quả thi'
    if (window.confirm('Xóa ' + what + ' của «' + item.title + '»?')) reset(examScope(item, exams), kind)
  }
  const historyByScope = new Map<string | null, Session[]>()
  for (const item of history.slice().reverse()) {
    const scope = examScope(item, exams)
    const group = historyByScope.get(scope) ?? []
    group.push(item)
    historyByScope.set(scope, group)
  }
  return <>
    <h1>Thi thử</h1>
    <form className="panel task setup" onSubmit={(event) => {
      event.preventDefault()
      if (pending) { resume(pending); return }
      const wanted = count === '' ? pool.length : count
      if (minutes === '' || !Number.isInteger(minutes) || minutes < 1 || minutes > 1440 || !Number.isInteger(wanted) || wanted < 1 || wanted > pool.length) return
      const started = Date.now()
      const questions = (mixQuestions ? shuffle(pool) : pool).slice(0, wanted)
        .map((q) => ({ ...q, options: mixOptions ? shuffle(q.options) : q.options }))
      const id = crypto.randomUUID()
      if (save({ id, examId: selectedExam?.id ?? null, title: selectedExam?.title ?? entireBank, started, deadline: started + minutes * 60000,
        index: 0, questions, flags: [], selections: {} }, true)) { setActive(id); setReview(id) }
    }}>
      <h2>Cấu hình bài thi</h2>
      <label>Bộ đề<select value={source} onChange={(event) => { setSource(event.target.value); setCount('') }}>
        <option value="">{entireBank}</option>{exams.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
      </select></label>
      {selectedExam?.note && <p className="muted">{selectedExam.note}</p>}
      {!pending && <><div className="filters">
        <label>Số câu<input type="number" min={1} max={pool.length} value={count === '' ? pool.length : count}
          onChange={(event) => setCount(event.target.value === '' ? '' : Number(event.target.value))} /></label>
        <label>Thời gian (phút)<input required type="number" min={1} max={1440} value={minutes}
          onChange={(event) => setMinutes(event.target.value === '' ? '' : Number(event.target.value))} /></label>
      </div>
      <div className="row">
        <label className="check"><input type="checkbox" checked={mixQuestions} onChange={(event) => setMixQuestions(event.target.checked)} /> Trộn câu hỏi</label>
        <label className="check"><input type="checkbox" checked={mixOptions} onChange={(event) => setMixOptions(event.target.checked)} /> Trộn đáp án</label>
      </div></>}
      <button disabled={!pending && !pool.length} className="primary">{pending ? 'Tiếp tục bài thi' : 'Bắt đầu thi'}</button>
    </form>
    {sessions.length > 0 && <section className="panel task"><h2>Bài thi đang làm</h2>
      {sessions.map((item) => <div className="row spread" key={item.id}><strong>{item.title}</strong>
        <div className="row"><button onClick={() => resume(item)}>Tiếp tục</button>
          <button onClick={() => confirmReset(item, 'sessions')}>Reset tiến độ thi</button></div>
      </div>)}
    </section>}
    {history.length > 0 && <section className="panel task"><h2>Lịch sử thi</h2>
      {[...historyByScope].map(([scope, items]) => <div key={scope ?? ''}>
        <div className="row spread"><strong>{items[0].title}</strong>
          <button onClick={() => confirmReset(items[0], 'history')}>Xóa lịch sử đề này</button></div>
        {items.map((item) => <button className="history-item" key={item.id} onClick={() => setReview(item.id)}>
          {new Date(item.ended ?? item.deadline).toLocaleString('vi-VN')}
        </button>)}
      </div>)}
    </section>}
  </>
}
