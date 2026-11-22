import { academicCatalog, approvedAnswer } from '../data/academicReview'
import { examAnalytics, reviewIds } from '../data/examAnalytics'
import { SourceLinks } from './SourceLinks'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Bookmark, Clock3, RotateCcw } from 'lucide-react'
import { Choices, Rich } from '../components/Question'
import { isCorrect, toggleOption, uniqueQuestions, type Exam, type PracticeFilters, type Study, type Subject } from '../data/model'
import { examReportReturn, examSlug, findExam, findQuestion, position, useRoute } from '../routes'
import type { Preferences } from '../data/preferences'
import { curriculum, lessonPath, relatedQuestions } from './curriculumData'
import { learningStats, reviewModes, tomorrow, type ReviewMode } from '../data/review'
import { PracticeFeedback, QuestionNotebook } from './PracticeFeedback'
import { StructuredExplanation } from './StructuredExplanation'
import { formatExplanation } from '../data/explanationFormatter'

export function Practice({ subject, exams, study, setStudy, preferences }: {
  subject: Subject; exams: Exam[]; study: Study; setStudy: (change: (study: Study) => Study) => Promise<boolean>
  preferences: Preferences
}) {
  const route = useRoute()
  const lessonKey = route.query.get('lesson')
  const course = useMemo(() => curriculum(subject), [subject])
  const allQuestions = useMemo(() => uniqueQuestions(exams), [exams])
  const materials = [...subject.materials, ...study.materials]
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const tick = () => setNow(Date.now())
    const timer = window.setInterval(tick, 1000 * 30)
    window.addEventListener('focus', tick)
    return () => { window.clearInterval(timer); window.removeEventListener('focus', tick) }
  }, [])
  const stats = learningStats(subject.id, allQuestions, subject.theory, study, now)
  const [lectureId, sectionId] = (lessonKey ?? '').split(':')
  const lecture = course.find((item) => item.id === lectureId)
  const lesson = lecture?.lessons.find((item) => item.id === sectionId)
  const linked = lecture && lesson ? new Set(relatedQuestions(lecture, lesson, allQuestions, materials).map((item) => item.question.id)) : undefined
  const [mode, value] = route.segments
  const examKey = mode === 'exam' ? value : route.query.get('exam') ?? ''
  const rawReview = mode === 'review' ? value : route.query.get('review')
  const review = reviewModes.find(([key]) => key === rawReview)?.[0] ?? 'all'
  const filters: PracticeFilters = {
    exam: findExam(exams, examKey)?.id ?? examKey ?? '',
    chapter: (mode === 'chapter' ? value : route.query.get('chapter')) ?? '',
    topic: route.query.get('topic') ?? '',
    onlyWrong: review !== 'all',
  }
  const { exam, chapter, topic, onlyWrong } = filters
  const selectedExam = exams.find((item) => item.id === exam)
  const fromExam = route.query.get('fromExam')
  const reportReturn = examReportReturn(route.query.get('returnTo'))
  const reviewSession = fromExam ? study.history.find((item) => item.id === fromExam) : undefined
  const requestedIds = reviewSession ? reviewIds(examAnalytics(reviewSession, new Set(subject.theory.map((item) => item.id))).rows,
    route.query.get('scope') ?? '', route.query.get('group') ?? undefined) : []
  const currentBank = new Map(allQuestions.map((item) => [item.id, item]))
  const examPool = requestedIds.flatMap((id) => {
    const item = currentBank.get(id)
    return item ? [item] : []
  })
  const absent = requestedIds.length - examPool.length
  const scope = fromExam ? examPool : (exam ? selectedExam?.questions ?? [] : allQuestions).filter((q) =>
    (!lessonKey || linked?.has(q.id)) && (!chapter || q.chapterId === chapter) && (!topic || q.topics?.includes(topic)),
  )
  const direct = mode === 'question' ? value : route.query.get('question')
  const target = findQuestion(scope, direct ?? undefined)
  const questions = scope.filter((q) => stats.matches(q, review) ||
    (Boolean(direct) && q.id === target?.id && q.id === study.resume && study.practice[q.id]?.correct !== undefined))
  const question = direct ? questions.find((q) => q.id === target?.id) : questions[position(route.query.get('q'), questions.length) ?? 0]
  const unavailablePosition = !direct && route.query.has('q') && questions.length > 0 &&
    position(route.query.get('q'), questions.length) === undefined
  const index = question ? questions.findIndex((q) => q.id === question.id) : -1
  const nextQuestion = questions[index + 1]
  const previousQuestion = questions[index - 1]
  const task = useRef<HTMLElement>(null)
  const advanceTimer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(advanceTimer.current), [question?.id, exam, chapter, topic, review])
  const response = question && study.practice[question.id]
  const draft = response?.selected ?? []
  const graded = response?.correct !== undefined
  const scopeIds = new Set(scope.map((q) => q.id))
  const canReset = Object.keys(study.practice).some((id) => scopeIds.has(id)) ||
    study.attempts.some((attempt) => scopeIds.has(attempt.questionId))
  function filterPath(next: PracticeFilters, id?: string, reviewMode: ReviewMode = review) {
    const query = new URLSearchParams()
    let path = '/trainning'
    if (next.exam) path += '/exam/' + encodeURIComponent(examSlug(next.exam))
    if (next.chapter) {
      if (next.exam) query.set('chapter', next.chapter)
      else path += '/chapter/' + encodeURIComponent(next.chapter)
    }
    if (next.topic) query.set('topic', next.topic)
    if (next.onlyWrong) {
      const key = reviewMode === 'all' ? 'needed' : reviewMode
      if (path === '/trainning' && key !== 'needed') path += '/review/' + key
      else query.set('review', key)
    }
    if (id) query.set('question', id)
    if (lessonKey) query.set('lesson', lessonKey)
    if (reportReturn) query.set('returnTo', reportReturn)
    if (fromExam) {
      query.set('fromExam', fromExam)
      for (const key of ['scope', 'group']) {
        const value = route.query.get(key)
        if (value) query.set(key, value)
      }
    }
    return path + (query.size ? '?' + query : '')
  }
  function changeFilter(change: Partial<PracticeFilters>) {
    const next = { ...filters, ...change }
    setStudy((current) => ({ ...current, practiceFilters: next, resume: undefined, practiceRoute: undefined }))
    route.go(filterPath(next))
  }
  function move(id: string) {
    window.clearTimeout(advanceTimer.current)
    const path = filterPath(filters, id)
    setStudy((current) => ({ ...current, practiceFilters: filters, resume: id, practiceRoute: path }))
    route.go(path)
  }
  function toggleBookmark() {
    if (!question) return
    const id = question.id
    setStudy((current) => ({ ...current, resume: id, practiceFilters: filters, practiceRoute: filterPath(filters, id), bookmarks: current.bookmarks.includes(id)
      ? current.bookmarks.filter((item) => item !== id) : [...current.bookmarks, id] }))
  }
  useEffect(() => {
    if (!preferences.shortcuts) return
    function shortcut(event: KeyboardEvent) {
      if (event.defaultPrevented || event.isComposing || event.repeat || event.ctrlKey || event.metaKey || event.altKey || (event.shiftKey && event.key !== 'B') ||
        document.querySelector('dialog[open]') ||
        (event.target instanceof Element && event.target.closest('input, select, textarea, [contenteditable], [role="textbox"]'))) return
      const destination = event.key === 'ArrowLeft' ? previousQuestion : event.key === 'ArrowRight' ? nextQuestion : undefined
      if (destination) {
        event.preventDefault()
        move(destination.id)
      } else if (question && (event.key === 'B' || (graded && event.key === 'b'))) {
        event.preventDefault()
        toggleBookmark()
      } else if (!graded && /^[1-4a-d]$/i.test(event.key)) {
        const index = /^[1-4]$/.test(event.key) ? Number(event.key) - 1 : event.key.toLowerCase().charCodeAt(0) - 97
        const option = task.current?.querySelectorAll<HTMLInputElement>('.choices input')[index]
        if (option) { event.preventDefault(); option.click() }
      }
    }
    window.addEventListener('keydown', shortcut)
    return () => window.removeEventListener('keydown', shortcut)
  })
  async function saveAnswer(selected: string[], check: boolean, option?: string) {
    if (!question) return
    window.clearTimeout(advanceTimer.current)
    const id = question.id
    let correct: boolean | undefined
    let counted = false
    const path = filterPath(filters, id)
    const saved = await setStudy((current) => {
      if (selected.length && current.practice[id]?.correct !== undefined) return current
      const latest = current.practice[id]?.selected ?? []
      const choices = question.type === 'single' ? selected : option ? toggleOption(latest, option) : check ? latest : selected
      correct = check && choices.length ? isCorrect(question, choices) : undefined
      const practice = { ...current.practice }
      if (choices.length) practice[id] = { selected: choices, correct }
      else delete practice[id]
      counted = correct !== undefined
      const reviewLater = { ...current.reviewLater }
      if (counted) delete reviewLater[id]
      return { ...current, practiceFilters: filters, practiceRoute: path, resume: id, practice, reviewLater,
        attempts: correct === undefined ? current.attempts : [...current.attempts, { questionId: id, correct, at: Date.now() }] }
    })
    if (!saved) return
    if (onlyWrong && !direct && counted) route.go(path, true)
    if (counted && correct && preferences.autoAdvance && nextQuestion) {
      advanceTimer.current = window.setTimeout(() => move(nextQuestion.id), preferences.delay * 1000)
    }
  }
  async function resetScope() {
    const label = [selectedExam?.title, chapter && 'chương ' + chapter, topic && 'chủ đề ' + topic]
      .filter(Boolean).join(' · ')
    if (!window.confirm('Xóa đáp án và lượt ôn trong phạm vi đang chọn' + (label ? ' (' + label + ')' : '') + '?')) return
    window.clearTimeout(advanceTimer.current)
    if (await setStudy((current) => ({
      ...current,
      practice: Object.fromEntries(Object.entries(current.practice).filter(([id]) => !scopeIds.has(id))),
      attempts: current.attempts.filter((attempt) => !scopeIds.has(attempt.questionId)),
      reviewLater: Object.fromEntries(Object.entries(current.reviewLater ?? {}).filter(([id]) => !scopeIds.has(id))),
      practiceFilters: { ...filters, onlyWrong: false },
      resume: scope[0]?.id,
      practiceRoute: undefined,
    }))) route.go(filterPath({ ...filters, onlyWrong: false }))
  }
  const chapters = Array.from(new Set([...subject.theory.map((item) => item.id), ...uniqueQuestions(exams).flatMap((q) => q.chapterId ? [q.chapterId] : [])]))
  const topicNames = useMemo(() => academicCatalog(subject).labelByTopic, [subject])
  const topics = Array.from(new Set([...subject.topics.map((item) => item.id), ...uniqueQuestions(exams).flatMap((q) => q.topics ?? [])]))
  const totals = stats.forQuestions(scope)
  const explanation = question && graded ? formatExplanation(question) : undefined
  const lessonLink = question && graded ? course.flatMap((item) => item.lessons.flatMap((section) => {
    const relation = relatedQuestions(item, section, [question], materials)[0]
    return relation ? [{ item, section, ...relation }] : []
  })).sort((a, b) => b.rank - a.rank)[0] : undefined
  return <>
    <h1>Ôn tập</h1>
    {(fromExam || reportReturn) && <section className="panel row spread">
      <div><strong>{reviewSession ? 'Ôn từ bài thi · ' + reviewSession.title : fromExam ? 'Không tìm thấy bài thi đã nộp' : 'Ôn theo đề xuất sau bài thi'}</strong>
        {reviewSession && <p>{examPool.length}/{requestedIds.length} câu có trong ngân hàng hiện tại.</p>}
        {absent > 0 && <p role="status">{absent} câu trong bản chụp đã thiếu trong ngân hàng. Có thể xem nội dung gốc tại báo cáo thi.</p>}</div>
      {reportReturn && <button onClick={() => route.go(reportReturn)}>Quay lại báo cáo thi</button>}
    </section>}
    {lessonKey && <section className="panel row spread">
      <div><strong>{lesson?.title ?? 'Không tìm thấy mục Giáo trình'}</strong>
        <p className="muted">Chỉ hiển thị câu liên quan đến mục đang học.</p></div>
      <button onClick={() => route.go(lecture && lesson ? lessonPath(lecture.id, lesson.id) : '/curriculum')}>Quay lại bài học</button>
    </section>}
    {!fromExam && <div className="row route-links">
      <button onClick={() => route.go(filterPath({ ...filters, onlyWrong: true }, undefined, 'wrong'))}>Câu sai</button>
      <button onClick={() => route.go(filterPath({ ...filters, onlyWrong: true }, undefined, 'bookmarked'))}>Câu đánh dấu</button>
      {question && <button onClick={() => route.go('/trainning/question/' + encodeURIComponent(question.id))}>Đường dẫn câu hiện tại</button>}
    </div>}
    <details className="panel practice-report">
      <summary>Thống kê ôn tập · {totals.unique} câu đã làm · {totals.due} đến hạn</summary>
      <p>{totals.attempts} lượt · {totals.correct} đúng · {totals.wrong} sai · {totals.firstCorrect} câu đúng lần đầu · {totals.mastered} thành thạo · {totals.needed} cần ôn</p>
      <p>Tỷ lệ đúng: {totals.accuracy === undefined ? 'Chưa đủ dữ liệu' : totals.accuracy + '%'} ·
        Đúng lần đầu: {totals.firstAccuracy === undefined ? 'Chưa đủ dữ liệu' : totals.firstAccuracy + '%'}</p>
      {subject.theory.map((item) => {
        const row = stats.byChapter.get(item.id)!
        return <p key={item.id}>{item.title} · {row.unique} câu đã làm · {row.mastered} thành thạo · {row.due} đến hạn ·
          {row.accuracy === undefined ? ' Chưa đủ dữ liệu đúng/sai' : ' ' + row.accuracy + '% đúng theo lượt'}
          {stats.weak.has(item.id) && ' · Chương yếu'}</p>
      })}
    </details>
    {unavailablePosition && <p className="panel muted">Vị trí câu trong liên kết không có trong bộ lọc này. Đang hiển thị câu đầu tiên.</p>}
    {!fromExam && <div className="panel filters">
      <label>Bộ đề<select value={exam} onChange={(event) => changeFilter({ exam: event.target.value })}><option value="">Tất cả bộ đề</option>
        {exams.map((item) => <option key={item.id} value={item.id}>{item.title}{item.uploaded ? ' · Tự tải lên' : ''}</option>)}</select></label>
      <label>Chương<select value={chapter} onChange={(event) => changeFilter({ chapter: event.target.value })}><option value="">Tất cả chương</option>
        {chapters.map((id) => <option key={id} value={id}>{subject.theory.find((item) => item.id === id)?.title ?? id}</option>)}</select></label>
      <label>Chủ đề<select value={topic} onChange={(event) => changeFilter({ topic: event.target.value })}><option value="">Tất cả chủ đề</option>
        {topics.map((id) => <option key={id} value={id}>{topicNames.get(id) ?? id}</option>)}</select></label>
      <label>Chế độ ôn<select value={review} onChange={(event) => {
        const nextMode = reviewModes.find(([key]) => key === event.target.value)?.[0] ?? 'all'
        const next = { ...filters, onlyWrong: nextMode !== 'all' }
        setStudy((current) => ({ ...current, practiceFilters: next, resume: undefined, practiceRoute: undefined }))
        route.go(filterPath(next, undefined, nextMode))
      }}>{reviewModes.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <button disabled={!canReset} onClick={resetScope}><RotateCcw size={16} /> Reset tiến độ</button>
    </div>}
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
          {!graded && <button type="button" aria-pressed={study.bookmarks.includes(question.id)} onClick={toggleBookmark}>
            <Bookmark size={16} /> {study.bookmarks.includes(question.id) ? 'Đã đánh dấu khó' : 'Đánh dấu khó'}</button>}
        </div>
        {preferences.questionMeta && <p className="mono muted">{question.id} · {subject.theory.find((item) => item.id === question.chapterId)?.title ??
          (question.chapterId ? 'Chương ' + question.chapterId : 'Chưa phân chương')}</p>}
        <div className="prompt"><Rich content={question.prompt} /></div>
        <p className="muted">{question.type === 'single' ? 'Chọn một đáp án.' : 'Chọn tất cả đáp án đúng.'}</p>
        <Choices question={question} selected={draft} reveal={graded} change={(answers, option) => saveAnswer(answers, question.type === 'single', option)} />
        {preferences.shortcuts && <p className="muted shortcut-hint"><kbd>1</kbd>–<kbd>4</kbd> hoặc <kbd>A</kbd>–<kbd>D</kbd> chọn đáp án · <kbd>←</kbd> <kbd>→</kbd> chuyển câu · <kbd>Shift+B</kbd> đánh dấu khó</p>}
        {graded && explanation && <>
          <PracticeFeedback question={question} selected={draft} reviewed={approvedAnswer(question, study.academicReviews?.[question.id])} />
          <StructuredExplanation question={question} formatted={explanation} correct={response?.correct === true}
            explanations={preferences.explanations} tips={preferences.tips} />
          <section className="task practice-sources">
            <h3>Nguồn tham khảo</h3>
            <p className="muted">{subject.theory.find((item) => item.id === question.chapterId)?.title ?? 'Chưa có Lecture xác định'}</p>
            {explanation.source && <div><span className="tag">Nguồn ghi trong lời giải · chưa xác minh</span>
              <Rich content={explanation.source} /></div>}
            {!!question.sourceSlides?.length && <p className="muted">Slide ghi trong dữ liệu: {question.sourceSlides.join(', ')}.</p>}
            <SourceLinks key={question.id} resultLabels target={{ courseId: subject.id, questionId: question.id }}
              onOpen={() => window.clearTimeout(advanceTimer.current)}
              suggestions={question.slides?.map((ref) => ({
                courseId: subject.id, questionId: question.id, documentId: ref.materialId, slideNumber: ref.page,
                verificationStatus: 'suggested', matchingMethod: 'metadata',
              }))} />
          </section>
          <div className="task practice-actions">
            {lessonLink ? <div className="row">
              <button onClick={() => {
                window.clearTimeout(advanceTimer.current)
                route.go(lessonPath(lessonLink.item.id, lessonLink.section.id) + '&' +
                  new URLSearchParams({ returnTo: filterPath(filters, question.id) }))
              }}>Xem lý thuyết liên quan</button>
              <span className="muted">{lessonLink.rank >= 3 ? lessonLink.label : 'Bài học gợi ý'} · {lessonLink.section.title}</span>
            </div> : <p className="muted">Chưa có mục lý thuyết liên quan.</p>}
          </div>
          <QuestionNotebook record={stats.records.get(question.id)} />
          <div className="row practice-actions">
              <button aria-pressed={study.bookmarks.includes(question.id)} onClick={toggleBookmark}>
                {study.bookmarks.includes(question.id) ? 'Đã đánh dấu khó' : 'Đánh dấu khó'}</button>
              <button onClick={() => {
                window.clearTimeout(advanceTimer.current)
                const at = tomorrow(Date.now())
                setStudy((current) => ({ ...current, reviewLater: { ...current.reviewLater, [question.id]: at } }))
              }}><Clock3 size={16} /> Ôn lại sau</button>
          </div>
        </>}
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
