import { useRef, useState } from 'react'
import { Copy, Download, Plus, Trash2, Upload } from 'lucide-react'
import { type Exam, type ExamCategory } from '../data/model'
import { downloadJson, message, normalizeExamId, parseUploadedExam } from '../data/storage'
import { examSlug } from '../routes'

const categories: Record<ExamCategory, string> = {
  FE: 'Final Exam (FE)', PT: 'Progress Test (PT)', MOCK: 'Mock Test', PRACTICE: 'Đề tự luyện',
}
const example = {
  exam_id: 'BPS301_SP26_FE',
  exam_title: 'BPS301 — SP26 FINAL EXAM',
  questions: [{
    id: 1, code: 'BPS301_SP26_FE_Q01', chapter: 2, type: 'SINGLECHOICE',
    question: 'In BPMN 2.0, which connecting object is used to show communication between two separate Pools?',
    options: { A: 'Sequence Flow', B: 'Message Flow', C: 'Data Association', D: 'Default Flow' },
    answer: 'B', answers_list: ['B'],
    explanation: 'Message Flow dùng để trao đổi thông điệp giữa hai Pool độc lập. Sequence Flow chỉ nối trong cùng một Pool.',
    tip: 'Khác Pool = Message Flow (nét đứt). Cùng Pool = Sequence Flow (nét liền).',
  }],
}
const prompt = [
  'Hãy chuyển toàn bộ câu hỏi trắc nghiệm tôi cung cấp thành JSON để nhập vào BPMS BPS301.',
  '1. Chỉ trả về JSON hợp lệ, không có lời dẫn hoặc hàng rào Markdown.',
  '2. Giữ nguyên tiếng Anh gốc của câu hỏi và các phương án A, B, C, D. Giữ các lựa chọn khác nếu đề gốc có.',
  '3. Viết explanation (giải thích và lý do loại trừ) và tip (mẹo ghi nhớ) bằng tiếng Việt.',
  '4. Gán chapter từ 1 đến 11 theo giáo trình BPS301. Mỗi câu cần id riêng trong đề.',
  '5. Với SINGLECHOICE, dùng answer: "B" và answers_list: ["B"]. Với MULTIPLECHOICE, dùng answer: "A, C" và answers_list: ["A", "C"].',
  'JSON mẫu:',
  JSON.stringify(example, null, 2),
].join('\n\n')

