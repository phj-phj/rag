import { Request, Response } from 'express'
import { askDocument, askDocumentStream, askDocumentForTraining, startTrainingStream } from '../services/chat.service'
import { retrieve } from '../services/retrieval.service'

export async function ask(req: Request, res: Response): Promise<void> {
  const { question } = req.body

  if (!question || typeof question !== 'string') {
    res.status(400).json({ message: '请输入问题' })
    return
  }

  try {
    const retrieved = await retrieve(question, 5)
    console.log(`[chat] 检索完成，命中 ${retrieved.length} 个片段`)

    if (retrieved.length === 0) {
      res.json({
        answer: '当前文档库中没有相关内容。请先上传一些文档，我就能帮你查找答案了。',
        model: 'retrieval',
        docs: [],
      })
      return
    }

    const chunks = retrieved.map(r => ({
      title: r.documentTitle,
      content: r.content,
      score: r.score,
    }))

    const result = await askDocument(question, chunks)

    const docMap = new Map<number, string>()
    for (const r of retrieved) {
      if (!docMap.has(r.documentId)) docMap.set(r.documentId, r.documentTitle)
    }
    const docs = Array.from(docMap.entries()).map(([id, title]) => ({ id, title }))

    res.json({ answer: result.answer, model: result.model, docs })
  } catch (err) {
    console.error('[chat] AI 问答失败:', err)
    res.status(500).json({ message: `AI 问答失败: ${(err as Error).message}` })
  }
}

// ── 流式 SSE ──

export async function askStream(req: Request, res: Response): Promise<void> {
  const { question } = req.body

  if (!question || typeof question !== 'string') {
    res.status(400).json({ message: '请输入问题' })
    return
  }

  console.log(`[chat-stream] 收到问题，长度: ${question.length} 字`)

  // 先检索
  let retrieved
  try {
    retrieved = await retrieve(question, 5)
    console.log(`[chat-stream] 检索命中: ${retrieved.length} 个片段`)
  } catch (err) {
    console.error('[chat-stream] 检索失败:', err)
    res.status(500).json({ message: `检索失败: ${(err as Error).message}` })
    return
  }

  if (retrieved.length === 0) {
    res.json({
      answer: '当前文档库中没有相关内容。请先上传一些文档，我就能帮你查找答案了。',
      model: 'retrieval',
      docs: [],
    })
    return
  }

  const chunks = retrieved.map(r => ({
    title: r.documentTitle,
    content: r.content,
    score: r.score,
  }))

  // 去重文档来源
  const docMap = new Map<number, string>()
  for (const r of retrieved) {
    if (!docMap.has(r.documentId)) docMap.set(r.documentId, r.documentTitle)
  }
  const docs = Array.from(docMap.entries()).map(([id, title]) => ({ id, title }))

  // SSE 头
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  try {
    console.log('[chat-stream] 开始调用 LLM...')
    const stream = askDocumentStream(question, chunks)

    // 先发 docs
    res.write(`data: ${JSON.stringify({ type: 'docs', docs })}\n\n`)

    let tokenCount = 0
    for await (const token of stream) {
      tokenCount++
      res.write(`data: ${JSON.stringify({ type: 'token', content: token })}\n\n`)
    }

    console.log(`[chat-stream] LLM 生成完成, 共 ${tokenCount} 个 token`)
    res.write('data: [DONE]\n\n')
    res.end()
  } catch (err) {
    console.error('[chat-stream] 流式生成失败:', err)
    res.write(`data: ${JSON.stringify({ type: 'error', message: (err as Error).message })}\n\n`)
    res.end()
  }
}

// ── 每日训练：AI 出题 ──

export async function train(req: Request, res: Response): Promise<void> {
  const { question } = req.body

  if (!question || typeof question !== 'string') {
    res.status(400).json({ message: '请输入出题需求' })
    return
  }

  console.log(`[train] 收到出题需求，长度: ${question.length} 字`)

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
    const answer = await askDocumentForTraining(question, chunks)

    // 4. 解析 JSON
    console.log('[train] LLM 返回长度:', answer.length, '字，结尾30字:', answer.slice(-30))
    const questions = parseQuestions(answer)
    console.log(`[train] 生成 ${questions.length} 道题目`)

    res.json({ questions, docs })
  } catch (err) {
    console.error('[train] 出题失败:', err)
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

  if (!question || typeof question !== 'string') {
    res.status(400).json({ message: '请输入出题需求' })
    return
  }

  const reqStart = Date.now()
  console.log(`[train-stream] 收到出题需求，长度: ${question.length} 字`)

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
    const { diagnostics, stream } = await startTrainingStream(question, chunks)

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
        console.log(`[train-stream] 题目${total} (${elapsedMs}ms):`, JSON.stringify(event.question).slice(0, 80))
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

    console.log(`[train-stream] 生成 ${total} 道题目`)
    res.write(`data: ${JSON.stringify({ type: 'done', total })}\n\n`)
    res.end()
  } catch (err) {
    console.error('[train-stream] 流式生成失败:', err)
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
  console.warn('[train] 无法解析 LLM 返回的题目 JSON')
  return []
}
