import { Request, Response } from 'express'
import { askDocument, askDocumentStream, askDocumentForTraining, startTrainingStream } from '../services/chat.service'
import { retrieve } from '../services/retrieval.service'
import { rewriteQuery } from '../services/rewrite.service'
import { routeQuery } from '../services/router.service'
import { debugPhase, debugInfo, debugRetrieval, debugConfidence, debugLLM, debugTiming, debugRoute } from '../utils/debug'
import { BadRequestError } from '../utils/errors'
import { classifyIntent } from '../services/intent-classifier.service'
import { executeText2Sql } from '../services/text2sql.service'
import { createModuleLogger } from '../utils/logger'

const logger = createModuleLogger('chat')

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

export async function ask(req: Request, res: Response): Promise<void> {
  const { question } = req.body

  debugPhase('收到问题 (非流式)')
  debugInfo('原始问题', question)

  // 路由判定
  const route = routeQuery(question)
  debugRoute(route.verdict, route.score, route.reason)

  // Text2SQL：查元数据的问题走 SQL 路径
  const intent = classifyIntent(question)
  if (intent === 'data_query') {
    logger.info(`[chat] Text2SQL 路径: ${question.slice(0, 40)}`)
    const sqlAnswer = await executeText2Sql(question)
    debugTiming()
    res.json({ answer: sqlAnswer, model: 'text2sql', docs: [] })
    return
  }

  try {
    // Query 泛化 + 检索（快速/深度共用）
    const rewritten = await rewriteQuery(question)
    debugInfo('改写结果', rewritten || '(空)')
    const retrievalQuery = question + ' ' + rewritten

    const retrievalStart = Date.now()
    const retrieved = await retrieve(retrievalQuery, 5)
    debugInfo('检索耗时', `${Date.now() - retrievalStart}ms`)

    // 过滤低分 chunk
    const MIN_SCORE = 0.1
    const filtered = retrieved.filter(r => r.score >= MIN_SCORE)
    debugRetrieval(
      retrieved.map(r => ({ title: r.documentTitle, score: r.score, content: r.content })),
      retrieved.length - filtered.length,
    )

    if (filtered.length === 0) {
      debugInfo('结果', '无相关片段')
      debugTiming()
      res.json({
        answer: '当前文档库中未找到相关信息。请尝试更换关键词或上传相关文档。',
        model: 'retrieval',
        docs: [],
      })
      return
    }

    const avgScore = filtered.reduce((s, r) => s + r.score, 0) / filtered.length
    debugConfidence(avgScore, avgScore >= 0.3 ? 'high' : avgScore >= 0.15 ? 'medium' : 'low')

    const topDoc = filtered[0]
    const docs = topDoc ? [{ id: topDoc.documentId, title: topDoc.documentTitle }] : []

    // ── LLM 生成 ──
    const chunks = filtered.map(r => ({
      title: r.documentTitle,
      content: r.content,
      score: r.score,
    }))

    const llmStart = Date.now()
    const result = await askDocument(question, chunks, req.body.thinking === true)
    debugLLM(0, Date.now() - llmStart, 0)
    debugTiming()

    res.json({ answer: result.answer, model: result.model, docs })
  } catch (err) {
    logger.error('[chat] AI 问答失败:', err)
    res.status(500).json({ message: `AI 问答失败: ${(err as Error).message}` })
  }
}

// ── 流式 SSE ──

export async function askStream(req: Request, res: Response): Promise<void> {
  const { question } = req.body

  debugPhase('收到问题 (流式)')
  debugInfo('原始问题', question)

  // 路由判定
  const route = routeQuery(question)
  debugRoute(route.verdict, route.score, route.reason)

  // Text2SQL：查元数据的问题走 SQL 路径（非流式直接返回）
  const intent = classifyIntent(question)
  if (intent === 'data_query') {
    logger.info(`[chat-stream] Text2SQL 路径: ${question.slice(0, 40)}`)
    const sqlAnswer = await executeText2Sql(question)
    debugTiming()
    res.json({ answer: sqlAnswer, model: 'text2sql', docs: [] })
    return
  }

  // Query 泛化
  const rewritten = await rewriteQuery(question)
  debugInfo('改写结果', rewritten || '(空)')
  const retrievalQuery = question + ' ' + rewritten

  // 检索
  const retrievalStart = Date.now()
  let retrieved
  try {
    retrieved = await retrieve(retrievalQuery, 5)
    debugInfo('检索耗时', `${Date.now() - retrievalStart}ms`)

    // 过滤低分 chunk
    const MIN_SCORE = 0.1
    const filtered = retrieved.filter((r: any) => r.score >= MIN_SCORE)
    debugRetrieval(
      retrieved.map((r: any) => ({ title: r.documentTitle, score: r.score, content: r.content })),
      retrieved.length - filtered.length,
    )

    if (filtered.length === 0) {
      debugInfo('结果', '无相关片段，不调用LLM')
      debugTiming()
      res.json({
        answer: '当前文档库中未找到相关信息。请尝试更换关键词或上传相关文档。',
        model: 'retrieval',
        docs: [],
      })
      return
    }

    const avgScore = filtered.reduce((s: number, r: any) => s + r.score, 0) / filtered.length
    debugConfidence(avgScore, avgScore >= 0.3 ? 'high' : avgScore >= 0.15 ? 'medium' : 'low')

    const chunks = filtered.map((r: any) => ({
      title: r.documentTitle,
      content: r.content,
      score: r.score,
    }))

    // 只展示相似度最高的文档
    const topDoc = filtered[0]
    const docs = topDoc ? [{ id: topDoc.documentId, title: topDoc.documentTitle }] : []

    // ── LLM 流式生成 ──
    // SSE 头
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.flushHeaders()

    try {
      const stream = askDocumentStream(question, chunks, req.body.thinking === true)

      // 先发 docs
      res.write(`data: ${JSON.stringify({ type: 'docs', docs })}\n\n`)

      let tokenCount = 0
      const llmStart = Date.now()
      for await (const token of stream) {
        tokenCount++
        res.write(`data: ${JSON.stringify({ type: 'token', content: token })}\n\n`)
      }

      const llmMs = Date.now() - llmStart
      debugLLM(0, llmMs, tokenCount)
      debugTiming()

      res.write('data: [DONE]\n\n')
      res.end()
    } catch (err) {
      logger.error('[chat-stream] 流式生成失败:', err)
      res.write(`data: ${JSON.stringify({ type: 'error', message: (err as Error).message })}\n\n`)
      res.end()
    }
  } catch (err) {
    logger.error('[chat-stream] 检索失败:', err)
    res.status(500).json({ message: `检索失败: ${(err as Error).message}` })
    return
  }

}

