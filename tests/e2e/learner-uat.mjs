import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const { chromium } = await import(process.env.BPMS_PLAYWRIGHT_MODULE || 'playwright-core')
const base = process.env.BPMS_UAT_BASE || 'http://localhost:5192/BPS301'
const origin = new URL(base)
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname), 'UAT writes require a local preview')
const output = resolve('.npm-cache/qa')
await mkdir(output, { recursive: true })
const profile = await mkdtemp(resolve(output, 'phase9-'))
const executablePath = process.env.BPMS_CHROME || undefined
const config = { executablePath, colorScheme: 'light', viewport: { width: 1440, height: 960 }, acceptDownloads: true }
const questionId = 'BPS301_FA26_FE_805603_1'
const multiId = 'BPS301_FA26_FE_805603_39'
const realPdf = resolve('public/materials/bps301/Lecture1-Introduction.pdf')
const bank = JSON.parse(await readFile('public/data/bps301/exams/BPS301_FA26_FE_805603.json', 'utf8'))
const multi = bank.questions.find((q) => q.id === 39)
assert.ok(multi.answers_list.length > 1)
const state = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('bps301_user_progress_v1'))?.subjects.bps301)
const exact = (page, name) => page.locator('main').getByRole('button', { name, exact: true })
const canvas = (page, n) => page.locator('canvas[aria-label="Trang PDF ' + n + '"]:not([hidden])')
const lesson = '/curriculum/chapter/1?section=1.1'

function prepare(context) {
  context.setDefaultTimeout(12000)
  return context.route('https://fonts.googleapis.com/**', (route) => route.abort())
}

