import { useState } from 'react'
import { examAnalytics, formatAccuracy, formatDuration, formatScore, scoreTrend } from '../data/examAnalytics'
import type { Session } from '../data/model'
import { useRoute } from '../routes'
import { completionLabel } from './ExamResult'

export function ExamHistory({ history, chapters, path, remove }: {
  history: Session[]; chapters: Set<string>; path: (item: Session) => string; remove: (item: Session) => void
}) {
  const route = useRoute()
  const [exam, setExam] = useState('')
  const [sort, setSort] = useState('recent')
  const [limit, setLimit] = useState('5')
  const [first, setFirst] = useState('')
  const [second, setSecond] = useState('')
  const group = (item: Session) => item.examId ?? (item.examId === null ? 'all' : 'legacy:' + item.title)
  const groups = new Map(history.map((item) => [group(item), item.title]))
  const items = history.filter((item) => !exam || group(item) === exam)
    .map((item) => ({ item, data: examAnalytics(item, chapters) }))
    .sort((a, b) => (a.item.ended ?? a.item.started) - (b.item.ended ?? b.item.started))
  const recent = limit === 'all' ? items : items.slice(-Number(limit))
  const comparable = recent.length > 0 && recent.every(({ item }) => !!item.examId &&
    item.examId === recent[0].item.examId && item.questions.length === recent[0].item.questions.length)
  const trend = scoreTrend(recent.map(({ data }) => data.score), comparable)
  const sorted = [...items].reverse()
  if (sort === 'old') sorted.reverse()
  if (sort === 'score') sorted.sort((a, b) => (b.data.score ?? -1) - (a.data.score ?? -1))
  const pairA = items.find(({ item }) => item.id === first)
  const pairB = items.find(({ item }) => item.id === second)
  const difference = pairA && pairB && first !== second ? scoreTrend([pairA.data.score, pairB.data.score],
    !!pairA.item.examId && pairA.item.examId === pairB.item.examId && pairA.data.count === pairB.data.count) : undefined
  const date = (at?: number) => at === undefined ? 'Không có ngày nộp' : new Date(at).toLocaleString('vi-VN')
  return <section className="panel task exam-history">
    <div className="row spread"><h2>Lịch sử thi</h2><button onClick={() => route.go('/mock_exam')}>Về sảnh thi</button></div>
    {!history.length && <p>Chưa có bài thi đã nộp.</p>}
    {history.length > 0 && <>
      <div className="filters">
        <label>Lọc bộ đề<select value={exam} onChange={(e) => { setExam(e.target.value); setFirst(''); setSecond('') }}>
          <option value="">Tất cả bộ đề</option>{[...groups].map(([id, title]) => <option key={id} value={id}>{title}</option>)}</select></label>
        <label>Sắp xếp<select value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="recent">Mới nhất</option><option value="old">Cũ nhất</option><option value="score">Điểm cao nhất</option></select></label>
        <label>Khoảng biểu đồ<select value={limit} onChange={(e) => setLimit(e.target.value)}>
          <option value="5">5 lần gần nhất</option><option value="10">10 lần gần nhất</option><option value="all">Toàn bộ</option></select></label>
      </div>
      <h3>Điểm theo thời gian</h3>
      <p className="muted">{recent.filter(({ data }) => data.score !== undefined).length < 2 ? 'Chưa đủ dữ liệu để phân tích xu hướng.'
        : trend === undefined ? 'Các bài khác đề hoặc khác số câu được hiển thị riêng theo thời gian.'
          : 'Thay đổi điểm cùng đề và số câu: ' + (trend > 0 ? '+' : '') + trend.toFixed(1) + ' điểm. Các lần thi có thể dùng câu khác nhau.'}</p>
      <ol className="result-chart">{recent.map(({ item, data }) => <li key={item.id} className="result-group task">
        <div className="row spread"><strong>{item.title}</strong><span className="mono">{formatScore(data.score)}</span></div>
        <small>{date(item.ended)}</small>
        {data.score !== undefined && <meter min={0} max={10} value={data.score} aria-label={'Điểm ' + item.title} />}
      </li>)}</ol>
      <details><summary>So sánh hai lần thi</summary>
        <div className="filters">{([['Lần thi A', first, setFirst], ['Lần thi B', second, setSecond]] as const).map(([label, value, set]) =>
          <label key={label}>{label}<select value={value} onChange={(e) => set(e.target.value)}>
            <option value="">Chọn lần thi</option>{items.map(({ item }) => <option value={item.id} key={item.id}>{item.title} · {date(item.ended)}</option>)}</select></label>)}</div>
        {pairA && pairB && first !== second && <p>{formatScore(pairA.data.score)} → {formatScore(pairB.data.score)}
          {difference === undefined ? ' · Hiển thị hai kết quả riêng.' : ' · Chênh lệch ' + difference.toFixed(1) + ' điểm.'}</p>}
      </details>
      {sorted.map(({ item, data }) => <article className="result-group task" key={item.id}>
        <div className="row spread"><strong>{item.title}</strong><strong className="mono">{formatScore(data.score)}</strong></div>
        <small>{date(item.ended)} · {formatAccuracy(data.accuracy)} · {data.count} câu · {formatDuration(data.used)} · {completionLabel(item)}</small>
        <div className="row"><button onClick={() => route.go(path(item))}>Xem chi tiết</button>
          <button onClick={() => remove(item)}>Xóa lịch sử đề này</button></div>
      </article>)}
    </>}
  </section>
}
