import { SourceLinks } from './SourceLinks'
import { useState } from 'react'
import { Download, Upload, Pencil } from 'lucide-react'
import { downloadJson, message, parseBank, parseQuestion } from '../data/storage'
import { uniqueQuestions, type Exam, type Question, type Study, type Subject } from '../data/model'
import { findQuestion, useRoute } from '../routes'
import { Choices, Feedback, Rich } from '../components/Question'

export function Bank({ subject, exams, study, save }: {
  subject: Subject; exams: Exam[]; study: Study; save: (state: Study) => boolean
}) {
  const [pending, setPending] = useState<Exam[]>([])
  const [status, setStatus] = useState('')
  const [strategy, setStrategy] = useState<'skip' | 'update' | 'new'>('skip')
  const [edit, setEdit] = useState<Question>()
  const route = useRoute()
  const query = route.query.get('search') ?? ''
  const chapter = route.query.get('chapter') ?? ''
  const statusFilter = route.query.get('status') ?? ''
  const examFilter = route.query.get('exam') ?? ''
  const detail = route.segments[0] === 'detail'
  const detailQuestion = findQuestion(uniqueQuestions(exams), route.segments[1])
  function filter(key: string, value: string) {
    const query = new URLSearchParams(route.query)
    if (value) query.set(key, value)
    else query.delete(key)
    route.go('/question_bank' + (query.size ? '?' + query : ''), key === 'search')
  }
  const latest = new Map(study.attempts.map((attempt) => [attempt.questionId, attempt.correct]))
  const questions = uniqueQuestions(exams)
  const examQuestions = new Set(exams.find((item) => item.id === examFilter)?.questions.map((question) => question.id))
  const chapters = Array.from(new Set([...subject.theory.map((item) => item.id), ...questions.flatMap((q) => q.chapterId ? [q.chapterId] : [])]))
  const matchingQuestions = questions.filter((q) => {
    const result = latest.get(q.id)
    const status = result === undefined ? 'unanswered' : result ? 'correct' : 'wrong'
    return (!examFilter || examQuestions.has(q.id)) && (!chapter || q.chapterId === chapter) &&
      (!statusFilter || (statusFilter === 'hard' ? study.bookmarks.includes(q.id) : status === statusFilter)) &&
      (q.id + ' ' + (q.code ?? '') + ' ' + q.prompt.value).toLowerCase().includes(query.trim().toLowerCase())
  })
  const known = new Set(uniqueQuestions(exams).map((q) => q.id))
  const incoming = pending.flatMap((e) => e.questions)
  const matches = incoming.filter((q) => known.has(q.id)).length
  function commit() {
    let next = [...study.exams]
    const ids = new Set(known)
    const edits = { ...study.edits }
    for (const exam of pending) {
      const incoming: Question[] = []
      for (const q of exam.questions) {
        if (!ids.has(q.id)) { ids.add(q.id); incoming.push(q); continue }
        if (strategy === 'update') edits[q.id] = q
        if (strategy !== 'new') continue
        let suffix = 2
        while (ids.has(q.id + '-' + suffix)) suffix++
        const id = q.id + '-' + suffix
        ids.add(id)
        incoming.push({ ...q, id })
      }
      if (!incoming.length) continue
      const previous = next.find((item) => item.id === exam.id)
      next = [...next.filter((item) => item.id !== exam.id), {
        ...exam, questions: [...(previous?.questions ?? []), ...incoming],
      }]
    }
    if (save({ ...study, exams: next, edits })) {
      setPending([])
      setStatus('Đã lưu ngân hàng câu hỏi.')
    }
  }
  async function pick(files: File[]) {
    setStatus('')
    setPending([])
    try {
      const merged = new Map<string, Exam>()
      const ids = new Set<string>()
      for (const file of files) {
        try {
          for (const exam of parseBank(JSON.parse(await file.text()), subject.id, true, file.name)) {
            for (const q of exam.questions) {
              if (ids.has(q.id)) throw new Error('Trùng ID giữa các tệp: ' + q.id)
              ids.add(q.id)
            }
            const previous = merged.get(exam.id)
            if (previous && previous.title !== exam.title) throw new Error('Tên bộ đề không nhất quán: ' + exam.id)
            merged.set(exam.id, { ...exam, questions: [...(previous?.questions ?? []), ...exam.questions] })
          }
        } catch (error) { throw new Error(file.name + ' · ' + message(error)) }
      }
      setPending([...merged.values()])
    } catch (error) { setStatus(message(error)) }
  }
  if (detail) return <section className="panel task">
    <h1>Chi tiết câu hỏi</h1><button onClick={() => route.go('/question_bank')}>Về ngân hàng</button>
    {detailQuestion ? <>
      <span className="tag">{detailQuestion.id}</span>
      <div className="prompt"><Rich content={detailQuestion.prompt} /></div>
      <Choices question={detailQuestion} selected={detailQuestion.answers} reveal change={() => {}} />
      <Feedback question={detailQuestion} selected={detailQuestion.answers} />
      <h2>Nguồn slide</h2>
      <SourceLinks key={detailQuestion.id} target={{ courseId: subject.id, questionId: detailQuestion.id }} manage
        suggestions={detailQuestion.slides?.map((ref) => ({
          courseId: subject.id, questionId: detailQuestion.id, documentId: ref.materialId, slideNumber: ref.page,
          verificationStatus: 'suggested', matchingMethod: 'metadata',
        }))} />
    </> : <p>Không tìm thấy câu hỏi.</p>}
  </section>
  return <>
    <h1>Ngân hàng câu hỏi</h1>
    <section className="panel task">
      <div className="row spread"><h2>Nhập và xuất bộ đề</h2>
        <button onClick={() => downloadJson(subject.id + '-bo-de.json', { version: 1, subjectId: subject.id, exams })}><Download size={16} /> Xuất ngân hàng</button>
      </div>
      <label className="file-field"><Upload size={19} /> Chọn một hoặc nhiều tệp JSON
        <input type="file" multiple accept=".json,application/json" onChange={(event) => {
          void pick(Array.from(event.target.files ?? []))
          event.target.value = ''
        }} />
      </label>
      {status && <p role="status">{status}</p>}
      {pending.length > 0 && <div className="import-preview task">
        <strong>{pending.length} bộ đề · {incoming.length} câu · {matches} câu trùng ID</strong>
        {pending.map((exam) => <span key={exam.id}>{exam.title} · {exam.questions.length} câu</span>)}
        <label>Khi trùng ID<select value={strategy} onChange={(event) => setStrategy(event.target.value as typeof strategy)}>
          <option value="skip">Bỏ qua câu trùng</option><option value="update">Cập nhật và giữ tiến độ</option><option value="new">Tạo bản sao với ID mới</option>
        </select></label>
        <div className="row"><button className="primary" onClick={commit}>Xác nhận nhập</button><button onClick={() => setPending([])}>Hủy</button></div>
      </div>}
    </section>
    {edit && <section className="panel task">
      <div className="row spread"><h2>Sửa {edit.id}</h2><button onClick={() => setEdit(undefined)}>Đóng</button></div>
      <form className="task" onSubmit={(event) => {
        event.preventDefault()
        try {
          const q = parseQuestion(edit)
          if (save({ ...study, edits: { ...study.edits, [q.id]: q } })) {
            setEdit(undefined)
            setStatus('Đã lưu chỉnh sửa.')
          }
        } catch (error) { setStatus(message(error)) }
      }}>
        <label>Câu hỏi<textarea value={edit.prompt.value} onChange={(event) => setEdit({ ...edit, prompt: { ...edit.prompt, value: event.target.value } })} required /></label>
        <label>Loại câu<select value={edit.type} onChange={(event) => setEdit({ ...edit, type: event.target.value as Question['type'], answers: [] })}>
          <option value="single">Một đáp án</option><option value="multiple">Nhiều đáp án</option></select></label>
        {edit.options.map((option) => <div className="edit-option" key={option.id}>
          <label className="check"><input name="correct-option" type={edit.type === 'single' ? 'radio' : 'checkbox'}
            checked={edit.answers.includes(option.id)} onChange={(event) => setEdit({ ...edit, answers: edit.type === 'single' ? [option.id] :
              event.target.checked ? [...edit.answers, option.id] : edit.answers.filter((id) => id !== option.id) })} /> Đúng</label>
          <label>Lựa chọn {option.id}<input required value={option.content.value} onChange={(event) => setEdit({
            ...edit, options: edit.options.map((item) => item.id === option.id ? { ...item, content: { ...item.content, value: event.target.value } } : item),
          })} /></label>
        </div>)}
        {(['explanation', 'tip'] as const).map((key) => <label key={key}>{key === 'tip' ? 'Mẹo ghi nhớ' : 'Giải thích'}
          <textarea value={edit[key]?.value ?? ''} onChange={(event) => setEdit({ ...edit, [key]: event.target.value.trim()
            ? { format: edit[key]?.format ?? 'text', value: event.target.value } : undefined })} /></label>)}
        {(edit.slides ?? []).map((ref, index) => <div className="row" key={index}>
          <label>Giáo trình<select value={ref.materialId} onChange={(event) => setEdit({ ...edit,
            slides: edit.slides?.map((item, i) => i === index ? { ...item, materialId: event.target.value } : item),
          })}><option value={ref.materialId}>{[...subject.materials, ...study.materials].find((item) => item.id === ref.materialId)?.title ?? ref.materialId}</option>
            {[...subject.materials, ...study.materials].filter((item) => item.id !== ref.materialId).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
          </select></label>
          <label>Trang<input type="number" min={1} required value={ref.page || ''} onChange={(event) => setEdit({ ...edit,
            slides: edit.slides?.map((item, i) => i === index ? { ...item, page: Number(event.target.value) } : item),
          })} /></label>
          <button type="button" onClick={() => setEdit({ ...edit, slides: edit.slides?.filter((_, i) => i !== index) })}>Bỏ liên kết</button>
        </div>)}
        <div className="row">
          {(subject.materials[0] ?? study.materials[0]) && <button type="button" onClick={() => setEdit({ ...edit,
            slides: [...(edit.slides ?? []), { materialId: (subject.materials[0] ?? study.materials[0]).id, page: 1 }],
          })}>Gắn trang giáo trình</button>}
          <button className="primary">Lưu câu hỏi</button>
        </div>
      </form>
    </section>}
    <section className="panel task">
      <div className="filters">
        <label>Tìm câu hỏi<input value={query} placeholder="Nhập ID hoặc nội dung" onChange={(event) => filter('search', event.target.value)} /></label>
        <label>Chương<select value={chapter} onChange={(event) => filter('chapter', event.target.value)}>
          <option value="">Tất cả chương</option>{chapters.map((id) => <option key={id} value={id}>{subject.theory.find((item) => item.id === id)?.title ?? id}</option>)}
        </select></label>
        <label>Trạng thái<select value={statusFilter} onChange={(event) => filter('status', event.target.value)}>
          <option value="">Tất cả trạng thái</option><option value="unanswered">Chưa làm</option>
          <option value="correct">Trả lời đúng</option><option value="wrong">Trả lời sai</option><option value="hard">Đánh dấu khó</option>
        </select></label>
        <label>Bộ đề<select value={examFilter} onChange={(event) => filter('exam', event.target.value)}>
          <option value="">Tất cả bộ đề</option>
          {exams.map((item) => <option key={item.id} value={item.id}>{item.title}{item.uploaded ? ' · Tự tải lên' : ''}</option>)}
        </select></label>
      </div>
      {matchingQuestions.length === 0 && <p className="muted">Không tìm thấy câu hỏi phù hợp.</p>}
      {matchingQuestions.map((q) =>
        <div className="bank-row" key={q.id}><div><span className="muted">{q.id}</span><p>{q.prompt.format === 'html' ? q.id : q.prompt.value}</p></div>
          <div className="row"><button onClick={() => route.go('/question_bank/detail/' + encodeURIComponent(q.id))}>Xem chi tiết</button>
            <button onClick={() => { setEdit(q); setStatus(''); window.scrollTo({ top: 0, behavior: 'smooth' }) }}><Pencil size={15} /> Sửa</button></div></div>)}
    </section>
  </>
}
