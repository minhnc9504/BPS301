import { SourceLinks } from './SourceLinks'
import { useEffect, useMemo, useRef } from 'react'
import { BookOpen, Check, ChevronRight, ListTree, Play, Search, X } from 'lucide-react'
import { Highlight, Rich } from '../components/Question'
import { Progress } from '../components/Progress'
import { uniqueQuestions, type Exam, type Material, type Study, type Subject } from '../data/model'
import { examReportReturn, useRoute } from '../routes'
import { curriculum, findMaterial, lessonPath, relatedQuestions, slug, type Lecture, type Lesson } from './curriculumData'
import { Library } from './Library'
import { learningStats, practiceReturn } from '../data/review'

type Props = {
  subject: Subject; exams: Exam[]; materials: Material[]; study: Study
  update: (change: (study: Study) => Study) => boolean
  upload: (material: Material) => boolean; practice: (chapterId: string) => void
}

function Reader({ lecture, lesson, keyword }: { lecture: Lecture; lesson: Lesson; keyword: string }) {
  const objectives = lesson.objectives.length ? lesson.objectives : lecture.objectives
  const lessonTerms = new Set([lesson.title, ...lesson.keywords].map(slug))
  const terms = lecture.terms.filter(({ term }) => lessonTerms.has(slug(term)))
  return <>
    <div className="row lesson-breadcrumb"><span>Giáo trình</span><ChevronRight size={13} /><span>Lecture {lecture.id}</span>
      <ChevronRight size={13} /><span>{lesson.id}</span></div>
    <h2><Highlight text={lesson.title} query={keyword} /></h2>
    {objectives.length > 0 && <section className="lesson-objectives">
      <h3>{lesson.objectives.length ? 'Mục tiêu học tập' : 'Mục tiêu của Lecture'}</h3>
      <ul>{objectives.map((value, i) => <li key={i}><Highlight text={value} query={keyword} /></li>)}</ul>
    </section>}
    {lesson.content.value && <section className="lesson-section theory-reading">
      <h3>Nội dung bài học</h3><Rich content={lesson.content} query={keyword} theory />
    </section>}
    {terms.length > 0 && <details className="lesson-section"><summary>Thuật ngữ tiếng Anh</summary><dl>
      {terms.map(({ term, meaning }) => <div key={term}><dt><Highlight text={term} query={keyword} /></dt><dd>{meaning}</dd></div>)}
    </dl></details>}
    {lesson.examples.length > 0 && <section className="lesson-section"><h3>Ví dụ trong dữ liệu giáo trình</h3>
      <ul>{lesson.examples.map((item, i) => <li key={i}><Highlight text={item} query={keyword} /></li>)}</ul>
    </section>}
    {lesson.formulas.length > 0 && <section className="lesson-section"><h3>Công thức</h3>
      {lesson.formulas.map((item, i) => <pre className="lesson-formula" key={i}>{item}</pre>)}
    </section>}
    {lesson.tables.map((table, i) => <section className="lesson-section" key={i}><h3>{table.title || 'Bảng so sánh'}</h3>
      <div className="lesson-table"><table><thead><tr>{table.headers.map((item, i) => <th scope="col" key={i}>{item}</th>)}</tr></thead>
        <tbody>{table.rows.map((row, index) => <tr key={index}>{row.map((item, i) => <td key={i}>{item}</td>)}</tr>)}</tbody></table></div>
    </section>)}
    {lesson.note && <aside className="lesson-callout"><h3>Điểm dễ nhầm</h3><p><Highlight text={lesson.note} query={keyword} /></p></aside>}
    {lesson.tips.length > 0 && <section className="lesson-section"><h3>Mẹo ghi nhớ</h3>
      <ul>{lesson.tips.map((tip, index) => <li key={index}>{tip}</li>)}</ul>
    </section>}
    {lesson.excerpts.length > 0 && <details className="lesson-section"><summary>Trích đoạn slide nguồn</summary>
      <ul>{lesson.excerpts.map((item, i) => <li key={i}><Highlight text={item} query={keyword} /></li>)}</ul>
    </details>}
    {lesson.summary && <section className="lesson-section"><h3>Tóm tắt cuối bài</h3><p>{lesson.summary}</p></section>}
  </>
}

function excerpt(value: string, keyword: string) {
  const index = value.toLowerCase().indexOf(keyword.toLowerCase())
  const start = Math.max(0, index - 48)
  return (start > 0 ? '…' : '') + value.slice(start, start + 165) + (start + 165 < value.length ? '…' : '')
}

export function CurriculumPage(props: Props) {
  const route = useRoute()
  const [mode, routeLecture] = route.segments
  if (mode === 'formulas' || mode === 'pitfalls' || mode === 'materials' || route.query.has('material') || route.query.get('view') === 'full') {
    return <><div className="row route-links"><button onClick={() => route.go('/curriculum')}>Về trình đọc Giáo trình</button></div>
      <Library subject={props.subject} materials={props.materials} upload={props.upload} practice={props.practice} /></>
  }
  return <CurriculumReader {...props} routeLecture={mode === 'chapter' ? routeLecture : undefined} />
}