export function ExamUpload({ subjectId, exams, localExams, add, remove }: {
  subjectId: string; exams: Exam[]; localExams: Exam[]; add: (exam: Exam) => boolean; remove: (id: string) => boolean
}) {
  const [title, setTitle] = useState('')
  const [examId, setExamId] = useState('')
  const [category, setCategory] = useState<ExamCategory | ''>('')
  const [source, setSource] = useState<{ name: string; value: unknown }>()
  const [reading, setReading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [fileError, setFileError] = useState('')
  const [notice, setNotice] = useState('')
  const sequence = useRef(0)
  let exam: Exam | undefined
  let error = fileError
  if (source) {
    try {
      exam = parseUploadedExam(source.value, subjectId, source.name, { id: examId, title, category: category || undefined })
      const examKey = exam.id
      const incoming = new Set(exam.questions.map((item) => item.id))
      if (['ALL', 'RANDOM_50', 'QUICK_15'].includes(examKey) ||
        exams.some((item) => item.id.toUpperCase() === examKey || examSlug(item.id).toUpperCase() === examKey)) {
        error = 'Mã đề ' + exam.id + ' đã tồn tại. Hãy nhập mã khác.'
      } else if (exams.some((item) => item.questions.some((question) => incoming.has(question.id)))) {
        error = 'ID câu hỏi trùng với một đề khác. Hãy nhập mã đề khác.'
      }
    } catch (cause) { error = message(cause) }
  }
  const uploaded = localExams.filter((item) => item.uploaded)
  async function preparePublic(item: Exam) {
    const { uploaded, ...exam } = item
    const document = { version: 1, subjectId, exams: [exam] }
    const json = JSON.stringify(document)
    if (new TextEncoder().encode(json).length > 60_000) {
      downloadJson(item.id + '.json', document)
      setNotice('Đề vượt giới hạn nhập của workflow. Đã tải JSON để thêm qua GitHub.')
      return
    }
    try {
      await navigator.clipboard.writeText(json)
      setNotice('Đã sao chép JSON. Mở GitHub Actions, chọn main và dán vào ô exam_json.')
    } catch {
      downloadJson(item.id + '.json', document)
      setNotice('Đã tải JSON công khai. Mở tệp và sao chép nội dung vào GitHub Actions.')
    }
  }
  async function read(file: File) {
    const request = ++sequence.current
    setSource(undefined)
    setFileError('')
    setNotice('')
    setReading(true)
    try {
      if (!/\.json$/i.test(file.name)) throw new Error('Hãy chọn tệp có đuôi .json.')
      const text = await file.text()
      let value: unknown
      try { value = JSON.parse(text) } catch { throw new Error('Tệp sai cú pháp JSON. Hãy kiểm tra dấu ngoặc, dấu phẩy và dấu nháy kép.') }
      if (request === sequence.current) setSource({ name: file.name, value })
    } catch (cause) {
      if (request === sequence.current) setFileError(message(cause))
    } finally {
      if (request === sequence.current) setReading(false)
    }
  }
  const single = exam?.questions.filter((item) => item.type === 'single').length ?? 0
  return <section className="panel task">
    <h2>Tải lên bộ đề mới (JSON)</h2>
    <div className="exam-upload-grid">
      <form className="task" onSubmit={(event) => {
        event.preventDefault()
        if (!exam || error || reading) return
        if (add(exam)) {
          setNotice('Đã thêm ' + exam.title + ' · ' + exam.questions.length + ' câu.')
          setSource(undefined); setTitle(''); setExamId(''); setCategory('')
        }
      }}>
        <label>Tên bộ đề hiển thị<input value={title} placeholder="BPS301 — SP26 FINAL EXAM" onChange={(event) => setTitle(event.target.value)} />
          <small className="muted">Để trống để dùng tên trong JSON hoặc tên tệp.</small>
        </label>
        <label>Mã đề<input value={examId} placeholder="BPS301_SP26_FE" onChange={(event) => {
          const value = normalizeExamId(event.target.value)
          setExamId(value + (value && /[_ -]$/.test(event.target.value) ? '_' : ''))
        }} />
          <small className="muted">Để trống để dùng mã trong JSON hoặc tên tệp.</small>
        </label>
        <label>Phân loại (tùy chọn)<select value={category} onChange={(event) => setCategory(event.target.value as ExamCategory | '')}>
          <option value="">Chọn phân loại</option>
          {Object.entries(categories).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select></label>
        <label className="file-field exam-drop" data-dragging={dragging} onDragOver={(event) => {
          event.preventDefault(); setDragging(true)
        }} onDragLeave={() => setDragging(false)} onDrop={(event) => {
          event.preventDefault(); setDragging(false)
          if (event.dataTransfer.files.length === 1) void read(event.dataTransfer.files[0])
          else { ++sequence.current; setReading(false); setSource(undefined); setFileError('Chọn một tệp JSON mỗi lần.') }
        }}><Upload size={18} /> Chọn hoặc kéo tệp đề thi (.json)
          <input type="file" accept=".json,application/json" onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (file) void read(file)
          }} />
        </label>
        {reading && <p role="status">Đang kiểm tra tệp…</p>}
        {error && <p className="upload-error" role="alert">{error}</p>}
        {exam && !error && <div className="upload-valid" role="status">
          <strong>Hợp lệ: {exam.questions.length} câu hỏi ({single} câu chọn 1, {exam.questions.length - single} câu chọn nhiều)</strong>
          <p>{exam.title} · {exam.id}</p>
        </div>}
        <button className="primary" type="submit" disabled={!exam || Boolean(error) || reading}><Plus size={17} /> Thêm bộ đề vào ứng dụng</button>
      </form>
      <div className="task prompt-box">
        <h3>Prompt tạo JSON</h3>
        <textarea aria-label="Prompt tạo JSON" readOnly value={prompt} rows={16} />
        <div className="row">
          <button onClick={async () => {
            try { await navigator.clipboard.writeText(prompt); setNotice('Đã sao chép prompt.') }
            catch { setNotice('Không sao chép tự động được. Hãy chọn nội dung trong ô prompt để sao chép.') }
          }}><Copy size={16} /> Sao chép Prompt</button>
          <button onClick={() => downloadJson('bpms-bps301-de-mau.json', example)}><Download size={16} /> Tải file mẫu (.json)</button>
        </div>
      </div>
    </div>
    {notice && <p role="status">{notice}</p>}
    <h3>Bộ đề đã tự tải lên</h3>
    {!uploaded.length && <p className="muted">Chưa có bộ đề tự tải lên.</p>}
    {uploaded.map((item) => <div className="row spread uploaded-exam" key={item.id}>
      <div><strong>{item.title}</strong> <span className="tag">Tự tải lên</span>
        <p className="muted">{item.id} · {item.questions.length} câu{item.category ? ' · ' + categories[item.category] : ''}</p>
      </div>
      <div className="row">
      <button onClick={() => void preparePublic(item)}><Copy size={16} /> Sao chép JSON công khai</button>
      <button onClick={() => {
        if (window.confirm('Xóa đề «' + item.title + '» và phiên đang làm của đề này? Các bài thi đã nộp vẫn còn trong lịch sử.') && remove(item.id)) {
          setNotice('Đã xóa ' + item.title + '.')
        }
      }}><Trash2 size={16} /> Xóa đề này</button>
      </div>
    </div>)}
    <details>
      <summary>Công khai bộ đề lên GitHub</summary>
      <p className="muted">Sao chép JSON của một đề, mở workflow, chọn <strong>Run workflow</strong> trên nhánh <code>main</code> và dán vào <code>exam_json</code>. Đề và đáp án sẽ công khai sau khi xuất bản. Cần tài khoản có quyền ghi repo.</p>
      <a className="button" href="https://github.com/minhnc9504/BPS301/actions/workflows/publish-exam.yml" target="_blank" rel="noreferrer">Mở GitHub Actions</a>
    </details>
  </section>
}
