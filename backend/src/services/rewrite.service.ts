import axios from 'axios'

const BASE_URL = process.env.MIMO_BASE_URL || 'https://api.deepseek.com/v1'
const API_KEY = process.env.MIMO_API_KEY || ''
const MODEL = 'deepseek-chat'

export async function rewriteQuery(question: string): Promise<string> {
  for (let attempt = 0; attempt < 3; attempt++) {
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
      const status = (err as any)?.response?.status
      if (status === 429 && attempt < 2) {
        console.log(`[rewrite] 429 限流，${(attempt + 1) * 2000}ms 后重试`)
        await new Promise(r => setTimeout(r, (attempt + 1) * 2000))
        continue
      }
      console.warn('[rewrite] 改写失败，使用原问题:', (err as any)?.message || err)
      return question
    }
  }
  return question
}
