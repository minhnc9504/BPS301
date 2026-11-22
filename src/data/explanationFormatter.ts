import type { Content, Question } from './model'

const labels = { 'loại trừ': 'alternatives', 'lý do': 'reason', 'mẹo': 'tip', 'nguồn': 'source', 'lưu ý': 'note' } as const
type Label = typeof labels[keyof typeof labels]
const text = (value: string): Content => ({ format: 'text', value })
const comparable = (value: string) => value.normalize('NFC').trim().replace(/\s+/g, ' ').replace(/[.!?]+$/, '').toLowerCase()

function outsideQuotes(value: string) {
  let closing = ''
  let mask = ''
  for (let i = 0; i < value.length; i++) {
    const c = value[i]
    if (closing) {
      mask += c === '\n' ? '\n' : '¤'
      if (c === closing && value[i - 1] !== '\\') closing = ''
    } else if (c === '"' || c === '“' || c === '‘' ||
      (c === "'" && /[\s([{:]|^$/.test(value[i - 1] ?? '') && /\S/.test(value[i + 1] ?? ''))) {
      closing = c === '“' ? '”' : c === '‘' ? '’' : c
      mask += '¤'
    } else mask += c
  }
  return closing ? undefined : mask
}

function splitLegacy(value: string) {
  const mask = outsideQuotes(value)
  if (!mask) return { main: value }
  const markers = [...mask.matchAll(/(^|\n[\t ]*|[.!?][\t ]+)(Loại trừ|Lý do|Mẹo|Nguồn|Lưu ý):[\t ]*/gimu)]
  // An inline reason inside the alternatives belongs to its option, including on later pipe segments.
  const accepted: Array<{ key: Label; start: number; body: number }> = []
  for (const item of markers) {
    const key = labels[item[2].toLowerCase() as keyof typeof labels]
    if (key === 'reason' && accepted.at(-1)?.key === 'alternatives' && item[1].trim()) continue
    const start = item.index + item[1].length
    const body = item.index + item[0].length
    if (accepted.some((marker) => marker.key === key)) return { main: value }
    accepted.push({ key, start, body })
  }
  if (!accepted.length) return { main: value }
  const result: Partial<Record<Label, string>> & { main: string } = { main: value.slice(0, accepted[0].start).trim() }
  for (const [i, marker] of accepted.entries()) {
    const piece = value.slice(marker.body, accepted[i + 1]?.start).trim()
    if (!piece) return { main: value }
    result[marker.key] = piece
  }
  return result
}

function splitOptions(value: string, question: Pick<Question, 'options' | 'answers'>) {
  const mask = outsideQuotes(value)
  if (!mask) return undefined
  const separators = [...mask.matchAll(/\||\n(?=\s*[\p{L}\p{N}_-]+[.):])/gu)].map((match) => match.index)
  const pieces = [0, ...separators.map((i) => i + 1)].map((start, i) => value.slice(start, separators[i]).trim())
  const parsed = pieces.map((part) => /^([\p{L}\p{N}_-]+)[.):]\s+([\s\S]+)$/u.exec(part))
  const ids = parsed.map((match) => match?.[1])
  if (!ids.every((id) => id && question.options.some((option) => option.id === id) && !question.answers.includes(id)) ||
    new Set(ids).size !== ids.length) return undefined
  return parsed.map((match) => [match![1], match![2]] as const)
}

function optionDisplay(option: Question['options'][number], detail: Content) {
  const body = option.content.format === 'text' && option.content.value.startsWith(option.id + '. ')
    ? text(option.content.value.slice(option.id.length + 2)) : option.content
  const lead = detail.format === 'text' && body.format === 'text'
    ? /^(?:"([^"]+)"|“([^”]+)”)\s+([\s\S]+)$/u.exec(detail.value) : null
  const reason = lead && comparable(lead[1] ?? lead[2]) === comparable(body.value) ? text(lead[3]) : detail
  return { option: { ...option, content: body }, detail: reason }
}

export function formatExplanation(question: Pick<Question, 'explanation' | 'correctExplanation' | 'wrongAnswerExplanations' | 'tip' | 'answers' | 'options'>) {
  const legacy = question.explanation?.format === 'text' ? splitLegacy(question.explanation.value) : undefined
  const main = legacy ? (legacy.main ? text(legacy.main) : undefined) : question.explanation
  const primary = question.correctExplanation ?? main
  const differs = (a?: Content, b?: Content) => a && (!b || a.format !== b.format || comparable(a.value) !== comparable(b.value))
  const structured = new Map(Object.entries(question.wrongAnswerExplanations ?? {}).filter(([id]) =>
    !question.answers.includes(id) && question.options.some((option) => option.id === id)))
  const items = legacy?.alternatives ? splitOptions(legacy.alternatives, question) : undefined
  const supplemental: Content[] = []
  for (const [id, body] of items ?? []) {
    const clean = body.replace(/\s+Lý do:\s+([\s\S]+)$/iu, (suffix, reason) =>
      primary?.format === 'text' && comparable(reason) === comparable(primary.value) ? '' : suffix)
    const detail = text(clean)
    if (!structured.has(id)) structured.set(id, detail)
    else if (differs(detail, structured.get(id))) supplemental.push(text(id + ': ' + clean))
  }
  const inlineTip = legacy?.tip ? text(legacy.tip) : undefined
  return {
    primary,
    additional: question.correctExplanation && differs(main, primary) ? main : undefined,
    alternatives: question.options.flatMap((option) => structured.has(option.id) ? [optionDisplay(option, structured.get(option.id)!)] : []),
    legacyAlternatives: legacy?.alternatives && !items ? [text(legacy.alternatives)] : supplemental,
    reason: legacy?.reason && differs(text(legacy.reason), primary) ? text(legacy.reason) : undefined,
    tips: [question.tip ?? inlineTip, question.tip && differs(inlineTip, question.tip) ? inlineTip : undefined].filter((item): item is Content => !!item),
    note: legacy?.note ? text(legacy.note) : undefined,
    source: legacy?.source ? text(legacy.source) : undefined,
  }
}
