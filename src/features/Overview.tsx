import { formatScore } from '../data/examAnalytics'
import { examScope } from '../data/model'
import { examSlug } from '../routes'
import { Activity, ArrowRight, BookOpen, Bookmark, ChartNoAxesColumn, ClipboardList, GraduationCap, Layers, Play, Target } from 'lucide-react'
import { type Exam, type Study, type Subject } from '../data/model'
import { Progress } from '../components/Progress'
import { useRoute } from '../routes'
import { buildOverview } from './overviewData'

const dateLabel = (value: number) => new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh',
}).format(value)

export function Overview({ subject, exams, study, now }: { subject: Subject; exams: Exam[]; study: Study; now: number }) {
  const route = useRoute()
  function open(path: string) {
    route.go(path)
    window.scrollTo(0, 0)
  }
  const { questions, completed, needsReview, accuracy, average, due, chapters, activity, resume, suggestions, latestExam, examTrend, weakChapter } =
    buildOverview(subject, exams, study, now)
  const stats = [
    { label: 'Tổng câu hỏi', value: questions.length, icon: Layers, color: 'blue' },
    { label: 'Tổng bộ đề', value: exams.length, icon: ClipboardList, color: 'purple' },
    { label: 'Tổng chương', value: chapters.length, icon: BookOpen, color: 'aqua' },
    { label: 'Câu đã ôn', value: completed, icon: GraduationCap, color: 'blue' },
    { label: 'Tỷ lệ đúng khi ôn', value: accuracy === undefined ? undefined : accuracy + '%', icon: Target, color: 'aqua' },
    { label: 'Điểm thi trung bình', value: average === undefined ? undefined : average.toFixed(1) + '/10', icon: ChartNoAxesColumn, color: 'purple' },
    { label: 'Câu cần ôn lại', value: needsReview, icon: Bookmark, color: 'purple' },
  ]
  return <div className="overview-dashboard">
    <header className="row spread overview-heading">
      <div><h1>Tổng quan học tập</h1><p className="muted">Theo dõi tiến độ và tiếp tục học đúng chỗ bạn đã dừng.</p></div>
      <div className="row"><button onClick={() => open('/home/analytics')}>Phân tích kết quả</button>
        <button onClick={() => open('/home/history')}>Lịch sử học tập</button></div>
    </header>

    <section className="panel overview-hero">
      <div className="task">
        <span className="overview-course mono">{subject.code}</span>
        <h2>{subject.title}</h2>
        <p>Ôn câu hỏi, luyện thi và tra cứu giáo trình theo từng chương.</p>
        <div className="row">
          <button className="overview-hero-primary" onClick={() => open(resume.path)}><Play size={16} /> Tiếp tục học</button>
          <button className="overview-hero-secondary" onClick={() => open('/curriculum')}><BookOpen size={16} /> Xem giáo trình</button>
        </div>
      </div>
      <img className="overview-hero-logo" src={import.meta.env.BASE_URL + 'img/logo.jpg'} alt="" width="84" height="84" />
    </section>

    <div className="overview-kpis" aria-label="Chỉ số học tập">
      {[stats.slice(0, 3), stats.slice(3)].map((group, index) => <div className="overview-kpi-group" key={index} aria-label={index === 0 ? 'Ngân hàng và giáo trình' : 'Kết quả học tập'}>
      {group.map(({ label, value, icon: Icon, color }) => <div className="stat overview-kpi" key={label}>
        <span className={'stat-icon ' + color}><Icon size={18} aria-hidden="true" /></span>
        <div><span>{label}</span><strong data-empty={value === undefined}>{value ?? 'Chưa có dữ liệu'}</strong></div>
      </div>)}</div>)}
    </div>

    <div className="overview-columns overview-focus">
      <section className="panel task overview-resume">
        <div className="row spread"><h2>Tiếp tục học</h2><span className="tag">{resume.kind}</span></div>
        <h3>{resume.title}</h3>
        <p className="muted">{resume.position ?? (resume.fresh ? 'Mở chương để bắt đầu học.' : '')}
          {resume.at !== undefined && ' · ' + resume.dateLabel + ' ' + dateLabel(resume.at)}</p>
        <div className="task overview-progress">
          <div className="row spread"><span className="muted">Tiến độ</span><strong className="mono">{resume.value}/{resume.total} {resume.metric}</strong></div>
          <Progress value={resume.value} total={resume.total} label="Tiến độ nội dung đang học" />
        </div>
        <button className="primary" onClick={() => open(resume.path)}>{resume.fresh ? 'Bắt đầu' : 'Tiếp tục'}<ArrowRight size={16} /></button>
      </section>
      <section className="panel task overview-suggestions">
        <h2>Gợi ý học hôm nay</h2>
        {!suggestions.length && <p className="muted">Chưa có câu phù hợp để đề xuất.</p>}
        {suggestions.map((suggestion) => <div className="overview-suggestion" key={suggestion.key}>
          <div><h3>{suggestion.title}</h3><p className="muted">{suggestion.reason}</p></div>
          <span className="tag">{suggestion.count} câu</span>
          <button onClick={() => open(suggestion.path)}>{suggestion.path.startsWith('/curriculum') ? 'Mở chương' : 'Bắt đầu ôn'}</button>
        </div>)}
      </section>
    </div>

    <div className="overview-columns overview-details">
      <section className="panel task overview-roadmap">
        <details open>
          <summary>Lộ trình học <span className="tag">{chapters.length} chương</span></summary>
          {chapters.length === 0 && <p className="muted">Chưa có chương lý thuyết.</p>}
          {chapters.map(({ chapter, total, checked, mastered, path }) => <div className="chapter" key={chapter.id}>
            <div className="chapter-body">
              <h3>{chapter.title}</h3><span className="mono muted">{checked}/{total} câu đã ôn · {mastered} thành thạo</span>
              <Progress value={checked} total={total} label={'Tiến độ ' + chapter.title} />
            </div>
            <button onClick={() => open(path)}>Ôn chương</button>
          </div>)}
        </details>
      </section>
      <div className="side-stack">
        <section className="panel task"><h2>Kết quả thi gần nhất</h2>
          {!latestExam ? <p className="muted">Chưa có bài thi đã nộp.</p> : <>
            <p>{latestExam.item.title} · <strong className="mono">{formatScore(latestExam.data.score)}</strong></p>
            <p className="muted">{examTrend === undefined ? 'Chưa đủ dữ liệu cùng đề và số câu để so sánh.'
              : 'So với lần trước cùng đề và số câu: ' + (examTrend > 0 ? '+' : '') + examTrend.toFixed(1) + ' điểm.'}</p>
            {weakChapter && <button onClick={() => open('/curriculum/chapter/' + encodeURIComponent(weakChapter))}>
              Ôn thêm · {subject.theory.find((item) => item.id === weakChapter)?.title}</button>}
            <button onClick={() => open('/mock_exam/' + encodeURIComponent(examSlug(examScope(latestExam.item, exams) ?? 'all')) +
              '/result?session=' + encodeURIComponent(latestExam.item.id))}>Mở báo cáo thi gần nhất</button>
          </>}
        </section>
        <section className="panel task">
          <h2><Bookmark size={18} /> Cần ôn lại</h2>
          <p className="muted">{needsReview ? needsReview + ' câu sai gần nhất, đã đánh dấu khó hoặc đến hạn. Trong đó có ' + due + ' câu đến hạn.' : 'Chưa có câu cần ôn lại.'}</p>
          {needsReview > 0 && <button onClick={() => open('/trainning?review=needed')}>Ôn lại các câu này</button>}
        </section>
        <section className="panel task">
          <h2><Activity size={18} /> Hoạt động gần đây</h2>
          {!activity.length && <p className="muted">Kết quả ôn và thi sẽ xuất hiện sau lượt học đầu tiên.</p>}
          {activity.map((item) => <div className="activity overview-activity" key={item.id}>
            <div><strong>{item.title}</strong><p className="muted">{item.kind} · {dateLabel(item.at)}</p></div>
            <span className="overview-result" data-tone={item.tone}>{item.status}</span>
            {item.path && <button onClick={() => open(item.path!)} aria-label={'Mở ' + item.title}><ArrowRight size={16} /></button>}
          </div>)}
        </section>
      </div>
    </div>
  </div>
}
