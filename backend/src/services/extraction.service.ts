import { readFile } from 'fs/promises'
import JSZip from 'jszip'

// ── PDF ──

export async function extractPdfText(filePath: string): Promise<string> {
  const { extractText } = await import('unpdf')
  const buffer = await readFile(filePath)
  const uint8 = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)
  const result = await extractText(uint8)
  return result.text.join('\n')
}

export async function extractPdfImages(filePath: string): Promise<string[]> {
  const { getDocumentProxy, extractImages } = await import('unpdf')
  const buffer = await readFile(filePath)
  const uint8 = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)

  const doc = await getDocumentProxy(uint8)
  const base64Images: string[] = []

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    try {
      const pageImages = await extractImages(doc, pageNum)
      for (const img of pageImages) {
        if (img.data) {
          const b64 = Buffer.from(img.data).toString('base64')
          base64Images.push(`data:image/png;base64,${b64}`)
        }
      }
    } catch {
      // Some pages may fail to extract images, skip
    }
  }

  return base64Images
}

// ── DOCX ──

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
    return paragraphs.join('\n')
  }

  // Fallback: just get all text nodes
  const textMatches = xmlStr.match(/<w:t[^>]*>([^<]*)<\/w:t>/g)
  if (!textMatches) return ''
  return textMatches.map((t) => t.replace(/<[^>]+>/g, '')).join('\n')
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

