import { useEffect, useRef, useState } from 'react'
import { BookOpen, ClipboardList, Database, Download, GraduationCap, LayoutDashboard, Menu, Moon, Search, Sun, Upload, X, Zap } from 'lucide-react'
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
const subjectId = 'bps301'

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
    const section = sessionStorage.getItem('smart-exam-view')?.split('/').at(-1)
    return sections.find((item) => item.id === section)?.id ?? 'overview'
  } catch { return 'overview' as const }
}

export function App() {
  const [subject, setSubject] = useState<Subject>()
  const [loadError, setLoadError] = useState('')
  const [examLoadErrors, setExamLoadErrors] = useState<string[]>([])
  const [storageError, setStorageError] = useState('')
  const [notice, setNotice] = useState('')
  const [initial] = useState(() => {
    try { return { data: readSave(), error: '' } }
    catch (error) { return { data: { version: 1, subjects: {} } as Save, error: message(error) } }
  })
  const [data, setData] = useState(initial.data)
  const [readError, setReadError] = useState(initial.error)
  const dataRef = useRef(data)
  const [section, setSection] = useState<Section>(readView)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuButton = useRef<HTMLButtonElement>(null)
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem('smart-exam-theme') === 'dark' }
    catch { return false }
  })
  const [commandQuery, setCommandQuery] = useState('')
  const [chapterJump, setChapterJump] = useState<{ id: string }>()
  const command = useRef<HTMLDialogElement>(null)
  const [now, setNow] = useState(Date.now)
  const [slide, setSlide] = useState<{ id: string; page: number }>()
  const dialog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    void loadSubjects((error) => setExamLoadErrors((errors) => [...errors, error])).then((subjects) => {
      const entry = subjects.find((item) => item.id === subjectId)
      if (!entry) throw new Error('Không tìm thấy cấu hình BPS301.')
      setSubject(entry)
    }).catch((error) => setLoadError(message(error)))
  }, [])
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
    try { sessionStorage.setItem('smart-exam-view', subjectId + '/' + section) } catch { /* Navigation still works. */ }
  }, [section])
  useEffect(() => {
    try { localStorage.setItem('smart-exam-theme', dark ? 'dark' : 'light') } catch { /* Theme remains available. */ }
  }, [dark])
  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'k' || dialog.current?.open) return
      event.preventDefault()
      if (command.current?.open) command.current.close()
      else command.current?.showModal()
    }
    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [])

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
    setMenuOpen(false)
    setChapterJump(undefined)
    setSection(next)
    window.scrollTo(0, 0)
  }
  function openPractice(chapterId?: string, wrong?: boolean) {
    if (update((current) => ({ ...current, resume: undefined,
      practiceFilters: { exam: '', chapter: chapterId ?? '', topic: '', onlyWrong: Boolean(wrong) },
    }))) go('practice')
  }
  const openSlide = (id: string, page: number) => setSlide({ id, page })

  const commands = [
    ...sections.map(({ id, label }) => ({ key: id, label, action: () => go(id) })),
    { key: 'review', label: 'Ôn lại câu sai và câu khó', action: () => openPractice(undefined, true) },
    ...(subject?.theory ?? []).map((chapter) => ({
      key: 'chapter-' + chapter.id, label: chapter.title,
      action: () => { go('library'); setChapterJump({ id: chapter.id }) },
    })),
  ].filter(({ label }) => label.toLowerCase().includes(commandQuery.trim().toLowerCase()))
  const navigationLabel = sections.find((item) => item.id === section)?.label
  const latestAttempts = new Map(study.attempts.map((attempt) => [attempt.questionId, attempt.correct]))
  const reviewCount = new Set(exams.flatMap((exam) => exam.questions)
    .filter((question) => latestAttempts.get(question.id) === false || study.bookmarks.includes(question.id))
    .map((question) => question.id)).size

  return <div className="app" data-section={section} data-theme={dark ? 'dark' : 'light'}>
    <header className="mobile-header">
      <div className="row"><Brand openOverview={() => go('overview')} /><span className="tag">BPS301</span></div>
      <button ref={menuButton} aria-label={menuOpen ? 'Đóng menu' : 'Mở menu'} aria-expanded={menuOpen}
        aria-controls="studio-sidebar" onClick={() => setMenuOpen((value) => !value)}>
        {menuOpen ? <X size={20} /> : <Menu size={20} />}
      </button>
    </header>
    <aside id="studio-sidebar" className="studio-sidebar" data-open={menuOpen} onKeyDown={(event) => {
      if (event.key === 'Escape' && menuOpen) {
        setMenuOpen(false)
        menuButton.current?.focus()
      }
    }}>
      <div className="sidebar-brand"><Brand openOverview={() => go('overview')} /></div>
      <div className="subject-card">
        <span className="subject-code mono">BPS301</span>
        <strong>BPM &amp; Process Mining</strong>
      </div>
      <nav aria-label="Điều hướng chính">{sections.map(({ id, label, icon: Icon }) => <button key={id}
        aria-label={label} aria-description={id === 'practice' && reviewCount > 0 ? reviewCount + ' câu cần ôn lại' : undefined}
        className={id === section ? 'active' : ''} aria-current={id === section ? 'page' : undefined}
        onClick={() => go(id)}><Icon size={19} />{label}
        {id === 'practice' && reviewCount > 0 && <span className="review-count" aria-hidden="true">{reviewCount}</span>}
      </button>)}</nav>
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
    <div className="workspace">
      <header className="context-bar">
        <div className="row current-context"><i aria-hidden="true" />{navigationLabel}</div>
        <div className="studio-actions">
          <span className="tag context-subject">BPS301 · BPM &amp; Process Mining</span>
          <button onClick={() => { setMenuOpen(false); command.current?.showModal() }} aria-label="Tìm nhanh"><Search size={17} /><span>Tìm nhanh</span><kbd>Ctrl K</kbd></button>
          <button onClick={() => setDark((value) => !value)} aria-label={dark ? 'Bật giao diện sáng' : 'Bật giao diện tối'}>
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </header>
      <main className="main" key={subject?.id}>
      <div className="main-content">
        {readError && <div className="alert" role="alert">Dữ liệu trình duyệt không đọc được. {readError}</div>}
        {storageError && <div className="alert" role="alert">{storageError}<button onClick={() => setStorageError('')} aria-label="Đóng lỗi"><X size={16} /></button></div>}
        {notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Đóng thông báo"><X size={16} /></button></div>}
        {loadError && <div className="alert" role="alert">Không tải được dữ liệu môn học. {loadError}</div>}
        {examLoadErrors.length > 0 && <div className="alert data-warning" role="alert">
          <strong>Một số bộ đề chưa tải được</strong>
          <ul>{examLoadErrors.map((error) => <li key={error}>{error}</li>)}</ul>
        </div>}
        {!loadError && !subject && <p role="status">Đang tải dữ liệu BPS301…</p>}
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
          {section === 'library' && <Library subject={subject} materials={materials} jumpTo={chapterJump}
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
    <dialog className="command-dialog" ref={command} aria-label="Tìm nhanh" onClose={() => setCommandQuery('')}>
      <div className="command-head"><Search size={18} />
        <input autoFocus aria-label="Tìm màn hình hoặc chương" value={commandQuery} placeholder="Tìm màn hình hoặc chương…" onChange={(event) => setCommandQuery(event.target.value)} />
        <button onClick={() => command.current?.close()} aria-label="Đóng tìm nhanh"><X size={18} /></button>
      </div>
      <div className="command-results">
        {commands.length ? commands.map(({ key, label, action }) => <button key={key} onClick={() => {
          command.current?.close()
          action()
        }}>{label}</button>) : <p className="muted">Không tìm thấy kết quả.</p>}
      </div>
    </dialog>
  </div>
}

function safeRawBackup() {
  try { return { raw: localStorage.getItem(storageKey) } }
  catch { return { raw: null } }
}
