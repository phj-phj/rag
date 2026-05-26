import { Request, Response } from 'express'
import { askDocument, askDocumentStream } from '../services/chat.service'
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

  console.log(`[chat-stream] 收到问题: ${question.slice(0, 50)}`)

  // 先检索
  let retrieved
  try {
    retrieved = await retrieve(question, 5)
    console.log(`[chat-stream] 检索完成: ${retrieved.length} 个片段`)
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
