const databaseName = 'bpms-document-files-v1'
const storeName = 'documents'
export const maxFileBytes = 100 * 1024 * 1024

export async function fileKind(file: File) {
  if (!file.size || file.size > maxFileBytes) throw new Error('Tệp rỗng hoặc vượt giới hạn 100 MB.')
  const head = new Uint8Array(await file.slice(0, 8).arrayBuffer())
  const ext = file.name.split('.').at(-1)?.toLowerCase()
  if (ext === 'pdf' && new TextDecoder().decode(head).startsWith('%PDF-')) return 'pdf'
  if (ext === 'pptx' && head[0] === 80 && head[1] === 75 && head[2] === 3 && head[3] === 4) return 'pptx'
  if (ext === 'png' && head.join(',') === '137,80,78,71,13,10,26,10') return 'images'
  if ((ext === 'jpg' || ext === 'jpeg') && head[0] === 255 && head[1] === 216 && head[2] === 255) return 'images'
  throw new Error('Định dạng hoặc chữ ký tệp không hợp lệ: ' + file.name)
}
async function database(): Promise<IDBDatabase> {
  if (!globalThis.indexedDB) throw new Error('Trình duyệt không cấp quyền truy cập IndexedDB.')
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(storeName)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('Kho tệp bị khóa bởi tab khác.'))
  })
}

export async function getDocumentFile(key: string): Promise<Blob | undefined> {
  const db = await database()
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction(storeName).objectStore(storeName).get(key)
      request.onsuccess = () => resolve(request.result instanceof Blob ? request.result : undefined)
      request.onerror = () => reject(request.error)
    })
  } finally { db.close() }
}
export async function hasDocumentFile(key: string): Promise<boolean> {
  const db = await database()
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction(storeName).objectStore(storeName).count(key)
      request.onsuccess = () => resolve(request.result > 0)
      request.onerror = () => reject(request.error)
    })
  } finally { db.close() }
}
export async function putDocumentFiles(files: [string, Blob][]) {
  const db = await database()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite')
      transaction.oncomplete = () => resolve()
      transaction.onabort = () => reject(transaction.error ?? new Error('Không ghi được tệp.'))
      for (const [key, file] of files) transaction.objectStore(storeName).put(file, key)
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      throw new Error('IndexedDB đã hết dung lượng. Hãy giải phóng bộ nhớ trình duyệt rồi thử lại.')
    }
    throw error
  } finally { db.close() }
}
export async function removeDocumentFiles(keys: string[]) {
  const db = await database()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite')
      transaction.oncomplete = () => resolve()
      transaction.onabort = () => reject(transaction.error ?? new Error('Không xóa được tệp.'))
      for (const key of keys) transaction.objectStore(storeName).delete(key)
    })
  } finally { db.close() }
}