let persistent, browser
try {
  persistent = await chromium.launchPersistentContext(profile, config)
  await prepare(persistent)
  let page = persistent.pages()[0] ?? await persistent.newPage()
  await page.goto(base + '/home')
  assert.equal(await state(page), undefined)
  await page.getByRole('heading', { name: 'Tổng quan học tập' }).waitFor()
  await page.getByText('Chưa có bài thi đã nộp.', { exact: true }).waitFor()
  await page.getByRole('navigation').getByRole('button', { name: 'Giáo trình', exact: true }).click()
  await page.locator('.curriculum-reader').getByRole('heading', { name: 'Business process', exact: true }).waitFor()
  await page.locator('.curriculum-reader').getByText(/Quy trình nghiệp vụ là chuỗi sự kiện/).first().waitFor()
  await page.route('**/materials/bps301/Lecture1-Introduction.pdf', async (route) => {
    await page.getByText('Đang tải slide…', { exact: true }).waitFor()
    await route.continue()
  }, { times: 1 })
  await exact(page, 'Xem slide 5').click()
  await canvas(page, 5).waitFor()
  assert.ok(await canvas(page, 5).evaluate((element) => {
    const data = element.getContext('2d').getImageData(0, 0, element.width, element.height).data
    return data.some((value, index) => index % 4 !== 3 && value < 120)
  }))
  await page.keyboard.press('ArrowRight')
  await canvas(page, 6).waitFor()
  await page.keyboard.press('Escape')
  await page.getByRole('dialog', { name: 'Giáo trình liên quan' }).waitFor({ state: 'hidden' })
  await exact(page, 'Đánh dấu đã học').click()
  await exact(page, 'Đã học · Bỏ đánh dấu').waitFor()
  await page.getByRole('button', { name: /Luyện tập ngay/ }).click()
  await page.waitForURL('**/trainning?lesson=1%3A1.1')
  await exact(page, 'Quay lại bài học').click()
  await page.waitForURL('**' + lesson)
  await exact(page, 'Đã học · Bỏ đánh dấu').waitFor()

  await page.goto(base + '/trainning/question/' + questionId)
  await page.locator('.choices input').nth(1).click()
  await page.getByText('Chưa chính xác', { exact: true }).waitFor()
  await page.getByText('Giải thích', { exact: true }).waitFor()
  await page.getByText('Mẹo ghi nhớ', { exact: true }).waitFor()
  await exact(page, 'Đánh dấu khó').click()
  await exact(page, 'Đã đánh dấu khó').waitFor()
  await exact(page, 'Ôn lại sau').click()
  await page.waitForFunction((id) => JSON.parse(localStorage.getItem('bps301_user_progress_v1')).subjects.bps301.reviewLater?.[id], questionId)
  await page.goto(base + '/trainning/question/' + multiId)
  for (const choice of multi.answers_list) {
    const input = page.locator('.choices input').nth(Object.keys(multi.options).indexOf(choice))
    await input.click()
    await page.waitForFunction((index) => document.querySelectorAll('.choices input')[index]?.checked, Object.keys(multi.options).indexOf(choice))
  }
  await exact(page, 'Kiểm tra đáp án').click()
  await page.getByText('Chính xác!', { exact: true }).waitFor()
  await page.goto(base + '/mock_exam/fa25_fe')
  await page.getByLabel('Số câu').fill('3')
  await page.getByLabel('Trộn câu hỏi').uncheck()
  await page.getByLabel('Trộn đáp án').uncheck()
  await exact(page, 'Bắt đầu thi').click()
  await page.waitForURL('**/q/1?session=*')
  await page.locator('.choices input').first().click()
  await page.waitForFunction(() => document.querySelector('.choices input')?.checked)
  await page.reload()
  await page.locator('.choices input:checked').waitFor()
  await exact(page, 'Câu tiếp').click()
  await page.waitForURL('**/q/2?session=*')
  await page.locator('.choices input').nth(2).click()
  await page.locator('.choices input:checked').waitFor()
  await exact(page, 'Nộp bài').click()
  await exact(page, 'Nộp bài ngay').click()
  await page.getByRole('heading', { name: 'Kết quả theo Lecture' }).waitFor()
  assert.equal(await page.locator('.result-score').innerText(), '3.3/10')
  await page.getByText('1 đúng · 1 sai · 1 bỏ trống · 3 câu', { exact: true }).waitFor()
  await page.getByText(/Lecture 2: Process Identification/).first().waitFor()
  await exact(page, 'Ôn lại câu sai').click()
  await page.getByText('1/1 câu có trong ngân hàng hiện tại.', { exact: true }).waitFor()
  await page.getByText('What is the purpose of a process landscape model?', { exact: true }).waitFor()

  await page.goto(base + '/curriculum/materials')
  await page.getByLabel('Thêm tài liệu').setInputFiles(realPdf)
  await canvas(page, 1).waitFor()
  const previous = await state(page)
  assert.ok(previous.curriculum.completed['1'].includes('1.1'))
  assert.ok(previous.bookmarks.includes(questionId) && previous.reviewLater[questionId])
  assert.equal(previous.history.length, 1)
  await persistent.close()
  persistent = await chromium.launchPersistentContext(profile, config)
  await prepare(persistent)
  page = persistent.pages()[0] ?? await persistent.newPage()
  await page.goto(base + '/curriculum/materials')
  await exact(page, 'Lecture1-Introduction.pdf').click()
  await canvas(page, 1).waitFor()
  assert.deepEqual(await state(page), previous)
  await page.goto(base + '/settings')
  const [download] = await Promise.all([page.waitForEvent('download'), exact(page, 'Sao lưu').click()])
  const backup = await readFile(await download.path())
  assert.deepEqual(JSON.parse(backup).subjects.bps301, previous)
  const usage = await page.evaluate(async () => ({
    localBytes: Object.entries(localStorage).reduce((n, [k, v]) => n + (k.length + v.length) * 2, 0),
    ...(await navigator.storage.estimate()),
  }))
  console.log('PASS learner journey steps 1–18 through backup; estimate:', JSON.stringify(usage))

  browser = await chromium.launch({ executablePath })
  const fresh = await browser.newContext(config)
  await prepare(fresh)
  const restored = await fresh.newPage()
  await restored.goto(base + '/settings')
  await restored.locator('.restore input').setInputFiles({ name: 'uat-backup.json', mimeType: 'application/json', buffer: backup })
  await exact(restored, 'Xác nhận khôi phục').click()
  await restored.getByText(/Thiếu tệp giáo trình/).waitFor()
  assert.deepEqual((await state(restored)).history, previous.history)
  assert.deepEqual((await state(restored)).reviewLater, previous.reviewLater)
  await restored.goto(base + '/curriculum/materials')
  await exact(restored, 'Lecture1-Introduction.pdf').click()
  await restored.getByRole('alert').filter({ hasText: 'Thiếu tệp PDF' }).waitFor()
  await restored.getByLabel('Gắn lại tệp gốc').setInputFiles(realPdf)
  await canvas(restored, 1).waitFor()
  await restored.goto(base + '/trainning/question/unknown_question')
  await restored.getByText('Không có câu hỏi phù hợp với bộ lọc.').waitFor()
  for (const width of [1440, 768, 390]) {
    await restored.setViewportSize({ width, height: 900 })
    await restored.goto(base + lesson)
    await exact(restored, 'Xem slide 5').waitFor()
    assert.ok(await restored.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'horizontal overflow at ' + width)
  }
  await restored.getByRole('button', { name: 'Bật giao diện tối' }).click()
  await restored.locator('.app[data-theme=dark]').waitFor()
  await restored.keyboard.press('Control+k')
  await restored.getByRole('dialog', { name: 'Tìm nhanh' }).waitFor()
  await restored.keyboard.press('Escape')
  await restored.getByRole('dialog', { name: 'Tìm nhanh' }).waitFor({ state: 'hidden' })
  for (const fault of [
    { status: 404, body: '', message: 'Chưa có tài liệu PDF tại đường dẫn đã khai báo.' },
    { status: 200, body: '%PDF-1.7\nbroken', message: 'Tệp PDF bị hỏng hoặc không đúng định dạng.' },
  ]) {
    await restored.route('**/materials/bps301/Lecture1-Introduction.pdf', (route) =>
      route.fulfill({ status: fault.status, contentType: 'application/pdf', body: fault.body }), { times: 1 })
    await exact(restored, 'Xem slide 5').click()
    const viewer = restored.getByRole('dialog', { name: 'Giáo trình liên quan' })
    assert.equal(await viewer.getByRole('alert').innerText(), fault.message)
    await exact(restored, 'Đóng giáo trình').click()
  }
  console.log('PASS restore to a clean profile, missing binary, reattach, empty state, responsive, keyboard, PDF 404 and invalid PDF')
} finally {
  await persistent?.close()
  await browser?.close()
}
