import { academicCatalog, applyAcademicReview, validateAcademicMetadata } from './data/academicReview'
import { readJsonFile } from './data/jsonFile'
import { SourceContext } from './features/SourceLinks'
import { hasDocumentFile } from './data/documentFiles'
import { sourceKey } from './data/slides'
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { BookOpen, ClipboardList, Database, Download, GraduationCap, LayoutDashboard, Menu, Moon, Search, Settings, Sun, Upload, X, Zap } from 'lucide-react'
import { MaterialViewer } from './features/SlideViewer'
import { CurriculumPage } from './features/CurriculumPage'
import { Overview } from './features/Overview'
import { Practice } from './features/Practice'
import { emptyStudy, examScope, type Exam as ExamData, type Save, type Session, type Study, type Subject } from './data/model'
import { downloadJson, loadSubjects, message, storageKey } from './data/storage'
import { customExamsKey, progressKey, readLocalStudy, studyKeys, withStudyLock, writeLocalStudy } from './data/localStudy'
import { href, paths, readRoute, RouteContext, type Section } from './routes'
import { LearningReport } from './features/LearningReport'
import { SettingsPage, type ResetScope } from './features/Settings'
import { ExamUpload } from './features/ExamUpload'
import { makeBackup, readBackup, restoreBackup, storageEstimate, type Backup, type BackupScope, type RestoreMode } from './data/backup'
import { defaultPreferences, preferencesKey, readPreferences, type Preferences } from './data/preferences'

