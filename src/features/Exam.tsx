import { useEffect, useRef, useState } from 'react'
import { Check, ClipboardCheck, Flag, Timer } from 'lucide-react'
import { Progress } from '../components/Progress'
import { Choices, Feedback, Rich } from '../components/Question'
import { entireBank, examScope, isCorrect, shuffle, uniqueQuestions, type Exam as ExamData, type Session, type Theory } from '../data/model'
import type { Preferences } from '../data/preferences'
import { examSlug, findExam, position, useRoute } from '../routes'

function balancedSample(pool: Session['questions'], count: number) {
  const chapters = new Map<string, Session['questions']>()
  for (const q of shuffle(pool)) {
    const key = q.chapterId ?? ''
    const group = chapters.get(key) ?? []
    group.push(q)
    chapters.set(key, group)
  }
  const groups = shuffle([...chapters.entries()].filter(([key]) => /^[1-9]$|^10$/.test(key))).map(([, group]) => group)
  const picked: Session['questions'] = []
  for (let index = 0; picked.length < count && groups.some((group) => index < group.length); index++) {
    for (const group of groups) if (group[index] && picked.length < count) picked.push(group[index])
  }
  const included = new Set(picked.map((q) => q.id))
  return shuffle([...picked, ...shuffle(pool.filter((q) => !included.has(q.id))).slice(0, count - picked.length)])
}

