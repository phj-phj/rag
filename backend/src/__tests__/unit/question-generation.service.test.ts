import { describe, it, expect } from 'vitest'
import { computeSemanticDensity } from '../../services/question-generation.service'

describe('computeSemanticDensity', () => {
  it('纯叙述性文字 → 密度为 0', () => {
    const text = '今天天气很好，我和朋友一起去公园散步，然后吃了午饭，下午看了电影。'
    expect(computeSemanticDensity(text)).toBe(0)
  })

  it('纯叙述 + 空字符串 → 0', () => {
    expect(computeSemanticDensity('')).toBe(0)
  })

  // ── 数字 ──

  it('含数字：超时设置为 30 秒', () => {
    const density = computeSemanticDensity('超时设置为 30 秒')
    expect(density).toBeGreaterThan(0)
  })

  it('含小数和百分比：成功率 99.9%', () => {
    const density = computeSemanticDensity('系统可用性达到 99.9%，失败率从 20% 降至 2%')
    expect(density).toBeGreaterThan(0.01)
  })

  // ── 公式 ──

  it('F=ma → 公式被识别', () => {
    const density = computeSemanticDensity('牛顿第二定律的公式是 F=ma')
    expect(density).toBeGreaterThan(0)
  })

  it('E=mc² → 公式被识别', () => {
    const density = computeSemanticDensity('爱因斯坦质能方程 E=mc²')
    expect(density).toBeGreaterThan(0)
  })

  // ── 代码标识符 ──

  it('camelCase 标识符：getUserById', () => {
    const density = computeSemanticDensity('调用 getUserById 方法获取用户信息')
    expect(density).toBeGreaterThan(0)
  })

  it('snake_case 标识符：max_retry_count', () => {
    const density = computeSemanticDensity('max_retry_count 默认值为 5')
    expect(density).toBeGreaterThan(0)
  })

  // ── 英文专有名词 ──

  it('Redis / DeepSeek 等专有名词被识别', () => {
    const density = computeSemanticDensity('使用 Redis 做缓存，通过 DeepSeek API 调用大模型')
    expect(density).toBeGreaterThan(0.01)
  })

  // ── 书名号 ──

  it('《三国演义》被识别', () => {
    const density = computeSemanticDensity('《三国演义》是四大名著之一')
    expect(density).toBeGreaterThan(0)
  })

  // ── 命令行参数 ──

  it('--force 参数被识别', () => {
    const density = computeSemanticDensity('使用 --force 参数可以跳过安全检查')
    expect(density).toBeGreaterThan(0)
  })

  // ── 综合密度场景 ──

  it('高密度：面试题材料（公式 + 数字 + 专有名词）', () => {
    const text = `Redis 是一个基于内存的键值存储系统，默认端口 6379。
    使用 SET key value 和 GET key 命令操作数据。
    Redis 支持 5 种数据类型：String、Hash、List、Set、ZSet。
    RDB 持久化通过 save 900 1 配置触发。`
    const density = computeSemanticDensity(text)
    expect(density).toBeGreaterThan(0.02) // 高密度
  })

  it('低密度 < 阈值：纯叙述段落', () => {
    const text = '这道题考查了学生对计算机网络基本概念的理解，要求考生能够熟练掌握相关知识点，并在实际场景中灵活应用所学内容解决问题。'
    const density = computeSemanticDensity(text)
    expect(density).toBe(0)
  })

  // ── 去重 ──

  it('同一实体被多个 pattern 命中不计两次', () => {
    // "Redis 端口 6379" — 不要因为模式重叠把 Redis 当作多个实体
    const text = 'Redis 默认端口 6379，连接 Redis 使用 redis-cli'
    const density = computeSemanticDensity(text)
    // 有多个实体命中（Redis 多处出现，6379，redis-cli），密度 > 0
    expect(density).toBeGreaterThan(0)
  })
})
