import fs from 'fs/promises'
import path from 'path'

const UPLOADS_DIR = path.resolve(__dirname, '../../uploads')

export async function deleteFile(filePath: string): Promise<void> {
  const filename = filePath.replace(/^\/?uploads\//, '')
  const fullPath = path.join(UPLOADS_DIR, filename)
  try {
    await fs.unlink(fullPath)
  } catch {
    // File may not exist, ignore
  }
}

export function getFileUrl(storedPath: string): string {
  const filename = storedPath.replace(/^\/?uploads\//, '')
  return `/uploads/${filename}`
}
