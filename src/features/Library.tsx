import { useEffect, useRef, useState } from 'react'
import { BookOpen } from 'lucide-react'
import { Highlight, Rich } from '../components/Question'
import { DocumentDownload, DocumentUpload } from './DocumentUpload'
import { MaterialViewer } from './SlideViewer'
import type { Material, Subject } from '../data/model'
import { useRoute } from '../routes'

function openChapter(chapter?: HTMLDetailsElement, anchor?: string) {
  if (!chapter) return
  chapter.open = true
  chapter.querySelector('summary')?.focus({ preventScroll: true })
  const headings = Array.from(chapter.querySelectorAll('h2, h3, h4'))
  const linked = anchor && headings.find((heading) => headingSlug(heading.textContent ?? '') === anchor)
  const target = linked || chapter
  target.scrollIntoView({ block: 'start' })
}

function headingSlug(text: string) {
  return text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function Library({ subject, materials, upload, practice }: {
  subject: Subject; materials: Material[]; upload: (material: Material) => Promise<boolean>; practice: (chapterId: string) => void
}) {
  const route = useRoute()
  const [view, chapterId] = route.segments
  const query = route.query.get('search') ?? ''
  const [revision, setRevision] = useState(0)
  const [selected, setSelected] = useState<{ id: string; page: number }>()
  const keyword = query.trim()
  const normalized = keyword.toLowerCase()
  const matches = (text: string) => text.toLowerCase().includes(normalized)
  const materialId = route.query.get('material')
  const openMaterial = materialId ? { id: materialId, page: Math.max(1, Number(route.query.get('page')) || 1) } : selected
  function openDocument(id: string) {
    setRevision((value) => value + 1)
    selectDocument(id, 1)
  }
  function selectDocument(id: string, page: number) {
    if (materialId) route.go('/curriculum/materials?' + new URLSearchParams({ material: id, page: String(page) }))
    else setSelected({ id, page })
  }
  const viewed = materials.find((material) => material.id === openMaterial?.id)
  const chapters = subject.theory.filter((chapter) => matches(chapter.title + ' ' + (chapter.summary ?? '') + ' ' + chapter.content.value))
  const requestedChapter = view === 'chapter' ? subject.theory.find((item) => item.id === chapterId) : undefined
  const anchoredChapter = route.hash && view === 'chapter' ? subject.theory.find((item) => {
    const source = new DOMParser().parseFromString(item.content.value, 'text/html')
    return [...source.querySelectorAll('h2, h3, h4')].some((heading) => headingSlug(heading.textContent ?? '') === route.hash)
  }) : undefined
  const currentChapter = anchoredChapter ?? requestedChapter
  const chapterNodes = useRef(new Map<string, HTMLDetailsElement>())
  useEffect(() => {
    if (view !== 'chapter' || !chapterId) return
    openChapter(chapterNodes.current.get(currentChapter?.id ?? chapterId), route.hash)
  }, [view, chapterId, route.hash, keyword, currentChapter])
  function chooseChapter(id: string) {
    route.go('/curriculum/chapter/' + encodeURIComponent(id) + (keyword ? '?' + new URLSearchParams({ search: query }) : ''))
  }
  const menu = <div className="row route-links">
    <button onClick={() => route.go('/curriculum')}>Danh mục chương</button>
    <button onClick={() => route.go('/curriculum/formulas')}>Công thức</button>
    <button onClick={() => route.go('/curriculum/pitfalls')}>Điểm dễ nhầm</button>
  </div>
  if (view === 'formulas' || view === 'pitfalls') {
    const formulas = view === 'formulas'
    return <>
      <h1>{formulas ? 'Tổng hợp công thức' : 'Điểm dễ nhầm'}</h1>{menu}
      {subject.theory.map((chapter) => {
        const source = new DOMParser().parseFromString(chapter.content.value, 'text/html')
        const items = [...source.querySelectorAll(formulas ? 'p, code, section' : 'p, li')]
          .filter((node) => formulas ? node.tagName === 'CODE' ||
            /little|cycle time efficiency|rework loop|M\/M\/1|phân tích luồng/i.test(node.textContent ?? '') :
            /^\s*(điểm dễ nhầm|lưu ý)\s*:/iu.test(node.textContent ?? ''))
          .map((node) => node.outerHTML)
        const excerpts = [...new Set(items)]
        return excerpts.length > 0 && <section className="panel task" key={chapter.id}>
          <h2>{chapter.title}</h2>
          {excerpts.map((value) => <Rich key={value} content={{ format: 'html', value }} theory />)}
          <button onClick={() => chooseChapter(chapter.id)}>Mở chương</button>
        </section>
      })}
    </>
  }
  return <>
    <h1>Lý thuyết và giáo trình</h1>
    {menu}
    {view === 'chapter' && !currentChapter && <p className="panel">Không tìm thấy chương {chapterId}.</p>}
    {anchoredChapter && anchoredChapter.id !== chapterId && <p className="panel">Mục này thuộc {anchoredChapter.title} trong giáo trình hiện tại.</p>}
    <div className="panel task">
      <label>Tìm trong thư viện<input value={query} onChange={(event) => {
        const search = event.target.value
        const params = new URLSearchParams(route.query)
        if (search) params.set('search', search)
        else params.delete('search')
        const path = view === 'materials' ? '/curriculum/materials' : '/curriculum'
        route.go(path + (params.size ? '?' + params : ''), true)
      }} placeholder="Tên chương, giáo trình hoặc từ khóa" /></label>
      <DocumentUpload save={upload} open={openDocument} />
      <small>Ảnh được xếp theo tên tệp. Mỗi tệp tối đa 100 MB. Sao lưu JSON chứa thông tin tài liệu và liên kết. Hãy tải và giữ bản gốc riêng.</small>
    </div>
    <section className="panel task"><h2>Giáo trình</h2>
      {!materials.length && <p className="muted">Chưa có tệp giáo trình cho môn này.</p>}
      {materials.filter((m) => matches(m.title) || m.pages?.some((page) => matches(page.text ?? ''))).map((material) =>
        <div className="row" key={material.id}>
          <button onClick={() => selectDocument(material.id, material.pages?.find((page) =>
            normalized && matches(page.text ?? ''))?.page ?? material.pages?.[0]?.page ?? 1)}><Highlight text={material.title} query={keyword} /></button>
          {material.sourceFile && !material.file && <small className="muted">Chưa có tài liệu PDF</small>}
          {normalized && material.pages?.filter((page) => matches(page.text ?? '')).map((page) => <button key={page.page}
            onClick={() => selectDocument(material.id, page.page)}>Trang {page.page}</button>)}
        </div>)}
      {openMaterial && !viewed && <p role="status">Tài liệu được liên kết chưa có trong kho.</p>}
      {viewed && openMaterial && <div className="task">
        <MaterialViewer material={viewed} start={openMaterial.page} query={keyword} key={openMaterial.id + ':' + openMaterial.page + ':' + revision} />
        <DocumentDownload material={viewed} />
        {!viewed.sourceFile && <DocumentUpload key={viewed.id} material={viewed} save={upload} open={openDocument} />}
        {viewed.kind === 'pptx' && <DocumentUpload key={viewed.id + ':preview'} material={viewed} preview save={upload} open={openDocument} />}
      </div>}
    </section>
    <section className="panel task"><h2><BookOpen size={18} /> Lý thuyết theo chương</h2>
      {chapters.length > 0 ? <label>Đến chương<select value="" onChange={(event) => {
        if (event.target.value) chooseChapter(event.target.value)
      }}>
        <option value="">Chọn chương</option>
        {chapters.map((chapter) => <option key={chapter.id} value={chapter.id}>{chapter.title}</option>)}
      </select></label> : <p className="muted">{keyword ? 'Không tìm thấy chương phù hợp.' : 'Chưa có lý thuyết theo chương.'}</p>}
      {chapters.length > 0 && <div className="reader-index" role="group" aria-label="Mục lục chương">
        {chapters.map((chapter) => <button key={chapter.id} aria-label={chapter.title} title={chapter.title} onClick={() => chooseChapter(chapter.id)}>
          Chương {chapter.id}
        </button>)}
      </div>}
      {(view === 'chapter' ? (currentChapter ? [currentChapter] : []) : chapters).map((chapter) =>
        <details className="theory-chapter" key={chapter.id} ref={(node) => {
          if (node) chapterNodes.current.set(chapter.id, node)
          else chapterNodes.current.delete(chapter.id)
        }}><summary><Highlight text={chapter.title} query={keyword} /></summary>
          <div className="theory-reading">
            {chapter.summary && <aside className="theory-summary"><strong>Tóm tắt chương</strong><p><Highlight text={chapter.summary} query={keyword} /></p></aside>}
            <Rich content={chapter.content} query={keyword} theory />
            <button className="theory-button" onClick={() => practice(chapter.id)}>Ôn chương này</button>
          </div>
        </details>)}
    </section>
  </>
}
