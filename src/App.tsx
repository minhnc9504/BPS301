import { useEffect, useRef, useState } from 'react'
import { BookOpen, ClipboardList, Database, Download, GraduationCap, LayoutDashboard, Upload, X, Zap } from 'lucide-react'
import { Bank } from './features/Bank'
import { Exam } from './features/Exam'
import { Library, MaterialViewer } from './features/Library'
import { Overview } from './features/Overview'
import { Practice } from './features/Practice'
import { emptyStudy, examScope, type Exam as ExamData, type Save, type Session, type Study, type Subject } from './data/model'
import { downloadJson, loadSubjects, message, parseSave, storageKey } from './data/storage'

const sections = [
  { id: 'overview', label: 'Tổng quan', icon: LayoutDashboard },
  { id: 'practice', label: 'Ôn tập', icon: Zap },
  { id: 'exam', label: 'Thi thử', icon: ClipboardList },
  { id: 'library', label: 'Giáo trình', icon: BookOpen },
  { id: 'bank', label: 'Ngân hàng', icon: Database },
] as const
type Section = typeof sections[number]['id']

function Brand({ openOverview }: { openOverview: () => void }) {
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading')
  return <button className="brand" aria-label="Smart Exam" onClick={openOverview}>
    <span className="brand-icon">
      {state !== 'ready' && <GraduationCap size={24} aria-hidden="true" />}
      {state !== 'failed' && <img
        className={state === 'ready' ? 'brand-image ready' : 'brand-image'}
        src={import.meta.env.BASE_URL + 'smartexam.png'}
        alt="Smart Exam"
        width={39}
        height={39}
        onLoad={() => setState('ready')}
        onError={() => setState('failed')}
      />}
    </span>
    <span>Smart Exam</span>
  </button>
}

function readSave(): Save {
  const value = localStorage.getItem(storageKey)
  return value ? parseSave(JSON.parse(value)) : { version: 1, subjects: {} }
}
function finish(study: Study, sessions: Session[], at: number): Study {
  const ids = new Set(sessions.map((session) => session.id))
  return { ...study, sessions: study.sessions.filter((session) => !ids.has(session.id)),
    history: [...study.history, ...sessions.map((session) => ({
      ...session, ended: Math.max(session.started, Math.min(at, session.deadline)),
    }))] }
}
function readView() {
  try {
    const [subject, section] = (sessionStorage.getItem('smart-exam-view') ?? '').split('/')
    return { subject, section: sections.find((item) => item.id === section)?.id ?? 'overview' }
  } catch { return { subject: '', section: 'overview' as const } }
}

