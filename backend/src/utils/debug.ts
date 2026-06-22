import { createModuleLogger } from './logger'

const DEBUG = process.env.DEBUG_AI === 'true'
const logger = createModuleLogger('ai-debug')

const phases: Array<{ phase: string; startMs: number }> = []

export function debugPhase(name: string): void {
  if (!DEBUG) return
  phases.push({ phase: name, startMs: Date.now() })
  logger.debug(`═══ ${name} ═══`)
}

export function debugInfo(label: string, detail: string | number): void {
  if (!DEBUG) return
  logger.debug(`  ${label}: ${detail}`)
}

export function debugRetrieval(
  chunks: Array<{ title: string; score: number; content: string }>,
  filteredCount: number,
): void {
  if (!DEBUG) return
  logger.debug(`── 检索结果 (${chunks.length}条, 过滤${filteredCount}条) ──`)
  chunks.forEach(c => {
    const icon = c.score >= 0.4 ? '✓' : '✗'
    const preview = c.content.slice(0, 80).replace(/\n/g, ' ')
    logger.debug(`  ${icon} [${c.score.toFixed(3)}] [${c.title}] ${preview}...`)
  })
}

export function debugRoute(
  verdict: 'fast' | 'deep',
  score: number,
  reason: string,
): void {
  if (!DEBUG) return
  const label = verdict === 'fast' ? '快速通道' : '深度通道'
  logger.debug(`── 路由: ${label} (得分=${score}, ${reason}) ──`)
}

export function debugConfidence(
  avgScore: number,
  verdict: 'high' | 'medium' | 'low',
): void {
  if (!DEBUG) return
  const icon = verdict === 'high' ? '✓' : verdict === 'medium' ? '△' : '✗'
  logger.debug(`${icon} 命中置信度: ${verdict} (平均分 ${avgScore.toFixed(3)})`)
}

export function debugLLM(ttfbMs: number, totalMs: number, tokens: number): void {
  if (!DEBUG) return
  logger.debug(`  LLM: TTFB=${ttfbMs}ms 总=${totalMs}ms tokens=${tokens}`)
}

export function debugTiming(): void {
  if (!DEBUG || phases.length === 0) return
  const now = Date.now()
  const parts = phases.map(p => `${p.phase}=${now - p.startMs}ms`)
  logger.debug(
    `═══ 耗时: ${parts.join(' | ')} | 总=${now - phases[0].startMs}ms ═══`,
  )
  phases.length = 0
}

export function getLogFilePath(): string | null {
  return 'logs/ai-debug.log'
}
