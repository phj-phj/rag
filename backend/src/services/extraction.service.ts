import { readFile } from 'fs/promises'
import JSZip from 'jszip'
import mammoth from 'mammoth'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse = require('pdf-parse') as (
  buffer: Buffer,
  options?: { max?: number }
) => Promise<{
  numpages: number
  numrender: number
  info: Record<string, unknown>
  metadata: Record<string, unknown>
  text: string
  version: string
}>

// ── Text Cleaning ──

export function cleanText(text: string): string {
  return text
    .replace(/\x00/g, '')
    .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/�/g, '')
    .replace(/•/g, '*')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n').map((l) => l.trimEnd()).join('\n')
    .trim()
}

// ── DOCX ──

export async function extractDocxHtml(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  const result = await mammoth.convertToHtml({ buffer })
  return result.value
}

export async function extractDocxText(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  const zip = await JSZip.loadAsync(buffer)
  const docXml = zip.file('word/document.xml')

  if (!docXml) {
    throw new Error('Invalid DOCX: word/document.xml not found')
  }

  const xmlStr = await docXml.async('string')
  const paraMatches = xmlStr.match(/<w:p[ >][\s\S]*?<\/w:p>/g)

  if (paraMatches) {
    const paragraphs: string[] = []
    for (const para of paraMatches) {
      const texts = para.match(/<w:t[^>]*>([^<]*)<\/w:t>/g)
      if (texts) {
        const line = texts.map((t) => t.replace(/<[^>]+>/g, '')).join('')
        if (line.trim()) paragraphs.push(line)
      }
    }
    return cleanText(paragraphs.join('\n'))
  }

  const textMatches = xmlStr.match(/<w:t[^>]*>([^<]*)<\/w:t>/g)
  if (!textMatches) return ''
  return cleanText(textMatches.map((t) => t.replace(/<[^>]+>/g, '')).join('\n'))
}

export async function extractDocxImages(filePath: string): Promise<string[]> {
  const buffer = await readFile(filePath)
  const zip = await JSZip.loadAsync(buffer)
  const base64Images: string[] = []

  const mediaFolder = zip.folder('word/media')
  if (!mediaFolder) return base64Images

  const imageExts = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'])

  for (const [name, file] of Object.entries(mediaFolder.files)) {
    const ext = name.split('.').pop()?.toLowerCase() || ''
    if (imageExts.has(ext) && !file.dir) {
      const data = await file.async('uint8array')
      const mime = ext === 'jpg' ? 'jpeg' : ext
      const b64 = Buffer.from(data).toString('base64')
      base64Images.push(`data:image/${mime};base64,${b64}`)
    }
  }

  return base64Images
}

// ── Header/Footer Filtering ──

function filterRepeatedLines(text: string): string {
  const pages = text.split(/\n{2,}/)
  if (pages.length < 3) return text

  const linesByPage = pages.map((p) =>
    p.split('\n').map((l) => l.trim()).filter(Boolean)
  )

  // Count how many pages each line appears on
  const freq = new Map<string, number>()
  for (const lines of linesByPage) {
    const seen = new Set(lines)
    for (const l of seen) freq.set(l, (freq.get(l) || 0) + 1)
  }

  // Lines appearing on > 60% of pages → header/footer
  const threshold = pages.length * 0.6
  const toRemove = new Set<string>()
  for (const [line, count] of freq) {
    if (count >= threshold) toRemove.add(line)
  }

  function isPageNumber(line: string): boolean {
    if (/^\d{1,4}$/.test(line)) return true
    if (/^\d+\s*\/\s*\d+$/.test(line)) return true
    if (/^Page\s+\d+\s*(of\s+\d+)?$/i.test(line)) return true
    if (/^-\s*\d+\s*-$/.test(line)) return true
    if (line.length <= 12 && /^第\s*\d+\s*页/.test(line)) return true
    return false
  }

  return linesByPage
    .map((lines) =>
      lines
        .filter((l) => !toRemove.has(l) && !isPageNumber(l))
        .join('\n')
    )
    .join('\n\n')
}

// ── PDF ──

