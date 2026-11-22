import { SourceContext } from './features/SourceLinks'
import { hasDocumentFile } from './data/documentFiles'
import { sourceKey } from './data/slides'
import { useEffect, useMemo, useRef, useState } from 'react'
import { BookOpen, ClipboardList, Database, Download, GraduationCap, LayoutDashboard, Menu, Moon, Search, Settings, Sun, Upload, X, Zap } from 'lucide-react'
import { Bank } from './features/Bank'
import { Exam } from './features/Exam'
import { MaterialViewer } from './features/SlideViewer'
import { CurriculumPage } from './features/CurriculumPage'
import { Overview } from './features/Overview'
import { Practice } from './features/Practice'
import { emptyStudy, examScope, type Exam as ExamData, type Save, type Session, type Study, type Subject } from './data/model'
import { downloadJson, loadSubjects, message, storageKey } from './data/storage'
import { customExamsKey, progressKey, readLocalStudy, studyKeys, writeLocalStudy } from './data/localStudy'
import { href, paths, readRoute, RouteContext, type Section } from './routes'
import { LearningReport } from './features/LearningReport'
import { SettingsPage, type ResetScope } from './features/Settings'
import { ExamUpload } from './features/ExamUpload'
import { makeBackup, readBackup, restoreBackup, storageEstimate, type Backup, type BackupScope, type RestoreMode } from './data/backup'
import { defaultPreferences, preferencesKey, readPreferences, type Preferences } from './data/preferences'

const sections = [
  { id: 'overview', label: 'Tổng quan', icon: LayoutDashboard },
  { id: 'practice', label: 'Ôn tập', icon: Zap },
  { id: 'exam', label: 'Thi thử', icon: ClipboardList },
  { id: 'library', label: 'Giáo trình', icon: BookOpen },
  { id: 'bank', label: 'Ngân hàng', icon: Database },
  { id: 'settings', label: 'Cài đặt', icon: Settings },
] as const
const subjectId = 'bps301'

function Brand({ openOverview }: { openOverview: () => void }) {
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading')
  return <button className="brand" aria-label="BPMS" onClick={openOverview}>
    <span className="brand-icon">
      {state !== 'ready' && <GraduationCap size={24} aria-hidden="true" />}
      {state !== 'failed' && <img
        className={state === 'ready' ? 'brand-image ready' : 'brand-image'}
        src={import.meta.env.BASE_URL + 'img/logo.jpg'}
        alt="BPMS"
        width={39}
        height={39}
        onLoad={() => setState('ready')}
        onError={() => setState('failed')}
      />}
    </span>
    <span>BPMS</span>
  </button>
}

function finish(study: Study, sessions: Session[], at: number, completion: NonNullable<Session['completion']>): Study {
  const ids = new Set(sessions.map((session) => session.id))
  return { ...study, sessions: study.sessions.filter((session) => !ids.has(session.id)),
    history: [...study.history, ...sessions.map((session) => ({
      ...session, completion, ended: Math.max(session.started, Math.min(at, session.deadline)),
    }))] }
}