function CurriculumReader({ subject, exams, materials, study, update, routeLecture }: Props & { routeLecture?: string }) {
  const route = useRoute()
  const drawer = useRef<HTMLDialogElement>(null)
  const reader = useRef<HTMLElement>(null)
  const lectures = useMemo(() => curriculum(subject), [subject])
  const saved = study.curriculum
  const keyword = (route.query.get('search') ?? '').trim()
  const returnTo = practiceReturn(route.query.get('returnTo')) ?? examReportReturn(route.query.get('returnTo'))
  const sectionId = route.query.get('section')
  const anchor = route.hash
  const requested = lectures.find((item) => item.id === routeLecture)
  const findAnchor = (item: Lecture) => item.lessons.find((lesson) => slug(lesson.title) === anchor)
  const lecture = (anchor && ([requested, ...lectures].find((item) => item && findAnchor(item)))) ||
    requested || lectures.find((item) => item.id === saved?.last?.lectureId) || lectures[0]
  const lesson = lecture && (
    lecture.lessons.find((item) => item.id === sectionId) ||
    (anchor ? findAnchor(lecture) : undefined) ||
    (lecture.id === saved?.last?.lectureId ? lecture.lessons.find((item) => item.id === saved.last?.sectionId) : undefined) ||
    lecture.lessons[0])
  const activeId = lecture?.id
  const lessonId = lesson?.id
  const lastLecture = saved?.last?.lectureId
  const lastSection = saved?.last?.sectionId
  useEffect(() => {
    if (!activeId || !lessonId || (activeId === lastLecture && lessonId === lastSection)) return
    update((current) => ({ ...current, curriculum: { completed: current.curriculum?.completed ?? {},
      last: { lectureId: activeId, sectionId: lessonId } } }))
  }, [activeId, lessonId, lastLecture, lastSection, update])
  if (!lecture || !lesson) return <section className="panel task"><h1>Giáo trình</h1><p>Chưa có nội dung lý thuyết.</p></section>
  const done = (item: Lecture) => item.lessons.filter((section) => saved?.completed[item.id]?.includes(section.id)).length
  const checked = saved?.completed[lecture.id]?.includes(lesson.id) ?? false
  const related = relatedQuestions(lecture, lesson, uniqueQuestions(exams), materials)
  const relatedStats = learningStats(subject.id, related.map((item) => item.question), [], study, Date.now())
    .forQuestions(related.map((item) => item.question))
  const matching = keyword ? lectures.flatMap((item) => item.lessons.filter((section) =>
    [item.title, section.title, section.search].some((value) => value.toLowerCase().includes(keyword.toLowerCase())),
  ).map((section) => ({ lecture: item, section }))) : []

  function open(item: Lecture, section: Lesson, keepSearch = false) {
    drawer.current?.close()
    route.go(lessonPath(item.id, section.id) + (keepSearch && keyword ? '&' + new URLSearchParams({ search: keyword }) : ''))
    reader.current?.focus({ preventScroll: true })
    reader.current?.scrollIntoView({ block: 'start' })
  }

  function toc() {
    return <div className="curriculum-nav">
      {lectures.map((item) => <details key={item.id + ':' + lecture.id} open={item.id === lecture.id}>
        <summary><span>{item.title}</span><small>{done(item)}/{item.lessons.length}</small></summary>
        <div className="curriculum-nav-items">{item.lessons.map((section) => <button key={section.id}
          aria-current={item.id === lecture.id && section.id === lesson.id ? 'page' : undefined}
          onClick={() => open(item, section)}>
          {saved?.completed[item.id]?.includes(section.id) && <Check size={15} aria-label="Đã học" />}
          <span>{section.title}</span>
        </button>)}</div>
      </details>)}
    </div>
  }

  return <div className="curriculum-page">
    <header className="row spread"><div><h1>Giáo trình BPS301</h1><p className="muted">Đọc theo mục kiến thức và theo dõi tiến độ từng Lecture.</p></div>
      <div className="row">
        <button className="curriculum-menu-button" onClick={() => drawer.current?.showModal()}><ListTree size={17} /> Mục lục</button>
        <button onClick={() => open(lecture, lesson)}>Tiếp tục học</button>
        {returnTo && <button onClick={() => route.go(returnTo)}>{returnTo.startsWith('/mock_exam') ? 'Quay lại báo cáo thi' : 'Quay lại câu đang ôn'}</button>}
      </div>
    </header>
    <div className="panel curriculum-toolbar">
      <label><span className="row"><Search size={16} /> Tìm trong giáo trình</span><input value={route.query.get('search') ?? ''}
        placeholder="Lecture, thuật ngữ hoặc từ khóa…" onChange={(event) => {
          const search = event.target.value
          route.go(lessonPath(lecture.id, lesson.id) + (search ? '&' + new URLSearchParams({ search }) : ''), true)
        }} /></label>
      <div className="row">
        <button onClick={() => route.go('/curriculum/formulas')}>Công thức</button>
        <button onClick={() => route.go('/curriculum/pitfalls')}>Điểm dễ nhầm</button>
        <button onClick={() => route.go('/curriculum/materials')}>Tệp giáo trình</button>
      </div>
    </div>
    {keyword && <section className="panel task curriculum-results" aria-label="Kết quả tìm kiếm">
      <h2>Kết quả tìm kiếm · {matching.length} mục</h2>
      {!matching.length && <p className="muted">Không tìm thấy mục phù hợp.</p>}
      {matching.map(({ lecture: item, section }) => <div className="row spread curriculum-search-item" key={item.id + ':' + section.id}>
        <div><strong><Highlight text={section.title} query={keyword} /></strong>
          <p className="muted">{item.title}</p><p><Highlight text={excerpt(section.search, keyword)} query={keyword} /></p></div>
        <button onClick={() => open(item, section, true)}>Mở mục</button>
      </div>)}
    </section>}
    <div className="curriculum-layout">
      <aside className="panel curriculum-sidebar"><h2>Mục lục</h2>{toc()}</aside>
      <article ref={reader} tabIndex={-1} className="panel task curriculum-reader">
        {routeLecture && routeLecture !== lecture.id && <p className="muted">{requested ? 'Mục này thuộc ' + lecture.title + '.' : 'Không tìm thấy Lecture ' + routeLecture + '. Đang mở ' + lecture.title + '.'}</p>}
        {sectionId && sectionId !== lesson.id && <p className="muted">Không tìm thấy mục đã yêu cầu trong Lecture này.</p>}
        <Reader lecture={lecture} lesson={lesson} keyword={keyword} />
        {lecture.summary && <details className="lesson-section"><summary>Tóm tắt Lecture</summary><p>{lecture.summary}</p></details>}
        {lecture.tips.length > 0 && <details className="lesson-section"><summary>Mẹo ghi nhớ của Lecture</summary>
          <ul>{lecture.tips.map((tip, i) => <li key={i}>{tip}</li>)}</ul></details>}
        <button onClick={() => route.go('/curriculum/chapter/' + encodeURIComponent(lecture.id) + '?view=full')}><BookOpen size={16} /> Đọc nguyên văn cả Lecture</button>
      </article>
      <aside className="curriculum-tools">
        <section className="panel task">
          <h2>Tiến độ Lecture</h2>
          <p className="mono">{done(lecture)}/{lecture.lessons.length} mục · {Math.round(done(lecture) * 100 / lecture.lessons.length)}%</p>
          <Progress value={done(lecture)} total={lecture.lessons.length} label="Tiến độ Lecture" />
          <button className="primary" aria-pressed={checked} onClick={() => update((current) => {
            const progress = current.curriculum ?? { completed: {} }
            const sections = progress.completed[lecture.id] ?? []
            return { ...current, curriculum: { ...progress, completed: { ...progress.completed,
              [lecture.id]: sections.includes(lesson.id) ? sections.filter((id) => id !== lesson.id) : [...sections, lesson.id] } } }
          })}><Check size={16} /> {checked ? 'Đã học · Bỏ đánh dấu' : 'Đánh dấu đã học'}</button>
        </section>
        <section className="panel task">
          <h2>Slide nguồn</h2>
          <SourceLinks key={lecture.id + ':' + lesson.id} target={{ courseId: subject.id, lectureId: lecture.id, sectionId: lesson.id }} manage
            suggestions={lesson.slides.map((slide) => ({
              courseId: subject.id, lectureId: lecture.id, sectionId: lesson.id,
              documentId: findMaterial(slide, materials)?.id ?? (slide.file || slide.title || 'Nguồn slide'),
              slideNumber: slide.page, verificationStatus: 'suggested', matchingMethod: 'metadata',
            }))} />
        </section>
        <section className="panel task">
          <h2>Câu hỏi liên quan</h2>
          {related.length > 0 && <p className="muted">{related.length} câu · {relatedStats.needed} cần ôn lại · {relatedStats.due} đến hạn · {relatedStats.accuracy === undefined ? 'Chưa đủ dữ liệu đúng/sai' : relatedStats.accuracy + '% đúng'}</p>}
          {!related.length && <p className="muted">Chưa tìm thấy câu hỏi liên quan tới mục này.</p>}
          {related.length > 0 && <button className="primary" onClick={() => {
            route.go('/trainning?' + new URLSearchParams({ lesson: lecture.id + ':' + lesson.id }))
            window.scrollTo(0, 0)
          }}><Play size={15} /> Luyện tập ngay · {related.length} câu</button>}
          {related.map(({ question, label }) => <div className="curriculum-tool-item" key={question.id}>
            <strong>{question.code ?? question.id}</strong>
            <Rich content={question.prompt} /><small className="muted">{label}</small>
          </div>)}
        </section>
      </aside>
    </div>
    <dialog ref={drawer} aria-label="Mục lục Giáo trình" className="curriculum-drawer">
      <div className="row spread"><h2>Mục lục</h2><button aria-label="Đóng mục lục" onClick={() => drawer.current?.close()}><X size={18} /></button></div>
      {toc()}
    </dialog>
  </div>
}
