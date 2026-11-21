export type Preferences = {
  autoAdvance: boolean
  delay: number
  explanations: boolean
  tips: boolean
  minutes: number | 'unlimited'
  autoSubmit: boolean
  warning: boolean
  mixQuestions: boolean
  mixOptions: boolean
  shortcuts: boolean
  theme: 'light' | 'dark' | 'system'
  textSize: 'small' | 'normal' | 'large'
  questionMeta: boolean
}
export const preferencesKey = 'smart-exam-preferences-v1'
export const defaultPreferences: Preferences = {
  autoAdvance: false, delay: 1.5, explanations: true, tips: true,
  minutes: 30, autoSubmit: true, warning: true, mixQuestions: true, mixOptions: true,
  shortcuts: true, theme: 'system', textSize: 'normal', questionMeta: false,
}

export function parsePreferences(value: unknown): Preferences {
  const input = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const result = { ...defaultPreferences }
  for (const key of ['autoAdvance','explanations','tips','autoSubmit','warning','mixQuestions','mixOptions','shortcuts','questionMeta'] as const) {
    if (typeof input[key] === 'boolean') result[key] = input[key]
  }
  if (typeof input.delay === 'number' && input.delay >= 1 && input.delay <= 2) result.delay = input.delay
  if (input.minutes === 'unlimited' || (typeof input.minutes === 'number' && [30, 45, 60].includes(input.minutes))) result.minutes = input.minutes
  if (input.theme === 'light' || input.theme === 'dark' || input.theme === 'system') result.theme = input.theme
  if (input.textSize === 'small' || input.textSize === 'normal' || input.textSize === 'large') result.textSize = input.textSize
  return result
}

export function readPreferences(): Preferences {
  try {
    const saved = localStorage.getItem(preferencesKey)
    if (saved) return parsePreferences(JSON.parse(saved))
    return parsePreferences({ theme: localStorage.getItem('smart-exam-theme') })
  } catch { return { ...defaultPreferences } }
}
