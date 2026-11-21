import { useEffect, useState } from 'react'
import { BookOpen, FileText } from 'lucide-react'
import { Rich } from '../components/Question'
import { asset, message, parseMaterial } from '../data/storage'
import type { Material, Subject } from '../data/model'

export function Library({ subject, materials, upload, practice }: {
  subject: Subject; materials: Material[]; upload: (material: Material) => boolean; practice: (chapterId: string) => void
}) {
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<{ id: string; page: number }>()
  const normalized = query.trim().toLowerCase()
  const matches = (text: string) => text.toLowerCase().includes(normalized)
  const viewed = materials.find((material) => material.id === selected?.id)
  return <>
    <h1>Lý thuyết và giáo trình</h1>
    <div className="panel task">
      <label>Tìm trong thư viện<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tên chương, giáo trình hoặc từ khóa" /></label>
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
            normalized && matches(page.text ?? ''))?.page ?? material.pages?.[0]?.page ?? 1 })}>{material.title}</button>
          {normalized && material.pages?.filter((page) => matches(page.text ?? '')).map((page) => <button key={page.page}
            onClick={() => setSelected({ id: material.id, page: page.page })}>Trang {page.page}</button>)}
        </div>)}
      {viewed && selected && <MaterialViewer material={viewed} start={selected.page} key={selected.id + ':' + selected.page} />}
    </section>
    <section className="panel task"><h2><BookOpen size={18} /> Lý thuyết theo chương</h2>
      {subject.theory.filter((chapter) => matches(chapter.title + ' ' + chapter.summary + ' ' + chapter.content.value)).map((chapter) =>
        <details key={chapter.id}><summary>{chapter.title}</summary>
          {chapter.summary && <p className="muted">{chapter.summary}</p>}
          <Rich content={chapter.content} />
          <button className="theory-button" onClick={() => practice(chapter.id)}>Ôn chương này</button>
        </details>)}
    </section>
  </>
}

export function MaterialViewer({ material, start }: { material: Material; start: number }) {
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
    {item?.text && <p>{item.text}</p>}
  </div>
}
