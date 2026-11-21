import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

const source = readFileSync('BPS301_Interactive_Quiz_60_Cau.html', 'utf8')
const theoryStart = source.indexOf('const theoryData =')
const dataEnd = source.indexOf('// Khởi tạo State ứng dụng', theoryStart)
if (theoryStart < 0 || dataEnd < 0) throw new Error('Không tìm thấy dữ liệu gốc')
const { chapters, questions } = runInNewContext(
  source.slice(theoryStart, dataEnd).replace(/\\(?:text|times|rightarrow)\b/g, (command) => '\\' + command) +
    '\n;({ chapters: theoryData, questions: defaultQuestions })',
  {},
  { timeout: 1000 },
)

const root = 'public/data/bps301'
mkdirSync(root + '/exams', { recursive: true })
function write(path, value) {
  writeFileSync(path, JSON.stringify(value, null, 2) + '\n')
}
const names = Object.fromEntries(
  [...source.matchAll(/<option value="([^"]+)">Đề \d+: (.+?) \(\d+ câu\)<\/option>/g)]
    .map(([, id, title]) => [id, title]),
)
const groups = Object.groupBy(questions, (question) => question.exam)
write('public/data/catalog.json', { version: 1, subjects: ['data/bps301/subject.json'] })
write(root + '/subject.json', {
  version: 1,
  id: 'bps301',
  code: 'BPS301',
  title: 'Business Process Management & Process Mining',
  theory: 'data/bps301/theory.json',
  exams: Object.keys(groups).map((id) => 'data/bps301/exams/' + id + '.json'),
  topics: [],
  materials: [],
})
write(root + '/theory.json', chapters.map(({ chapter, title, shortSummary, content }) => ({
  id: String(chapter), title, summary: shortSummary,
  content: { format: 'html', value: content },
})))
for (const [id, items] of Object.entries(groups)) {
  write(root + '/exams/' + id + '.json', {
    version: 1, subjectId: 'bps301',
    exams: [{
      id, title: names[id] ?? id,
      questions: items.map((question) => ({
        id: question.id,
        chapterId: String(question.chapter),
        type: 'single',
        prompt: { format: 'text', value: question.question },
        options: question.options.map((option) => ({
          id: option[0], content: { format: 'text', value: option },
        })),
        answers: [question.answer],
        explanation: { format: 'text', value: question.explanation },
      })),
    }],
  })
}
console.log(chapters.length + ' chương, ' + questions.length + ' câu')
