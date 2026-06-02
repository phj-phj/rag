import { Request, Response } from 'express'
import { Op } from 'sequelize'
import sequelize from '../config/database'
import { Question, PracticeRecord } from '../models'
import { NotFoundError } from '../utils/errors'
import { retrieve } from '../services/retrieval.service'
import {
  askDocumentForTraining,
  startTrainingStream,
} from '../services/chat.service'
import { parseExtractionResponse } from '../services/question-utils'

const TRAINING_PROMPT = `你是 Papier 出题助手。根据以下参考资料生成题目。

要求：
1. 生成用户需要的题目数量
2. 每道题目附带答案，答案要详细、从参考资料中提取
3. 必须以 JSON 数组格式输出，不要输出其他内容
4. JSON 格式：[{{"q": "题目", "a": "答案"}}, ...]
5. 题目必须自包含：题干中禁止出现"根据面经""结合本文""参考资料"等引用来源的表述
6. 答案中禁止出现"根据面经""参考资料显示""文中提到"等字样，直接给出知识点内容

参考资料：
{chunks}`

// ── GET /api/questions ──
export async function listQuestions(req: Request, res: Response): Promise<void> {
  const page = Math.max(1, Number(req.query.page) || 1)
  const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize) || 20))
  const keyword = req.query.keyword as string | undefined
  const sourceType = req.query.source_type as string | undefined
  const diff = req.query.difficulty as string | undefined

  const where: any = { source_type: ['extracted', 'ai_pregenerated'] }
  if (sourceType && sourceType !== 'all') where.source_type = sourceType
  if (diff && diff !== 'all') where.difficulty = Number(diff)
  if (keyword) {
    where[Op.or] = [
      { stem: { [Op.like]: `%${keyword}%` } },
      { knowledge_point: { [Op.like]: `%${keyword}%` } },
    ]
  }

  const { count, rows } = await Question.findAndCountAll({
    where,
    order: [['id', 'DESC']],
    limit: pageSize,
    offset: (page - 1) * pageSize,
  })
  res.json({ items: rows, total: count, page, pageSize })
}

// ── GET /api/questions/stats ──
export async function questionStats(_req: Request, res: Response): Promise<void> {
  const total = await Question.count({ where: { source_type: ['extracted', 'ai_pregenerated'] } })
  const extracted = await Question.count({ where: { source_type: 'extracted' } })
  const pregenerated = await Question.count({ where: { source_type: 'ai_pregenerated' } })
  const kpRows: any[] = await Question.findAll({
    attributes: [[sequelize.fn('DISTINCT', sequelize.col('knowledge_point')), 'kp']],
    where: { knowledge_point: { [Op.ne]: null as any }, source_type: ['extracted', 'ai_pregenerated'] },
    raw: true,
  })
  res.json({ total, extracted, pregenerated, knowledgePoints: kpRows.length })
}

// ── 非流式：POST /api/training/generate ──

export async function generate(req: Request, res: Response): Promise<void> {
  const { topic, count = 10, difficulty } = req.body

  const where: any = {
    source_type: ['extracted', 'ai_pregenerated'],
  }
  if (topic) where.knowledge_point = { [Op.like]: `%${topic}%` }
  if (difficulty) where.difficulty = difficulty

  const existing = await Question.findAll({
    where,
    limit: count * 3,
    order: sequelize.random(),
  })

  if (difficulty) {
    const selected = existing.slice(0, count)
    res.json({ questions: selected, source: 'bank' })
    return
  }

  if (existing.length >= count * 2) {
    const bankCount = Math.ceil(count * 0.8)
    const selected = existing.slice(0, bankCount)
    const genCount = count - bankCount
    const generated = await aiGenerateAdhoc(topic, genCount)
    res.json({ questions: [...selected, ...generated], source: 'mixed' })
  } else if (existing.length >= count * 0.5) {
    const bankCount = Math.min(existing.length, Math.ceil(count * 0.6))
    const selected = existing.slice(0, bankCount)
    const genCount = count - bankCount
    const generated = await aiGenerateAdhoc(topic, genCount)
    res.json({ questions: [...selected, ...generated], source: 'mixed' })
  } else {
    const generated = await aiGenerateAdhoc(topic, count)
    res.json({ questions: generated, source: 'generated' })
  }
}

// ── 流式：POST /api/training/generate/stream ──

