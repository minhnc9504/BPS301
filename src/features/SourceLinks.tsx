import { createContext, useContext, useEffect, useState } from 'react'
import { hasDocumentFile } from '../data/documentFiles'
import type { Material, SourceLink, SourceTarget } from '../data/model'
import { combineSources, matchesSource, sourceKey } from '../data/slides'

export const SourceContext = createContext<{
  materials: Material[]
  links: SourceLink[]
  open: (id: string, page: number, ready?: (page: number) => void) => void
  save: (link: SourceLink, previous?: SourceLink) => Promise<boolean>
  remove: (link: SourceLink) => Promise<boolean>
} | null>(null)

const labels = { verified: 'Đã xác minh', suggested: 'Gợi ý · chưa xác minh', rejected: 'Đã từ chối', unavailable: 'Chưa có tệp xem trước' }

function canPreview(material: Material | undefined, page: number) {
  return !!material && !!(material.preview || material.localPreview || (material.kind === 'pdf' && (material.file || material.localFile)) ||
    material.pages?.some((item) => item.page === page && (item.image || item.localImage)) ||
    (material.kind === 'images' && material.file && page === 1 && !material.pages?.some((item) => item.image || item.localImage)))
}

function previewKey(material: Material | undefined, page: number) {
  return material?.localPreview ?? (material?.kind === 'pdf' ? material.localFile : undefined) ??
    material?.pages?.find((item) => item.page === page)?.localImage
}

export function SourceLinks({ target, suggestions = [], manage = false, onOpen, resultLabels = false }: {
  target: SourceTarget; suggestions?: SourceLink[]; manage?: boolean; onOpen?: () => void; resultLabels?: boolean
}) {
  const context = useContext(SourceContext)
  const [documentId, setDocumentId] = useState('')
  const [number, setNumber] = useState('')
  const [viewed, setViewed] = useState('')
  const [editing, setEditing] = useState<SourceLink>()
  const [missing, setMissing] = useState<Set<string>>(new Set())
  const entries = combineSources(suggestions, (context?.links ?? []).filter((link) => matchesSource(link, target)))
  const previewKeys = JSON.stringify([...new Set(entries.flatMap((link) => {
    const key = previewKey(context?.materials.find((item) => item.id === link.documentId), link.slideNumber)
    return key ? [key] : []
  }))].sort())
  const materialVersion = context?.materials
  useEffect(() => {
    let active = true
    const keys: string[] = JSON.parse(previewKeys)
    void Promise.all(keys.map(async (key) => {
      try { return await hasDocumentFile(key) ? [] : [key] }
      catch { return [key] }
    })).then((results) => { if (active) setMissing(new Set(results.flat())) })
    return () => { active = false }
  }, [previewKeys, materialVersion])
  if (!context) return null
  const { materials, links, open, save, remove } = context
  const visible = manage ? entries : entries.filter((link) => link.verificationStatus !== 'rejected')
  if (!manage && !visible.length) return resultLabels ? <p className="muted">Chưa có nguồn slide cho câu này.</p> : null
  const slideNumber = Number(number)
  const valid = !!documentId && Number.isSafeInteger(slideNumber) && slideNumber > 0
  const candidate: SourceLink = { ...target, documentId, slideNumber, verificationStatus: 'verified', matchingMethod: 'manual' }
  function view(link: SourceLink) {
    onOpen?.()
    setViewed('')
    open(link.documentId, link.slideNumber, (rendered) => {
      if (rendered === link.slideNumber) setViewed(sourceKey(link))
    })
  }
  function clear() { setEditing(undefined); setDocumentId(''); setNumber(''); setViewed('') }
  return <div className="source-links task">
    {visible.map((link) => {
      const key = sourceKey(link)
      const material = materials.find((item) => item.id === link.documentId)
      const available = canPreview(material, link.slideNumber) && !missing.has(previewKey(material, link.slideNumber) ?? '')
      const status = link.verificationStatus === 'rejected' || link.verificationStatus === 'verified'
        ? link.verificationStatus : available ? 'suggested' : 'unavailable'
      return <div className="curriculum-tool-item task" key={key}>
        <strong>{material?.title ?? link.documentId} · Slide {link.slideNumber}</strong>
        {resultLabels && material?.file?.startsWith('materials/') && <small>{material.file.split('/').at(-1)}</small>}
        <span className="tag">{resultLabels && status === 'suggested' ? 'Nguồn gợi ý' : labels[status]}</span>
        {!available && status === 'verified' && <small>Chưa có tệp xem trước</small>}
        <div className="row">
          {available && status !== 'rejected' && <button onClick={() => view(link)}>Xem slide {link.slideNumber}</button>}
          {manage && <>
            {available && status !== 'verified' && viewed === key &&
              <button onClick={() => save({ ...link, verificationStatus: 'verified', matchingMethod: 'manual' })}>Xác minh nguồn</button>}
            {status !== 'rejected' && <button onClick={() => save({ ...link, verificationStatus: 'rejected', matchingMethod: 'manual' })}>Từ chối</button>}
            <button onClick={() => {
              setEditing(link); setDocumentId(link.documentId); setNumber(String(link.slideNumber)); setViewed('')
            }}>Đổi liên kết</button>
            {links.some((item) => sourceKey(item) === key) && !suggestions.some((item) => sourceKey(item) === key) &&
              <button onClick={() => { if (window.confirm('Xóa liên kết slide này?')) remove(link) }}>Xóa liên kết</button>}
            {status === 'rejected' && <button onClick={() => save({ ...link, verificationStatus: 'suggested' })}>Mở lại gợi ý</button>}
          </>}
        </div>
      </div>
    })}
    {manage && <details open={editing ? true : undefined}>
      <summary>{editing ? 'Thay đổi liên kết nguồn' : 'Thêm liên kết nguồn'}</summary>
      <div className="task">
        {!materials.length && <p className="muted">Thêm tài liệu tại Giáo trình → Tệp giáo trình để gắn nguồn.</p>}
        <label>Tài liệu nguồn<select value={documentId} onChange={(event) => { setDocumentId(event.target.value); setViewed('') }}>
          <option value="">Chọn tài liệu</option>
          {materials.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
        </select></label>
        <label>Số slide<input type="number" min={1} value={number} onChange={(event) => { setNumber(event.target.value); setViewed('') }} /></label>
        <div className="row">
          <button disabled={!valid || !canPreview(materials.find((item) => item.id === documentId), slideNumber)} onClick={() => view(candidate)}>Xem slide để xác minh</button>
          <button disabled={!valid} onClick={async () => {
            if (await save({ ...candidate, verificationStatus: 'suggested' }, editing)) clear()
          }}>Lưu gợi ý</button>
          <button disabled={!valid || viewed !== sourceKey(candidate)} onClick={async () => {
            if (await save(candidate, editing)) clear()
          }}>Lưu liên kết đã xác minh</button>
          {editing && <button onClick={clear}>Hủy đổi</button>}
        </div>
      </div>
    </details>}
  </div>
}
