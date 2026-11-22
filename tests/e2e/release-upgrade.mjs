import assert from 'node:assert/strict'
import { createServer } from 'node:https'
import { readFile, stat } from 'node:fs/promises'
import { resolve, sep } from 'node:path'
const { chromium } = await import(process.env.BPMS_PLAYWRIGHT_MODULE || 'playwright-core')
const work = resolve(process.env.BPMS_RELEASE_QA)
const previous = resolve(work, 'old/dist')
let dir = previous
const mime = { html: 'text/html', css: 'text/css', js: 'text/javascript', mjs: 'text/javascript',
  json: 'application/json', pdf: 'application/pdf', jpg: 'image/jpeg' }
const tls = { key: await readFile(resolve(work, 'key.pem')), cert: await readFile(resolve(work, 'cert.pem')) }
const server = createServer(tls, async (request, response) => {
  const { pathname } = new URL(request.url, 'https://localhost')
  if (!pathname.startsWith('/BPS301/')) return response.writeHead(404).end()
  const path = resolve(dir, decodeURIComponent(pathname.slice('/BPS301/'.length)) || 'index.html')
  if (!path.startsWith(dir + sep)) return response.writeHead(404).end()
  try {
    const bytes = await readFile(path)
    response.writeHead(200, {
      'Content-Type': mime[path.split('.').at(-1)] ?? 'application/octet-stream',
      'Cache-Control': pathname.startsWith('/BPS301/assets/') ? 'public, max-age=600' : 'no-cache',
    }).end(bytes)
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/html' }).end(await readFile(resolve(dir, '404.html')))
  }
})
await new Promise((done) => server.listen(0, '127.0.0.1', done))
const base = 'https://127.0.0.1:' + server.address().port + '/BPS301'
const executablePath = process.env.BPMS_CHROME || undefined
const profile = resolve(work, 'profile-' + Date.now())
const options = { executablePath, ignoreHTTPSErrors: true, viewport: { width: 1440, height: 960 } }
const id = 'BPS301_FA26_FE_805603_1'
const realPdf = resolve('public/materials/bps301/Lecture1-Introduction.pdf')
const button = (page, name) => page.locator('main').getByRole('button', { name, exact: true })
const getStudy = (page) => page.evaluate(() => {
  const progress = JSON.parse(localStorage.getItem('bps301_user_progress_v1') ?? localStorage.getItem('smart-exam-v1'))
  return progress.subjects.bps301
})
const useContext = async (context) => {
  await context.route('https://fonts.googleapis.com/**', (route) => route.abort())
  const page = context.pages()[0] ?? await context.newPage()
  page.setDefaultTimeout(15000)
  return page
}
let persistent
let browser
try {
  persistent = await chromium.launchPersistentContext(profile, options)
  let page = await useContext(persistent)
  await page.goto(base + '/trainning/question/' + id)
  await page.locator('.choices input').first().click()
  await page.locator('.feedback').waitFor()
  await button(page, 'Ôn lại sau').click()
  await page.goto(base + '/curriculum/chapter/1?section=1.1')
  await button(page, 'Đánh dấu đã học').click()
  await button(page, 'Đã học · Bỏ đánh dấu').waitFor()
  await button(page, 'Xem slide 5').click()
  await page.locator('canvas[aria-label="Trang PDF 5"]:not([hidden])').waitFor()
  await button(page, 'Đóng giáo trình').click()
  await button(page, 'Xác minh nguồn').click()
  await page.getByText('Đã xác minh', { exact: true }).waitFor()
  await page.goto(base + '/mock_exam/fa26_fe')
  await page.getByLabel('Số câu').fill('2')
  await button(page, 'Bắt đầu thi').click()
  await page.waitForURL('**/q/1?session=*')
  await button(page, 'Nộp bài').click()
  await button(page, 'Nộp bài ngay').click()
  await page.getByRole('heading', { name: 'Kết quả thi thử' }).waitFor()
  await page.goto(base + '/curriculum/materials')
  await page.getByLabel('Thêm tài liệu').setInputFiles(realPdf)
  await page.locator('canvas[aria-label="Trang PDF 1"]:not([hidden])').waitFor()
  const before = await getStudy(page)
  assert.ok(before.reviewLater[id])
  assert.equal(before.sourceLinks[0].verificationStatus, 'verified')
  const storage = await page.evaluate(async () => ({
    keys: Object.values(localStorage).reduce((total, value) => total + value.length * 2, 0),
    estimate: await navigator.storage.estimate(), cacheNames: await caches.keys(),
  }))
  await persistent.close()
  persistent = undefined
  dir = resolve('dist')
  persistent = await chromium.launchPersistentContext(profile, options)
  page = await useContext(persistent)
  await page.goto(base + '/curriculum/materials')
  await button(page, 'Lecture1-Introduction.pdf').click()
  await page.locator('canvas[aria-label="Trang PDF 1"]:not([hidden])').waitFor()
  assert.deepEqual(await getStudy(page), before)
  assert.ok(await page.evaluate(() => isSecureContext && typeof navigator.locks?.request === 'function'))
  await page.goto(base + '/curriculum/chapter/1?section=1.1')
  await page.getByText('Đã xác minh', { exact: true }).waitFor()
  await page.reload()
  await page.getByText('Đã xác minh', { exact: true }).waitFor()
  console.log('PASS upgrade, persistent profile reopening, exam history, learning schedule, curriculum, source verification, IndexedDB and TLS Web Locks')
  console.log('Storage after real PDF import:', JSON.stringify({ ...storage, pdfBytes: (await stat(realPdf)).size }))
  await persistent.close()
  persistent = undefined

  browser = await chromium.launch({ executablePath })
  const unsupported = await browser.newContext(options)
  await unsupported.addInitScript(() => Object.defineProperty(navigator, 'locks', { value: undefined }))
  page = await useContext(unsupported)
  await page.goto(base + '/trainning/question/' + id)
  await page.getByText(/Chế độ chỉ đọc\. Trình duyệt/).waitFor()
  await page.locator('.choices input').first().click()
  await page.getByRole('alert').filter({ hasText: 'Web Locks' }).waitFor()
  assert.equal(await page.evaluate(() => localStorage.getItem('bps301_user_progress_v1')), null)
  await page.goto(base + '/curriculum/materials')
  await page.getByLabel('Thêm tài liệu').setInputFiles(realPdf)
  await page.getByRole('alert').filter({ hasText: 'Chế độ chỉ đọc' }).waitFor()
  assert.equal(await page.evaluate(async () => (await indexedDB.databases()).length), 0)
  console.log('PASS missing Web Locks notice and blocked writes to both stores')
  await unsupported.close()
} finally {
  await persistent?.close()
  await browser?.close()
  server.close()
}