export function Exam({ exams, sessions, history, now, save, submit, reset, slide, preferences, chapters }: {
  exams: ExamData[]; sessions: Session[]; history: Session[]; now: number
  save: (session: Session, starting?: boolean) => boolean; submit: (id: string) => boolean
  reset: (scope: string | null, kind: 'sessions' | 'history') => boolean
  slide: (id: string, page: number) => void
  preferences: Preferences
  chapters: Theory[]
}) {
  const route = useRoute()
  const [source, phase, questionNumber] = route.segments
  const preset = source === 'random_50' ? { count: 50, minutes: 45 } : source === 'quick_15' ? { count: 15, minutes: 15 } : undefined
  const [count, setCount] = useState<number | ''>('')
  const [minutes, setMinutes] = useState<number | '' | 'unlimited'>(preferences.minutes)
  const [mixQuestions, setMixQuestions] = useState(preferences.mixQuestions)
  const [mixOptions, setMixOptions] = useState(preferences.mixOptions)
  const [matrixFilter, setMatrixFilter] = useState<'all' | 'unanswered' | 'flagged'>('all')
  const submitDialog = useRef<HTMLDialogElement>(null)
  const questionPanel = useRef<HTMLElement>(null)
  const selectedExam = findExam(exams, source)
  const scopeId = selectedExam?.id ?? (preset ? source : null)
  const sessionKey = route.query.get('session')
  const matchesRoute = (item: Session) => sessionKey ? item.id === sessionKey : examScope(item, exams) === scopeId
  const pending = sessions.find((item) => examScope(item, exams) === scopeId)
  const active = source && phase !== 'result' ? sessions.find(matchesRoute) : undefined
  const session = active && { ...active, index: position(questionNumber, active.questions.length) ?? active.index }
  const pool = uniqueQuestions(selectedExam ? [selectedExam] : exams)
  const result = source && (phase === 'result' || (sessionKey && !session)) ? history.slice().reverse().find(matchesRoute) : undefined
  function sessionPath(item: Session, result = false) {
    const scope = examScope(item, exams)
    return '/mock_exam/' + encodeURIComponent(scope ? examSlug(scope) : 'all') +
      (result ? '/result' : '/q/' + (item.index + 1)) + '?session=' + encodeURIComponent(item.id)
  }
  function move(item: Session, index: number) {
    const next = { ...item, index }
    if (save(next)) route.go(sessionPath(next))
  }
  function submitSession(item: Session) {
    if (submit(item.id)) route.go(sessionPath(item, true), true)
  }
  useEffect(() => {
    if (!preferences.shortcuts || !session) return
    const shortcut = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey ||
        (!session.unlimited && Date.now() >= session.deadline) || document.querySelector('dialog[open]') ||
        (event.target instanceof Element && event.target.closest('input, select, textarea, [contenteditable], [role="textbox"]'))) return
      if (/^[1-4a-d]$/i.test(event.key)) {
        const index = /^[1-4]$/.test(event.key) ? Number(event.key) - 1 : event.key.toLowerCase().charCodeAt(0) - 97
        const option = questionPanel.current?.querySelectorAll<HTMLInputElement>('.choices input')[index]
        if (option) { event.preventDefault(); option.click() }
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        const index = session.index + (event.key === 'ArrowLeft' ? -1 : 1)
        if (index >= 0 && index < session.questions.length) {
          event.preventDefault()
          move(session, index)
        }
      }
    }
    window.addEventListener('keydown', shortcut)
    return () => window.removeEventListener('keydown', shortcut)
  })
  if (session) {
    const question = session.questions[session.index]
    const seconds = Math.max(0, Math.ceil((session.deadline - now) / 1000))
    const flagged = session.flags.includes(question.id)
    const answered = session.questions.filter((q) => session.selections[q.id]?.length).length
    const elapsed = !session.unlimited && seconds === 0
    const warning = !session.unlimited && preferences.warning && seconds <= 300
    return <>
      <div className="row spread"><h1>Thi thử · {session.title}</h1>
        <button onClick={() => route.go('/mock_exam')}>Chọn bộ đề khác</button></div>
      <div className="exam-grid">
        <section className="panel task" ref={questionPanel}>
          <div className="row spread">
            <span className="tag">Câu {session.index + 1} / {session.questions.length}</span>
            <button disabled={elapsed} aria-pressed={flagged} onClick={() => save({ ...session, flags: flagged
              ? session.flags.filter((id) => id !== question.id) : [...session.flags, question.id] })}>
              <Flag size={16} /> {flagged ? 'Đã đánh dấu' : 'Xem lại'}
            </button>
          </div>
          {preferences.questionMeta && <p className="mono muted">{question.id} · {chapters.find((item) => item.id === question.chapterId)?.title ??
            (question.chapterId ? 'Chương ' + question.chapterId : 'Chưa phân chương')}</p>}
          <div className="prompt"><Rich content={question.prompt} /></div>
          <p className="muted">{question.type === 'single' ? 'Chọn một đáp án.' : 'Có thể chọn nhiều đáp án.'}</p>
          <Choices key={question.id} question={question} selected={session.selections[question.id] ?? []} reveal={false} disabled={elapsed}
            change={(selection) => save({ ...session, selections: { ...session.selections, [question.id]: selection } })} />
          <div className="row spread">
            <button disabled={elapsed || session.index === 0} onClick={() => move(session, session.index - 1)}>Câu trước</button>
            <button disabled={elapsed || session.index + 1 === session.questions.length} onClick={() => move(session, session.index + 1)}>Câu tiếp</button>
          </div>
        </section>
        <aside className="panel exam-side">
          <div className={'timer-box' + (warning || elapsed ? ' timer-warning' : '')}>
            <div className="row"><Timer size={18} /> <span>{session.unlimited ? 'Thời gian làm bài' : 'Thời gian còn lại'}</span></div>
            <strong className={session.unlimited ? 'mono' : 'timer'}>{session.unlimited ? 'Không giới hạn' :
              String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0')}</strong>
            {(warning || elapsed) && <span className="timer-message" role="status">{elapsed ? 'Đã hết giờ' : 'Sắp hết giờ'}</span>}
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
                onClick={() => move(session, index)}>{index + 1}
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
            else submitSession(session)
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
              submitSession(session)
            }}>Nộp bài ngay</button>
          </div>
        </div>
      </dialog>
    </>
  }
  if (result) {
    const correct = result.questions.filter((q) => isCorrect(q, result.selections[q.id])).length
    const byChapter = new Map<string | undefined, Session['questions']>()
    for (const q of result.questions) {
      const items = byChapter.get(q.chapterId) ?? []
      items.push(q)
      byChapter.set(q.chapterId, items)
    }
    const onlyWrong = route.query.get('filter') === 'wrong'
    return <>
      <h1>Kết quả thi thử</h1>
      <section className="panel row spread"><div><h2>{result.title}</h2><p>{(correct * 10 / result.questions.length).toFixed(1)} / 10 · {correct}/{result.questions.length} câu đúng</p></div>
        <button onClick={() => route.go('/mock_exam')}>Thi bài mới</button></section>
      <section className="panel task"><h2>Kết quả theo chương</h2>
        <p>Thời gian làm bài: {Math.floor(((result.ended ?? result.deadline) - result.started) / 1000)} giây</p>
        {[...byChapter].map(([chapter, items]) => <p key={chapter ?? ''}>{chapter ? 'Chương ' + chapter : 'Chưa phân chương'} · {items.filter((q) => isCorrect(q, result.selections[q.id])).length}/{items.length} câu đúng</p>)}
        <div className="row"><button aria-pressed={!onlyWrong} onClick={() => route.go(sessionPath(result, true))}>Tất cả câu</button>
          <button aria-pressed={onlyWrong} onClick={() => route.go(sessionPath(result, true) + '&filter=wrong')}>Câu sai</button></div>
      </section>
      {onlyWrong && correct === result.questions.length && <p>Không có câu sai.</p>}
      {result.questions.map((q, index) => onlyWrong && isCorrect(q, result.selections[q.id]) ? null : <section className="panel task" key={q.id}>
        <span className="tag">Câu {index + 1}</span>
        <div className="prompt"><Rich content={q.prompt} /></div>
        <Choices question={q} selected={result.selections[q.id] ?? []} reveal change={() => {}} />
        <Feedback question={q} selected={result.selections[q.id] ?? []} slide={slide} />
      </section>)}
    </>
  }
  if (phase === 'result' || (phase === 'q' && !session) || (source && !selectedExam && !preset && source !== 'all')) {
    return <section className="panel task"><h1>Chưa có bài thi tại đường dẫn này</h1><p>Phiên thi và kết quả được lưu trong trình duyệt đã làm bài.</p><button onClick={() => route.go('/mock_exam')}>Về sảnh thi</button></section>
  }
  function resume(item: Session) {
    route.go(sessionPath(item))
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
    <div className="row route-links">
      <button onClick={() => { setCount(''); route.go('/mock_exam/random_50') }}>Đề ngẫu nhiên · 50 câu / 45 phút</button>
      <button onClick={() => { setCount(''); route.go('/mock_exam/quick_15') }}>Thi nhanh · 15 câu / 15 phút</button>
    </div>
    <form className="panel task setup" onSubmit={(event) => {
      event.preventDefault()
      if (pending) { resume(pending); return }
      const wanted = preset ? Math.min(preset.count, pool.length) : count === '' ? pool.length : count
      const duration = preset?.minutes ?? minutes
      if ((duration !== 'unlimited' && (duration === '' || !Number.isInteger(duration) || duration < 1 || duration > 1440)) ||
        !Number.isInteger(wanted) || wanted < 1 || wanted > pool.length) return
      const started = Date.now()
      const questions = (preset ? balancedSample(pool, wanted) : (mixQuestions ? shuffle(pool) : pool).slice(0, wanted))
        .map((q) => ({ ...q, options: mixOptions ? shuffle(q.options) : q.options }))
      const id = crypto.randomUUID()
      const item = { id, examId: scopeId, title: selectedExam?.title ?? (preset ? 'Đề ngẫu nhiên · ' + preset.count + ' câu' : entireBank),
        started, deadline: duration === 'unlimited' ? 8_640_000_000_000_000 : started + duration * 60000,
        unlimited: duration === 'unlimited', autoSubmit: preferences.autoSubmit, index: 0, questions, flags: [], selections: {} }
      if (save(item, true)) route.go(sessionPath(item))
    }}>
      <h2>Cấu hình bài thi</h2>
      <label>Bộ đề<select value={selectedExam?.id ?? (preset ? source : '')} onChange={(event) => {
        const value = event.target.value
        setCount('')
        route.go('/mock_exam' + (value ? '/' + encodeURIComponent(examSlug(value)) : ''))
      }}>
        <option value="">{entireBank}</option>{exams.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
        <option value="random_50">Đề ngẫu nhiên · 50 câu</option><option value="quick_15">Thi nhanh · 15 câu</option>
      </select></label>
      {selectedExam?.note && <p className="muted">{selectedExam.note}</p>}
      {preset && <p className="mono">{Math.min(preset.count, pool.length)} câu · {preset.minutes} phút</p>}
      {!pending && !preset && <><div className="filters">
        <label>Số câu<input type="number" min={1} max={pool.length} value={count === '' ? pool.length : count}
          onChange={(event) => setCount(event.target.value === '' ? '' : Number(event.target.value))} /></label>
        {minutes !== 'unlimited' && <label>Thời gian (phút)<input required type="number" min={1} max={1440} value={minutes}
          onChange={(event) => setMinutes(event.target.value === '' ? '' : Number(event.target.value))} /></label>
        }
        <label className="check"><input type="checkbox" checked={minutes === 'unlimited'} onChange={(event) => setMinutes(event.target.checked ? 'unlimited' :
          preferences.minutes === 'unlimited' ? 30 : preferences.minutes)} /> Không giới hạn thời gian</label>
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
        {items.map((item) => <button className="history-item" key={item.id} onClick={() => route.go(sessionPath(item, true))}>
          {new Date(item.ended ?? item.deadline).toLocaleString('vi-VN')}
        </button>)}
      </div>)}
    </section>}
  </>
}
