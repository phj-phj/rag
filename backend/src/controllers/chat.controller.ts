import { Request, Response } from 'express'
import { askDocument } from '../services/chat.service'
import { retrieve } from '../services/retrieval.service'

export async function ask(req: Request, res: Response): Promise<void> {
  const { question } = req.body

  if (!question || typeof question !== 'string') {
    res.status(400).json({ message: '请输入问题' })
    return
  }

  try {
    // 1. 检索相关 chunk
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

    // 2. 组装 chunks 发给 AI
    const chunks = retrieved.map(r => ({
      title: r.documentTitle,
      content: r.content,
      score: r.score,
    }))

    const result = await askDocument(question, chunks)

    // 3. 去重文档来源
    const docMap = new Map<number, string>()
    for (const r of retrieved) {
      if (!docMap.has(r.documentId)) {
        docMap.set(r.documentId, r.documentTitle)
      }
    }
    const docs = Array.from(docMap.entries()).map(([id, title]) => ({ id, title }))

    res.json({
      answer: result.answer,
      model: result.model,
      docs,
    })
  } catch (err) {
    console.error('[chat] AI 问答失败:', err)
    res.status(500).json({ message: `AI 问答失败: ${(err as Error).message}` })
  }
}