export async function generateStream(req: Request, res: Response): Promise<void> {
  const { topic, count = 10, difficulty } = req.body

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  const where: any = { source_type: ['extracted', 'ai_pregenerated'] }
  if (topic) where.knowledge_point = { [Op.like]: `%${topic}%` }
  if (difficulty) where.difficulty = difficulty

  const existing = await Question.findAll({
    where,
    limit: difficulty ? count : Math.ceil(count * 0.8),
    order: sequelize.random(),
  })

  if (existing.length > 0) {
    res.write(
      `data: ${JSON.stringify({ type: 'bank', questions: existing })}\n\n`,
    )
  }

  if (difficulty || existing.length >= count) {
    res.write(
      `data: ${JSON.stringify({ type: 'done', total: existing.length })}\n\n`,
    )
    res.end()
    return
  }

  const needCount = count - existing.length
  const askCount = Math.ceil(needCount * 1.5)
  let retrieved: any[]
  try {
    retrieved = await retrieve(topic || '知识要点', Math.ceil(askCount * 1.5))
  } catch {
    res.write(
      `data: ${JSON.stringify({ type: 'error', message: '检索失败，请稍后重试' })}\n\n`,
    )
    res.end()
    return
  }

  const chunks = retrieved.map((r) => ({
    title: r.documentTitle,
    content: r.content,
    score: r.score,
  }))

  try {
    const { stream } = await startTrainingStream(
      `请生成至少${askCount}道关于"${topic || '以下内容'}"的论述题`,
      chunks,
      TRAINING_PROMPT,
    )
    let aiCount = 0
    for await (const event of stream) {
      if (event.type === 'question' && aiCount < needCount) {
        res.write(
          `data: ${JSON.stringify({
            type: 'question',
            question: {
              stem: event.question.q,
              explanation: event.question.a,
              source_type: 'ai_adhoc',
            },
          })}\n\n`,
        )
        aiCount++
      }
    }
    res.write(
      `data: ${JSON.stringify({ type: 'done', total: existing.length + aiCount })}\n\n`,
    )
  } catch (err) {
    res.write(
      `data: ${JSON.stringify({ type: 'error', message: (err as Error).message })}\n\n`,
    )
  }
  res.end()
}

// ── 非流式 AI 生成辅助 ──

async function aiGenerateAdhoc(topic: string, count: number): Promise<any[]> {
  const retrieved = await retrieve(topic || '知识要点', Math.ceil(count * 1.5))
  const chunks = retrieved.map((r) => ({
    title: r.documentTitle,
    content: r.content,
    score: r.score,
  }))
  // 多要 50%，确保 LLM 返回足够数量
  const askCount = Math.ceil(count * 1.5)
  const result = await askDocumentForTraining(
    `请生成至少${askCount}道关于"${topic || '以下内容'}"的论述题`,
    chunks,
    TRAINING_PROMPT,
  )
  const parsed = parseExtractionResponse(result)
  // 打乱后截断到精确数量
  const shuffled = parsed.sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count).map((q) => ({
    stem: q.q.trim(),
    explanation: q.a.trim(),
    type: 'essay',
    source_type: 'ai_adhoc',
  }))
}

// ── POST /api/training/record ──

export async function record(req: Request, res: Response): Promise<void> {
  const { questionId, status } = req.body
  const [record] = await PracticeRecord.upsert({
    user_id: req.user!.id,
    question_id: questionId,
    status,
  })
  res.json({ message: '已记录' })
}

// ── POST /api/training/difficulty ──

export async function voteDifficulty(
  req: Request,
  res: Response,
): Promise<void> {
  const { questionId, level } = req.body
  const q = await Question.findByPk(questionId)
  if (!q) throw new NotFoundError('题目不存在')

  const currentVotes: number[] = Array.isArray(q.difficulty_votes)
    ? q.difficulty_votes
    : []
  const votes: number[] = [...currentVotes, level]
  const sorted = [...votes].sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)]

  q.difficulty = median
  q.difficulty_votes = votes.length >= 20 ? [] : votes
  await q.save()

  res.json({ difficulty: median, votes: votes.length, locked: votes.length >= 20 })
}

// ── GET /api/training/review ──

export async function getReview(req: Request, res: Response): Promise<void> {
  const page = Math.max(1, Number(req.query.page) || 1)
  const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize) || 20))

  const { count, rows } = await PracticeRecord.findAndCountAll({
    where: { user_id: req.user!.id, status: 'review' },
    include: [
      {
        model: Question,
        as: 'question',
        attributes: [
          'id',
          'stem',
          'explanation',
          'knowledge_point',
          'difficulty',
        ],
      },
    ],
    order: [['created_at', 'DESC']],
    limit: pageSize,
    offset: (page - 1) * pageSize,
  })

  res.json({ items: rows, total: count, page, pageSize })
}
