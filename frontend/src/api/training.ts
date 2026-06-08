import client from './client'

// ── 已收录题目 ──

export interface QuestionItem {
  id: number
  stem: string
  explanation: string
  difficulty: number | null
  difficulty_votes?: number[]
  knowledge_point: string | null
  source_type: 'extracted' | 'ai_pregenerated' | 'ai_adhoc'
  source_document_id: number | null
  created_at: string
  userStatus?: string | null
}

export interface QuestionsStats {
  total: number
  extracted: number
  pregenerated: number
  knowledgePoints: number
}

export function listQuestions(params: {
  page?: number; pageSize?: number; keyword?: string
  source_type?: string; difficulty?: string; practice_status?: string
}) {
  return client.get<{ items: QuestionItem[]; total: number; page: number; pageSize: number }>(
    '/training/questions', { params },
  )
}

export function getQuestionsStats() {
  return client.get<QuestionsStats>('/training/questions/stats')
}

// ── 训练 ──

export interface TrainingGenerateParams {
  topic?: string
  count?: number
  difficulty?: number
}

export interface TrainingQuestion {
  id?: number
  stem: string
  explanation: string
  difficulty?: number | null
  difficulty_votes?: number[]
  source_type: string
  knowledge_point?: string
}

export function generateTraining(params: TrainingGenerateParams) {
  return client.post<{
    questions: TrainingQuestion[]
    source: 'bank' | 'mixed' | 'generated'
  }>('/training/generate', params)
}

export function recordPractice(
  questionId: number,
  status: 'mastered' | 'review',
) {
  return client.post('/training/record', { questionId, status })
}

export function voteDifficulty(questionId: number, level: number) {
  return client.post<{
    difficulty: number
    votes: number
    locked: boolean
  }>('/training/difficulty', { questionId, level })
}

export function getReviewList(page = 1, pageSize = 20) {
  return client.get('/training/review', { params: { page, pageSize } })
}
