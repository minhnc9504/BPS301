import { examAnalytics, scoreTrend, weakGroups } from '../data/examAnalytics'
import { examSlug } from '../routes'
import { examScope, uniqueQuestions, type Exam, type Study, type Subject } from '../data/model'
import { curriculum, lessonPath } from './curriculumData'
import { learningStats } from '../data/review'

const chapterPath = (id: string) => '/trainning/chapter/' + encodeURIComponent(id)
const questionPath = (id: string) => '/trainning/question/' + encodeURIComponent(id)
const lecturePath = (id: string) => '/curriculum/chapter/' + encodeURIComponent(id)

export function buildOverview(subject: Subject, exams: Exam[], study: Study, now: number) {
  const questions = uniqueQuestions(exams)
  const stats = learningStats(subject.id, questions, subject.theory, study, now)
  const latest = new Map([...stats.records].flatMap(([id, record]) => {
    const attempt = record.reviewHistory.at(-1)
    return attempt ? [[id, attempt] as const] : []
  }))
  const bookmarked = new Set(study.bookmarks)
  const { unique: completed, needed: needsReview, accuracy, due } = stats.forQuestions(questions)
  const chapterIds = new Set(subject.theory.map((item) => item.id))
  const results = study.history.map((item) => ({ item, data: examAnalytics(item, chapterIds) }))
    .sort((a, b) => (b.item.ended ?? b.item.started) - (a.item.ended ?? a.item.started))
  const scores = results.flatMap(({ item, data }) => data.score === undefined ? [] : [{ item, score: data.score }])
  const latestExam = results[0]
  const previousExam = latestExam && results.slice(1).find(({ item }) => !!item.examId &&
    item.examId === latestExam.item.examId && item.questions.length === latestExam.item.questions.length)
  const examTrend = previousExam && scoreTrend([previousExam.data.score, latestExam.data.score], true)
  const weakChapter = latestExam && weakGroups(latestExam.data.byChapter)[0]?.[0]
  const chapters = subject.theory.map((chapter) => {
    const items = questions.filter((question) => question.chapterId === chapter.id)
    const checked = items.filter((q) => latest.has(q.id))
    const recentWrong = checked.filter((q) => {
      const attempt = latest.get(q.id)!
      return !attempt.correct && attempt.at >= now - 7 * 86_400_000
    }).length
    const row = stats.byChapter.get(chapter.id)!
    return { chapter, total: items.length, checked: row.unique, recentWrong, mastered: row.mastered,
      wrong: checked.filter((q) => stats.matches(q, 'wrong')).length,
      correct: row.latestCorrect, path: chapterPath(chapter.id) }
  })
  const activity = [
    ...study.attempts.map((item, index) => ({
      id: 'practice-' + index, title: questions.find((q) => q.id === item.questionId)?.code ?? item.questionId,
      kind: 'Ôn tập', status: item.correct ? 'Đúng' : 'Sai', tone: item.correct ? 'correct' : 'wrong',
      at: item.at, path: latest.has(item.questionId) && questions.some((q) => q.id === item.questionId) ? questionPath(item.questionId) : undefined,
    })),
    ...scores.map(({ item, score }) => ({
      id: item.id, title: item.title, kind: 'Thi thử', status: score.toFixed(1) + '/10', tone: 'exam',
      at: item.ended ?? item.started,
      path: '/mock_exam/' + encodeURIComponent(examSlug(examScope(item, exams) ?? 'all')) + '/result?session=' + encodeURIComponent(item.id),
    })),
  ].sort((a, b) => b.at - a.at).slice(0, 4)
  const first = chapters[0]
  const active = study.sessions.find((item) => item.ended === undefined && (item.unlimited || item.deadline > now))
  const resumeQuestion = questions.find((item) => item.id === study.resume)
  const lastLesson = study.curriculum?.last
  const currentLecture = !active && !resumeQuestion && lastLesson ? curriculum(subject).find((item) => item.id === lastLesson.lectureId) : undefined
  const currentSection = currentLecture?.lessons.find((item) => item.id === lastLesson?.sectionId)
  const filters = study.practiceFilters
  const practicePool = uniqueQuestions(filters?.exam ? exams.filter((item) => item.id === filters.exam) : exams)
    .filter((q) => (!filters?.chapter || q.chapterId === filters.chapter) && (!filters?.topic || q.topics?.includes(filters.topic)) &&
      (!filters?.onlyWrong || latest.get(q.id)?.correct === false || bookmarked.has(q.id) ||
        (q.id === resumeQuestion?.id && study.practice[q.id]?.correct !== undefined)))
  const atIndex = practicePool.findIndex((item) => item.id === resumeQuestion?.id)
  const query = new URLSearchParams()
  if (atIndex >= 0) {
    if (filters?.exam) query.set('exam', examSlug(filters.exam))
    if (filters?.chapter) query.set('chapter', filters.chapter)
    if (filters?.topic) query.set('topic', filters.topic)
    if (filters?.onlyWrong) query.set('review', 'needed')
  }
  if (resumeQuestion) query.set('question', resumeQuestion.id)
  const resume = active ? {
    kind: 'Thi thử', title: active.title, path: '/mock_exam/' + encodeURIComponent(examSlug(examScope(active, exams) ?? 'all')) +
      '/q/' + (active.index + 1) + '?session=' + encodeURIComponent(active.id),
    position: 'Câu ' + (active.index + 1) + '/' + active.questions.length, at: active.started, dateLabel: 'Bắt đầu',
    value: active.questions.filter((q) => active.selections[q.id]?.length).length,
    total: active.questions.length, metric: 'đã trả lời', fresh: false,
  } : resumeQuestion ? {
    kind: 'Ôn tập', title: exams.find((item) => item.id === filters?.exam)?.title ??
      subject.theory.find((chapter) => chapter.id === resumeQuestion.chapterId)?.title ?? subject.title,
    path: study.practiceRoute ?? '/trainning?' + query,
    position: atIndex >= 0 ? 'Câu ' + (atIndex + 1) + '/' + practicePool.length : resumeQuestion.code ?? resumeQuestion.id,
    at: latest.get(resumeQuestion.id)?.at, dateLabel: 'Kiểm tra gần nhất',
    value: (atIndex >= 0 ? practicePool : [resumeQuestion]).filter((q) => latest.has(q.id)).length,
    total: atIndex >= 0 ? practicePool.length : 1, metric: 'đã ôn', fresh: false,
  } : currentLecture && currentSection ? {
    kind: 'Giáo trình', title: currentSection.title, path: lessonPath(currentLecture.id, currentSection.id),
    position: currentLecture.title, at: undefined, dateLabel: '',
    value: currentLecture.lessons.filter((item) => study.curriculum?.completed[currentLecture.id]?.includes(item.id)).length,
    total: currentLecture.lessons.length, metric: 'mục đã học', fresh: false,
  } : {
    kind: first ? 'Giáo trình' : 'Ôn tập', title: first?.chapter.title ?? subject.title,
    path: first ? lecturePath(first.chapter.id) : '/trainning', position: undefined, at: undefined, dateLabel: '',
    value: first?.checked ?? 0, total: first?.total ?? questions.length, metric: 'đã ôn', fresh: true,
  }
  const suggestions: Array<{ key: string; title: string; reason: string; count: number; path: string }> = []
  if (!due && !study.attempts.length && !study.history.length && !study.bookmarks.length && first) {
    suggestions.push({ key: 'first', title: first.chapter.title, reason: 'Bắt đầu từ chương đầu tiên.', count: first.total,
      path: first.total ? first.path : lecturePath(first.chapter.id) })
  } else {
    const usedChapters = new Set<string>()
    if (due) suggestions.push({ key: 'due', title: 'Câu đến hạn ôn lại', reason: 'Lịch ôn cách quãng đã đến hạn.',
      count: due, path: '/trainning/review/due' })
    const recent = chapters.filter((item) => item.recentWrong > 0).sort((a, b) => b.recentWrong - a.recentWrong)[0]
    if (recent) {
      usedChapters.add(recent.chapter.id)
      suggestions.push({ key: 'wrong', title: recent.chapter.title,
        reason: recent.recentWrong + ' câu có kết quả gần nhất là sai trong 7 ngày qua.',
        count: recent.wrong, path: recent.path + '?review=wrong' })
    }
    const hard = questions.filter((item) => bookmarked.has(item.id)).length
    if (hard) suggestions.push({ key: 'hard', title: 'Câu đã đánh dấu khó', reason: 'Ôn lại các câu bạn đã chủ động đánh dấu.',
      count: hard, path: '/trainning/review/bookmarked' })
    const unseen = questions.find((q) => !latest.has(q.id) && !bookmarked.has(q.id) && q.chapterId && !usedChapters.has(q.chapterId)) ??
      questions.find((q) => !latest.has(q.id) && !bookmarked.has(q.id))
    if (unseen) suggestions.push({ key: 'unseen', title: 'Thử một câu chưa ôn', reason: 'Bổ sung một câu mới vào lượt học hôm nay.',
      count: 1, path: questionPath(unseen.id) })
    const weak = chapters.filter((item) => stats.weak.has(item.chapter.id) && !usedChapters.has(item.chapter.id))
      .sort((a, b) => a.correct / a.checked - b.correct / b.checked)[0]
    if (weak) suggestions.push({ key: 'weak', title: weak.chapter.title,
      reason: 'Tỷ lệ câu đúng gần nhất trong chương là ' + Math.round(weak.correct * 100 / weak.checked) + '%.',
      count: weak.total, path: weak.path })
  }
  return { questions, completed, needsReview, accuracy, due, chapters, activity, resume, latestExam, examTrend, weakChapter, suggestions: suggestions.slice(0, 3),
    average: scores.length ? scores.reduce((total, score) => total + score.score, 0) / scores.length : undefined }
}
