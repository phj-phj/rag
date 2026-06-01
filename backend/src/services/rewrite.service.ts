import axios from 'axios'

const BASE_URL = process.env.MIMO_BASE_URL || 'https://token-plan-cn.xiaomimimo.com/v1'
const API_KEY = process.env.MIMO_API_KEY || ''
const MODEL = 'mimo-v2.5'

export async function rewriteQuery(question: string): Promise<string> {
  try {
    const start = Date.now()
    const res = await axios.post(
      `${BASE_URL}/chat/completions`,
      {
        model: MODEL,
        temperature: 0,
        max_tokens: 60,
        messages: [
          {
            role: 'system',
            content: '把用户问题改写成2-3个检索用关键词，用空格分隔，直接输出关键词。\n\n示例:\n用户：HashMap怎么扩容的？\n输出：HashMap扩容 扩容机制 rehash',
          },
          { role: 'user', content: question },
        ],
      },
      {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 5000,
      },
    )

    const rewritten = res.data?.choices?.[0]?.message?.content?.trim() || ''
    const elapsed = Date.now() - start
    console.log(`[rewrite] ${elapsed}ms: "${question.slice(0, 40)}..." → "${rewritten}"`)
    return rewritten || question
  } catch (err) {
    console.warn('[rewrite] 改写失败，使用原问题:', (err as any)?.message || err)
    return question
  }
}
