import { academicCatalog } from '../data/academicReview'
import { ChartNoAxesColumn, ClipboardCheck, Clock3, Target } from 'lucide-react'
import { Choices, Feedback, Rich } from '../components/Question'
import { Progress } from '../components/Progress'
import { examAnalytics, formatAccuracy, formatDuration, formatScore, outcomeLabels, reviewIds, smallSample, unclassified, weakGroups } from '../data/examAnalytics'
import type { Material, Session, Study, Subject, Exam } from '../data/model'
import { uniqueQuestions } from '../data/model'
import { learningStats } from '../data/review'
import { useRoute } from '../routes'
import { SourceLinks } from './SourceLinks'
import { curriculum, lessonPath, relatedQuestions } from './curriculumData'

const dateLabel = (at?: number) => at === undefined ? 'Không có dữ liệu' :
  new Date(at).toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'short' })
export const completionLabel = (session: Session) => session.completion === 'timeout' ? 'Tự nộp khi hết giờ'
  : session.completion === 'manual' ? 'Nộp thủ công' : 'Không rõ cách nộp'

export function ExamResult({ session, path, subject, exams, study, materials }: {
  session: Session; path: string; subject: Subject; exams: Exam[]; study: Study; materials: Material[]
}) {
  const route = useRoute()
  const chapters = new Map(subject.theory.map((item) => [item.id, item.title]))
  const topics = academicCatalog(subject).labelByTopic
  const name = (key: string, mode: 'chapter' | 'topic') => mode === 'chapter'
    ? chapters.get(key) ?? 'Chưa phân loại' : topics.get(key) ?? key
  const data = examAnalytics(session, new Set(chapters.keys()))
  const chapter = route.query.get('chapter') ?? ''
  const topic = route.query.get('topic') ?? ''
  const filter = route.query.get('filter') ?? ''
  const filtered = data.rows.filter((row) => (!chapter || row.chapter === chapter) && (!topic || row.topics.includes(topic)) &&
    (!filter || (filter === 'flagged' ? row.flagged : row.outcome === filter)))
  const active = filtered.find((row) => row.question.id === route.query.get('question')) ?? filtered[0]
  const question = active?.question
  const resultQuery = new URLSearchParams(route.query)
  resultQuery.set('session', session.id)
  const returnPath = path.split('?')[0] + '?' + resultQuery
  function apply(patch: Record<string, string>, jump = false) {
    const query = new URLSearchParams(resultQuery)
    query.delete('question')
    for (const [key, value] of Object.entries(patch)) value ? query.set(key, value) : query.delete(key)
    route.go(path.split('?')[0] + '?' + query)
    if (jump) requestAnimationFrame(() => document.getElementById('exam-review')?.scrollIntoView({ block: 'start' }))
  }
  function practice(mode: string, key?: string) {
    const query = new URLSearchParams({ fromExam: session.id, scope: mode, returnTo: returnPath })
    if (key) query.set('group', key)
    route.go('/trainning?' + query)
    window.scrollTo(0, 0)
  }
  function curriculumPath(id?: string) {
    return (id ? '/curriculum/chapter/' + encodeURIComponent(id) : '/curriculum') + '?' + new URLSearchParams({ returnTo: returnPath })
  }
  const weakChapters = weakGroups(data.byChapter)
  const weakTopics = weakGroups(data.byTopic)
  const currentQuestions = uniqueQuestions(exams)
  const due = learningStats(subject.id, currentQuestions, subject.theory, study, Date.now()).forQuestions(currentQuestions).due
  const missed = reviewIds(data.rows, 'missed')
  const suggestions = [
    ...weakChapters.slice(0, 1).map(([id, group]) => ({ title: name(id, 'chapter'), count: group.count,
      reason: formatAccuracy(group.accuracy) + ' đúng trong bài này. Ôn toàn bộ câu thuộc chương trong đề.',
      learn: () => practice('chapter', id), chapter: id })),
    ...weakTopics.slice(0, 1).map(([id, group]) => ({ title: name(id, 'topic'), count: group.count,
      reason: formatAccuracy(group.accuracy) + ' đúng trong nhóm chủ đề của bài này.',
      learn: () => practice('topic', id), chapter: group.rows.find((row) => row.chapter !== unclassified)?.chapter })),
    ...(missed.length ? [{ title: 'Câu sai và bỏ trống', count: missed.length,
      reason: 'Xem lại những câu mất điểm trong bài vừa nộp.',
      learn: () => practice('missed'), chapter: data.rows.find((row) => missed.includes(row.question.id) && row.chapter !== unclassified)?.chapter }] : []),
    ...(due ? [{ title: 'Đến hạn ôn', count: due, reason: 'Các câu đến hạn theo lịch ôn lặp lại.',
      learn: () => route.go('/trainning?review=due&' + new URLSearchParams({ returnTo: returnPath })), chapter: undefined }] : []),
  ].slice(0, 3)
  const lesson = question && curriculum(subject).flatMap((lecture) => lecture.lessons.flatMap((section) => {
    const match = relatedQuestions(lecture, section, [question], materials)[0]
    return match ? [{ lecture, section, rank: match.rank }] : []
  })).sort((a, b) => b.rank - a.rank)[0]

  function breakdown(mode: 'chapter' | 'topic') {
    const groups = mode === 'chapter' ? data.byChapter : data.byTopic
    const keys = mode === 'chapter' ? [...chapters.keys(), ...(groups.has(unclassified) ? [unclassified] : [])] : [...groups.keys()]
    return <section className="panel task"><h2>{mode === 'chapter' ? 'Kết quả theo Lecture' : 'Kết quả theo chủ đề'}</h2>
      {mode === 'topic' && <p className="muted">{keys.length
        ? 'Câu có nhiều nhãn được tính một lần trong mỗi chủ đề. Số câu giữa các chủ đề có thể trùng.'
        : 'Bài thi này chưa có dữ liệu chủ đề.'}</p>}
      {keys.map((id) => {
        const item = groups.get(id)
        const label = name(id, mode)
        return <div key={id} className="result-group task">
          <div className="row spread"><strong>{label}</strong><span className="mono">{!item ? 'Không xuất hiện' : formatAccuracy(item.accuracy)}</span></div>
          {item && <>
            {item.accuracy !== undefined && <Progress value={item.correct} total={item.count} label={'Tỷ lệ đúng · ' + label} />}
            <small>{item.count} câu · {item.correct} đúng · {item.wrong} sai · {item.blank} bỏ trống{item.unknown ? ' · ' + item.unknown + ' thiếu dữ liệu' : ''}</small>
            {item.count < smallSample && <small className="muted">Mẫu nhỏ · nên ôn thêm để có thêm dữ liệu.</small>}
            <div className="row"><button onClick={() => apply({ chapter: '', topic: '', filter: '', [mode]: id }, true)}>Xem các câu</button>
              {item.wrong > 0 && <button onClick={() => apply({ chapter: '', topic: '', filter: 'wrong', [mode]: id }, true)}>Xem câu sai</button>}
              {mode === 'chapter' && id !== unclassified && <button onClick={() => route.go(curriculumPath(id))}>Giáo trình</button>}
            </div>
          </>}
        </div>
      })}
    </section>
  }
  const index = active ? filtered.indexOf(active) : -1
  return <div className="task exam-report">
    <section className="panel result-hero">
      <div><div className="row"><ClipboardCheck size={20} /><span>{completionLabel(session)}</span></div>
        <h1>Kết quả thi thử</h1><h2>{session.title}</h2><p>{dateLabel(data.ended)}</p>
        <p>{data.correct} đúng · {data.wrong} sai · {data.blank} bỏ trống · {data.count} câu</p>
        {data.unknown > 0 && <p>{data.unknown} câu thiếu dữ liệu để tính điểm.</p>}
        <p>Đã dùng {formatDuration(data.used)} · {session.unlimited ? 'Không giới hạn' : 'Giới hạn ' + formatDuration(data.limit)}</p>
      </div>
      <strong className="result-score mono">{formatScore(data.score)}</strong>
    </section>
    <div className="result-kpis">{[
      ['Tỷ lệ đúng', formatAccuracy(data.accuracy)], ['Đúng', data.correct], ['Sai', data.wrong], ['Bỏ trống', data.blank],
      ['Thời gian', formatDuration(data.used)], ['Lecture xuất hiện', data.covered],
    ].map(([title, value]) => <div className="stat task" key={title}><Target size={16} aria-hidden="true" /><span>{title}</span><strong>{value}</strong></div>)}</div>
    <div className="result-columns">{breakdown('chapter')}{breakdown('topic')}</div>
    <section className="panel task"><h2>Bạn nên ôn gì tiếp theo?</h2>
      {!suggestions.length && <p className="muted">Chưa có câu cần đề xuất từ bài này hoặc lịch ôn hiện tại.</p>}
      {suggestions.map((item) => <div key={item.title} className="result-group task">
        <div className="row spread"><strong>{item.title}</strong><span className="tag">{item.count} câu</span></div><p>{item.reason}</p>
        <div className="row"><button onClick={item.learn}>Ôn tập</button><button onClick={() => route.go(curriculumPath(item.chapter))}>Xem giáo trình</button></div>
      </div>)}
    </section>
    <section className="panel task" id="exam-review"><h2><ChartNoAxesColumn size={19} /> Xem lại câu hỏi</h2>
      <div className="filters">
        <label>Trạng thái câu<select value={filter} onChange={(e) => apply({ filter: e.target.value })}>
          <option value="">Tất cả</option><option value="correct">Đúng</option><option value="wrong">Sai</option>
          <option value="blank">Bỏ trống</option><option value="flagged">Đã đánh dấu</option></select></label>
        <label>Lecture<select value={chapter} onChange={(e) => apply({ chapter: e.target.value })}><option value="">Tất cả Lecture</option>
          {[...data.byChapter.keys()].map((key) => <option key={key} value={key}>{name(key, 'chapter')}</option>)}</select></label>
        <label>Chủ đề<select value={topic} onChange={(e) => apply({ topic: e.target.value })}><option value="">Tất cả chủ đề</option>
          {[...data.byTopic.keys()].map((key) => <option key={key} value={key}>{name(key, 'topic')}</option>)}</select></label>
      </div>
      {!active && <p>Không có câu phù hợp.</p>}
      {question && active && <div className="task" key={question.id}>
        <div className="row"><button disabled={index <= 0} onClick={() => apply({ question: filtered[index - 1].question.id })}>Câu trước</button>
          <label>Câu xem lại<select value={question.id} onChange={(e) => apply({ question: e.target.value })}>
            {filtered.map((row) => <option key={row.question.id} value={row.question.id}>Câu {row.index + 1} · {outcomeLabels[row.outcome]}</option>)}</select></label>
          <button disabled={index + 1 >= filtered.length} onClick={() => apply({ question: filtered[index + 1].question.id })}>Câu tiếp</button></div>
        <div className="row"><span className="tag">{outcomeLabels[active.outcome]}</span><span>{name(active.chapter, 'chapter')}</span>{active.flagged && <span className="tag">Đã đánh dấu</span>}</div>
        <div className="prompt"><Rich content={question.prompt} /></div>
        <Choices question={question} selected={active.selected} reveal={active.outcome !== 'unknown'} disabled change={() => {}} />
        <p>Đã chọn <strong className="mono">{active.selected.join(', ') || 'Bỏ trống'}</strong> · Đáp án tham khảo <strong className="mono">{active.outcome !== 'unknown' ? question.answers.join(', ') : 'Không có dữ liệu'}</strong></p>
        {(question.explanation || question.tip || question.formulas?.length) && active.outcome !== 'unknown'
          ? <details><summary>Xem lời giải và mẹo ghi nhớ</summary><Feedback question={question} selected={active.selected} correct={active.outcome === 'correct'} /></details>
          : <p className="muted">Bản chụp không có lời giải hoặc mẹo để hiển thị.</p>}
        <SourceLinks resultLabels target={{ courseId: subject.id, questionId: question.id }} suggestions={question.slides?.map((ref) => ({
          courseId: subject.id, questionId: question.id, documentId: ref.materialId, slideNumber: ref.page,
          verificationStatus: 'suggested', matchingMethod: 'metadata',
        }))} />
        {lesson && <button onClick={() => route.go(lessonPath(lesson.lecture.id, lesson.section.id) + '&' + new URLSearchParams({ returnTo: returnPath }))}>
          {lesson.rank >= 3 ? 'Bài học liên quan' : 'Bài học gợi ý'} · {lesson.section.title}</button>}
      </div>}
    </section>
    <div className="row"><button disabled={!data.wrong} onClick={() => practice('wrong')}>Ôn lại câu sai</button>
      <button disabled={!missed.length} onClick={() => practice('missed')}>Ôn câu sai và bỏ trống</button>
      {weakChapters.length > 0 && <button onClick={() => practice('weak-chapters')}>Ôn chương có điểm thấp</button>}
      {weakTopics.length > 0 && <button onClick={() => practice('weak-topics')}>Ôn chủ đề có điểm thấp</button>}
      <button onClick={() => route.go('/mock_exam?view=history')}><Clock3 size={16} /> Lịch sử thi</button>
      <button onClick={() => route.go('/mock_exam')}>Thi bài mới</button></div>
  </div>
}