import { Bank } from './features/Bank'
const Exam = lazy(() => import('./features/Exam').then((module) => ({ default: module.Exam })))

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
    void loadSubjects((error) => setExamLoadErrors((errors) => [...errors, error])).then((subjects) => {
      const entry = subjects.find((item) => item.id === subjectId)
      if (!entry) throw new Error('Không tìm thấy cấu hình BPS301.')
      setSubject(entry)
    }).catch((error) => setLoadError(message(error)))
  }, [])
  useEffect(() => {
    let active = true
    function reload(migrate = false) {
      const read = () => {
        const next = readLocalStudy()
        if (migrate && localStorage.getItem(progressKey) === null && localStorage.getItem(storageKey) !== null) {
          try { writeLocalStudy(next) } catch { /* Keep legacy data if migration cannot write. */ }
        }
        return next
      }
      const request = navigator.locks ? withStudyLock(read) : Promise.resolve().then(() => readLocalStudy())
      void request.then((next) => {
        if (!active) return
        dataRef.current = next
        setData(next)
        setReadError('')
      }).catch((error) => { if (active) setReadError(message(error)) })
    }
    const sync = (event: StorageEvent) => {
      if (event.key === preferencesKey || event.key === null) setPreferences(readPreferences())
      if (event.key !== null && !studyKeys.includes(event.key)) return
      reload()
    }
    window.addEventListener('storage', sync)
    reload(true)
    return () => { active = false; window.removeEventListener('storage', sync) }
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

  async function persist(change: (current: Save) => Save | undefined, replace = false) {
    try {
      return await withStudyLock(() => {
        const current = replace ? dataRef.current : readLocalStudy()
        const next = change(current)
        if (!next) return false
        if (next !== current) writeLocalStudy(next)
        dataRef.current = next
        setData(next)
        setStorageError('')
        setReadError('')
        return true
      })
    } catch (error) {
      setStorageError(error instanceof DOMException && error.name === 'QuotaExceededError'
        ? 'Bộ nhớ trình duyệt đã đầy. Hãy sao lưu dữ liệu trước khi giải phóng dung lượng.' : message(error))
      return false
    }
  }

  useEffect(() => {
    if (!Object.values(data.subjects).some((item) => item.sessions.some((session) => !session.unlimited))) return
    const expiredAt = (session: Session, time: number) => !session.unlimited && session.autoSubmit !== false && time >= session.deadline
    function tick() {
      const time = Date.now()
      setNow(time)
      if (!Object.values(dataRef.current.subjects).some((item) => item.sessions.some((session) => expiredAt(session, time)))) return
      void persist((current) => {
        const subjects = { ...current.subjects }
        let changed = false
        for (const [key, item] of Object.entries(current.subjects)) {
          const expired = item.sessions.filter((session) => expiredAt(session, time))
          if (!expired.length) continue
          subjects[key] = finish(item, expired, time, 'timeout')
          changed = true
        }
        return changed ? { ...current, subjects } : undefined
      }).then((saved) => { if (saved) setNotice('Đã tự nộp bài hết giờ. Bạn có thể xem bài trong lịch sử thi.') })
    }
    tick()
    const timer = window.setInterval(tick, 1000)
    window.addEventListener('focus', tick)
    return () => { window.clearInterval(timer); window.removeEventListener('focus', tick) }
  }, [data])

  const study = subject ? data.subjects[subject.id] ?? emptyStudy : emptyStudy
  const exams = useMemo(() => {
    const catalog = subject && academicCatalog(subject)
    const examsById = new Map((subject?.exams ?? []).map((exam) => [exam.id, exam] as const))
    for (const exam of study.exams) {
      const original = examsById.get(exam.id)
      const questions = [...new Map([...(original?.questions ?? []), ...exam.questions].map((item) => [item.id, item])).values()]
      examsById.set(exam.id, { ...exam, title: original?.title ?? exam.title, uploaded: !original && exam.uploaded, questions })
    }
    return [...examsById.values()].map((exam): ExamData => ({
      ...exam, questions: exam.questions.map((q) => {
        const review = study.academicReviews?.[q.id]
        return applyAcademicReview(study.edits[q.id] ?? q, review && catalog &&
          !validateAcademicMetadata(review, catalog.chapters, catalog.topics, catalog.pages) ? review : undefined)
      }),
    }))
  }, [subject, study.exams, study.edits, study.academicReviews])
  const materials = useMemo(() => [...new Map([...(subject?.materials ?? []), ...study.materials].map((item) => [item.id, item])).values()], [subject?.materials, study.materials])
  const activeMaterial = materials.find((material) => material.id === slide?.id)

  async function update(change: (current: Study) => Study | undefined) {
    if (!subject) return false
    return persist((latest) => {
      const current = latest.subjects[subject.id] ?? emptyStudy
      const next = change(current)
      if (!next) return undefined
      return next === current ? latest : { ...latest, subjects: { ...latest.subjects, [subject.id]: next } }
    })
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
  async function savePreferences(patch: Partial<Preferences>) {
    try {
      await withStudyLock(() => {
        const next = { ...readPreferences(), ...patch }
        localStorage.setItem(preferencesKey, JSON.stringify(next))
        setPreferences(next)
      })
      return true
    } catch (error) {
      setStorageError('Không lưu được tùy chọn: ' + message(error))
      return false
    }
  }
  async function exportData(scope: BackupScope) {
    const date = new Date()
    const timestamp = date.toLocaleString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }).replace(' ', '-').replaceAll(':', '')
    const name = 'bpms-bps301-' + timestamp
    try {
      const snapshot = navigator.locks ? await withStudyLock(readLocalStudy) : readLocalStudy()
      downloadJson(name + (scope === 'progress' ? '-tien-do' : '') + '.json',
        makeBackup(snapshot, scope, readPreferences(), date))
    } catch {
      downloadJson(name + '-du-lieu-tho.json', safeRawBackup())
    }
  }
  async function applyBackup(mode: RestoreMode) {
    if (!backup) return
    if (readError && mode === 'merge') {
      setStorageError('Dữ liệu hiện tại không đọc được. Hãy chọn ghi đè để khôi phục.')
      return
    }
    if (mode === 'replace' && !window.confirm('Ghi đè dữ liệu hiện tại theo phạm vi bản sao lưu?')) return
    if (!await persist((current) => restoreBackup(current, backup, mode, subjectId), mode === 'replace' && backup.scope === 'full')) return
    const preferencesSaved = mode !== 'replace' || !backup.preferences || await savePreferences(backup.preferences)
    setBackup(undefined)
    const restoredFiles = backup.scope === 'full' ? Object.values(backup.data.subjects).flatMap((item) =>
      item.materials.flatMap((material) => [material.localFile, material.localPreview, ...(material.pages ?? []).map((page) => page.localImage)]),
    ).filter((key): key is string => !!key) : []
    const status = await Promise.all([...new Set(restoredFiles)].map((key) => hasDocumentFile(key).catch(() => false)))
    const notices = [preferencesSaved ? 'Đã khôi phục dữ liệu.' : 'Đã khôi phục dữ liệu học. Tùy chọn chưa được lưu.']
    if (status.some((file) => !file)) notices.push('Thiếu tệp giáo trình. Hãy gắn lại tại Tệp giáo trình.')
    setNotice(notices.join(' '))
  }
  async function resetData(scope: ResetScope) {
    const descriptions = {
      activity: 'Xóa lượt ôn, các phiên đang làm và lịch sử thi? Dấu câu khó vẫn được giữ.',
      bookmarks: 'Xóa toàn bộ dấu câu khó?',
      all: 'Xóa mọi dữ liệu học, câu hỏi và giáo trình đã thêm, cùng tùy chọn ứng dụng?',
    }
    if (!window.confirm(descriptions[scope])) return
    if (scope === 'all') {
      if (!window.confirm('Xác nhận lần cuối: tiến độ và dữ liệu tự thêm trên trình duyệt này sẽ bị xóa.')) return
      if (await persist(() => ({ version: 1, subjects: {} }), true)) {
        const preferencesSaved = await savePreferences({ ...defaultPreferences })
        setBackup(undefined)
        setNotice(preferencesSaved ? 'Đã khôi phục gốc BPMS.' : 'Đã xóa dữ liệu học. Tùy chọn chưa được đặt lại.')
      }
      return
    }
    if (await update((current) => scope === 'bookmarks' ? { ...current, bookmarks: [] } : {
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
              const value = await readJsonFile(file)
              if (request !== restoreRead.current) return
              setBackup(readBackup(value))
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
          <button onClick={() => savePreferences({ theme: dark ? 'light' : 'dark' })} aria-label={dark ? 'Bật giao diện sáng' : 'Bật giao diện tối'}>
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </header>
      <main className="main" key={subject?.id}>
      <div className="main-content">
        {!navigator.locks && <div className="notice" role="status">Chế độ chỉ đọc. Trình duyệt chưa hỗ trợ lưu an toàn giữa các tab. Hãy mở BPMS qua HTTPS hoặc localhost bằng trình duyệt có Web Locks. Bạn vẫn có thể đọc học liệu và sao lưu dữ liệu.</div>}
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
          {section === 'exam' && <Suspense fallback={<p role="status">Đang tải trang Thi thử…</p>}><Exam exams={exams} sessions={study.sessions} history={study.history} now={now} preferences={preferences} subject={subject} study={study} materials={materials}
            save={(session, change) => update((current) => {
              const stored = current.sessions.find((item) => item.id === session.id)
              const time = Date.now()
              setNow(time)
              if (!session.unlimited && session.deadline <= time) return undefined
              if (!change && current.sessions.some((item) => examScope(item, exams) === session.examId)) return undefined
              if (change && !stored) return undefined
              const next = stored && change ? change(stored) : session
              return { ...current, sessions: [next, ...current.sessions.filter((item) => item.id !== session.id)] }
            })}
            submit={(id) => update((current) => {
              const item = current.sessions.find((session) => session.id === id)
              return item ? finish(current, [item], Date.now(), 'manual') : undefined
            })}
            reset={(scope, kind) => update((current) => ({
              ...current,
              [kind]: current[kind].filter((item) => examScope(item, exams) !== scope),
            }))} /></Suspense>}
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
        {section === 'settings' && <SettingsPage preferences={preferences} change={(patch) => { void savePreferences(patch) }}
          backup={backup} dismiss={() => setBackup(undefined)} bytes={bytes}
          load={() => restoreInput.current?.click()} exportData={exportData} restore={applyBackup} reset={resetData}
          examUpload={subject && <ExamUpload subjectId={subject.id} exams={exams} localExams={study.exams} add={(exam) => update((current) => {
            const existing = [...subject.exams, ...current.exams]
            const ids = new Set(existing.flatMap((item) => item.questions.map((question) => question.id)))
            if (existing.some((item) => item.id === exam.id) || exam.questions.some((question) => ids.has(question.id))) {
              throw new Error('Bộ đề hoặc ID câu hỏi đã được thêm ở tab khác.')
            }
            return {
            ...current, exams: [...current.exams, exam] }
          })} remove={(id) => update((current) => ({
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
