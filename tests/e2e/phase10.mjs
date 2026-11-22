import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile, mkdir } from 'node:fs/promises'
import { resolve, sep } from 'node:path'
const { chromium } = await import(process.env.BPMS_PLAYWRIGHT_MODULE || 'playwright-core')
const mime = { html: 'text/html', js: 'text/javascript', mjs: 'text/javascript', css: 'text/css',
  json: 'application/json', pdf: 'application/pdf', jpg: 'image/jpeg' }
const dist = resolve('dist')
const server = createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname
  if (!pathname.startsWith('/BPS301/')) return res.writeHead(404).end()
  const file = resolve(dist, decodeURIComponent(pathname.slice('/BPS301/'.length)) || 'index.html')
  if (!file.startsWith(dist + sep)) return res.writeHead(404).end()
  try {
    const bytes = await readFile(file)
    res.writeHead(200, { 'Content-Type': mime[file.split('.').at(-1)] ?? 'application/octet-stream' }).end(bytes)
  } catch { res.writeHead(404, { 'Content-Type': 'text/html' }).end(await readFile(resolve(dist, '404.html'))) }
})
await new Promise((done) => server.listen(0, '127.0.0.1', done))
const base = 'http://127.0.0.1:' + server.address().port + '/BPS301'
let browser
try {
  browser = await chromium.launch({ executablePath: process.env.BPMS_CHROME || undefined })
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, colorScheme: 'light' })
  page.setDefaultTimeout(15000)
  await page.route('https://fonts.googleapis.com/**', (route) => route.abort())
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  const get = (name) => page.getByRole('button', { name, exact: true })
  const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('bps301_user_progress_v1'))?.subjects.bps301)
  const screenshot = async (name) => {
    if (!process.env.BPMS_PHASE10_SCREENSHOTS) return
    await mkdir(process.env.BPMS_PHASE10_SCREENSHOTS, { recursive: true })
    await page.screenshot({ path: resolve(process.env.BPMS_PHASE10_SCREENSHOTS, name), fullPage: true, animations: 'disabled', caret: 'hide' })
  }
  await page.goto(base + '/trainning/question/FA25_01')
  await page.locator('.prompt').waitFor()
  assert.equal(await page.locator('.practice-explanation').count(), 0)
  await page.locator('.choices input').first().click()
  await page.getByText('Chưa chính xác', { exact: true }).waitFor()
  await page.getByRole('heading', { name: 'Phân tích các phương án sai' }).waitFor()
  assert.equal(await page.locator('.explanation-option').count(), 3)
  assert.ok(await page.locator('.practice-explanation').evaluate((el) =>
    el.compareDocumentPosition(document.querySelector('.practice-review-record')) & Node.DOCUMENT_POSITION_FOLLOWING))
  await page.getByText('Lịch sử của câu này', { exact: true }).click()
  await get('Đánh dấu khó').click()
  await get('Đã đánh dấu khó').waitFor()
  await get('Ôn lại sau').click()
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('bps301_user_progress_v1')).subjects.bps301.reviewLater?.FA25_01)
  await page.reload()
  await page.getByText('Chưa chính xác', { exact: true }).waitFor()
  await screenshot('practice-phase10.png')
  await get('Câu tiếp').click()
  await page.waitForURL('**?question=FA25_02')
  assert.equal(await page.locator('.practice-explanation').count(), 0)

  await page.goto(base + '/trainning/question/BPS301_FA26_FE_805603_39')
  const data = JSON.parse(await readFile('public/data/bps301/exams/BPS301_FA26_FE_805603.json', 'utf8'))
  const multi = data.questions.find((item) => item.id === 39)
  for (const id of multi.answers_list) {
    const index = Object.keys(multi.options).indexOf(id)
    await page.locator('.choices input').nth(index).click()
    await page.waitForFunction((i) => document.querySelectorAll('.choices input')[i].checked, index)
  }
  await get('Kiểm tra đáp án').click()
  await page.getByText('Chính xác!', { exact: true }).waitFor()
  await page.getByRole('button', { name: 'Bật giao diện tối' }).click()
  await page.locator('.app[data-theme=dark]').waitFor()
  await page.setViewportSize({ width: 390, height: 844 })
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))

  await page.goto(base + '/mock_exam/fa25_fe')
  await page.getByLabel('Số câu').fill('1')
  await page.getByLabel('Trộn câu hỏi').uncheck()
  await get('Bắt đầu thi').click()
  await page.waitForURL('**/q/1?session=*')
  await get('Nộp bài').click()
  await get('Nộp bài ngay').click()
  await page.getByRole('heading', { name: 'Kết quả thi thử' }).waitFor()
  const history = (await saved()).history
  assert.equal(history[0].questions[0].topics, undefined)

  await page.goto(base + '/question_bank/quality')
  await page.getByRole('heading', { name: 'Kiểm định nội dung' }).waitFor()
  await page.getByText('310 câu hỏi', { exact: true }).waitFor()
  await page.getByLabel('Độ tin cậy đề xuất').selectOption('medium')
  await page.getByText('12 câu phù hợp', { exact: true }).waitFor()
  await get('Duyệt FA25_01').click()
  await page.getByText(/Trang phân biệt Level 1 Process Landscape/).waitFor()
  assert.equal(await get('Kiểm định đáp án thủ công').isDisabled(), true)
  await get('Chấp nhận metadata').click()
  await page.getByText('Đã lưu kiểm định cục bộ.').waitFor()
  assert.equal((await saved()).academicReviews.FA25_01.decision, 'accepted')
  assert.equal((await saved()).academicReviews.FA25_01.answer, 'unreviewed')
  assert.deepEqual((await saved()).history, history)
  await get('Mở trang PDF').click()
  await page.locator('canvas[aria-label="Trang PDF 24"]:not([hidden])').waitFor()
  await get('Đóng giáo trình').click()
  await page.getByLabel('Căn cứ hoặc ghi chú kiểm định').fill('QA cục bộ: đối chiếu bậc Level 1 ở trang 24.')
  await page.getByLabel(/Tôi có quyền duyệt/).check()
  await get('Kiểm định đáp án thủ công').click()
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('bps301_user_progress_v1')).subjects.bps301.academicReviews.FA25_01.answer === 'verified')
  const [csv] = await Promise.all([page.waitForEvent('download'), get('Xuất báo cáo CSV').click()])
  assert.match(await readFile(await csv.path(), 'utf8'), /"FA25_01".*"verified"/)
  await page.goto(base + '/trainning/question/FA25_01')
  await page.getByText('Đáp án đã được kiểm định thủ công trên trình duyệt này.').waitFor()
  await page.getByText('Nguồn gợi ý', { exact: true }).waitFor()
  assert.deepEqual((await saved()).history, history)
  await page.goto(base + '/question_bank/quality')
  await get('Duyệt FA25_01').click()
  await get('Từ chối đề xuất').click()
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('bps301_user_progress_v1')).subjects.bps301.academicReviews.FA25_01.decision === 'rejected')
  assert.deepEqual(errors, [])
  console.log('PASS Practice order, MCQ, F5, navigation, notebook, dark/mobile and academic filtering, PDF, manual confirmation, CSV and snapshot protection')
} finally { await browser?.close(); server.close() }
