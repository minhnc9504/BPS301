import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { resolve, sep } from 'node:path'

const { chromium } = await import(process.env.BPMS_PLAYWRIGHT_MODULE || 'playwright-core')
const mime = { html: 'text/html', js: 'text/javascript', mjs: 'text/javascript', css: 'text/css',
  json: 'application/json', pdf: 'application/pdf', jpg: 'image/jpeg' }
const dist = resolve('dist')
const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname
  if (!path.startsWith('/BPS301/')) return res.writeHead(404).end()
  const file = resolve(dist, decodeURIComponent(path.slice('/BPS301/'.length)) || 'index.html')
  if (!file.startsWith(dist + sep)) return res.writeHead(404).end()
  try {
    const content = await readFile(file)
    res.writeHead(200, { 'Content-Type': mime[file.split('.').at(-1)] ?? 'application/octet-stream' }).end(content)
  }
  catch {
    if (!res.headersSent) res.writeHead(404, { 'Content-Type': 'text/html' })
    res.end(await readFile(resolve(dist, '404.html')))
  }
})
await new Promise((done) => server.listen(0, '127.0.0.1', done))
const base = 'http://127.0.0.1:' + server.address().port + '/BPS301'
let browser
try {
  browser = await chromium.launch({ executablePath: process.env.BPMS_CHROME || undefined })
  const context = await browser.newContext()
  await context.route('https://fonts.googleapis.com/**', (route) => route.abort())
  // Hold notifications to exercise the write path with deliberately stale React state.
  await context.addInitScript(() => window.addEventListener('storage', (event) => event.stopImmediatePropagation(), true))
  const a = await context.newPage()
  const b = await context.newPage()
  for (const page of [a, b]) page.setDefaultTimeout(10000)
  const id = 'BPS301_FA26_FE_805603_1'
  const read = () => a.evaluate(() => JSON.parse(localStorage.getItem('bps301_user_progress_v1'))?.subjects.bps301)
  const button = (page, name) => page.getByRole('button', { name, exact: true })
  const concurrentClick = (...targets) => Promise.all(targets.map((target) => target.evaluate((element) => element.click())))
  await Promise.all([a, b].map((page) => page.goto(base + '/trainning/question/' + id)))
  await concurrentClick(a.locator('.choices input').first(), button(b, 'Đánh dấu khó'))
  await a.waitForFunction((id) => {
    const study = JSON.parse(localStorage.getItem('bps301_user_progress_v1'))?.subjects.bps301
    return study?.attempts.length === 1 && study.bookmarks.includes(id)
  }, id)
  // The second tab still displays the unanswered question and tries to grade it again.
  if (await b.locator('.choices input').first().isEnabled()) await b.locator('.choices input').first().click()
  await b.goto(base + '/curriculum/chapter/1?section=1.1')
  await concurrentClick(button(a, 'Câu tiếp'), button(b, 'Đánh dấu đã học'))
  await a.waitForFunction(() => JSON.parse(localStorage.getItem('bps301_user_progress_v1'))?.subjects.bps301.curriculum?.completed['1']?.includes('1.1'))
  await Promise.all([a.reload(), b.reload()])
  await b.getByRole('button', { name: 'Đã học · Bỏ đánh dấu', exact: true }).waitFor()
  assert.equal((await read()).attempts.length, 1)
  assert.deepEqual((await read()).bookmarks, [id])

  await a.goto(base + '/mock_exam/fa26_fe')
  await a.getByLabel('Số câu').fill('3')
  await button(a, 'Bắt đầu thi').click()
  await a.waitForURL('**/q/1?session=*')
  await b.goto(a.url().replace('/q/1?', '/q/2?'))
  await concurrentClick(a.locator('.choices input').first(), b.locator('.choices input').first())
  await a.waitForFunction(() => Object.keys(JSON.parse(localStorage.getItem('bps301_user_progress_v1')).subjects.bps301.sessions[0].selections).length === 2)
  const session = (await read()).sessions[0]
  await concurrentClick(button(a, 'Nộp bài'), button(b, 'Nộp bài'))
  await concurrentClick(button(a, 'Nộp bài ngay'), button(b, 'Nộp bài ngay'))
  await a.waitForFunction(() => JSON.parse(localStorage.getItem('bps301_user_progress_v1')).subjects.bps301.history.length === 1)
  const result = await read()
  assert.equal(result.sessions.length, 0)
  assert.deepEqual(result.history[0].selections, session.selections)
  const bank = JSON.parse(await readFile('public/data/bps301/exams/BPS301_FA26_FE_805603.json', 'utf8'))
  const multipleId = 'BPS301_FA26_FE_805603_' + bank.questions.find((question) => question.type === 'MULTIPLECHOICE').id
  await Promise.all([a, b].map((page) => page.goto(base + '/trainning/question/' + multipleId)))
  await concurrentClick(a.locator('.choices input').nth(0), b.locator('.choices input').nth(1))
  await a.waitForFunction((id) => JSON.parse(localStorage.getItem('bps301_user_progress_v1')).subjects.bps301.practice[id]?.selected.length === 2, multipleId)
  console.log('PASS multi-tab grading, bookmark, curriculum, navigation, multiple choice writes and simultaneous submission.')

  const clean = await browser.newContext({ viewport: { width: 768, height: 900 }, colorScheme: 'light' })
  await clean.route('https://fonts.googleapis.com/**', (route) => route.abort())
  const tablet = await clean.newPage()
  const synchronized = await clean.newPage()
  tablet.setDefaultTimeout(10000)
  synchronized.setDefaultTimeout(10000)
  await Promise.all([tablet, synchronized].map((page) => page.goto(base + '/trainning/question/' + id)))
  await button(tablet, 'Đánh dấu khó').click()
  await button(synchronized, 'Đã đánh dấu khó').waitFor()
  for (const width of [768, 390]) {
    await tablet.setViewportSize({ width, height: 900 })
    const url = base + '/curriculum/chapter/1?section=1.1'
    const response = await tablet.request.get(url)
    await tablet.goto(url)
    assert.equal(response.status(), 404, 'nested static route should use the Pages fallback')
    await button(tablet, 'Xem slide 5').waitFor()
    assert.ok(await tablet.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
  }
  await tablet.getByRole('button', { name: 'Bật giao diện tối' }).click()
  await tablet.locator('.app[data-theme="dark"]').waitFor()
  await tablet.keyboard.press('Control+k')
  await tablet.getByRole('dialog', { name: 'Tìm nhanh' }).waitFor()
  await tablet.keyboard.press('Escape')
  await tablet.getByRole('dialog', { name: 'Tìm nhanh' }).waitFor({state:'hidden'})

  await tablet.goto(base + '/settings')
  const [download] = await Promise.all([
    tablet.waitForEvent('download'),
    tablet.locator('main').getByRole('button', { name: 'Sao lưu', exact: true }).click(),
  ])
  const exported = JSON.parse(await readFile(await download.path(), 'utf8'))
  assert.deepEqual(exported.subjects.bps301.bookmarks, [id])
  const restore = tablet.locator('.restore input')
  await restore.setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{') })
  await tablet.getByRole('alert').filter({ hasText: 'sai cú pháp JSON' }).waitFor()
  const backup = {
    version: 1, subjects: { bps301: { attempts: [], practice: {}, bookmarks: [], exams: [], edits: {}, history: [], sessions: [], materials: [] } },
  }
  await restore.setInputFiles({ name: 'legacy.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) })
  await tablet.getByText('Tệp không ghi ngày sao lưu', { exact: false }).waitFor()
  await tablet.getByLabel('Cách khôi phục').selectOption('replace')
  tablet.once('dialog', (dialog) => dialog.dismiss())
  await button(tablet, 'Xác nhận khôi phục').click()
  assert.deepEqual(await tablet.evaluate(() => JSON.parse(localStorage.getItem('bps301_user_progress_v1')).subjects.bps301.bookmarks), [id])
  tablet.once('dialog', (dialog) => dialog.accept())
  await button(tablet, 'Xác nhận khôi phục').click()
  await tablet.getByText('Đã khôi phục dữ liệu.', { exact: true }).waitFor()
  assert.deepEqual(await tablet.evaluate(() => JSON.parse(localStorage.getItem('bps301_user_progress_v1')).subjects.bps301.bookmarks), [])
  await tablet.goto(base + '/question_bank')
  const question = {
    id: 'QA_HTML', type: 'single',
    prompt: { format: 'html', value: '<p>QA markup <strong>allowed</strong></p><script>window.qaUnsafe=true</script><img src="javascript:void(0)" onerror="window.qaUnsafe=true">' },
    options: [{ id: 'A', content: 'A' }, { id: 'B', content: 'B' }], answers: ['A'],
  }
  const importFile = { version: 1, subjectId: 'bps301', exams: [{ id: 'QA_TEST', title: 'QA session', questions: [question] }] }
  await tablet.getByLabel('Chọn một hoặc nhiều tệp JSON').setInputFiles({
    name: 'qa-safety.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(importFile)),
  })
  await button(tablet, 'Xác nhận nhập').click()
  await tablet.getByText('Đã lưu ngân hàng câu hỏi.', { exact: true }).waitFor()
  await tablet.goto(base + '/question_bank/detail/QA_HTML')
  await tablet.locator('.prompt strong').waitFor()
  assert.equal(await tablet.locator('.prompt strong').innerText(), 'allowed')
  assert.equal(await tablet.locator('.prompt script, .prompt [onerror], .prompt [src^="javascript:"]').count(), 0)
  assert.equal(await tablet.evaluate(() => window.qaUnsafe), undefined)
  console.log('PASS storage notifications, tablet/mobile, dark mode, keyboard, static deep links, backup confirmation and HTML sanitization.')

} finally {
  await browser?.close()
  server.close()
}
