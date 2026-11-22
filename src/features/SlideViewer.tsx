import { useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import worker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { Highlight } from '../components/Question'
import { getDocumentFile } from '../data/documentFiles'
import type { Material } from '../data/model'
import { slideNumbers, slidePosition } from '../data/slides'
import { asset } from '../data/storage'

export function MaterialViewer({ material, start, query = '', onReady }: {
  material: Material; start: number; query?: string; onReady?: (page: number) => void
}) {
  const [pdf, setPdf] = useState<PDFDocumentProxy>()
  const [requested, setRequested] = useState(start)
  const [zoom, setZoom] = useState(1)
  const [fit, setFit] = useState<'width' | 'page'>('page')
  const [availableWidth, setWidth] = useState(640)
  const [image, setImage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)
  const viewer = useRef<HTMLDivElement>(null)
  const viewport = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const ready = useRef(onReady)
  ready.current = onReady
  const pdfPath = material.preview ?? (material.kind === 'pdf' ? material.file : undefined)
  const pdfKey = material.localPreview ?? (material.kind === 'pdf' ? material.localFile : undefined)
  const imagePages = (material.pages ?? []).filter((item) => item.image || item.localImage).map((item) => item.page)
  const singleImage = material.kind === 'images' && !imagePages.length ? material.file : undefined
  const pages = slideNumbers(pdf?.numPages ?? 0, singleImage ? [1] : imagePages)
  const page = slidePosition(pages, requested)
  const index = pages.indexOf(page)
  const item = material.pages?.find((entry) => entry.page === page)
  const imagePath = item?.image ?? singleImage
  function move(delta: number) {
    const next = pages[index + delta]
    if (next !== undefined && next !== page) {
      setLoading(true)
      setRequested(next)
    }
  }
  useEffect(() => {
    if (!viewport.current) return
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(viewport.current)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    if (!pdfPath && !pdfKey) return
    let canceled = false
    let destroy: (() => Promise<void>) | undefined
    async function load() {
      try {
        const library = await import('pdfjs-dist')
        library.GlobalWorkerOptions.workerSrc = worker
        const blob = pdfKey ? await getDocumentFile(pdfKey) : undefined
        if (canceled) return
        if (pdfKey && !blob) {
          setError('Thiếu tệp PDF. Hãy gắn lại tệp trong Kho tài liệu.')
          setLoading(false)
          return
        }
        const source = blob ? new Uint8Array(await blob.arrayBuffer()) : asset(pdfPath!)
        if (canceled) return
        const task = library.getDocument({ ...(typeof source === 'string' ? { url: source } : { data: source }) })
        destroy = () => task.destroy()
        const document = await task.promise
        if (!canceled) setPdf(document)
      } catch (cause) {
        if (!canceled) {
          const failure = cause instanceof Error ? cause : undefined
          const missing = failure?.name === 'ResponseException' && 'missing' in failure && failure.missing
          setError(missing ? 'Chưa có tài liệu PDF tại đường dẫn đã khai báo.'
            : failure?.name === 'InvalidPDFException' ? 'Tệp PDF bị hỏng hoặc không đúng định dạng.'
              : failure?.name === 'PasswordException' ? 'Tệp PDF được bảo vệ bằng mật khẩu. Hãy mở một bản có thể xem.'
                : 'Không mở được PDF. Hãy kiểm tra kết nối hoặc thử gắn lại tệp gốc.')
          setLoading(false)
        }
      }
    }
    void load()
    return () => { canceled = true; void destroy?.().catch(() => {}) }
  }, [pdfKey, pdfPath])
  useEffect(() => {
    if (!pdf || !page || !canvas.current) return
    let canceled = false
    let cancel: (() => void) | undefined
    const surface = canvas.current
    setLoading(true)
    setError('')
    void pdf.getPage(page).then((entry) => {
      if (canceled) return
      const base = entry.getViewport({ scale: 1 })
      const widthScale = Math.max(0.1, (availableWidth - 16) / base.width)
      const pageScale = Math.max(0.1, (window.innerHeight * .58) / base.height)
      const scale = zoom * (fit === 'page' ? Math.min(widthScale, pageScale) : widthScale)
      const density = Math.min(window.devicePixelRatio || 1, 2)
      const view = entry.getViewport({ scale: scale * density })
      surface.width = Math.ceil(view.width)
      surface.height = Math.ceil(view.height)
      surface.style.width = view.width / density + 'px'
      surface.style.height = view.height / density + 'px'
      const context = surface.getContext('2d')
      if (!context) throw new Error('Trình duyệt không hỗ trợ hiển thị PDF.')
      const render = entry.render({ canvas: surface, canvasContext: context, viewport: view })
      cancel = () => render.cancel()
      return render.promise.then(() => {
        if (!canceled) ready.current?.(page)
      })
    }).catch(() => {
      if (!canceled) setError('Không hiển thị được trang PDF này.')
    }).finally(() => { if (!canceled) setLoading(false) })
    return () => { canceled = true; cancel?.() }
  }, [pdf, page, fit, zoom, availableWidth])
  useEffect(() => {
    if (pdfKey || pdfPath) return
    let canceled = false
    let url: string | undefined
    setImage('')
    setError('')
    if (!item?.localImage && !imagePath) {
      setLoading(false)
      return
    }
    setLoading(true)
    if (item?.localImage) {
      void getDocumentFile(item.localImage).then((blob) => {
        if (canceled) return
        if (!blob) throw new Error('Thiếu ảnh. Hãy gắn lại tệp trong Kho tài liệu.')
        url = URL.createObjectURL(blob)
        setImage(url)
      }).catch((cause) => {
        if (!canceled) { setError(String(cause)); setLoading(false) }
      })
    } else if (imagePath) setImage(asset(imagePath))
    return () => { canceled = true; if (url) URL.revokeObjectURL(url) }
  }, [item, imagePath, pdfKey, pdfPath])
  async function toggleFullscreen() {
    if (document.fullscreenElement === viewer.current) {
      await document.exitFullscreen()
    } else if (expanded) setExpanded(false)
    else {
      try {
        if (!viewer.current?.requestFullscreen) throw new Error()
        await viewer.current.requestFullscreen()
      } catch { setExpanded(true) }
    }
  }
  return <div ref={viewer} className={'slide-viewer task' + (expanded ? ' slide-expanded' : '')}
    tabIndex={0} role="region" aria-label="Trình xem slide" onKeyDown={(event) => {
      if (event.target instanceof HTMLElement && event.target.closest('input, select, textarea, [contenteditable]')) return
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault()
        move(event.key === 'ArrowLeft' ? -1 : 1)
      }
      if (event.key === 'Escape' && expanded) { event.stopPropagation(); setExpanded(false) }
    }}>
    <strong>{material.title}</strong>
    <div className="row slide-toolbar">
      <button disabled={index <= 0} onClick={() => move(-1)}>Trang trước</button>
      <span aria-live="polite">{page ? 'Trang ' + page + ' · ' + (index + 1) + '/' + pages.length : 'Chưa có trang'}</span>
      <button disabled={index < 0 || index >= pages.length - 1} onClick={() => move(1)}>Trang sau</button>
      <button aria-label="Thu nhỏ" disabled={zoom <= .5} onClick={() => setZoom(zoom - .25)}>−</button>
      <span>{Math.round(zoom * 100)}%</span>
      <button aria-label="Phóng to" disabled={zoom >= 3} onClick={() => setZoom(zoom + .25)}>+</button>
      <button aria-pressed={fit === 'width'} onClick={() => { setFit('width'); setZoom(1) }}>Vừa chiều rộng</button>
      <button aria-pressed={fit === 'page'} onClick={() => { setFit('page'); setZoom(1) }}>Vừa trang</button>
      <button onClick={() => void toggleFullscreen()}>Toàn màn hình</button>
    </div>
    {page && page !== requested && <p role="status">Trang {requested} không có trong tài liệu.</p>}
    {loading && <p role="status">Đang tải slide…</p>}
    {error && <p role="alert">{error}</p>}
    {!loading && !error && !page && <p>{material.kind === 'pptx'
      ? 'PPTX chưa có bản xem trước. Hãy gắn PDF được xuất từ PowerPoint trong Kho tài liệu.'
      : 'Chưa có tài liệu PDF hoặc ảnh cho mục này.'}</p>}
    <div className="slide-stage" ref={viewport}>
      {(pdfPath || pdfKey) && <canvas ref={canvas} hidden={loading || !!error} aria-label={'Trang PDF ' + page} />}
      {image && !error && <img key={image} src={image} alt={material.title + ' · trang ' + page}
        style={{ width: fit === 'width' ? zoom * 100 + '%' : undefined, maxWidth: fit === 'page' ? zoom * 100 + '%' : 'none',
          maxHeight: fit === 'page' ? zoom * 58 + 'vh' : undefined }}
        onLoad={() => { setLoading(false); if (page) ready.current?.(page) }}
        onError={() => { setLoading(false); setError('Không hiển thị được ảnh slide.') }} />}
    </div>
    {item?.text && <p><Highlight text={item.text} query={query} /></p>}
  </div>
}
