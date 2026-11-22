import { readFile, writeFile } from 'node:fs/promises'
import { getDocument, VerbosityLevel } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { parseBank } from '../src/data/storage.ts'
import { formatExplanation } from '../src/data/explanationFormatter.ts'
const json = async (path) => JSON.parse(await readFile(path, 'utf8'))
const subject = await json('public/data/bps301/subject.json')
const theory = await json('public/' + subject.theory)
const normalize = (value) => value.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[’‘]/g, "'")
  .replace(/[^\p{L}\p{N}/]+/gu, ' ').trim()
const includes = (text, term) => (' ' + text + ' ').includes(' ' + normalize(term) + ' ')
const pages = new Map()
for (const lecture of theory) {
  const file = lecture.sourceFile.replace(/\.pptx$/i, '.pdf')
  const task = getDocument({ data: new Uint8Array(await readFile('public/materials/bps301/' + file)), verbosity: VerbosityLevel.ERRORS })
  try {
    const pdf = await task.promise
    const list = []
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n)
      list.push({ number: n, text: (await page.getTextContent()).items.map((item) => item.str).join(' ') })
    }
    pages.set(String(lecture.id), list)
  } finally { await task.destroy() }
}
const cues = {
  '1.1': ['order-to-cash','procure-to-pay','business process'],
  '1.2': ['time cost and quality','process performance'],
  '1.3': ['bpm lifecycle','bpm life cycle'],
  '1.4': ['process owner','process participant'],
  '2.1': ['process identification','process selection criteria'],
  '2.2': ['core processes','support processes','management processes'],
  '2.3': ['process landscape','process architecture','process hierarchy'],
  '2.4': ['process selection','process prioritization'],
  '2.5': ['reference model'],
  '3.1': ['bpmn elements','flow objects','data objects'],
  '3.2': ['token semantics','tokens flow'],
  '3.3': ['xor gateway','exclusive gateway','exclusive split'],
  '3.4': ['and gateway','parallel gateway','and join'],
  '3.5': ['or gateway','inclusive gateway'],
  '3.6': ['pools and lanes','pool boundaries','sequence flow cannot','message flows','black box'],
  '4.1': ['boundary event','signal event','escalation event','timer event'],
  '4.2': ['subprocess','sub-process','multi-instance','multi instance'],
  '4.3': ['execution semantics','event based gateway','deadlock','improper completion'],
  '5.1': ['value adding','value added analysis','business value adding'],
  '5.2': ['waste analysis','over production','muda','eight wastes'],
  '5.3': ['fishbone','six ms','root cause analysis','cause effect diagram','milieu'],
  '5.4': ['issue register','pareto','qualitative impact'],
  '6.1': ['cycle time efficiency','cycle time','processing time'],
  '6.2': ['flow analysis','rework loop','structured process'],
  '6.3': ["little's law","little's formula",'work in progress','work in process'],
  '6.4': ['bottleneck','critical path','theoretical capacity'],
  '7.1': ['queueing and utilization','resource utilization','utilization'],
  '7.2': ['arrival rate','service rate','inter arrival'],
  '7.3': ['m/m/1','m/m/3','m/m/c','kendall','queueing model'],
  '7.4': ['process simulation','simulation model','simulation input'],
  '8.1': ['as is and to be','as is','to be'],
  '8.2': ['redesign orbit','transactional redesign','transformational redesign','nestt'],
  '8.3': ['devil s quadrangle','devil s square','redesign tradeoffs','redesign trade offs'],
  '9.1': ['redesign heuristic','heuristic process redesign'],
  '9.2': ['control addition','task elimination','task composition','parallelism','re-sequencing'],
  '9.3': ['case manager','case assignment','communication optimization','resource specialization'],
  '9.4': ['activity automation','integral technology','triage'],
  '10.1': ['conceptual process model','executable process model'],
  '10.2': ['five step transformation','make the process model complete'],
  '10.3': ['manual task','user task','service task','script task'],
  '10.4': ['bpms components','process engine','process aware information system','island automation'],
  '10.5': ['product data model','electronic data objects','process data'],
  '11.1': ['operational dashboard','balanced scorecard','strategic dashboard','performance dashboard'],
  '11.2': ['event log','case id','event class','timestamp'],
  '11.3': ['automated process discovery','alpha algorithm','directly follows'],
  '11.4': ['conformance checking','token replay','model based monitoring','conformance check'],
  '11.5': ['performance mining','performance analysis','performance enhancement'],
  '11.6': ['variant analysis','log delta analysis','side by side comparison'],
}
// These source proposals were inspected in the extracted text against the actual question and selected option.
const samples = {
  FA25_01: ['2.3',24,'Trang phân biệt Level 1 Process Landscape với mô hình quy trình và tác vụ ở các tầng dưới.'],
  SU26_FE_38: ['3.6',42,'Quy tắc cú pháp trên slide cho phép Message Flow đi qua ranh giới Pool và cấm Sequence Flow đi qua ranh giới đó.'],
  SU26_FE_17: ['5.3',39,'Six Ms mô tả Milieu là yếu tố ngoài phạm vi quy trình, ví dụ chậm trễ từ tác nhân bên ngoài.'],
  SU26_FE_21: ['5.3',38,'Material bao gồm dữ liệu đầu vào thiếu, sai hoặc lỗi thời. Mô tả thiết bị sai trong danh mục là dữ liệu đầu vào sai.'],
  BPS301_FA26_FE_805603_16: ['5.3',39,'Slide định nghĩa Milieu và nêu trực tiếp ví dụ tác nhân bên ngoài.'],
  bonus_100c_22: ['3.6',38,'Slide định nghĩa Pool là phân lớp nguồn lực của bên tham gia và Lane là phân lớp bên trong Pool.'],
  bonus_100c_36: ['3.6',42,'Slide cấm Sequence Flow đi xuyên Pool và phân biệt Message Flow giữa các bên.'],
  bonus_100c_44: ['5.3',38,'Trang liệt kê Poor UI design và Lack of integration between systems dưới Machine.'],
  bonus_100c_45: ['5.3',38,'Trang 38 liệt kê cả hai ví dụ dưới Method. Trang 39 cũng nêu thiếu đào tạo dưới Man trong bối cảnh lỗi của người thực hiện. Giữ ngữ cảnh của cặp ví dụ khi duyệt lời giải.'],
  bonus_100c_46: ['5.3',38,'Slide xếp dữ liệu đầu vào thiếu, sai hoặc lỗi thời vào Material.'],
  bonus_100c_54: ['6.3',33,'Trang ghi Little’s Formula với WIP bằng arrival rate nhân cycle time.'],
  bonus_100c_55: ['6.3',33,'Dùng công thức của trang, 90 chia 150 cho kết quả 0,6 giờ, tương đương 36 phút.'],
}
const concerns = {
  SU26_FE_41: 'Chương 12 được viện dẫn trong giải thích cũ. Chưa tìm được bằng chứng trực tiếp trong 11 PDF cho tình huống triển khai Six Sigma khi mục tiêu là đổi mới.',
  SU26_FE_48: 'Chương 12 được viện dẫn trong giải thích cũ. Chưa thấy slide trong 11 PDF phân biệt trực tiếp BPM Methodologist và BPM Steering Committee.',
  BPS301_FA26_RE_862083_17: 'Câu hỏi viện dẫn quy trình xử lý yêu cầu bồi thường ở phía trên. Bản ghi hiện tại không có đủ bối cảnh để phân loại chắc chắn tất cả lựa chọn là chất lượng hay thời gian.',
  BPS301_FA26_RE_862083_20: 'Câu bị dừng sau cụm identified business. Cần đối chiếu trọn câu với bản đề gốc trước khi kết luận.',
  bonus_100c_45: 'Lời giải nên giới hạn theo cặp ví dụ ở trang 38. Trang 39 nêu đào tạo trong bối cảnh khác dưới Man. Không đề xuất đổi đáp án.',
}
const sections = theory.flatMap((lecture) => lecture.sections.map((section) => ({ lecture, section,
  terms: [...new Set([...(cues[section.id] ?? []), section.title])].filter((term) =>
    pages.get(String(lecture.id)).some(({ text }) => includes(normalize(text), term))),
})))
const rows = []
const proposals = {}
function draftTip(question) {
  if (question.tip) return undefined
  const value = formatExplanation(question)
  if (value.tips[0]?.format === 'text') return value.tips[0].value.split(/\n\s*Lưu ý:/i)[0].trim()
  if (value.primary?.format !== 'text') return undefined
  const head = value.primary.value.trim().split(/(?<=[.!?])\s+(?=[\p{Lu}])/u)[0]
  return head.length <= 240 ? head : undefined
}
for (const path of subject.exams) {
  const data = await json('public/' + path)
  for (const bank of parseBank(data, subject.id, false, path)) for (const question of bank.questions) {
    const prompt = normalize(question.prompt.value)
    const selected = normalize(question.options.filter((option) => question.answers.includes(option.id)).map((option) => option.content.value).join(' '))
    const ranked = sections.map((entry) => {
      const promptTerms = entry.terms.filter((term) => includes(prompt, term))
      const selectedTerms = entry.terms.filter((term) => includes(selected, term))
      const score = promptTerms.length * 3 + selectedTerms.length * 2 + Number(promptTerms.length && selectedTerms.length)
      return { ...entry, promptTerms, selectedTerms, score }
    }).filter((entry) => entry.score >= 3).sort((a, b) => b.score - a.score)
    const sample = samples[question.id]
    const top = question.chapterId === '12' ? undefined : sample
      ? sections.find((item) => item.section.id === sample[0])
      : ranked[0] && ranked[0].score > (ranked[1]?.score ?? 0) ? ranked[0] : undefined
    const lecture = top && String(top.lecture.id)
    const currentValid = theory.some((item) => String(item.id) === question.chapterId)
    const unsure = !sample && /diagram|figure|image|shown|pictured|table (above|below)/i.test(question.prompt.value)
    const tip = draftTip(question)
    const slide = sample && top ? { materialId: top.lecture.sourceFile, page: sample[1] } : undefined
    const genericElimination = /mô tả hướng khác\s*;\s*câu này cần/iu.test(question.explanation?.value ?? '')
    const editorial = genericElimination ? 'Loại trừ có mẫu lặp chỉ nhắc lại đáp án, cần bổ sung lý do riêng khi có căn cứ.'
      : question.id === 'bonus_100c_45' ? 'Giới hạn giải thích theo ngữ cảnh của ví dụ trên slide.'
        : ['BPS301_FA26_RE_862083_17', 'BPS301_FA26_RE_862083_20'].includes(question.id) ? 'Rà đủ bối cảnh trước khi sửa lời giải.' : ''
    const evidence = [sample?.[2] ?? (top
      ? 'Ứng viên tra cứu từ mục ' + top.section.title + '. Cụm có trong PDF và câu/đáp án: ' +
        [...new Set([...(top.promptTerms ?? []), ...(top.selectedTerms ?? [])])].join(', ') + '. Cần đối chiếu ngữ nghĩa.'
      : 'Chưa đủ căn cứ để đề xuất Lecture hoặc chủ đề.'),
      concerns[question.id], editorial,
      tip ? 'Mẹo rút từ giải thích sẵn có, cần duyệt.' : undefined,
    ].filter(Boolean).join(' ')
    const proposal = { chapterId: !currentValid && lecture ? lecture : undefined, topics: top ? [top.section.id] : undefined,
      ...(tip && { tip }), ...(slide && { slide }), evidence, confidence: sample ? 'medium' : top ? 'low' : 'none',
      ...(unsure && { visualCheck: true }), ...(concerns[question.id] && { needsReview: true }) }
    proposals[question.id] = proposal
    rows.push([bank.id, question.id, question.chapterId ?? '', proposal.chapterId ?? '', proposal.topics?.join('; ') ?? '',
      slide?.materialId.replace(/\.pptx$/i, '.pdf') ?? '', slide?.page ?? '', proposal.confidence,
      sample && !concerns[question.id] ? 'suggested' : 'needs-review', 'false', unsure ? 'yes' : '', tip ?? '', evidence, editorial])
  }
}
const columns = ['exam_id','question_id','current_lecture','proposed_lecture','proposed_topics','proposed_pdf','page',
  'confidence','queue_status','verified','visual_review','tip_draft','evidence','explanation_review']
const csv = [columns, ...rows].map((row) => row.map((value) => '"' + String(value).replaceAll('"', '""') + '"').join(',')).join('\r\n')
await writeFile('docs/PHASE10-REVIEW-QUEUE.csv', '\ufeff' + csv + '\r\n')
await writeFile('public/data/bps301/academic-proposals.json', JSON.stringify({ version: 1, proposals }, null, 2) + '\n')
console.log({ questions: rows.length, files: pages.size, pages: [...pages.values()].flat().length,
  chapters: rows.filter((r) => r[3]).length, topics: rows.filter((r) => r[4]).length, sources: rows.filter((r) => r[5]).length,
  tips: rows.filter((r) => r[11]).length, visual: rows.filter((r) => r[10]).length, explanationReview: rows.filter((r) => r[13]).length })