export function App() {
  const [subject, setSubject] = useState<Subject>()
  const [loadError, setLoadError] = useState('')
  const [examLoadErrors, setExamLoadErrors] = useState<string[]>([])
  const [storageError, setStorageError] = useState('')
  const [notice, setNotice] = useState('')
  const [initial] = useState(() => {
    try { return { data: readLocalStudy(), error: '' } }
    catch (error) { return { data: { version: 1, subjects: {} } as Save, error: message(error) } }
  })
  const [data, setData] = useState(initial.data)
  const [readError, setReadError] = useState(initial.error)
  const dataRef = useRef(data)
  const [route, setRoute] = useState(readRoute)
  const { section } = route
  const [menuOpen, setMenuOpen] = useState(false)
  const menuButton = useRef<HTMLButtonElement>(null)
  const [preferences, setPreferences] = useState(readPreferences)
  const bytes = useMemo(() => section === 'settings' ? storageEstimate() : undefined, [data, preferences, section])
  const [systemDark, setSystemDark] = useState(() => matchMedia('(prefers-color-scheme: dark)').matches)
  const dark = preferences.theme === 'dark' || (preferences.theme === 'system' && systemDark)
  const [backup, setBackup] = useState<Backup>()
  const restoreInput = useRef<HTMLInputElement>(null)
  const restoreRead = useRef(0)
  const [commandQuery, setCommandQuery] = useState('')
  const command = useRef<HTMLDialogElement>(null)
  const [now, setNow] = useState(Date.now)
  const [slide, setSlide] = useState<{ id: string; page: number; onReady?: (page: number) => void }>()
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    if (initial.error) return
    try {
      if (localStorage.getItem(progressKey) === null && localStorage.getItem(storageKey) !== null) {
        writeLocalStudy(initial.data)
      }
    } catch { /* Keep the previous snapshot readable if migration exceeds storage quota. */ }
  }, [initial])

  useEffect(() => {
    void loadSubjects((error) => setExamLoadErrors((errors) => [...errors, error])).then((subjects) => {
      const entry = subjects.find((item) => item.id === subjectId)
      if (!entry) throw new Error('Không tìm thấy cấu hình BPS301.')
      setSubject(entry)
    }).catch((error) => setLoadError(message(error)))
  }, [])
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === preferencesKey || event.key === null) setPreferences(readPreferences())
      if (event.key !== null && !studyKeys.includes(event.key)) return
      try {
        const next = readLocalStudy()
        dataRef.current = next
        setData(next)
        setReadError('')
      } catch (error) { setReadError(message(error)) }
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])
  useEffect(() => {
    if (!slide || !dialog.current || dialog.current.open) return
    dialog.current.showModal()
    dialog.current.querySelector<HTMLElement>('.slide-viewer')?.focus({ preventScroll: true })
  }, [slide])
  useEffect(() => {
    const sync = () => { setRoute(readRoute()); setMenuOpen(false) }
    window.addEventListener('popstate', sync)
    window.addEventListener('hashchange', sync)
    return () => { window.removeEventListener('popstate', sync); window.removeEventListener('hashchange', sync) }
  }, [])
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)')
    const sync = () => setSystemDark(media.matches)
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])
  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if (!preferences.shortcuts || event.repeat || event.isComposing || !(event.ctrlKey || event.metaKey) ||
        event.key.toLowerCase() !== 'k' || (!command.current?.open && document.querySelector('dialog[open]')) ||
        (event.target instanceof Element && !command.current?.contains(event.target) &&
          event.target.closest('input, textarea, select, [contenteditable], [role="textbox"]'))) return
      event.preventDefault()
      if (command.current?.open) command.current.close()
      else command.current?.showModal()
    }
    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [preferences.shortcuts])

  function persist(next: Save, restore = false) {
    try {
      if (readError && !restore) throw new Error('Hãy khôi phục một bản sao lưu hợp lệ trước khi tiếp tục ghi dữ liệu.')
      writeLocalStudy(next)
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
    if (!Object.values(data.subjects).some((item) => item.sessions.some((session) => !session.unlimited))) return
    function tick() {
      const time = Date.now()
      setNow(time)
      const current = dataRef.current
      const subjects = { ...current.subjects }
      let changed = false
      for (const [key, item] of Object.entries(current.subjects)) {
        const expired = item.sessions.filter((session) => !session.unlimited && session.autoSubmit !== false && time >= session.deadline)
        if (!expired.length) continue
        subjects[key] = finish(item, expired, time, 'timeout')
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
    const questions = [...new Map([...(original?.questions ?? []), ...exam.questions].map((item) => [item.id, item])).values()]
    examsById.set(exam.id, { ...exam, title: original?.title ?? exam.title, uploaded: !original && exam.uploaded, questions })
  }
  const exams: ExamData[] = [...examsById.values()].map((exam) => ({
    ...exam, questions: exam.questions.map((q) => study.edits[q.id] ?? q),
  }))
  const materials = useMemo(() => [...new Map([...(subject?.materials ?? []), ...study.materials].map((item) => [item.id, item])).values()], [subject?.materials, study.materials])
  const activeMaterial = materials.find((material) => material.id === slide?.id)

  function update(change: Study | ((current: Study) => Study)) {
    if (!subject) return false
    const latest = dataRef.current
    const current = latest.subjects[subject.id] ?? emptyStudy
    const next = typeof change === 'function' ? change(current) : change
    return next === current || persist({ ...latest, subjects: { ...latest.subjects, [subject.id]: next } })
  }
  function navigate(path: string, replace = false) {
    const url = href(path)
    if (location.pathname + location.search + location.hash !== url) {
      if (replace) history.replaceState(null, '', url)
      else history.pushState(null, '', url)
    }
    setRoute(readRoute())
  }
  function go(next: Section) {
    setMenuOpen(false)
    navigate(paths[next])
    window.scrollTo(0, 0)
  }
  function openPractice(chapterId?: string, wrong?: boolean) {
    go('practice')
    if (chapterId || wrong) navigate(chapterId ? '/trainning/chapter/' + encodeURIComponent(chapterId) : '/trainning?review=needed', true)
  }
  function savePreferences(next: Preferences) {
    try {
      localStorage.setItem(preferencesKey, JSON.stringify(next))
      setPreferences(next)
      return true
    } catch (error) {
      setStorageError('Không lưu được tùy chọn: ' + message(error))
      return false
    }
  }
  function exportData(scope: BackupScope) {
    const date = new Date()
    const timestamp = date.toLocaleString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }).replace(' ', '-').replaceAll(':', '')
    const name = 'bpms-bps301-' + timestamp + (readError ? '-du-lieu-tho' : scope === 'progress' ? '-tien-do' : '') + '.json'
    downloadJson(name, readError ? safeRawBackup() : makeBackup(dataRef.current, scope, preferences, date))
  }
  async function applyBackup(mode: RestoreMode) {
    if (!backup) return
    if (readError && mode === 'merge') {
      setStorageError('Dữ liệu hiện tại không đọc được. Hãy chọn ghi đè để khôi phục.')
      return
    }
    const next = restoreBackup(dataRef.current, backup, mode, subjectId)
    if (!persist(next, true)) return
    const preferencesSaved = mode !== 'replace' || !backup.preferences || savePreferences(backup.preferences)
    setBackup(undefined)
    const restoredFiles = backup.scope === 'full' ? Object.values(backup.data.subjects).flatMap((item) =>
      item.materials.flatMap((material) => [material.localFile, material.localPreview, ...(material.pages ?? []).map((page) => page.localImage)]),
    ).filter((key): key is string => !!key) : []
    const status = await Promise.all([...new Set(restoredFiles)].map((key) => hasDocumentFile(key).catch(() => false)))
    const notices = [preferencesSaved ? 'Đã khôi phục dữ liệu.' : 'Đã khôi phục dữ liệu học. Tùy chọn chưa được lưu.']
    if (status.some((file) => !file)) notices.push('Thiếu tệp giáo trình. Hãy gắn lại tại Tệp giáo trình.')
    setNotice(notices.join(' '))
  }
  function resetData(scope: ResetScope) {
    const descriptions = {
      activity: 'Xóa lượt ôn, các phiên đang làm và lịch sử thi? Dấu câu khó vẫn được giữ.',
      bookmarks: 'Xóa toàn bộ dấu câu khó?',
      all: 'Xóa mọi dữ liệu học, câu hỏi và giáo trình đã thêm, cùng tùy chọn ứng dụng?',
    }
    if (!window.confirm(descriptions[scope])) return
    if (scope === 'all') {
      if (!window.confirm('Xác nhận lần cuối: tiến độ và dữ liệu tự thêm trên trình duyệt này sẽ bị xóa.')) return
      if (persist({ version: 1, subjects: {} }, true)) {
        const preferencesSaved = savePreferences({ ...defaultPreferences })
        setBackup(undefined)
        setNotice(preferencesSaved ? 'Đã khôi phục gốc BPMS.' : 'Đã xóa dữ liệu học. Tùy chọn chưa được đặt lại.')
      }
      return
    }
    if (update((current) => scope === 'bookmarks' ? { ...current, bookmarks: [] } : {
      ...current, attempts: [], practice: {}, sessions: [], history: [], resume: undefined, practiceFilters: undefined,
      practiceRoute: undefined, reviewLater: undefined,
    })) setNotice(scope === 'bookmarks' ? 'Đã xóa dấu câu khó.' : 'Đã đặt lại lượt ôn và thi.')
  }
  const openSlide = (id: string, page: number, onReady?: (page: number) => void) => setSlide({ id, page, onReady })

  const commands = [
    ...sections.map(({ id, label }) => ({ key: id, label, action: () => go(id) })),
    { key: 'review', label: 'Ôn lại câu sai và câu khó', action: () => openPractice(undefined, true) },
    ...(subject?.theory ?? []).map((chapter) => ({
      key: 'chapter-' + chapter.id, label: chapter.title,
      action: () => { go('library'); navigate('/curriculum/chapter/' + encodeURIComponent(chapter.id), true) },
    })),
  ].filter(({ label }) => label.toLowerCase().includes(commandQuery.trim().toLowerCase()))
  const navigationLabel = sections.find((item) => item.id === section)?.label
  const latestAttempts = new Map(study.attempts.map((attempt) => [attempt.questionId, attempt.correct]))
  const reviewCount = new Set(exams.flatMap((exam) => exam.questions)
    .filter((question) => latestAttempts.get(question.id) === false || study.bookmarks.includes(question.id))
    .map((question) => question.id)).size

  return <RouteContext.Provider value={{ ...route, go: navigate }}><SourceContext.Provider value={{
    materials, links: study.sourceLinks ?? [], open: openSlide,
    save: (link, previous) => update((current) => {
      const key = sourceKey(link)
      const previousKey = previous && sourceKey(previous)
      const links = (current.sourceLinks ?? []).filter((item) => sourceKey(item) !== key && sourceKey(item) !== previousKey)
      if (previous && previousKey !== key) links.push({ ...previous, verificationStatus: 'rejected' })
      return { ...current, sourceLinks: [...links, link] }
    }),
    remove: (link) => update((current) => ({ ...current, sourceLinks: (current.sourceLinks ?? []).filter((item) => sourceKey(item) !== sourceKey(link)) })),
  }}><div className="app" data-section={section} data-theme={dark ? 'dark' : 'light'} data-text-size={preferences.textSize}>
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
        <button onClick={() => exportData('full')}><Download size={17} /> Sao lưu</button>
        <label className="button restore"><Upload size={17} /> Khôi phục<input ref={restoreInput} type="file" accept=".json,application/json"
          onChange={async (event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (!file) return
            const request = ++restoreRead.current
            try {
              const text = await file.text()
              if (request !== restoreRead.current) return
              setBackup(readBackup(JSON.parse(text)))
              setStorageError('')
            } catch (error) {
              if (request !== restoreRead.current) return
              setBackup(undefined)
              setStorageError(message(error))
            }
            go('settings')
          }} /></label>
      </div>
    </aside>
    <div className="workspace">
      <header className="context-bar">
        <div className="row current-context"><i aria-hidden="true" />{navigationLabel}</div>
        <div className="studio-actions">
          <span className="tag context-subject">BPS301 · BPM &amp; Process Mining</span>
          <button onClick={() => { setMenuOpen(false); command.current?.showModal() }} aria-label="Tìm nhanh"><Search size={17} /><span>Tìm nhanh</span><kbd>Ctrl K</kbd></button>
          <button onClick={() => savePreferences({ ...preferences, theme: dark ? 'light' : 'dark' })} aria-label={dark ? 'Bật giao diện sáng' : 'Bật giao diện tối'}>
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
          {section === 'overview' && (route.segments.length
            ? <LearningReport subject={subject} exams={exams} study={study} />
            : <Overview subject={subject} exams={exams} study={study} now={Date.now()} />)}
          {section === 'practice' && <Practice subject={subject} exams={exams} study={study} setStudy={update} preferences={preferences} />}
          {section === 'exam' && <Exam exams={exams} sessions={study.sessions} history={study.history} now={now} preferences={preferences} subject={subject} study={study} materials={materials}
            save={(session, starting) => {
              const time = Date.now()
              setNow(time)
              if (!session.unlimited && session.deadline <= time) return false
              const sessions = dataRef.current.subjects[subject.id]?.sessions ?? []
              if (starting ? sessions.some((item) => examScope(item, exams) === session.examId) :
                !sessions.some((item) => item.id === session.id)) return false
              return update((current) => ({ ...current, sessions: [session, ...current.sessions.filter((item) => item.id !== session.id)] }))
            }}
            submit={(id) => update((current) => finish(current, current.sessions.filter((item) => item.id === id), Date.now(), 'manual'))}
            reset={(scope, kind) => update((current) => ({
              ...current,
              [kind]: current[kind].filter((item) => examScope(item, exams) !== scope),
            }))} />}
          {section === 'library' && <CurriculumPage subject={subject} materials={materials} exams={exams} study={study} update={update}
            upload={(material) => update((current) => ({ ...current, materials: [...current.materials.filter((item) => item.id !== material.id), material] }))}
            practice={openPractice} />}
          {section === 'bank' && <Bank subject={subject} exams={exams} study={study} save={update} />}
          {!section && <section className="panel task"><h1>Không tìm thấy trang</h1><button onClick={() => go('overview')}>Về tổng quan</button></section>}
          <dialog ref={dialog} aria-label="Giáo trình liên quan" onClose={() => setSlide(undefined)}>
            <div className="row spread"><h2>Giáo trình liên quan</h2><button aria-label="Đóng giáo trình" onClick={() => dialog.current?.close()}><X size={18} /></button></div>
            {slide && (activeMaterial ? <MaterialViewer key={slide.id + ':' + slide.page} material={activeMaterial} start={slide.page} onReady={slide.onReady} /> :
              <p>Chưa có tài liệu {slide.id} trong thư viện.</p>)}
          </dialog>
        </>}
        {section === 'settings' && <SettingsPage preferences={preferences} change={(patch) => savePreferences({ ...preferences, ...patch })}
          backup={backup} dismiss={() => setBackup(undefined)} bytes={bytes}
          load={() => restoreInput.current?.click()} exportData={exportData} restore={applyBackup} reset={resetData}
          examUpload={subject && <ExamUpload subjectId={subject.id} exams={exams} localExams={study.exams} add={(exam) => update((current) => ({
            ...current, exams: [...current.exams, exam],
          }))} remove={(id) => update((current) => ({
            ...current, exams: current.exams.filter((exam) => exam.id !== id || !exam.uploaded),
            sessions: subject.exams.some((exam) => exam.id === id) ? current.sessions : current.sessions.filter((session) => session.examId !== id),
          }))} />} />}
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
  </div></SourceContext.Provider></RouteContext.Provider>
}

function safeRawBackup() {
  try { return { raw: Object.fromEntries([storageKey, customExamsKey, progressKey].map((key) => [key, localStorage.getItem(key)])) } }
  catch { return { raw: null } }
}
