import { useState } from 'react'
import { fileKind, getDocumentFile, putDocumentFiles, removeDocumentFiles } from '../data/documentFiles'
import type { Material } from '../data/model'
import { asset, message } from '../data/storage'

export function DocumentUpload({ save, open, material, preview = false }: {
  save: (material: Material) => Promise<boolean>; open: (id: string) => void; material?: Material; preview?: boolean
}) {
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  async function upload(files: File[]) {
    if (!files.length) return
    setPending(true)
    setError('')
    try {
      if (!navigator.locks) throw new Error('Chế độ chỉ đọc. Hãy dùng trình duyệt có Web Locks để nhập tài liệu.')
      const kinds = await Promise.all(files.map(fileKind))
      const kind = kinds[0]
      if (kinds.some((value) => value !== kind) || (kind !== 'images' && files.length !== 1)) {
        throw new Error('Chọn một PDF, một PPTX hoặc một nhóm ảnh slide.')
      }
      if (material && kind !== (preview ? 'pdf' : material.kind)) throw new Error('Tệp không đúng định dạng của tài liệu.')
      const id = material?.id ?? crypto.randomUUID()
      const next: Material = material ? { ...material } : { id, title: files[0].name, kind }
      const entries: [string, Blob][] = []
      const fingerprints = { ...next.localFingerprints }
      const newKeys: string[] = []
      const add = (file: File, existing?: string) => {
        const key = existing ?? crypto.randomUUID()
        if (!existing) newKeys.push(key)
        entries.push([key, file])
        return key
      }
      if (kind === 'images') {
        const existing = material?.pages?.filter((page) => page.localImage || page.image).sort((a, b) => a.page - b.page)
        if (existing?.length && existing.length !== files.length) throw new Error('Chọn đủ ảnh theo đúng số lượng và thứ tự của tài liệu.')
        const ordered = [...files].sort((a, b) => a.name.localeCompare(b.name, 'vi', { numeric: true }))
        const imported = ordered.map((file, index) => ({
          ...existing?.[index], page: existing?.[index].page ?? index + 1, localImage: add(file, existing?.[index].localImage),
        }))
        next.pages = [...(material?.pages?.filter((page) => !imported.some((item) => item.page === page.page)) ?? []), ...imported]
        if (!material && files.length > 1) next.title = files[0].name + ' · ' + files.length + ' ảnh slide'
      } else if (preview) next.localPreview = add(files[0], material?.localPreview)
      else next.localFile = add(files[0], material?.localFile)
      for (const [key, file] of entries) {
        const bytes = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
        const hash = Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('')
        if (fingerprints[key] && fingerprints[key] !== hash) {
          throw new Error('Tệp khác với bản gốc đã được lưu. Hãy nhập thành tài liệu mới nếu muốn dùng bản khác.')
        }
        fingerprints[key] = hash
      }
      next.localFingerprints = fingerprints
      await putDocumentFiles(entries)
      if (!await save(next)) {
        await removeDocumentFiles(newKeys)
        throw new Error('Không lưu được thông tin tài liệu.')
      }
      open(id)
    } catch (cause) { setError(message(cause)) }
    finally { setPending(false) }
  }
  return <div className="task">
    <label className="file-field">{preview ? 'Gắn bản xem trước PDF' : material ? 'Gắn lại tệp gốc' : 'Thêm PDF, PPTX hoặc ảnh slide'}
      <input type="file" aria-label={preview ? 'Gắn bản xem trước PDF' : material ? 'Gắn lại tệp gốc' : 'Thêm tài liệu'}
        multiple={!preview && (!material || material.kind === 'images')} disabled={pending}
        accept={preview ? '.pdf' : '.pdf,.pptx,.png,.jpg,.jpeg'} onChange={(event) => {
          const files = Array.from(event.target.files ?? [])
          event.target.value = ''
          void upload(files)
        }} />
    </label>
    {pending && <p role="status">Đang lưu tệp…</p>}
    {error && <p role="alert">{error}</p>}
  </div>
}

export function DocumentDownload({ material }: { material: Material }) {
  const [error, setError] = useState('')
  const files = [
    { title: 'Tải tệp gốc', path: material.file, key: material.localFile, name: material.title },
    { title: 'Tải PDF xem trước', path: material.preview, key: material.localPreview, name: material.title.replace(/\.pptx$/i, '') + '.pdf' },
    ...(material.pages ?? []).map((page) => ({ title: 'Tải ảnh trang ' + page.page, path: page.image, key: page.localImage, name: 'slide-' + page.page })),
  ].filter((file) => file.key || file.path)
  return <><div className="row">{files.map((file) => <button key={file.title} onClick={async () => {
    setError('')
    try {
      const blob = file.key ? await getDocumentFile(file.key) : undefined
      if (file.key && !blob) throw new Error('Thiếu tệp. Hãy gắn lại từ bản gốc.')
      const url = blob ? URL.createObjectURL(blob) : asset(file.path!)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = file.name + (blob instanceof File && file.title.startsWith('Tải ảnh') ? '.' + blob.name.split('.').at(-1) : '')
      anchor.click()
      if (blob) window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (cause) { setError(message(cause)) }
  }}>{file.title}</button>)}</div>{error && <p role="alert">{error}</p>}</>
}
