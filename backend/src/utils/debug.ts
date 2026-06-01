import fs from 'fs'
import path from 'path'

const DEBUG = process.env.DEBUG_AI === 'true'
const LOG_DIR = path.resolve(__dirname, '../../logs')
const MAX_LOGS = 3

// ── 日志文件初始化（选一个可写的 slot）──

let logFile: string | null = null
let logStream: fs.WriteStream | null = null

function initLogFile(): void {
  if (!DEBUG) return

  // 确保目录存在
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true })
  }

  // 收集已有日志文件及其修改时间
  const existing: Array<{ name: string; mtime: number }> = []
  for (let n = 1; n <= MAX_LOGS; n++) {
    const fp = path.join(LOG_DIR, `ai-debug-${n}.log`)
    if (fs.existsSync(fp)) {
      existing.push({ name: fp, mtime: fs.statSync(fp).mtimeMs })
    }
  }

  // 确定用哪个 slot
  let target: string
  if (existing.length < MAX_LOGS) {
    // 有空白 slot，找第一个未占用的
    for (let i = 1; i <= MAX_LOGS; i++) {
      const fp = path.join(LOG_DIR, `ai-debug-${i}.log`)
      if (!existing.find(e => e.name === fp)) {
        target = fp
        break
      }
    }
    target = target! // 永远不会走到这里
  } else {
    // 全满 → 覆盖最旧的那个
    existing.sort((a, b) => a.mtime - b.mtime)
    target = existing[0].name
  }

  logFile = target
  logStream = fs.createWriteStream(target, { flags: 'w' }) // 'w' 覆盖
  writeLine(`═════ AI Debug 日志 — ${new Date().toISOString()} ═════\n`)
}

function writeLine(text: string): void {
  if (logStream) {
    logStream.write(text + '\n')
  }
}

// ── 模块加载时初始化 ──

initLogFile()

// ── 阶段标记 ──

const phases: Array<{ phase: string; startMs: number }> = []

export function debugPhase(name: string): void {
  if (!DEBUG) return
  phases.push({ phase: name, startMs: Date.now() })
  const line = `[ai-debug] ═══ ${name} ═══`
  console.log(line)
  writeLine(line)
}

// ── 关键信息 ──

export function debugInfo(label: string, detail: string | number): void {
  if (!DEBUG) return
  const line = `[ai-debug]   ${label}: ${detail}`
  console.log(line)
  writeLine(line)
}

// ── 检索结果一览 ──

export function debugRetrieval(chunks: Array<{ title: string; score: number; content: string }>, filteredCount: number): void {
  if (!DEBUG) return
  const header = `[ai-debug] ── 检索结果 (${chunks.length}条, 过滤${filteredCount}条) ──`
  console.log(header)
  writeLine(header)
  chunks.forEach((c, _i) => {
    const icon = c.score >= 0.4 ? '✓' : '✗'
    const preview = c.content.slice(0, 80).replace(/\n/g, ' ')
    const line = `[ai-debug]   ${icon} [${c.score.toFixed(3)}] [${c.title}] ${preview}...`
    console.log(line)
    writeLine(line)
  })
}

// ── 路由判定 ──

export function debugRoute(verdict: 'fast' | 'deep', score: number, reason: string): void {
  if (!DEBUG) return
  const label = verdict === 'fast' ? '快速通道 ⚡' : '深度通道 🧠'
  console.log(`[ai-debug] ── 路由: ${label} (得分=${score}, ${reason}) ──`)
  writeLine(`[ai-debug] ── 路由: ${label} (得分=${score}, ${reason}) ──`)
}

// ── 置信度 ──

export function debugConfidence(avgScore: number, verdict: 'high' | 'medium' | 'low'): void {
  if (!DEBUG) return
  const icon = verdict === 'high' ? '✓' : verdict === 'medium' ? '△' : '✗'
  const line = `[ai-debug] ${icon} 命中置信度: ${verdict} (平均分 ${avgScore.toFixed(3)})`
  console.log(line)
  writeLine(line)
}

// ── LLM 耗时 ──

export function debugLLM(ttfbMs: number, totalMs: number, tokens: number): void {
  if (!DEBUG) return
  const line = `[ai-debug]   LLM: TTFB=${ttfbMs}ms 总=${totalMs}ms tokens=${tokens}`
  console.log(line)
  writeLine(line)
}

// ── 总耗时 ──

export function debugTiming(): void {
  if (!DEBUG || phases.length === 0) return
  const now = Date.now()
  const parts = phases.map(p => `${p.phase}=${now - p.startMs}ms`)
  const line = `[ai-debug] ═══ 耗时: ${parts.join(' | ')} | 总=${now - phases[0].startMs}ms ═══`
  console.log(line)
  writeLine(line)
  phases.length = 0
}

// ── 当前日志文件路径（供外部查询）──

export function getLogFilePath(): string | null {
  return logFile
}