export async function extractPdfText(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  const data = await pdfParse(buffer)
  return filterRepeatedLines(cleanText(data.text))
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function isSentenceEnd(line: string): boolean {
  return /[。！？.!?：:）\)」』"”]$/.test(line)
}

function isListItem(line: string): boolean {
  return /^[●○▪▸►✓✔☞→·•\-*]/.test(line)
}

function isStandaloneNumber(line: string): boolean {
  return /^\d{1,3}$/.test(line)
}

function looksLikeHeading(line: string): boolean {
  return /^\d+[\.\、]\s*\S/.test(line) && line.length < 60
}

function looksLikeCode(line: string): boolean {
  return /^\s*(let |const |var |function |class |import |export |if |for |while |return |console\.|document\.|window\.|this\.|\/\/|\/\*|\*\/|\{|\}|=>)/.test(line)
}

function textToHtml(text: string): string {
  if (!text.trim()) {
    return '<p><em>（此PDF为扫描件，无可提取的文本内容）</em></p>'
  }

  const pages = text.split(/\n{2,}/)
  const blocks: string[] = []

  for (const page of pages) {
    const rawLines = page
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => {
        if (!l) return false
        if (isStandaloneNumber(l)) return false
        if (/^(JavaScript|TypeScript|HTML|CSS|Python|Java|Go|Rust|C\+\+|bash|shell)复制代码$/.test(l)) return false
        return true
      })

    if (!rawLines.length) continue

    // Phase 1: merge soft-wrapped lines into paragraphs
    const merged: string[] = []
    let buf = ''

    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i]
      const isCode = looksLikeCode(line)
      const isShort = line.length < 8 && !isSentenceEnd(line)

      // Flush buffer before: heading, list, code, or when previous was sentence-end
      if (buf) {
        const bufIsSentenceEnd = isSentenceEnd(buf)
        const newSection = looksLikeHeading(line) || isListItem(line) || isCode

        if (bufIsSentenceEnd || newSection) {
          merged.push(buf)
          buf = ''
        } else if (isShort && !isListItem(buf)) {
          // Short standalone: flush previous, this one stands alone too
          merged.push(buf)
          buf = ''
        }
      }

      if (buf) {
        buf += ' ' + line
      } else {
        buf = line
      }

      // Flush: sentence end, list, heading, code, or short standalone
      if (isSentenceEnd(line) || isListItem(line) || looksLikeHeading(line) || isCode || isShort) {
        merged.push(buf)
        buf = ''
      }
    }
    if (buf) merged.push(buf)

    // Phase 2: convert merged lines to HTML
    let inList = false
    let inCode = false

    for (const line of merged) {
      const isCodeLine = looksLikeCode(line)

      if (isCodeLine && !inCode) {
        if (inList) { blocks.push('</ul>'); inList = false }
        blocks.push('<pre><code>')
        inCode = true
      }
      if (!isCodeLine && inCode) {
        blocks.push('</code></pre>')
        inCode = false
      }

      if (looksLikeHeading(line)) {
        if (inList) { blocks.push('</ul>'); inList = false }
        blocks.push(`<h3>${escapeHtml(line)}</h3>`)
      } else if (isListItem(line)) {
        const text = line.replace(/^[●○▪▸►✓✔☞→·•\-*]\s*/, '')
        if (text) {
          if (!inList) { blocks.push('<ul>'); inList = true }
          blocks.push(`<li>${escapeHtml(text)}</li>`)
        }
      } else if (!isCodeLine) {
        if (inList) { blocks.push('</ul>'); inList = false }
        blocks.push(`<p>${escapeHtml(line)}</p>`)
      } else {
        blocks.push(escapeHtml(line))
      }
    }

    if (inList) blocks.push('</ul>')
    if (inCode) blocks.push('</code></pre>')
    blocks.push('<hr class="page-break">')
  }

  // Remove trailing page-break
  if (blocks.length && blocks[blocks.length - 1] === '<hr class="page-break">') {
    blocks.pop()
  }

  return blocks.join('\n')
}

export async function extractPdfHtml(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  const data = await pdfParse(buffer)
  const text = filterRepeatedLines(cleanText(data.text))
  return textToHtml(text)
}

// ── RAG 文本深度清洗 ──

/**
 * 去除 PDF 提取中的噪音：代码复制按钮、纯代码行、HTML 标签碎片
 */
export function cleanForRag(text: string): string {
  return text
    // 去掉 "XXX复制代码" 类噪音（中文技术站代码块标题，中英文混合）
    .replace(/[a-zA-Z]*复制代码[a-zA-Z]*/g, '')
    // 去掉 HTML/CSS/JS/Vue 等语言标签后的"复制代码"
    .replace(/(HTML|CSS|JavaScript|JS|TypeScript|Vue|React|Python|Java|Go|Rust|Shell|Bash|SQL|JSON|XML)\s*复制代码/g, '')
    // 去掉纯代码行（特殊字符占比 > 50% 的行）
    .split('\n')
    .filter(line => {
      const trimmed = line.trim()
      if (!trimmed) return false
      // 行太短无意义
      if (trimmed.length < 4) return false
      // 全是符号/数字的行（代码）
      const alpha = (trimmed.match(/[a-zA-Z一-鿿]/g) || []).length
      if (alpha / trimmed.length < 0.3) return false
      // HTML 标签碎片
      if (/^<[\/]?\w+[^>]*>$/.test(trimmed)) return false
      // 纯 URL
      if (/^https?:\/\/\S+$/.test(trimmed)) return false
      return true
    })
    .join('\n')
    // 去掉残留的 {{ }} 模板语法碎片
    .replace(/\{\{[^}]*\}\}/g, '')
    // 去掉连续的特殊字符
    .replace(/[<>{}()[\]&|~`@#$%^&*+=]{4,}/g, '')
    // 合并多余空白
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// ── RAG 切块用：根据文件类型提取纯文本 ──

export async function getDocumentTextForChunking(
  filePath: string,
  fileType: string,
): Promise<string | null> {
  const type = fileType.toLowerCase()

  try {
    let text = ''
    if (type === 'txt' || type === 'plain') {
      text = cleanText(await readFile(filePath, 'utf-8'))
    } else if (type === 'pdf') {
      text = await extractPdfText(filePath)
    } else if (type === 'docx' || type === 'doc') {
      text = await extractDocxText(filePath)
    } else {
      return null // 图片等不支持切块
    }
    // 深度清洗噪音后再用于切块
    return cleanForRag(text)
  } catch (err) {
    console.error(`[chunking] 提取文本失败 (${fileType}):`, (err as Error).message)
    return null
  }
}
