import { examAnalytics, formatScore } from '../data/examAnalytics'
import { examScope, type Exam, type Study, type Subject } from '../data/model'
import { examSlug, useRoute } from '../routes'
import { Progress } from '../components/Progress'

export function LearningReport({ subject, exams, study }: { subject: Subject; exams: Exam[]; study: Study }) {
  const route = useRoute()
  const [view] = route.segments
  const questions = new Map(exams.flatMap((exam) => exam.questions.map((q) => [q.id, q] as const)))
  const byQuestion = new Map(exams.flatMap((exam) => exam.questions.map((q) => [q.id, exam.id] as const)))
  const examTitles = new Map(exams.map((exam) => [exam.id, exam.title]))
  const chapters = new Set(subject.theory.map((chapter) => chapter.id))
  const results = study.history.map((item) => ({ item, data: examAnalytics(item, chapters) }))
  const entries = [...study.attempts.map(({ questionId, correct }) => ({
    correct, blank: false, chapter: questions.get(questionId)?.chapterId, exam: byQuestion.get(questionId),
  })), ...results.flatMap(({ item, data }) => data.rows.filter((row) => row.outcome !== 'unknown').map((row) => ({
    correct: row.outcome === 'correct', blank: row.outcome === 'blank', chapter: chapters.has(row.chapter) ? row.chapter : undefined, exam: examScope(item, exams) ?? undefined,
  })))]
  function bars(key: 'chapter' | 'exam', rows: Array<{ id: string; title: string }>) {
    const known = new Set(rows.map((row) => row.id))
    const extra = new Set(entries.flatMap((entry) => entry[key] && !known.has(entry[key]) ? [entry[key]] : []))
    return [...rows, ...[...extra].map((id) => ({ id, title: id })), { id: '', title: 'Chưa phân loại' }].map(({ id, title }) => {
      const items = entries.filter((entry) => (entry[key] ?? '') === id)
      const correct = items.filter((entry) => entry.correct).length
      const blank = items.filter((entry) => entry.blank).length
      if (!id && !items.length) return null
      return <div className="task report-row" key={id}>
        <div className="row spread"><strong>{title}</strong><span className="mono">{correct} đúng · {items.length - correct - blank} sai · {blank} bỏ trống</span></div>
        <Progress value={correct} total={items.length} label={title + ' · Tỷ lệ đúng'} />
      </div>
    })
  }
  const activity = [
    ...study.attempts.map((attempt, index) => ({
      key: 'practice-' + index, at: attempt.at, title: attempt.questionId,
      status: attempt.correct ? 'Đúng' : 'Sai', path: '/trainning/question/' + encodeURIComponent(attempt.questionId),
    })),
    ...results.map(({ item, data }) => ({
      key: item.id, at: item.ended ?? item.started, title: item.title,
      status: formatScore(data.score),
      path: '/mock_exam/' + encodeURIComponent(item.examId ? examSlug(item.examId) : 'all') + '/result?session=' + encodeURIComponent(item.id),
    })),
  ].sort((a, b) => b.at - a.at)
  if (view !== 'analytics' && view !== 'history') return <section className="panel task">
    <h1>Không tìm thấy báo cáo</h1><button onClick={() => route.go('/home')}>Về tổng quan</button>
  </section>
  return <>
    <h1>{view === 'analytics' ? 'Phân tích kết quả học tập' : 'Lịch sử học tập'}</h1>
    <div className="row route-links"><button onClick={() => route.go('/home')}>Tổng quan</button>
      <button onClick={() => route.go(view === 'analytics' ? '/home/history' : '/home/analytics')}>
        {view === 'analytics' ? 'Lịch sử học tập' : 'Phân tích kết quả'}
      </button>
    </div>
    {view === 'analytics' ? <>
      <p className="muted route-links">Tính từ các lượt kiểm tra đáp án trong Ôn tập và câu hỏi trong bài thi đã nộp.</p>
      <section className="panel task"><h2>Theo chương</h2>{bars('chapter', subject.theory)}</section>
      <section className="panel task"><h2>Theo bộ đề</h2>{bars('exam', [...examTitles].map(([id, title]) => ({ id, title })))}</section>
    </> : <section className="panel task">
      {!activity.length && <p>Chưa có lượt ôn hoặc bài thi đã nộp.</p>}
      {activity.map((item) => <div className="row spread activity" key={item.key}>
        <div><strong>{item.title}</strong><p className="muted">{new Date(item.at).toLocaleString('vi-VN')} · {item.status}</p></div>
        <button onClick={() => route.go(item.path)}>Mở</button>
      </div>)}
    </section>}
  </>
}
