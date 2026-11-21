import { BookOpen, ClipboardList, GraduationCap, Layers, Target, Bookmark } from 'lucide-react'
import { isCorrect, uniqueQuestions, type Exam, type Material, type Study, type Subject } from '../data/model'

export function Overview({ subject, exams, study, materials, resume, practice, library }: {
  subject: Subject; exams: Exam[]; study: Study; materials: Material[]
  resume: () => void; practice: (chapterId?: string, wrong?: boolean) => void; library: () => void
}) {
  const questions = uniqueQuestions(exams)
  const marks = new Map(study.attempts.map((attempt) => [attempt.questionId, attempt.correct]))
  const scores = study.history.map((item) => item.questions.filter((q) => isCorrect(q, item.selections[q.id])).length * 10 / item.questions.length)
  const needsReview = questions.filter((q) => marks.get(q.id) === false || study.bookmarks.includes(q.id)).length
  const rate = study.attempts.length ? Math.round(study.attempts.filter((item) => item.correct).length * 100 / study.attempts.length) + '%' : '—'
  const stats = [
    { label: 'Tổng câu hỏi', value: questions.length, icon: Layers, color: 'blue' },
    { label: 'Bộ đề', value: exams.length, icon: ClipboardList, color: 'purple' },
    { label: 'Giáo trình', value: materials.length, icon: BookOpen, color: 'aqua' },
    { label: 'Câu đã ôn', value: marks.size, icon: GraduationCap, color: 'blue' },
    { label: 'Tỷ lệ đúng khi ôn', value: rate, icon: Target, color: 'aqua' },
    { label: 'Điểm thi trung bình', value: scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) + '/10' : '—', icon: Bookmark, color: 'purple' },
  ]
  const activity = [
    ...study.attempts.map((item, index) => ({ id: 'practice-' + index, title: 'Ôn câu ' + item.questionId, status: item.correct ? 'Đúng' : 'Sai', at: item.at })),
    ...study.history.map((item, index) => ({ id: item.id, title: 'Thi thử · ' + item.title, status: scores[index].toFixed(1) + '/10', at: item.ended ?? item.deadline })),
  ].sort((a, b) => b.at - a.at).slice(0, 5)
  return <>
    <h1>Tổng quan môn học</h1>
    <section className="hero">
      <div className="hero-copy">
        <span className="hero-code">{subject.code}</span>
        <h2>{subject.title}</h2>
        <div className="row"><button className="hero-primary" onClick={resume}>Tiếp tục học</button><button className="hero-secondary" onClick={library}>Xem lý thuyết</button></div>
      </div>
      <div className="hero-art" aria-hidden="true"><BookOpen strokeWidth={1.15} /></div>
    </section>
    <div className="stats">{stats.map(({ label, value, icon: Icon, color }) =>
      <div className="stat" key={label}><span className={'stat-icon ' + color}><Icon size={19} /></span><div><strong>{value}</strong><span>{label}</span></div></div>)}</div>
    <div className="overview-grid">
      <section className="panel task">
        <div className="row spread"><h2>Lộ trình học</h2><span className="muted">{subject.theory.length} chương</span></div>
        {subject.theory.length === 0 && <p className="muted">Môn này chưa có lý thuyết theo chương.</p>}
        {subject.theory.map((chapter) => <div className="chapter" key={chapter.id}>
          <div><strong>{chapter.title}</strong>{chapter.summary && <p className="muted">{chapter.summary}</p>}</div>
          <button onClick={() => practice(chapter.id)}>Ôn chương</button>
        </div>)}
      </section>
      <div className="side-stack">
        <section className="panel task"><h2>Cần ôn lại</h2>
          <p className="muted">{needsReview ? needsReview + ' câu trả lời sai gần nhất hoặc được đánh dấu khó.' : 'Chưa có câu cần ôn lại.'}</p>
          {needsReview > 0 && <button onClick={() => practice(undefined, true)}>Ôn lại các câu này</button>}
        </section>
        <section className="panel task"><h2>Hoạt động gần đây</h2>
          {!activity.length && <p className="muted">Hoạt động học của bạn sẽ xuất hiện tại đây.</p>}
          {activity.map((item) => <div className="activity" key={item.id}><strong>{item.title}</strong>
            <span className="muted">{item.status} · {new Date(item.at).toLocaleString('vi-VN')}</span>
          </div>)}
        </section>
      </div>
    </div>
  </>
}
