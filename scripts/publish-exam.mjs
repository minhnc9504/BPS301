import { readFile, writeFile } from 'node:fs/promises'
import { resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const publicRoot = resolve('public')
const configPath = resolve(publicRoot, 'data/bps301/subject.json')
const raw = process.env.EXAM_JSON
if (!raw) throw new Error('Thiếu nội dung JSON đề thi.')
const value = JSON.parse(raw)
const vite = await createServer({
  root: fileURLToPath(new URL('..', import.meta.url)),
  server: { middlewareMode: true, hmr: false, watch: null },
  appType: 'custom',
})
let candidate
try {
  const { loadSubjects, parseBank } = await vite.ssrLoadModule('/src/data/storage.ts')
  const exams = parseBank(value, 'bps301')
  if (exams.length !== 1) throw new Error('Mỗi lượt chỉ công khai một bộ đề.')
  candidate = exams[0]
  if (!/^[A-Z0-9]+(?:_[A-Z0-9]+)*$/.test(candidate.id) || candidate.id.length > 100) {
    throw new Error('Mã đề phải gồm chữ hoa, chữ số, gạch dưới và tối đa 100 ký tự.')
  }
  const originalFetch = globalThis.fetch
  try {
    globalThis.fetch = async (url) => {
      const target = resolve(publicRoot, String(url).replace(/^\/+/, ''))
      if (!target.startsWith(publicRoot + sep)) throw new Error('Đường dẫn dữ liệu không hợp lệ.')
      try { return new Response(await readFile(target)) }
      catch (error) {
        if (error.code === 'ENOENT') return new Response(null, { status: 404 })
        throw error
      }
    }
    const subject = (await loadSubjects()).find((item) => item.id === 'bps301')
    if (!subject) throw new Error('Không tìm thấy môn BPS301 trong danh mục.')
    const { examSlug } = await vite.ssrLoadModule('/src/routes.ts')
    const key = candidate.id.toUpperCase()
    if (['ALL', 'RANDOM_50', 'QUICK_15'].includes(key) ||
      subject.exams.some((exam) => exam.id.toUpperCase() === key || examSlug(exam.id).toUpperCase() === key)) {
      throw new Error('Mã đề trùng với mã đang sử dụng.')
    }
    const known = new Set(subject.exams.flatMap((exam) => exam.questions.map((question) => question.id)))
    if (candidate.questions.some((q) => known.has(q.id))) throw new Error('Trùng ID câu hỏi trong ngân hàng công khai.')
  } finally {
    globalThis.fetch = originalFetch
  }
} finally {
  await vite.close()
}

const config = JSON.parse(await readFile(configPath, 'utf8'))
const path = 'data/bps301/exams/' + candidate.id + '.json'
const { uploaded, ...exam } = candidate
await writeFile(resolve(publicRoot, path), JSON.stringify({ version: 1, subjectId: 'bps301', exams: [exam] }, null, 2) + '\n', { flag: 'wx' })
config.exams.push(path)
await writeFile(configPath, JSON.stringify(config, null, 2) + '\n')
console.log('Đã kiểm tra và đăng ký bộ đề ' + candidate.id)