// ── 每日训练：AI 出题 ──

export async function train(req: Request, res: Response): Promise<void> {
  const { question } = req.body

  logger.info(`[train] 收到出题需求，长度: ${question.length} 字`)

  try {
    // 1. 检索相关片段
    const retrieved = await retrieve(question, 10)
    if (retrieved.length === 0) {
      res.json({ questions: [], docs: [], message: '当前文档库中没有相关内容' })
      return
    }

    // 2. 去重文档来源
    const docMap = new Map<number, string>()
    for (const r of retrieved) {
      if (!docMap.has(r.documentId)) docMap.set(r.documentId, r.documentTitle)
    }
    const docs = Array.from(docMap.entries()).map(([id, title]) => ({ id, title }))

    // 3. 组装 chunks 发给 LLM 出题
    const chunks = retrieved.map(r => ({ title: r.documentTitle, content: r.content, score: r.score }))
    const answer = await askDocumentForTraining(question, chunks, TRAINING_PROMPT)

    // 4. 解析 JSON
    logger.info('[train] LLM 返回长度:', answer.length, '字，结尾30字:', answer.slice(-30))
    const questions = parseQuestions(answer)
    logger.info(`[train] 生成 ${questions.length} 道题目`)

    res.json({ questions, docs })
  } catch (err) {
    logger.error('[train] 出题失败:', err)
    res.status(500).json({ message: `出题失败: ${(err as Error).message}` })
  }
}

/**
 * 从 LLM 返回的文本中提取 JSON 题目数组
 * 适配各种可能的输出格式
 */
// ── 每日训练：流式出题 SSE ──

export async function trainStream(req: Request, res: Response): Promise<void> {
  const { question } = req.body

  const reqStart = Date.now()
  logger.info(`[train-stream] 收到出题需求，长度: ${question.length} 字`)

  // 检索
  const retrievalStart = Date.now()
  let retrieved
  try {
    retrieved = await retrieve(question, 10)
  } catch (err) {
    res.status(500).json({ message: `检索失败: ${(err as Error).message}` })
    return
  }
  const retrievalMs = Date.now() - retrievalStart

  if (retrieved.length === 0) {
    res.json({ questions: [], docs: [], message: '当前文档库中没有相关内容' })
    return
  }

  const docMap = new Map<number, string>()
  for (const r of retrieved) {
    if (!docMap.has(r.documentId)) docMap.set(r.documentId, r.documentTitle)
  }
  const docs = Array.from(docMap.entries()).map(([id, title]) => ({ id, title }))
  const chunks = retrieved.map(r => ({ title: r.documentTitle, content: r.content, score: r.score }))

  // SSE 头
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  try {
    const { diagnostics, stream } = await startTrainingStream(question, chunks, TRAINING_PROMPT)

    // 先发 docs + 检索阶段 diagnostics
    res.write(`data: ${JSON.stringify({ type: 'docs', docs })}\n\n`)
    res.write(`data: ${JSON.stringify({
      type: 'diagnostics',
      phase: 'retrieval',
      retrievalMs,
      ...diagnostics,
    })}\n\n`)

    let total = 0
    for await (const event of stream) {
      if (event.type === 'question') {
        total++
        const elapsedMs = Date.now() - reqStart
        logger.info(`[train-stream] 题目${total} (${elapsedMs}ms):`, JSON.stringify(event.question).slice(0, 80))
        res.write(`data: ${JSON.stringify({ type: 'question', question: event.question, index: total - 1, elapsedMs })}\n\n`)
      } else if (event.type === 'llmDone') {
        res.write(`data: ${JSON.stringify({
          type: 'diagnostics',
          phase: 'llm',
          ttfbMs: event.ttfbMs,
          llmMs: event.llmMs,
          totalChunks: event.totalChunks,
        })}\n\n`)
      }
    }

    logger.info(`[train-stream] 生成 ${total} 道题目`)
    res.write(`data: ${JSON.stringify({ type: 'done', total })}\n\n`)
    res.end()
  } catch (err) {
    logger.error('[train-stream] 流式生成失败:', err)
    res.write(`data: ${JSON.stringify({ type: 'error', message: (err as Error).message })}\n\n`)
    res.end()
  }
}

function parseQuestions(raw: string): Array<{ q: string; a: string }> {
  try {
    // 尝试直接解析
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed
    if (parsed.questions) return parsed.questions
    return []
  } catch {
    // 尝试从文本中提取 JSON 数组
    const match = raw.match(/\[\s*\{[\s\S]*\}\s*\]/)
    if (match) {
      try { return JSON.parse(match[0]) } catch { /* fall through */ }
    }
  }
  logger.warn('[train] 无法解析 LLM 返回的题目 JSON')
  return []
}
