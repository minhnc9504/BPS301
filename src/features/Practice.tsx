import { useEffect, useRef } from 'react'
import { Bookmark, RotateCcw } from 'lucide-react'
import { Choices, Feedback, Rich } from '../components/Question'
import { isCorrect, uniqueQuestions, type Exam, type PracticeFilters, type Study, type Subject } from '../data/model'

export function Practice({ subject, exams, study, setStudy, slide }: {
  subject: Subject; exams: Exam[]; study: Study; setStudy: (change: (study: Study) => Study) => boolean
  slide: (id: string, page: number) => void
}) {
  const filters = study.practiceFilters ?? { exam: '', chapter: '', topic: '', onlyWrong: false }
  const { exam, chapter, topic, onlyWrong } = filters
  const selectedExam = exams.find((item) => item.id === exam)
  const last = new Map(study.attempts.map((attempt) => [attempt.questionId, attempt.correct]))
  const scope = uniqueQuestions(exam ? exams.filter((item) => item.id === exam) : exams).filter((q) =>
    (!chapter || q.chapterId === chapter) && (!topic || q.topics?.includes(topic)),
  )
  const questions = scope.filter((q) =>
    !onlyWrong || last.get(q.id) === false || study.bookmarks.includes(q.id) ||
    (q.id === study.resume && study.practice[q.id]?.correct !== undefined),
  )
  const question = questions.find((q) => q.id === study.resume) ?? questions[0]
  const index = question ? questions.findIndex((q) => q.id === question.id) : -1
  const nextQuestion = questions[index + 1]
  const previousQuestion = questions[index - 1]
  const task = useRef<HTMLElement>(null)
  const response = question && study.practice[question.id]
  const draft = response?.selected ?? []
  const graded = response?.correct !== undefined
  const scopeIds = new Set(scope.map((q) => q.id))
  const canReset = Object.keys(study.practice).some((id) => scopeIds.has(id)) ||
    study.attempts.some((attempt) => scopeIds.has(attempt.questionId))
  function changeFilter(change: Partial<PracticeFilters>) {
    setStudy((current) => ({ ...current, practiceFilters: { ...filters, ...change }, resume: undefined }))
  }
  function move(id: string) { setStudy((current) => ({ ...current, resume: id })) }
  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if (event.defaultPrevented || event.isComposing || event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey ||
        document.querySelector('dialog[open]') ||
        (event.target instanceof Element && event.target.closest('input, select, textarea, [contenteditable], [role="textbox"]'))) return
      const destination = event.key === 'ArrowLeft' ? previousQuestion : event.key === 'ArrowRight' ? nextQuestion : undefined
      if (destination) {
        event.preventDefault()
        setStudy((current) => ({ ...current, resume: destination.id }))
      } else if (!graded && /^[1-4]$/.test(event.key)) {
        const option = task.current?.querySelectorAll<HTMLInputElement>('.choices input')[Number(event.key) - 1]
        if (option) { event.preventDefault(); option.click() }
      }
    }
    window.addEventListener('keydown', shortcut)
    return () => window.removeEventListener('keydown', shortcut)
  }, [graded, previousQuestion, nextQuestion, setStudy])
  function saveAnswer(selected: string[], check: boolean) {
    if (!question) return
    const id = question.id
    const correct = check ? isCorrect(question, selected) : undefined
    setStudy((current) => {
      const practice = { ...current.practice }
      if (selected.length) practice[id] = { selected, correct }
      else delete practice[id]
      return { ...current, resume: id, practice, attempts: correct === undefined ? current.attempts :
        [...current.attempts, { questionId: id, correct, at: Date.now() }] }
    })
  }
  function resetScope() {
    const label = [selectedExam?.title, chapter && 'chương ' + chapter, topic && 'chủ đề ' + topic]
      .filter(Boolean).join(' · ')
    if (!window.confirm('Xóa đáp án và lượt ôn trong phạm vi đang chọn' + (label ? ' (' + label + ')' : '') + '?')) return
    setStudy((current) => ({
      ...current,
      practice: Object.fromEntries(Object.entries(current.practice).filter(([id]) => !scopeIds.has(id))),
      attempts: current.attempts.filter((attempt) => !scopeIds.has(attempt.questionId)),
      practiceFilters: { ...filters, onlyWrong: false },
      resume: scope[0]?.id,
    }))
  }
  const chapters = Array.from(new Set([...subject.theory.map((item) => item.id), ...uniqueQuestions(exams).flatMap((q) => q.chapterId ? [q.chapterId] : [])]))
  const topics = Array.from(new Set([...subject.topics.map((item) => item.id), ...uniqueQuestions(exams).flatMap((q) => q.topics ?? [])]))
  return <>
    <h1>Ôn tập</h1>
    <div className="panel filters">
      <label>Bộ đề<select value={exam} onChange={(event) => changeFilter({ exam: event.target.value })}><option value="">Tất cả bộ đề</option>
        {exams.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
      <label>Chương<select value={chapter} onChange={(event) => changeFilter({ chapter: event.target.value })}><option value="">Tất cả chương</option>
        {chapters.map((id) => <option key={id} value={id}>{subject.theory.find((item) => item.id === id)?.title ?? id}</option>)}</select></label>
      <label>Chủ đề<select value={topic} onChange={(event) => changeFilter({ topic: event.target.value })}><option value="">Tất cả chủ đề</option>
        {topics.map((id) => <option key={id} value={id}>{subject.topics.find((item) => item.id === id)?.title ?? id}</option>)}</select></label>
      <label className="check"><input type="checkbox" checked={onlyWrong} onChange={(event) => changeFilter({ onlyWrong: event.target.checked })} /> Cần ôn lại</label>
      <button disabled={!canReset} onClick={resetScope}><RotateCcw size={16} /> Reset tiến độ</button>
    </div>
    {selectedExam?.note && <p className="panel muted">{selectedExam.note}</p>}
    {questions.length > 0 && <section className="panel practice-strip" aria-label="Tiến độ ôn tập">
      <div className="row spread"><strong>Tiến độ phiên</strong><span className="mono muted">{questions.filter((item) => study.practice[item.id]?.correct !== undefined).length}/{questions.length} câu đã kiểm tra</span></div>
      <div className="practice-segments">
        {questions.map((item, position) => {
          const correct = study.practice[item.id]?.correct
          const state = correct === undefined ? 'Chưa kiểm tra' : correct ? 'Đúng' : 'Sai'
          return <button key={item.id} type="button" data-result={correct}
            aria-current={item.id === question?.id ? 'step' : undefined}
            aria-label={'Câu ' + (position + 1) + ' · ' + state}
            title={'Câu ' + (position + 1) + ' · ' + state} onClick={() => move(item.id)}>
            <span aria-hidden="true">{position + 1}</span>
          </button>
        })}
      </div>
    </section>}
    {!question ? <div className="panel empty">Không có câu hỏi phù hợp với bộ lọc.</div> :
      <section className="panel task" ref={task}>
        <div className="row spread"><span className="tag">{index < 0 ? question.id : 'Câu ' + (index + 1) + ' / ' + questions.length}</span>
          <button type="button" aria-pressed={study.bookmarks.includes(question.id)} onClick={() => {
            setStudy((current) => ({ ...current, resume: question.id, bookmarks: current.bookmarks.includes(question.id)
              ? current.bookmarks.filter((id) => id !== question.id) : [...current.bookmarks, question.id] }))
          }}><Bookmark size={16} /> {study.bookmarks.includes(question.id) ? 'Đã đánh dấu khó' : 'Đánh dấu khó'}</button>
        </div>
        <div className="prompt"><Rich content={question.prompt} /></div>
        <p className="muted">{question.type === 'single' ? 'Chọn một đáp án.' : 'Chọn tất cả đáp án đúng.'}</p>
        <Choices question={question} selected={draft} reveal={graded} change={(answers) => saveAnswer(answers, question.type === 'single')} />
        <p className="muted shortcut-hint"><kbd>1</kbd>–<kbd>4</kbd> chọn đáp án · <kbd>←</kbd> <kbd>→</kbd> chuyển câu</p>
        {graded && <Feedback question={question} selected={draft} correct={response?.correct} slide={slide} />}
        <div className="row spread"><div className="row">
          <button disabled={index <= 0} onClick={() => move(questions[index - 1].id)}>Câu trước</button>
          <button disabled={!nextQuestion} onClick={() => nextQuestion && move(nextQuestion.id)}>Câu tiếp</button>
        </div>
        <div className="row">
          {draft.length > 0 && <button onClick={() => saveAnswer([], false)}><RotateCcw size={16} /> Làm lại</button>}
          {!graded && question.type === 'multiple' && <button className="primary" disabled={!draft.length}
            onClick={() => saveAnswer(draft, true)}>Kiểm tra đáp án</button>}
        </div>
        </div>
      </section>}
  </>
}
