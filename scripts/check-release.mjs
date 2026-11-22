import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { resolve, sep } from 'node:path'
import { runInNewContext } from 'node:vm'
import { gzipSync } from 'node:zlib'
import { getDocument, VerbosityLevel } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { parseBank } from '../src/data/storage.ts'

const output = resolve('dist')
const base = '/BPS301/'
async function asset(path) {
  const file = resolve(output, path)
  assert.ok(file.startsWith(output + sep), 'Asset outside dist: ' + path)
  return readFile(file)
}
const json = async (path) => JSON.parse(await asset(path))
const unique = (items, label) => assert.equal(new Set(items).size, items.length, 'Duplicate ' + label)
const catalog = await json('data/catalog.json')
const subjects = await Promise.all(catalog.subjects.map(json))
const subject = subjects.find((item) => item.id === 'bps301')
assert.ok(subject)
const banks = (await Promise.all(subject.exams.map(async (path) => parseBank(await json(path), subject.id, false, path)))).flat()
const questions = banks.flatMap((bank) => bank.questions)
unique(banks.map((bank) => bank.id), 'exam IDs')
unique(questions.map((question) => question.id), 'question IDs')
const theory = await json(subject.theory)
const manifest = await json(subject.materialsManifest)
assert.equal(manifest.version, 1)
unique(theory.map((lecture) => lecture.id), 'lecture IDs')
unique(manifest.materials.map((item) => item.sourceFile), 'manifest source files')
assert.equal(manifest.materials.length, theory.length)
const expectedPdfs = new Set(await readdir(resolve(output, 'materials/bps301')))
let pages = 0
let references = 0
for (const lecture of theory) {
  const entry = manifest.materials.find((item) => item.sourceFile === lecture.sourceFile)
  assert.ok(entry?.file?.startsWith('materials/bps301/') && entry.kind === 'pdf', 'Missing PDF for ' + lecture.id)
  assert.ok(expectedPdfs.delete(entry.file.split('/').at(-1)), 'Repeated or missing asset: ' + entry.file)
  const task = getDocument({ data: new Uint8Array(await asset(entry.file)), verbosity: VerbosityLevel.ERRORS })
  try {
    const pdf = await task.promise
    assert.equal(pdf.numPages, lecture.slideCount, entry.file)
    unique(lecture.slides.map((slide) => slide.slideNumber), 'slide numbers in ' + entry.file)
    for (const page of lecture.slides.map((slide) => slide.slideNumber)) assert.ok(Number.isInteger(page) && page >= 1 && page <= pdf.numPages)
    for (const section of [...lecture.sections, ...(lecture.supplementalTheory ?? [])]) {
      for (const slide of section.sourceSlides ?? []) {
        const page = Number(typeof slide === 'object' ? slide.page ?? slide.slideNumber ?? slide.slide : slide)
        assert.ok(Number.isInteger(page) && page >= 1 && page <= pdf.numPages, 'Invalid reference in ' + lecture.id)
        references++
      }
    }
    pages += pdf.numPages
  } finally { await task.destroy() }
}
assert.deepEqual([...expectedPdfs].filter((file) => /\.pdf$/i.test(file)), [], 'PDF not listed in manifest')
const index = (await asset('index.html')).toString()
const fallback = (await asset('404.html')).toString()
assert.ok(index.includes('href="' + base + 'img/logo.jpg"'))
assert.ok(index.includes('const base = ' + JSON.stringify(base).replaceAll('"', "'")))
assert.ok(fallback.includes("const base = '" + base + "'") && fallback.includes("?__spa="))
assert.ok(index.includes("get('__spa')"))
assert.ok(!/localhost|%BASE_URL%/.test(index + fallback))
assert.equal((await asset('img/logo.jpg')).readUInt16BE(0), 0xffd8)
const script = (html) => html.match(/<script>([\s\S]*?)<\/script>/)?.[1]
assert.ok(script(index) && script(fallback))
for (const route of ['curriculum/chapter/11?section=11.1#overview', 'trainning/exam/fa26_fe?review=needed',
  'mock_exam/fa26_fe/result?session=example', 'question_bank/detail/example', 'settings']) {
  let redirected
  const origin = 'https://example.invalid'
  const initial = new URL(base + route, origin)
  runInNewContext(script(fallback), { location: { pathname: initial.pathname, search: initial.search, hash: initial.hash,
    replace: (path) => { redirected = new URL(path, origin) } }, encodeURIComponent })
  assert.ok(redirected)
  let restored
  runInNewContext(script(index), { location: { pathname: redirected.pathname, search: redirected.search, origin },
    URL, URLSearchParams, history: { replaceState: (_state, _title, path) => { restored = String(path) } } })
  assert.equal(restored, initial.href)
}
const entryPaths = [...index.matchAll(/(?:src|href)="(\/[^"]+)"/g)].map((match) => match[1])
assert.ok(entryPaths.some((path) => path.endsWith('.js')))
for (const path of entryPaths) {
  assert.ok(path.startsWith(base), 'Incorrect base: ' + path)
  await asset(path.slice(base.length))
}
const entryJs = await Promise.all(entryPaths.filter((path) => path.endsWith('.js')).map((path) => asset(path.slice(base.length))))
const compressed = entryJs.reduce((size, data) => size + gzipSync(data).length, 0)
assert.ok(compressed <= 145_000, 'Initial JS exceeds 145 kB gzip: ' + compressed)
const assets = await readdir(resolve(output, 'assets'))
assert.ok(assets.some((name) => /^pdf\.worker.+\.mjs$/.test(name)), 'PDF worker missing')
console.log(JSON.stringify({ exams: banks.length, questions: questions.length, lectures: theory.length,
  sections: theory.reduce((total, lecture) => total + lecture.sections.length, 0),
  supplemental: theory.reduce((total, lecture) => total + (lecture.supplementalTheory?.length ?? 0), 0),
  pdfs: manifest.materials.length, pages, references, entryGzipBytes: compressed }, null, 2))
