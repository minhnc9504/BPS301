import { useContext, useEffect, useMemo, useState } from 'react'
import { useRoute } from '../routes'
import { Rich } from '../components/Question'
import { academicCatalog, answerReviewStates, approvedAnswer, checkedAnswerKey, validateAcademicMetadata, type AcademicProposal, type AcademicReview, type AnswerReviewState } from '../data/academicReview'
import { type Exam, type Question, type Study, type Subject } from '../data/model'
import { asset, message } from '../data/storage'
import { SourceContext } from './SourceLinks'

const states: Record<AnswerReviewState, string> = {
  unreviewed: 'Chưa kiểm định', suggested: 'Có đề xuất', 'needs-review': 'Cần xem lại',
  verified: 'Đã kiểm định', disputed: 'Tranh chấp đáp án',
}
const confidence = { none: 'Chưa đủ căn cứ', low: 'Thấp', medium: 'Trung bình' } as const
const fields = { chapter: 'Lecture', topic: 'Chủ đề', tip: 'Mẹo', source: 'Nguồn đã xác minh' } as const

function csvCell(value: string) {
  return '"' + (/^[=+\-@\t\r]/.test(value.trimStart()) ? "'" + value : value).replaceAll('"', '""') + '"'
}

export function ContentQuality({ subject, exams, study, save }: {
  subject: Subject; exams: Exam[]; study: Study; save: (change: (current: Study) => Study) => Promise<boolean>
}) {
  const route = useRoute()
  const [proposals, setProposals] = useState<Record<string, AcademicProposal>>()
  const [loadError, setLoadError] = useState('')
  const [filters, setFilters] = useState({ exam: '', chapter: '', status: '', confidence: '', missing: '' })
  const [selected, select] = useState('')
  const [limit, setLimit] = useState(30)
  const catalog = useMemo(() => academicCatalog(subject), [subject])
  useEffect(() => {
    const controller = new AbortController()
    void fetch(asset('data/bps301/academic-proposals.json'), { signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error('Không tải được hàng đợi đề xuất.')
      const data = await response.json()
      if (data.version !== 1 || !data.proposals || typeof data.proposals !== 'object') throw new Error('Định dạng đề xuất không hợp lệ.')
      setProposals(data.proposals)
    }).catch((error) => { if (!controller.signal.aborted) setLoadError(message(error)) })
    return () => controller.abort()
  }, [])
  const verifiedSources = new Set(study.sourceLinks?.filter((link) => link.verificationStatus === 'verified').map((link) => link.questionId))
  const rows = exams.flatMap((exam) => exam.questions.map((question) => {
    const proposal = proposals?.[question.id]
    const review = study.academicReviews?.[question.id]
    const state = review?.answer === 'verified' && !approvedAnswer(question, review) ? 'needs-review'
      : review?.answer ?? (proposal?.needsReview ? 'needs-review' : proposal && (proposal.chapterId || proposal.topics?.length || proposal.tip || proposal.slide) ? 'suggested' : 'unreviewed')
    return { exam, question, proposal, review, state, missing: {
      chapter: !catalog.chapters.has(question.chapterId ?? ''), topic: !question.topics?.length,
      tip: !question.tip, source: !verifiedSources.has(question.id),
    } }
  }))
  const visible = rows.filter((row) => (!filters.exam || row.exam.id === filters.exam) &&
    (!filters.chapter || (filters.chapter === 'missing' ? row.missing.chapter : row.question.chapterId === filters.chapter)) &&
    (!filters.status || row.state === filters.status) && (!filters.confidence || (row.proposal?.confidence ?? 'none') === filters.confidence) &&
    (!filters.missing || row.missing[filters.missing as keyof typeof fields]))
  const active = rows.find((row) => row.question.id === selected)
  const controls = [
    ['exam', 'Bộ đề', exams.map((exam) => [exam.id, exam.title])],
    ['chapter', 'Lecture', [['missing', 'Chưa phân loại'], ...subject.theory.map((item) => [item.id, item.title])]],
    ['status', 'Trạng thái đáp án', Object.entries(states)],
    ['confidence', 'Độ tin cậy đề xuất', Object.entries(confidence)],
    ['missing', 'Thiếu dữ liệu', Object.entries(fields)],
  ] as const
  function exportCsv() {
    const header = ['question_id', 'exam_id', 'lecture', 'answer_review', 'confidence', 'decision', 'source_verified', 'evidence', 'review_note']
    const records = visible.map((row) => [row.question.id, row.exam.id, row.question.chapterId ?? '', row.state,
      row.proposal?.confidence ?? 'none', row.review?.decision ?? 'pending', String(!row.missing.source), row.proposal?.evidence ?? '', row.review?.note ?? ''])
    const url = URL.createObjectURL(new Blob(['\ufeff' + [header, ...records].map((row) => row.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'bpms-content-quality.csv'
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return <div className="task">
    <section className="panel task"><div className="row spread"><h1>Kiểm định nội dung</h1>
      <button onClick={() => route.go('/question_bank')}>Về ngân hàng</button></div>
      <p className="muted">Quyết định lưu trên trình duyệt. Chỉ người có thẩm quyền kiểm định đáp án sau khi đọc bằng chứng. Nguồn slide và trạng thái đáp án được quản lý riêng.</p>
      <div className="row">
        <span className="tag">{rows.length} câu hỏi</span>
        {Object.entries(fields).map(([key, name]) => <span className="tag" key={key}>{rows.filter((row) => row.missing[key as keyof typeof fields]).length} thiếu {name}</span>)}
        {(['verified', 'needs-review', 'disputed'] as const).map((key) => <span className="tag" key={key}>{rows.filter((row) => row.state === key).length} {states[key].toLowerCase()}</span>)}
      </div>
      {!proposals && !loadError && <p role="status">Đang tải đề xuất…</p>}
      {loadError && <p role="alert">{loadError}</p>}
      <div className="filters">{controls.map(([key, label, options]) => <label key={key}>{label}
        <select value={filters[key]} onChange={(event) => { setFilters({ ...filters, [key]: event.target.value }); setLimit(30) }}>
          <option value="">Tất cả</option>{options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
        </select></label>)}</div>
      <div className="row spread"><span>{visible.length} câu phù hợp</span><button onClick={exportCsv}>Xuất báo cáo CSV</button></div>
    </section>
    {active && <ReviewEditor key={active.question.id} subject={subject} question={active.question} proposal={active.proposal}
      review={active.review} save={save} close={() => select('')} />}
    <section className="panel task" aria-label="Danh sách kiểm định">
      {visible.slice(0, limit).map((row) => <div key={row.question.id} className="row spread quality-row">
        <div><strong>{row.question.code ?? row.question.id}</strong><Rich content={row.question.prompt} />
          <small>{states[row.state]} · {confidence[row.proposal?.confidence ?? 'none']}</small></div>
        <button disabled={!proposals && !loadError} aria-pressed={selected === row.question.id} onClick={() => {
          select(row.question.id)
          requestAnimationFrame(() => document.getElementById('academic-review-editor')?.scrollIntoView({ block: 'start' }))
        }}>Duyệt {row.question.id}</button>
      </div>)}
      {visible.length > limit && <button onClick={() => setLimit(limit + 30)}>Xem thêm</button>}
    </section>
  </div>
}

function ReviewEditor({ subject, question, proposal, review, save, close }: {
  subject: Subject; question: Question; proposal?: AcademicProposal; review?: AcademicReview
  save: (change: (current: Study) => Study) => Promise<boolean>; close: () => void
}) {
  const source = useContext(SourceContext)
  const route = useRoute()
  const catalog = academicCatalog(subject)
  const [chapter, setChapter] = useState(review?.chapterId ?? proposal?.chapterId ??
    (catalog.chapters.has(question.chapterId ?? '') ? question.chapterId : '') ?? '')
  const [topics, setTopics] = useState(review?.topics ?? proposal?.topics ?? question.topics ?? [])
  const [tip, setTip] = useState(review?.tip ?? proposal?.tip ?? '')
  const [documentId, setDocumentId] = useState(review?.slide?.materialId ?? proposal?.slide?.materialId ?? '')
  const [page, setPage] = useState(String(review?.slide?.page ?? proposal?.slide?.page ?? ''))
  const [answer, setAnswer] = useState<AnswerReviewState>(approvedAnswer(question, review) ? 'verified'
    : review?.answer === 'verified' ? 'needs-review' : review?.answer ?? (proposal?.needsReview ? 'needs-review' : 'unreviewed'))
  const [note, setNote] = useState(review?.note ?? '')
  const [inspected, setInspected] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [status, setStatus] = useState('')
  const [saving, setSaving] = useState(false)
  const canOpen = !!documentId && Number.isSafeInteger(Number(page)) && Number(page) >= 1 &&
    Number(page) <= (catalog.pages.get(documentId) ?? 0)
  async function persist(decision?: AcademicReview['decision'], verified = false) {
    setSaving(true)
    setStatus('')
    try {
      const nextAnswer = verified ? 'verified' : answer
      if (verified && (!inspected || !confirmed || !note.trim())) return
      const previousKey = review?.answerKey
      const metadata = { chapterId: chapter || undefined, topics: topics.length ? topics : undefined,
        tip: tip.trim() || undefined, slide: documentId ? { materialId: documentId, page: Number(page) } : undefined }
      const next: AcademicReview = {
        ...metadata, decision: decision ?? review?.decision ?? 'pending',
        answer: nextAnswer, note: note.trim() || undefined,
        answerKey: verified ? checkedAnswerKey(question) : nextAnswer === 'verified' ? previousKey : undefined,
      }
      // A status-only change must not replace metadata that a reviewer already accepted.
      if (!decision && review?.decision === 'accepted') {
        Object.assign(next, { chapterId: review.chapterId, topics: review.topics, tip: review.tip, slide: review.slide })
      }
      const error = validateAcademicMetadata(next, catalog.chapters, catalog.topics, catalog.pages)
      if (error) { setStatus(error); return }
      if (await save((current) => ({ ...current, academicReviews: { ...current.academicReviews, [question.id]: next } }))) {
        if (verified) setAnswer('verified')
        setStatus('Đã lưu kiểm định cục bộ.')
      } else setStatus('Chưa lưu được kiểm định.')
    } finally { setSaving(false) }
  }
  return <section className="panel task" id="academic-review-editor">
    <div className="row spread"><h2>{question.id}</h2><div className="row"><button onClick={() => route.go('/question_bank/detail/' + encodeURIComponent(question.id))}>
        Quản lý xác minh nguồn</button><button onClick={close}>Đóng mục duyệt</button></div></div>
    <Rich content={question.prompt} />
    <ul>{question.options.map((item) => <li key={item.id}>{item.id}{question.answers.includes(item.id) && ' · Đáp án đang dùng'}<Rich content={item.content} /></li>)}</ul>
    {question.explanation && <details><summary>Lời giải gốc</summary><Rich content={question.explanation} /></details>}
    {proposal && <p>{proposal.evidence} {proposal.visualCheck && 'Cần kiểm tra hình hoặc sơ đồ trực tiếp.'}</p>}
    <div className="filters">
      <label>Lecture đề xuất<select value={chapter} onChange={(event) => setChapter(event.target.value)}><option value="">Giữ nguyên</option>
        {subject.theory.map((item) => <option value={item.id} key={item.id}>{item.title}</option>)}</select></label>
      <label>Chủ đề đề xuất<select multiple value={topics} onChange={(event) => setTopics(Array.from(event.target.selectedOptions, (option) => option.value))}>
        {[...catalog.labelByTopic].map(([id, title]) => <option value={id} key={id}>{title}</option>)}</select></label>
    </div>
    <label>Mẹo đề xuất<textarea value={tip} maxLength={1000} onChange={(event) => setTip(event.target.value)} /></label>
    <div className="filters">
      <label>PDF tham khảo<select value={documentId} onChange={(event) => { setDocumentId(event.target.value); setInspected(false) }}>
        <option value="">Chưa có PDF</option>{[...catalog.pages.keys()].map((id) => <option value={id} key={id}>{subject.materials.find((item) => item.id === id)?.file?.split('/').at(-1) ?? id}</option>)}</select></label>
      <label>Trang PDF<input type="number" min="1" value={page} onChange={(event) => { setPage(event.target.value); setInspected(false) }} /></label>
      <button disabled={!canOpen || !source} onClick={() => source?.open(documentId, Number(page), (shown) => {
        if (shown === Number(page)) setInspected(true)
      })}>Mở trang PDF</button>
    </div>
    <label>Trạng thái đáp án<select value={answer} onChange={(event) => setAnswer(event.target.value as AnswerReviewState)}>
      {answerReviewStates.filter((item) => item !== 'verified' || answer === 'verified').map((item) => <option key={item} value={item}>{states[item]}</option>)}
    </select></label>
    <label>Căn cứ hoặc ghi chú kiểm định<textarea value={note} maxLength={3000} onChange={(event) => setNote(event.target.value)} /></label>
    <label className="check"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
      Tôi có quyền duyệt và đã đối chiếu câu hỏi, các phương án, đáp án với nguồn.</label>
    <div className="row">
      <button disabled={saving} onClick={() => void persist()}>Lưu trạng thái</button>
      <button className="primary" disabled={saving} onClick={() => void persist('accepted')}>Chấp nhận metadata</button>
      <button disabled={saving} onClick={() => void persist('rejected')}>Từ chối đề xuất</button>
      <button disabled={saving || !inspected || !confirmed || !note.trim()} onClick={() => void persist(undefined, true)}>Kiểm định đáp án thủ công</button>
    </div>
    {status && <p role="status">{status}</p>}
  </section>
}
