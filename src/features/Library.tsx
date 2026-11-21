import { useEffect, useRef, useState } from 'react'
import { BookOpen, FileText } from 'lucide-react'
import { Highlight, Rich } from '../components/Question'
import { asset, message, parseMaterial } from '../data/storage'
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
  subject: Subject; materials: Material[]; upload: (material: Material) => boolean; practice: (chapterId: string) => void
}) {
  const route = useRoute()
  const [view, chapterId] = route.segments
  const query = route.query.get('search') ?? ''
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<{ id: string; page: number }>()
  const keyword = query.trim()
  const normalized = keyword.toLowerCase()
  const matches = (text: string) => text.toLowerCase().includes(normalized)
  const materialId = route.query.get('material')
  const openMaterial = materialId ? { id: materialId, page: Math.max(1, Number(route.query.get('page')) || 1) } : selected
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
        route.go('/curriculum' + (search ? '?' + new URLSearchParams({ search }) : ''), true)
      }} placeholder="Tên chương, giáo trình hoặc từ khóa" /></label>
      <label className="file-field"><FileText size={18} /> Thêm PDF, PPTX hoặc ảnh từ máy
        <input type="file" accept=".pdf,.pptx,.png,.jpeg,.jpg,.gif,.webp" onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (!file) return
          setError('')
          const extension = file.name.split('.').pop()?.toLowerCase()
          const info = extension === 'pdf' ? ['pdf', 'application/pdf'] :
            extension === 'pptx' ? ['pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'] :
              extension && ['png', 'jpeg', 'jpg', 'gif', 'webp'].includes(extension)
                ? ['images', 'image/' + (extension === 'jpg' ? 'jpeg' : extension)] : undefined
          if (!info || !file.size || file.size > 1_500_000) {
            setError('Chọn tệp hợp lệ tối đa 1,5 MB. Tệp lớn có thể đặt trong public/materials/.')
            return
          }
          const reader = new FileReader()
          reader.onerror = () => setError('Không đọc được tệp.')
          reader.onload = () => {
            try {
              const data = String(reader.result).replace(/^data:[^;]*;/, 'data:' + info[1] + ';')
              const id = crypto.randomUUID()
              const material = parseMaterial({ id, title: file.name, kind: info[0], file: data,
                pages: info[0] === 'images' ? [{ page: 1, image: data }] : undefined })
              if (upload(material)) setSelected({ id, page: 1 })
            } catch (error) { setError(message(error)) }
          }
          reader.readAsDataURL(file)
        }} />
      </label>
      {error && <p role="alert">{error}</p>}
    </div>
    <section className="panel task"><h2>Giáo trình</h2>
      {!materials.length && <p className="muted">Chưa có tệp giáo trình cho môn này.</p>}
      {materials.filter((m) => matches(m.title) || m.pages?.some((page) => matches(page.text ?? ''))).map((material) =>
        <div className="row" key={material.id}>
          <button onClick={() => setSelected({ id: material.id, page: material.pages?.find((page) =>
            normalized && matches(page.text ?? ''))?.page ?? material.pages?.[0]?.page ?? 1 })}><Highlight text={material.title} query={keyword} /></button>
          {normalized && material.pages?.filter((page) => matches(page.text ?? '')).map((page) => <button key={page.page}
            onClick={() => setSelected({ id: material.id, page: page.page })}>Trang {page.page}</button>)}
        </div>)}
      {viewed && openMaterial && <MaterialViewer material={viewed} start={openMaterial.page} query={keyword} key={openMaterial.id + ':' + openMaterial.page} />}
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

export function MaterialViewer({ material, start, query = '' }: { material: Material; start: number; query?: string }) {
  const [page, setPage] = useState(start)
  const [localPdf, setLocalPdf] = useState('')
  const item = material.pages?.find((entry) => entry.page === page)
  const pdf = material.preview ?? (material.kind === 'pdf' ? material.file : undefined)
  useEffect(() => {
    if (!pdf?.startsWith('data:')) return
    const binary = atob(pdf.split(',')[1])
    const url = URL.createObjectURL(new Blob([Uint8Array.from(binary, (byte) => byte.charCodeAt(0))], { type: 'application/pdf' }))
    setLocalPdf(url)
    return () => URL.revokeObjectURL(url)
  }, [pdf])
  const pdfUrl = pdf ? (pdf.startsWith('data:') ? localPdf : asset(pdf)) : ''
  const pageUrl = pdfUrl && pdfUrl + '#page=' + (page || 1)
  return <div className="task">
    <div className="row spread"><strong>{material.title}</strong>
      {material.file && <a className="button" href={asset(material.file)} download={material.title}>Tải tệp gốc</a>}
    </div>
    {(pdf || material.pages?.length) && (pdf ? <label>Số trang<input type="number" value={page || ''} min={1}
      onChange={(event) => setPage(Math.max(0, Number(event.target.value)))} /></label> :
      <label>Trang<select value={page} onChange={(event) => setPage(Number(event.target.value))}>
        {!item && <option value={page}>{page} (chưa có)</option>}
        {material.pages?.map((entry) => <option key={entry.page} value={entry.page}>{entry.page}</option>)}
      </select></label>)}
    {item?.image ? <img className="slide" src={asset(item.image)} alt={material.title + ' · trang ' + page} /> :
      pdf ? pageUrl && <div className="task">
        <div><a className="button" href={pageUrl} target="_blank" rel="noreferrer">Mở PDF trong tab mới</a></div>
        <iframe className="pdf" title={material.title} src={pageUrl} />
      </div> :
        <p className="muted">{material.kind === 'pptx' ? 'PPTX chưa có PDF hoặc ảnh xem trước ở trang này.' : 'Chưa có ảnh cho trang này.'}</p>}
    {item?.text && <p><Highlight text={item.text} query={query} /></p>}
  </div>
}