export function App() {
  const [subjectList, setSubjectList] = useState<Subject[]>()
  const [loadError, setLoadError] = useState('')
  const [storageError, setStorageError] = useState('')
  const [notice, setNotice] = useState('')
  const [initial] = useState(() => {
    try { return { data: readSave(), error: '' } }
    catch (error) { return { data: { version: 1, subjects: {} } as Save, error: message(error) } }
  })
  const [data, setData] = useState(initial.data)
  const [readError, setReadError] = useState(initial.error)
  const dataRef = useRef(data)
  const [view] = useState(readView)
  const [selected, setSelected] = useState(view.subject)
  const [section, setSection] = useState<Section>(view.section)
  const [now, setNow] = useState(Date.now)
  const [slide, setSlide] = useState<{ id: string; page: number }>()
  const dialog = useRef<HTMLDialogElement>(null)

  useEffect(() => { void loadSubjects().then(setSubjectList).catch((error) => setLoadError(message(error))) }, [])
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key !== storageKey && event.key !== null) return
      try {
        const next = readSave()
        dataRef.current = next
        setData(next)
        setReadError('')
      } catch (error) { setReadError(message(error)) }
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])
  useEffect(() => { if (slide && !dialog.current?.open) dialog.current?.showModal() }, [slide])
  useEffect(() => {
    try { sessionStorage.setItem('smart-exam-view', selected + '/' + section) } catch { /* Navigation still works. */ }
  }, [selected, section])

  function persist(next: Save, restore = false) {
    try {
      if (readError && !restore) throw new Error('Hãy khôi phục một bản sao lưu hợp lệ trước khi tiếp tục ghi dữ liệu.')
      localStorage.setItem(storageKey, JSON.stringify(next))
      dataRef.current = next
      setData(next)
      setStorageError('')
      setReadError('')
      return true
    } catch (error) {
      setStorageError(error instanceof DOMException && error.name === 'QuotaExceededError'
        ? 'Bộ nhớ trình duyệt đã đầy. Hãy sao lưu dữ liệu trước khi giải phóng dung lượng.' : message(error))
      return false
    }
  }

  useEffect(() => {
    if (!Object.values(data.subjects).some((item) => item.sessions.length)) return
    function tick() {
      const time = Date.now()
      setNow(time)
      const current = dataRef.current
      const subjects = { ...current.subjects }
      let changed = false
      for (const [key, item] of Object.entries(current.subjects)) {
        const expired = item.sessions.filter((session) => time >= session.deadline)
        if (!expired.length) continue
        subjects[key] = finish(item, expired, time)
        changed = true
      }
      if (changed) {
        if (persist({ ...current, subjects })) setNotice('Đã tự nộp bài hết giờ. Bạn có thể xem bài trong lịch sử thi.')
      }
    }
    tick()
    const timer = window.setInterval(tick, 1000)
    window.addEventListener('focus', tick)
    return () => { window.clearInterval(timer); window.removeEventListener('focus', tick) }
  }, [data, readError])

  const subject = subjectList?.find((item) => item.id === selected) ?? subjectList?.[0]
  const study = subject ? data.subjects[subject.id] ?? emptyStudy : emptyStudy
  const examsById = new Map((subject?.exams ?? []).map((exam) => [exam.id, exam] as const))
  for (const exam of study.exams) {
    const original = examsById.get(exam.id)
    examsById.set(exam.id, { ...exam, title: original?.title ?? exam.title, questions: [...(original?.questions ?? []), ...exam.questions] })
  }
  const exams: ExamData[] = [...examsById.values()].map((exam) => ({
    ...exam, questions: exam.questions.map((q) => study.edits[q.id] ?? q),
  }))
  const materials = [...(subject?.materials ?? []), ...study.materials]
  const activeMaterial = materials.find((material) => material.id === slide?.id)

  function update(change: Study | ((current: Study) => Study)) {
    if (!subject) return false
    const latest = dataRef.current
    const current = latest.subjects[subject.id] ?? emptyStudy
    const next = typeof change === 'function' ? change(current) : change
    return next === current || persist({ ...latest, subjects: { ...latest.subjects, [subject.id]: next } })
  }
  function go(next: Section) {
    setSection(next)
    window.scrollTo(0, 0)
  }
  function openPractice(chapterId?: string, wrong?: boolean) {
    if (update((current) => ({ ...current, resume: undefined,
      practiceFilters: { exam: '', chapter: chapterId ?? '', topic: '', onlyWrong: Boolean(wrong) },
    }))) go('practice')
  }
  const openSlide = (id: string, page: number) => setSlide({ id, page })

  return <div className="app">
    <aside className="sidebar">
      <Brand openOverview={() => go('overview')} />
      {subject && <label className="subject-picker">Môn học<select value={subject.id} onChange={(event) => {
        setSelected(event.target.value); go('overview')
      }}>{subjectList?.map((item) => <option key={item.id} value={item.id}>{item.code}</option>)}</select></label>}
      <nav aria-label="Điều hướng chính">{sections.map(({ id, label, icon: Icon }) => <button key={id}
        className={id === section ? 'active' : ''} aria-current={id === section ? 'page' : undefined}
        onClick={() => go(id)}><Icon size={19} />{label}</button>)}</nav>
      <div className="backup">
        <button onClick={() => downloadJson('smart-exam-sao-luu.json', readError
          ? safeRawBackup() : dataRef.current)}><Download size={17} /> Sao lưu</button>
        <label className="button restore"><Upload size={17} /> Khôi phục<input type="file" accept=".json,application/json"
          onChange={async (event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (!file) return
            try {
              const next = parseSave(JSON.parse(await file.text()))
              if (!window.confirm('Thay dữ liệu học hiện tại bằng bản sao lưu này?')) return
              if (persist(next, true)) { setNotice('Đã khôi phục dữ liệu.'); go('overview') }
            } catch (error) { setStorageError(message(error)) }
          }} /></label>
      </div>
    </aside>
    <main className="main" key={subject?.id}>
      <div className="topline"><span>Không gian học tập</span>{subject && <span className="tag">{subject.code}</span>}</div>
      <div className="main-content">
        {readError && <div className="alert" role="alert">Dữ liệu trình duyệt không đọc được. {readError}</div>}
        {storageError && <div className="alert" role="alert">{storageError}<button onClick={() => setStorageError('')} aria-label="Đóng lỗi"><X size={16} /></button></div>}
        {notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Đóng thông báo"><X size={16} /></button></div>}
        {loadError && <div className="alert" role="alert">Không tải được dữ liệu môn học. {loadError}</div>}
        {!loadError && !subjectList && <p role="status">Đang tải môn học…</p>}
        {subjectList && !subject && <p>Chưa có môn học trong danh mục.</p>}
        {subject && <>
          {section === 'overview' && <Overview subject={subject} exams={exams} study={study} materials={materials}
            resume={() => go(study.sessions.length ? 'exam' : 'practice')}
            practice={openPractice} library={() => go('library')} />}
          {section === 'practice' && <Practice subject={subject} exams={exams} study={study} setStudy={update} slide={openSlide} />}
          {section === 'exam' && <Exam exams={exams} sessions={study.sessions} history={study.history} now={now}
            save={(session, starting) => {
              const time = Date.now()
              setNow(time)
              if (session.deadline <= time) return false
              const sessions = dataRef.current.subjects[subject.id]?.sessions ?? []
              if (starting ? sessions.some((item) => examScope(item, exams) === session.examId) :
                !sessions.some((item) => item.id === session.id)) return false
              return update((current) => ({ ...current, sessions: [session, ...current.sessions.filter((item) => item.id !== session.id)] }))
            }}
            submit={(id) => update((current) => finish(current, current.sessions.filter((item) => item.id === id), Date.now()))}
            reset={(scope, kind) => update((current) => ({
              ...current,
              [kind]: current[kind].filter((item) => examScope(item, exams) !== scope),
            }))} slide={openSlide} />}
          {section === 'library' && <Library subject={subject} materials={materials}
            upload={(material) => update((current) => ({ ...current, materials: [...current.materials, material] }))}
            practice={openPractice} />}
          {section === 'bank' && <Bank subject={subject} exams={exams} study={study} save={update} />}
          <dialog ref={dialog} onClose={() => setSlide(undefined)}>
            <div className="row spread"><h2>Giáo trình liên quan</h2><button aria-label="Đóng giáo trình" onClick={() => dialog.current?.close()}><X size={18} /></button></div>
            {slide && (activeMaterial ? <MaterialViewer key={slide.id + ':' + slide.page} material={activeMaterial} start={slide.page} /> :
              <p>Chưa có tài liệu {slide.id} trong thư viện.</p>)}
          </dialog>
        </>}
      </div>
    </main>
  </div>
}

function safeRawBackup() {
  try { return { raw: localStorage.getItem(storageKey) } }
  catch { return { raw: null } }
}
